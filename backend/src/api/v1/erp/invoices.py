"""Accounts Receivable — Invoices, Payments, Returns."""
import logging
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import Customer, CustomerWallet, CustomerWalletTransaction, Product
from src.models.inventory import InventoryBatch
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
from src.services.invoice_pdf import save_invoice_pdf, get_active_invoice_template
from src.services.whatsapp_invoice_sender import send_invoice_whatsapp, send_payment_receipt_whatsapp
from src.utils.pagination import PaginatedResponse, paginate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/invoices", tags=["Invoices & AR"])


def _compute_invoice_totals(payload_lines: list[InvoiceLineCreate], is_interstate: bool = False) -> dict:
    subtotal = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_igst = 0.0
    total_tds = 0.0
    discount_amt = 0.0
    total_tax = 0.0

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
        total_tax += tax
        if is_interstate:
            total_igst += tax
        else:
            total_cgst += tax / 2
            total_sgst += tax / 2

    taxable_net = subtotal - discount_amt
    total_before_round = taxable_net + total_tax
    round_off = round(total_before_round) - total_before_round
    total = round(total_before_round + round_off, 2)

    return dict(
        subtotal=round(subtotal, 2),
        discount_amount=round(discount_amt, 2),
        cgst_amount=round(total_cgst, 2),
        sgst_amount=round(total_sgst, 2),
        igst_amount=round(total_igst, 2),
        tds_amount=round(total_tds, 2),
        round_off=round(round_off, 2),
        total_amount=total,
        balance_due=total,
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
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/customer-summary/{customer_id}")
async def get_customer_invoice_summary(
    customer_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    phone: str | None = None,
):
    query_conds = [Invoice.tenant_id == ctx.tenant_id]
    try:
        c_uuid = uuid.UUID(str(customer_id))
        if phone:
            query_conds.append((Invoice.customer_id == c_uuid) | (Invoice.customer_phone == phone))
        else:
            query_conds.append(Invoice.customer_id == c_uuid)
    except (ValueError, AttributeError):
        if phone:
            query_conds.append((Invoice.customer_name.ilike(f"%{customer_id}%")) | (Invoice.customer_phone == phone))
        else:
            query_conds.append((Invoice.customer_name.ilike(f"%{customer_id}%")) | (Invoice.customer_phone.ilike(f"%{customer_id}%")))

    res = await db.execute(
        select(Invoice)
        .where(*query_conds)
        .order_by(Invoice.invoice_date.desc())
    )
    invoices = res.scalars().all()

    total_invoices = len(invoices)
    total_spent = sum(float(inv.total_amount or 0) for inv in invoices)

    unpaid_invoices = []
    total_pending_due = 0.0

    for inv in invoices:
        raw_status = str(inv.status or "").lower().strip()
        pay_st = str(inv.payment_status or "").lower().strip()
        tot = float(inv.total_amount or 0)
        paid = float(inv.amount_paid or 0)

        # Ignore invoices that are fully settled, paid, or voided
        if raw_status in ("paid", "voided", "cancelled", "completed") or pay_st in ("paid", "voided", "cancelled", "completed") or (tot > 0 and paid >= tot - 0.05):
            continue

        due = float(inv.balance_due) if (inv.balance_due is not None and float(inv.balance_due) > 0) else max(0.0, tot - paid)
        if due > 0.05:
            total_pending_due += due
            unpaid_invoices.append({
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                "total_amount": round(tot, 2),
                "balance_due": round(due, 2),
                "status": str(inv.status),
            })

    last_purchase_date = invoices[0].invoice_date.isoformat() if (invoices and invoices[0].invoice_date) else None

    return {
        "customer_id": str(customer_id),
        "total_invoices": total_invoices,
        "total_spent": round(total_spent, 2),
        "total_pending_due": round(total_pending_due, 2),
        "last_purchase_date": last_purchase_date,
        "unpaid_invoices": unpaid_invoices,
    }


async def _lookup_invoice(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    invoice_id_or_number: str | uuid.UUID,
    include_relations: bool = True
) -> Invoice | None:
    stmt = select(Invoice)
    if include_relations:
        stmt = stmt.options(selectinload(Invoice.lines), selectinload(Invoice.payments))

    # Try direct UUID
    try:
        val_uuid = uuid.UUID(str(invoice_id_or_number))
        inv = await db.scalar(stmt.where(Invoice.id == val_uuid, Invoice.tenant_id == tenant_id))
        if inv:
            return inv
    except (ValueError, AttributeError):
        pass

    # Try invoice_number, reference_number, or order_number
    str_val = str(invoice_id_or_number).strip()
    inv = await db.scalar(
        stmt.where(
            (Invoice.invoice_number.ilike(str_val) |
             Invoice.reference_number.ilike(str_val) |
             Invoice.order_number.ilike(str_val)),
            Invoice.tenant_id == tenant_id
        )
    )
    return inv


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invoice = await _lookup_invoice(db, ctx.tenant_id, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


# ---------------------------------------------------------------------------
# Invoice CRUD
# ---------------------------------------------------------------------------

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
    background_tasks: BackgroundTasks,
):
    totals = _compute_invoice_totals(payload.lines)
    total_amt = float(totals["total_amount"])

    if payload.invoice_number and payload.invoice_number.strip():
        invoice_number = payload.invoice_number.strip()
    else:
        from src.utils.number_series import generate_number
        prefix_type = "estimate" if str(payload.invoice_type).upper() in ["ESTIMATE", "PROFORMA", "CASH_MEMO", "NON_GST"] else "invoice"
        try:
            invoice_number = await generate_number(db, ctx.tenant_id, prefix_type, payload.company_id)
        except Exception:
            seq = int(datetime.now().timestamp()) % 100000
            prefix = "EST" if prefix_type == "estimate" else "INV"
            invoice_number = f"{prefix}-{seq:05d}"

    inv_kwargs = payload.model_dump(exclude={"lines", "payment_status", "payment_method", "amount_paid", "amount_received"})

    paid_input = float(payload.amount_paid if payload.amount_paid is not None else (payload.amount_received if payload.amount_received is not None else 0.0))
    p_status_upper = (payload.payment_status or "").upper()
    is_credit = bool(payload.payment_method and payload.payment_method.lower() == "credit") or p_status_upper == "UNPAID"

    if is_credit and paid_input <= 0:
        initial_status = "draft"
        actual_paid = 0.0
        actual_due = total_amt
    elif p_status_upper == "PAID" or paid_input >= total_amt - 0.01:
        initial_status = "paid"
        actual_paid = total_amt
        actual_due = 0.0
    elif p_status_upper == "PARTIAL" or (paid_input > 0 and paid_input < total_amt):
        initial_status = "partially_paid"
        actual_paid = paid_input
        actual_due = max(0.0, total_amt - paid_input)
    elif payload.payment_method and payload.payment_method.lower() not in ["credit", "pay later"]:
        initial_status = "paid"
        actual_paid = total_amt
        actual_due = 0.0
    else:
        initial_status = "draft"
        actual_paid = 0.0
        actual_due = total_amt

    inv_kwargs.update({
        "tenant_id": ctx.tenant_id,
        "invoice_number": invoice_number,
        **totals,
        "status": initial_status,
        "amount_paid": actual_paid,
        "balance_due": actual_due,
    })

    invoice = Invoice(**inv_kwargs)
    db.add(invoice)
    await db.flush()

    # Handle automatic Customer Wallet deduction if paid via Wallet
    is_wallet_payment = bool(
        payload.payment_method and "wallet" in payload.payment_method.lower()
    )
    if is_wallet_payment and payload.customer_id and actual_paid > 0:
        wallet = await db.scalar(
            select(CustomerWallet).where(
                CustomerWallet.customer_id == payload.customer_id,
                CustomerWallet.tenant_id == ctx.tenant_id
            ).with_for_update()
        )
        if not wallet:
            wallet = CustomerWallet(
                tenant_id=ctx.tenant_id,
                customer_id=payload.customer_id,
                balance=0.0
            )
            db.add(wallet)
            await db.flush()

        # Debit customer wallet balance (allows negative / debit balance)
        wallet.balance = float(wallet.balance or 0.0) - actual_paid

        tx = CustomerWalletTransaction(
            tenant_id=ctx.tenant_id,
            wallet_id=wallet.id,
            transaction_type="payment",
            amount=actual_paid,
            balance_after=wallet.balance,
            reference_type="invoice",
            reference_id=invoice_number,
            description=f"Payment for Sales Invoice #{invoice_number} ({initial_status})",
        )
        db.add(tx)

        cust = await db.scalar(
            select(Customer).where(
                Customer.id == payload.customer_id,
                Customer.tenant_id == ctx.tenant_id
            ).with_for_update()
        )
        if cust:
            cust.wallet_balance = wallet.balance

        inv_pay = InvoicePayment(
            tenant_id=ctx.tenant_id,
            invoice_id=invoice.id,
            payment_date=invoice.invoice_date,
            amount=actual_paid,
            payment_method="wallet",
            reference_number=f"PAY-{invoice_number}",
            notes=f"Paid via Customer Wallet ({initial_status})",
        )
        db.add(inv_pay)
    elif actual_paid > 0 and not is_credit:
        # Record upfront initial payment (Cash, UPI, Card, etc.)
        inv_pay = InvoicePayment(
            tenant_id=ctx.tenant_id,
            invoice_id=invoice.id,
            payment_date=invoice.invoice_date,
            amount=actual_paid,
            payment_method=(payload.payment_method or "cash").lower(),
            reference_number=f"PAY-{invoice_number}",
            notes=f"Upfront payment for Sales Invoice #{invoice_number} ({initial_status})",
        )
        db.add(inv_pay)

    for idx, line_payload in enumerate(payload.lines):
        line_dict = line_payload.model_dump()
        qty = line_dict.get("quantity", 1.0) or 1.0
        price = line_dict.get("unit_price", 0.0) or 0.0
        gross = qty * price

        d_val = line_dict.get("discount_value", 0.0) or 0.0
        d_type = line_dict.get("discount_type")
        d_amt = 0.0
        if d_type == "percent" and d_val:
            d_amt = gross * (d_val / 100)
        elif d_type == "amount" and d_val:
            d_amt = min(d_val, gross)

        taxable = gross - d_amt
        tax_rate = line_dict.get("tax_rate", 0.0) or 0.0
        tax = taxable * (tax_rate / 100)

        line_dict.update({
            "discount_amount": round(d_amt, 2),
            "taxable_amount": round(taxable, 2),
            "cgst_amount": round(tax / 2, 2),
            "sgst_amount": round(tax / 2, 2),
            "igst_amount": round(tax, 2),
            "line_total": round(taxable + tax, 2),
        })
        line = InvoiceLine(invoice_id=invoice.id, line_number=idx + 1, **line_dict)
        db.add(line)

        # Real-time stock & batch deduction across inventory
        target_product_id = line_dict.get("product_id") or line_dict.get("item_id")
        prod = None
        if target_product_id:
            try:
                # Convert string to UUID if possible
                valid_uid = uuid.UUID(str(target_product_id)) if isinstance(target_product_id, str) else target_product_id
                prod_res = await db.execute(
                    select(Product).where(Product.id == valid_uid, Product.tenant_id == ctx.tenant_id).with_for_update()
                )
                prod = prod_res.scalar_one_or_none()
            except Exception as e:
                logger.debug(f"Direct product ID lookup failed: {e}")

        # Fallback: lookup by barcode/SKU or product name if ID didn't resolve
        if not prod:
            sku_or_barcode = line_dict.get("product_sku") or line_dict.get("sku") or line_dict.get("barcode")
            prod_name = line_dict.get("product_name")
            if sku_or_barcode:
                prod_res = await db.execute(
                    select(Product).where(
                        (Product.barcode == str(sku_or_barcode)) | (Product.sku == str(sku_or_barcode)),
                        Product.tenant_id == ctx.tenant_id
                    ).with_for_update()
                )
                prod = prod_res.scalar_one_or_none()
            if not prod and prod_name:
                prod_res = await db.execute(
                    select(Product).where(
                        Product.name.ilike(prod_name.strip()),
                        Product.tenant_id == ctx.tenant_id
                    ).with_for_update()
                )
                prod = prod_res.scalar_one_or_none()

        if prod:
            try:
                line.product_id = prod.id
                current_stk = prod.initial_stock if prod.initial_stock is not None else 0
                # Directly reduce stock (allowing negative count for backorder tracking / supplier purchase replenishment)
                prod.initial_stock = int(current_stk - qty)

                # Real-time Batch stock deduction
                batch_no = line_dict.get("batch_number")
                if batch_no:
                    b_stmt = select(InventoryBatch).where(
                        InventoryBatch.batch_number == batch_no,
                        InventoryBatch.tenant_id == ctx.tenant_id
                    ).with_for_update()
                else:
                    b_stmt = select(InventoryBatch).where(
                        InventoryBatch.product_id == prod.id,
                        InventoryBatch.tenant_id == ctx.tenant_id,
                        InventoryBatch.remaining_quantity > 0
                    ).order_by(InventoryBatch.expiry_date.asc().nullslast()).with_for_update()
                
                b_res = await db.execute(b_stmt)
                b_match = b_res.scalars().first()
                if b_match:
                    curr_batch_stk = b_match.remaining_quantity if b_match.remaining_quantity is not None else 0
                    b_match.remaining_quantity = int(curr_batch_stk - qty)
            except Exception as st_err:
                logger.warning(f"Invoice stock deduction note: {st_err}")

    # If customer had past unpaid invoices and today's invoice is paid, clear past dues
    if payload.customer_id and (str(invoice.status).lower() == "paid" or getattr(payload, "payment_status", "").upper() == "PAID"):
        past_res = await db.execute(
            select(Invoice).where(
                Invoice.customer_id == payload.customer_id,
                Invoice.tenant_id == ctx.tenant_id,
                Invoice.id != invoice.id,
                Invoice.status != "paid",
            )
        )
        for past_inv in past_res.scalars().all():
            past_inv.status = "paid"
            past_inv.balance_due = 0.0
            past_inv.amount_paid = past_inv.total_amount

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

    # Auto-send invoice PDF via WhatsApp when the invoice is paid
    phone = await _resolve_invoice_phone(db, invoice)
    if initial_status == "paid" and phone:
        background_tasks.add_task(
            _bg_send_invoice_whatsapp,
            invoice.id,
            ctx.tenant_id,
            phone,
        )

    invoice = await db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .where(Invoice.id == invoice.id)
    )
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
    invoice = await db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .where(Invoice.id == invoice.id)
    )
    return invoice


@router.post("/{invoice_id}/approve")
async def approve_invoice(
    invoice_id: uuid.UUID,
    background_tasks: BackgroundTasks,
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

    # Auto-send invoice via WhatsApp when approved (draft -> sent)
    phone = await _resolve_invoice_phone(db, invoice)
    if phone:
        background_tasks.add_task(
            _bg_send_invoice_whatsapp,
            invoice.id,
            ctx.tenant_id,
            phone,
        )

    return {"status": "approved", "invoice_number": invoice.invoice_number}


@router.post("/{invoice_id}/payments", response_model=InvoicePaymentResponse, status_code=status.HTTP_201_CREATED)
async def add_payment(
    invoice_id: str,
    payload: InvoicePaymentCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoice_payments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    invoice = await _lookup_invoice(db, ctx.tenant_id, invoice_id, include_relations=False)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    curr_total = float(invoice.total_amount or 0.0)
    curr_paid = float(invoice.amount_paid or 0.0)
    curr_balance_due = float(invoice.balance_due) if invoice.balance_due is not None else max(0.0, curr_total - curr_paid)
    pay_amount = float(payload.amount)

    if pay_amount > curr_balance_due + 0.01:
        raise HTTPException(status_code=400, detail=f"Payment amount ({pay_amount:.2f}) exceeds balance due ({curr_balance_due:.2f})")

    payment = InvoicePayment(
        tenant_id=ctx.tenant_id,
        invoice_id=invoice.id,
        payment_date=payload.payment_date or date.today(),
        payment_method=payload.payment_method or "cash",
        amount=pay_amount,
        reference_number=payload.reference_number,
        notes=payload.notes,
    )
    
    if payload.payment_method and payload.payment_method.lower() == "wallet":
        if not invoice.customer_id:
            raise HTTPException(status_code=400, detail="Invoice has no associated customer")
            
        wallet = await db.scalar(
            select(CustomerWallet).where(
                CustomerWallet.customer_id == invoice.customer_id,
                CustomerWallet.tenant_id == ctx.tenant_id
            ).with_for_update()
        )
        if not wallet:
            wallet = CustomerWallet(
                tenant_id=ctx.tenant_id,
                customer_id=invoice.customer_id,
                balance=0.0
            )
            db.add(wallet)
            await db.flush()
            
        wallet.balance = float(wallet.balance or 0.0) - pay_amount
        wallet_tx = CustomerWalletTransaction(
            wallet_id=wallet.id,
            tenant_id=ctx.tenant_id,
            transaction_type="payment",
            amount=pay_amount,
            balance_after=wallet.balance,
            reference_type="invoice_payment",
            reference_id=str(invoice.invoice_number or invoice.id),
            description=f"Payment for Invoice #{invoice.invoice_number}"
        )
        db.add(wallet_tx)

        cust = await db.scalar(
            select(Customer).where(
                Customer.id == invoice.customer_id,
                Customer.tenant_id == ctx.tenant_id
            ).with_for_update()
        )
        if cust:
            cust.wallet_balance = wallet.balance
        
    db.add(payment)

    new_amount_paid = round(curr_paid + pay_amount, 2)
    new_balance_due = round(max(0.0, curr_total - new_amount_paid), 2)

    invoice.amount_paid = new_amount_paid
    invoice.balance_due = new_balance_due

    if invoice.balance_due <= 0.01:
        invoice.status = "paid"
        invoice.payment_status = "paid"
    elif invoice.amount_paid > 0:
        invoice.status = "partially_paid"
        invoice.payment_status = "partially_paid"

    if invoice.due_date and invoice.due_date < date.today() and invoice.balance_due > 0.01:
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

    # --- Payment receipt via WhatsApp ------------------------------------
    phone = await _resolve_invoice_phone(db, invoice)
    if phone:
        background_tasks.add_task(
            _bg_send_payment_receipt_whatsapp,
            invoice.id,
            ctx.tenant_id,
            payload.amount,
            payload.payment_method,
        )

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
    invoice = await db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .where(Invoice.id == invoice.id)
    )
    return invoice

@router.get("/payments/all")
async def list_all_payments(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = (
        select(InvoicePayment, Invoice.customer_name, Invoice.customer_id, Invoice.invoice_number)
        .join(Invoice, InvoicePayment.invoice_id == Invoice.id)
        .where(Invoice.tenant_id == ctx.tenant_id)
        .order_by(InvoicePayment.created_at.desc())
    )
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    items = []
    for payment, c_name, c_id, inv_num in result.all():
        items.append({
            "id": str(payment.id),
            "invoice_id": str(payment.invoice_id),
            "payment_date": payment.payment_date.isoformat(),
            "payment_method": payment.payment_method,
            "amount": float(payment.amount),
            "party_name": c_name or "Unknown Party",
            "party_id": str(c_id) if c_id else "CUST-000",
            "invoice_number": inv_num,
            "created_at": payment.created_at.isoformat() if payment.created_at else None
        })
    return paginate(items, total or 0, page, page_size)


# ---------------------------------------------------------------------------
# WhatsApp Invoice Delivery (manual trigger endpoint)
# ---------------------------------------------------------------------------

class _WhatsappSendResponse(BaseModel):
    success: bool
    message_id: str | None = None
    error: str | None = None
    session_id: str | None = None


@router.post(
    "/{invoice_id}/send-to-whatsapp",
    response_model=_WhatsappSendResponse,
    status_code=status.HTTP_200_OK,
)
async def send_invoice_to_whatsapp(
    invoice_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:invoices"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send the invoice PDF to the customer's WhatsApp number.

    Generates the PDF on the fly, then dispatches it through the tenant's
    active WhatsApp gateway session.  Runs in the background so the API
    responds immediately — check ``success`` to confirm delivery.

    Returns ``{success, message_id, error, session_id}``.
    ``invoice_id`` may be a UUID or an invoice number string.
    """
    invoice: Invoice | None = None
    # Try UUID lookup first
    try:
        uuid_val = uuid.UUID(invoice_id)
        invoice = await db.scalar(
            select(Invoice)
            .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
            .where(Invoice.id == uuid_val, Invoice.tenant_id == ctx.tenant_id)
        )
    except (ValueError, TypeError):
        pass
    # Fallback: look up by invoice_number
    if invoice is None:
        invoice = await db.scalar(
            select(Invoice)
            .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
            .where(Invoice.invoice_number == invoice_id, Invoice.tenant_id == ctx.tenant_id)
        )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    phone = invoice.customer_phone
    logger.info(
        "WhatsApp send attempt: invoice_id=%s customer_id=%s invoice_phone=%r",
        invoice.id, invoice.customer_id, phone,
    )
    if not phone:
        # Fallback: pull phone from the linked Customer record
        if invoice.customer_id:
            crm_phone = await db.scalar(
                select(Customer.phone).where(Customer.id == invoice.customer_id)
            )
            logger.info(
                "CRM phone fallback: invoice_id=%s customer_id=%s crm_phone=%r",
                invoice.id, invoice.customer_id, crm_phone,
            )
            phone = crm_phone or ""
        if not phone:
            logger.warning(
                "WhatsApp send aborted — no phone for invoice_id=%s customer_id=%s",
                invoice.id, invoice.customer_id,
            )
            raise HTTPException(
                status_code=400,
                detail="Customer has no phone number on record. Add one and retry.",
            )

    # Cache PDF to disk
    try:
        template = await get_active_invoice_template(db, ctx.tenant_id)
        save_invoice_pdf(invoice, template)
    except Exception as exc:
        logger.warning("PDF caching failed (send continues): %s", exc)

    # Fire-and-forget: the background task opens its own DB session
    background_tasks.add_task(
        _bg_send_invoice_whatsapp,
        invoice.id,
        ctx.tenant_id,
        phone,
    )

    return _WhatsappSendResponse(success=True, session_id=None)


# ---------------------------------------------------------------------------
# Background task helpers (module-level so FastAPI BackgroundTasks can call them)
# ---------------------------------------------------------------------------

async def _resolve_invoice_phone(db: AsyncSession, invoice: Invoice) -> str | None:
    """Return the customer phone for an invoice, falling back to the CRM table."""
    phone = invoice.customer_phone
    logger.info(
        "_resolve_invoice_phone: invoice_id=%s customer_id=%s invoice_phone=%r",
        invoice.id, invoice.customer_id, phone,
    )
    if not phone:
        # 1) Try by customer_id FK
        if invoice.customer_id:
            crm_phone = await db.scalar(
                select(Customer.phone).where(Customer.id == invoice.customer_id)
            )
            logger.info(
                "_resolve_invoice_phone by_id: invoice_id=%s customer_id=%s crm_phone=%r",
                invoice.id, invoice.customer_id, crm_phone,
            )
            if crm_phone:
                return crm_phone

        # 2) Fallback: search CRM by customer_name
        if invoice.customer_name:
            crm_phone = await db.scalar(
                select(Customer.phone).where(Customer.name == invoice.customer_name)
            )
            logger.info(
                "_resolve_invoice_phone by_name: invoice_id=%s customer_name=%r crm_phone=%r",
                invoice.id, invoice.customer_name, crm_phone,
            )
            if crm_phone:
                return crm_phone
    return phone or None


async def _bg_send_invoice_whatsapp(
    invoice_id: uuid.UUID,
    tenant_id: uuid.UUID,
    recipient_phone: str,
) -> None:
    """Background task: generate PDF and send invoice via WhatsApp."""
    from src.database.session import AsyncSessionLocal
    from sqlalchemy.orm import selectinload

    async with AsyncSessionLocal() as db:
        try:
            inv = await db.scalar(
                select(Invoice)
                .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
                .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
            )
            if not inv:
                return
            # Prefer the already-resolved recipient_phone; fall back to CRM lookup
            phone = recipient_phone or await _resolve_invoice_phone(db, inv)
            if not phone:
                return
            await send_invoice_whatsapp(db, inv, recipient_phone=phone)
        except Exception as exc:
            logger.warning("WhatsApp invoice send failed for %s: %s", invoice_id, exc)


async def _bg_send_payment_receipt_whatsapp(
    invoice_id: uuid.UUID,
    tenant_id: uuid.UUID,
    amount: float,
    payment_method: str,
) -> None:
    """Background task: send a payment receipt text message via WhatsApp."""
    from src.database.session import AsyncSessionLocal
    from sqlalchemy.orm import selectinload

    async with AsyncSessionLocal() as db:
        try:
            inv = await db.scalar(
                select(Invoice)
                .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
                .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
            )
            if not inv:
                return
            phone = await _resolve_invoice_phone(db, inv)
            if not phone:
                return
            await send_payment_receipt_whatsapp(db, inv, amount, payment_method)
        except Exception as exc:
            logger.warning("WhatsApp payment receipt failed for %s: %s", invoice_id, exc)
