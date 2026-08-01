from typing import Annotated
import uuid
import string
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import POSTransaction, POSTransactionItem, POSPayment, Product
from src.schemas.erp import POSTransactionCreate, POSTransactionResponse, POSCheckoutPayload
from src.utils.notifications import add_system_notification

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
    # 2. Create Transaction
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
        status=payload.status,
        parent_transaction_id=payload.parent_transaction_id,
        delivery_status=payload.delivery_status,
        delivery_address=payload.delivery_address,
        driver_name=payload.driver_name
    )
    
    # Auto-set status to REFUNDED for refund receipts
    if payload.total_amount < 0:
        transaction.status = "refunded"

    db.add(transaction)
    await db.flush() # Get transaction.id

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

    # 3. Create Items
    for item in payload.items:
        tx_item = POSTransactionItem(
            transaction_id=transaction.id,
            tenant_id=ctx.user.tenant_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount=item.discount,
            subtotal=(item.unit_price - item.discount) * item.quantity
        )
        db.add(tx_item)
        
        # Deduct stock (Enterprise-level with row locking)
        # Skip stock deduction if transaction is just being parked (ON_HOLD)
        if payload.status != "on_hold":
            prod_stmt = select(Product).where(
                Product.id == item.product_id,
                Product.tenant_id == ctx.user.tenant_id
            ).with_for_update()
            prod_res = await db.execute(prod_stmt)
            product = prod_res.scalar_one_or_none()

            # Fallback: If product_id points to a MasterCatalogProduct ID or temp ID, match Product by barcode/SKU/name
            if not product:
                from src.models import MasterCatalogProduct
                m_stmt = select(MasterCatalogProduct).where(MasterCatalogProduct.id == item.product_id)
                m_res = await db.execute(m_stmt)
                m_prod = m_res.scalar_one_or_none()

                search_codes = []
                search_name = None
                if m_prod:
                    if m_prod.barcode: search_codes.append(m_prod.barcode)
                    if m_prod.sku_code: search_codes.append(m_prod.sku_code)
                    if m_prod.name: search_name = m_prod.name

                if search_codes or search_name:
                    conds = [Product.tenant_id == ctx.user.tenant_id]
                    or_conds = []
                    for code in search_codes:
                        or_conds.append(Product.barcode == code)
                        or_conds.append(Product.sku == code)
                    if search_name:
                        or_conds.append(func.lower(Product.name) == search_name.lower())
                    
                    p_stmt = select(Product).where(*conds, or_(*or_conds)).with_for_update()
                    p_res = await db.execute(p_stmt)
                    product = p_res.scalars().first()

            if product:
                if product.initial_stock is None:
                    product.initial_stock = 0
                product.initial_stock -= item.quantity

    # 4. Create Payments
    for payment in payload.payments:
        tx_payment = POSPayment(
            transaction_id=transaction.id,
            tenant_id=ctx.user.tenant_id,
            payment_method=payment.payment_method,
            amount=payment.amount,
            reference_number=payment.reference_number
        )
        db.add(tx_payment)



    # Trigger live notification before committing POS checkout
    msg_title = "POS Refund Processed" if transaction.status == "refunded" else "New POS Order Checked Out"
    msg_body = f"Receipt {transaction.receipt_number} processed. Cashier: {ctx.user.full_name} | Total: ${transaction.total_amount:,.2f}"
    await add_system_notification(db, ctx.user.tenant_id, msg_title, msg_body, "pos")

    await db.commit()
    
    # Reload with relationships
    stmt_reload = select(POSTransaction).options(
        selectinload(POSTransaction.items),
        selectinload(POSTransaction.payments)
    ).where(POSTransaction.id == transaction.id)
    reload_res = await db.execute(stmt_reload)
    return reload_res.scalar_one()

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
    import uuid

    query_filters = [POSTransaction.tenant_id == ctx.user.tenant_id]
    if status_filter:
        query_filters.append(POSTransaction.status == status_filter)
    
    if search:
        search_filter = POSTransaction.receipt_number.ilike(f"%{search}%")
        try:
            # If search is a valid UUID, also search by ID
            search_uuid = uuid.UUID(search)
            search_filter = or_(search_filter, POSTransaction.id == search_uuid)
        except ValueError:
            pass
        query_filters.append(search_filter)

    stmt = select(POSTransaction).options(
        selectinload(POSTransaction.items),
        selectinload(POSTransaction.payments)
    ).where(*query_filters).order_by(desc(POSTransaction.created_at)).limit(limit)
    
    result = await db.execute(stmt)
    return result.scalars().all()
@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Delete a POS transaction (used for clearing parked/held bills when resumed)."""
    stmt = select(POSTransaction).where(
        POSTransaction.id == transaction_id,
        POSTransaction.tenant_id == ctx.user.tenant_id
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
    """Get aggregated daily sales summary for TODAY only, directly from DB."""
    from datetime import datetime, timezone, timedelta

    # Today's date window in UTC (supports servers in any timezone)
    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end   = today_start + timedelta(days=1)

    # Base condition: current tenant + today's records only
    date_cond = (
        POSTransaction.created_at >= today_start,
        POSTransaction.created_at <  today_end,
        POSTransaction.tenant_id  == ctx.user.tenant_id,
    )
    if session_id:
        date_cond = (*date_cond, POSTransaction.session_id == session_id)

    # Completed sales only (exclude refunds from revenue total)
    completed_cond = (*date_cond, POSTransaction.status == "completed")

    # Refunded transactions only (for Returns & Refunds KPI)
    refunded_cond = (*date_cond, POSTransaction.status == "refunded")

    # 1. Total revenue + transaction count (completed only)
    summary_stmt = select(
        func.count(POSTransaction.id).label("transactions_count"),
        func.coalesce(func.sum(POSTransaction.total_amount), 0).label("total_revenue")
    ).where(*completed_cond)

    summary_res = await db.execute(summary_stmt)
    summary_row = summary_res.first()

    transactions_count = int(summary_row.transactions_count or 0)
    total_revenue      = float(summary_row.total_revenue or 0)

    # 2. Returns & Refunds total (absolute value of refunded transactions)
    returns_stmt = select(
        func.coalesce(func.sum(func.abs(POSTransaction.total_amount)), 0).label("total_returns")
    ).where(*refunded_cond)

    returns_res  = await db.execute(returns_stmt)
    total_returns = float((returns_res.scalar()) or 0)

    # 3. Payment method breakdown (completed sales)
    payments_stmt = select(
        POSPayment.payment_method,
        func.coalesce(func.sum(POSPayment.amount), 0).label("total_amount")
    ).join(POSTransaction).where(*completed_cond).group_by(POSPayment.payment_method)

    payments_res = await db.execute(payments_stmt)

    breakdown = {"cash": 0.0, "card": 0.0, "upi": 0.0}
    for row in payments_res:
        method = (row.payment_method or "").lower()
        if method in breakdown:
            breakdown[method] = float(row.total_amount or 0)

    # 4. Split payment count
    split_stmt = select(func.count()).select_from(
        select(POSPayment.transaction_id)
        .join(POSTransaction)
        .where(*completed_cond)
        .group_by(POSPayment.transaction_id)
        .having(func.count(POSPayment.id) > 1)
        .subquery()
    )
    split_res  = await db.execute(split_stmt)
    split_count = int(split_res.scalar() or 0)

    # 5. Yesterday's Comparison for Dynamic Growth Calculation
    yesterday_start = today_start - timedelta(days=1)
    yesterday_cond = (
        POSTransaction.created_at >= yesterday_start,
        POSTransaction.created_at < today_start,
        POSTransaction.tenant_id == ctx.user.tenant_id,
        POSTransaction.status == "completed",
    )
    y_stmt = select(
        func.count(POSTransaction.id).label("y_count"),
        func.coalesce(func.sum(POSTransaction.total_amount), 0).label("y_revenue")
    ).where(*yesterday_cond)
    y_res = await db.execute(y_stmt)
    y_row = y_res.first()
    y_revenue = float(y_row.y_revenue or 0) if y_row else 0.0
    y_count = int(y_row.y_count or 0) if y_row else 0

    sales_growth = round(((total_revenue - y_revenue) / y_revenue * 100), 1) if y_revenue > 0 else (0.0 if total_revenue == 0 else 100.0)
    orders_growth = round(((transactions_count - y_count) / y_count * 100), 1) if y_count > 0 else (0.0 if transactions_count == 0 else 100.0)

    return {
        "transactions_count": transactions_count,
        "total_revenue":      total_revenue,
        "total_returns":      total_returns,
        "breakdown":          breakdown,
        "split_count":        split_count,
        "sales_growth":       sales_growth,
        "orders_growth":      orders_growth,
        "date":               today_start.strftime("%Y-%m-%d"),
    }
