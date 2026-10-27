"""Receipt & invoice PDF rendering for the billing service.

Ported and adapted from the retail monolith's ``services/invoice_pdf.py``
(fpdf2-based, 2549 LOC). The restaurant side keeps only what a POS and its
A4 invoices actually need:

  * ``render_thermal_receipt`` — 80mm / 58mm thermal rolls, per-field toggles
    from a ``PrintTemplate.fields`` JSONB row, dashed dividers, INR amounts,
    UPI QR when the template carries a VPA.
  * ``render_invoice_a4`` — A4 GST invoice: store block, item table, CGST/
    SGST or IGST split, amount-in-words, and the e-invoice QR when the row
    has one.
  * ``escpos_receipt_bytes`` — raw ESC/POS byte stream (no printer
    instance, no network): init, centring, two font sizes, dashed rules,
    ``GS ( k`` UPI QR, tear-off.
  * ``receipt_from_bill`` — assemble the print payload from the billing
    service's own Bill + BillItem rows.

Fonts: fpdf2's core fonts cannot encode "₹", so if a TTF is found on the
host it is embedded (aptos on Windows, DejaVu on Linux); otherwise amounts
degrade to "Rs." — printed digits, never a broken glyph.

Porting note: the source renders ``invoice`` ORM objects via ``getattr``;
this one takes plain dicts (the API layer serialises the row first) so the
PDF code stays a pure function of data.
"""
from __future__ import annotations

import io
import logging
import os
import re
import uuid as _uuid
from datetime import datetime
from decimal import Decimal
from urllib.parse import quote

logger = logging.getLogger("billing.receipt_pdf")

# ─── Fonts ───────────────────────────────────────────────────────────────────

_FONT_CANDIDATES = (
    # (regular, bold, italic) — Windows ships these with every office install.
    ("apto.ttf", "aptob.ttf", "aptobi.ttf"),
    ("arial.ttf", "arialbd.ttf", "ariali.ttf"),
    ("calibri.ttf", "calibrib.ttf", "calibrii.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
     "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
     "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"),
)


def _host_font_dirs() -> list[str]:
    dirs = [d for d in os.environ.get("RESTAURANTOS_FONT_DIR", "").split(os.pathsep) if d]
    dirs += [
        os.path.join(os.environ.get("SystemRoot", "C:\\Windows"), "Fonts"),
        os.path.join(os.environ.get("windir", "C:\\Windows"), "Fonts"),
        "/usr/share/fonts/truetype/dejavu",
        "/usr/share/fonts/truetype/liberation",
    ]
    return dirs


def _register_fonts(pdf) -> str:
    """Embed a host TTF when one is reachable; else the ASCII fallback.

    Returns the font name the caller should use for every cell: ``Aptos``/
    ``Arial``/``DejaVu``... when embedded, ``Helvetica`` when not. The pdf
    object is the caller's; embedding once per document is fine.
    """
    for reg, bold, italic in _FONT_CANDIDATES:
        found = None
        for d in _host_font_dirs():
            candidate = os.path.join(d, reg)
            if os.path.isfile(candidate):
                found = candidate
                break
        if not found:
            continue
        try:
            pdf.add_font("Aptos", "", found)
            if bold and os.path.isfile(os.path.join(os.path.dirname(found), bold)):
                pdf.add_font("Aptos", "B", os.path.join(os.path.dirname(found), bold))
            else:
                pdf.add_font("Aptos", "B", found)
            if italic and os.path.isfile(os.path.join(os.path.dirname(found), italic)):
                pdf.add_font("Aptos", "I", os.path.join(os.path.dirname(found), italic))
            else:
                pdf.add_font("Aptos", "I", found)
            return "Aptos"
        except Exception as exc:
            logger.debug("Could not embed font %s: %s", found, exc)
            break
    return "Helvetica"


def _rupee(pdf_font: str) -> str:
    """The rupee marker: "₹" only when the font can actually print it."""
    return "₹" if pdf_font != "Helvetica" else "Rs."


# ─── Amount in words ─────────────────────────────────────────────────────────

_UNITS = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _number_to_indian_words(num) -> str:
    """Indian-grouping amount in words: 1,00,000.50 -> "One Lakh ... Paise Fifty"."""
    total = Decimal(str(num or 0)).quantize(Decimal("0.01"))
    rupees = int(total)
    paise = int(round((total - rupees) * 100))
    if rupees < 0:
        return "NEGATIVE " + _number_to_indian_words(-num).upper()

    def _two(val: int) -> str:
        if val < 20:
            return _UNITS[val]
        return f"{_TENS[val // 10]} {_UNITS[val % 10]}".strip()

    def _three(val: int) -> str:
        parts = []
        if val // 100:
            parts.append(f"{_UNITS[val // 100]} Hundred")
        rem = val % 100
        if rem:
            parts.append(_two(rem))
        return " ".join(parts).strip()

    words: list[str] = []
    n = rupees
    crore, n = divmod(n, 10_000_000)
    if crore:
        words.append(f"{_three(crore)} Crore")
    lakh, n = divmod(n, 100_000)
    if lakh:
        words.append(f"{_three(lakh)} Lakh")
    thousand, n = divmod(n, 1000)
    if thousand:
        words.append(f"{_three(thousand)} Thousand")
    if n:
        words.append(_three(n))

    if not rupees and not paise:
        return "Zero Rupees Only"
    out = ("Rupees " + " ".join(words)).strip() if rupees else ""
    if paise:
        p_words = f"{_two(paise // 10)} {_UNITS[paise % 10]}".strip() or "One"
        out = f"{out} Paise {p_words}".strip()
    if not out:
        out = "Zero Rupees"
    return out + " Only"


# ─── Small helpers ───────────────────────────────────────────────────────────

def _f(value, default: float = 0.0) -> float:
    try:
        v = float(value or 0)
        return v
    except (TypeError, ValueError):
        return default


def _fmt_money(value) -> str:
    """1234.5 -> '1,234.50' (no symbol — the caller prefixes Rs./₹)."""
    try:
        v = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except Exception:
        v = Decimal("0.00")
    s = str(v)
    if "." in s:
        whole, frac = s.split(".", 1)
    else:
        whole, frac = s, "00"
    neg = whole.startswith("-")
    digits = whole.lstrip("-") or "0"
    grouped = re.sub(r"(?<=\d)(?=\d{3})(", "\\", digits)
    grouped = re.sub(r"(?<=\d)(?=\d\d\d)$", "", grouped)
    grouped = ""
    while len(digits) > 3:
        grouped = "," + grouped[-3:] if grouped else digits[-3:]
        digits = digits[:-3]
    grouped = (digits + grouped).lstrip(",") or "0"
    sign = "-" if neg and float(str(v)) < 0 else ""
    return f"{sign}{grouped}.{frac[:2]}"


def _now_str(payload: dict) -> tuple[str, str]:
    """(date, time) from the payload, defaulting to now in local format."""
    raw = payload.get("date") or payload.get("created_at")
    dt: datetime | None = None
    if isinstance(raw, datetime):
        dt = raw
    elif raw:
        try:
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            dt = None
    dt = dt or datetime.now()
    return dt.strftime("%d/%m/%Y"), dt.strftime("%I:%M %p").lstrip("0").replace(" 0", " ")


def _qr_png(content: str) -> "bytes | None":
    """QR code bytes (PNG) via qrcode[pil], or None when the dependency or
    the content is missing. The dependency is optional on purpose: a dev
    box without it still prints receipts, just without the square."""
    if not content:
        return None
    try:
        import qrcode
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,
                           box_size=4, border=1)
        qr.add_data(content)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as exc:
        logger.debug("QR generation skipped: %s", exc)
        return None


def _upi_uri(vpa: str, payee: str, amount: float, txn_ref: str) -> str:
    return (f"upi://pay?pa={quote(vpa)}&pn={quote(payee)}"
            f"&am={amount:.2f}&tr={quote(txn_ref)}&cu=INR")


def _safe(s, n: int) -> str:
    s = str(s or "").strip()
    return s[:n] if len(s) > n else s


def _divider(usable_w: float) -> str:
    return "-" * max(8, int(usable_w * 0.72))


# ─── Payload assembly ────────────────────────────────────────────────────────

def receipt_from_bill(bill: dict, items: list[dict]) -> dict:
    """Assemble the print payload from this service's Bill + BillItem rows.

    The API layer passes already-serialised dicts (row.model_dump()), so this
    stays a pure function and needs no session. Keys mirror the Bill model,
    with item lists keyed the way ``render_thermal_receipt`` reads them.
    """
    bill = bill or {}
    items = items or []
    tax_total = _f(bill.get("tax_total"))
    grand = _f(bill.get("grand_total"))
    paid = _f(bill.get("paid_amount"))
    return {
        "invoice_number": bill.get("bill_number") or bill.get("invoice_number") or "",
        "bill_number": bill.get("bill_number"),
        "order_number": bill.get("order_number"),
        "status": bill.get("status"),
        "customer_name": bill.get("customer_name"),
        "customer_phone": bill.get("customer_phone"),
        "customer_gstin": bill.get("customer_gstin"),
        "covers": bill.get("covers") or 1,
        "date": bill.get("created_at"),
        "subtotal": _f(bill.get("subtotal")),
        "discount_total": _f(bill.get("discount_total")),
        "taxable_amount": _f(bill.get("taxable_amount")),
        "tax_total": tax_total,
        "cgst_total": _f(bill.get("cgst_total")),
        "sgst_total": _f(bill.get("sgst_total")),
        "igst_total": _f(bill.get("igst_total")),
        "cess_total": _f(bill.get("cess_total")),
        "service_charge": _f(bill.get("service_charge")),
        "packaging_charge": _f(bill.get("packaging_charge")),
        "tip": _f(bill.get("tip")),
        "round_off": _f(bill.get("round_off")),
        "grand_total": grand,
        "paid_amount": paid,
        "balance_due": max(0.0, grand - paid),
        "change_amount": _f(bill.get("change_amount")),
        "is_credit_sale": bool(bill.get("is_credit_sale")),
        "lines": [
            {
                "name": it.get("name") or "Item",
                "variant_name": it.get("variant_name"),
                "qty": it.get("qty") or 1,
                "unit": "Nos",
                "unit_price": _f(it.get("unit_price")),
                "discount_pct": it.get("discount_pct"),
                "discount_amount": _f(it.get("discount_amount")),
                "hsn_code": it.get("hsn_code"),
                "tax_pct": _f(it.get("tax_pct")),
                "line_total": _f(it.get("line_total")),
            }
            for it in items
        ],
    }


def _normalize_template(template: dict | None) -> dict:
    """Template row → flat dict. A PrintTemplate row carries its toggles in
    ``fields`` JSONB; the frontend's saved shapes nest the same keys at top
    level. Merge both so either input renders."""
    t = dict(template or {})
    fields = dict(t.get("fields") or {})
    for k in (
        "showLogo", "showStoreName", "showBranchName", "showStoreAddress",
        "showStoreContact", "showTaxId", "showInvoiceNumber", "showInvoiceDate",
        "showPaymentMethod", "showCustomerDetails", "showCustomerPhone",
        "showCustomerGstin", "showItemDiscount", "showItemTax",
        "showSubtotal", "showOverallQty", "showTotalDiscount", "showTaxBreakdown",
        "showRoundOff", "showGrandTotal", "showReceivedAndBalance",
        "showAmountInWords", "showLoyaltyPoints", "showPaymentMode",
        "showPaidInFullStamp", "showQrCode", "showDeclaration", "showFooterNote",
        "showTermsAndConditions", "showDeclaration",
    ):
        if k in fields:
            t.setdefault(k, fields[k])
    t.setdefault("paperSize", "80mm")
    return t


def _store_block(template: dict, payload: dict) -> dict:
    """Store identity for the header. Template wins; payload (from an
    invoice row) is the fallback for fields the template left blank."""
    return {
        "store_name": _safe(template.get("storeName") or payload.get("store_name") or "Store", 60),
        "branch_name": _safe(template.get("branchName") or payload.get("branch_name") or "", 50),
        "tagline": _safe(template.get("headerTagline") or template.get("tagline") or "", 60),
        "address": _safe(template.get("address") or template.get("storeAddress")
                         or payload.get("store_address") or "", 150),
        "phone": _safe(template.get("phone") or template.get("storePhone") or "", 30),
        "email": _safe(template.get("email") or "", 50),
        "gstin": _safe(template.get("gstin") or payload.get("store_gstin") or "", 20),
        "pan": _safe(template.get("pan") or "", 10),
        "cin": _safe(template.get("cin") or "", 30),
        "logo": template.get("logoUrl") or template.get("logo_url"),
    }


# ─── Thermal receipt ─────────────────────────────────────────────────────────

def render_thermal_receipt(payload: dict, template: dict | None = None,
                           paper: str = "80mm") -> bytes:
    """80mm / 58mm receipt PDF. ``paper`` and the template's ``paperSize``
    both select the page width; the template value wins when present."""
    t = _normalize_template(template)
    from fpdf import FPDF

    paper_size = str(t.get("paperSize") or paper or "80mm").lower()
    page_w = 58.0 if "58" in paper_size else 80.0
    margin = 3.5
    usable = page_w - margin * 2

    fields = dict(t.get("fields") or {})
    def show(key: str, default: bool = True) -> bool:
        return bool(t.get(key, fields.get(key, default)))

    rsym = "Rs."  # thermal roll: plain ASCII on 200-DPI heads is safest

    pdf = FPDF(orientation="P", unit="mm", format=(page_w, 200))
    pdf.set_auto_page_break(auto=True, margin=3.0)
    pdf.set_margins(margin, 2.5, margin)
    pdf.add_page()

    font = _register_fonts(pdf)
    div = _divider(usable)
    store = _store_block(t, payload)
    inv_no = str(payload.get("invoice_number") or payload.get("bill_number") or "RCP-0000")
    has_tax = (_f(payload.get("cgst_total")) + _f(payload.get("sgst_total"))
               + _f(payload.get("igst_total")) + _f(payload.get("cess_total"))) > 0.001
    title = ("CREDIT NOTE" if str(payload.get("invoice_type", "")).lower() == "credit_note"
             else ("BILL OF SUPPLY" if not has_tax and not _f(payload.get("tax_total"))
                   else "TAX INVOICE"))
    if str(t.get("invoiceTitle") or t.get("headerTitle") or "").upper() not in ("", "TAX INVOICE"):
        title = _safe(t.get("invoiceTitle") or t.get("headerTitle"), 30)

    date_str, time_str = _now_str(payload)
    total = _f(payload.get("grand_total"))
    paid = _f(payload.get("paid_amount"))
    balance = _f(payload.get("balance_due"))
    status = str(payload.get("status") or "").lower()
    is_paid = status in ("settled", "paid") or (total > 0 and paid >= total - 0.005)

    def centered(text: str, size: float = 7.0, style: str = "", gap: float = 3.0) -> None:
        pdf.set_font(font, style, size)
        pdf.cell(usable, gap, text, align="C", new_x="LMARGIN", new_y="NEXT")

    def divider() -> None:
        centered(div, 6.0, gap=2.0)

    # 1. Header
    if show("showLogo") and store["logo"]:
        pass  # logo URLs need storage access; the thermal head just prints the name
    if show("showStoreName") and store["store_name"]:
        centered(store["store_name"].upper(), 10.5, "B")
    if show("showBranchName", False) and store["branch_name"]:
        centered(f"({store['branch_name']})", 7.5, "B")
    if show("showStoreAddress") and store["address"]:
        centered(store["address"], 6.5, gap=2.5)
    contact = "  |  ".join(x for x in (
        f"PH: {store['phone']}" if show("showStoreContact", False) and store["phone"] else "",
        f"GSTIN: {store['gstin']}" if show("showTaxId") and store["gstin"] else "",
    ) if x)
    if contact:
        centered(contact, 6.5, "B")
    divider()

    # 2. Title box
    pdf.set_font(font, "B", 8.5)
    box_w = min(usable * 0.8, pdf.get_string_width(f" {title} ") + 8)
    pdf.set_x((page_w - box_w) / 2)
    pdf.cell(box_w, 4.5, f" {title} ", align="C", border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(0.5)

    # 3. Meta
    pdf.set_font(font, "", 7)
    pdf.cell(usable * 0.5, 3.2, f"INV: {inv_no}", align="L")
    pdf.cell(usable * 0.5, 3.2, f"DATE: {date_str}", align="R", new_x="LMARGIN", new_y="NEXT")
    meta2 = []
    if show("showTime", False):
        meta2.append(f"TIME: {time_str}")
    if cover := payload.get("covers"):
        meta2.append(f"COW: {cover}")
    if meta2:
        pdf.cell(usable * 0.5, 3.0, meta2[0] if meta2 else "", align="L")
        pdf.cell(usable * 0.5, 3.0, meta2[1] if len(meta2) > 1 else "", align="R",
                 new_x="LMARGIN", new_y="NEXT")

    # 4. Customer
    cust = str(payload.get("customer_name") or "").strip()
    if show("showCustomerDetails") and cust:
        divider()
        pdf.set_font(font, "B", 7)
        pdf.cell(usable, 3.2, f"CUSTOMER: {cust}", align="L", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(font, "", 6.5)
        c_phone = payload.get("customer_phone")
        if show("showCustomerPhone", False) and c_phone:
            pdf.cell(usable, 3.0, f"MOB: {c_phone}", align="L", new_x="LMARGIN", new_y="NEXT")
        c_gstin = payload.get("customer_gstin")
        if show("showCustomerGstin", False) and c_gstin:
            pdf.cell(usable, 3.0, f"GSTIN: {c_gstin}", align="L", new_x="LMARGIN", new_y="NEXT")
        divider()

    # 5. Items
    lines = payload.get("lines") or []
    col_w = [usable * 0.46, usable * 0.16, usable * 0.18, usable * 0.20]
    pdf.set_font(font, "B", 7)
    pdf.cell(col_w[0], 3.5, "ITEM", align="L")
    pdf.cell(col_w[1], 3.5, "QTY", align="C")
    pdf.cell(col_w[2], 3.5, "RATE", align="R")
    pdf.cell(col_w[3], 3.5, "AMT", align="R", new_x="LMARGIN", new_y="NEXT")
    divider()
    total_qty = 0.0
    for idx, line in enumerate(lines, start=1):
        name = _safe(str(line.get("name") or line.get("product_name") or f"Item {idx}"), 30)
        qty = _f(line.get("qty") or line.get("quantity") or 1)
        total_qty += qty
        rate = _f(line.get("unit_price"))
        disc = _f(line.get("discount_amount"))
        line_tot = _f(line.get("line_total")) or (rate * qty - disc)
        pdf.set_font(font, "B", 7)
        label = f"{idx}. {name}"
        if line.get("variant_name"):
            label += f" ({_safe(line['variant_name'], 14)})"
        pdf.cell(col_w[0], 3.3, label, align="L")
        pdf.set_font(font, "", 7)
        qty_s = f"{int(qty)}" if float(qty).is_integer() else f"{qty:g}"
        pdf.cell(col_w[1], 3.3, f"{qty_s} {str(line.get('unit') or '')}".strip(), align="C")
        pdf.cell(col_w[2], 3.3, _fmt_money(rate), align="R")
        pdf.cell(col_w[3], 3.3, _fmt_money(line_tot), align="R", new_x="LMARGIN", new_y="NEXT")
        sub = []
        if line.get("hsn_code"):
            sub.append(f"HSN: {line['hsn_code']}")
        if show("showItemDiscount") and disc > 0:
            sub.append(f"Disc: {rsym} {_fmt_money(disc)}")
        if sub:
            pdf.set_font(font, "", 6.0)
            pdf.cell(usable, 2.5, "   " + " | ".join(sub), align="L", new_x="LMARGIN", new_y="NEXT")
    divider()

    # 6. Totals
    def trow(label: str, value: str, bold: bool = False, size: float = 7.0) -> None:
        pdf.set_font(font, "B" if bold else "", size)
        pdf.cell(usable * 0.58, 3.4, label, align="L")
        pdf.cell(usable * 0.42, 3.4, value, align="R", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font(font, "B", 7)
    qty_s = f"{int(total_qty)}" if float(total_qty).is_integer() else f"{total_qty:g}"
    trow(f"ITEMS: {len(lines)}   QTY: {qty_s} UNITS", f"", bold=True)
    if show("showSubtotal"):
        trow("SUBTOTAL:", f"{rsym} {_fmt_money(_f(payload.get('subtotal')))}")
    if show("showTotalDiscount") and _f(payload.get("discount_total")) > 0:
        trow("DISCOUNT:", f"-{rsym} {_fmt_money(_f(payload.get('discount_total')))}", bold=True)
    if show("showTaxBreakdown") and has_tax:
        cgst, sgst, igst, cess = (
            _f(payload.get("cgst_total")), _f(payload.get("sgst_total")),
            _f(payload.get("igst_total")), _f(payload.get("cess_total")))
        if cgst > 0 or sgst > 0:
            if cgst:
                trow("CGST:", f"{rsym} {_fmt_money(cgst)}")
            if sgst:
                trow("SGST:", f"{rsym} {_fmt_money(sgst)}")
        elif igst:
            trow("IGST:", f"{rsym} {_fmt_money(igst)}")
        if cess:
            trow("CESS:", f"{rsym} {_fmt_money(cess)}")
        trow("TOTAL TAX:", f"{rsym} {_fmt_money(_f(payload.get('tax_total')))}", bold=True)
    sc = _f(payload.get("service_charge"))
    if sc > 0:
        trow("SERVICE CHARGE:", f"{rsym} {_fmt_money(sc)}")
    tip = _f(payload.get("tip"))
    if tip > 0:
        trow("TIP:", f"{rsym} {_fmt_money(tip)}")
    ro = _f(payload.get("round_off"))
    if show("showRoundOff") and abs(ro) > 0.001:
        trow("ROUND OFF:", f"{rsym} {_fmt_money(ro)}")
    pdf.set_font(font, "", 7)
    pdf.cell(usable, 2.2, "=" * int(usable * 0.72), align="C", new_x="LMARGIN", new_y="NEXT")
    trow("GRAND TOTAL:", f"{rsym} {_fmt_money(total)}", bold=True, size=9.0)
    pdf.cell(usable, 2.2, "=" * int(usable * 0.72), align="C", new_x="LMARGIN", new_y="NEXT")

    if is_paid:
        pdf.ln(0.5)
        centered("* PAID IN FULL *", 7.5, "B", 4.0)
    method = str(payload.get("payment_method") or "CASH")
    if show("showPaymentMode"):
        trow("PAID VIA:", method.upper(), bold=True)
    if show("showReceivedAndBalance"):
        trow("RECEIVED:", f"{rsym} {_fmt_money(paid)}")
        if balance > 0.005:
            trow("BALANCE DUE:", f"{rsym} {_fmt_money(balance)}", bold=True)

    # 7. UPI QR for the outstanding balance
    if show("showQrCode") and balance > 0.005:
        vpa = str(t.get("upiId") or t.get("upi_vpa") or "").strip()
        if vpa:
            png = _qr_png(_upi_uri(vpa, store["store_name"], balance, inv_no))
            if png:
                divider()
                pdf.image(png, x=(page_w - 24) / 2, w=24, h=24, kind="PNG")
                pdf.ln(1.0)
                centered(f"UPI: {vpa}", 6.5, "B")

    # 8. Terms / footer
    terms = _safe(t.get("termsText") or t.get("termsAndConditionsText")
                  or "Please check the items and quantities before leaving the counter.", 300)
    if show("showTermsAndConditions") or show("showDeclaration", False):
        divider()
        pdf.set_font(font, "B", 6.5)
        pdf.cell(usable, 2.8, "TERMS:", align="L", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(font, "", 6.0)
        pdf.multi_cell(usable, 2.4, terms, align="L")

    footer = _safe(t.get("footerText") or t.get("footerNote") or
                   "Thank you! Visit again.", 120)
    if show("showFooterNote", False) or footer:
        pdf.ln(0.5)
        centered(f"*** {footer.upper()} ***", 7.0, "B")

    out = pdf.output()
    return out if isinstance(out, bytes) else bytes(out)


# ─── A4 invoice ──────────────────────────────────────────────────────────────

def render_invoice_a4(payload: dict, template: dict | None = None) -> bytes:
    """A4 GST invoice. ``payload`` is the same shape as the thermal one plus
    the GST split; ``template`` carries optional branding. Amount-in-words is
    printed here (A4 only) and the e-invoice QR when the payload has one."""
    t = _normalize_template(template)
    from fpdf import FPDF

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.set_margins(12, 10, 12)
    pdf.add_page()
    font = _register_fonts(pdf)
    rsym = _rupee(font)
    usable = pdf.w - pdf.l_margin - pdf.r_margin

    def line_rule():
        pdf.ln(1.0)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + usable, pdf.get_y())
        pdf.ln(1.5)

    store = _store_block(t, payload)
    inv_no = str(payload.get("invoice_number") or payload.get("bill_number") or "INV-0000")
    date_str, _ = _now_str(payload)
    lines = payload.get("lines") or []

    # Header: store block left, TAX INVOICE right
    pdf.set_font(font, "B", 14)
    pdf.cell(usable, 7, store["store_name"].upper(), align="L")
    pdf.ln()
    if store["branch_name"]:
        pdf.set_font(font, "B", 10)
        pdf.cell(usable, 4.5, store["branch_name"], align="L")
        pdf.ln()
    pdf.set_font(font, "", 8.5)
    for bit in (store["address"], store["phone"],
                f"GSTIN: {store['gstin']}" if store["gstin"] else ""):
        if bit:
            pdf.cell(usable, 4.0, bit, align="L")
            pdf.ln()
    line_rule()

    pdf.set_font(font, "B", 12)
    doc_title = "CREDIT NOTE" if str(payload.get("invoice_type") or "").lower() == "credit_note" else "TAX INVOICE"
    pdf.cell(usable * 0.5, 7, doc_title, align="L")
    pdf.set_font(font, "", 10)
    pdf.cell(usable * 0.5, 7, f"Inv No: {inv_no}", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font(font, "", 9)
    pdf.cell(usable * 0.5, 5, f"Date: {date_str}", align="L")
    pdf.cell(usable * 0.5, 5, f"Payment: {str(payload.get('payment_method') or 'CASH').upper()}",
             align="R", new_x="LMARGIN", new_y="NEXT")
    line_rule()

    # Customer block
    pdf.set_font(font, "B", 10)
    pdf.cell(usable, 5, "Bill To", align="L", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font(font, "", 9.5)
    pdf.cell(usable, 5, str(payload.get("customer_name") or "Walk-in Customer"), align="L")
    pdf.ln()
    cust_bits = []
    if payload.get("customer_phone"):
        cust_bits.append(f"Ph: {payload['customer_phone']}")
    if payload.get("customer_gstin"):
        cust_bits.append(f"GSTIN: {payload['customer_gstin']}")
    if cust_bits:
        pdf.cell(usable, 4.5, "  |  ".join(cust_bits), align="L", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1.5)

    # Items table
    heads = ["#", "ITEM", "HSN", "QTY", "RATE", "DISC", "AMOUNT"]
    widths = [8, 64, 20, 18, 22, 22, 32]
    pdf.set_font(font, "B", 9)
    for label, w in zip(heads, widths):
        align = "R" if label in ("QTY", "RATE", "DISC", "AMOUNT") else "L"
        pdf.cell(w, 5.5, label, border=1, align=align)
    pdf.ln()
    pdf.set_font(font, "", 9)
    for idx, line in enumerate(lines, start=1):
        name = _safe(str(line.get("name") or f"Item {idx}"), 40)
        qty = _f(line.get("qty") or line.get("quantity") or 1)
        rate = _f(line.get("unit_price"))
        disc = _f(line.get("discount_amount"))
        tot = _f(line.get("line_total")) or (rate * qty - disc)
        vals = [str(idx), name, str(line.get("hsn_code") or ""),
                f"{int(qty)}" if float(qty).is_integer() else f"{qty:g}",
                _fmt_money(rate), _fmt_money(disc), _fmt_money(tot)]
        for v, w in zip(vals, widths):
            align = "R" if w in (18, 22, 32) else "L"
            pdf.cell(w, 5.0, v, border=1, align=align)
        pdf.ln()

    pdf.ln(1.0)
    total = _f(payload.get("grand_total"))
    cgst, sgst, igst = (_f(payload.get("cgst_total")), _f(payload.get("sgst_total")),
                         _f(payload.get("igst_total")))

    def total_row(label: str, value: str, bold=False, size=9.5):
        pdf.set_font(font, "B" if bold else "", size)
        pdf.cell(usable - 40, 5.5, label, align="R")
        pdf.cell(40, 5.5, value, align="R", new_x="LMARGIN", new_y="NEXT")

    total_row("Subtotal", f"{rsym} {_fmt_money(_f(payload.get('subtotal')))}")
    if _f(payload.get("discount_total")) > 0:
        total_row("Discount", f"-{rsym} {_fmt_money(_f(payload.get('discount_total')))}")
    if cgst + sgst + igst > 0.001:
        total_row("Taxable Amount", f"{rsym} {_fmt_money(_f(payload.get('taxable_amount')))}")
        if cgst:
            total_row("CGST", f"{rsym} {_fmt_money(cgst)}")
        if sgst:
            total_row("SGST", f"{rsym} {_fmt_money(sgst)}")
        if igst:
            total_row("IGST", f"{rsym} {_fmt_money(igst)}")
        if _f(payload.get("cess_total")):
            total_row("Cess", f"{rsym} {_fmt_money(_f(payload.get('cess_total')))}")
        total_row("Total GST", f"{rsym} {_fmt_money(_f(payload.get('tax_total')))}", bold=True)
    pdf.ln(0.5)
    total_row("Grand Total", f"{rsym} {_fmt_money(total)}", bold=True, size=11)
    if _f(payload.get("paid_amount")) or _f(payload.get("balance_due")):
        total_row("Paid", f"{rsym} {_fmt_money(_f(payload.get('paid_amount')))}")
        bal = _f(payload.get("balance_due"))
        if bal > 0.005:
            total_row("Balance Due", f"{rsym} {_fmt_money(bal)}", bold=True)

    pdf.ln(1.0)
    words = _number_to_indian_words(total)
    pdf.set_font(font, "B", 9)
    pdf.cell(usable, 5.5, f"Amount in words: {words}", align="L", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1.0)

    # e-invoice QR when present
    qr_content = payload.get("e_invoice_qr") or payload.get("irn_number")
    if qr_content:
        png = _qr_png(str(qr_content))
        if png:
            pdf.set_font(font, "B", 8)
            pdf.cell(60, 5, "E-Invoice QR (IRN):", align="L", new_x="LMARGIN", new_y="NEXT")
            pdf.image(png, x=pdf.l_margin, y=pdf.get_y(), w=25, h=25, kind="PNG")
            pdf.ln(28)
        else:
            pdf.set_font(font, "", 8)
            pdf.cell(usable, 5, f"IRN: {qr_content}", align="L", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(2.0)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + usable, pdf.get_y())
    pdf.ln(2.0)
    pdf.set_font(font, "B", 8.5)
    pdf.cell(usable * 0.5, 5, f"for {store['store_name']}", align="L")
    pdf.cell(usable * 0.5, 5, "Authorised Signatory", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font(font, "", 7.5)
    pdf.multi_cell(usable, 3.5,
                   "We declare that this invoice shows the actual price of the goods/described "
                   "items, and all particulars are true and correct.", align="L")

    out = pdf.output()
    return out if isinstance(out, bytes) else bytes(out)


# ─── ESC/POS ─────────────────────────────────────────────────────────────────
#
# Raw byte constants — no printer is instantiated. ESC @ inits, a1 centers,
# 48/16 is font size (48=font B large, 16=font A normal), GS ( k prints a QR
# code the head decodes itself. The stream is what a 9100/9102 network port
# (python-escpos's Network, raw mode) consumes unchanged.

ESC = b"\x1b"
GS = b"\x1d"
_QR_MODEL: dict[int, bytes] = {
    0: b"2",   # model 2
    1: b"67",  # magnification 1–8
    2: b"4",   # size 4 modules
    3: b"0",   # error correction L
    8: b"0",   # store in VRAM and print
}


def _escpos_center_on() -> bytes:
    return ESC + b"a1"


def _escpos_center_off() -> bytes:
    return ESC + b"a0"


def _escpos_font(size: str) -> bytes:
    """size 'L' → font B (large), 'S' → font A (normal)."""
    return ESC + b"!48" if size == "L" else ESC + b"!16"


def _escpos_rule(width_chars: int) -> bytes:
    return b"-" * width_chars + b"\n"


def _escpos_left(s: str, width_chars: int) -> bytes:
    s = _ascii(s)
    pad = max(0, width_chars - len(s))
    return s.encode("ascii", "replace") + b" " * pad + b"\n"


def _escpos_right(s: str, width_chars: int) -> bytes:
    s = _ascii(s)
    pad = max(0, width_chars - len(s))
    return b" " * pad + s.encode("ascii", "replace") + b"\n"


def _escpos_center(s: str, width_chars: int) -> bytes:
    s = _ascii(s)
    pad = max(0, width_chars - len(s))
    left = pad // 2
    return b" " * left + s.encode("ascii", "replace") + b" " * (pad - left) + b"\n"


def _ascii(s: str) -> str:
    """7-bit only: thermal heads cannot print '₹' on most firmware, so
    amounts read 'Rs.' — same convention as the PDF thermal path."""
    return str(s or "").encode("ascii", "replace").decode()


def _escpos_qr_upi(vpa: str, payee: str, amount: float, txn_ref: str) -> bytes:
    """GS ( k dynamic QR: the head decodes the UPI intent, no image stream.

    Each pair is (function code, parameter, data): function selects the
    operation, parameter is the option, data is the argument. The print
    command ends the sequence.
    """
    uri = _upi_uri(vpa, payee, amount, txn_ref).encode("ascii", "replace")
    out = bytearray()
    out += GS + b"(k" + bytes([4, 0]) + bytes([0])           # store in VRAM
    out += GS + b"(k" + bytes([0, 0]) + bytes([4])           # model 2
    out += GS + b"(k" + bytes([1, 0]) + bytes([4])           # magnification 4
    out += GS + b"(k" + bytes([3, 0]) + bytes([0])           # EC level L
    out += GS + b"(k" + bytes([65, 0, 0, 0, 0, 0, 0, 0]) + b"?"  # clear
    for i, byte in enumerate(uri):
        out += GS + b"(k" + bytes([66 + i, i // 256, i % 256,
                                  0, 0, 0, 0, 0]) + bytes([byte])
    out += GS + b"(k" + bytes([16, 0]) + bytes([0])          # print from VRAM
    return bytes(out)


def escpos_receipt_bytes(payload: dict, paper: str = "80mm") -> bytes:
    """A full receipt as raw ESC/POS bytes. ``payload`` is the same shape as
    the thermal PDF (receipt_from_bill output); ``paper`` picks the column
    width — 80mm rolls hold 48 chars at font A, 58mm hold 32."""
    width = 32 if "58" in str(paper or "80mm").lower() else 48

    t = _normalize_template(None)
    store_name = _safe(payload.get("store_name") or "STORE", 40)
    inv_no = str(payload.get("invoice_number") or payload.get("bill_number") or "RCP-0000")
    date_str, time_str = _now_str(payload)
    total = _f(payload.get("grand_total"))
    paid = _f(payload.get("paid_amount"))
    balance = _f(payload.get("balance_due"))
    lines = payload.get("lines") or []
    status = str(payload.get("status") or "").lower()
    is_paid = status in ("settled", "paid") or (total > 0 and paid >= total - 0.005)
    rsym = "Rs."

    out = bytearray()
    out += ESC + b"@"                    # init / clear
    out += _escpos_center_on()
    out += _escpos_font("L")
    out += _escpos_center(store_name.upper(), width)
    if payload.get("store_address"):
        out += _escpos_font("S")
        for chunk in str(payload["store_address"]).upper().split("\n"):
            out += _escpos_center(chunk, width)
    if payload.get("gstin"):
        out += _escpos_center(f"GSTIN: {payload['gstin']}", width)
    out += _escpos_font("S")
    out += _escpos_rule(width)
    out += _escpos_font("L")
    out += _escpos_center("TAX INVOICE", width)
    out += _escpos_font("S")
    out += _escpos_left(f"INV {inv_no}", width)
    out += _escpos_right(f"{date_str} {time_str}", width)
    cust = str(payload.get("customer_name") or "").strip()
    if cust:
        out += _escpos_left(f"CUST: {cust}", width)
    out += _escpos_rule(width)
    out += _escpos_left("ITEM", int(width * 0.46))
    out += _escpos_right("QTY", int(width * 0.16))
    out += _escpos_right("RATE", int(width * 0.18))
    out += _escpos_right("AMT\n", int(width * 0.20))
    out += _escpos_rule(width)
    total_qty = 0.0
    for idx, line in enumerate(lines, start=1):
        name = _safe(str(line.get("name") or f"Item {idx}"), 30)
        qty = _f(line.get("qty") or 1)
        total_qty += qty
        rate = _f(line.get("unit_price"))
        disc = _f(line.get("discount_amount"))
        tot = _f(line.get("line_total")) or (rate * qty - disc)
        qty_s = f"{int(qty)}" if float(qty).is_integer() else f"{qty:g}"
        out += _escpos_left(f"{idx}. {name}", int(width * 0.46))
        out += _escpos_right(qty_s, int(width * 0.16))
        out += _escpos_right(_fmt_money(rate), int(width * 0.18))
        out += _escpos_right(_fmt_money(tot) + "\n", int(width * 0.20))
    out += _escpos_rule(width)
    out += _escpos_left(f"ITEMS: {len(lines)}   QTY: "
                        f"{int(total_qty) if float(total_qty).is_integer() else f'{total_qty:g}'}", width)
    if _f(payload.get("subtotal")) > 0:
        out += _escpos_left("SUBTOTAL:", int(width * 0.58))
        out += _escpos_right(f"{rsym} {_fmt_money(_f(payload.get('subtotal')))}\n", int(width * 0.42))
    if _f(payload.get("tax_total")) > 0:
        out += _escpos_left("TAX:", int(width * 0.58))
        out += _escpos_right(f"{rsym} {_fmt_money(_f(payload.get('tax_total')))}\n", int(width * 0.42))
    out += _escpos_font("L")
    out += _escpos_left("GRAND TOTAL:", int(width * 0.58))
    out += _escpos_right(f"{rsym} {_fmt_money(total)}\n", int(width * 0.42))
    out += _escpos_font("S")
    out += _escpos_rule(width)
    if is_paid:
        out += _escpos_center("* PAID IN FULL *", width)
    out += _escpos_left("PAID VIA:", int(width * 0.58))
    out += _escpos_right(f"{str(payload.get('payment_method') or 'CASH').upper()}\n", int(width * 0.42))
    if balance > 0.005:
        out += _escpos_left("BALANCE DUE:", int(width * 0.58))
        out += _escpos_right(f"{rsym} {_fmt_money(balance)}\n", int(width * 0.42))
    vpa = str(payload.get("upi_vpa") or "").strip()
    if vpa and balance > 0.005:
        out += _escpos_qr_upi(vpa, store_name, balance, inv_no)
        out += b"\n\n"
    out += _escpos_rule(width)
    out += _escpos_center("Thank you! Visit again.", width)
    out += b"\n\n\n"
    out += GS + b"V0" + bytes([4])       # feed 4 lines
    out += ESC + b"@"                    # reset so the next job starts clean
    return bytes(out)
