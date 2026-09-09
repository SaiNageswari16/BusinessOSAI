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

from src.models import Tenant, Customer, Lead, LeadActivity, CRMQuotation
from src.services.invoice_pdf import get_active_invoice_template
from src.utils.email import send_email
from src.utils.notifications import add_system_notification

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


def _get_gateway_session_id() -> str | None:
    """Return the session id / phone of the first CONNECTED WhatsApp session."""
    try:
        with httpx.Client(timeout=8.0) as http:
            resp = http.get(f"{GATEWAY_URL}/sessions")
            if resp.status_code != 200:
                return None
            sessions = resp.json()
            for sid, info in sessions.items():
                if isinstance(info, dict) and info.get("status") == "CONNECTED":
                    return sid
            # If any session exists
            if sessions:
                return next(iter(sessions.keys()))
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

    # Resolve store / org branding
    tenant_settings = (tenant.settings if tenant and isinstance(tenant.settings, dict) else {})
    store_name = _safe_text(tpl.get("storeName") or tenant_settings.get("trade_name") or (tenant.name if tenant else "BusinessOS AI Global"), 80)
    store_address = _safe_text(tpl.get("storeAddress") or tenant_settings.get("address") or "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh - 516360", 160)
    store_phone = _safe_text(tpl.get("storePhone") or tenant_settings.get("phone") or "+91 98493 44919", 40)
    store_email = _safe_text(tenant_settings.get("email") or "sales@businessos.ai", 60)
    gstin = _safe_text(tpl.get("gstin") or tenant_settings.get("gstin") or tenant_settings.get("tax_id") or "37AABCCH694G1Z4", 30)

    # Resolve quote metadata from items dict
    items_data = quote.items if isinstance(quote.items, dict) else {}
    cust_name = _safe_text(items_data.get("customer_name") or (customer.name if customer else "Valued Client"), 80)
    cust_phone = _safe_text(items_data.get("customer_phone") or (customer.phone if customer else ""), 40)
    cust_email = _safe_text(items_data.get("customer_email") or (customer.email if customer else ""), 60)
    cust_address = _safe_text(items_data.get("customer_address") or (customer.address if customer else ""), 160)
    cust_gstin = _safe_text(items_data.get("customer_gstin") or (getattr(customer, "tax_id", None) if customer else ""), 30)

    quote_date = _safe_text(items_data.get("quote_date") or (quote.created_at.strftime("%Y-%m-%d") if quote.created_at else datetime.now().strftime("%Y-%m-%d")), 20)
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
    pdf.cell(0, 18, "COMMERCIAL SALES QUOTATION", ln=1, align="R", fill=True)

    # ── STORE INFO BLOCK ────────────────────────────────────────────────
    pdf.set_text_color(15, 23, 42)
    pdf.set_font(font_name, "B", 11)
    pdf.cell(0, 5, store_name, ln=1)
    pdf.set_font(font_name, "", 8)
    if store_address:
        pdf.multi_cell(0, 4, store_address)
    contact_str = " | ".join([p for p in [f"Ph: {store_phone}" if store_phone else "", f"Email: {store_email}" if store_email else "", f"GSTIN: {gstin}" if gstin else ""] if p])
    if contact_str:
        pdf.cell(0, 4, contact_str, ln=1)
    pdf.ln(3)

    # ── METADATA & CUSTOMER GRID ─────────────────────────────────────────
    y_start = pdf.get_y()
    pdf.set_font(font_name, "B", 8)
    pdf.set_text_color(*primary_rgb)
    pdf.cell(95, 5, "PREPARED FOR (CLIENT):", ln=0)
    pdf.cell(95, 5, "QUOTATION DETAILS:", ln=1)
    pdf.set_text_color(30, 41, 59)

    client_lines = [
        cust_name,
        f"Phone: +{cust_phone}" if cust_phone else "",
        f"Email: {cust_email}" if cust_email else "",
        f"GSTIN: {cust_gstin}" if cust_gstin else "",
        cust_address,
    ]
    client_lines = [l for l in client_lines if l]

    pdf.set_xy(10, y_start + 5)
    pdf.set_font(font_name, "", 8)
    for line in client_lines:
        pdf.set_x(10)
        pdf.cell(95, 4, line, ln=1)

    quote_meta = [
        ("Quote Number:", _safe_text(quote.quote_number, 30)),
        ("Date of Issue:", quote_date),
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

    # ── LINE ITEMS TABLE ────────────────────────────────────────────────
    pdf.set_font(font_name, "B", 7.5)
    pdf.set_fill_color(*primary_rgb)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(8, 6, "#", border=1, fill=True, align="C")
    pdf.cell(70, 6, "Product / Item Description", border=1, fill=True, align="L")
    pdf.cell(18, 6, "SKU / HSN", border=1, fill=True, align="C")
    pdf.cell(12, 6, "Qty", border=1, fill=True, align="C")
    pdf.cell(22, 6, "Unit Price", border=1, fill=True, align="R")
    pdf.cell(14, 6, "Disc %", border=1, fill=True, align="C")
    pdf.cell(16, 6, "Tax %", border=1, fill=True, align="C")
    pdf.cell(30, 6, "Amount (Rs.)", border=1, fill=True, align="R")
    pdf.ln()

    pdf.set_text_color(15, 23, 42)
    for idx, it in enumerate(raw_items, start=1):
        p_name = _safe_text(it.get("product_name") or it.get("name") or "Product Item", 60)
        desc = _safe_text(it.get("description") or "", 120)
        sku = _safe_text(it.get("sku") or it.get("hsn_code") or "-", 15)
        qty = float(it.get("quantity") or it.get("qty") or 1)
        price = float(it.get("unit_price") or it.get("price") or 0)
        disc = float(it.get("discount_percent") or 0)
        tax = float(it.get("tax_percent") or 18)
        ltotal = float(it.get("line_total") or (qty * price * (1 - disc / 100) * (1 + tax / 100)))

        row_h = 9 if desc else 6
        y_curr = pdf.get_y()

        if y_curr + row_h > 270:
            pdf.add_page()
            y_curr = pdf.get_y()

        pdf.set_font(font_name, "", 7)
        pdf.cell(8, row_h, str(idx), border=1, align="C")

        if desc:
            x_after_num = pdf.get_x()
            pdf.set_xy(x_after_num, y_curr)
            pdf.set_font(font_name, "B", 7)
            pdf.cell(70, 4.5, p_name, border="LTR", align="L")
            pdf.set_xy(x_after_num, y_curr + 4.5)
            pdf.set_font(font_name, "I", 6.5)
            pdf.set_text_color(100, 116, 139)
            pdf.cell(70, 4.5, desc[:50], border="LBR", align="L")
            pdf.set_text_color(15, 23, 42)
            pdf.set_xy(x_after_num + 70, y_curr)
        else:
            pdf.set_font(font_name, "B", 7)
            pdf.cell(70, row_h, p_name, border=1, align="L")

        pdf.set_font(font_name, "", 7)
        pdf.cell(18, row_h, sku, border=1, align="C")
        pdf.cell(12, row_h, f"{qty:g}", border=1, align="C")
        pdf.cell(22, row_h, _fmt_amount(price), border=1, align="R")
        pdf.cell(14, row_h, f"{disc:g}%" if disc > 0 else "-", border=1, align="C")
        pdf.cell(16, row_h, f"{tax:g}%", border=1, align="C")
        pdf.set_font(font_name, "B", 7)
        pdf.cell(30, row_h, _fmt_amount(ltotal), border=1, align="R")
        pdf.ln(row_h)

    pdf.ln(3)

    # ── TOTALS & TERMS ──────────────────────────────────────────────────
    totals_x = page_w - 10 - 75
    terms_w = totals_x - 15

    y_before_totals = pdf.get_y()
    pdf.set_font(font_name, "B", 7.5)
    pdf.cell(terms_w, 4, "Terms & Conditions:", ln=1)
    pdf.set_font(font_name, "", 7)
    pdf.multi_cell(terms_w, 3.5, notes)
    if delivery_terms:
        pdf.multi_cell(terms_w, 3.5, f"Delivery Terms: {delivery_terms}")
    y_after_terms = pdf.get_y()

    pdf.set_xy(totals_x, y_before_totals)
    pdf.set_font(font_name, "", 8)
    pdf.cell(40, 5, "Subtotal (Base):", border=0, align="L")
    pdf.cell(35, 5, f"Rs. {_fmt_amount(quote.subtotal)}", border=0, align="R")
    pdf.ln()

    pdf.set_x(totals_x)
    pdf.cell(40, 5, "Estimated GST Tax:", border=0, align="L")
    pdf.cell(35, 5, f"+Rs. {_fmt_amount(quote.tax)}", border=0, align="R")
    pdf.ln()

    pdf.set_draw_color(*primary_rgb)
    pdf.line(totals_x, pdf.get_y(), totals_x + 75, pdf.get_y())
    pdf.ln(1)

    pdf.set_x(totals_x)
    pdf.set_font(font_name, "B", 9)
    pdf.set_text_color(*primary_rgb)
    pdf.cell(40, 6, "Quotation Grand Total:", border=0, align="L")
    pdf.cell(35, 6, f"Rs. {_fmt_amount(quote.total)}", border=0, align="R")
    pdf.ln()
    pdf.set_text_color(15, 23, 42)

    pdf.set_y(max(y_after_terms, pdf.get_y()) + 6)

    # ── SIGNATURE ──────────────────────────────────────────────────────
    sig_x = page_w - 10 - 65
    sig_y = pdf.get_y()
    pdf.set_xy(10, sig_y)
    pdf.set_font(font_name, "", 7)
    pdf.cell(70, 4, "Customer Acceptance Signature: __________________", ln=0)
    pdf.set_xy(sig_x, sig_y)
    pdf.line(sig_x, sig_y + 12, sig_x + 65, sig_y + 12)
    pdf.set_xy(sig_x, sig_y + 13)
    pdf.set_font(font_name, "B", 7.5)
    pdf.cell(65, 4, f"For {store_name}", align="C")

    # ── FOOTER ─────────────────────────────────────────────────────────
    pdf.set_y(-12)
    pdf.set_font(font_name, "I", 6.5)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 4, _safe_text(f"Official Electronic Quotation - Ref #{quote.quote_number} - Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}"), align="C")

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

    if file_path.exists() and not force_regenerate:
        try:
            pdf_bytes = file_path.read_bytes()
            if len(pdf_bytes) > 100:
                return pdf_bytes, file_path
        except Exception as e:
            logger.warning("Failed to read saved PDF from %s: %s", file_path, e)

    tenant = await db.get(Tenant, quote.tenant_id)
    template = await get_active_invoice_template(db, quote.tenant_id)
    cust = await db.get(Customer, quote.customer_id) if quote.customer_id else None

    pdf_bytes = render_quotation_pdf(quote, template=template, tenant=tenant, customer=cust)
    try:
        file_path.write_bytes(pdf_bytes)
    except Exception as e:
        logger.warning("Could not persist quotation PDF to disk: %s", e)

    return pdf_bytes, file_path


async def send_quotation_whatsapp(
    db: AsyncSession,
    quote: CRMQuotation,
    recipient_phone: str | None = None,
) -> dict:
    """Dispatch the exact saved Quotation PDF directly to the customer's WhatsApp."""
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

    session_id = _get_gateway_session_id()
    if not session_id:
        raise QuotationSendError("No active WhatsApp session connected. Please connect WhatsApp from CRM -> WhatsApp Automation.")

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
        with httpx.Client(timeout=30.0) as http:
            resp = http.post(
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
                occurred_at=datetime.utcnow(),
            )
            db.add(activity)
            lead.last_contact_at = datetime.utcnow()
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
