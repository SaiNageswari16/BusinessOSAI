"""Invoice PDF Generator — high-fidelity template-aware rendering.

Renders an exact, modern A4 Tax Invoice PDF matching the frontend's
"Stylish Theme (A4)" in FullInvoicePrinter.tsx.

Supports:
- Dynamic tenant/company branding (name, legal name, GSTIN, phone, address, logo)
- Clean card-based 3-column customer/consignee layout without text overlaps
- Modern line items table with HSN, unit price, discounts, tax rates, and line totals
- Product & slab-wise GST Tax Breakdown table (Intra-State CGST+SGST / Inter-State IGST)
- Paid-in-Full badge, terms & conditions, Google review card
- Card-based totals summary (Taxable Subtotal, CGST, SGST, IGST, Grand Total, Amount Paid)
- Authorized signatory and timestamp footer
"""
from __future__ import annotations

import base64
import json
import logging
import os
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fpdf import FPDF
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
INVOICE_PDF_DIR = _BACKEND_ROOT / "static" / "invoices"
INVOICE_PDF_DIR.mkdir(parents=True, exist_ok=True)

# Logo search paths
_STATIC_LOGO_PATHS = [
    _BACKEND_ROOT / "static" / "logo.png",
    _BACKEND_ROOT / "static" / "Logo.png",
    _BACKEND_ROOT.parent / "frontend" / "public" / "Logo.png",
    _BACKEND_ROOT.parent / "frontend" / "public" / "logo.png",
]

# ---------------------------------------------------------------------------
# Indian State GST Codes
# ---------------------------------------------------------------------------
STATE_GST_CODES: dict[str, str] = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "32": "Kerala", "33": "Tamil Nadu",
    "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
}

# ---------------------------------------------------------------------------
# Default Invoice Template Configuration
# ---------------------------------------------------------------------------
_DEFAULT_INVOICE_TEMPLATE: dict[str, Any] = {
    "id": "tpl-inv-stylish",
    "name": "Stylish Theme",
    "category": "invoices",
    "description": "Modern card-style design with clean borders, high-contrast headers, and highlighted totals.",
    "isDefault": True,
    "paperSize": "A4",
    "primaryColor": "#2563eb",
    "fontFamily": "Helvetica",
    "headerTitle": "TAX INVOICE",
    "storeName": "venatic",
    "legalName": "AUTHORIZED BUSINESS ORGANIZATION",
    "storeAddress": "Andhra Pradesh, India",
    "storePhone": "+91 9398622127",
    "gstin": "37AABCCH694G1Z4",
    "footerText": "Thank you for choosing venatic!",
    "termsText": "1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.",
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
    return f"{float(value):,.2f}"


def _safe_text(value: Any, max_length: int = 300) -> str:
    """Normalize text for latin-1 safe rendering."""
    if value is None:
        return ""
    text = str(value)
    replacements = {
        "₹": "Rs. ",
        "—": "-",
        "–": "-",
        "‘": "'",
        "’": "'",
        "“": '"',
        "”": '"',
        "•": "*",
        "…": "...",
        "✓": "[OK]",
        "✔": "[OK]",
        "·": "-",
        "★": "*",
        "☆": "*",
        "\u200b": "",
        "\xa0": " ",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text[:max_length]


def _hex_to_rgb(hex_color: str | None) -> tuple[int, int, int]:
    """Convert #RRGGBB to (r, g, b) tuple."""
    if not hex_color:
        return (37, 99, 235)  # Default brand blue
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    try:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return (r, g, b)
    except ValueError:
        return (37, 99, 235)


def _find_logo_path(custom_url: str | None = None) -> str | None:
    """Resolve a valid local logo image path if available."""
    if custom_url and os.path.exists(custom_url):
        return custom_url
    for p in _STATIC_LOGO_PATHS:
        if p.exists() and p.stat().st_size > 100:
            return str(p)
    return None


def _resolve_state(gstin: str | None, address: str | None = None) -> tuple[str, str]:
    """Return (state_name, state_code) from GSTIN or address."""
    gstin_clean = (gstin or "").strip().upper()
    if len(gstin_clean) >= 2 and gstin_clean[:2].isdigit() and gstin_clean[:2] in STATE_GST_CODES:
        code = gstin_clean[:2]
        return (STATE_GST_CODES[code], code)

    addr_lower = (address or "").lower()
    for code, name in STATE_GST_CODES.items():
        if name.lower() in addr_lower:
            return (name, code)
    return ("Andhra Pradesh", "37")


# ---------------------------------------------------------------------------
# Template lookup — reads from DB with Dynamic Company Resolution
# ---------------------------------------------------------------------------

# Built-in Template Definitions matching frontend
_BUILTIN_TEMPLATES = {
    "tpl-inv-parle-teal": {
        "id": "tpl-inv-parle-teal",
        "name": "Parle Brand Teal-Header GST (A4)",
        "themeName": "parle_teal",
        "primaryColor": "#00695c",
        "category": "invoices",
    },
    "tpl-inv-fmcg-distributor": {
        "id": "tpl-inv-fmcg-distributor",
        "name": "FMCG / Food Multi-Column GST (A4)",
        "themeName": "fmcg_distributor",
        "primaryColor": "#0369a1",
        "category": "invoices",
    },
    "tpl-inv-marg-pharma": {
        "id": "tpl-inv-marg-pharma",
        "name": "MARG Pharma & Wholesale GST (A4)",
        "themeName": "marg_pharma",
        "primaryColor": "#1e40af",
        "category": "invoices",
    },
    "tpl-inv-agri-seeds": {
        "id": "tpl-inv-agri-seeds",
        "name": "Agri Seeds, Fertilizer & Pesticides GST (A4)",
        "themeName": "agri_seeds",
        "primaryColor": "#15803d",
        "category": "invoices",
    },
    "tpl-inv-stylish": {
        "id": "tpl-inv-stylish",
        "name": "Stylish Theme (A4)",
        "themeName": "stylish",
        "primaryColor": "#2563eb",
        "category": "invoices",
    },
    "tpl-inv-luxury": {
        "id": "tpl-inv-luxury",
        "name": "Luxury Theme (A4)",
        "themeName": "luxury",
        "primaryColor": "#b45309",
        "category": "invoices",
    },
    "tpl-inv-tally": {
        "id": "tpl-inv-tally",
        "name": "Advanced GST (Tally) Theme (A4)",
        "themeName": "tally",
        "primaryColor": "#0f172a",
        "category": "invoices",
    },
    "tpl-inv-modern": {
        "id": "tpl-inv-modern",
        "name": "Modern Theme (A4)",
        "themeName": "modern",
        "primaryColor": "#475569",
        "category": "invoices",
    },
}


# ---------------------------------------------------------------------------
# Template lookup — reads from DB with Dynamic Company Resolution
# ---------------------------------------------------------------------------

async def get_active_invoice_template(db: AsyncSession, tenant_id: uuid.UUID, company_id: uuid.UUID | None = None) -> dict:
    """Return the tenant's active invoice print template dict merged with company info."""
    from src.models import Company, Tenant

    # 1. Fetch Tenant and Company (use company_id if provided, else newest company)
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    tenant_settings = dict(tenant.settings) if tenant and tenant.settings else {}

    company = None
    if company_id:
        company = await db.get(Company, company_id)
    if not company:
        # Prefer active/latest company created
        company_res = await db.execute(
            select(Company).where(Company.tenant_id == tenant_id).order_by(Company.created_at.desc())
        )
        company = company_res.scalars().first()

    # 2. Get configured template
    print_templates = tenant_settings.get("print_templates", {})
    invoice_config = print_templates.get("invoices", {})
    active_id = invoice_config.get("active")
    templates_map = invoice_config.get("templates", {})

    if active_id and active_id in templates_map:
        tpl = dict(templates_map[active_id])
    elif active_id and active_id in _BUILTIN_TEMPLATES:
        tpl = dict(_BUILTIN_TEMPLATES[active_id])
    elif "tpl-inv-parle-teal" in _BUILTIN_TEMPLATES:
        # Check if default is Parle Teal or Stylish
        tpl = dict(_BUILTIN_TEMPLATES.get(active_id or "tpl-inv-parle-teal", _DEFAULT_INVOICE_TEMPLATE))
    else:
        tpl = dict(_DEFAULT_INVOICE_TEMPLATE)

    # 3. Dynamic organization details override (replaces hardcoded defaults)
    tenant_name = (tenant.name if tenant else "TESTINGORG") or "TESTINGORG"
    if company:
        tpl["storeName"] = company.name or tenant_name
        tpl["legalName"] = company.legal_name or company.name or "AUTHORIZED BUSINESS ORGANIZATION"
        if company.address:
            tpl["storeAddress"] = company.address
        if company.phone:
            tpl["storePhone"] = company.phone
        if company.gst_number:
            tpl["gstin"] = company.gst_number
        if company.email:
            tpl["storeEmail"] = company.email
        if company.terms_and_conditions:
            tpl["termsText"] = company.terms_and_conditions
        if company.logo_url:
            tpl["logoUrl"] = company.logo_url
        if company.google_review_url:
            tpl["googleReviewUrl"] = company.google_review_url
    else:
        tpl["storeName"] = tenant_name
        tpl["legalName"] = "AUTHORIZED BUSINESS ORGANIZATION"

    return tpl


async def set_active_invoice_template(db: AsyncSession, tenant_id: uuid.UUID, template: dict) -> None:
    """Persist the active invoice print template into Tenant.settings."""
    from src.models import Tenant

    result = await db.execute(
        select(Tenant.settings).where(Tenant.id == tenant_id)
    )
    row = result.scalar_one_or_none()
    settings: dict = dict(row) if row else {}

    tpl_id = template.get("id", "tpl-inv-stylish")
    settings.setdefault("print_templates", {})["invoices"] = {
        "active": tpl_id,
        "templates": {tpl_id: template},
    }

    await db.execute(
        update(Tenant).where(Tenant.id == tenant_id).values(settings=settings)
    )


# ---------------------------------------------------------------------------
# Number to Indian Words Helper (for distributor invoices)
# ---------------------------------------------------------------------------
_UNITS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
          "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

def _number_to_indian_words(num: float) -> str:
    n = int(round(num))
    if n == 0:
        return "ZERO RUPEES ONLY"

    def _two_digits(val: int) -> str:
        if val < 20:
            return _UNITS[val]
        tens = _TENS[val // 10]
        units = _UNITS[val % 10]
        return f"{tens} {units}".strip()

    def _three_digits(val: int) -> str:
        h = val // 100
        rem = val % 100
        parts = []
        if h > 0:
            parts.append(f"{_UNITS[h]} Hundred")
        if rem > 0:
            parts.append(_two_digits(rem))
        return " ".join(parts).strip()

    crore = n // 10000000
    n %= 10000000
    lakh = n // 100000
    n %= 100000
    thousand = n // 1000
    n %= 1000
    hundreds = n

    res = []
    if crore > 0:
        res.append(f"{_three_digits(crore)} Crore")
    if lakh > 0:
        res.append(f"{_three_digits(lakh)} Lakh")
    if thousand > 0:
        res.append(f"{_three_digits(thousand)} Thousand")
    if hundreds > 0:
        res.append(_three_digits(hundreds))

    return f"RS. {' '.join(res).upper()} ONLY"


# ---------------------------------------------------------------------------
# High-Fidelity Multi-Template PDF Renderer
# ---------------------------------------------------------------------------

def _render_fmcg_pdf(invoice: Any, template: dict) -> bytes:
    """Render FMCG / Food Multi-Column GST Distributor Template."""
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=8)
    pdf.set_margins(10, 8, 10)
    pdf.add_page()

    store_name = _safe_text(template.get("storeName") or "TESTINGORG", 60)
    store_address = _safe_text(template.get("storeAddress") or "PLOT NO - N-2, INDUSTRIAL ESTATE, State : 29-Karnataka", 120)
    store_phone = _safe_text(template.get("storePhone") or "", 30)
    gstin = _safe_text(template.get("gstin") or "29AAOFM2891F1ZT", 30)
    pan_number = gstin[2:12] if len(gstin) >= 12 else "AAOFM2891F"
    copy_type = _safe_text(getattr(invoice, "copy_type", None) or "ORIGINAL FOR RECIPIENT", 35)

    inv_number = _safe_text(getattr(invoice, "invoice_number", None) or "INV-91132", 30)
    inv_date = _safe_text(str(getattr(invoice, "invoice_date", None) or date.today()), 20)
    if "-" in inv_date and len(inv_date.split("-")) == 3:
        p = inv_date.split("-")
        inv_date = f"{p[2]}/{p[1]}/{p[0]}" if len(p[0]) == 4 else inv_date

    cust_name = _safe_text(getattr(invoice, "customer_name", None) or "Nagi", 40)
    cust_phone = _safe_text(getattr(invoice, "customer_phone", None) or "", 25)
    cust_gstin = _safe_text(getattr(invoice, "customer_gstin", None) or "UNREGISTERED", 25)
    billing_addr = _safe_text(getattr(invoice, "billing_address", None) or "Andhra Pradesh", 100)
    shipping_addr = _safe_text(getattr(invoice, "shipping_address", None) or billing_addr, 100)
    payment_method = _safe_text(getattr(invoice, "payment_method", None) or "Cash", 20)

    total_amount = float(getattr(invoice, "total_amount", 0.0) or 0.0)
    subtotal = float(getattr(invoice, "subtotal", 0.0) or (total_amount / 1.18 if total_amount > 0 else 0.0))
    total_tax = float(getattr(invoice, "tax_amount", 0.0) or (total_amount - subtotal))
    cgst_amount = float(getattr(invoice, "cgst_amount", 0.0) or (total_tax / 2))
    sgst_amount = float(getattr(invoice, "sgst_amount", 0.0) or (total_tax / 2))

    # Outer Frame
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.4)
    pdf.rect(10, 8, 190, 277, style="D")

    # 1. Top Title Bar
    pdf.set_xy(11, 9)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(30, 58, 138)  # blue-900
    pdf.cell(50, 4.5, f"[{copy_type.upper()}]", border=0, align="L")

    pdf.set_xy(70, 9)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(70, 4.5, "TAX INVOICE", border=0, align="C")

    pdf.set_xy(145, 9)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(54, 4.5, "Page No: 1 of 1", border=0, align="R")

    pdf.line(10, 14.5, 200, 14.5)

    # 2. Company Profile Header
    pdf.set_xy(12, 16)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(110, 5, store_name, ln=1)

    pdf.set_xy(12, 21)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(110, 3.5, store_address, ln=1)

    pdf.set_xy(12, 24.5)
    pdf.cell(110, 3.5, "CIN: U74999KA2026PTC123456", ln=1)

    pdf.set_xy(125, 16)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(74, 4, f"GSTIN: {gstin}", align="R", ln=1)

    if store_phone:
        pdf.set_xy(125, 20)
        pdf.set_font("Helvetica", "", 7)
        pdf.cell(74, 3.5, f"Phone: {store_phone}", align="R", ln=1)

    pdf.set_xy(125, 23.5)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(74, 3.5, f"PAN: {pan_number}", align="R", ln=1)

    pdf.line(10, 29, 200, 29)

    # 3. Meta Bar (Invoice No, Date, PO, Pymt Mode, e-Way)
    pdf.set_fill_color(248, 250, 252)
    pdf.rect(10.2, 29.2, 189.6, 6.6, style="F")
    pdf.set_xy(12, 30.5)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(42, 4, f"Invoice No. : {inv_number}", ln=0)
    pdf.cell(38, 4, f"Invoice Date: {inv_date}", ln=0)
    pdf.cell(42, 4, "PO / Order Ref: DMS", ln=0)
    pdf.cell(35, 4, f"Pymt Mode: {payment_method}", ln=0)
    pdf.cell(30, 4, "e-Way Bill: NA", align="R", ln=1)

    pdf.line(10, 36, 200, 36)

    # 4. Billed To / Shipped To Columns
    pdf.set_xy(12, 37.5)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(90, 3.5, f"Billed To : {cust_name}", ln=1)

    pdf.set_xy(12, 41)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(90, 3.5, f"Address : {billing_addr}", ln=1)

    pdf.set_xy(12, 44.5)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(90, 3.5, f"GSTIN : {cust_gstin}", ln=1)

    pdf.set_xy(12, 48)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.cell(45, 3, "State : 37-Telangana", ln=0)
    pdf.cell(45, 3, f"PO Date : {inv_date}", ln=1)
    pdf.set_xy(12, 51)
    pdf.cell(45, 3, "Vehicle : -", ln=0)
    pdf.cell(45, 3, f"Cust Contact: {cust_phone or '-'}", ln=1)

    # Divider between Billed To / Shipped To
    pdf.line(105, 36, 105, 55)

    pdf.set_xy(107, 37.5)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(90, 3.5, f"Shipped To : {cust_name}", ln=1)

    pdf.set_xy(107, 41)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(90, 3.5, f"Address : {shipping_addr}", ln=1)

    pdf.set_xy(107, 44.5)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(90, 3.5, f"GSTIN : {cust_gstin}", ln=1)

    pdf.set_xy(107, 48)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.cell(45, 3, "Driver / Transport : -", ln=0)
    pdf.cell(45, 3, "e-Way Bill No : -", ln=1)
    pdf.set_xy(107, 51)
    pdf.cell(45, 3, f"Due Date : {inv_date}", ln=0)
    pdf.cell(45, 3, f"Ack. Date : {inv_date}", ln=1)

    pdf.line(10, 55, 200, 55)

    # 5. Multi-Column FMCG Item Table Header
    fmcg_cols_w = [6, 46, 10, 12, 14, 10, 16, 9, 11, 14, 14, 14, 14] # sum = 190
    fmcg_hdr1 = ["#", "Item Name", "UOM", "MRP", "Rate", "Qty", "GrossAmt", "Free", "Disc%", "Disc.Amt", "Other Disc", "Tot.Tax", "Amount"]

    pdf.set_fill_color(241, 245, 249)
    pdf.set_xy(10, 55)
    pdf.set_font("Helvetica", "B", 6.5)
    for i, w in enumerate(fmcg_cols_w):
        align = "L" if i == 1 else "C" if i in (0, 2, 7) else "R"
        pdf.cell(w, 5, fmcg_hdr1[i], border=1, fill=True, align=align)
    pdf.ln()

    # Subheader for GST Split
    pdf.set_fill_color(248, 250, 252)
    pdf.set_font("Helvetica", "", 6)
    pdf.cell(fmcg_cols_w[0] + fmcg_cols_w[1], 4, " HSN | Qty in SUOM", border=1, fill=True, align="L")
    pdf.cell(fmcg_cols_w[2] + fmcg_cols_w[3], 4, "Taxable Amt", border=1, fill=True, align="R")
    pdf.cell(fmcg_cols_w[4], 4, "CGST %", border=1, fill=True, align="R")
    pdf.cell(fmcg_cols_w[5] + fmcg_cols_w[6], 4, "CGST Amt", border=1, fill=True, align="R")
    pdf.cell(fmcg_cols_w[7], 4, "SGST %", border=1, fill=True, align="R")
    pdf.cell(fmcg_cols_w[8] + fmcg_cols_w[9], 4, "SGST Amt", border=1, fill=True, align="R")
    pdf.cell(fmcg_cols_w[10] + fmcg_cols_w[11] + fmcg_cols_w[12], 4, "", border=1, fill=True, align="R")
    pdf.ln()

    inv_lines = getattr(invoice, "lines", []) or []
    if not inv_lines:
        inv_lines = [
            type("DummyLine", (), {
                "product_name": "Standard Products & Items",
                "hsn_code": "9988",
                "quantity": 1.0,
                "unit_price": subtotal,
                "discount_value": 0.0,
                "tax_rate": 18.0,
                "line_total": total_amount,
            })()
        ]

    for idx, line in enumerate(inv_lines, start=1):
        p_name = _safe_text(getattr(line, "product_name", None) or f"Item {idx}", 32)
        hsn = _safe_text(getattr(line, "hsn_code", None) or "19053100", 10)
        qty = float(getattr(line, "quantity", 1.0) or 1.0)
        rate = float(getattr(line, "unit_price", 0.0) or 0.0)
        mrp = float(getattr(line, "mrp", None) or (rate * 1.15))
        disc = float(getattr(line, "discount_value", 0.0) or 0.0)
        tax_rate = float(getattr(line, "tax_rate", 18.0) or 18.0)
        gross = qty * rate
        taxable = gross - disc
        tax_val = (taxable * (tax_rate / 2.0)) / 100.0
        tot_tax_line = tax_val * 2
        line_tot = taxable + tot_tax_line

        # Main Item Row
        pdf.set_font("Helvetica", "", 6.5)
        pdf.cell(fmcg_cols_w[0], 4.5, str(idx), border="LR", align="C")
        pdf.set_font("Helvetica", "B", 6.5)
        pdf.cell(fmcg_cols_w[1], 4.5, f" {p_name}", border="LR", align="L")
        pdf.set_font("Helvetica", "", 6.5)
        pdf.cell(fmcg_cols_w[2], 4.5, "PAC", border="LR", align="C")
        pdf.cell(fmcg_cols_w[3], 4.5, _fmt_amount(mrp), border="LR", align="R")
        pdf.cell(fmcg_cols_w[4], 4.5, _fmt_amount(rate), border="LR", align="R")
        pdf.cell(fmcg_cols_w[5], 4.5, str(int(qty) if qty.is_integer() else f"{qty:.2f}"), border="LR", align="C")
        pdf.cell(fmcg_cols_w[6], 4.5, _fmt_amount(gross), border="LR", align="R")
        pdf.cell(fmcg_cols_w[7], 4.5, "0.00", border="LR", align="C")
        pdf.cell(fmcg_cols_w[8], 4.5, "0.00", border="LR", align="R")
        pdf.cell(fmcg_cols_w[9], 4.5, _fmt_amount(disc), border="LR", align="R")
        pdf.cell(fmcg_cols_w[10], 4.5, "0.00", border="LR", align="R")
        pdf.cell(fmcg_cols_w[11], 4.5, _fmt_amount(tot_tax_line), border="LR", align="R")
        pdf.set_font("Helvetica", "B", 6.5)
        pdf.cell(fmcg_cols_w[12], 4.5, f"{_fmt_amount(line_tot)} ", border="LR", align="R")
        pdf.ln()

        # Sub-row for GST
        pdf.set_font("Helvetica", "", 6)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(fmcg_cols_w[0] + fmcg_cols_w[1], 3.8, f"   {hsn} | {(qty * 0.1):.3f}KG", border="LBR", align="L")
        pdf.cell(fmcg_cols_w[2] + fmcg_cols_w[3], 3.8, _fmt_amount(taxable), border="LBR", align="R")
        pdf.cell(fmcg_cols_w[4], 3.8, f"{tax_rate/2:.0f}%", border="LBR", align="R")
        pdf.cell(fmcg_cols_w[5] + fmcg_cols_w[6], 3.8, _fmt_amount(tax_val), border="LBR", align="R")
        pdf.cell(fmcg_cols_w[7], 3.8, f"{tax_rate/2:.0f}%", border="LBR", align="R")
        pdf.cell(fmcg_cols_w[8] + fmcg_cols_w[9], 3.8, _fmt_amount(tax_val), border="LBR", align="R")
        pdf.cell(fmcg_cols_w[10] + fmcg_cols_w[11] + fmcg_cols_w[12], 3.8, "", border="LBR", align="R")
        pdf.set_text_color(0, 0, 0)
        pdf.ln()

    # 6. FMCG Summary Bar
    pdf.set_fill_color(241, 245, 249)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(140, 5, f" Total No of Items Sold: {len(inv_lines)}   |   Other Disc Amt: 0.00   |   Total Tax Amt: {_fmt_amount(total_tax)}", border=1, fill=True, align="L")
    pdf.cell(50, 5, f"Rs. {_fmt_amount(total_amount)} ", border=1, fill=True, align="R")
    pdf.ln()

    # 7. Tax Slabs Breakdown Grid & Right Summary Box
    y_grid = pdf.get_y()
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.cell(20, 4, "RATE%", border=1, align="C")
    pdf.cell(28, 4, "TAXABLE AMT", border=1, align="R")
    pdf.cell(24, 4, "CGST", border=1, align="R")
    pdf.cell(24, 4, "SGST", border=1, align="R")
    pdf.cell(28, 4, "TOTAL TAX", border=1, align="R")
    pdf.ln()

    pdf.set_font("Helvetica", "", 6.5)
    pdf.cell(20, 4, "18.00%", border=1, align="C")
    pdf.cell(28, 4, f"Rs. {_fmt_amount(subtotal)}", border=1, align="R")
    pdf.cell(24, 4, f"Rs. {_fmt_amount(cgst_amount)}", border=1, align="R")
    pdf.cell(24, 4, f"Rs. {_fmt_amount(sgst_amount)}", border=1, align="R")
    pdf.cell(28, 4, f"Rs. {_fmt_amount(total_tax)}", border=1, align="R")
    pdf.ln()

    # Words Line
    words_text = _number_to_indian_words(total_amount)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(124, 5, f" {words_text}", border=1, align="L")

    # Right Summary Box at x=134
    pdf.set_xy(134, y_grid)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.cell(66, 3.5, "Credit Adj : 0.00", border="LTR", align="R", ln=1)
    pdf.set_xy(134, y_grid + 3.5)
    pdf.cell(66, 3.5, "Round Off Amt : 0.00", border="LR", align="R", ln=1)
    pdf.set_xy(134, y_grid + 7)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.cell(66, 6, f"Net Amt Payable : Rs. {_fmt_amount(total_amount)} ", border="LBR", align="R", ln=1)

    # Statutory Declaration & Signature
    pdf.set_xy(12, pdf.get_y() + 2)
    pdf.set_font("Helvetica", "", 6)
    pdf.multi_cell(110, 2.8, "Statutory Declaration under FSS Act 2006:\nI/We hereby certify that food/foods mentioned in this invoice is/are warranted to be of the nature and quality which it/these purports to be.")

    pdf.set_xy(145, pdf.get_y() + 4)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(50, 4, "Authorized Signatory", align="C")

    raw = pdf.output()
    if isinstance(raw, str):
        return raw.encode("latin-1", errors="replace")
    return bytes(raw)


# ---------------------------------------------------------------------------
# Parle Brand Teal-Header GST Distributor Layout Engine
# ---------------------------------------------------------------------------

def _render_parle_pdf(invoice: Any, template: dict) -> bytes:
    """Render Parle Brand Teal-Header GST Distributor Template matching ParleDistributorTemplate.tsx."""
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=8)
    pdf.set_margins(10, 8, 10)
    pdf.add_page()

    store_name = _safe_text(template.get("storeName") or "TESTINGORG", 60)
    store_address = _safe_text(template.get("storeAddress") or "H.NO. 3-7-130, VAAVILALAPALLY KARIMNAGAR-505001", 120)
    store_phone = _safe_text(template.get("storePhone") or "", 30)
    store_email = _safe_text(template.get("storeEmail") or "", 40)
    gstin = _safe_text(template.get("gstin") or "36ABBFV0741M1Z0", 30)
    copy_type = _safe_text(getattr(invoice, "copy_type", None) or "ORIGINAL FOR RECIPIENT", 35)

    inv_number = _safe_text(getattr(invoice, "invoice_number", None) or "2026-2027-0007", 30)
    inv_date = _safe_text(str(getattr(invoice, "invoice_date", None) or date.today()), 20)
    if "-" in inv_date and len(inv_date.split("-")) == 3:
        p = inv_date.split("-")
        inv_date = f"{p[2]}/{p[1]}/{p[0]}" if len(p[0]) == 4 else inv_date

    due_date = _safe_text(str(getattr(invoice, "due_date", None) or getattr(invoice, "invoice_date", None) or date.today()), 20)
    if "-" in due_date and len(due_date.split("-")) == 3:
        p = due_date.split("-")
        due_date = f"{p[2]}/{p[1]}/{p[0]}" if len(p[0]) == 4 else due_date

    po_number = _safe_text(getattr(invoice, "po_number", None) or getattr(invoice, "order_number", None) or "-", 25)
    vehicle_number = _safe_text(getattr(invoice, "vehicle_number", None) or "-", 25)
    transporter = _safe_text(getattr(invoice, "transporter_name", None) or getattr(invoice, "driver_phone", None) or "Road", 25)

    cust_name = _safe_text(getattr(invoice, "customer_name", None) or "Nagi", 40)
    cust_phone = _safe_text(getattr(invoice, "customer_phone", None) or "", 25)
    cust_gstin = _safe_text(getattr(invoice, "customer_gstin", None) or "UNREGISTERED", 25)
    billing_addr = _safe_text(getattr(invoice, "billing_address", None) or "Andhra Pradesh", 100)
    shipping_addr = _safe_text(getattr(invoice, "shipping_address", None) or billing_addr, 100)
    payment_method = _safe_text(getattr(invoice, "payment_method", None) or "Cash", 20)

    total_amount = float(getattr(invoice, "total_amount", 0.0) or 0.0)
    subtotal = float(getattr(invoice, "subtotal", 0.0) or (total_amount / 1.18 if total_amount > 0 else 0.0))
    total_tax = float(getattr(invoice, "tax_amount", 0.0) or (total_amount - subtotal))
    cgst_amount = float(getattr(invoice, "cgst_amount", 0.0) or (total_tax / 2))
    sgst_amount = float(getattr(invoice, "sgst_amount", 0.0) or (total_tax / 2))
    igst_amount = float(getattr(invoice, "igst_amount", 0.0) or 0.0)

    # Outer Frame
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.5)
    pdf.rect(10, 8, 190, 277, style="D")

    # 1. Top Title Bar (Copy Type Badge, Center GST TAX INVOICE, Page No. 1)
    pdf.set_xy(11, 9)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(30, 58, 138)  # blue-900
    pdf.cell(50, 4.5, f"[{copy_type.upper()}]", border=0, align="L")

    pdf.set_xy(70, 9)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(70, 4.5, "GST TAX INVOICE", border=0, align="C")

    pdf.set_xy(145, 9)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(54, 4.5, "Page No. 1", border=0, align="R")

    pdf.line(10, 14.5, 200, 14.5)

    # 2. 3-Way Distributor Header
    # Left Column (x=10 to 73, width=63)
    pdf.set_xy(12, 16)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(15, 118, 110)  # teal-700
    pdf.cell(60, 4.5, store_name, ln=1)

    pdf.set_xy(12, 20.5)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(55, 65, 81)
    pdf.cell(60, 3, store_address[:45], ln=1)
    if len(store_address) > 45:
        pdf.set_xy(12, 23.5)
        pdf.cell(60, 3, store_address[45:90], ln=1)

    if store_phone:
        pdf.set_xy(12, 26.5)
        pdf.cell(60, 3, f"Phone : {store_phone}", ln=1)

    pdf.set_xy(12, 29.5)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(60, 3.5, f"GSTIN : {gstin}", ln=1)

    # Vertical Divider 1
    pdf.set_line_width(0.3)
    pdf.line(73, 14.5, 73, 34)

    # Center Column (x=73 to 137, width=64)
    # Red Boxed Store Name
    pdf.set_draw_color(239, 68, 68)  # red-500
    pdf.set_fill_color(254, 242, 242)  # red-50
    pdf.rect(83, 16, 44, 5.5, style="FD", round_corners=True, corner_radius=1)
    pdf.set_xy(83, 16.5)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(220, 38, 38)  # red-600
    pdf.cell(44, 4.5, store_name, align="C", ln=1)

    pdf.set_draw_color(0, 0, 0)
    pdf.set_xy(76, 23)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(24, 3, "PO / Order Ref :", ln=0)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.cell(34, 3, po_number, ln=1)

    pdf.set_xy(76, 26.5)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.cell(24, 3, "Vehicle No :", ln=0)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.cell(34, 3, vehicle_number, ln=1)

    pdf.set_xy(76, 30)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.cell(24, 3, "Transport :", ln=0)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.cell(34, 3, transporter, ln=1)

    # Vertical Divider 2
    pdf.line(137, 14.5, 137, 34)

    # Right Column: Customer Details (x=137 to 200, width=63)
    pdf.set_xy(140, 16)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(58, 3.5, f"M/s {cust_name}", ln=1)

    pdf.set_xy(140, 19.5)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(55, 65, 81)
    pdf.cell(58, 3, f"Bill To: {billing_addr[:35]}", ln=1)

    pdf.set_xy(140, 22.5)
    pdf.cell(58, 3, f"Ship To: {shipping_addr[:35]}", ln=1)

    if cust_phone:
        pdf.set_xy(140, 25.5)
        pdf.cell(58, 3, f"Ph.No.: {cust_phone}", ln=1)

    pdf.set_xy(140, 28.5)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(58, 3.5, f"GST : {cust_gstin}", ln=1)

    pdf.line(10, 34, 200, 34)

    # 3. Teal Invoice Accent Strip
    pdf.set_fill_color(15, 118, 110)  # teal-700
    pdf.rect(10.2, 34.2, 189.6, 6.6, style="F")

    pdf.set_xy(13, 35.5)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(40, 4, "GST INVOICE", ln=0)

    pdf.set_xy(60, 35.5)
    pdf.set_font("Helvetica", "", 7)
    meta_str = f"Invoice No. : {inv_number}   |   Date : {inv_date}   |   Due Date : {due_date}"
    pdf.cell(138, 4, meta_str, align="R", ln=1)

    pdf.line(10, 41, 200, 41)

    # 4. Parle Multi-Column Table Header
    cols_w = [6, 20, 50, 14, 11, 10, 14, 15, 11, 13, 13, 13]  # sum = 190
    cols_lbl = ["Sn.", "HSNCODE", "DESCRIPTION", "MRP", "QTY", "UOM", "RATE", "AMT", "DIS", "CGST%", "SGST%", "Amount"]

    pdf.set_fill_color(15, 118, 110)  # teal-700
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 6.5)

    pdf.set_xy(10, 41)
    for i, w in enumerate(cols_w):
        align = "L" if i == 2 else ("C" if i in (0, 1, 5) else "R")
        pdf.cell(w, 5, cols_lbl[i], border=1, fill=True, align=align)
    pdf.ln()

    # 5. Table Rows
    inv_lines = getattr(invoice, "lines", []) or []
    if not inv_lines:
        inv_lines = [
            type("DummyLine", (), {
                "product_name": "Standard Products & Services",
                "hsn_code": "19059020",
                "quantity": 1.0,
                "unit_price": subtotal,
                "discount_value": 0.0,
                "tax_rate": 18.0,
                "line_total": total_amount,
                "cgst_amount": cgst_amount,
                "sgst_amount": sgst_amount,
                "igst_amount": igst_amount,
            })()
        ]

    slabs = {
        0.0: {"taxable": 0.0, "cgst": 0.0, "sgst": 0.0, "total": 0.0},
        12.0: {"taxable": 0.0, "cgst": 0.0, "sgst": 0.0, "total": 0.0},
        18.0: {"taxable": 0.0, "cgst": 0.0, "sgst": 0.0, "total": 0.0},
        28.0: {"taxable": 0.0, "cgst": 0.0, "sgst": 0.0, "total": 0.0},
    }

    pdf.set_text_color(0, 0, 0)
    for idx, line in enumerate(inv_lines, start=1):
        p_name = _safe_text(getattr(line, "product_name", None) or f"Item {idx}", 45)
        hsn = _safe_text(getattr(line, "hsn_code", None) or "19059020", 12)
        qty = float(getattr(line, "quantity", 1.0) or 1.0)
        rate = float(getattr(line, "unit_price", 0.0) or 0.0)
        mrp = rate * 1.15 if rate > 0 else 0.0
        disc = float(getattr(line, "discount_value", 0.0) or 0.0)
        tax_rate = float(getattr(line, "tax_rate", 18.0) or 18.0)
        line_tot = float(getattr(line, "line_total", 0.0) or (qty * rate))
        gross = qty * rate
        taxable = gross - disc
        cgst_val = taxable * (tax_rate / 2.0) / 100.0
        sgst_val = taxable * (tax_rate / 2.0) / 100.0

        # Accumulate into slab
        matched_slab = 18.0
        for s in (0.0, 12.0, 18.0, 28.0):
            if abs(s - tax_rate) <= 1.0:
                matched_slab = s
                break
        slabs[matched_slab]["taxable"] += taxable
        slabs[matched_slab]["cgst"] += cgst_val
        slabs[matched_slab]["sgst"] += sgst_val
        slabs[matched_slab]["total"] += (cgst_val + sgst_val)

        # Row 1: Item Details
        pdf.set_font("Helvetica", "", 6.5)
        pdf.cell(cols_w[0], 4.5, str(idx), border="LR", align="C")
        pdf.set_font("Helvetica", "B", 6.5)
        pdf.cell(cols_w[1], 4.5, hsn, border="LR", align="C")
        pdf.cell(cols_w[2], 4.5, f" {p_name}", border="LR", align="L")
        pdf.set_font("Helvetica", "", 6.5)
        pdf.cell(cols_w[3], 4.5, _fmt_amount(mrp), border="LR", align="R")
        pdf.cell(cols_w[4], 4.5, f"{qty:.3f}", border="LR", align="C")
        pdf.cell(cols_w[5], 4.5, "NOS", border="LR", align="C")
        pdf.cell(cols_w[6], 4.5, _fmt_amount(rate), border="LR", align="R")
        pdf.cell(cols_w[7], 4.5, _fmt_amount(gross), border="LR", align="R")
        pdf.cell(cols_w[8], 4.5, _fmt_amount(disc), border="LR", align="R")
        pdf.cell(cols_w[9], 4.5, f"{tax_rate/2:.2f}", border="LR", align="R")
        pdf.cell(cols_w[10], 4.5, f"{tax_rate/2:.2f}", border="LR", align="R")
        pdf.set_font("Helvetica", "B", 6.5)
        pdf.cell(cols_w[11], 4.5, f"{_fmt_amount(line_tot)} ", border="LR", align="R")
        pdf.ln()

        # Row 2: GST Sub-line
        pdf.set_font("Helvetica", "", 6)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(cols_w[0] + cols_w[1] + cols_w[2], 3.8, f"   GST Breakdown: Taxable Rs. {_fmt_amount(taxable)}", border="LBR", align="L")
        pdf.cell(cols_w[3] + cols_w[4] + cols_w[5] + cols_w[6], 3.8, f"CGST @ {tax_rate/2:.1f}% = Rs. {_fmt_amount(cgst_val)}", border="LBR", align="R")
        pdf.cell(cols_w[7] + cols_w[8] + cols_w[9] + cols_w[10] + cols_w[11], 3.8, f"SGST @ {tax_rate/2:.1f}% = Rs. {_fmt_amount(sgst_val)} ", border="LBR", align="R")
        pdf.set_text_color(0, 0, 0)
        pdf.ln()

    # 6. Bottom Section: GST Class Breakdown Grid (Left) + Grand Total Card (Right)
    y_grid = pdf.get_y() + 2
    pdf.set_xy(10, y_grid)

    # Grid Header
    g_w = [18, 20, 14, 14, 16, 16, 20]  # sum = 118
    g_lbl = ["CLASS", "TOTAL", "SCH", "DISC.", "SGST", "CGST", "TOTAL GST"]

    pdf.set_fill_color(243, 244, 246)
    pdf.set_font("Helvetica", "B", 6)
    for i, w in enumerate(g_w):
        pdf.cell(w, 3.8, g_lbl[i], border=1, fill=True, align="C" if i == 0 else "R")
    pdf.ln()

    tot_g_taxable = sum(s["taxable"] for s in slabs.values()) or subtotal
    tot_g_sgst = sum(s["sgst"] for s in slabs.values()) or sgst_amount
    tot_g_cgst = sum(s["cgst"] for s in slabs.values()) or cgst_amount
    tot_g_tot = sum(s["total"] for s in slabs.values()) or total_tax

    # Slabs rows
    pdf.set_font("Helvetica", "", 6)
    for s_rate, s_data in slabs.items():
        pdf.cell(g_w[0], 3.5, f"GST {s_rate:.2f}", border=1, align="L")
        pdf.cell(g_w[1], 3.5, _fmt_amount(s_data["taxable"]), border=1, align="R")
        pdf.cell(g_w[2], 3.5, "0.00", border=1, align="R")
        pdf.cell(g_w[3], 3.5, "0.00", border=1, align="R")
        pdf.cell(g_w[4], 3.5, _fmt_amount(s_data["sgst"]), border=1, align="R")
        pdf.cell(g_w[5], 3.5, _fmt_amount(s_data["cgst"]), border=1, align="R")
        pdf.cell(g_w[6], 3.5, _fmt_amount(s_data["total"]), border=1, align="R")
        pdf.ln()

    # Total row
    pdf.set_font("Helvetica", "B", 6)
    pdf.cell(g_w[0], 3.8, "TOTAL", border=1, align="L")
    pdf.cell(g_w[1], 3.8, _fmt_amount(tot_g_taxable), border=1, align="R")
    pdf.cell(g_w[2], 3.8, "0.00", border=1, align="R")
    pdf.cell(g_w[3], 3.8, "0.00", border=1, align="R")
    pdf.cell(g_w[4], 3.8, _fmt_amount(tot_g_sgst), border=1, align="R")
    pdf.cell(g_w[5], 3.8, _fmt_amount(tot_g_cgst), border=1, align="R")
    pdf.cell(g_w[6], 3.8, _fmt_amount(tot_g_tot), border=1, align="R")
    pdf.ln()

    # Words Row
    words_text = _number_to_indian_words(total_amount)
    pdf.set_font("Helvetica", "I", 6.5)
    pdf.cell(118, 4.5, f" {words_text}", border=1, align="L")

    # Right Grand Total Box (x=132 to 200, width=68)
    pdf.set_fill_color(240, 253, 250)  # teal-50
    pdf.set_draw_color(15, 118, 110)  # teal-700
    pdf.set_line_width(0.4)
    pdf.rect(132, y_grid, 68, 23, style="FD", round_corners=True, corner_radius=1.5)

    pdf.set_xy(132, y_grid + 2)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(15, 118, 110)
    pdf.cell(68, 3.5, "GRAND TOTAL", align="C", ln=1)

    pdf.set_xy(132, y_grid + 7)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(68, 7, f"Rs. {_fmt_amount(total_amount)}", align="C", ln=1)

    pdf.set_xy(132, y_grid + 15)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(22, 163, 74)
    pdf.cell(68, 3.5, f"Payment Status : {'PAID' if (getattr(invoice, 'status', '') == 'paid' or total_amount <= 0) else 'CONFIRMED'}", align="C", ln=1)

    # 7. Terms & Conditions and Signature
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.3)
    y_terms = pdf.get_y() + 4
    pdf.set_xy(12, y_terms)
    pdf.set_font("Helvetica", "B", 6)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(110, 3, "Terms & Conditions", ln=1)
    pdf.set_xy(12, y_terms + 3)
    pdf.set_font("Helvetica", "", 5.5)
    pdf.set_text_color(75, 85, 99)
    pdf.cell(110, 2.8, "1. Goods once sold will not be taken back or exchanged.", ln=1)
    pdf.set_xy(12, y_terms + 5.8)
    pdf.cell(110, 2.8, "2. Bills not paid due date will attract 24% interest.", ln=1)

    # Signatures
    pdf.set_xy(90, y_terms + 8)
    pdf.set_font("Helvetica", "B", 6)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(40, 3, "Receiver Signature", align="C")

    pdf.set_xy(145, y_terms + 8)
    pdf.cell(50, 3, f"FOR {store_name}", align="C")
    pdf.set_xy(145, y_terms + 12)
    pdf.set_font("Helvetica", "", 6)
    pdf.cell(50, 3, "Authorized Signatory", align="C")

    raw = pdf.output()
    if isinstance(raw, str):
        return raw.encode("latin-1", errors="replace")
    return bytes(raw)


# ---------------------------------------------------------------------------
# Main Router: Dispatch to Selected Theme Engine
# ---------------------------------------------------------------------------

def render_invoice_pdf(invoice: Any, template: dict) -> bytes:
    """Render an Invoice ORM instance into an exact PDF according to template theme."""
    assert template, "A print template dict is required for invoice PDF rendering"

    theme_name = str(template.get("themeName") or template.get("name") or template.get("id") or "").lower()

    if "parle" in theme_name or "teal" in theme_name:
        return _render_parle_pdf(invoice, template)

    if "fmcg" in theme_name or "food" in theme_name:
        return _render_fmcg_pdf(invoice, template)

    # Default to Stylish / High-Fidelity Modern A4 Template
    return _render_stylish_pdf(invoice, template)


def _render_stylish_pdf(invoice: Any, template: dict) -> bytes:
    """Render Stylish / High-Fidelity Card-Based A4 Invoice Template."""

    # Theme & Styling Tokens
    theme_name = str(template.get("themeName") or template.get("name") or "").lower()
    custom_color = template.get("primaryColor")
    if custom_color and custom_color.startswith("#"):
        primary_rgb = _hex_to_rgb(custom_color)
    elif "parle" in theme_name or "teal" in theme_name:
        primary_rgb = _hex_to_rgb("#0f766e")  # Teal 700 (Parle Distributor)
    elif "agri" in theme_name or "seed" in theme_name:
        primary_rgb = _hex_to_rgb("#15803d")  # Green 700 (Agri Seeds)
    elif "fmcg" in theme_name or "food" in theme_name:
        primary_rgb = _hex_to_rgb("#0369a1")  # Sky 700 (FMCG Distributor)
    elif "marg" in theme_name or "pharma" in theme_name:
        primary_rgb = _hex_to_rgb("#1e40af")  # Royal Blue 800 (Marg Pharma)
    elif "luxury" in theme_name:
        primary_rgb = _hex_to_rgb("#b45309")  # Amber 700 (Luxury)
    elif "tally" in theme_name:
        primary_rgb = _hex_to_rgb("#0f172a")  # Dark Slate 900 (Tally)
    elif "adv" in theme_name:
        primary_rgb = _hex_to_rgb("#16a34a")  # Green 600 (Advanced GST)
    elif "modern" in theme_name:
        primary_rgb = _hex_to_rgb("#475569")  # Slate 600 (Modern)
    else:
        primary_rgb = _hex_to_rgb("#2563eb")  # Brand Blue 600 (Stylish)

    header_title = _safe_text(template.get("headerTitle") or "TAX INVOICE", 40)
    store_name = _safe_text(template.get("storeName") or "venatic", 60)
    legal_name = _safe_text(template.get("legalName") or "AUTHORIZED BUSINESS ORGANIZATION", 60)
    store_address = _safe_text(template.get("storeAddress") or "", 120)
    store_phone = _safe_text(template.get("storePhone") or "", 40)
    store_email = _safe_text(template.get("storeEmail") or "", 60)
    gstin = _safe_text(template.get("gstin") or "", 30)
    terms_text = _safe_text(template.get("termsText") or "1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only.", 500)
    footer_text = _safe_text(template.get("footerText") or f"Thank you for shopping at {store_name}!", 200)
    copy_type = _safe_text(getattr(invoice, "copy_type", None) or "ORIGINAL FOR RECIPIENT", 40)

    # Customer & Supply State
    cust_name = _safe_text(getattr(invoice, "customer_name", None) or "Walk-in Customer", 50)
    cust_phone = _safe_text(getattr(invoice, "customer_phone", None) or "", 30)
    cust_email = _safe_text(getattr(invoice, "customer_email", None) or "", 50)
    cust_gstin = _safe_text(getattr(invoice, "customer_gstin", None) or "", 30)
    billing_addr = _safe_text(getattr(invoice, "billing_address", None) or "Andhra Pradesh", 150)
    shipping_addr = _safe_text(getattr(invoice, "shipping_address", None) or billing_addr, 150)

    seller_state_name, seller_state_code = _resolve_state(gstin, store_address)
    cust_state_name, cust_state_code = _resolve_state(cust_gstin, billing_addr)
    is_interstate = bool(cust_state_code and seller_state_code and cust_state_code != seller_state_code)

    # Invoice Meta
    inv_number = _safe_text(getattr(invoice, "invoice_number", None) or "INV-0001", 30)
    inv_date = _safe_text(str(getattr(invoice, "invoice_date", None) or date.today()), 20)
    if "-" in inv_date and len(inv_date.split("-")) == 3:
        parts = inv_date.split("-")
        inv_date = f"{parts[2]}/{parts[1]}/{parts[0]}" if len(parts[0]) == 4 else inv_date

    # Amounts & Balances
    total_amount = float(getattr(invoice, "total_amount", 0.0) or 0.0)
    subtotal = float(getattr(invoice, "subtotal", 0.0) or (total_amount / 1.18 if total_amount > 0 else 0.0))
    discount_amount = float(getattr(invoice, "discount_amount", 0.0) or 0.0)
    cgst_amount = float(getattr(invoice, "cgst_amount", 0.0) or 0.0)
    sgst_amount = float(getattr(invoice, "sgst_amount", 0.0) or 0.0)
    igst_amount = float(getattr(invoice, "igst_amount", 0.0) or 0.0)
    amount_paid = float(getattr(invoice, "amount_paid", 0.0) or getattr(invoice, "amount_received", 0.0) or total_amount)
    balance_due = float(getattr(invoice, "balance_due", 0.0) or max(0.0, total_amount - amount_paid))
    is_paid = (getattr(invoice, "status", "") or "").lower() == "paid" or (amount_paid >= (total_amount - 0.05) and total_amount > 0)
    payment_method = _safe_text(getattr(invoice, "payment_method", None) or "Cash", 20)

    # ── Initialize PDF (A4 Portrait, 210 x 297 mm, 10mm margins) ────────
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.set_margins(10, 8, 10)
    pdf.add_page()

    # 1. Top Decorative Brand Bar
    pdf.set_fill_color(*primary_rgb)
    pdf.rect(10, 8, 190, 2, style="F")

    # 2. HEADER SECTION (Left: Logo + Org, Right: Copy Type + Title + Meta Card)
    y_hdr = 14
    pdf.set_xy(10, y_hdr)

    # Logo / Brand Box
    logo_path = _find_logo_path(template.get("logoUrl"))
    has_logo = False
    if logo_path:
        try:
            pdf.image(logo_path, x=10, y=y_hdr, w=13)
            has_logo = True
        except Exception:
            has_logo = False

    org_x = 25 if has_logo else 10
    pdf.set_xy(org_x, y_hdr)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)  # slate-900
    pdf.cell(100, 5, store_name, ln=1)

    pdf.set_xy(org_x, y_hdr + 5.5)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(100, 116, 139)  # slate-500
    pdf.cell(100, 3.5, legal_name.upper(), ln=1)

    if store_address:
        pdf.set_xy(org_x, y_hdr + 9)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(71, 85, 105)  # slate-600
        pdf.cell(100, 3.5, store_address, ln=1)

    contact_parts = []
    if store_phone:
        contact_parts.append(f"Ph: {store_phone}")
    if store_email:
        contact_parts.append(f"Email: {store_email}")
    if contact_parts:
        pdf.set_xy(org_x, y_hdr + 12.5)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(100, 3.5, "  |  ".join(contact_parts), ln=1)

    if gstin:
        pdf.set_xy(org_x, y_hdr + 16)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(100, 3.5, f"GSTIN: {gstin}", ln=1)

    # Right Header (Badge + Title + Meta Box)
    # Copy Type Badge
    badge_w = 48
    badge_x = 200 - badge_w
    pdf.set_fill_color(241, 245, 249)  # slate-100
    pdf.set_draw_color(203, 213, 225)  # slate-300
    pdf.rect(badge_x, y_hdr - 1, badge_w, 4.5, style="FD", round_corners=True, corner_radius=1)
    pdf.set_xy(badge_x, y_hdr - 1)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(30, 41, 59)  # slate-800
    pdf.cell(badge_w, 4.5, copy_type.upper(), align="C", ln=1)

    # Title: TAX INVOICE
    pdf.set_xy(110, y_hdr + 4.5)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(*primary_rgb)
    pdf.cell(90, 6, header_title, align="R", ln=1)

    # Meta Box (Invoice No & Date)
    meta_box_w = 58
    meta_box_x = 200 - meta_box_w
    pdf.set_fill_color(248, 250, 252)  # slate-50
    pdf.set_draw_color(226, 232, 240)  # slate-200
    pdf.rect(meta_box_x, y_hdr + 11.5, meta_box_w, 11, style="FD", round_corners=True, corner_radius=1.5)

    pdf.set_xy(meta_box_x + 3, y_hdr + 12.5)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(meta_box_w - 6, 4, f"Invoice No: {inv_number}", align="R", ln=1)

    pdf.set_xy(meta_box_x + 3, y_hdr + 17)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(meta_box_w - 6, 4, f"Date: {inv_date}", align="R", ln=1)

    # 3. DIVIDER LINE
    y_div = y_hdr + 25.5
    pdf.set_draw_color(*primary_rgb)
    pdf.set_line_width(0.3)
    pdf.line(10, y_div, 200, y_div)

    # 4. CUSTOMER / DELIVERY / SUPPLY 3-COLUMN CARD
    y_card = y_div + 2.5
    card_h = 24
    pdf.set_fill_color(248, 250, 252)  # slate-50
    pdf.set_draw_color(226, 232, 240)  # slate-200
    pdf.rect(10, y_card, 190, card_h, style="FD", round_corners=True, corner_radius=2)

    # Column 1: Billed To
    c1_x = 13
    pdf.set_xy(c1_x, y_card + 2)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(148, 163, 184)  # slate-400
    pdf.cell(56, 3, "BILLED TO (CUSTOMER DETAILS)", ln=1)

    pdf.set_xy(c1_x, y_card + 5.5)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(56, 4, cust_name, ln=1)

    pdf.set_xy(c1_x, y_card + 9.5)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(56, 3.5, billing_addr, ln=1)

    if cust_phone:
        pdf.set_xy(c1_x, y_card + 13)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(56, 3.5, f"Ph: {cust_phone}", ln=1)

    if cust_gstin:
        pdf.set_xy(c1_x, y_card + 16.5)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(56, 3.5, f"GSTIN: {cust_gstin}", ln=1)

    # Col 1 | Col 2 Divider
    pdf.set_draw_color(226, 232, 240)
    pdf.line(73, y_card + 2, 73, y_card + card_h - 2)

    # Column 2: Shipped To
    c2_x = 76
    pdf.set_xy(c2_x, y_card + 2)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(99, 102, 241)  # indigo-500
    pdf.cell(56, 3, "SHIPPED TO (DELIVERY DESTINATION)", ln=1)

    pdf.set_xy(c2_x, y_card + 5.5)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(56, 4, cust_name, ln=1)

    pdf.set_xy(c2_x, y_card + 9.5)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(56, 3.5, shipping_addr, ln=1)

    if cust_phone:
        pdf.set_xy(c2_x, y_card + 13)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(56, 3.5, f"Contact: {cust_phone}", ln=1)

    # Col 2 | Col 3 Divider
    pdf.line(137, y_card + 2, 137, y_card + card_h - 2)

    # Column 3: Place of Supply
    c3_x = 140
    pdf.set_xy(c3_x, y_card + 2)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(56, 3, "PLACE OF SUPPLY", ln=1)

    supply_text = f"{cust_state_name} ({cust_state_code}) - {'Inter-State' if is_interstate else 'Intra-State'}"
    pdf.set_xy(c3_x, y_card + 6)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.set_text_color(30, 41, 59)
    pdf.multi_cell(56, 3.5, supply_text)

    # 5. LINE ITEMS TABLE
    y_tbl = y_card + card_h + 3
    col_w = [8, 62, 18, 12, 22, 18, 22, 28]  # Sum = 190 mm
    col_labels = ["#", "ITEM DESCRIPTION", "HSN/SAC", "QTY", "UNIT RATE", "DISCOUNT", "TAX RATE", "AMOUNT"]
    col_align = ["C", "L", "C", "C", "R", "R", "R", "R"]

    # Table Header Bar
    pdf.set_xy(10, y_tbl)
    pdf.set_fill_color(*primary_rgb)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 7)
    for i, w in enumerate(col_w):
        pdf.cell(w, 6.5, col_labels[i], border=0, fill=True, align=col_align[i])
    pdf.ln()

    # Table Rows
    inv_lines = getattr(invoice, "lines", []) or []
    if not inv_lines:
        # Synthesize fallback lines from total if no lines relationship
        inv_lines = [
            type("DummyLine", (), {
                "product_name": "Standard Products & Services",
                "hsn_code": "9988",
                "quantity": 1.0,
                "unit_price": subtotal,
                "discount_value": 0.0,
                "discount_type": "fixed",
                "tax_rate": 18.0,
                "line_total": total_amount,
                "cgst_amount": cgst_amount,
                "sgst_amount": sgst_amount,
                "igst_amount": igst_amount,
            })()
        ]

    # Slab Aggregators for GST Breakdown Table
    slabs_map: dict[float, dict[str, float]] = {}

    y_cur = pdf.get_y()
    for idx, line in enumerate(inv_lines, start=1):
        p_name = _safe_text(getattr(line, "product_name", None) or f"Item {idx}", 45)
        hsn = _safe_text(getattr(line, "hsn_code", None) or "9988", 10)
        qty = float(getattr(line, "quantity", 1.0) or 1.0)
        unit_price = float(getattr(line, "unit_price", 0.0) or 0.0)
        disc_val = float(getattr(line, "discount_value", 0.0) or 0.0)
        tax_rate = float(getattr(line, "tax_rate", 18.0) or 18.0)
        line_tot = float(getattr(line, "line_total", 0.0) or (qty * unit_price))

        # Accumulate into slab map
        taxable_val = (qty * unit_price) - disc_val
        if tax_rate not in slabs_map:
            slabs_map[tax_rate] = {"taxable": 0.0, "cgst": 0.0, "sgst": 0.0, "igst": 0.0, "hsn": hsn}
        slabs_map[tax_rate]["taxable"] += taxable_val
        if is_interstate:
            slabs_map[tax_rate]["igst"] += (taxable_val * tax_rate / 100.0)
        else:
            slabs_map[tax_rate]["cgst"] += (taxable_val * (tax_rate / 2.0) / 100.0)
            slabs_map[tax_rate]["sgst"] += (taxable_val * (tax_rate / 2.0) / 100.0)

        # Draw row
        row_bg = (248, 250, 252) if idx % 2 == 0 else (255, 255, 255)
        pdf.set_fill_color(*row_bg)
        pdf.set_draw_color(241, 245, 249)

        pdf.set_font("Helvetica", "B" if idx == 1 else "", 7.5)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(col_w[0], 6, str(idx), border="B", fill=True, align="C")

        pdf.set_text_color(15, 23, 42)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.cell(col_w[1], 6, f" {p_name}", border="B", fill=True, align="L")

        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(col_w[2], 6, hsn, border="B", fill=True, align="C")

        pdf.set_font("Helvetica", "B", 7.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(col_w[3], 6, str(int(qty) if qty.is_integer() else f"{qty:.2f}"), border="B", fill=True, align="C")

        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(col_w[4], 6, f"Rs. {_fmt_amount(unit_price)}", border="B", fill=True, align="R")

        pdf.set_text_color(16, 185, 129)  # emerald-500
        disc_text = f"-Rs. {_fmt_amount(disc_val)}" if disc_val > 0 else "-"
        pdf.cell(col_w[5], 6, disc_text, border="B", fill=True, align="R")

        pdf.set_text_color(71, 85, 105)
        tax_rate_str = f"{tax_rate:.0f}% ({tax_rate/2:.0f}%+{tax_rate/2:.0f}%)" if not is_interstate else f"{tax_rate:.0f}% IGST"
        pdf.cell(col_w[6], 6, tax_rate_str, border="B", fill=True, align="R")

        pdf.set_font("Helvetica", "B", 7.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(col_w[7], 6, f"Rs. {_fmt_amount(line_tot)} ", border="B", fill=True, align="R")
        pdf.ln()

    # 6. GST TAX BREAKDOWN TABLE (Product & Slab Wise)
    pdf.ln(2.5)
    y_gst = pdf.get_y()

    # GST Table Banner Header
    pdf.set_fill_color(241, 245, 249)
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(10, y_gst, 190, 5, style="FD")

    pdf.set_xy(12, y_gst)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(30, 41, 59)
    breakdown_title = f"GST TAX BREAKDOWN (PRODUCT & SLAB WISE)   {'INTRA-STATE (CGST + SGST)' if not is_interstate else 'INTER-STATE (IGST)'}"
    pdf.cell(120, 5, breakdown_title, ln=0)

    pdf.set_xy(135, y_gst)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(63, 5, f"Supply: {cust_state_name} ({cust_state_code})", align="R", ln=1)

    # Column Subheaders
    gst_cols_w = [32, 26, 20, 26, 20, 26, 40] if not is_interstate else [45, 35, 30, 40, 40]
    gst_cols_lbl = (
        ["HSN / SAC", "Taxable Value", "CGST Rate", "CGST Amount", "SGST Rate", "SGST Amount", "Total Tax"]
        if not is_interstate else
        ["HSN / SAC", "Taxable Value", "IGST Rate", "IGST Amount", "Total Tax"]
    )

    pdf.set_fill_color(248, 250, 252)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(71, 85, 105)
    for i, w in enumerate(gst_cols_w):
        align = "L" if i == 0 else "R"
        pdf.cell(w, 4.5, gst_cols_lbl[i], border=1, fill=True, align=align)
    pdf.ln()

    tot_taxable = 0.0
    tot_cgst = 0.0
    tot_sgst = 0.0
    tot_igst = 0.0

    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(15, 23, 42)
    for rate, sdata in slabs_map.items():
        s_taxable = sdata["taxable"]
        s_cgst = sdata["cgst"]
        s_sgst = sdata["sgst"]
        s_igst = sdata["igst"]
        s_tot_tax = s_igst if is_interstate else (s_cgst + s_sgst)

        tot_taxable += s_taxable
        tot_cgst += s_cgst
        tot_sgst += s_sgst
        tot_igst += s_igst

        if not is_interstate:
            pdf.cell(gst_cols_w[0], 4.5, f" {sdata['hsn']} ({rate:.0f}%)", border=1, align="L")
            pdf.cell(gst_cols_w[1], 4.5, f"Rs. {_fmt_amount(s_taxable)}", border=1, align="R")
            pdf.cell(gst_cols_w[2], 4.5, f"{rate/2:.0f}%", border=1, align="R")
            pdf.cell(gst_cols_w[3], 4.5, f"Rs. {_fmt_amount(s_cgst)}", border=1, align="R")
            pdf.cell(gst_cols_w[4], 4.5, f"{rate/2:.0f}%", border=1, align="R")
            pdf.cell(gst_cols_w[5], 4.5, f"Rs. {_fmt_amount(s_sgst)}", border=1, align="R")
            pdf.cell(gst_cols_w[6], 4.5, f"Rs. {_fmt_amount(s_tot_tax)} ", border=1, align="R")
        else:
            pdf.cell(gst_cols_w[0], 4.5, f" {sdata['hsn']} ({rate:.0f}%)", border=1, align="L")
            pdf.cell(gst_cols_w[1], 4.5, f"Rs. {_fmt_amount(s_taxable)}", border=1, align="R")
            pdf.cell(gst_cols_w[2], 4.5, f"{rate:.0f}%", border=1, align="R")
            pdf.cell(gst_cols_w[3], 4.5, f"Rs. {_fmt_amount(s_igst)}", border=1, align="R")
            pdf.cell(gst_cols_w[4], 4.5, f"Rs. {_fmt_amount(s_tot_tax)} ", border=1, align="R")
        pdf.ln()

    # Total Row
    pdf.set_fill_color(241, 245, 249)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(15, 23, 42)
    if not is_interstate:
        pdf.cell(gst_cols_w[0], 4.5, " Total", border=1, fill=True, align="L")
        pdf.cell(gst_cols_w[1], 4.5, f"Rs. {_fmt_amount(tot_taxable or subtotal)}", border=1, fill=True, align="R")
        pdf.cell(gst_cols_w[2], 4.5, "-", border=1, fill=True, align="R")
        pdf.cell(gst_cols_w[3], 4.5, f"Rs. {_fmt_amount(tot_cgst or cgst_amount)}", border=1, fill=True, align="R")
        pdf.cell(gst_cols_w[4], 4.5, "-", border=1, fill=True, align="R")
        pdf.cell(gst_cols_w[5], 4.5, f"Rs. {_fmt_amount(tot_sgst or sgst_amount)}", border=1, fill=True, align="R")
        pdf.cell(gst_cols_w[6], 4.5, f"Rs. {_fmt_amount((tot_cgst + tot_sgst) or (cgst_amount + sgst_amount))} ", border=1, fill=True, align="R")
    else:
        pdf.cell(gst_cols_w[0], 4.5, " Total", border=1, fill=True, align="L")
        pdf.cell(gst_cols_w[1], 4.5, f"Rs. {_fmt_amount(tot_taxable or subtotal)}", border=1, fill=True, align="R")
        pdf.cell(gst_cols_w[2], 4.5, "-", border=1, fill=True, align="R")
        pdf.cell(gst_cols_w[3], 4.5, f"Rs. {_fmt_amount(tot_igst or igst_amount)}", border=1, fill=True, align="R")
        pdf.cell(gst_cols_w[4], 4.5, f"Rs. {_fmt_amount(tot_igst or igst_amount)} ", border=1, fill=True, align="R")
    pdf.ln()

    # 7. BOTTOM SECTION (Left: Paid Badge + Terms + Google Review, Right: Summary Card)
    pdf.ln(3)
    y_bot = pdf.get_y()

    # Left Column (Width = 108 mm)
    # Paid In Full Badge
    if is_paid:
        pdf.set_fill_color(236, 253, 245)  # emerald-50
        pdf.set_draw_color(167, 243, 208)  # emerald-200
        pdf.rect(10, y_bot, 105, 7.5, style="FD", round_corners=True, corner_radius=1.5)

        pdf.set_xy(13, y_bot + 1.2)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.set_text_color(6, 95, 70)  # emerald-800
        pdf.cell(32, 5, "[PAID IN FULL]", ln=0)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(4, 120, 87)
        pdf.cell(60, 5, f" - Payment received via {payment_method}", ln=1)

    y_terms = y_bot + (9.5 if is_paid else 0)

    # Terms & Conditions
    pdf.set_xy(10, y_terms)
    pdf.set_font("Helvetica", "B", 6.5)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(105, 3.5, "TERMS & CONDITIONS", ln=1)

    pdf.set_xy(10, y_terms + 3.5)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(100, 116, 139)
    pdf.multi_cell(105, 3, terms_text)

    # Google Review 5-Star Card
    y_review = pdf.get_y() + 2.5
    pdf.set_fill_color(255, 251, 235)  # amber-50
    pdf.set_draw_color(253, 230, 138)  # amber-200
    pdf.rect(10, y_review, 105, 12, style="FD", round_corners=True, corner_radius=1.5)

    pdf.set_xy(13, y_review + 1.5)
    pdf.set_font("Helvetica", "B", 7.5)
    pdf.set_text_color(217, 119, 6)  # amber-600
    pdf.cell(100, 3.5, "* * * * *   LOVED OUR SERVICE? RATE US ON GOOGLE!", ln=1)

    pdf.set_xy(13, y_review + 5.5)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(100, 3.5, "Scan with your phone camera to share your 5-star review.", ln=1)

    # Right Column: Totals Summary Card (Width = 78 mm at x=122)
    sum_x = 122
    sum_w = 78
    sum_h = 38
    pdf.set_fill_color(248, 250, 252)  # slate-50
    pdf.set_draw_color(226, 232, 240)  # slate-200
    pdf.rect(sum_x, y_bot, sum_w, sum_h, style="FD", round_corners=True, corner_radius=2)

    def _summary_row(y_pos: float, lbl: str, val: str, bold: bool = False, color: tuple[int, int, int] = (71, 85, 105)) -> None:
        pdf.set_xy(sum_x + 3, y_pos)
        pdf.set_font("Helvetica", "B" if bold else "", 7.5)
        pdf.set_text_color(*color)
        pdf.cell(38, 4, lbl, align="L")
        pdf.cell(34, 4, val, align="R")

    r_y = y_bot + 2
    _summary_row(r_y, "Taxable Subtotal:", f"Rs. {_fmt_amount(subtotal)}", bold=True, color=(15, 23, 42))

    if discount_amount > 0:
        r_y += 4
        _summary_row(r_y, "Discount Savings:", f"-Rs. {_fmt_amount(discount_amount)}", color=(16, 185, 129))

    if not is_interstate:
        r_y += 4
        _summary_row(r_y, f"CGST ({(tax_rate/2 if 'tax_rate' in locals() else 9):.0f}%):", f"Rs. {_fmt_amount(cgst_amount or tot_cgst)}")
        r_y += 4
        _summary_row(r_y, f"SGST ({(tax_rate/2 if 'tax_rate' in locals() else 9):.0f}%):", f"Rs. {_fmt_amount(sgst_amount or tot_sgst)}")
    else:
        r_y += 4
        _summary_row(r_y, f"IGST ({(tax_rate if 'tax_rate' in locals() else 18):.0f}%):", f"Rs. {_fmt_amount(igst_amount or tot_igst)}")

    # Divider before Grand Total
    r_y += 4.5
    pdf.set_draw_color(*primary_rgb)
    pdf.set_line_width(0.4)
    pdf.line(sum_x + 3, r_y, sum_x + sum_w - 3, r_y)

    r_y += 1.5
    _summary_row(r_y, "GRAND TOTAL:", f"Rs. {_fmt_amount(total_amount)}", bold=True, color=(15, 23, 42))

    r_y += 4.5
    _summary_row(r_y, "Amount Received:", f"Rs. {_fmt_amount(amount_paid)}", bold=True, color=(22, 163, 74))

    r_y += 4
    _summary_row(r_y, "Payment Status:", "PAID" if is_paid else f"DUE (Rs. {_fmt_amount(balance_due)})", bold=True, color=(22, 163, 74) if is_paid else (220, 38, 38))

    # 8. SIGNATURE AND FOOTER
    y_sig = max(y_review + 16, y_bot + sum_h + 4)
    if y_sig < 275:
        # Signature
        pdf.set_draw_color(148, 163, 184)
        pdf.set_line_width(0.2)
        pdf.line(145, y_sig + 6, 195, y_sig + 6)

        pdf.set_xy(145, y_sig + 7)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(50, 4, "Authorized Signatory", align="C")

        # Footer Text
        if footer_text:
            pdf.set_xy(10, y_sig + 6)
            pdf.set_font("Helvetica", "I", 7)
            pdf.set_text_color(148, 163, 184)
            pdf.cell(100, 4, footer_text, align="L")

    # Output bytes
    raw = pdf.output()
    if isinstance(raw, str):
        return raw.encode("latin-1", errors="replace")
    return bytes(raw)


# ---------------------------------------------------------------------------
# File helpers (Tenant-scoped storage & lookup)
# ---------------------------------------------------------------------------

def get_invoice_pdf_path(invoice: Any) -> Path:
    """Return the resolved disk path for an invoice PDF scoped by tenant_id."""
    tenant_id = str(getattr(invoice, "tenant_id", "") or "").strip()
    safe_number = "".join(
        c if c.isalnum() or c in "-_" else "_"
        for c in (getattr(invoice, "invoice_number", None) or str(uuid.uuid4()))
    )
    if tenant_id:
        tenant_dir = INVOICE_PDF_DIR / tenant_id
        tenant_dir.mkdir(parents=True, exist_ok=True)
        return tenant_dir / f"{safe_number}.pdf"
    return INVOICE_PDF_DIR / f"{safe_number}.pdf"


def save_invoice_pdf(invoice: Any, template: dict) -> Path:
    """Render invoice PDF with template and persist to disk scoped by tenant_id."""
    pdf_bytes = render_invoice_pdf(invoice, template)
    file_path = get_invoice_pdf_path(invoice)
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(pdf_bytes)

        # Also write flat copy with tenant prefix if tenant is present
        tenant_id = str(getattr(invoice, "tenant_id", "") or "").strip()
        safe_number = "".join(
            c if c.isalnum() or c in "-_" else "_"
            for c in (getattr(invoice, "invoice_number", None) or str(uuid.uuid4()))
        )
        if tenant_id:
            try:
                (INVOICE_PDF_DIR / f"{tenant_id}_{safe_number}.pdf").write_bytes(pdf_bytes)
            except Exception:
                pass
        try:
            (INVOICE_PDF_DIR / f"{safe_number}.pdf").write_bytes(pdf_bytes)
        except Exception:
            pass

        logger.info("Saved invoice PDF to %s (%d bytes)", file_path, len(pdf_bytes))
        return file_path
    except Exception as exc:
        logger.warning("Could not persist invoice PDF to disk (%s): %s", file_path, exc)
        return file_path


def render_invoice_pdf_b64(invoice: Any, template: dict) -> str:
    """Render invoice PDF with template and return base64 string."""
    pdf_bytes = render_invoice_pdf(invoice, template)
    return base64.b64encode(pdf_bytes).decode("ascii")

