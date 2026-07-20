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
from src.models import POSTransaction, POSTransactionItem, POSPayment, POSProduct
from src.schemas.erp import POSTransactionCreate, POSTransactionResponse, POSCheckoutPayload

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
            prod_stmt = select(POSProduct).where(
                POSProduct.id == item.product_id,
                POSProduct.tenant_id == ctx.user.tenant_id
            ).with_for_update()
            prod_res = await db.execute(prod_stmt)
            product = prod_res.scalar_one_or_none()
            if product:
                # Allow stock to go negative to flag discrepancies for reconciliation
                product.stock -= item.quantity

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
    """Get aggregated daily sales summary directly from DB."""
    # Base condition: Current tenant + (completed or refunded)
    tx_cond = (POSTransaction.tenant_id == ctx.user.tenant_id) & (POSTransaction.status.in_(["completed", "refunded"]))
    if session_id:
        tx_cond = tx_cond & (POSTransaction.session_id == session_id)
        
    # 1. Total revenue and transaction count
    summary_stmt = select(
        func.count(POSTransaction.id).label("transactions_count"),
        func.sum(POSTransaction.total_amount).label("total_revenue")
    ).where(tx_cond)
    
    summary_res = await db.execute(summary_stmt)
    summary_row = summary_res.first()
    
    transactions_count = summary_row.transactions_count or 0
    total_revenue = float(summary_row.total_revenue or 0)
    
    # 2. Payments breakdown
    payments_stmt = select(
        POSPayment.payment_method,
        func.sum(POSPayment.amount).label("total_amount")
    ).join(POSTransaction).where(tx_cond).group_by(POSPayment.payment_method)
    
    payments_res = await db.execute(payments_stmt)
    
    breakdown = { "cash": 0.0, "card": 0.0, "upi": 0.0 }
    for row in payments_res:
        method = (row.payment_method or "").lower()
        if method in breakdown:
            breakdown[method] = float(row.total_amount or 0)
            
    # 3. Split count (transactions with > 1 payment)
    split_stmt = select(func.count()).select_from(
        select(POSPayment.transaction_id)
        .join(POSTransaction)
        .where(tx_cond)
        .group_by(POSPayment.transaction_id)
        .having(func.count(POSPayment.id) > 1)
        .subquery()
    )
    split_res = await db.execute(split_stmt)
    split_count = split_res.scalar() or 0
    
    return {
        "transactions_count": transactions_count,
        "total_revenue": total_revenue,
        "breakdown": breakdown,
        "split_count": split_count
    }
