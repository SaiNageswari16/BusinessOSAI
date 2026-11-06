"""Quotation Sender Service — dispatch Quotation PDFs to customers via WhatsApp & SMTP Email.

Features:
1. Renders high-quality PDF quotations matching tenant's branding and document style.
2. WhatsApp dispatch via the tenant's connected WhatsApp session (WhatsApp Gateway /send-media).
3. Email dispatch with PDF attachment via tenant/company SMTP settings (src.utils.email.send_email).
4. Activity & notification logging (LeadActivity + LiveNotification).
"""
from __future__ import annotations

import base64
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None

from src.models import Tenant, Customer, Lead, LeadActivity, CRMQuotation, Company
from src.services.invoice_pdf import get_active_invoice_template, _find_logo_path, _generate_qr_code_file
from src.utils.email import send_email
from src.utils.notifications import add_system_notification
from src.utils.clock import clock

logger = logging.getLogger(__name__)

# WhatsApp gateway URL
_raw_gateway_url = os.getenv("WHATSAPP_GATEWAY_URL", "http://127.0.0.1:8005")
GATEWAY_URL = _raw_gateway_url.replace("localhost", "127.0.0.1")

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
QUOTATION_PDF_DIR = _BACKEND_ROOT / "static" / "quotations"
QUOTATION_PDF_DIR.mkdir(parents=True, exist_ok=True)


class QuotationSendError(Exception):
    """Raised when quotation sending fails."""


def _fmt_amount(value: float | None) -> str:
    if value is None:
        return "0.00"
    return f"{float(value):,.2f}"


def _safe_text(value: Any, max_length: int = 300) -> str:
    """Normalize text for fpdf built-in fonts (latin-1 safe)."""
    if value is None:
        return ""
    text = str(value)
    replacements = {
        "₹": "Rs.",
        "—": "-",
        "–": "-",
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        "•": "-",
        "·": "-",
        "…": "...",
        "\u2022": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u20b9": "Rs.",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    # Ensure safe ascii/latin-1 representation
    try:
        text = text.encode("latin-1", errors="replace").decode("latin-1")
    except Exception:
        text = "".join(c if ord(c) < 128 else "?" for c in text)
    return text[:max_length]


def _upi_pay_url(vpa: str, payee: str, amount: float) -> str:
    """Build a standard UPI deep-link that GPay/PhonePe/Paytm/BHIM can scan."""
    from urllib.parse import quote
    parts = [f"upi://pay?pa={quote(str(vpa or '').strip())}"]
    if payee:
        parts.append(f"pn={quote(str(payee).strip())}")
    if amount:
        parts.append(f"am={float(amount):.2f}")
    return "&".join(parts)


def _hex_to_rgb(hex_color: str | None) -> tuple[int, int, int]:
    if not hex_color:
        return (0, 168, 132)  # Teal/Emerald default
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    try:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return (r, g, b)
    except ValueError:
        return (0, 168, 132)


async def _get_gateway_session_id(allowed_sessions: list[str] | None = None) -> str | None:
    """Return the session id / phone of the first CONNECTED WhatsApp session strictly belonging to the tenant."""
    if not allowed_sessions:
        return None
    try:
        async with httpx.AsyncClient(timeout=4.0) as http:
            resp = await http.get(f"{GATEWAY_URL}/sessions")
            if resp.status_code != 200:
                return None
            sessions = resp.json()
            for sid in allowed_sessions:
                sid_str = str(sid).strip()
                clean_sid = "".join(c for c in sid_str if c.isdigit())
                variants = [sid_str]
                if clean_sid and clean_sid != sid_str:
                    variants.append(clean_sid)
                if clean_sid.startswith("91"):
                    variants.append(clean_sid[2:])
                else:
                    variants.append(f"91{clean_sid}")
                for variant in variants:
                    info = sessions.get(variant)
                    if isinstance(info, dict) and info.get("status") == "CONNECTED":
                        return variant
    except Exception as exc:
        logger.warning("Could not reach WhatsApp gateway for session lookup: %s", exc)
    return None


def render_quotation_pdf(
    quote: CRMQuotation,
    template: dict | None = None,
    tenant: Tenant | None = None,
    customer: Customer | None = None,
) -> bytes:
    """Generate professional Quotation PDF bytes."""
    if FPDF is None:
        raise QuotationSendError("FPDF library is not installed on the server.")

    tpl = template or {}
    primary_rgb = _hex_to_rgb(tpl.get("primaryColor") or "#00a884")
    font_name = "Helvetica"

    # ── Template-driven rendering (mirrors the browser preview) ──────────
    # Honor the full template: section/column toggles (`fields`), editable
    # words (`texts`), bank details, payment QR, signature/stamp and logo —
    # so the server-side PDF matches the design the user actually picked,
    # instead of this file's old hard-coded layout.
    fields = tpl.get("fields") or {}

    def _on(key: str, default: bool = True) -> bool:
        return bool(fields.get(key, default))

    # Editable label words: template `texts` override < sensible default.
    _TEXTS_BASE = {
        "quotationTitle": "TAX QUOTATION / ESTIMATE",
        "copyTag": "ORIGINAL FOR RECIPIENT",
        "quoteNoLabel": "Quote No",
        "quoteDateLabel": "Quote Date",
        "partyTitle": "PREPARED FOR (CUSTOMER)",
        "addressLabel": "Address",
        "gstinLabel": "GSTIN",
        "phoneLabel": "Ph",
        "emailLabel": "Email",
        "colSno": "#",
        "colDescription": "Product / Item Description",
        "colHsn": "SKU / HSN",
        "colUom": "UOM",
        "colMrp": "MRP",
        "colQty": "Qty",
        "colRate": "Unit Price",
        "colDiscount": "Disc",
        "colTaxRate": "Tax %",
        "colAmount": "Amount",
        "subtotalLabel": "Subtotal (Base)",
        "taxableLabel": "Taxable Amount",
        "totalTaxLabel": "Total Tax",
        "grandTotalLabel": "Quotation Grand Total",
        "roundOffLabel": "Round Off",
        "amountInWordsLabel": "Amount in Words",
        "bankDetailsLabel": "Bank Details",
        "scanToPayLabel": "Scan to Pay",
        "upiLabel": "UPI",
        "termsLabel": "Terms & Conditions",
        "declarationLabel": "Declaration",
        "signatureTitle": "Authorised Signatory",
        "thankYouLabel": "Thank you for your valued business!",
    }
    user_texts = tpl.get("texts") or tpl.get("customTexts") or {}
    _texts = {**_TEXTS_BASE, **(user_texts if isinstance(user_texts, dict) else {})}

    def _T(key: str, fallback: str) -> str:
        val = _texts.get(key, fallback)
        return val if val and str(val).strip() else fallback

    # Bank / payment-QR / signature / logo — all template-driven.
    bank_details = _safe_text(tpl.get("bankDetails") or tpl.get("bank_details") or "", 400)
    upi_vpa = _safe_text(tpl.get("upiId") or tpl.get("upi_vpa") or "", 60)
    payee_name = _safe_text(tpl.get("payeeName") or tpl.get("upi_payee_name") or "", 60)
    custom_qr = tpl.get("customQrUrl") or ""
    signature_url = tpl.get("signatureUrl") or ""
    stamp_url = tpl.get("stampUrl") or ""
    signatory_label = _safe_text(tpl.get("signatoryLabel") or tpl.get("signatureTitle") or "", 60)
    logo_url = tpl.get("logoUrl") or tpl.get("logo_url") or ""

    # Resolve store / org branding
    tenant_settings = (tenant.settings if tenant and isinstance(tenant.settings, dict) else {})
    store_name = _safe_text(tpl.get("storeName") or tenant_settings.get("trade_name") or (tenant.name if tenant else "BusinessOS AI Global"), 80)
    store_address = _safe_text(tpl.get("storeAddress") or tenant_settings.get("address") or "", 160)
    store_phone = _safe_text(tpl.get("storePhone") or tenant_settings.get("phone") or "", 40)
    store_email = _safe_text(tpl.get("storeEmail") or tenant_settings.get("email") or "", 60)
    gstin = _safe_text(tpl.get("gstin") or tenant_settings.get("gstin") or tenant_settings.get("tax_id") or "", 30)

    # Resolve quote metadata from items dict
    items_data = quote.items if isinstance(quote.items, dict) else {}
    cust_name = _safe_text(items_data.get("customer_name") or (customer.name if customer else "Valued Client"), 80)
    cust_phone = _safe_text(items_data.get("customer_phone") or (customer.phone if customer else ""), 40)
    cust_email = _safe_text(items_data.get("customer_email") or (customer.email if customer else ""), 60)
    cust_address = _safe_text(items_data.get("customer_address") or (customer.address if customer else ""), 160)
    cust_gstin = _safe_text(items_data.get("customer_gstin") or (getattr(customer, "tax_id", None) if customer else ""), 30)

    quote_date = _safe_text(items_data.get("quote_date") or (quote.created_at.strftime("%Y-%m-%d") if quote.created_at else clock.now().strftime("%Y-%m-%d")), 20)
    valid_until = _safe_text(items_data.get("valid_until") or "30 Days from Issue", 30)
    payment_terms = _safe_text(items_data.get("payment_terms") or "Net 30 Days", 50)
    delivery_terms = _safe_text(items_data.get("delivery_terms") or "3-5 Business Days", 50)
    notes = _safe_text(items_data.get("notes") or "Prices valid for 30 days. Taxes extra as applicable.", 400)

    raw_items = items_data.get("items") or []
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        raw_items = [{
            "name": "Commercial Solutions & Services",
            "description": "Custom package as per quotation agreement",
            "quantity": 1,
            "unit_price": float(quote.subtotal or quote.total or 0),
            "discount_percent": 0,
            "tax_percent": 18,
            "line_total": float(quote.total or 0),
        }]

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    page_w = pdf.w
    pdf.add_page()

    # ── HEADER BAR ──────────────────────────────────────────────────────
    pdf.set_fill_color(*primary_rgb)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_name, "B", 13)
    quote_title = _safe_text(items_data.get("header_title") or tpl.get("headerTitle") or _T("quotationTitle", "TAX QUOTATION / ESTIMATE"), 40)
    pdf.cell(0, 18, quote_title, ln=1, align="R", fill=True)

    # Optional logo (template-driven, when the field is enabled).
    if logo_url and _on("showLogo", True):
        logo_path = _find_logo_path(logo_url)
        if logo_path:
            try:
                pdf.image(logo_path, 10, 12, w=22, h=22)
            except Exception:
                pass

    # ── STORE INFO BLOCK (hides lines when empty / toggled off) ─────────
    pdf.set_text_color(15, 23, 42)
    pdf.set_y(14 if (logo_url and _on("showLogo", True)) else 10)
    if _on("showStoreName", True):
        pdf.set_font(font_name, "B", 11)
        pdf.cell(0, 5, store_name, ln=1)
    pdf.set_font(font_name, "", 8)
    if store_address and _on("showStoreAddress", True):
        pdf.multi_cell(0, 4, store_address)
    contact_parts = []
    if store_phone and _on("showStoreContact", True):
        contact_parts.append(f"{_T('phoneLabel', 'Ph')}: {store_phone}")
    if store_email and _on("showStoreContact", True):
        contact_parts.append(f"{_T('emailLabel', 'Email')}: {store_email}")
    if gstin and _on("showTaxId", True):
        contact_parts.append(f"{_T('gstinLabel', 'GSTIN')}: {gstin}")
    if contact_parts:
        pdf.cell(0, 4, "  |  ".join(contact_parts), ln=1)
    pdf.ln(3)

    # ── METADATA & CUSTOMER GRID ─────────────────────────────────────────
    y_start = pdf.get_y()
    pdf.set_font(font_name, "B", 8)
    pdf.set_text_color(*primary_rgb)
    pdf.cell(95, 5, _T("partyTitle", "PREPARED FOR (CLIENT):"), ln=0)
    pdf.cell(95, 5, "QUOTATION DETAILS:", ln=1)
    pdf.set_text_color(30, 41, 59)

    client_lines = [
        cust_name,
        f"{_T('phoneLabel', 'Phone')}: +{cust_phone}" if cust_phone else "",
        f"{_T('emailLabel', 'Email')}: {cust_email}" if cust_email else "",
        f"{_T('gstinLabel', 'GSTIN')}: {cust_gstin}" if cust_gstin else "",
        cust_address,
    ]
    client_lines = [l for l in client_lines if l]

    pdf.set_xy(10, y_start + 5)
    pdf.set_font(font_name, "", 8)
    for line in client_lines:
        pdf.set_x(10)
        pdf.cell(95, 4, line, ln=1)

    quote_meta = [
        (f"{_T('quoteNoLabel', 'Quote No')}:", _safe_text(quote.quote_number, 30)),
        (f"{_T('quoteDateLabel', 'Quote Date')}:", quote_date),
        ("Valid Until:", valid_until),
        ("Payment Terms:", payment_terms),
        ("Status:", _safe_text(quote.status or "Draft", 20)),
    ]
    pdf.set_xy(105, y_start + 5)
    for label, val in quote_meta:
        pdf.set_font(font_name, "B", 8)
        pdf.cell(32, 4, label, ln=0)
        pdf.set_font(font_name, "", 8)
        pdf.cell(58, 4, val, ln=1)
        pdf.set_x(105)

    max_y = max(pdf.get_y(), y_start + 5 + 4 * len(client_lines)) + 4
    pdf.set_y(max_y)

    pdf.set_draw_color(*primary_rgb)
    pdf.line(10, pdf.get_y(), page_w - 10, pdf.get_y())
    pdf.ln(3)

    # ── LINE ITEMS TABLE (columns & headers driven by the template) ─────
    # Build the visible column set from the template's field toggles, so
    # unchecking a column in the designer removes it here too. Widths are
    # proportional; the widest is the description.
    usable_w = page_w - 20  # 10mm margins both sides

    def _item_extract(it: dict, key: str):
        if key == "description":
            return _safe_text(it.get("product_name") or it.get("name") or "Product Item", 60)
        if key == "desc_detail":
            return _safe_text(it.get("description") or "", 120)
        if key == "sku":
            return _safe_text(it.get("sku") or it.get("hsn_code") or "-", 15)
        if key == "qty":
            return f"{float(it.get('quantity') or it.get('qty') or 1):g}"
        if key == "unit":
            return _safe_text(it.get("uom") or it.get("unit") or "", 10)
        if key == "mrp":
            v = it.get("mrp")
            return _fmt_amount(v) if v not in (None, "") else ""
        if key == "rate":
            return _fmt_amount(it.get("unit_price") or it.get("price") or 0)
        if key == "discount":
            raw_disc = it.get("discount_percent") if it.get("discount_percent") is not None else (it.get("discount") if it.get("discount") is not None else (it.get("discount_rate") if it.get("discount_rate") is not None else 0.0))
            return f"{float(raw_disc):g}%" if float(raw_disc) > 0 else "-"
        if key == "tax":
            raw_tax = it.get("tax_percent") if it.get("tax_percent") is not None else (it.get("tax_rate") if it.get("tax_rate") is not None else (it.get("tax") if it.get("tax") is not None else 0.0))
            return f"{float(raw_tax):g}%"
        if key == "amount":
            qty = float(it.get("quantity") or it.get("qty") or 1)
            price = float(it.get("unit_price") or it.get("price") or 0)
            raw_tax = it.get("tax_percent") or it.get("tax_rate") or it.get("tax") or 0.0
            raw_disc = it.get("discount_percent") or it.get("discount") or it.get("discount_rate") or 0.0
            return _fmt_amount(float(it.get("line_total") or (qty * price * (1 - float(raw_disc) / 100) * (1 + float(raw_tax) / 100))))
        return ""

    # key -> (default header, width-weight, align, enabled-by-toggle)
    col_defs = [
        ("sno", _T("colSno", "#"), 5, "C", _on("showItemIndex", True)),
        ("description", _T("colDescription", "Product / Item Description"), 40, "L", _on("showItemName", True)),
        ("desc_detail", "", 0, "L", False),  # folded into description cell
        ("sku", _T("colHsn", "SKU / HSN"), 14, "C", _on("showSKU", True)),
        ("mrp", _T("colMrp", "MRP"), 14, "R", _on("showMRP", True)),
        ("unit", _T("colUom", "UOM"), 12, "C", _on("showSecondaryUnit", True)),
        ("qty", _T("colQty", "Qty"), 10, "C", _on("showItemQty", True)),
        ("rate", _T("colRate", "Unit Price"), 18, "R", _on("showItemRate", True)),
        ("discount", _T("colDiscount", "Disc %"), 12, "C", _on("showDiscountCol", True)),
        ("tax", _T("colTaxRate", "Tax %"), 14, "C", _on("showGstRateCol", True)),
        ("amount", _T("colAmount", "Amount (Rs.)"), 24, "R", _on("showItemAmount", True)),
    ]
    visible_cols = [(k, h, w, al) for (k, h, w, al, on) in col_defs if on and k != "desc_detail"]
    # If the user disabled everything, fall back to a minimal set so it still renders.
    if not visible_cols:
        visible_cols = [
            ("sno", _T("colSno", "#"), 5, "C"),
            ("description", _T("colDescription", "Product / Item Description"), 45, "L"),
            ("qty", _T("colQty", "Qty"), 10, "C"),
            ("rate", _T("colRate", "Unit Price"), 20, "R"),
            ("amount", _T("colAmount", "Amount (Rs.)"), 25, "R"),
        ]
    total_weight = sum(w for (_, _, w, _) in visible_cols)
    # Show the item's secondary description line when the description-toggle is on
    # AND that column is visible; it renders folded under the product name.
    show_desc_detail = _on("showItemDescription", True) and any(k == "description" for (k, _, _, _) in visible_cols)

    pdf.set_font(font_name, "B", 7.5)
    pdf.set_fill_color(*primary_rgb)
    pdf.set_text_color(255, 255, 255)
    for (k, h, w, al) in visible_cols:
        cw = usable_w * (w / total_weight)
        pdf.cell(cw, 6, h, border=1, fill=True, align=al)
    pdf.ln()

    pdf.set_text_color(15, 23, 42)
    for idx, it in enumerate(raw_items, start=1):
        row_h = 9 if show_desc_detail else 6
        y_curr = pdf.get_y()
        if y_curr + row_h > 270:
            pdf.add_page()
            y_curr = pdf.get_y()

        pdf.set_font(font_name, "", 7)
        x_row = 10
        for (k, h, w, al) in visible_cols:
            cw = usable_w * (w / total_weight)
            if k == "description":
                p_name = _item_extract(it, "description")
                detail = _item_extract(it, "desc_detail")
                if detail:
                    pdf.set_xy(x_row, y_curr)
                    pdf.set_font(font_name, "B", 7)
                    pdf.cell(cw, 4.5, p_name, border="LTR", align="L")
                    pdf.set_xy(x_row, y_curr + 4.5)
                    pdf.set_font(font_name, "I", 6.5)
                    pdf.set_text_color(100, 116, 139)
                    pdf.cell(cw, 4.5, detail[:50], border="LBR", align="L")
                    pdf.set_text_color(15, 23, 42)
                else:
                    pdf.set_xy(x_row, y_curr)
                    pdf.set_font(font_name, "B", 7)
                    pdf.cell(cw, row_h, p_name, border=1, align="L")
            elif k == "sno":
                pdf.set_xy(x_row, y_curr)
                pdf.set_font(font_name, "", 7)
                pdf.cell(cw, row_h, str(idx), border=1, align="C")
            elif k == "amount":
                pdf.set_xy(x_row, y_curr)
                pdf.set_font(font_name, "B", 7)
                pdf.cell(cw, row_h, _item_extract(it, "amount"), border=1, align="R")
            else:
                pdf.set_xy(x_row, y_curr)
                pdf.set_font(font_name, "", 7)
                pdf.cell(cw, row_h, _item_extract(it, k), border=1, align=al)
            x_row += cw
        pdf.set_y(y_curr + row_h)

    pdf.ln(3)

    # ── TOTALS & TERMS ──────────────────────────────────────────────────
    totals_x = page_w - 10 - 75
    terms_w = totals_x - 15

    # ── BANK DETAILS (template-driven; only shown when enabled & present) ──
    show_bank = _on("showBankDetails", True) and bool(bank_details or upi_vpa)
    if show_bank:
        pdf.set_y(min(pdf.get_y(), 210))
        pdf.set_font(font_name, "B", 8)
        pdf.set_text_color(*primary_rgb)
        pdf.cell(0, 4, _T("bankDetailsLabel", "Bank Details"), ln=1)
        pdf.set_font(font_name, "", 7)
        pdf.set_text_color(30, 41, 59)
        pdf.multi_cell(0, 3.5, bank_details)
        if upi_vpa:
            pdf.cell(0, 3.5, f"{_T('upiLabel', 'UPI')}: {upi_vpa}", ln=1)
        pdf.ln(2)

    y_before_totals = pdf.get_y()

    # Left column: terms / declaration (gated by toggles, editable labels).
    pdf.set_font(font_name, "B", 7.5)
    if _on("showTerms", True) and (notes or delivery_terms):
        pdf.set_text_color(15, 23, 42)
        pdf.cell(terms_w, 4, _T("termsLabel", "Terms & Conditions:") + ":", ln=1)
        pdf.set_font(font_name, "", 7)
        pdf.multi_cell(terms_w, 3.5, notes)
        if delivery_terms:
            pdf.multi_cell(terms_w, 3.5, f"Delivery Terms: {delivery_terms}")
    y_after_terms = pdf.get_y()

    # Right column: totals (editable labels).
    pdf.set_xy(totals_x, y_before_totals)
    pdf.set_font(font_name, "", 8)
    pdf.cell(40, 5, _T("subtotalLabel", "Subtotal (Base):") + ":", border=0, align="L")
    pdf.cell(35, 5, f"Rs. {_fmt_amount(quote.subtotal)}", border=0, align="R")
    pdf.ln()

    pdf.set_x(totals_x)
    pdf.cell(40, 5, _T("totalTaxLabel", "Estimated GST Tax:") + ":", border=0, align="L")
    pdf.cell(35, 5, f"+Rs. {_fmt_amount(quote.tax)}", border=0, align="R")
    pdf.ln()

    pdf.set_draw_color(*primary_rgb)
    pdf.line(totals_x, pdf.get_y(), totals_x + 75, pdf.get_y())
    pdf.ln(1)

    pdf.set_x(totals_x)
    pdf.set_font(font_name, "B", 9)
    pdf.set_text_color(*primary_rgb)
    pdf.cell(40, 6, _T("grandTotalLabel", "Quotation Grand Total:") + ":", border=0, align="L")
    pdf.cell(35, 6, f"Rs. {_fmt_amount(quote.total)}", border=0, align="R")
    pdf.ln()
    pdf.set_text_color(15, 23, 42)

    pdf.set_y(max(y_after_terms, pdf.get_y()) + 6)

    # ── PAYMENT QR (template-driven; honors showQR + UPI VPA) ──────────
    show_qr = _on("showQR", True) and bool(upi_vpa or custom_qr)
    if show_qr:
        qr_content = custom_qr or (upi_vpa and _upi_pay_url(upi_vpa, payee_name, float(quote.total or 0))) or ""
        qr_img = _generate_qr_code_file(qr_content, f"qpdf_{str(quote.id)[:8]}") if qr_content else None
        qr_x = 10
        if qr_img:
            pdf.image(qr_img, qr_x, pdf.get_y(), w=30, h=30)
            qr_note_x = qr_x + 33
            qr_note_y = pdf.get_y()
            pdf.set_xy(qr_note_x, qr_note_y + 2)
            pdf.set_font(font_name, "B", 7.5)
            pdf.set_text_color(*primary_rgb)
            pdf.cell(0, 4, _T("scanToPayLabel", "Scan to Pay"), ln=1)
            pdf.set_font(font_name, "", 7)
            pdf.set_text_color(30, 41, 59)
            if upi_vpa:
                pdf.cell(0, 4, f"{_T('upiLabel', 'UPI')}: {upi_vpa}", ln=1)
            pdf.cell(0, 4, f"Rs. {_fmt_amount(quote.total)}", ln=1)
            pdf.set_y(qr_note_y + 18)
        else:
            pdf.cell(0, 4, f"UPI: {upi_vpa}", ln=1)
        pdf.ln(6)

    # ── SIGNATURE (template-driven: uploaded sig/stamp image + labels) ─
    sig_x = page_w - 10 - 65
    sig_y = pdf.get_y()
    if _on("showSignature", True):
        img_y = sig_y
        if signature_url:
            sig_path = _find_logo_path(signature_url)
            if sig_path:
                try:
                    pdf.image(sig_path, sig_x, img_y, w=40, h=18)
                    img_y += 20
                except Exception:
                    pass
        pdf.set_xy(10, sig_y)
        pdf.set_font(font_name, "", 7)
        pdf.cell(70, 4, "Customer Acceptance Signature: __________________", ln=0)
        pdf.set_xy(sig_x, img_y)
        pdf.line(sig_x, img_y + 12, sig_x + 65, img_y + 12)
        pdf.set_xy(sig_x, img_y + 13)
        pdf.set_font(font_name, "B", 7.5)
        pdf.cell(65, 4, signatory_label or f"For {store_name}", align="C")
        if stamp_url:
            stamp_path = _find_logo_path(stamp_url)
            if stamp_path:
                try:
                    pdf.image(stamp_path, sig_x + 40, img_y - 2, w=22, h=22, align="C")
                except Exception:
                    pass

    # ── THANK-YOU / FOOTER (template-driven) ───────────────────────────
    if _on("showThankYou", True):
        ty = _safe_text(tpl.get("thankYouNote") or tpl.get("footerText") or "", 120)
        if ty:
            pdf.set_font(font_name, "I", 7)
            pdf.set_text_color(80, 90, 110)
            pdf.cell(0, 4, ty, ln=1)
    pdf.set_y(-12)
    pdf.set_font(font_name, "I", 6.5)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 4, _safe_text(f"Official Electronic Quotation - Ref #{quote.quote_number} - Generated on {clock.now().strftime('%Y-%m-%d %H:%M')}"), align="C")

    raw = pdf.output(dest="S")
    if isinstance(raw, str):
        return raw.encode("latin-1", errors="replace")
    return bytes(raw)


def render_quotation_pdf_b64(quote: CRMQuotation, template: dict | None = None, tenant: Tenant | None = None, customer: Customer | None = None) -> str:
    """Generate quotation PDF as base64 string."""
    pdf_bytes = render_quotation_pdf(quote, template=template, tenant=tenant, customer=customer)
    return base64.b64encode(pdf_bytes).decode("ascii")


def save_quotation_pdf(quote: CRMQuotation, template: dict | None = None, tenant: Tenant | None = None, customer: Customer | None = None) -> Path:
    """Save quotation PDF to disk and return path."""
    pdf_bytes = render_quotation_pdf(quote, template=template, tenant=tenant, customer=customer)
    safe_number = "".join(c if c.isalnum() or c in "-_" else "_" for c in (quote.quote_number or str(quote.id)))
    file_path = QUOTATION_PDF_DIR / f"Quotation_{safe_number}.pdf"
    file_path.write_bytes(pdf_bytes)
    return file_path


async def get_or_create_quotation_pdf(
    quote: CRMQuotation,
    db: AsyncSession,
    force_regenerate: bool = False,
) -> tuple[bytes, Path]:
    """Retrieve the exact saved Quotation PDF from disk or render and persist it once.
    
    Guarantees that the exact PDF generated upon quote creation is reused across
    Email attachments, WhatsApp media delivery, and PDF downloads without divergent regeneration.
    """
    safe_number = "".join(c if c.isalnum() or c in "-_" else "_" for c in (quote.quote_number or str(quote.id)))
    file_path = QUOTATION_PDF_DIR / f"Quotation_{safe_number}.pdf"
    meta_path = file_path.with_name(f"Quotation_{safe_number}.pdf.meta")

    tenant = await db.get(Tenant, quote.tenant_id)
    # Pick the template by document category (quotation / proforma / estimate),
    # so a category-specific template choice is honored instead of always the
    # master invoice template. The CRMQuotation model has no doc_type column, so
    # derive it from the quote number prefix.
    items = quote.items if isinstance(quote.items, dict) else {}
    raw_cat = str(
        items.get("doc_type") or items.get("docType") or items.get("document_type") or ""
    ).lower().strip()
    num_prefix = str(quote.quote_number or "").upper()
    if raw_cat in ("proforma", "proforma_invoice", "pi"):
        cat = "proforma"
    elif raw_cat in ("estimate", "estimate_non_gst", "est"):
        cat = "estimate"
    elif num_prefix.startswith("PI-") or raw_cat.startswith("proforma"):
        cat = "proforma"
    elif num_prefix.startswith("EST-") or raw_cat.startswith("est"):
        cat = "estimate"
    else:
        cat = "quotation"
    template = await get_active_invoice_template(db, quote.tenant_id, category=cat)

    # A cached PDF is only valid while the active template for this category is
    # the one it was rendered from. Tag the file with a marker; when the marker
    # no longer matches the current template, re-render instead of serving a
    # stale layout ("the second time it looks different" bug).
    template_marker = str(
        template.get("id")
        or template.get("themeName")
        or template.get("updatedAt")
        or json.dumps(template, sort_keys=True, default=str)
    )

    if file_path.exists() and not force_regenerate:
        try:
            cached_marker = meta_path.read_text() if meta_path.exists() else ""
            if cached_marker == template_marker:
                pdf_bytes = file_path.read_bytes()
                if len(pdf_bytes) > 100:
                    return pdf_bytes, file_path
        except Exception as e:
            logger.warning("Failed to read cached quotation PDF from %s: %s", file_path, e)

    cust = await db.get(Customer, quote.customer_id) if quote.customer_id else None
    pdf_bytes = render_quotation_pdf(quote, template=template, tenant=tenant, customer=cust)
    try:
        file_path.write_bytes(pdf_bytes)
        meta_path.write_text(template_marker)
    except Exception as e:
        logger.warning("Could not persist quotation PDF to disk: %s", e)

    return pdf_bytes, file_path


async def send_quotation_whatsapp(
    db: AsyncSession,
    quote: CRMQuotation,
    recipient_phone: str | None = None,
) -> dict:
    """Dispatch the exact saved Quotation PDF directly to the customer's WhatsApp."""
    from src.services.whatsapp_invoice_sender import check_whatsapp_dispatch_allowed
    allowed, disallow_reason = await check_whatsapp_dispatch_allowed(
        db, quote.tenant_id, getattr(quote, "company_id", None), trigger="auto_send_quotations"
    )
    if not allowed:
        raise QuotationSendError(disallow_reason)

    items_data = quote.items if isinstance(quote.items, dict) else {}
    phone = (recipient_phone or items_data.get("customer_phone") or "").strip()

    cust = None
    if quote.customer_id:
        cust = await db.get(Customer, quote.customer_id)
        if not phone and cust and cust.phone:
            phone = cust.phone.strip()

    if not phone:
        raise QuotationSendError("Customer has no phone number attached for WhatsApp dispatch.")

    clean_phone = "".join(c for c in phone if c.isdigit())
    if len(clean_phone) == 10 and not clean_phone.startswith("91"):
        clean_phone = f"91{clean_phone}"

    allowed_sessions = []
    comp_id = getattr(quote, "company_id", None)
    if comp_id:
        comp = await db.get(Company, comp_id)
        if comp and comp.whatsapp_settings:
            allowed_sessions = list(comp.whatsapp_settings.get("whatsapp_web_sessions") or [])
    if not allowed_sessions:
        first_comp_id = await db.scalar(
            select(Company.id).where(Company.tenant_id == quote.tenant_id).order_by(Company.created_at.asc()).limit(1)
        )
        if not comp_id or comp_id == first_comp_id:
            tenant = await db.get(Tenant, quote.tenant_id)
            allowed_sessions = list((tenant.settings or {}).get("whatsapp_web_sessions") or []) if tenant else []

    session_id = await _get_gateway_session_id(allowed_sessions)
    if not session_id:
        raise QuotationSendError("No active WhatsApp session connected for this organization workspace. Please connect WhatsApp from CRM -> WhatsApp Automation.")

    # Reuse the exact saved PDF from disk
    pdf_bytes, file_path = await get_or_create_quotation_pdf(quote, db, force_regenerate=False)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
    cust_name = items_data.get("customer_name") or (cust.name if cust else "Valued Client")

    payload = {
        "mimeType": "application/pdf",
        "data": pdf_b64,
        "fileName": file_path.name,
        "caption": (
            f"Dear {cust_name},\n\n"
            f"Thank you for your interest! Please find attached your official Quotation *#{quote.quote_number}* "
            f"for amount *Rs. {quote.total:,.2f}*.\n\n"
            f"Please reply with *APPROVE* or contact us to confirm your order."
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=120.0, write=120.0, pool=10.0)) as http:
            resp = await http.post(
                f"{GATEWAY_URL}/sessions/{session_id}/chats/{clean_phone}/send-media",
                json=payload,
            )
            resp.raise_for_status()
            gateway_res = resp.json()
            message_id = gateway_res.get("message_id")
    except Exception as exc:
        logger.warning("WhatsApp quotation gateway dispatch failed: %s", exc)
        raise QuotationSendError(f"WhatsApp gateway error: {exc}") from exc

    try:
        await add_system_notification(
            db=db,
            tenant_id=quote.tenant_id,
            title=f"Quotation {quote.quote_number} sent via WhatsApp",
            body=f"Quotation #{quote.quote_number} (Rs. {quote.total:,.2f}) was sent to {cust_name} on WhatsApp.",
            category="crm",
        )
    except Exception as e:
        logger.warning("Notification creation failed: %s", e)

    try:
        lead_res = await db.execute(
            select(Lead).where(Lead.tenant_id == quote.tenant_id, Lead.phone == phone)
        )
        lead = lead_res.scalars().first()
        if lead:
            activity = LeadActivity(
                tenant_id=quote.tenant_id,
                lead_id=lead.id,
                activity_type="whatsapp_sent",
                summary=f"Quotation {quote.quote_number} PDF sent via WhatsApp",
                occurred_at=clock.utcnow(),
            )
            db.add(activity)
            lead.last_contact_at = clock.utcnow()
            lead.status = "Contacted"
    except Exception as e:
        logger.warning("Lead activity creation failed: %s", e)

    return {
        "success": True,
        "message_id": message_id,
        "session_id": session_id,
        "phone": clean_phone,
    }


async def send_quotation_email(
    db: AsyncSession,
    quote: CRMQuotation,
    recipient_email: str | None = None,
) -> dict:
    """Dispatch the exact saved Quotation PDF as an attachment to customer's email using configured SMTP."""
    items_data = quote.items if isinstance(quote.items, dict) else {}
    email = (recipient_email or items_data.get("customer_email") or "").strip()

    cust = None
    if quote.customer_id:
        cust = await db.get(Customer, quote.customer_id)
        if not email and cust and cust.email:
            email = cust.email.strip()

    if not email:
        raise QuotationSendError("Customer has no email address attached for SMTP dispatch.")

    tenant = await db.get(Tenant, quote.tenant_id)
    org_name = (tenant.name if tenant else "BusinessOS AI Global")
    cust_name = items_data.get("customer_name") or (cust.name if cust else "Valued Client")

    # Load the exact saved PDF from disk
    pdf_bytes, file_path = await get_or_create_quotation_pdf(quote, db, force_regenerate=False)
    filename = file_path.name

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        .header {{ border-bottom: 2px solid #00a884; padding-bottom: 16px; margin-bottom: 20px; }}
        .badge {{ display: inline-block; background: #e6fffa; color: #00a884; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; }}
        .total-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }}
        .footer {{ text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="badge">Official Commercial Quotation</span>
          <h2 style="margin: 8px 0 0 0; color: #0f172a;">{org_name}</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Quotation Ref: <strong>#{quote.quote_number}</strong></p>
        </div>
        <p>Dear <strong>{cust_name}</strong>,</p>
        <p>Thank you for giving us the opportunity to submit our proposal. Please find attached your detailed commercial price quotation.</p>
        
        <div class="total-box">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="color: #64748b;">Quotation Number:</td>
              <td style="text-align: right; font-weight: 700;">#{quote.quote_number}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Subtotal (Base):</td>
              <td style="text-align: right;">Rs. {_fmt_amount(quote.subtotal)}</td>
            </tr>
            <tr>
              <td style="color: #64748b;">Applicable Tax:</td>
              <td style="text-align: right;">+Rs. {_fmt_amount(quote.tax)}</td>
            </tr>
            <tr style="border-top: 1px solid #cbd5e1;">
              <td style="font-weight: 800; padding-top: 8px; color: #0f172a;">Total Quotation Value:</td>
              <td style="font-weight: 900; padding-top: 8px; text-align: right; color: #00a884; font-size: 16px;">Rs. {_fmt_amount(quote.total)}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #475569;">
          The complete PDF quotation is attached to this email for your records and purchase order processing.
        </p>
        <p style="font-size: 13px; color: #475569;">
          Please feel free to reply directly to this email or reach out to us if you have any questions or would like to approve this estimate.
        </p>

        <p style="margin-top: 24px; font-size: 13px; font-weight: 600;">
          Best regards,<br>
          <span style="color: #00a884;">{org_name} Sales Team</span>
        </p>

        <div class="footer">
          <p>Generated automatically via {org_name} BusinessOS AI ERP.</p>
        </div>
      </div>
    </body>
    </html>
    """

    subject = f"Commercial Quotation #{quote.quote_number} from {org_name}"
    text_body = (
        f"Dear {cust_name},\n\n"
        f"Please find attached your official price quotation #{quote.quote_number} for Rs. {quote.total:,.2f}.\n\n"
        f"Best regards,\n{org_name}"
    )

    success = await send_email(
        subject=subject,
        recipients=email,
        html=html_body,
        text=text_body,
        company_id=quote.company_id,
        tenant_id=quote.tenant_id,
        attachment_bytes=pdf_bytes,
        attachment_filename=filename,
        db=db,
    )

    if not success:
        raise QuotationSendError("SMTP server dispatch failed. Please verify SMTP settings in Settings -> Email/Communication.")

    try:
        await add_system_notification(
            db=db,
            tenant_id=quote.tenant_id,
            title=f"Quotation {quote.quote_number} emailed to customer",
            body=f"Quotation #{quote.quote_number} PDF was emailed to {email}.",
            category="crm",
        )
    except Exception as e:
        logger.warning("Notification creation failed: %s", e)

    return {
        "success": True,
        "email": email,
        "filename": filename,
    }


async def dispatch_quotation(
    db: AsyncSession,
    quote: CRMQuotation,
    send_email_flag: bool = True,
    send_whatsapp_flag: bool = True,
    recipient_email: str | None = None,
    recipient_phone: str | None = None,
) -> dict:
    """Dispatches quotation to WhatsApp and/or Email automatically based on available contact details.

    - If customer has an email -> sends email with PDF attachment via SMTP.
    - If customer has a phone -> sends WhatsApp with PDF via tenant WhatsApp session.
    - If customer has both -> sends both seamlessly.
    - If neither is available or configured, reports friendly status without breaking quote save.
    """
    results: dict[str, Any] = {
        "whatsapp": None,
        "email": None,
        "dispatched_channels": [],
        "skipped_channels": [],
        "errors": [],
    }

    items_data = quote.items if isinstance(quote.items, dict) else {}
    target_phone = (recipient_phone or items_data.get("customer_phone") or "").strip()
    target_email = (recipient_email or items_data.get("customer_email") or "").strip()

    # Fallback from customer record if needed
    if (not target_phone or not target_email) and quote.customer_id:
        cust = await db.get(Customer, quote.customer_id)
        if cust:
            if not target_phone and cust.phone:
                target_phone = cust.phone.strip()
            if not target_email and cust.email:
                target_email = cust.email.strip()

    # 1. WhatsApp Dispatch (if requested and phone available)
    if send_whatsapp_flag:
        if target_phone:
            try:
                res = await send_quotation_whatsapp(
                    db=db,
                    quote=quote,
                    recipient_phone=target_phone,
                )
                results["whatsapp"] = res
                results["dispatched_channels"].append(f"WhatsApp (+{res.get('phone', target_phone)})")
            except Exception as exc:
                logger.warning("Quotation WhatsApp dispatch error: %s", exc)
                results["errors"].append(f"WhatsApp: {str(exc)}")
        else:
            results["skipped_channels"].append("WhatsApp (No phone number provided)")

    # 2. Email Dispatch (if requested and email available)
    if send_email_flag:
        if target_email:
            try:
                res = await send_quotation_email(
                    db=db,
                    quote=quote,
                    recipient_email=target_email,
                )
                results["email"] = res
                results["dispatched_channels"].append(f"Email ({target_email})")
            except Exception as exc:
                logger.warning("Quotation Email dispatch error: %s", exc)
                results["errors"].append(f"Email: {str(exc)}")
        else:
            results["skipped_channels"].append("Email (No email address provided)")

    return results
