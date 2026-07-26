"""Bank Management — Accounts, Transactions, Reconciliations."""
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
from src.models.erp import (
    BankAccount,
    BankReconciliation,
    BankReconciliationItem,
    BankTransaction,
)
from src.schemas.erp_accounting import (
    BankAccountCreate,
    BankAccountResponse,
    BankAccountUpdate,
    BankReconciliationCreate,
    BankReconciliationItemCreate,
    BankReconciliationItemResponse,
    BankReconciliationResponse,
    BankTransactionCreate,
    BankTransactionResponse,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/bank", tags=["Bank Management"])


# ─── Bank Accounts ──────────────────────────────────────────────

@router.get("/accounts", response_model=PaginatedResponse[BankAccountResponse])
async def list_bank_accounts(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bank_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = None,
):
    query = select(BankAccount).where(BankAccount.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(BankAccount.status == status_filter)
    if search:
        query = query.where(
            BankAccount.name.ilike(f"%{search}%")
            | BankAccount.bank_name.ilike(f"%{search}%")
            | BankAccount.account_number.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(BankAccount.is_default.desc(), BankAccount.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/accounts/{account_id}", response_model=BankAccountResponse)
async def get_bank_account(
    account_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bank_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await db.scalar(
        select(BankAccount).where(
            BankAccount.id == account_id, BankAccount.tenant_id == ctx.tenant_id
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.post(
    "/accounts",
    response_model=BankAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_bank_account(
    payload: BankAccountCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bank_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = BankAccount(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(account)
    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="bank",
        action="bank_account_created",
        entity_type="bank_account",
        entity_id=account.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(account)
    return account


@router.patch("/accounts/{account_id}", response_model=BankAccountResponse)
async def update_bank_account(
    account_id: uuid.UUID,
    payload: BankAccountUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bank_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await db.scalar(
        select(BankAccount).where(
            BankAccount.id == account_id, BankAccount.tenant_id == ctx.tenant_id
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    updates = payload.model_dump(exclude_unset=True)
    old_values = {k: getattr(account, k) for k in updates}
    for key, value in updates.items():
        setattr(account, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="bank",
        action="bank_account_updated",
        entity_type="bank_account",
        entity_id=account.id,
        old_values=old_values,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(account)
    return account


# ─── Bank Transactions ──────────────────────────────────────────

@router.get("/transactions", response_model=PaginatedResponse[BankTransactionResponse])
async def list_transactions(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bank_transactions"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    bank_account_id: uuid.UUID | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    is_reconciled: bool | None = None,
    search: str | None = None,
):
    query = select(BankTransaction).where(BankTransaction.tenant_id == ctx.tenant_id)
    if bank_account_id:
        query = query.where(BankTransaction.bank_account_id == bank_account_id)
    if date_from:
        query = query.where(BankTransaction.transaction_date >= date_from)
    if date_to:
        query = query.where(BankTransaction.transaction_date <= date_to)
    if is_reconciled is not None:
        query = query.where(BankTransaction.is_reconciled == is_reconciled)
    if search:
        query = query.where(
            BankTransaction.description.ilike(f"%{search}%")
            | BankTransaction.counterparty.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(BankTransaction.transaction_date.desc(), BankTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post(
    "/transactions",
    response_model=BankTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_transaction(
    payload: BankTransactionCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bank_transactions"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    txn = BankTransaction(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(txn)

    account = await db.scalar(
        select(BankAccount).where(BankAccount.id == payload.bank_account_id)
    )
    if account:
        if txn.transaction_type in ("credit", "deposit", "transfer_in"):
            account.current_balance += txn.amount
        else:
            account.current_balance -= txn.amount

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="bank",
        action="transaction_created",
        entity_type="bank_transaction",
        entity_id=txn.id,
        new_values={"amount": str(txn.amount), "description": txn.description},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(txn)
    return txn


# ─── Reconciliations ────────────────────────────────────────────

@router.get("/reconciliations", response_model=PaginatedResponse[BankReconciliationResponse])
async def list_reconciliations(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bank_reconciliations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    bank_account_id: uuid.UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
):
    query = select(BankReconciliation).where(BankReconciliation.tenant_id == ctx.tenant_id)
    if bank_account_id:
        query = query.where(BankReconciliation.bank_account_id == bank_account_id)
    if status_filter:
        query = query.where(BankReconciliation.status == status_filter)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(BankReconciliation.reconciliation_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get(
    "/reconciliations/{recon_id}",
    response_model=BankReconciliationResponse,
)
async def get_reconciliation(
    recon_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bank_reconciliations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    recon = await db.scalar(
        select(BankReconciliation)
        .options(selectinload(BankReconciliation.items))
        .where(BankReconciliation.id == recon_id, BankReconciliation.tenant_id == ctx.tenant_id)
    )
    if not recon:
        raise HTTPException(status_code=404, detail="Reconciliation not found")
    return recon


@router.post(
    "/reconciliations",
    response_model=BankReconciliationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reconciliation(
    payload: BankReconciliationCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bank_reconciliations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    recon = BankReconciliation(tenant_id=ctx.tenant_id, **payload.model_dump(exclude={"items"}))
    db.add(recon)
    await db.flush()

    for item_payload in payload.items:
        item = BankReconciliationItem(reconciliation_id=recon.id, **item_payload.model_dump())
        db.add(item)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="bank",
        action="reconciliation_created",
        entity_type="bank_reconciliation",
        entity_id=recon.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(recon)
    return recon


@router.post("/reconciliations/{recon_id}/complete")
async def complete_reconciliation(
    recon_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bank_reconciliations"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    recon = await db.scalar(
        select(BankReconciliation)
        .options(selectinload(BankReconciliation.items))
        .where(BankReconciliation.id == recon_id, BankReconciliation.tenant_id == ctx.tenant_id)
    )
    if not recon:
        raise HTTPException(status_code=404, detail="Reconciliation not found")

    recon.status = "completed"
    recon.completed_by_user_id = ctx.user.id
    recon.completed_at = datetime.now()

    for item in recon.items:
        item.is_cleared = True
        if item.bank_transaction_id:
            txn = await db.scalar(
                select(BankTransaction).where(BankTransaction.id == item.bank_transaction_id)
            )
            if txn:
                txn.is_reconciled = True
                txn.reconciled_at = datetime.now()
                txn.reconciled_by_user_id = ctx.user.id

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="bank",
        action="reconciliation_completed",
        entity_type="bank_reconciliation",
        entity_id=recon.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return {"status": "completed", "reconciliation_id": str(recon.id)}
