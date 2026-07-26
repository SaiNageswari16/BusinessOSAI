"""Accounts Receivable — Invoices, Payments, Returns."""
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models.erp import Invoice, InvoiceLine, InvoicePayment, InvoiceReturn
from src.schemas.erp_accounting import (
    InvoiceCreate,
    InvoiceLineCreate,
    InvoiceLineResponse,
    InvoicePaymentCreate,
    InvoicePaymentResponse,
    InvoiceResponse,
    InvoiceUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/invoices", tags=["Invoices & AR"])


def _compute_invoice_totals(payload_lines: list[InvoiceLineCreate]) -> dict:
    subtotal = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_igst = 0.0
    total_tds = 0.0
    discount_amt = 0.0

    for line in payload_lines:
        qty = line.quantity
        price = line.unit_price
        line_gross = qty * price

        d_amt = 0.0
        if line.discount_type == "percent" and line.discount_value:
            d_amt = line_gross * (line.discount_value / 100)
        elif line.discount_type == "amount" and line.discount_value:
            d_amt = min(line.discount_value, line_gross)

        taxable = line_gross - d_amt
        tax = taxable * (line.tax_rate / 100)

        subtotal += line_gross
        discount_amt += d_amt
        total_cgst += tax / 2
        total_sgst += tax / 2
        total_igst += tax

    round_off = round(subtotal - discount_amt + total_cgst + total_sgst + total_igst) - (
        subtotal - discount_amt + total_cgst + total_sgst + total_igst
    )
    total = subtotal - discount_amt + total_cgst + total_sgst + total_igst + round_off

    return dict(
        subtotal=round(subtotal, 2),
        discount_amount=round(discount_amt, 2),
        cgst_amount=round(total_cgst, 2),
        sgst_amount=round(total_sgst, 2),
        igst_amount=round(total_igst, 2),
        tds_amount=round(total_tds, 2),
        round_off=round(round_off, 2),
        total_amount=round(total, 2),
        balance_due=round(total, 2),
    )


@router.get("", response_model=PaginatedResponse[InvoiceResponse])
async def list_invoices(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    invoice_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
):
    query = select(Invoice).where(Invoice.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(Invoice.status == status_filter)
    if invoice_type:
        query = query.where(Invoice.invoice_type == invoice_type)
    if date_from:
        query = query.where(Invoice.invoice_date >= date_from)
    if date_to:
        query = query.where(Invoice.invoice_date <= date_to)
    if search:
        query = query.where(
            Invoice.invoice_number.ilike(f"%{search}%")
            | Invoice.customer_name.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Invoice.invoice_date.desc())
        .options(selectinload(Invoice.lines))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invoice = await db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id, Invoice.tenant_id == ctx.tenant_id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post(
    "",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invoice(
    payload: InvoiceCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    totals = _compute_invoice_totals(payload.lines)

    from src.utils.number_series import generate_number

    invoice_number = generate_number(db, ctx.tenant_id, "invoice", payload.company_id)

    invoice = Invoice(
        tenant_id=ctx.tenant_id,
        invoice_number=invoice_number,
        status="draft",
        currency_code=payload.currency_code,
        exchange_rate=payload.exchange_rate,
        **totals,
        **payload.model_dump(exclude={"lines"}),
    )
    db.add(invoice)
    await db.flush()

    for idx, line_payload in enumerate(payload.lines):
        line = InvoiceLine(invoice_id=invoice.id, line_number=idx + 1, **line_payload.model_dump())
        db.add(line)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="invoice_created",
        entity_type="invoice",
        entity_id=invoice.id,
        new_values={"invoice_number": invoice_number, "total": str(totals["total_amount"])},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invoice = await db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.lines))
        .where(Invoice.id == invoice_id, Invoice.tenant_id == ctx.tenant_id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status in ("paid", "voided", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot update a {invoice.status} invoice")

    updates = payload.model_dump(exclude_unset=True, exclude={"lines"})
    old_values = {k: getattr(invoice, k) for k in updates}
    for key, value in updates.items():
        setattr(invoice, key, value)

    if payload.lines is not None:
        for old_line in list(invoice.lines):
            await db.delete(old_line)

        for idx, line_payload in enumerate(payload.lines):
            line = InvoiceLine(invoice_id=invoice.id, line_number=idx + 1, **line_payload.model_dump())
            db.add(line)

        totals = _compute_invoice_totals(payload.lines)
        for k, v in totals.items():
            setattr(invoice, k, v)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="invoice_updated",
        entity_type="invoice",
        entity_id=invoice.id,
        old_values=old_values,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/approve")
async def approve_invoice(
    invoice_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invoice = await db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == ctx.tenant_id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = "sent"
    invoice.is_approved = True
    invoice.approved_by_user_id = ctx.user.id
    invoice.approved_at = datetime.now()

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="invoice_approved",
        entity_type="invoice",
        entity_id=invoice.id,
        new_values={"invoice_number": invoice.invoice_number},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"status": "approved", "invoice_number": invoice.invoice_number}


@router.post("/{invoice_id}/payments", response_model=InvoicePaymentResponse, status_code=status.HTTP_201_CREATED)
async def add_payment(
    invoice_id: uuid.UUID,
    payload: InvoicePaymentCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoice_payments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invoice = await db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == ctx.tenant_id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    remaining = invoice.balance_due - invoice.amount_paid
    if payload.amount > remaining + 0.01:
        raise HTTPException(status_code=400, detail="Payment exceeds balance due")

    payment = InvoicePayment(invoice_id=invoice_id, **payload.model_dump())
    db.add(payment)

    invoice.amount_paid = round(invoice.amount_paid + payload.amount, 2)
    invoice.balance_due = round(invoice.balance_due - payload.amount, 2)

    if invoice.balance_due <= 0.01:
        invoice.status = "paid"
    elif invoice.amount_paid > 0:
        invoice.status = "partially_paid"

    if invoice.due_date < date.today() and invoice.balance_due > 0.01:
        invoice.status = "overdue"

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="invoice_payment_added",
        entity_type="invoice",
        entity_id=invoice.id,
        new_values={"amount": str(payload.amount), "payment_method": payload.payment_method},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(payment)
    return payment


@router.post("/{invoice_id}/void", response_model=InvoiceResponse)
async def void_invoice(
    invoice_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("approve:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invoice = await db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == ctx.tenant_id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status in ("paid",):
        raise HTTPException(status_code=400, detail="Cannot void a paid invoice")

    invoice.status = "voided"

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="invoice_voided",
        entity_type="invoice",
        entity_id=invoice.id,
        new_values={"invoice_number": invoice.invoice_number},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(invoice)
    return invoice
