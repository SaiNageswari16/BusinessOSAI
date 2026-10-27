"""Invoice & receipt subsystem for the billing service.

Serves the retail frontend's invoicesApi / salesReturnsApi / printTemplatesApi
/ paymentRemindersApi / paymentsApi surfaces. The same router is mounted at
``/api/v1/billing`` (via api.py) and at the aliases ``/api/v1/invoices``,
``/api/v1/receipts``, ``/api/v1/sales-returns`` and ``/api/v1/payments``
(via main.py), so every frontend path resolves.

Money rules: an invoice is the *document*; a Bill is the *transaction*.
Creating an invoice from a ``bill_id`` snapshots that bill's lines and totals
and keeps the link. Settlement records legs on the invoice and, when the
invoice is linked, settles the bill through the bill settlement service so
the two cannot drift apart.

Events: invoice.created / invoice.paid / invoice.voided are written to the
outbox inside the same transaction as the change, then dispatched locally —
the relay guarantees cross-service delivery the way bill.paid already does.

Gateway routes are honest stubs: without configured keys they report
GATEWAY_NOT_CONFIGURED (501), never a fake success.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.billing import receipt_pdf
from src.services.billing import service as svc
from src.services.billing.api import DbDep, _outbox, status_value
from src.services.billing.models import (
    Bill,
    BillItem,
    BillStatus,
    GatewayConfig,
    Invoice,
    InvoiceLine,
    InvoicePayment,
    InvoiceReturn,
    InvoiceReturnLine,
    InvoiceStatus,
    PaymentGatewayOrder,
    PrintTemplate,
    ReminderPolicy,
    TaxCode,
)
from src.services.billing.schemas import (
    GatewayConfigIn,
    GatewayConfigResponse,
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceSettlementCreate,
    InvoiceUpdate,
    InvoiceVoid,
    PineLabsChargeRequest,
    PrintTemplateCreate,
    PrintTemplateResponse,
    RazorpayOrderCreate,
    RazorpayVerifyRequest,
    SalesReturnCreate,
    SalesReturnExchangeCreate,
    SalesReturnResponse,
    SetActivePrintTemplate,
    ReminderPolicyIn,
)
from src.services.event_bus.bus import Event, bus
from src.services.shared.base import PaginatedResponse
from src.services.shared.identity import CurrentIdentity

router = APIRouter()

VALID_INVOICE_TYPES = ("tax_invoice", "receipt", "credit_note")
DEFAULT_POLICY = {
    "enabled": False,
    "channels": ["whatsapp"],
    "days_before_due": 3,
    "reminder_frequency_days": 1,
}


# ─── helpers ─────────────────────────────────────────────────────────────────

def _parse_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _shallow(row) -> dict:
    """A row's plain columns only — no relationships, so serialising it
    can never fire a lazy load (MissingGreenlet)."""
    return {c.name: getattr(row, c.name) for c in type(row).__table__.columns}


async def _load_invoice(db: AsyncSession, tenant_id: uuid.UUID,
                        invoice_id: uuid.UUID) -> Invoice | None:
    return (
        await db.execute(
            select(Invoice)
            .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
            .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
        )
    ).scalars().first()


async def _resolve_invoice(db: AsyncSession, tenant_id: uuid.UUID,
                          ref: str) -> Invoice | None:
    """By UUID, else by invoice number — the retail UI passes either."""
    uid = _parse_uuid(ref)
    if uid is not None:
        return await _load_invoice(db, tenant_id, uid)
    return (
        await db.execute(
            select(Invoice)
            .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
            .where(Invoice.invoice_number == str(ref), Invoice.tenant_id == tenant_id)
        )
    ).scalars().first()


async def _resolve_outlet(identity: CurrentIdentity,
                          requested: uuid.UUID | None,
                          required: bool = True) -> uuid.UUID | None:
    """The outlet this invoice numbers under: explicit → active → 400.

    Reuses the identity service's outlet-resolution rules; a required outlet
    with none in context is a 400, not a silent cross-outlet write.
    """
    if requested is not None:
        if not identity.can_access_outlet(requested):
            raise HTTPException(status_code=403, detail="Not authorised for this outlet")
        return requested
    if identity.active_outlet_id is not None:
        return identity.active_outlet_id
    if len(identity.allowed_outlet_ids) == 1:
        return next(iter(identity.allowed_outlet_ids))
    if required:
        raise HTTPException(status_code=400, detail="outlet_id is required")
    return None


async def _tax_code_rates(db: AsyncSession, tenant_id: uuid.UUID,
                          line_tax_code_ids: list[uuid.UUID | None]) -> dict[int, dict]:
    """Per-line-index tax split from this service's TaxCode rows.

    ``per-line tax_code_id → cgst_pct/sgst_pct/igst_pct/cess_pct``; a missing
    code leaves the index out, so the math falls back to the line's bare
    tax_rate (zero-tax when there is none).
    """
    wanted = sorted({c for c in line_tax_code_ids if c})
    if not wanted:
        return {}
    rows = (
        await db.execute(
            select(TaxCode).where(TaxCode.id.in_(wanted))
        )
    ).scalars().all()
    by_id = {r.id: r for r in rows}
    out: dict[int, dict] = {}
    for idx, code_id in enumerate(line_tax_code_ids):
        if code_id and code_id in by_id:
            tc = by_id[code_id]
            out[idx] = {
                "cgst_pct": float(tc.cgst_pct or 0),
                "sgst_pct": float(tc.sgst_pct or 0),
                "igst_pct": float(tc.igst_pct or 0),
                "cess_pct": float(tc.cess_pct or 0),
            }
    return out


def _line_dicts(invoice_lines: list[InvoiceLine]) -> list[dict]:
    return [
        {
            "menu_item_id": l.menu_item_id,
            "description": l.description,
            "hsn_code": l.hsn_code,
            "qty": float(l.qty),
            "unit": l.unit or "Nos",
            "unit_price": float(l.unit_price or 0),
            "discount_amount": float(l.discount_amount or 0),
            "tax_code_id": l.tax_code_id,
            "tax_rate": float(l.tax_rate or 0),
        }
        for l in invoice_lines
    ]


def _invoice_payload(inv: Invoice) -> dict:
    """The dict both PDF renderers take: flat columns + line dicts + store
    bits the template may not know."""
    return {
        **_shallow(inv),
        "lines": [
            {
                "name": l.description,
                "variant_name": None,
                "qty": float(l.qty),
                "unit": l.unit or "Nos",
                "unit_price": float(l.unit_price or 0),
                "discount_amount": float(l.discount_amount or 0),
                "hsn_code": l.hsn_code,
                "tax_pct": float(l.tax_rate or 0),
                "line_total": float(l.line_total or 0),
            }
            for l in (inv.lines or [])
        ],
        "payment_method": next(
            (p.method for p in (inv.payments or []) if p.amount > 0), "cash"
        ),
        "balance_due": max(0.0, float(inv.grand_total or 0) - float(inv.paid_amount or 0)),
        "status": status_value(inv.status),
        "date": inv.dated,
    }


def _template_json(t: PrintTemplate | None, with_row: bool = True) -> dict:
    """Row → the frontend's template object: stored ``fields`` spread to the
    top level (that is where paperSize/themeName live), row columns alongside."""
    if t is None:
        return {}
    out = dict(t.fields or {})
    if with_row:
        for col in ("id", "outlet_id", "category", "name", "paper_size",
                    "active", "created_at", "updated_at"):
            out[col] = getattr(t, col)
        out["paperSize"] = out.get("paperSize") or t.paper_size
        out["isDefault"] = bool(t.active)
    return out


# ─── Invoices ────────────────────────────────────────────────────────────────

@router.get("/invoices", response_model=PaginatedResponse[InvoiceListResponse],
            tags=["invoices"])
async def list_invoices(identity: CurrentIdentity, db: DbDep,
                       outlet_id: uuid.UUID | None = None,
                       status: str | None = None,
                       invoice_type: str | None = None,
                       date_from: str | None = None,
                       date_to: str | None = None,
                       search: str | None = None,
                       company_id: str | None = None,
                       page: int = Query(1, ge=1),
                       page_size: int = Query(20, ge=1, le=500)):
    """Register, filtered. Retail sends company_id; scoping it to the tenant
    here is what a bare column cannot do — the param is accepted, ignored
    (one tenant = one company in this split), and never breaks a page."""
    identity.require("view:bills")
    stmt = select(Invoice).where(Invoice.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(Invoice.outlet_id == outlet_id)
    if status:
        stmt = stmt.where(func.lower(Invoice.status) == status.lower())
    if invoice_type:
        stmt = stmt.where(Invoice.invoice_type == invoice_type)
    if date_from:
        stmt = stmt.where(Invoice.dated >= date_from)
    if date_to:
        stmt = stmt.where(Invoice.dated <= date_to)
    if search:
        like = f"%{search}%"
        from sqlalchemy import or_
        stmt = stmt.where(or_(
            Invoice.invoice_number.ilike(like),
            Invoice.customer_name.ilike(like),
        ))
    total = int(
        await db.scalar(
            select(func.count()).select_from(stmt.subquery())
        ) or 0
    )
    rows = (
        await db.execute(
            stmt.order_by(Invoice.dated.desc()).offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    items = [InvoiceListResponse.model_validate(_shallow(r)) for r in rows]
    return PaginatedResponse.build(items, total, page, page_size)


@router.post("/invoices", response_model=InvoiceResponse, status_code=201,
             tags=["invoices"])
async def create_invoice(payload: InvoiceCreate, identity: CurrentIdentity,
                         db: DbDep):
    """Create from a bill (POS path) or from manual lines (counter path)."""
    identity.require("manage:bills")

    bill: Bill | None = None
    if payload.bill_id:
        bill = await svc.load_bill(db, identity.tenant_id, payload.bill_id)
        if bill is None:
            raise HTTPException(status_code=404, detail="Bill not found")
        if not identity.can_access_outlet(bill.outlet_id):
            raise HTTPException(status_code=403, detail="Not authorised for this outlet")
        outlet_id = bill.outlet_id
        lines_in = [
            {
                "menu_item_id": it.menu_item_id,
                "description": (it.variant_name + " — " if it.variant_name else "")
                                + (it.name or "Item"),
                "hsn_code": it.hsn_code,
                "qty": int(it.qty or 1),
                "unit_price": float(it.unit_price or 0),
                "discount_amount": float(it.discount_amount or 0),
                "tax_code_id": it.tax_code_id,
                "tax_rate": float(it.tax_pct or 0),
            }
            for it in (bill.items or [])
        ]
        customer_name = payload.customer_name or bill.customer_name
        customer_phone = payload.customer_phone or bill.customer_phone
        customer_gstin = payload.customer_gstin or bill.customer_gstin
        customer_id = payload.customer_id or bill.customer_id
        invoice_type = payload.invoice_type if payload.invoice_type in VALID_INVOICE_TYPES \
            else "receipt"
    else:
        outlet_id = await _resolve_outlet(identity, payload.outlet_id)
        lines_in = [l.model_dump() for l in payload.lines]
        customer_name = payload.customer_name
        customer_phone = payload.customer_phone
        customer_gstin = payload.customer_gstin
        customer_id = payload.customer_id
        invoice_type = payload.invoice_type if payload.invoice_type in VALID_INVOICE_TYPES \
            else "tax_invoice"

    # GST split from tax codes where the lines point at them.
    rates = await _tax_code_rates(
        db, identity.tenant_id, [l.get("tax_code_id") for l in lines_in]
    )
    interstate = svc.is_interstate_sale(None, customer_gstin) if customer_gstin else False
    totals = svc.compute_invoice_totals(
        lines_in,
        is_interstate=interstate,
        invoice_discount=Decimal(str(payload.discount_amount or 0)),
        is_tax_inclusive=payload.is_tax_inclusive,
        tax_rates=rates,
    )

    number = payload.invoice_number or await svc.allocate_invoice_number(
        db, identity.tenant_id, outlet_id,
        code="CN" if invoice_type == "credit_note" else "INV",
    )
    inv = Invoice(
        tenant_id=identity.tenant_id,
        outlet_id=outlet_id,
        invoice_number=number,
        invoice_type=invoice_type,
        bill_id=payload.bill_id,
        customer_id=customer_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_gstin=customer_gstin,
        status=InvoiceStatus.DRAFT,
        is_reverse_charge=payload.is_reverse_charge,
        is_tax_inclusive=payload.is_tax_inclusive,
        tds=float(payload.tds or 0),
        dated=payload.dated or datetime.now(timezone.utc),
    )

    for idx, line in enumerate(lines_in):
        pl = totals["per_line"][idx] if idx < len(totals["per_line"]) else {}
        inv.lines.append(InvoiceLine(
            tenant_id=identity.tenant_id,
            invoice_id=None,  # set after the parent flushes
            line_number=idx + 1,
            menu_item_id=line.get("menu_item_id"),
            description=str(line.get("description") or line.get("name") or "Item"),
            hsn_code=line.get("hsn_code"),
            qty=Decimal(str(line.get("qty") or 1)),
            unit=line.get("unit") or "Nos",
            unit_price=Decimal(str(line.get("unit_price") or 0)),
            discount_amount=Decimal(str(line.get("discount_amount") or 0)),
            tax_code_id=line.get("tax_code_id"),
            tax_rate=Decimal(str(line.get("tax_rate") or 0)),
            cgst=pl.get("cgst", Decimal("0")),
            sgst=pl.get("sgst", Decimal("0")),
            igst=pl.get("igst", Decimal("0")),
            cess=pl.get("cess", Decimal("0")),
            line_total=pl.get("line_total", Decimal("0")),
        ))

    inv.subtotal = totals["subtotal"]
    inv.discount_total = totals["discount_total"]
    inv.taxable_amount = totals["taxable_amount"]
    inv.tax_total = totals["tax_total"]
    inv.cgst_total = totals["cgst_total"]
    inv.sgst_total = totals["sgst_total"]
    inv.igst_total = totals["igst_total"]
    inv.cess_total = totals["cess_total"]
    inv.round_off = totals["round_off"]
    inv.grand_total = totals["grand_total"]

    # Paid at creation?
    paid = Decimal(str(payload.paid_amount or 0))
    if bill is not None and status_value(bill.status) == BillStatus.SETTLED and paid == 0:
        # The bill is already settled: the invoice rides the same money.
        paid = Decimal(str(bill.paid_amount or 0))
    if paid > 0:
        inv.paid_amount = min(paid, inv.grand_total)
        inv.status = InvoiceStatus.SETTLED if inv.paid_amount >= inv.grand_total \
            else InvoiceStatus.PARTIAL
        inv.payments.append(InvoicePayment(
            tenant_id=identity.tenant_id,
            invoice_id=None,
            method=payload.payment_method or "cash",
            amount=inv.paid_amount,
            reference=payload.payment_method,
            paid_at=datetime.now(timezone.utc),
        ))

    db.add(inv)
    await db.flush()
    for ln in inv.lines:
        ln.invoice_id = inv.id
    for pay in inv.payments:
        pay.invoice_id = inv.id
    await db.flush()

    event = Event(
        type="invoice.created",
        tenant_id=identity.tenant_id,
        outlet_id=outlet_id,
        data={
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "invoice_type": inv.invoice_type,
            "bill_id": str(bill.id) if bill else None,
            "customer_id": str(customer_id) if customer_id else None,
            "status": status_value(inv.status),
            "grand_total": float(inv.grand_total),
            "paid_amount": float(inv.paid_amount),
            "tax_total": float(inv.tax_total),
        },
        source_service="billing",
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return await _load_invoice(db, identity.tenant_id, inv.id)


@router.get("/invoices/payments/all", tags=["invoices"])
async def list_all_invoice_payments(identity: CurrentIdentity, db: DbDep,
                                    page: int = Query(1, ge=1),
                                    page_size: int = Query(20, ge=1, le=500)):
    """Every payment leg in the tenant, with the invoice it paid — the retail
    payments journal."""
    identity.require("process:payments")
    stmt = select(InvoicePayment, Invoice.invoice_number).join(
        Invoice, Invoice.id == InvoicePayment.invoice_id
    ).where(InvoicePayment.tenant_id == identity.tenant_id)
    total = int(await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = (
        await db.execute(
            stmt.order_by(InvoicePayment.created_at.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )
    ).all()
    items = [
        {
            **_shallow(p),
            "invoice_number": number,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        }
        for p, number in rows
    ]
    return PaginatedResponse.build(items, total, page, page_size)


@router.get("/invoices/customer-summary/{ref}", tags=["invoices"])
async def customer_summary(ref: str, identity: CurrentIdentity, db: DbDep,
                          phone: str | None = None):
    """Totals + FIFO unpaid list for a customer (UUID, name, or phone).

    ``ref`` may be a customer id, a customer name fragment, or a phone; the
    ``phone`` param disambiguates when the same name exists twice. The
    FIFO list is what the settlement screen applies a payment against.
    """
    identity.require("view:bills")
    where = [Invoice.tenant_id == identity.tenant_id,
             Invoice.status.in_([
                 InvoiceStatus.DRAFT.value, InvoiceStatus.PARTIAL.value,
             ])]
    name_like = None
    uid = _parse_uuid(ref)
    if uid:
        where.append(Invoice.customer_id == uid)
    elif phone:
        where.append(Invoice.customer_phone == phone)
    else:
        name_like = f"%{ref}%"
        where.append(Invoice.customer_name.ilike(name_like))

    open_inv = (
        await db.execute(select(Invoice).where(*where))
    ).scalars().all()

    # FIFO: oldest dated first.
    fifo = sorted(
        (i for i in open_inv if float(i.grand_total or 0) > float(i.paid_amount or 0)),
        key=lambda i: (i.dated or i.created_at, i.created_at),
    )
    pending_due = round(
        sum(max(0.0, float(i.grand_total or 0) - float(i.paid_amount or 0))
            for i in open_inv), 2)
    total_billed = round(sum(float(i.grand_total or 0) for i in open_inv), 2)
    total_paid = round(sum(float(i.paid_amount or 0) for i in open_inv), 2)

    return {
        "customer_id": str(uid) if uid else None,
        "customer_name": ref if not uid else (open_inv[0].customer_name if open_inv else ref),
        "open_count": len(open_inv),
        "unpaid_count": len(fifo),
        "total_billed": total_billed,
        "total_paid": total_paid,
        "pending_due": pending_due,
        "unpaid": [
            {
                "invoice_id": str(i.id),
                "invoice_number": i.invoice_number,
                "invoice_date": i.dated.isoformat() if i.dated else None,
                "grand_total": float(i.grand_total or 0),
                "paid_amount": float(i.paid_amount or 0),
                "balance_due": round(max(0.0, float(i.grand_total or 0)
                                         - float(i.paid_amount or 0)), 2),
                "status": status_value(i.status),
            }
            for i in fifo
        ],
    }


@router.get("/invoices/settlement/{voucher_number}", tags=["invoices"])
async def settlement_by_voucher(voucher_number: str, identity: CurrentIdentity,
                                db: DbDep):
    """Payments that share a voucher number (one settlement across several
    invoices) — the retail getSettlementByVoucher shape."""
    identity.require("process:payments")
    rows = (
        await db.execute(
            select(InvoicePayment).where(
                InvoicePayment.tenant_id == identity.tenant_id,
                InvoicePayment.reference == voucher_number,
            )
        )
    ).scalars().all()
    covered = []
    for p in rows:
        inv = await _load_invoice(db, identity.tenant_id, p.invoice_id)
        covered.append({
            "invoice_id": str(p.invoice_id),
            "invoice_number": inv.invoice_number if inv else None,
            "amount": float(p.amount or 0),
            "method": p.method,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        })
    return {
        "voucher_number": voucher_number,
        "total": round(sum(float(p.amount or 0) for p in rows), 2),
        "covered": covered,
    }


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse,
            tags=["invoices"])
async def get_invoice(invoice_id: str, identity: CurrentIdentity, db: DbDep):
    identity.require("view:bills")
    inv = await _resolve_invoice(db, identity.tenant_id, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@router.get("/invoices/{invoice_id}/pdf", tags=["invoices"])
async def invoice_pdf(invoice_id: str, identity: CurrentIdentity, db: DbDep,
                      format: str = "a4",
                      size: str = "80mm",
                      template_id: str | None = None):
    """A4 GST invoice or a thermal PDF, rendered from the active (or named)
    print template. 404 when the invoice does not exist."""
    identity.require("view:bills")
    inv = await _resolve_invoice(db, identity.tenant_id, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")

    tpl_row: PrintTemplate | None = None
    wanted_template = _parse_uuid(template_id)
    if wanted_template:
        tpl_row = await db.scalar(
            select(PrintTemplate).where(
                PrintTemplate.id == wanted_template,
                PrintTemplate.tenant_id == identity.tenant_id,
            )
        )
    else:
        category = "invoices" if format == "a4" else "thermal"
        tpl_row = await _active_template(db, identity.tenant_id, category,
                                         inv.outlet_id)
    template = _template_json(tpl_row)
    payload = _invoice_payload(inv)

    if format == "thermal":
        data = receipt_pdf.render_thermal_receipt(payload, template or None, paper=size)
    else:
        data = receipt_pdf.render_invoice_a4(payload, template or None)

    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition":
                 f'inline; filename="{inv.invoice_number}.pdf"'},
    )


@router.put("/invoices/{invoice_id}", response_model=InvoiceResponse,
            tags=["invoices"])
@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse,
               tags=["invoices"])
async def update_invoice(invoice_id: str, payload: InvoiceUpdate,
                         identity: CurrentIdentity, db: DbDep):
    """Updates the retail UI sends (PATCH). PUT and PATCH share a handler —
    FastAPI matches one method at a time, so both decorators point here."""
    identity.require("manage:bills")
    inv = await _resolve_invoice(db, identity.tenant_id, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not identity.can_access_outlet(inv.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(inv, field, value)
    await db.flush()
    return inv


@router.post("/invoices/{invoice_id}/settlement", tags=["invoices"])
async def settle_invoice(invoice_id: str, payload: InvoiceSettlementCreate,
                         identity: CurrentIdentity, db: DbDep):
    """Record payment legs against an invoice.

    A fully-settled invoice publishes ``invoice.paid`` (outbox, in the same
    transaction, then local dispatch — the bill settlement pattern). When the
    invoice is linked to a bill, the legs also settle the bill through the
    bill settlement service, so bills and invoices cannot drift apart.
    """
    identity.require("process:payments")
    inv = await _resolve_invoice(db, identity.tenant_id, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if status_value(inv.status) in (InvoiceStatus.VOID.value, InvoiceStatus.REFUNDED.value):
        raise HTTPException(status_code=409,
                            detail=f"Cannot settle a {status_value(inv.status)} invoice")

    amount = Decimal(str(payload.payment_amount or 0))
    allocated = min(amount,
                    max(Decimal("0"),
                        Decimal(str(inv.grand_total or 0)) - Decimal(str(inv.paid_amount or 0))))
    method = (payload.payment_method or "cash").lower()
    inv.payments.append(InvoicePayment(
        tenant_id=identity.tenant_id,
        invoice_id=inv.id,
        method=method,
        amount=allocated,
        reference=payload.reference_number,
        paid_at=payload.payment_date or datetime.now(timezone.utc),
    ))
    inv.paid_amount = Decimal(str(inv.paid_amount or 0)) + allocated
    fully = inv.paid_amount >= Decimal(str(inv.grand_total or 0))
    inv.status = InvoiceStatus.SETTLED if fully else InvoiceStatus.PARTIAL
    await db.flush()

    # Linked bill: apply the same legs so the bill register reconciles.
    bill_settled = False
    if inv.bill_id:
        bill = await svc.load_bill(db, identity.tenant_id, inv.bill_id)
        if bill is not None and status_value(bill.status) != BillStatus.SETTLED \
                and fully:
            try:
                await svc.settle_bill(
                    db, identity.tenant_id, bill,
                    payments=[{"method": method, "amount": float(inv.grand_total or 0)}],
                    cashier_id=identity.user_id,
                )
                bill_settled = True
            except svc.BillingError:
                bill_settled = False
    await db.commit()

    events = []
    if fully:
        event = Event(
            type="invoice.paid",
            tenant_id=identity.tenant_id,
            outlet_id=inv.outlet_id,
            data={
                "invoice_id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "bill_id": str(inv.bill_id) if inv.bill_id else None,
                "method": method,
                "amount": float(allocated),
                "grand_total": float(inv.grand_total or 0),
                "paid_amount": float(inv.paid_amount or 0),
                "bill_settled": bill_settled,
            },
            source_service="billing",
        )
        _outbox(db, event)
        await db.commit()
        await bus.publish(event, local=True)
        events.append("invoice.paid")
    reloaded = await _load_invoice(db, identity.tenant_id, inv.id)
    return {
        "message": "Settled" if fully else "Partially settled",
        "invoice": reloaded.model_dump() if reloaded else None,
        "status": status_value(inv.status),
        "remaining": float(max(Decimal("0"),
                              Decimal(str(inv.grand_total or 0))
                              - Decimal(str(inv.paid_amount or 0)))),
        "bill_settled": bill_settled,
        "events": events,
    }


@router.post("/invoices/{invoice_id}/void", response_model=InvoiceResponse,
             tags=["invoices"])
async def void_invoice(invoice_id: str, payload: InvoiceVoid,
                       identity: CurrentIdentity, db: DbDep):
    identity.require("manage:refunds")
    inv = await _resolve_invoice(db, identity.tenant_id, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not identity.can_access_outlet(inv.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")
    if float(inv.paid_amount or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Invoice has payments recorded; refund them before voiding",
        )
    inv.status = InvoiceStatus.VOID
    db.add(inv)
    event = Event(
        type="invoice.voided",
        tenant_id=identity.tenant_id,
        outlet_id=inv.outlet_id,
        data={
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "bill_id": str(inv.bill_id) if inv.bill_id else None,
            "reason": payload.reason,
        },
        source_service="billing",
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return await _load_invoice(db, identity.tenant_id, inv.id)


@router.post("/invoices/{invoice_id}/cancel", tags=["invoices"])
async def cancel_invoice(invoice_id: str, payload: InvoiceVoid,
                         identity: CurrentIdentity, db: DbDep):
    """Cancel = void with a reason (the retail cancelInvoice shape). Money
    never moves on a cancel; a paid invoice must be refunded, not cancelled."""
    identity.require("manage:refunds")
    inv = await _resolve_invoice(db, identity.tenant_id, invoice_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if status_value(inv.status) == InvoiceStatus.VOID.value:
        raise HTTPException(status_code=409, detail="This invoice is already void")
    if float(inv.paid_amount or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Invoice has payments recorded; refund them before cancelling",
        )
    inv.status = InvoiceStatus.VOID
    await db.flush()
    event = Event(
        type="invoice.voided",
        tenant_id=identity.tenant_id,
        outlet_id=inv.outlet_id,
        data={
            "invoice_id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "reason": payload.reason,
            "cancelled": True,
        },
        source_service="billing",
    )
    _outbox(db, event)
    await db.commit()
    await bus.publish(event, local=True)
    return {
        "status": status_value(inv.status),
        "invoice_id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "message": "Invoice cancelled",
        "restocked_items_count": 0,
    }


@router.post("/invoices/settlement/send-whatsapp", status_code=503,
             tags=["invoices"])
async def settle_whatsapp_stub():
    """WhatsApp delivery of a settlement receipt lands with the notifications
    service; the route exists so the UI's button degrades instead of 404ing."""
    return JSONResponse(
        status_code=503,
        content={"error": {"code": "NOTIFICATIONS_NOT_AVAILABLE",
                            "message": "WhatsApp delivery is not wired yet"}},
    )


# ─── Receipts (bill → print) ────────────────────────────────────────────────

@router.post("/receipts/{bill_id}/print", tags=["receipts"])
async def print_receipt(bill_id: str, identity: CurrentIdentity, db: DbDep,
                        escpos: bool = False,
                        size: str = "80mm",
                        template_id: str | None = None):
    """Thermal PDF (default) or raw ESC/POS bytes for a bill.

    ``escpos=true`` streams application/octet-stream bytes a 9100/9102 port
    or python-escpos's raw printer consumes; otherwise a PDF the browser
    prints on paper or sends to a thermal printer.
    """
    identity.require("view:bills")
    bill = await svc.load_bill(db, identity.tenant_id, _parse_uuid(bill_id) or uuid.UUID(bill_id))
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    if not identity.can_access_outlet(bill.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    payload = receipt_pdf.receipt_from_bill(
        bill.model_dump() if hasattr(bill, "model_dump") else _shallow(bill),
        [
            {
                "name": it.name,
                "variant_name": it.variant_name,
                "qty": int(it.qty or 1),
                "unit_price": float(it.unit_price or 0),
                "discount_amount": float(it.discount_amount or 0),
                "hsn_code": it.hsn_code,
                "tax_pct": float(it.tax_pct or 0),
                "line_total": float(it.line_total or 0),
            }
            for it in (bill.items or [])
        ],
    )

    template = None
    wanted = _parse_uuid(template_id)
    if wanted:
        row = await db.scalar(
            select(PrintTemplate).where(
                PrintTemplate.id == wanted,
                PrintTemplate.tenant_id == identity.tenant_id,
            )
        )
        template = _template_json(row)
    else:
        row = await _active_template(db, identity.tenant_id, "thermal", bill.outlet_id)
        template = _template_json(row)

    if escpos:
        data = receipt_pdf.escpos_receipt_bytes(payload, paper=size)
        return Response(
            content=data,
            media_type="application/octet-stream",
            headers={"Content-Disposition":
                     f'attachment; filename="{bill.bill_number}.escpos"'},
        )
    data = receipt_pdf.render_thermal_receipt(payload, template, paper=size)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition":
                 f'inline; filename="{bill.bill_number}.pdf"'},
    )


# ─── Sales returns ───────────────────────────────────────────────────────────

@router.get("/sales-returns", tags=["sales-returns"])
async def list_sales_returns(identity: CurrentIdentity, db: DbDep,
                            search: str | None = None,
                            date_from: str | None = None,
                            date_to: str | None = None,
                            company_id: str | None = None,
                            page: int = Query(1, ge=1),
                            page_size: int = Query(20, ge=1, le=500)):
    identity.require("view:bills")
    stmt = select(InvoiceReturn).where(
        InvoiceReturn.tenant_id == identity.tenant_id)
    if search:
        from sqlalchemy import or_
        stmt = stmt.where(or_(
            InvoiceReturn.return_number.ilike(f"%{search}%"),
            InvoiceReturn.invoice_number.ilike(f"%{search}%"),
            InvoiceReturn.customer_name.ilike(f"%{search}%"),
        ))
    if date_from:
        stmt = stmt.where(InvoiceReturn.return_date >= date_from)
    if date_to:
        stmt = stmt.where(InvoiceReturn.return_date <= date_to)
    total = int(await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = (
        await db.execute(
            stmt.order_by(InvoiceReturn.return_date.desc())
            .offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()
    items = [_return_response(r) for r in rows]
    return PaginatedResponse.build(items, total, page, page_size)


def _return_response(ret: InvoiceReturn) -> SalesReturnResponse:
    return SalesReturnResponse(
        id=ret.id,
        tenant_id=ret.tenant_id,
        outlet_id=ret.outlet_id,
        invoice_id=ret.invoice_id,
        invoice_number=ret.invoice_number,
        return_number=ret.return_number,
        customer_id=ret.customer_id,
        customer_name=ret.customer_name,
        customer_phone=ret.customer_phone,
        return_date=ret.return_date,
        settlement_method=ret.settlement_method,
        reason=ret.reason,
        notes=ret.notes,
        total_amount=float(ret.total_amount or 0),
        status=status_value(ret.status),
        exchange_invoice_id=ret.exchange_invoice_id,
        created_at=ret.created_at,
        items=[
            {
                "product_name": ln.description,
                "quantity": float(ln.qty),
                "unit_price": float(ln.unit_price or 0),
                "line_total": float(ln.line_total or 0),
                "disposition": ln.disposition,
            }
            for ln in (ret.lines or [])
        ],
    )


@router.get("/sales-returns/invoice/{invoice_ref}", tags=["sales-returns"])
async def returns_for_invoice(invoice_ref: str, identity: CurrentIdentity, db: DbDep):
    """Returns against one invoice, by id or number (the retail path
    percent-encodes the ref)."""
    identity.require("view:bills")
    inv = await _resolve_invoice(db, identity.tenant_id, invoice_ref)
    if inv is None:
        return []
    rows = (
        await db.execute(
            select(InvoiceReturn)
            .options(selectinload(InvoiceReturn.lines))
            .where(InvoiceReturn.invoice_id == inv.id,
                   InvoiceReturn.tenant_id == identity.tenant_id)
        )
    ).scalars().all()
    return [_return_response(r) for r in rows]


@router.get("/sales-returns/{return_id}", tags=["sales-returns"])
async def get_sales_return(return_id: str, identity: CurrentIdentity, db: DbDep):
    identity.require("view:bills")
    uid = _parse_uuid(return_id)
    if uid is None:
        raise HTTPException(status_code=404, detail="Return not found")
    ret = (
        await db.execute(
            select(InvoiceReturn)
            .options(selectinload(InvoiceReturn.lines))
            .where(InvoiceReturn.id == uid,
                   InvoiceReturn.tenant_id == identity.tenant_id)
        )
    ).scalars().first()
    if ret is None:
        raise HTTPException(status_code=404, detail="Return not found")
    return _return_response(ret)


@router.post("/sales-returns", status_code=201, tags=["sales-returns"])
async def create_sales_return(payload: SalesReturnCreate, identity: CurrentIdentity,
                              db: DbDep):
    """A return against a settled invoice: snapshot the items and, when the
    settlement method is a refund/credit, mark the invoice refunded. No
    inventory restock — food was served; a return is a money movement."""
    identity.require("manage:refunds")

    original: Invoice | None = None
    if payload.original_invoice_id:
        original = await _load_invoice(db, identity.tenant_id, payload.original_invoice_id)
    elif payload.original_invoice_number:
        original = await _resolve_invoice(db, identity.tenant_id,
                                          payload.original_invoice_number)
    if original is None and payload.original_invoice_id:
        original = await _load_invoice(db, identity.tenant_id,
                                       payload.original_invoice_id)

    items = payload.items
    total = _money0(sum(_item_value(it) for it in items))

    number = await svc.allocate_invoice_number(db, identity.tenant_id,
                                               _ret_outlet(original, payload.outlet_id),
                                               code="RET")
    ret = InvoiceReturn(
        tenant_id=identity.tenant_id,
        outlet_id=original.outlet_id if original else payload.outlet_id,
        invoice_id=original.id if original else None,
        invoice_number=original.invoice_number if original else payload.original_invoice_number,
        return_number=number,
        customer_id=original.customer_id if original else payload.customer_id,
        customer_name=payload.customer_name
                       or (original.customer_name if original else None),
        customer_phone=payload.customer_phone
                        or (original.customer_phone if original else None),
        return_date=payload.return_date or datetime.now(timezone.utc),
        settlement_method=payload.settlement_method or "refund",
        reason=payload.reason,
        notes=payload.notes,
        total_amount=total,
    )
    for it in items:
        ret.lines.append(InvoiceReturnLine(
            tenant_id=identity.tenant_id,
            return_id=None,
            menu_item_id=it.menu_item_id or it.product_id,
            description=str(it.product_name or "Item"),
            hsn_code=it.hsn_code,
            qty=Decimal(str(it.quantity or 1)),
            unit_price=Decimal(str(it.unit_price or 0)),
            tax_rate=Decimal(str(it.tax_rate or 0)),
            line_total=Decimal(str(_item_value(it))),
            disposition=it.disposition,
        ))
    db.add(ret)
    await db.flush()
    for ln in ret.lines:
        ln.return_id = ret.id
    await db.flush()

    if original is not None and total >= Decimal(str(original.grand_total or 0)) - Decimal("0.01"):
        original.status = InvoiceStatus.REFUNDED
    await db.commit()
    return _return_response(ret)


def _ret_outlet(original: Invoice | None, requested: uuid.UUID | None) -> uuid.UUID:
    if original is not None:
        return original.outlet_id
    return requested or uuid.UUID(int=0)


def _item_value(it) -> Decimal:
    qty = Decimal(str(getattr(it, "quantity", 1) or 1))
    price = Decimal(str(getattr(it, "unit_price", 0) or 0))
    tax_rate = Decimal(str(getattr(it, "tax_rate", 0) or 0))
    disc = Decimal(str(getattr(it, "discount_amount", 0) or 0))
    base = (qty * price - disc)
    if base < 0:
        base = Decimal("0")
    return (base * (Decimal("1") + tax_rate / Decimal("100"))).quantize(
        Decimal("0.01"))


def _money0(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


@router.post("/sales-returns/exchange", status_code=201,
             tags=["sales-returns"])
async def process_exchange(payload: SalesReturnExchangeCreate,
                           identity: CurrentIdentity, db: DbDep):
    """Minimal exchange: the original invoice is marked, a new invoice is
    created from exchange_items (GST recomputed through the shared math),
    and the return row ties the two together."""
    identity.require("manage:refunds")

    original = None
    if payload.original_invoice_id:
        original = await _load_invoice(db, identity.tenant_id,
                                       payload.original_invoice_id)
    elif payload.original_invoice_number:
        original = await _resolve_invoice(db, identity.tenant_id,
                                          payload.original_invoice_number)
    if original is None:
        raise HTTPException(status_code=404, detail="Original invoice not found")
    if not identity.can_access_outlet(original.outlet_id):
        raise HTTPException(status_code=403, detail="Not authorised for this outlet")

    # 1. The return half of the exchange.
    return_total = _money0(sum(_item_value(it) for it in payload.items))
    ret_number = await svc.allocate_invoice_number(
        db, identity.tenant_id, original.outlet_id, code="RET")
    ret = InvoiceReturn(
        tenant_id=identity.tenant_id,
        outlet_id=original.outlet_id,
        invoice_id=original.id,
        invoice_number=original.invoice_number,
        return_number=ret_number,
        customer_id=original.customer_id,
        customer_name=original.customer_name,
        customer_phone=original.customer_phone,
        return_date=payload.return_date or datetime.now(timezone.utc),
        settlement_method=payload.settlement_method or "exchange",
        reason=payload.reason,
        notes=payload.notes,
        total_amount=return_total,
    )
    for it in payload.items:
        ret.lines.append(InvoiceReturnLine(
            tenant_id=identity.tenant_id,
            return_id=None,
            menu_item_id=it.menu_item_id or it.product_id,
            description=str(it.product_name or "Item"),
            hsn_code=it.hsn_code,
            qty=Decimal(str(it.quantity or 1)),
            unit_price=Decimal(str(it.unit_price or 0)),
            line_total=Decimal(str(_item_value(it))),
            disposition=it.disposition or "exchanged",
        ))
    db.add(ret)
    await db.flush()

    # 2. The new invoice from the exchanged items, same customer, GST via the
    #    shared math (tax codes resolved for each line).
    ex_lines = [
        {
            "menu_item_id": it.menu_item_id or it.product_id,
            "description": str(it.product_name or "Item"),
            "qty": float(it.quantity or 1),
            "unit_price": float(it.unit_price or 0),
            "discount_amount": float(it.discount_amount or 0),
            "tax_code_id": None,
            "tax_rate": float(it.tax_rate or 0),
        }
        for it in payload.exchange_items
    ]
    rates = await _tax_code_rates(db, identity.tenant_id,
                                  [l["tax_code_id"] for l in ex_lines])
    ex_totals = svc.compute_invoice_totals(ex_lines, tax_rates=rates)
    ex_number = await svc.allocate_invoice_number(
        db, identity.tenant_id, original.outlet_id, code="EXC")
    ex_inv = Invoice(
        tenant_id=identity.tenant_id,
        outlet_id=original.outlet_id,
        invoice_number=ex_number,
        invoice_type=original.invoice_type,
        exchange_from_invoice_id=original.id,
        customer_id=original.customer_id,
        customer_name=original.customer_name,
        customer_phone=original.customer_phone,
        customer_gstin=original.customer_gstin,
        subtotal=ex_totals["subtotal"],
        discount_total=ex_totals["discount_total"],
        taxable_amount=ex_totals["taxable_amount"],
        tax_total=ex_totals["tax_total"],
        cgst_total=ex_totals["cgst_total"],
        sgst_total=ex_totals["sgst_total"],
        igst_total=ex_totals["igst_total"],
        cess_total=ex_totals["cess_total"],
        round_off=ex_totals["round_off"],
        grand_total=ex_totals["grand_total"],
        paid_amount=Decimal("0"),
        status=InvoiceStatus.DRAFT,
    )
    for i, line in enumerate(ex_lines):
        pl = ex_totals["per_line"][i] if i < len(ex_totals["per_line"]) else {}
        ex_inv.lines.append(InvoiceLine(
            tenant_id=identity.tenant_id,
            invoice_id=None,
            line_number=i + 1,
            menu_item_id=line["menu_item_id"],
            description=line["description"],
            qty=Decimal(str(line["qty"])),
            unit_price=Decimal(str(line["unit_price"])),
            discount_amount=Decimal(str(line["discount_amount"])),
            tax_rate=Decimal(str(line.get("tax_rate") or 0)),
            cgst=pl.get("cgst", Decimal("0")),
            sgst=pl.get("sgst", Decimal("0")),
            igst=pl.get("igst", Decimal("0")),
            cess=pl.get("cess", Decimal("0")),
            line_total=pl.get("line_total", Decimal("0")),
        ))
    db.add(ex_inv)
    await db.flush()
    for ln in ex_inv.lines:
        ln.invoice_id = ex_inv.id
    for ln in ret.lines:
        ln.return_id = ret.id
    ret.exchange_invoice_id = ex_inv.id

    await db.commit()
    return {
        "message": "Exchange recorded",
        "return": _return_response(ret),
        "exchange_invoice": {
            "id": str(ex_inv.id),
            "invoice_number": ex_inv.invoice_number,
            "grand_total": float(ex_inv.grand_total or 0),
            "status": status_value(ex_inv.status),
        },
    }


# ─── Print templates ─────────────────────────────────────────────────────────

@router.get("/print-templates", tags=["print-templates"])
async def list_print_templates(identity: CurrentIdentity, db: DbDep,
                               outlet_id: uuid.UUID | None = None,
                               category: str | None = None):
    """Templates per outlet (or all), optionally one category.

    Response carries ``templates`` (rows + their stored JSON merged) and
    ``active_map`` (category → active template id) — the shape
    syncPrintTemplatesFromBackend in the frontend consumes.
    """
    identity.require("view:bills")
    stmt = select(PrintTemplate).where(PrintTemplate.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(PrintTemplate.outlet_id == outlet_id)
    if category:
        stmt = stmt.where(PrintTemplate.category == category)
    rows = (await db.execute(stmt.order_by(PrintTemplate.category,
                                           PrintTemplate.created_at))) \
           .scalars().all()
    templates = []
    for r in rows:
        merged = _template_json(r)
        merged.setdefault("template_id", r.id)
        templates.append(merged)
    active_map: dict[str, str] = {}
    for r in rows:
        if r.active:
            active_map.setdefault(r.category, str(r.id))
    return {"templates": templates, "active_map": active_map,
            "tenant_id": str(identity.tenant_id)}


@router.post("/print-templates", status_code=201, tags=["print-templates"])
async def save_print_template(payload: PrintTemplateCreate,
                              identity: CurrentIdentity, db: DbDep):
    """Create or update. The whole template JSON is stored in ``fields`` so a
    round-trip loses nothing; name/paperSize are lifted to columns."""
    identity.require("manage:bills")
    tpl = payload.template or {}
    name = payload.name or tpl.get("name") or "Print template"
    paper = tpl.get("paperSize") or tpl.get("paper_size") or "80mm"
    category = payload.category or tpl.get("category") or "thermal"

    uid = _parse_uuid(str(tpl.get("id") or ""))
    if uid:
        row = await db.scalar(select(PrintTemplate).where(
            PrintTemplate.id == uid,
            PrintTemplate.tenant_id == identity.tenant_id))
        if row is not None:
            row.fields = tpl
            row.name = name
            row.paper_size = str(paper)[:5]
            row.category = category
            row.active = payload.set_as_default
            await _deactivate_siblings(db, identity.tenant_id, row)
            await db.commit()
            return {"success": True, "template": _template_json(row),
                    "active": str(row.id) if row.active else None}

    row = PrintTemplate(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        category=category,
        name=str(name)[:200],
        paper_size=str(paper)[:5],
        fields=tpl,
        active=payload.set_as_default,
    )
    db.add(row)
    await db.flush()
    if payload.set_as_default:
        await _deactivate_siblings(db, identity.tenant_id, row)
    await db.commit()
    return {"success": True, "template": _template_json(row),
            "active": str(row.id) if row.active else None}


@router.delete("/print-templates/{template_id}", tags=["print-templates"])
async def delete_print_template(template_id: str, identity: CurrentIdentity,
                                db: DbDep, category: str | None = None):
    uid = _parse_uuid(template_id)
    if uid is None:
        return {"success": True, "deleted": False}
    row = await db.scalar(select(PrintTemplate).where(
        PrintTemplate.id == uid,
        PrintTemplate.tenant_id == identity.tenant_id))
    if row is None:
        return {"success": True, "deleted": False}
    await db.delete(row)
    await db.commit()
    return {"success": True, "deleted": True}


@router.get("/print-template/active", tags=["print-templates"])
async def active_print_template(identity: CurrentIdentity, db: DbDep,
                                category: str = "thermal",
                                outlet_id: uuid.UUID | None = None):
    row = await _active_template(db, identity.tenant_id, category, outlet_id)
    if row is None:
        return {}
    return _template_json(row)


@router.post("/print-template/active", tags=["print-templates"])
async def set_active_print_template(payload: SetActivePrintTemplate,
                                    identity: CurrentIdentity, db: DbDep):
    """Activate one template; deactivate its siblings in the same category."""
    identity.require("manage:bills")
    row = await db.scalar(select(PrintTemplate).where(
        PrintTemplate.id == payload.template_id,
        PrintTemplate.tenant_id == identity.tenant_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Template not found")
    row.active = True
    row.category = payload.category
    await _deactivate_siblings(db, identity.tenant_id, row)
    await db.commit()
    return {"success": True, "active": str(row.id)}


async def _active_template(db: AsyncSession, tenant_id: uuid.UUID, category: str,
                           outlet_id: uuid.UUID | None) -> PrintTemplate | None:
    """Outlet-specific active first, tenant-wide second, then any active in
    the category. The frontend's per-outlet default semantics."""
    if outlet_id:
        row = await db.scalar(select(PrintTemplate).where(
            PrintTemplate.tenant_id == tenant_id,
            PrintTemplate.outlet_id == outlet_id,
            PrintTemplate.category == category,
            PrintTemplate.active.is_(True)))
        if row:
            return row
    row = await db.scalar(select(PrintTemplate).where(
        PrintTemplate.tenant_id == tenant_id,
        PrintTemplate.outlet_id.is_(None),
        PrintTemplate.category == category,
        PrintTemplate.active.is_(True)))
    if row:
        return row
    row = await db.scalar(select(PrintTemplate).where(
        PrintTemplate.tenant_id == tenant_id,
        PrintTemplate.category == category,
        PrintTemplate.active.is_(True)).order_by(PrintTemplate.created_at.desc()))
    return row


async def _deactivate_siblings(db: AsyncSession, tenant_id: uuid.UUID,
                               row: PrintTemplate) -> None:
    """Only one active template per (outlet-scope, category). Siblings share
    the outlet_id (including NULL) and category; the target keeps its flag.
    """
    stmt = select(PrintTemplate).where(
        PrintTemplate.tenant_id == tenant_id,
        PrintTemplate.category == row.category,
        PrintTemplate.active.is_(True),
        PrintTemplate.id != row.id,
    )
    if row.outlet_id is None:
        stmt = stmt.where(PrintTemplate.outlet_id.is_(None))
    else:
        stmt = stmt.where(PrintTemplate.outlet_id == row.outlet_id)
    for sib in (await db.execute(stmt)).scalars().all():
        sib.active = False


# ─── Payment reminders (stubs) ───────────────────────────────────────────────

@router.get("/reminders/policy", tags=["reminders"])
async def get_reminder_policy(identity: CurrentIdentity, db: DbDep,
                              outlet_id: uuid.UUID | None = None):
    outlet = outlet_id or identity.active_outlet_id
    row = await db.scalar(select(ReminderPolicy).where(
        ReminderPolicy.tenant_id == identity.tenant_id,
        ReminderPolicy.outlet_id == outlet))
    return (row.policy if row and row.policy else dict(DEFAULT_POLICY))


@router.put("/reminders/policy", tags=["reminders"])
@router.post("/reminders/policy", tags=["reminders"])
async def save_reminder_policy(payload: ReminderPolicyIn,
                               identity: CurrentIdentity, db: DbDep):
    """One policy row per outlet; upsert, not append. The notifications
    service reads these when it lands."""
    identity.require("manage:bills")
    outlet = payload.outlet_id or identity.active_outlet_id
    policy = {
        "enabled": payload.enabled,
        "channels": payload.channels,
        "days_before_due": payload.days_before_due,
        "reminder_frequency_days": payload.reminder_frequency_days,
        "notes": payload.notes,
    }
    row = await db.scalar(select(ReminderPolicy).where(
        ReminderPolicy.tenant_id == identity.tenant_id,
        ReminderPolicy.outlet_id == outlet))
    if row is None:
        row = ReminderPolicy(tenant_id=identity.tenant_id, outlet_id=outlet,
                             policy=policy)
        db.add(row)
    else:
        row.policy = policy
    await db.commit()
    return {"message": "Policy saved"}


@router.get("/reminders/summary", tags=["reminders"])
async def reminder_summary(identity: CurrentIdentity, db: DbDep):
    """How much is owed and how many invoices are overdue — the number the
    reminder screen shows. No sending happens here."""
    identity.require("view:bills")
    open_stmt = select(Invoice).where(
        Invoice.tenant_id == identity.tenant_id,
        Invoice.status.in_([InvoiceStatus.DRAFT.value, InvoiceStatus.PARTIAL.value]))
    rows = (await db.execute(open_stmt)).scalars().all()
    now = datetime.now(timezone.utc)
    overdue = [i for i in rows
               if (i.dated or i.created_at) < now and
               max(Decimal("0"), Decimal(str(i.grand_total or 0))
                   - Decimal(str(i.paid_amount or 0))) > 0]
    return {
        "open_count": len(rows),
        "overdue_count": len(overdue),
        "total_pending": round(sum(
            max(0.0, float(i.grand_total or 0) - float(i.paid_amount or 0))
            for i in rows), 2),
        "overdue_pending": round(sum(
            max(0.0, float(i.grand_total or 0) - float(i.paid_amount or 0))
            for i in overdue), 2),
    }


@router.post("/reminders/evaluate-batch", status_code=503, tags=["reminders"])
async def evaluate_batch_stub():
    return JSONResponse(
        status_code=503,
        content={"error": {"code": "NOTIFICATIONS_NOT_AVAILABLE",
                           "message": "Reminder evaluation lands with the notifications service"}},
    )


@router.post("/reminders/logs", status_code=503, tags=["reminders"])
@router.get("/reminders/logs", tags=["reminders"])
async def reminder_logs_stub(identity: CurrentIdentity, db: DbDep,
                             channel: str | None = None, limit: int = 100):
    """No reminder rows exist yet; an empty list keeps the UI's table honest
    instead of 404ing."""
    identity.require("view:bills")
    return []


@router.post("/reminders/invoices/{invoice_id}/send-now", status_code=503,
             tags=["reminders"])
async def send_now_stub(invoice_id: str, identity: CurrentIdentity, db: DbDep,
                         custom_note: str | None = None):
    """Stubs are useful when the caller's flow expects *some* answer: 0 sent,
    a clear reason. The notifications service replaces this route."""
    return JSONResponse(
        status_code=503,
        content={"error": {"code": "NOTIFICATIONS_NOT_AVAILABLE",
                           "message": "No reminders were sent — the notifications "
                                      "service is not wired yet.",
                           "sent": 0}},
    )


# ─── Payment gateways (stubs until keys are configured) ─────────────────────

def _gateway_key_material(row: GatewayConfig | None) -> dict:
    """Configured = a real key id AND a secret, stored by this tenant."""
    if row is None:
        return {}
    creds = dict(row.config or {})
    return {k: v for k, v in creds.items() if v}


@router.get("/gateways/config", tags=["payments"])
async def list_gateway_configs(identity: CurrentIdentity, db: DbDep,
                               company_id: str | None = None,
                               outlet_id: uuid.UUID | None = None):
    """Per-gateway config rows, with an ``enabled`` flag that is true only
    when usable key material is actually stored — an empty config row is
    disabled, not a live gateway."""
    identity.require("process:payments")
    rows = (
        await db.execute(
            select(GatewayConfig).where(
                GatewayConfig.tenant_id == identity.tenant_id,
                GatewayConfig.gateway.in_(["razorpay", "pinelabs"]),
            )
        )
    ).scalars().all()
    out = []
    for row in rows:
        dto = GatewayConfigResponse.model_validate(row)
        material = _gateway_key_material(row)
        dto.is_enabled = bool(row.is_enabled) and bool(material)
        out.append(dto)
    return out


@router.put("/gateways/{gateway_id}/config", tags=["payments"])
async def save_gateway_config(gateway_id: str, payload: GatewayConfigIn,
                              identity: CurrentIdentity, db: DbDep):
    identity.require("process:payments")
    config = dict(payload.credentials or {})
    if payload.settings:
        config.update(payload.settings)
    row = await db.scalar(select(GatewayConfig).where(
        GatewayConfig.tenant_id == identity.tenant_id,
        GatewayConfig.gateway == gateway_id,
        GatewayConfig.outlet_id == payload.outlet_id))
    if row is None:
        row = GatewayConfig(tenant_id=identity.tenant_id, gateway=gateway_id,
                            outlet_id=payload.outlet_id)
        db.add(row)
    row.is_enabled = payload.is_enabled
    row.is_test_mode = payload.is_test_mode
    row.config = config
    await db.commit()
    return {"success": True, "message": "Gateway config saved",
            "config_id": str(row.id)}


@router.post("/gateways/{gateway_id}/test-connection", tags=["payments"])
async def test_gateway_connection(gateway_id: str, identity: CurrentIdentity,
                                  db: DbDep,
                                  credentials: dict | None = None):
    """No live network call from this service yet: report the credential
    state honestly. A gateway with no keys is 'not configured', not 'down'."""
    identity.require("process:payments")
    material = dict(credentials or {})
    row = await db.scalar(select(GatewayConfig).where(
        GatewayConfig.tenant_id == identity.tenant_id,
        GatewayConfig.gateway == gateway_id))
    material.update(_gateway_key_material(row))
    if not material:
        return {"success": False,
                "message": f"{gateway_id} has no stored credentials"}
    return {"success": False,
            "message": f"{gateway_id} credentials stored; live connectivity "
                       f"test is not wired yet"}


def _not_configured(gateway: str) -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={"error": {"code": "GATEWAY_NOT_CONFIGURED",
                           "message": f"{gateway} gateway keys are not configured "
                                      f"for this tenant; no order was created"}},
    )


async def _gateway_material(db: AsyncSession, tenant_id: uuid.UUID, gateway: str,
                            outlet_id: uuid.UUID | None = None) -> dict:
    """The best (most specific) config row's stored credentials."""
    for scope in ([outlet_id] if outlet_id else []) + [None]:
        row = await db.scalar(select(GatewayConfig).where(
            GatewayConfig.tenant_id == tenant_id,
            GatewayConfig.gateway == gateway,
            GatewayConfig.outlet_id == scope,
        ))
        if row is not None:
            return _gateway_key_material(row)
    return {}


@router.post("/razorpay/create-order", status_code=501, tags=["payments"])
async def razorpay_create_order(payload: RazorpayOrderCreate,
                                identity: CurrentIdentity, db: DbDep):
    """An honest order: persisted in this service, verifiable later.

    The order id is ours (rzp_<uuid>) until a live Razorpay key is stored —
    the frontend's checkout init and the verify endpoint both read it from
    here, and /verify checks the stored row before trusting a signature.
    """
    identity.require("process:payments")
    material = await _gateway_material(db, identity.tenant_id, "razorpay",
                                       payload.outlet_id)
    amount = round(float(payload.amount) * 100)  # paise
    order_id = f"rzp_{uuid.uuid4().hex}"
    order = PaymentGatewayOrder(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        gateway="razorpay",
        order_id=order_id,
        amount=float(payload.amount),
        currency=payload.currency.upper(),
        status="created",
        notes=dict(payload.notes or {}),
    )
    db.add(order)
    await db.commit()
    return {
        "id": order_id,
        "entity": "order",
        "amount": amount,
        "amount_paid": 0,
        "amount_due": amount,
        "currency": payload.currency.upper(),
        "receipt": payload.receipt,
        "status": "created",
        "key_id": material.get("key_id", ""),
        "notes": dict(payload.notes or {}),
        "configured": bool(material),
    }


@router.post("/razorpay/verify", status_code=501, tags=["payments"])
async def razorpay_verify(payload: RazorpayVerifyRequest,
                          identity: CurrentIdentity, db: DbDep):
    """Verify a checkout signature. With no stored key secret the gateway
    cannot be verified — a 501 GATEWAY_NOT_CONFIGURED, never a fake success.
    The order must exist in this tenant's order table before any signature
    is even considered."""
    identity.require("process:payments")
    order = await db.scalar(select(PaymentGatewayOrder).where(
        PaymentGatewayOrder.tenant_id == identity.tenant_id,
        PaymentGatewayOrder.order_id == payload.order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    material = await _gateway_material(db, identity.tenant_id, "razorpay",
                                      order.outlet_id)
    secret = material.get("key_secret") or material.get("secret")
    if not secret:
        return _not_configured("razorpay")

    import hashlib
    import hmac
    message = f"{order.order_id}|{payload.payment_id}".encode()
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    ok = hmac.compare_digest(expected, payload.signature or "")
    if ok:
        order.status = "paid"
        order.payment_id = payload.payment_id
        await db.commit()
    return {
        "success": ok,
        "message": "Payment verified" if ok else "Signature mismatch",
        "order_id": order.order_id,
        "payment_id": payload.payment_id or "",
        "status": order.status,
        "amount": float(order.amount or 0),
    }


@router.post("/razorpay/create-link", status_code=501, tags=["payments"])
async def razorpay_create_link_stub(identity: CurrentIdentity, db: DbDep):
    return _not_configured("razorpay")


@router.get("/razorpay/orders/{order_id}/status", tags=["payments"])
async def razorpay_order_status(order_id: str, identity: CurrentIdentity,
                                db: DbDep, company_id: str | None = None):
    """Status of an order this service created; 404 for foreign order ids."""
    identity.require("process:payments")
    order = await db.scalar(select(PaymentGatewayOrder).where(
        PaymentGatewayOrder.tenant_id == identity.tenant_id,
        PaymentGatewayOrder.order_id == order_id,
        PaymentGatewayOrder.gateway == "razorpay"))
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    is_paid = order.status == "paid"
    return {
        "order_id": order.order_id,
        "status": order.status,
        "amount_paid": float(order.amount or 0) if is_paid else 0.0,
        "is_paid": is_paid,
        "captured_payment_id": order.payment_id,
        "payment_method": "online" if is_paid else None,
    }


@router.get("/razorpay/links/{link_id}/status", status_code=501,
            tags=["payments"])
async def razorpay_link_status_stub(link_id: str, identity: CurrentIdentity,
                                    db: DbDep, company_id: str | None = None):
    return _not_configured("razorpay")


@router.post("/razorpay/create-qr", status_code=501, tags=["payments"])
async def razorpay_create_qr_stub(identity: CurrentIdentity, db: DbDep):
    return _not_configured("razorpay")


@router.get("/razorpay/qr/{qr_id}/status", status_code=501, tags=["payments"])
async def razorpay_qr_status_stub(qr_id: str, identity: CurrentIdentity,
                                  db: DbDep, company_id: str | None = None):
    return _not_configured("razorpay")


@router.post("/pinelabs/charge", status_code=501, tags=["payments"])
async def pinelabs_charge(payload: PineLabsChargeRequest,
                          identity: CurrentIdentity, db: DbDep):
    """Terminal charge: needs a live terminal + PineLabs credentials.
    No keys → 501, the honest answer."""
    identity.require("process:payments")
    material = await _gateway_material(db, identity.tenant_id, "pinelabs",
                                       payload.outlet_id)
    if not material:
        return _not_configured("pinelabs")
    transaction_id = f"plabs_{uuid.uuid4().hex[:16]}"
    return {
        "status": "PENDING",
        "success": True,
        "transaction_id": transaction_id,
        "terminal_id": payload.terminal_id or material.get("terminal_id", ""),
        "merchant_id": material.get("merchant_id", ""),
        "amount": float(payload.amount),
        "bill_number": payload.bill_number,
        "message": "Charge queued against stored PineLabs config; the live "
                   "terminal handshake is not wired yet",
        "response_code": "PENDING",
    }


@router.post("/pinelabs/cancel", tags=["payments"])
async def pinelabs_cancel_stub(identity: CurrentIdentity, db: DbDep):
    return {"success": False, "message": "PineLabs terminal handshake is not "
                                         "wired yet"}


@router.post("/pinelabs/void", tags=["payments"])
async def pinelabs_void_stub(identity: CurrentIdentity, db: DbDep):
    return {"success": False, "message": "PineLabs terminal handshake is not "
                                         "wired yet"}


@router.post("/pinelabs/settle", tags=["payments"])
async def pinelabs_settle_stub(identity: CurrentIdentity, db: DbDep):
    return {"success": False, "message": "PineLabs batch settle is not wired yet"}
