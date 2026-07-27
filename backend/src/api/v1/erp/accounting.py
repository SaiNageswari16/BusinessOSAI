"""Accounting — Chart of Accounts, Journal Entries, General Ledger, Opening Balances."""
import uuid
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models.erp import (
    AccountBalance,
    ChartOfAccount,
    EntryStatus,
    EntryType,
    JournalEntry,
    JournalEntryLine,
)
from src.schemas.erp_accounting import (
    ChartOfAccountCreate,
    ChartOfAccountResponse,
    ChartOfAccountUpdate,
    JournalEntryCreate,
    JournalEntryLineCreate,
    JournalEntryLineResponse,
    JournalEntryResponse,
    JournalEntryUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate

router = APIRouter(prefix="/accounting", tags=["Accounting"])


# ─── Chart of Accounts ───────────────────────────────────────────

@router.get("/accounts", response_model=PaginatedResponse[ChartOfAccountResponse])
async def list_accounts(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:chart_of_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    account_type: str | None = None,
    search: str | None = None,
    is_active: bool | None = None,
):
    query = select(ChartOfAccount).where(ChartOfAccount.tenant_id == ctx.tenant_id)
    if account_type:
        query = query.where(ChartOfAccount.account_type == account_type)
    if search:
        query = query.where(
            ChartOfAccount.name.ilike(f"%{search}%")
            | ChartOfAccount.code.ilike(f"%{search}%")
        )
    if is_active is not None:
        query = query.where(ChartOfAccount.is_active == is_active)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ChartOfAccount.sort_order, ChartOfAccount.code)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/accounts/{account_id}", response_model=ChartOfAccountResponse)
async def get_account(
    account_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:chart_of_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.id == account_id,
            ChartOfAccount.tenant_id == ctx.tenant_id,
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post(
    "/accounts",
    response_model=ChartOfAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_account(
    payload: ChartOfAccountCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:chart_of_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = ChartOfAccount(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(account)
    await db.flush()
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="account_created",
        entity_type="chart_of_account",
        entity_id=account.id,
        new_values=payload.model_dump(mode="json"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(account)
    return account


@router.patch("/accounts/{account_id}", response_model=ChartOfAccountResponse)
async def update_account(
    account_id: uuid.UUID,
    payload: ChartOfAccountUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:chart_of_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.id == account_id,
            ChartOfAccount.tenant_id == ctx.tenant_id,
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    updates = payload.model_dump(exclude_unset=True)
    old_values = {k: getattr(account, k) for k in updates}
    for key, value in updates.items():
        setattr(account, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="account_updated",
        entity_type="chart_of_account",
        entity_id=account.id,
        old_values=old_values,
        new_values=updates,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:chart_of_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.id == account_id,
            ChartOfAccount.tenant_id == ctx.tenant_id,
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="account_deleted",
        entity_type="chart_of_account",
        entity_id=account.id,
        old_values={"code": account.code, "name": account.name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.delete(account)
    await db.commit()


# ─── Journal Entries ────────────────────────────────────────────

@router.get("/journal-entries", response_model=PaginatedResponse[JournalEntryResponse])
async def list_journal_entries(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:journal_entries"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    entry_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
):
    query = select(JournalEntry).where(JournalEntry.tenant_id == ctx.tenant_id)
    if status_filter:
        query = query.where(JournalEntry.status == status_filter)
    if entry_type:
        query = query.where(JournalEntry.entry_type == entry_type)
    if date_from:
        query = query.where(JournalEntry.entry_date >= date_from)
    if date_to:
        query = query.where(JournalEntry.entry_date <= date_to)
    if search:
        query = query.where(
            JournalEntry.entry_number.ilike(f"%{search}%")
            | JournalEntry.description.ilike(f"%{search}%")
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
        .options(selectinload(JournalEntry.lines))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryResponse)
async def get_journal_entry(
    entry_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:journal_entries"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == ctx.tenant_id)
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.post(
    "/journal-entries",
    response_model=JournalEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_journal_entry(
    payload: JournalEntryCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:journal_entries"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    total_debit = sum(line.debit for line in payload.lines)
    total_credit = sum(line.credit for line in payload.lines)
    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Debits ({total_debit}) must equal credits ({total_credit})",
        )

    from src.utils.number_series import generate_number

    entry_number = await generate_number(db, ctx.tenant_id, "journal", payload.company_id)

    entry = JournalEntry(
        tenant_id=ctx.tenant_id,
        entry_number=entry_number,
        total_debit=total_debit,
        total_credit=total_credit,
        created_by_user_id=ctx.user.id,
        **payload.model_dump(exclude={"lines"}),
    )
    db.add(entry)
    await db.flush()

    for idx, line in enumerate(payload.lines):
        jl = JournalEntryLine(
            entry_id=entry.id,
            line_number=idx + 1,
            sort_order=idx,
            **line.model_dump(),
        )
        db.add(jl)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="journal_entry_created",
        entity_type="journal_entry",
        entity_id=entry.id,
        new_values={"entry_number": entry_number, "total_debit": str(total_debit)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry.id)
    )
    return entry


@router.patch("/journal-entries/{entry_id}", response_model=JournalEntryResponse)
async def update_journal_entry(
    entry_id: uuid.UUID,
    payload: JournalEntryUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:journal_entries"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == ctx.tenant_id)
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    if entry.status == "posted":
        raise HTTPException(status_code=400, detail="Cannot update a posted entry")

    updates = payload.model_dump(exclude_unset=True, exclude={"lines"})
    old_values = {k: getattr(entry, k) for k in updates}
    for key, value in updates.items():
        setattr(entry, key, value)

    if payload.lines is not None:
        total_debit = sum(line.debit for line in payload.lines)
        total_credit = sum(line.credit for line in payload.lines)
        if abs(total_debit - total_credit) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Debits ({total_debit}) must equal credits ({total_credit})",
            )

        for old_line in list(entry.lines):
            await db.delete(old_line)

        for idx, line in enumerate(payload.lines):
            jl = JournalEntryLine(
                entry_id=entry.id,
                line_number=idx + 1,
                sort_order=idx,
                **line.model_dump(),
            )
            db.add(jl)

        entry.total_debit = total_debit
        entry.total_credit = total_credit

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="journal_entry_updated",
        entity_type="journal_entry",
        entity_id=entry.id,
        old_values=old_values,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry.id)
    )
    return entry


@router.post("/journal-entries/{entry_id}/post", response_model=JournalEntryResponse)
async def post_journal_entry(
    entry_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("post:journal_entries"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == ctx.tenant_id)
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    if entry.status != "draft":
        raise HTTPException(status_code=400, detail=f"Entry is already {entry.status}")

    from datetime import datetime as dt

    entry.status = "posted"
    entry.posted_at = dt.now()
    entry.posted_by_user_id = ctx.user.id

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="journal_entry_posted",
        entity_type="journal_entry",
        entity_id=entry.id,
        new_values={"entry_number": entry.entry_number},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id)
    )
    return entry


@router.post(
    "/journal-entries/{entry_id}/reverse",
    response_model=JournalEntryResponse,
)
async def reverse_journal_entry(
    entry_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("post:journal_entries"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == ctx.tenant_id)
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    if entry.status != "posted":
        raise HTTPException(status_code=400, detail="Only posted entries can be reversed")

    from src.utils.number_series import generate_number
    from datetime import datetime as dt

    entry_num = await generate_number(db, ctx.tenant_id, "journal")
    reversing = JournalEntry(
        tenant_id=ctx.tenant_id,
        entry_number=entry_num,
        entry_type=EntryType.CONTRA,
        status="posted",
        entry_date=dt.now().date(),
        description=f"Reversal of {entry.entry_number}",
        total_debit=entry.total_credit,
        total_credit=entry.total_debit,
        currency_code=entry.currency_code,
        created_by_user_id=ctx.user.id,
        source_module="accounting",
        source_id=entry.id,
    )
    db.add(reversing)
    await db.flush()

    for line in entry.lines:
        jl = JournalEntryLine(
            entry_id=reversing.id,
            account_id=line.account_id,
            cost_center_id=line.cost_center_id,
            description=f"Reversal of {line.description or ''}",
            debit=line.credit,
            credit=line.debit,
            currency_code=line.currency_code,
            exchange_rate=line.exchange_rate,
            line_number=line.line_number,
        )
        db.add(jl)

    entry.status = "reversed"
    entry.reversed_at = dt.now()
    entry.reversed_by_user_id = ctx.user.id
    entry.reverse_entry_id = reversing.id

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="journal_entry_reversed",
        entity_type="journal_entry",
        entity_id=entry.id,
        new_values={"reversing_entry_id": str(reversing.id)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    entry = await db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == entry_id)
    )
    return entry


@router.get(
    "/accounts/tree",
    response_model=list[ChartOfAccountResponse],
)
async def get_account_tree(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:chart_of_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    account_type: str | None = None,
):
    query = select(ChartOfAccount).where(
        ChartOfAccount.tenant_id == ctx.tenant_id,
        ChartOfAccount.parent_id == None,
        ChartOfAccount.is_active == True,
    )
    if account_type:
        query = query.where(ChartOfAccount.account_type == account_type)

    result = await db.execute(query.order_by(ChartOfAccount.sort_order, ChartOfAccount.code))
    roots = result.scalars().all()
    return roots


# ─── General Ledger ─────────────────────────────────────────────────────────────


class GLLineResponse(BaseModel):
    entry_id: str
    entry_number: str
    entry_date: str
    entry_type: str
    reference: str | None
    description: str | None
    status: str
    line_number: int
    account_id: str
    account_code: str
    account_name: str
    account_type: str
    debit: float
    credit: float
    currency_code: str


class GLAccountSummary(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    account_type: str
    opening_balance: float
    total_debit: float
    total_credit: float
    closing_balance: float
    lines: list[GLLineResponse]


@router.get("/general-ledger", response_model=list[GLAccountSummary])
async def get_general_ledger(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:journal_entries"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    account_id: uuid.UUID | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    entry_type: str | None = None,
):
    """General Ledger — all posted journal entry lines, optionally filtered by account or date range."""
    account_query = select(ChartOfAccount).where(
        ChartOfAccount.tenant_id == ctx.tenant_id,
        ChartOfAccount.is_active == True,
    )
    if account_id:
        account_query = account_query.where(ChartOfAccount.id == account_id)

    accounts = (await db.execute(account_query.order_by(ChartOfAccount.code))).scalars().all()

    summaries: list[GLAccountSummary] = []

    for acc in accounts:
        entry_conditions = [
            JournalEntry.tenant_id == ctx.tenant_id,
            JournalEntry.status == EntryStatus.POSTED,
        ]
        if date_from:
            entry_conditions.append(JournalEntry.entry_date >= date_from)
        if date_to:
            entry_conditions.append(JournalEntry.entry_date <= date_to)

        lines_result = await db.execute(
            select(
                JournalEntryLine,
                JournalEntry,
                ChartOfAccount.code.label("acc_code"),
                ChartOfAccount.name.label("acc_name"),
                ChartOfAccount.account_type.label("acc_type"),
            )
            .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
            .join(ChartOfAccount, ChartOfAccount.id == JournalEntryLine.account_id)
            .where(
                and_(
                    JournalEntryLine.account_id == acc.id,
                    *entry_conditions,
                )
            )
            .order_by(JournalEntry.entry_date, JournalEntry.entry_number, JournalEntryLine.line_number)
        )

        line_rows = lines_result.all()
        if not line_rows:
            continue

        total_debit = sum(float(r.JournalEntryLine.base_currency_debit or 0) for r in line_rows)
        total_credit = sum(float(r.JournalEntryLine.base_currency_credit or 0) for r in line_rows)

        if acc.account_type in ("asset", "expense"):
            closing = float(acc.opening_balance or 0) + total_debit - total_credit
        else:
            closing = float(acc.opening_balance or 0) + total_credit - total_debit

        gl_lines = [
            GLLineResponse(
                entry_id=str(r.JournalEntry.id),
                entry_number=r.JournalEntry.entry_number,
                entry_date=str(r.JournalEntry.entry_date),
                entry_type=r.JournalEntry.entry_type,
                reference=r.JournalEntry.reference,
                description=r.JournalEntry.description,
                status=r.JournalEntry.status,
                line_number=r.JournalEntryLine.line_number,
                account_id=str(acc.id),
                account_code=r.acc_code,
                account_name=r.acc_name,
                account_type=r.acc_type,
                debit=float(r.JournalEntryLine.base_currency_debit or 0),
                credit=float(r.JournalEntryLine.base_currency_credit or 0),
                currency_code=r.JournalEntryLine.currency_code or "INR",
            )
            for r in line_rows
        ]

        summaries.append(
            GLAccountSummary(
                account_id=str(acc.id),
                account_code=acc.code,
                account_name=acc.name,
                account_type=acc.account_type,
                opening_balance=float(acc.opening_balance or 0),
                total_debit=total_debit,
                total_credit=total_credit,
                closing_balance=closing,
                lines=gl_lines,
            )
        )

    return summaries


# ─── Opening Balances ───────────────────────────────────────────────────────────


@router.get("/opening-balances", response_model=list[ChartOfAccountResponse])
async def get_opening_balances(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:chart_of_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    account_type: str | None = None,
    search: str | None = None,
):
    """All accounts with their opening balance amounts for editing."""
    query = select(ChartOfAccount).where(ChartOfAccount.tenant_id == ctx.tenant_id)
    if account_type:
        query = query.where(ChartOfAccount.account_type == account_type)
    if search:
        query = query.where(
            ChartOfAccount.name.ilike(f"%{search}%") | ChartOfAccount.code.ilike(f"%{search}%")
        )

    result = await db.execute(query.order_by(ChartOfAccount.sort_order, ChartOfAccount.code))
    return result.scalars().all()


@router.patch("/opening-balances/{account_id}", response_model=ChartOfAccountResponse)
async def update_opening_balance(
    account_id: uuid.UUID,
    payload: ChartOfAccountUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:chart_of_accounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a single account's opening balance."""
    account = await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.id == account_id,
            ChartOfAccount.tenant_id == ctx.tenant_id,
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    updates = payload.model_dump(exclude_unset=True)
    old_balance = account.opening_balance
    for key, value in updates.items():
        setattr(account, key, value)

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="accounting",
        action="opening_balance_updated",
        entity_type="chart_of_account",
        entity_id=account.id,
        old_values={"opening_balance": old_balance},
        new_values={"opening_balance": updates.get("opening_balance", old_balance)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(account)
    return account
