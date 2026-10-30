"""Accounting service — operational finance routes (PetPooja Finance screens).

Four operational finance domains on top of the existing chart-of-accounts /
journal engine:

  * operational expenses  — a vendor bill paid out (NOT a staff expense claim;
    the claim flow already lives in ``api.py`` and is untouched here)
  * withdrawals           — owner drawdowns from an outlet, with approval
  * currency book         — tenant exchange rates + current-rate lookup
  * cash-flow "all wallets" — windowed in/out roll-up over this service's own
    tables only (no cross-service reads)

Events published (outbox row written in the SAME transaction as the GL
posting, then relayed; immediate local dispatch so in-process handlers still
see it in real time):
  * ``expense.recorded``     {expense_id, amount, category, payment_mode,
                             account_id?, date}
  * ``withdrawal.recorded``  {withdrawal_id, amount, method, account_id, status}
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.accounting import service
from src.services.accounting.models import (
    Expense,
    ExpenseCategory,
    ExchangeRate,
    Withdrawal,
    WithdrawalStatus,
)
from src.services.accounting.outbox import record_event
from src.services.accounting.schemas import (
    CashFlowWalletResponse,
    ExchangeRateCreate,
    ExchangeRateCurrentResponse,
    ExchangeRateResponse,
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    ExpenseCreate,
    ExpensePostResponse,
    ExpenseResponse,
    WithdrawalActionResponse,
    WithdrawalCreate,
    WithdrawalResponse,
)
from src.services.event_bus.bus import Event, bus
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _make_event(topic: str, tenant_id: uuid.UUID, data: dict,
                outlet_id: uuid.UUID | None = None) -> Event:
    return Event(
        type=topic,
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        data=data,
        source_service="accounting",
    )


async def _emit(db: AsyncSession, event: Event, outlet_id: uuid.UUID | None = None) -> None:
    """Write the outbox row in the caller's transaction, commit, dispatch local.

    House convention (contract §3): the outbox row lands BEFORE commit in the
    same transaction as the domain change (atomicity), then an immediate
    local bus dispatch so in-process handlers see it in real time; the relay
    in main.py handles the cross-process delivery from the durable row.
    """
    await record_event(
        db,
        type=event.type,
        data=event.data,
        tenant_id=event.tenant_id,
        outlet_id=outlet_id,
        event_id=event.event_id,
    )
    await db.commit()
    # Stamp the event with the same outlet the outbox row carries, so the
    # in-process/stream copy is consistent with the durable one. Without this
    # the local-publish stream entry has outlet_id null while the relay's
    # copy (same event_id, correct outlet) is skipped by the consumer's
    # durable dedupe ledger — the consumer then sees only the null-outlet
    # entry and silently drops the fact.
    event.outlet_id = outlet_id
    await bus.publish(event, local=True)


def _error_code(exc: service.AccountingError) -> int:
    return {
        "conflict": 409,
        "not_found": 404,
        "bad_request": 400,
    }.get(exc.kind, 400)


# ─── Expense categories ──────────────────────────────────────────────────────


@router.get("/expense-categories", response_model=list[ExpenseCategoryResponse], tags=["expenses"])
async def list_expense_categories(
    identity: CurrentIdentity,
    db: DbDep,
    include_inactive: bool = False,
):
    identity.require("view:accounting")
    stmt = select(ExpenseCategory).where(ExpenseCategory.tenant_id == identity.tenant_id)
    if not include_inactive:
        stmt = stmt.where(ExpenseCategory.is_active.is_(True))
    stmt = stmt.order_by(ExpenseCategory.code)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/expense-categories", response_model=ExpenseCategoryResponse,
             status_code=status.HTTP_201_CREATED, tags=["expenses"])
async def create_expense_category(
    payload: ExpenseCategoryCreate, identity: CurrentIdentity, db: DbDep,
):
    identity.require("manage:accounting")
    clash = await db.scalar(
        select(ExpenseCategory.id).where(
            ExpenseCategory.tenant_id == identity.tenant_id,
            ExpenseCategory.code == payload.code,
        )
    )
    if clash:
        raise HTTPException(
            status_code=409, detail=f"Expense category code '{payload.code}' already exists"
        )
    category = ExpenseCategory(
        tenant_id=identity.tenant_id,
        code=payload.code,
        name=payload.name,
        gl_account_code=payload.gl_account_code,
        is_active=payload.is_active,
    )
    db.add(category)
    await db.flush()
    return category


# ─── Expenses ────────────────────────────────────────────────────────────────


@router.get("/expenses", response_model=list[ExpenseResponse], tags=["expenses"])
async def list_expenses(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    payment_mode: str | None = None,
    posted: bool | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    identity.require("view:accounting")
    stmt = (
        select(Expense)
        .where(Expense.tenant_id == identity.tenant_id)
        .order_by(Expense.date.desc(), Expense.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if outlet_id:
        identity.can_access_outlet(outlet_id)
        stmt = stmt.where(Expense.outlet_id == outlet_id)
    if category_id:
        stmt = stmt.where(Expense.category_id == category_id)
    if payment_mode:
        stmt = stmt.where(Expense.payment_mode == payment_mode)
    if posted is not None:
        stmt = stmt.where(Expense.posted.is_(posted))
    if date_from:
        stmt = stmt.where(Expense.date >= date_from)
    if date_to:
        stmt = stmt.where(Expense.date <= date_to)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse, tags=["expenses"])
async def get_expense(expense_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    expense = await db.scalar(
        select(Expense).where(
            Expense.id == expense_id, Expense.tenant_id == identity.tenant_id
        )
    )
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.post("/expenses", response_model=ExpenseResponse,
             status_code=status.HTTP_201_CREATED, tags=["expenses"])
async def create_expense(payload: ExpenseCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    if payload.outlet_id:
        identity.can_access_outlet(payload.outlet_id)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than zero")

    category = await db.scalar(
        select(ExpenseCategory).where(
            ExpenseCategory.id == payload.category_id,
            ExpenseCategory.tenant_id == identity.tenant_id,
        )
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Expense category not found for this tenant")

    # Number the ledger row per tenant: EXP-2601-0001 (zero-padded,
    # gap-tolerant — the same count-based series the journal engine uses).
    seq = (await db.scalar(
        select(func.count(Expense.id)).where(Expense.tenant_id == identity.tenant_id)
    )) or 0
    expense = Expense(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        expense_no=f"EXP-{date.today().strftime('%y%m')}-{seq + 1:04d}",
        date=payload.date or date.today(),
        description=payload.description,
        category_id=payload.category_id,
        payment_mode=payload.payment_mode,
        amount=payload.amount,
        paid_to=payload.paid_to,
    )
    db.add(expense)
    await db.flush()
    return expense


@router.post("/expenses/{expense_id}/post", response_model=ExpensePostResponse,
             tags=["expenses"])
async def post_expense(expense_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Post the expense to the GL and emit ``expense.recorded``.

    The journal entry, the ``posted`` flag, and the outbox row commit in ONE
    transaction — the domain change and its event cannot drift apart.
    """
    identity.require("manage:accounting")
    try:
        expense, entry, payload = await service.post_expense(
            db, identity.tenant_id, expense_id, identity.user_id,
        )
    except service.AccountingError as exc:
        raise HTTPException(status_code=_error_code(exc), detail=exc.message)

    event = _make_event("expense.recorded", identity.tenant_id, data=payload)
    await _emit(db, event, outlet_id=expense.outlet_id)

    return ExpensePostResponse(
        expense=ExpenseResponse.model_validate(expense),
        posted=expense.posted,
        journal_entry_id=expense.journal_entry_id,
        message="Expense posted to the general ledger and recorded",
    )


# ─── Withdrawals ─────────────────────────────────────────────────────────────


@router.get("/withdrawals", response_model=list[WithdrawalResponse], tags=["withdrawals"])
async def list_withdrawals(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    status_filter: WithdrawalStatus | None = Query(default=None, alias="status"),
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    identity.require("view:accounting")
    stmt = (
        select(Withdrawal)
        .where(Withdrawal.tenant_id == identity.tenant_id)
        .order_by(Withdrawal.date.desc(), Withdrawal.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if outlet_id:
        identity.can_access_outlet(outlet_id)
        stmt = stmt.where(Withdrawal.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Withdrawal.status == status_filter)
    if date_from:
        stmt = stmt.where(Withdrawal.date >= date_from)
    if date_to:
        stmt = stmt.where(Withdrawal.date <= date_to)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/withdrawals/{withdrawal_id}", response_model=WithdrawalResponse,
            tags=["withdrawals"])
async def get_withdrawal(withdrawal_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    withdrawal = await db.scalar(
        select(Withdrawal).where(
            Withdrawal.id == withdrawal_id, Withdrawal.tenant_id == identity.tenant_id
        )
    )
    if withdrawal is None:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    return withdrawal


@router.post("/withdrawals", response_model=WithdrawalResponse,
             status_code=status.HTTP_201_CREATED, tags=["withdrawals"])
async def create_withdrawal(payload: WithdrawalCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    if payload.outlet_id:
        identity.can_access_outlet(payload.outlet_id)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Withdrawal amount must be greater than zero")
    withdrawal = Withdrawal(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        date=payload.date or date.today(),
        amount=payload.amount,
        method=payload.method,
        note=payload.note,
        status=WithdrawalStatus.PENDING,
    )
    db.add(withdrawal)
    await db.flush()
    return withdrawal


@router.post("/withdrawals/{withdrawal_id}/approve",
             response_model=WithdrawalActionResponse, tags=["withdrawals"])
async def approve_withdrawal(
    withdrawal_id: uuid.UUID, identity: CurrentIdentity, db: DbDep,
):
    """Approve and post the withdrawal: GL outflow + ``withdrawal.recorded``.

    Journal entry, status flip, and the outbox row commit together.
    """
    identity.require("manage:accounting")
    try:
        withdrawal, entry, payload = await service.approve_withdrawal(
            db, identity.tenant_id, withdrawal_id, identity.user_id,
        )
    except service.AccountingError as exc:
        raise HTTPException(status_code=_error_code(exc), detail=exc.message)

    event = _make_event("withdrawal.recorded", identity.tenant_id, data=payload)
    await _emit(db, event, outlet_id=withdrawal.outlet_id)

    return WithdrawalActionResponse(
        message="Withdrawal approved, posted and recorded",
        withdrawal=WithdrawalResponse.model_validate(withdrawal),
    )


@router.post("/withdrawals/{withdrawal_id}/reject",
             response_model=WithdrawalActionResponse, tags=["withdrawals"])
async def reject_withdrawal(
    withdrawal_id: uuid.UUID, identity: CurrentIdentity, db: DbDep,
    payload: dict | None = None,
):
    """Reject a pending withdrawal — state only, no GL, no outbox event."""
    identity.require("manage:accounting")
    reason = (payload or {}).get("reason")
    try:
        withdrawal = await service.reject_withdrawal(
            db, identity.tenant_id, withdrawal_id, reason,
        )
    except service.AccountingError as exc:
        raise HTTPException(status_code=_error_code(exc), detail=exc.message)
    return WithdrawalActionResponse(
        message="Withdrawal rejected",
        withdrawal=WithdrawalResponse.model_validate(withdrawal),
    )


# ─── Currency book ──────────────────────────────────────────────────────────


@router.get("/exchange-rates", response_model=list[ExchangeRateResponse], tags=["exchange-rates"])
async def list_exchange_rates(
    identity: CurrentIdentity,
    db: DbDep,
    from_currency: str | None = None,
    to_currency: str | None = None,
    limit: int = Query(100, le=500),
):
    identity.require("view:accounting")
    stmt = (
        select(ExchangeRate)
        .where(ExchangeRate.tenant_id == identity.tenant_id)
        .order_by(ExchangeRate.effective_from.desc())
        .limit(limit)
    )
    if from_currency:
        stmt = stmt.where(ExchangeRate.from_currency == from_currency.upper())
    if to_currency:
        stmt = stmt.where(ExchangeRate.to_currency == to_currency.upper())
    return list((await db.execute(stmt)).scalars().all())


@router.post("/exchange-rates", response_model=ExchangeRateResponse,
             status_code=status.HTTP_201_CREATED, tags=["exchange-rates"])
async def create_exchange_rate(
    payload: ExchangeRateCreate, identity: CurrentIdentity, db: DbDep,
):
    identity.require("manage:accounting")
    if payload.rate <= 0:
        raise HTTPException(status_code=400, detail="Exchange rate must be greater than zero")
    clash = await db.scalar(
        select(ExchangeRate.id).where(
            ExchangeRate.tenant_id == identity.tenant_id,
            ExchangeRate.from_currency == payload.from_currency.upper(),
            ExchangeRate.to_currency == payload.to_currency.upper(),
            ExchangeRate.effective_from == payload.effective_from,
        )
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"Rate {payload.from_currency.upper()}/{payload.to_currency.upper()} "
                   f"already exists for {payload.effective_from}",
        )
    rate = ExchangeRate(
        tenant_id=identity.tenant_id,
        from_currency=payload.from_currency.upper(),
        to_currency=payload.to_currency.upper(),
        rate=payload.rate,
        effective_from=payload.effective_from,
        notes=payload.notes,
    )
    db.add(rate)
    await db.flush()
    return rate


@router.get("/exchange-rates/current", response_model=ExchangeRateCurrentResponse,
            tags=["exchange-rates"])
async def current_exchange_rate(
    identity: CurrentIdentity,
    db: DbDep,
    from_currency: str = Query(...),
    to_currency: str = Query(...),
):
    """Latest rate with ``effective_from <= today`` for the exact pair.

    No reverse-pair inversion: a returned row always matches the requested
    direction. Returns an ``available: false`` envelope (not a 404) when no
    rate is effective yet — a currency-book screen can render "no rate"
    without special-casing errors.
    """
    identity.require("view:accounting")
    try:
        rate = await service.current_exchange_rate(
            db, identity.tenant_id, from_currency.upper(), to_currency.upper(),
        )
    except service.AccountingError:
        return ExchangeRateCurrentResponse(
            id=uuid.UUID(int=0),
            from_currency=from_currency.upper(),
            to_currency=to_currency.upper(),
            rate=Decimal("0"),
            effective_from=date.today(),
            available=False,
            reason="No rate effective on or before today for this pair",
        )
    return ExchangeRateCurrentResponse(
        id=rate.id,
        from_currency=rate.from_currency,
        to_currency=rate.to_currency,
        rate=rate.rate,
        effective_from=rate.effective_from,
        notes=rate.notes,
        available=True,
    )


# ─── Cash-flow "all wallets" summary ───────────────────────────────────────


@router.get("/cash-flow/summary", response_model=CashFlowWalletResponse,
            tags=["cash-flow"])
async def cash_flow_wallets_summary(
    identity: CurrentIdentity,
    db: DbDep,
    days: int = Query(30, ge=1, le=365),
    outlet_id: uuid.UUID | None = None,
):
    """Windowed in/out over THIS service's own tables only.

    Outflow = posted operational expenses + approved withdrawals in the
    trailing ``days``-day window. Inflow is 0 (sales live in billing, not
    here). Balance = snapshot of active bank account balances. See
    ``service.cash_flow_wallets`` for the exact summation semantics.
    """
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.cash_flow_wallets(db, identity.tenant_id, days, outlet_id)
