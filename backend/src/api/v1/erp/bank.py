"""Bank Management — Accounts, Transactions, Reconciliations."""
import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, or_, delete, update
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
from src.utils.clock import clock

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
    company_id: uuid.UUID | None = Query(default=None),
):
    query = select(BankAccount).where(BankAccount.tenant_id == ctx.tenant_id)
    target_cid = company_id or ctx.active_company_id
    if target_cid:
        query = query.where(
            or_(
                BankAccount.company_id == target_cid,
                BankAccount.company_id.is_(None)
            )
        )
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



async def _sync_bank_to_settings(db: AsyncSession, tenant_id: uuid.UUID, account: BankAccount) -> None:
    """Sync default bank account details into Tenant.settings and Company.settings for invoice print engines."""
    from src.models import Tenant, Company
    parts = [f"Bank: {account.bank_name or account.name}"]
    if account.account_number:
        parts.append(f"A/C: {account.account_number}")
    if account.ifsc_code:
        parts.append(f"IFSC: {account.ifsc_code}")
    if account.account_holder_name:
        parts.append(f"Holder: {account.account_holder_name}")
    if account.branch_name:
        parts.append(f"Branch: {account.branch_name}")
    if account.upi_id:
        parts.append(f"UPI: {account.upi_id}")
    bank_str = " | ".join(parts)

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if tenant:
        t_settings = dict(tenant.settings or {})
        inv_settings = dict(t_settings.get("invoice_settings") or {})
        inv_settings["bank_details"] = bank_str
        inv_settings["bank_name"] = account.bank_name or account.name
        inv_settings["bank_account"] = account.account_number or ""
        inv_settings["bank_ifsc"] = account.ifsc_code or ""
        inv_settings["account_holder_name"] = account.account_holder_name or ""
        inv_settings["upi_id"] = account.upi_id or ""
        inv_settings["default_bank_account_id"] = str(account.id)
        t_settings["invoice_settings"] = inv_settings
        t_settings["bank_details"] = bank_str
        tenant.settings = t_settings

    if account.company_id:
        company = await db.scalar(select(Company).where(Company.id == account.company_id, Company.tenant_id == tenant_id))
        if company:
            c_settings = dict(company.settings or {})
            c_settings["bank_details"] = bank_str
            c_settings["bank_name"] = account.bank_name or account.name
            c_settings["bank_account_number"] = account.account_number or ""
            c_settings["bank_ifsc"] = account.ifsc_code or ""
            c_settings["account_holder_name"] = account.account_holder_name or ""
            c_settings["upi_vpa"] = account.upi_id or ""
            company.settings = c_settings


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
    from sqlalchemy import update
    target_cid = payload.company_id or ctx.active_company_id
    existing_count = await db.scalar(
        select(func.count()).select_from(
            select(BankAccount.id).where(
                BankAccount.tenant_id == ctx.tenant_id,
                or_(BankAccount.company_id == target_cid, BankAccount.company_id.is_(None)) if target_cid else True
            ).subquery()
        )
    )
    should_be_default = payload.is_default or (existing_count == 0)

    account_data = payload.model_dump()
    if target_cid and not account_data.get("company_id"):
        account_data["company_id"] = target_cid
    account_data["is_default"] = should_be_default
    account = BankAccount(tenant_id=ctx.tenant_id, **account_data)
    db.add(account)
    await db.flush()

    if should_be_default:
        cond = [BankAccount.tenant_id == ctx.tenant_id, BankAccount.id != account.id]
        if target_cid:
            cond.append(or_(BankAccount.company_id == target_cid, BankAccount.company_id.is_(None)))
        await db.execute(
            update(BankAccount)
            .where(*cond)
            .values(is_default=False)
        )
        await _sync_bank_to_settings(db, ctx.tenant_id, account)

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


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_account(
    account_id: uuid.UUID,
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

    from src.models import BankTransaction, Tenant, Company
    from sqlalchemy.orm.attributes import flag_modified

    # Delete any associated transactions
    await db.execute(
        delete(BankTransaction).where(BankTransaction.bank_account_id == account_id)
    )

    was_default = account.is_default
    target_cid = account.company_id
    await db.delete(account)
    await db.flush()

    if was_default:
        next_account = await db.scalar(
            select(BankAccount).where(
                BankAccount.tenant_id == ctx.tenant_id,
                or_(BankAccount.company_id == target_cid, BankAccount.company_id.is_(None)) if target_cid else True
            ).order_by(BankAccount.created_at.desc())
        )
        if next_account:
            next_account.is_default = True
            await _sync_bank_to_settings(db, ctx.tenant_id, next_account)
        else:
            tenant = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
            if tenant and tenant.settings:
                t_settings = dict(tenant.settings)
                inv_settings = dict(t_settings.get("invoice_settings") or {})
                if inv_settings.get("default_bank_account_id") == str(account_id):
                    inv_settings["default_bank_account_id"] = None
                    inv_settings["bank_details"] = ""
                    inv_settings["bank_name"] = ""
                    inv_settings["bank_account"] = ""
                    inv_settings["bank_ifsc"] = ""
                    inv_settings["account_holder_name"] = ""
                    inv_settings["upi_id"] = ""
                    t_settings["invoice_settings"] = inv_settings
                    tenant.settings = t_settings
                    flag_modified(tenant, "settings")

            if target_cid:
                comp = await db.scalar(select(Company).where(Company.id == target_cid, Company.tenant_id == ctx.tenant_id))
                if comp and comp.settings:
                    c_settings = dict(comp.settings)
                    c_settings["bank_details"] = ""
                    c_settings["bank_name"] = ""
                    c_settings["bank_account_number"] = ""
                    c_settings["bank_ifsc"] = ""
                    c_settings["account_holder_name"] = ""
                    c_settings["upi_vpa"] = ""
                    comp.settings = c_settings
                    flag_modified(comp, "settings")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="bank",
        action="bank_account_deleted",
        entity_type="bank_account",
        entity_id=account_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return None


@router.patch("/accounts/{account_id}", response_model=BankAccountResponse)
async def update_bank_account(
    account_id: uuid.UUID,
    payload: BankAccountUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bank_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import update
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

    if account.is_default:
        await db.execute(
            update(BankAccount)
            .where(BankAccount.tenant_id == ctx.tenant_id, BankAccount.id != account.id)
            .values(is_default=False)
        )
        await _sync_bank_to_settings(db, ctx.tenant_id, account)

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


@router.post("/accounts/{account_id}/set-default", response_model=BankAccountResponse)
async def set_default_bank_account(
    account_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:bank_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import update
    account = await db.scalar(
        select(BankAccount).where(
            BankAccount.id == account_id, BankAccount.tenant_id == ctx.tenant_id
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    await db.execute(
        update(BankAccount)
        .where(BankAccount.tenant_id == ctx.tenant_id)
        .values(is_default=False)
    )
    account.is_default = True
    await _sync_bank_to_settings(db, ctx.tenant_id, account)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="bank",
        action="bank_account_set_default",
        entity_type="bank_account",
        entity_id=account.id,
        new_values={"is_default": True},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(account)
    return account


# Bank Transactions (account-scoped alias for per-account view)
@router.get("/accounts/{account_id}/transactions", response_model=PaginatedResponse[BankTransactionResponse])
async def list_account_transactions(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:bank_transactions"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    account_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    date_from: str | None = None,
    date_to: str | None = None,
    is_reconciled: bool | None = None,
    search: str | None = None,
):
    query = select(BankTransaction).where(BankTransaction.tenant_id == ctx.tenant_id, BankTransaction.bank_account_id == account_id)
    if date_from:
        query = query.where(BankTransaction.transaction_date >= date_from)
    if date_to:
        query = query.where(BankTransaction.transaction_date <= date_to)
    if is_reconciled is not None:
        query = query.where(BankTransaction.is_reconciled == is_reconciled)
    if search:
        query = query.where(BankTransaction.description.ilike(f"%{search}%") | BankTransaction.counterparty.ilike(f"%{search}%"))
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(BankTransaction.transaction_date.desc(), BankTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


# ─── Transactions (global, filtered by bank_account_id param) ────────────────────

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
        select(BankAccount).where(
            BankAccount.id == payload.bank_account_id,
            BankAccount.tenant_id == ctx.tenant_id,
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

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
    recon.completed_at = clock.now()

    for item in recon.items:
        item.is_cleared = True
        if item.bank_transaction_id:
            txn = await db.scalar(
                select(BankTransaction).where(BankTransaction.id == item.bank_transaction_id)
            )
            if txn:
                txn.is_reconciled = True
                txn.reconciled_at = clock.now()
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
