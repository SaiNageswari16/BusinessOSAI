"""Invoice PDF Generator — template-aware rendering.

Uses the tenant's active print template from ``Tenant.settings["print_templates"]``
so the PDF matches the organization's configured style (colors, fonts, fields,
store info, etc.).

A default template is seeded on first use if the tenant has no template
configured yet.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import date
from pathlib import Path
from typing import Any

try:
    from fpdf import FPDF
except ImportError:
    try:
        from fpdf2 import FPDF
    except ImportError:
        FPDF = None
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Tenant
from src.models.erp import Invoice

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
INVOICE_PDF_DIR = _BACKEND_ROOT / "static" / "invoices"
INVOICE_PDF_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Font fallback map: CSS font family -> fpdf2 built-in font
# ---------------------------------------------------------------------------
_FONT_MAP: dict[str, str] = {
    "Inter": "Helvetica",
    "Outfit": "Helvetica",
    "Courier New": "Courier",
    "Times New Roman": "Times",
    "Arial": "Helvetica",
    "Arial Black": "Helvetica",
    "Georgia": "Times",
    "Verdana": "Helvetica",
    "monospace": "Courier",
    "sans-serif": "Helvetica",
    "serif": "Times",
}

# ---------------------------------------------------------------------------
# Default invoice template (seeded on first use)
# Mirrors the frontend's "Stylish Theme" (isDefault: true for invoices)
# ---------------------------------------------------------------------------
_DEFAULT_INVOICE_TEMPLATE: dict[str, Any] = {
    "id": "tpl-inv-stylish",
    "name": "Stylish Theme",
    "category": "invoices",
    "description": "Modern card-style design with clean borders, high-contrast headers, and highlighted totals.",
    "isDefault": True,
    "paperSize": "A4",
    "primaryColor": "#2563eb",
    "fontFamily": "Inter, sans-serif",
    "headerTitle": "TAX INVOICE",
    "storeName": "LazyMonkeyAI",
    "storeAddress": "KK Street, Proddatur, YSR Cuddapah, Andhra Pradesh, 516360",
    "storePhone": "+91 9849344919",
    "gstin": "37AABCCH694G1Z4",
    "footerText": "Thank you for shopping at LazyMonkeyAI!",
    "termsText": "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is not made within due date.",
    "bankDetails": "",
    "themeName": "stylish",
    "fields": {
        "showLogo": True,
        "showHSN": True,
        "showTaxSplit": True,
        "showBankDetails": False,
        "showSignature": True,
        "showCustomerDetails": True,
        "showProductName": True,
        "showPrice": True,
        "showMRP": True,
        "showSKU": True,
        "showPartyBalance": True,
        "showItemDescription": True,
        "showTime": True,
    },
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fmt_amount(value: float | None) -> str:
    if value is None:
        return "0.00"
    return f"{value:,.2f}"


def _safe_text(value: Any, max_length: int = 200) -> str:
    """Normalize text for fpdf built-in fonts (latin-1 safe)."""
    if value is None:
        return ""
    text = str(value)
    replacements = {
        "₹": "Rs.",   # ₹
        "—": "-",     # —
        "–": "-",     # –
        "‘": "'",     # '
        "’": "'",     # '
        "“": '"',     # "
        "”": '"',     # "
        "•": "*",     # •
        "…": "...",   # …
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text[:max_length]


def _resolve_font(font_family: str | None) -> str:
    """Map a CSS-style font family to an fpdf2 built-in font name."""
    if not font_family:
        return "Helvetica"
    if font_family in _FONT_MAP:
        return _FONT_MAP[font_family]
    for key, val in _FONT_MAP.items():
        if key.lower() in font_family.lower():
            return val
    return "Helvetica"


def _hex_to_rgb(hex_color: str | None) -> tuple[int, int, int]:
    """Convert #RRGGBB to (r, g, b) tuple."""
    if not hex_color:
        return (33, 37, 41)
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    try:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return (r, g, b)
    except ValueError:
        return (33, 37, 41)


# ---------------------------------------------------------------------------
# Template lookup — reads from Tenant.settings JSON
# ---------------------------------------------------------------------------

async def get_active_invoice_template(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """Return the tenant's active invoice print template dict.

    Reads from ``Tenant.settings["print_templates"]["invoices"]``.  If no
    template is configured, seeds the default "Stylish Theme" template
    into the tenant's settings and returns it.

    Never returns ``None`` — a template is always available.
    """
    result = await db.execute(
        select(Tenant.settings).where(Tenant.id == tenant_id)
    )
    row = result.scalar_one_or_none()
    settings: dict = dict(row) if row else {}

    print_templates = settings.get("print_templates", {})
    invoice_config = print_templates.get("invoices", {})

    active_id = invoice_config.get("active")
    templates_map = invoice_config.get("templates", {})

    if active_id and active_id in templates_map:
        return templates_map[active_id]

    # No template configured — seed default and persist
    default_tpl = dict(_DEFAULT_INVOICE_TEMPLATE)
    settings.setdefault("print_templates", {})["invoices"] = {
        "active": default_tpl["id"],
        "templates": {default_tpl["id"]: default_tpl},
    }
    await db.execute(
        update(Tenant).where(Tenant.id == tenant_id).values(settings=settings)
    )
    logger.info("Seeded default invoice print template for tenant %s", tenant_id)
    return default_tpl


async def set_active_invoice_template(db: AsyncSession, tenant_id: uuid.UUID, template: dict) -> None:
    """Persist the active invoice print template into Tenant.settings."""
    result = await db.execute(
        select(Tenant.settings).where(Tenant.id == tenant_id)
    )
    row = result.scalar_one_or_none()
    settings: dict = dict(row) if row else {}

    tpl_id = template.get("id", "tpl-inv-custom")
    settings.setdefault("print_templates", {})["invoices"] = {
        "active": tpl_id,
        "templates": {tpl_id: template},
    }

    await db.execute(
        update(Tenant).where(Tenant.id == tenant_id).values(settings=settings)
    )


# ---------------------------------------------------------------------------
# PDF Renderer
# ---------------------------------------------------------------------------

def render_invoice_pdf(invoice: Any, template: dict) -> bytes:
    """Render an Invoice ORM instance into PDF bytes using the given template.

    Parameters
    ----------
    invoice : Invoice
        The ORM invoice instance.  Its ``lines`` relationship must be loaded.
    template : dict
        Print template dict (from ``get_active_invoice_template``).

    Returns
    -------
    bytes — Raw PDF data.
    """
    assert template, "A print template dict is required for invoice PDF rendering"

    # ── Resolve template styling ─────────────────────────────────────────
    primary_rgb = _hex_to_rgb(template.get("primaryColor"))
    font_name = _resolve_font(template.get("fontFamily"))
    header_title = _safe_text(template.get("headerTitle") or "TAX INVOICE", 60)
    store_name = _safe_text(template.get("storeName") or "", 80)
    store_address = _safe_text(template.get("storeAddress") or "", 120)
    store_phone = _safe_text(template.get("storePhone") or "", 40)
    gstin = _safe_text(template.get("gstin") or "", 30)
    footer_text = _safe_text(template.get("footerText") or "", 200)
    terms_text = _safe_text(template.get("termsText") or "", 500)
    bank_details = _safe_text(template.get("bankDetails") or "", 200)

    # Field toggles (default True)
    fields = template.get("fields") or {}
    show_logo = fields.get("showLogo", True)
    show_hsn = fields.get("showHSN", True)
    show_tax_split = fields.get("showTaxSplit", True)
    show_bank_details = fields.get("showBankDetails", True)
    show_signature = fields.get("showSignature", True)
    show_customer_details = fields.get("showCustomerDetails", True)
    show_time = fields.get("showTime", True)

    # ── Build PDF ───────────────────────────────────────────────────────
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    page_w = pdf.w  # 210 mm for A4
    pdf.add_page()

    # ── HEADER BAR ──────────────────────────────────────────────────────
    header_height = 28 if show_logo else 22
    pdf.set_fill_color(*primary_rgb)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font(font_name, "B", 14)
    pdf.cell(0, header_height, header_title, ln=1, align="R", fill=True)

    # ── STORE INFO BLOCK ────────────────────────────────────────────────
    pdf.set_text_color(0, 0, 0)
    if store_name:
        pdf.set_font(font_name, "B", 10)
        pdf.cell(0, 5, store_name, ln=1)
    if store_address:
        pdf.set_font(font_name, "", 8)
        pdf.multi_cell(0, 4, store_address)
    phone_gstin_parts = [p for p in [store_phone, gstin] if p]
    if phone_gstin_parts:
        pdf.set_font(font_name, "", 8)
        pdf.cell(0, 4, "  |  ".join(phone_gstin_parts), ln=1)
    pdf.ln(2)

    # ── INVOICE META + BILL-TO ──────────────────────────────────────────
    if show_customer_details:
        y_start = pdf.get_y()

        pdf.set_font(font_name, "B", 9)
        pdf.set_text_color(*primary_rgb)
        pdf.cell(95, 6, "Billed To:", ln=0)
        pdf.cell(95, 6, "Invoice Details:", ln=1)
        pdf.set_text_color(0, 0, 0)

        bill_lines = [
            _safe_text(invoice.customer_name or "Customer", 80),
            _safe_text(getattr(invoice, "customer_phone", None), 40),
            _safe_text(getattr(invoice, "customer_email", None), 60),
            _safe_text(getattr(invoice, "customer_gstin", None), 30),
            _safe_text(getattr(invoice, "billing_address", None), 200),
        ]
        bill_lines = [l for l in bill_lines if l]

        pdf.set_xy(10, y_start)
        pdf.set_font(font_name, "", 8)
        for line in bill_lines:
            pdf.set_xy(10, pdf.get_y())
            pdf.cell(95, 4.5, line, ln=1)
        pdf.set_xy(10, y_start)

        meta_lines = [
            ("Invoice No:", _safe_text(invoice.invoice_number, 40)),
            ("Invoice Date:", _safe_text(str(invoice.invoice_date) if invoice.invoice_date else "", 20)),
            ("Due Date:", _safe_text(str(invoice.due_date) if invoice.due_date else "", 20)),
            ("Status:", _safe_text(invoice.status, 20)),
            ("Currency:", _safe_text(invoice.currency_code or "INR", 10)),
        ]
        pdf.set_font(font_name, "B", 8)
        pdf.set_xy(105, y_start)
        for label, value in meta_lines:
            pdf.cell(35, 4.5, label, ln=0)
            pdf.set_font(font_name, "", 8)
            pdf.cell(60, 4.5, value, ln=1)
            pdf.set_font(font_name, "B", 8)
            pdf.set_x(105)

        pdf.set_y(max(pdf.get_y(), y_start + 4.5 * len(bill_lines)) + 3)
    else:
        y_start = pdf.get_y()
        pdf.set_font(font_name, "B", 9)
        pdf.set_text_color(*primary_rgb)
        pdf.cell(0, 6, header_title, ln=1)
        pdf.set_text_color(0, 0, 0)
        pdf.set_font(font_name, "", 8)
        pdf.cell(0, 5, f"Invoice No: {_safe_text(invoice.invoice_number, 40)}", ln=1)
        pdf.cell(0, 5, f"Date: {_safe_text(str(invoice.invoice_date) if invoice.invoice_date else '', 20)}", ln=1)
        pdf.ln(2)

    pdf.set_draw_color(*primary_rgb)
    pdf.line(10, pdf.get_y(), page_w - 10, pdf.get_y())
    pdf.ln(3)

    # ── LINE ITEMS TABLE ────────────────────────────────────────────────
    col_spec: list[tuple[str, int]] = [("#", 8)]
    col_spec.append(("Product / Description", 65))
    if show_hsn:
        col_spec.append(("HSN", 16))
    col_spec.append(("Qty", 12))
    col_spec.append(("Unit Price", 22))
    if show_tax_split:
        col_spec.append(("Tax %", 12))
        col_spec.append(("Tax Amt", 22))
    col_spec.append(("Line Total", 28))

    pdf.set_font(font_name, "B", 8)
    pdf.set_fill_color(*primary_rgb)
    pdf.set_text_color(255, 255, 255)
    for label, w in col_spec:
        pdf.cell(w, 7, label, border=1, fill=True, align="C")
    pdf.ln()

    pdf.set_text_color(0, 0, 0)
    inv_lines = getattr(invoice, "lines", []) or []
    for idx, line in enumerate(inv_lines, start=1):
        pdf.set_font(font_name, "", 7)
        pdf.cell(8, 6, str(idx), border=1, align="C")
        pdf.cell(65, 6, _safe_text(line.product_name or "", 65), border=1)
        if show_hsn:
            pdf.cell(16, 6, _safe_text(getattr(line, "hsn_code", None) or "-", 16), border=1, align="C")
        pdf.cell(12, 6, _fmt_amount(line.quantity), border=1, align="R")
        pdf.cell(22, 6, _fmt_amount(line.unit_price), border=1, align="R")
        if show_tax_split:
            pdf.cell(12, 6, _fmt_amount(line.tax_rate), border=1, align="R")
            tax_sum = (line.cgst_amount or 0) + (line.sgst_amount or 0) + (line.igst_amount or 0)
            pdf.cell(22, 6, _fmt_amount(tax_sum), border=1, align="R")
        pdf.cell(28, 6, _fmt_amount(line.line_total), border=1, align="R")
        pdf.ln()

    pdf.ln(3)

    # ── TOTALS ──────────────────────────────────────────────────────────
    totals_x = page_w - 10 - 70
    label_w = 42
    value_w = 28

    def _total_row(label: str, value: float | None, bold: bool = False) -> None:
        pdf.set_font(font_name, "B" if bold else "", 9)
        pdf.set_xy(totals_x, pdf.get_y())
        pdf.cell(label_w, 5.5, label, border=0, align="L")
        pdf.cell(value_w, 5.5, _fmt_amount(value), border=0, align="R")
        pdf.ln()

    _total_row("Subtotal", invoice.subtotal)
    if invoice.discount_amount:
        _total_row("Discount", -invoice.discount_amount)
    if show_tax_split:
        if invoice.cgst_amount:
            _total_row("CGST", invoice.cgst_amount)
        if invoice.sgst_amount:
            _total_row("SGST", invoice.sgst_amount)
        if invoice.igst_amount:
            _total_row("IGST", invoice.igst_amount)
    else:
        if getattr(invoice, "tax_total", None):
            _total_row("Tax", invoice.tax_total)
    if invoice.tds_amount:
        _total_row("TDS", -invoice.tds_amount)
    if invoice.round_off:
        _total_row("Round Off", invoice.round_off)

    pdf.set_draw_color(*primary_rgb)
    pdf.line(totals_x, pdf.get_y(), totals_x + label_w + value_w, pdf.get_y())
    pdf.ln(1)
    _total_row("Grand Total", invoice.total_amount, bold=True)
    _total_row("Amount Paid", invoice.amount_paid)
    _total_row("Balance Due", invoice.balance_due, bold=True)

    pdf.ln(5)

    # ── TERMS & BANK DETAILS ────────────────────────────────────────────
    if terms_text:
        pdf.set_font(font_name, "B", 8)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin, 5, "Terms & Conditions:")
        pdf.set_font(font_name, "", 8)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin, 4, terms_text)
        pdf.ln(1)

    is_dummy_bank = not bank_details or any(x in bank_details for x in ["334455667788", "TEST", "000405103000", "SBIN0001234", "dummy", "Dummy"])
    if show_bank_details and bank_details and not is_dummy_bank and len(bank_details.strip()) > 5:
        pdf.set_font(font_name, "B", 8)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin, 5, "Bank Details:")
        pdf.set_font(font_name, "", 8)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin, 4, bank_details)
        pdf.ln(1)

    # ── SIGNATURE ──────────────────────────────────────────────────────
    if show_signature:
        sig_x = page_w - 10 - 60
        sig_y = pdf.get_y()
        pdf.set_xy(sig_x, sig_y)
        pdf.line(sig_x, sig_y + 15, sig_x + 60, sig_y + 15)
        pdf.set_xy(sig_x, sig_y + 16)
        pdf.set_font(font_name, "", 8)
        pdf.cell(60, 4, "Authorized Signatory", align="C")
        pdf.ln(8)

    # ── FOOTER ─────────────────────────────────────────────────────────
    if footer_text:
        pdf.set_font(font_name, "I", 8)
        pdf.set_text_color(120, 120, 120)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin, 4, footer_text)
        pdf.set_text_color(0, 0, 0)

    # ── TIMESTAMP ──────────────────────────────────────────────────────
    if show_time:
        pdf.set_font(font_name, "", 7)
        pdf.set_text_color(160, 160, 160)
        pdf.set_y(-12)
        pdf.cell(0, 4, f"Generated: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}", align="L")
        pdf.set_text_color(0, 0, 0)

    # ── Output ─────────────────────────────────────────────────────────
    raw = pdf.output(dest="S")
    if isinstance(raw, str):
        return raw.encode("latin-1", errors="replace")
    return bytes(raw)


# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------

def save_invoice_pdf(invoice: Any, template: dict) -> Path:
    """Render invoice PDF with template and persist to disk (graceful fallback)."""
    pdf_bytes = render_invoice_pdf(invoice, template)
    safe_number = "".join(
        c if c.isalnum() or c in "-_" else "_"
        for c in (invoice.invoice_number or str(uuid.uuid4()))
    )
    try:
        INVOICE_PDF_DIR.mkdir(parents=True, exist_ok=True)
        file_path = INVOICE_PDF_DIR / f"{safe_number}.pdf"
        file_path.write_bytes(pdf_bytes)
        return file_path
    except Exception as exc:
        logger.warning("Could not persist invoice PDF to disk (%s): %s", safe_number, exc)
        return INVOICE_PDF_DIR / f"{safe_number}.pdf"


def render_invoice_pdf_b64(invoice: Any, template: dict) -> str:
    """Render invoice PDF with template and return base64 string."""
    import base64
    pdf_bytes = render_invoice_pdf(invoice, template)
    return base64.b64encode(pdf_bytes).decode("ascii")
