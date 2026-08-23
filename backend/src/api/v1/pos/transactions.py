from typing import Annotated
import logging
import uuid
import string
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import (
    POSTransaction,
    POSTransactionItem,
    POSPayment,
    POSPaymentMethod,
    Product,
    Customer,
    CustomerWallet,
    CustomerWalletTransaction,
)
from src.models.inventory import InventoryBatch
from src.models.erp import Invoice, InvoiceLine, InvoicePayment
from src.schemas.erp import POSTransactionCreate, POSTransactionResponse, POSCheckoutPayload
from src.services.invoice_pdf import get_active_invoice_template, render_invoice_pdf_b64, save_invoice_pdf
from src.services.whatsapp_invoice_sender import _get_gateway_session_id, _send_via_gateway
from src.utils.notifications import add_system_notification
from src.utils.number_series import generate_number

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transactions", tags=["POS - Transactions"])


def generate_receipt_number():
    return "REC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


@router.post("/checkout", response_model=POSTransactionResponse)
async def checkout(
    payload: POSCheckoutPayload,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Process a POS checkout (cart)."""
    # 1. Create Transaction
    transaction = POSTransaction(
        cashier_id=ctx.user.id,
        tenant_id=ctx.user.tenant_id,
        session_id=payload.session_id,
        customer_id=payload.customer_id,
        receipt_number=generate_receipt_number(),
        subtotal=payload.subtotal,
        tax_amount=payload.tax_amount,
        discount_amount=payload.discount_amount,
        total_amount=payload.total_amount,
        status=(payload.status or "completed").lower(),
        parent_transaction_id=payload.parent_transaction_id,
        delivery_status=payload.delivery_status,
        delivery_address=payload.delivery_address,
        driver_name=payload.driver_name,
    )

    # Auto-set status for refund receipts and partial/credit payments
    has_credit_payment = any((p.payment_method or "").lower() == "credit" for p in payload.payments)
    total_non_credit = sum(p.amount for p in payload.payments if (p.payment_method or "").lower() != "credit")

    if payload.total_amount < 0:
        transaction.status = "refunded"
    elif has_credit_payment and total_non_credit > 0 and total_non_credit < payload.total_amount:
        transaction.status = "partially_paid"
    elif has_credit_payment and total_non_credit <= 0:
        transaction.status = "credit"

    db.add(transaction)
    await db.flush()  # Get transaction.id

    # Update parent transaction status if this is a refund
    if payload.parent_transaction_id:
        parent_stmt = select(POSTransaction).where(
            POSTransaction.id == payload.parent_transaction_id,
            POSTransaction.tenant_id == ctx.user.tenant_id
        ).with_for_update()
        parent_res = await db.execute(parent_stmt)
        parent_tx = parent_res.scalar_one_or_none()
        if parent_tx:
            parent_tx.status = "refunded"

    # 2. Create Items + deduct stock from Products and Batches
    for item in payload.items:
        tx_item = POSTransactionItem(
            transaction_id=transaction.id,
            tenant_id=ctx.user.tenant_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount=item.discount,
            subtotal=(item.unit_price - item.discount) * item.quantity,
        )
        db.add(tx_item)

        # Deduct stock (skip for ON_HOLD)
        if payload.status != "on_hold" and item.product_id:
            try:
                target_pid = uuid.UUID(str(item.product_id)) if isinstance(item.product_id, str) else item.product_id
                prod_stmt = select(Product).where(
                    Product.id == target_pid,
                    Product.tenant_id == ctx.user.tenant_id
                ).with_for_update()
                prod_res = await db.execute(prod_stmt)
                product = prod_res.scalar_one_or_none()
                if product:
                    current_stk = product.initial_stock if product.initial_stock is not None else 0
                    product.initial_stock = int(current_stk - item.quantity)

                # Deduct from active FEFO batch in erp_inventory_batches
                batch_stmt = select(InventoryBatch).where(
                    InventoryBatch.product_id == target_pid,
                    InventoryBatch.tenant_id == ctx.user.tenant_id,
                    InventoryBatch.remaining_quantity > 0
                ).order_by(InventoryBatch.expiry_date.asc().nullslast()).with_for_update()
                batch_res = await db.execute(batch_stmt)
                active_batch = batch_res.scalars().first()
                if active_batch:
                    curr_b_stk = active_batch.remaining_quantity if active_batch.remaining_quantity is not None else 0
                    active_batch.remaining_quantity = int(curr_b_stk - item.quantity)
            except Exception as batch_deduct_err:
                logger.warning(f"POS checkout stock deduction note: {batch_deduct_err}")

    # 3. Create Payments
    for payment in payload.payments:
        raw_m = (payment.payment_method or "").lower().strip()
        if raw_m in ("cash", "cod"):
            mapped_method = POSPaymentMethod.CASH
        elif raw_m in ("card", "credit_card", "debit_card"):
            mapped_method = POSPaymentMethod.CARD
        elif raw_m in ("gift_card", "voucher", "points"):
            mapped_method = POSPaymentMethod.GIFT_CARD
        else:
            # wallet, upi, credit, pay later, netbanking, online etc.
            mapped_method = POSPaymentMethod.ONLINE

        ref_text = payment.reference_number
        if not ref_text and raw_m in ("wallet", "credit", "upi", "pay later", "pay_later"):
            ref_text = f"Mode: {raw_m.upper()}"

        tx_payment = POSPayment(
            transaction_id=transaction.id,
            tenant_id=ctx.user.tenant_id,
            payment_method=mapped_method,
            amount=payment.amount,
            reference_number=ref_text,
        )
        db.add(tx_payment)

        # If payment is from customer's wallet, deduct CustomerWallet, log CustomerWalletTransaction, and sync Customer.wallet_balance
        if payload.customer_id and raw_m == "wallet":
            try:
                # 1. Update CustomerWallet record
                wallet_stmt = (
                    select(CustomerWallet).where(
                        CustomerWallet.customer_id == payload.customer_id,
                        CustomerWallet.tenant_id == ctx.user.tenant_id,
                    ).with_for_update()
                )
                wallet = (await db.execute(wallet_stmt)).scalar_one_or_none()
                if not wallet:
                    wallet = CustomerWallet(
                        tenant_id=ctx.user.tenant_id,
                        customer_id=payload.customer_id,
                        balance=0.0
                    )
                    db.add(wallet)
                    await db.flush()

                wallet.balance = float(wallet.balance or 0.0) - float(payment.amount)

                # 2. Record CustomerWalletTransaction
                tx = CustomerWalletTransaction(
                    tenant_id=ctx.user.tenant_id,
                    wallet_id=wallet.id,
                    transaction_type="payment",
                    amount=float(payment.amount),
                    balance_after=wallet.balance,
                    reference_type="pos_transaction",
                    reference_id=transaction.receipt_number,
                    description=f"Payment for POS Bill #{transaction.receipt_number}",
                )
                db.add(tx)

                # 3. Update Customer.wallet_balance column
                cust_stmt = select(Customer).where(
                    Customer.id == payload.customer_id,
                    Customer.tenant_id == ctx.user.tenant_id,
                ).with_for_update()
                cust_res = await db.execute(cust_stmt)
                cust_obj = cust_res.scalar_one_or_none()
                if cust_obj:
                    cust_obj.wallet_balance = wallet.balance
            except Exception as wallet_err:
                logger.warning(f"Wallet balance deduction note: {wallet_err}")

    # 4. Live notification
    msg_title = "POS Refund Processed" if transaction.status == "refunded" else "New POS Order Checked Out"
    msg_body = f"Receipt {transaction.receipt_number} processed. Cashier: {ctx.user.full_name} | Total: ${transaction.total_amount:,.2f}"
    await add_system_notification(db, ctx.user.tenant_id, msg_title, msg_body, "pos")

    await db.commit()

    # 5. Create Invoice from POS transaction + auto-send via WhatsApp
    if transaction.status in ("completed", "partially_paid", "credit"):
        await _create_invoice_and_send_whatsapp(db, ctx, transaction, payload)


    # 6. Reload and return
    stmt_reload = select(POSTransaction).options(
        selectinload(POSTransaction.items),
        selectinload(POSTransaction.payments),
    ).where(POSTransaction.id == transaction.id)
    reload_res = await db.execute(stmt_reload)
    return reload_res.scalar_one()


# ─── Helpers ────────────────────────────────────────────────────────────

async def _create_invoice_and_send_whatsapp(
    db: AsyncSession,
    ctx: CurrentUserContext,
    transaction: POSTransaction,
    payload: POSCheckoutPayload,
) -> None:
    """Create an Invoice record from the POS transaction and send it via WhatsApp."""
    try:
        # Generate invoice number
        inv_number = await generate_number(db, ctx.user.tenant_id, "invoice", None)

        # Resolve customer details
        cust_name = "Walk-in Guest"
        cust_phone = None
        cust_email = None
        cust_gstin = None
        cust_address = None
        if payload.customer_id:
            cust_row = await db.scalar(
                select(Customer).where(
                    Customer.id == payload.customer_id,
                    Customer.tenant_id == ctx.user.tenant_id,
                )
            )
            if cust_row:
                cust_name = cust_row.name
                cust_phone = cust_row.phone
                cust_email = cust_row.email
                cust_gstin = cust_row.gst_number
                cust_address = cust_row.address

        # Determine payment method and actual cash/online paid vs credit
        pay_method = payload.payments[0].payment_method if payload.payments else "cash"
        actual_paid = sum(float(p.amount) for p in payload.payments if p.payment_method.lower() != "credit")
        total_amt = float(payload.total_amount)
        bal_due = max(0.0, total_amt - actual_paid)

        if bal_due <= 0.001:
            inv_status = "paid"
            pay_status = "paid"
        elif actual_paid > 0.001:
            inv_status = "partially_paid"
            pay_status = "partially_paid"
        else:
            inv_status = "sent"
            pay_status = "unpaid"

        # Build invoice (fields match Invoice ORM exactly)
        invoice = Invoice(
            tenant_id=ctx.user.tenant_id,
            company_id=None,
            invoice_number=inv_number,
            invoice_type="tax_invoice",
            status=inv_status,
            customer_id=payload.customer_id,
            customer_name=cust_name,
            customer_phone=cust_phone,
            customer_email=cust_email,
            customer_gstin=cust_gstin,
            billing_address=cust_address,
            invoice_date=__import__("datetime").date.today(),
            due_date=__import__("datetime").date.today(),
            currency_code="INR",
            subtotal=payload.subtotal,
            discount_amount=payload.discount_amount,
            cgst_amount=0,
            sgst_amount=0,
            igst_amount=0,
            total_amount=total_amt,
            amount_paid=actual_paid,
            balance_due=bal_due,
        )
        db.add(invoice)
        await db.flush()

        # If upfront partial/full payment was made, record InvoicePayment
        if actual_paid > 0.001:
            for p in payload.payments:
                if p.payment_method.lower() != "credit" and float(p.amount) > 0:
                    inv_pay = InvoicePayment(
                        tenant_id=ctx.user.tenant_id,
                        invoice_id=invoice.id,
                        payment_date=__import__("datetime").date.today(),
                        amount=float(p.amount),
                        payment_method=p.payment_method.lower(),
                        reference_number=p.reference_number or f"PAY-{inv_number}",
                        notes=f"POS Upfront Payment ({p.payment_method})",
                    )
                    db.add(inv_pay)

        # Load product names
        product_ids = [it.product_id for it in transaction.items]
        prod_map: dict = {}
        if product_ids:
            prod_rows = (await db.execute(
                select(Product.id, Product.name).where(
                    Product.id.in_(product_ids),
                    Product.tenant_id == ctx.user.tenant_id,
                )
            )).all()
            prod_map = {r[0]: r[1] for r in prod_rows}

        # Create invoice lines (fields match InvoiceLine ORM)
        for item in transaction.items:
            line_total = (item.unit_price - (item.discount or 0)) * item.quantity
            il = InvoiceLine(
                tenant_id=ctx.user.tenant_id,
                invoice_id=invoice.id,
                product_id=item.product_id,
                product_name=prod_map.get(item.product_id, "Product"),
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_amount=item.discount or 0,
                tax_rate=0,
                cgst_amount=0,
                sgst_amount=0,
                igst_amount=0,
                line_total=line_total,
            )
            db.add(il)

        await db.commit()

        # Auto-send via WhatsApp if customer has a phone number
        if cust_phone:
            try:
                template = await get_active_invoice_template(db, ctx.user.tenant_id)
                pdf_b64 = render_invoice_pdf_b64(invoice, template)
                save_invoice_pdf(invoice, template)

                session_id = _get_gateway_session_id()
                if session_id:
                    phone = cust_phone.strip()
                    _send_via_gateway(
                        session_id=session_id,
                        recipient_phone=phone,
                        pdf_b64=pdf_b64,
                        invoice_number=inv_number,
                        customer_name=cust_name,
                    )
                    logger.info(
                        "POS Invoice %s auto-sent via WhatsApp to %s",
                        inv_number, phone,
                    )
            except Exception as exc:
                logger.warning("POS WhatsApp auto-send failed for %s: %s", inv_number, exc)

    except Exception as exc:
        logger.warning("POS Invoice creation failed: %s", exc)
        # Don't fail the POS checkout — invoice creation is secondary


# ─── History ────────────────────────────────────────────────────────────

@router.get("/history", response_model=list[POSTransactionResponse])
async def get_transaction_history(
    limit: int = 50,
    status_filter: str | None = None,
    search: str | None = None,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Get recent POS transactions."""
    from sqlalchemy import or_

    query_filters = [POSTransaction.tenant_id == ctx.user.tenant_id]
    if status_filter:
        query_filters.append(POSTransaction.status == status_filter)

    if search:
        search_filter = POSTransaction.receipt_number.ilike(f"%{search}%")
        try:
            search_uuid = uuid.UUID(search)
            search_filter = or_(search_filter, POSTransaction.id == search_uuid)
        except ValueError:
            pass
        query_filters.append(search_filter)

    stmt = select(POSTransaction).options(
        selectinload(POSTransaction.items),
        selectinload(POSTransaction.payments),
    ).where(*query_filters).order_by(desc(POSTransaction.created_at)).limit(limit)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Delete a POS transaction (used for clearing parked/held bills)."""
    stmt = select(POSTransaction).where(
        POSTransaction.id == transaction_id,
        POSTransaction.tenant_id == ctx.user.tenant_id,
    )
    result = await db.execute(stmt)
    transaction = result.scalar_one_or_none()

    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    await db.delete(transaction)
    await db.commit()


@router.get("/reports/daily-summary")
async def get_daily_summary(
    session_id: uuid.UUID | None = None,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Get aggregated daily sales summary for TODAY only."""
    from datetime import datetime, timezone, timedelta

    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    date_cond = (
        POSTransaction.created_at >= today_start,
        POSTransaction.created_at < today_end,
        POSTransaction.tenant_id == ctx.user.tenant_id,
    )
    if session_id:
        date_cond = (*date_cond, POSTransaction.session_id == session_id)

    completed_cond = (*date_cond, POSTransaction.status.in_(["completed", "partially_paid", "credit"]))
    refunded_cond = (*date_cond, POSTransaction.status == "refunded")

    summary_stmt = select(
        func.count(POSTransaction.id).label("transactions_count"),
        func.coalesce(func.sum(POSTransaction.total_amount), 0).label("total_revenue"),
    ).where(*completed_cond)
    summary_res = await db.execute(summary_stmt)
    summary_row = summary_res.first()
    transactions_count = int(summary_row.transactions_count or 0)
    total_revenue = float(summary_row.total_revenue or 0)

    returns_stmt = select(
        func.coalesce(func.sum(func.abs(POSTransaction.total_amount)), 0).label("total_returns"),
    ).where(*refunded_cond)
    returns_res = await db.execute(returns_stmt)
    total_returns = float((returns_res.scalar()) or 0)

    payments_stmt = select(
        POSPayment.payment_method,
        func.coalesce(func.sum(POSPayment.amount), 0).label("total_amount"),
    ).join(POSTransaction).where(*completed_cond).group_by(POSPayment.payment_method)
    payments_res = await db.execute(payments_stmt)
    breakdown = {"cash": 0.0, "card": 0.0, "upi": 0.0, "wallet": 0.0, "credit": 0.0, "online": 0.0}
    for row in payments_res:
        method = (str(row.payment_method) if row.payment_method else "").lower()
        if "." in method:
            method = method.split(".")[-1]
        if method in breakdown:
            breakdown[method] = float(row.total_amount or 0)
        else:
            breakdown["online"] = breakdown.get("online", 0.0) + float(row.total_amount or 0)

    split_stmt = select(func.count()).select_from(
        select(POSPayment.transaction_id)
        .join(POSTransaction)
        .where(*completed_cond)
        .group_by(POSPayment.transaction_id)
        .having(func.count(POSPayment.id) > 1)
        .subquery(),
    )
    split_count = int((await db.execute(split_stmt)).scalar() or 0)

    hourly_stmt = select(
        func.extract('hour', POSTransaction.created_at).label("hour"),
        func.coalesce(func.sum(POSTransaction.total_amount), 0).label("revenue"),
        func.count(POSTransaction.id).label("orders"),
    ).where(*completed_cond).group_by(func.extract('hour', POSTransaction.created_at)).order_by(func.extract('hour', POSTransaction.created_at))
    hourly_res = await db.execute(hourly_stmt)
    hourly_dict = {f"{h:02d}:00": {"hour": f"{h:02d}:00", "revenue": 0.0, "orders": 0} for h in range(24)}
    for row in hourly_res:
        h_idx = int(row.hour)
        time_label = f"{h_idx:02d}:00"
        if time_label in hourly_dict:
            hourly_dict[time_label]["revenue"] = float(row.revenue or 0)
            hourly_dict[time_label]["orders"] = int(row.orders or 0)
    retail_hours = [hourly_dict[f"{h:02d}:00"] for h in range(6, 23)]

    return {
        "transactions_count": transactions_count,
        "total_revenue": total_revenue,
        "total_returns": total_returns,
        "breakdown": breakdown,
        "split_count": split_count,
        "hourly_sales": retail_hours,
        "date": today_start.strftime("%Y-%m-%d"),
    }
