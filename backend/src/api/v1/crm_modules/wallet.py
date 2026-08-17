"""Customer Wallet backend endpoints."""
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    Customer,
    CustomerWallet,
    CustomerWalletTransaction,
    User,
)
from src.schemas.crm import (
    WalletTransactionCreate,
    WalletTransactionResponse,
)
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.notifications import add_system_notification

router = APIRouter(prefix="/crm/wallet", tags=["CRM - Customer Wallet"])


# ─── Wallet Overview ─────────────────────────────────────────────────

@router.get("/customers/{customer_id}")
async def get_customer_wallet(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get wallet info for a customer. Auto-creates wallet if missing."""
    customer = await db.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    wallet = await db.scalar(
        select(CustomerWallet).where(
            CustomerWallet.tenant_id == ctx.tenant_id,
            CustomerWallet.customer_id == customer_id,
        )
    )
    if not wallet:
        wallet = CustomerWallet(tenant_id=ctx.tenant_id, customer_id=customer_id)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)

    # Compute transaction lifetime metrics from CustomerWalletTransaction
    txs = (await db.execute(
        select(CustomerWalletTransaction)
        .where(
            CustomerWalletTransaction.wallet_id == wallet.id,
            CustomerWalletTransaction.tenant_id == ctx.tenant_id
        )
    )).scalars().all()

    credit_types = {"topup", "refund", "cashback", "promotion", "transfer_in", "manual_credit", "adjustment"}
    lifetime_credited = sum(float(t.amount) for t in txs if t.transaction_type in credit_types)
    lifetime_debited = sum(float(t.amount) for t in txs if t.transaction_type not in credit_types)
    credit_count = sum(1 for t in txs if t.transaction_type in credit_types)
    debit_count = sum(1 for t in txs if t.transaction_type not in credit_types)

    return {
        "wallet_id": str(wallet.id),
        "customer_id": str(wallet.customer_id),
        "customer_name": customer.name,
        "balance": float(wallet.balance or 0),
        "currency": wallet.currency or "INR",
        "lifetime_credited": lifetime_credited,
        "lifetime_debited": lifetime_debited,
        "credit_count": credit_count,
        "debit_count": debit_count,
        "is_active": wallet.status == "active",
        "notes": "",
        "created_at": wallet.created_at.isoformat() if wallet.created_at else datetime.now(timezone.utc).isoformat(),
        "updated_at": wallet.updated_at.isoformat() if wallet.updated_at else datetime.now(timezone.utc).isoformat(),
    }


@router.put("/customers/{customer_id}")
async def update_wallet(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    is_active: bool = True,
    notes: str | None = None,
):
    wallet = await db.scalar(
        select(CustomerWallet).where(
            CustomerWallet.tenant_id == ctx.tenant_id,
            CustomerWallet.customer_id == customer_id,
        )
    )
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    wallet.status = "active" if is_active else "inactive"
    await db.commit()
    return {"success": True}


# ─── Transactions ────────────────────────────────────────────────────

@router.get("/customers/{customer_id}/transactions")
async def list_wallet_transactions(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    transaction_type: str | None = None,
):
    customer = await db.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    wallet = await db.scalar(
        select(CustomerWallet).where(
            CustomerWallet.tenant_id == ctx.tenant_id,
            CustomerWallet.customer_id == customer_id,
        )
    )
    if not wallet:
        return paginate([], 0, page, page_size)

    q = select(CustomerWalletTransaction).where(
        CustomerWalletTransaction.tenant_id == ctx.tenant_id,
        CustomerWalletTransaction.wallet_id == wallet.id,
    )
    if transaction_type:
        q = q.where(CustomerWalletTransaction.transaction_type == transaction_type)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(CustomerWalletTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [WalletTransactionResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)


@router.post("/transactions", response_model=WalletTransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: WalletTransactionCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Credit or debit a customer's wallet. Atomic operation."""
    return await _process_wallet_tx(db, ctx, payload)


async def _process_wallet_tx(db: AsyncSession, ctx: CurrentUserContext, payload: WalletTransactionCreate):
    """Shared wallet transaction logic."""
    customer = await db.scalar(
        select(Customer).where(Customer.id == payload.customer_id, Customer.tenant_id == ctx.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    wallet = await db.scalar(
        select(CustomerWallet).where(
            CustomerWallet.tenant_id == ctx.tenant_id,
            CustomerWallet.customer_id == payload.customer_id,
        )
    )
    if not wallet:
        wallet = CustomerWallet(tenant_id=ctx.tenant_id, customer_id=payload.customer_id)
        db.add(wallet)
        await db.flush()

    credit_types = {"topup", "refund", "cashback", "promotion", "transfer_in", "manual_credit", "adjustment"}
    debit_types = {"payment", "loyalty_redemption", "transfer_out", "manual_debit"}

    is_credit = payload.transaction_type in credit_types
    is_debit = payload.transaction_type in debit_types
    if not is_credit and not is_debit:
        raise HTTPException(status_code=400, detail=f"Unknown transaction type: {payload.transaction_type}")

    if is_debit and float(wallet.balance or 0) < payload.amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    balance_before = float(wallet.balance or 0)
    balance_after = balance_before + payload.amount if is_credit else balance_before - payload.amount

    wallet.balance = balance_after

    tx = CustomerWalletTransaction(
        tenant_id=ctx.tenant_id,
        wallet_id=wallet.id,
        transaction_type=payload.transaction_type,
        amount=payload.amount,
        balance_after=balance_after,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        description=payload.description,
    )
    db.add(tx)
    await db.flush()
    await db.commit()
    
    resp = WalletTransactionResponse.model_validate(tx)
    resp.customer_id = customer.id
    resp.customer_name = customer.name
    return resp


@router.get("/transactions/{tx_id}", response_model=WalletTransactionResponse)
async def get_transaction(
    tx_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    row = (await db.execute(
        select(CustomerWalletTransaction, CustomerWallet.customer_id, Customer.name)
        .join(CustomerWallet, CustomerWalletTransaction.wallet_id == CustomerWallet.id)
        .join(Customer, CustomerWallet.customer_id == Customer.id, isouter=True)
        .where(
            CustomerWalletTransaction.id == tx_id,
            CustomerWalletTransaction.tenant_id == ctx.tenant_id,
        )
    )).first()
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx_obj, cust_id, cust_name = row
    resp = WalletTransactionResponse.model_validate(tx_obj)
    resp.customer_id = cust_id
    resp.customer_name = cust_name or "Customer"
    return resp


# ─── Alias endpoints matching frontend routes ────────────────────────

@router.get("/transactions", response_model=PaginatedResponse)
async def list_transactions(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    customer_id: str | None = None,
    transaction_type: str | None = None,
):
    """Alias for /customers/{customer_id}/transactions — matches frontend route."""
    from uuid import UUID
    q = (
        select(CustomerWalletTransaction, CustomerWallet.customer_id, Customer.name)
        .join(CustomerWallet, CustomerWalletTransaction.wallet_id == CustomerWallet.id)
        .join(Customer, CustomerWallet.customer_id == Customer.id, isouter=True)
        .where(CustomerWalletTransaction.tenant_id == ctx.tenant_id)
    )
    if customer_id:
        try:
            cid = UUID(customer_id)
            q = q.where(CustomerWallet.customer_id == cid)
        except ValueError:
            pass
    if transaction_type:
        q = q.where(CustomerWalletTransaction.transaction_type == transaction_type)

    count_q = select(func.count(CustomerWalletTransaction.id)).where(CustomerWalletTransaction.tenant_id == ctx.tenant_id)
    total = await db.scalar(count_q)
    rows = await db.execute(
        q.order_by(CustomerWalletTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for tx_obj, cust_id, cust_name in rows.all():
        resp = WalletTransactionResponse.model_validate(tx_obj)
        resp.customer_id = cust_id
        resp.customer_name = cust_name or "Customer"
        items.append(resp)
    return paginate(items, total or 0, page, page_size)


@router.get("/balance/{customer_id}")
async def get_balance(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get wallet balance for a customer — matches frontend route."""
    wallet = await db.scalar(
        select(CustomerWallet).where(
            CustomerWallet.tenant_id == ctx.tenant_id,
            CustomerWallet.customer_id == customer_id,
        )
    )
    if not wallet:
        return {"customer_id": str(customer_id), "balance": 0}
    return {
        "customer_id": str(wallet.customer_id),
        "balance": float(wallet.balance),
    }


@router.post("/credit", response_model=WalletTransactionResponse, status_code=status.HTTP_201_CREATED)
async def credit_wallet(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Alias for POST /transactions — credit a customer's wallet."""
    from uuid import UUID
    amount = abs(float(payload.get("amount", 0)))
    tx = WalletTransactionCreate(
        customer_id=UUID(payload["customer_id"]) if isinstance(payload.get("customer_id"), str) else payload["customer_id"],
        transaction_type="manual_credit",
        amount=amount,
        description=payload.get("description") or "Wallet credit",
        reference_id=payload.get("reference_id"),
    )
    return await _process_wallet_tx(db, ctx, tx)


@router.post("/debit", response_model=WalletTransactionResponse, status_code=status.HTTP_201_CREATED)
async def debit_wallet(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Alias for POST /transactions — debit a customer's wallet."""
    from uuid import UUID
    amount = abs(float(payload.get("amount", 0)))
    tx = WalletTransactionCreate(
        customer_id=UUID(payload["customer_id"]) if isinstance(payload.get("customer_id"), str) else payload["customer_id"],
        transaction_type="manual_debit",
        amount=amount,
        description=payload.get("description") or "Wallet debit",
        reference_id=payload.get("reference_id"),
    )
    return await _process_wallet_tx(db, ctx, tx)


@router.post("/adjust", response_model=WalletTransactionResponse, status_code=status.HTTP_201_CREATED)
async def adjust_wallet(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_wallet"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Adjust a customer's wallet balance by signed amount."""
    from uuid import UUID
    amount = abs(float(payload.get("amount", 0)))
    raw_amount = float(payload.get("amount", 0))
    tx_type = "manual_credit" if raw_amount >= 0 else "manual_debit"
    tx = WalletTransactionCreate(
        customer_id=UUID(payload["customer_id"]) if isinstance(payload.get("customer_id"), str) else payload["customer_id"],
        transaction_type=tx_type,
        amount=amount,
        description=payload.get("description") or "Wallet adjustment",
    )
    return await _process_wallet_tx(db, ctx, tx)
