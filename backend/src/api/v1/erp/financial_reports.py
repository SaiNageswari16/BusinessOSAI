"""Financial accounting report endpoints — P&L, Balance Sheet, Cash Flow, Trial Balance."""
import logging
from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models.erp import AccountSubType, AccountType, ChartOfAccount, EntryStatus, JournalEntry, JournalEntryLine

logger = logging.getLogger("financial_reports_api")

router = APIRouter(prefix="/financial-reports", tags=["Financial Reports"])


# ── Response models ───────────────────────────────────────────────────────────


class LineItem(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    debit: float
    credit: float
    net: float


class ReportMeta(BaseModel):
    title: str
    from_date: date
    to_date: date
    currency: str = "INR"


class ProfitAndLossResponse(BaseModel):
    meta: ReportMeta
    income: List[LineItem]
    total_income: float
    cogs: List[LineItem]
    total_cogs: float
    gross_profit: float
    expenses: List[LineItem]
    total_expenses: float
    net_profit: float


class BalanceSheetResponse(BaseModel):
    meta: ReportMeta
    assets: List[LineItem]
    total_assets: float
    liabilities: List[LineItem]
    total_liabilities: float
    equity: List[LineItem]
    total_equity: float
    total_liabilities_and_equity: float


class TrialBalanceResponse(BaseModel):
    meta: ReportMeta
    entries: List[LineItem]
    total_debit: float
    total_credit: float


class CashFlowResponse(BaseModel):
    meta: ReportMeta
    operating: List[LineItem]
    net_operating: float
    investing: List[LineItem]
    net_investing: float
    financing: List[LineItem]
    net_financing: float
    net_cash_flow: float


class ARAgingResponse(BaseModel):
    meta: ReportMeta
    current: float
    days_1_30: float
    days_31_60: float
    days_61_90: float
    days_over_90: float
    total_outstanding: float


# ── Helpers ───────────────────────────────────────────────────────────────────


def _entry_filter(tenant_id, from_date, to_date, company_id=None):
    clauses = [
        JournalEntry.tenant_id == tenant_id,
        JournalEntry.entry_date >= from_date,
        JournalEntry.entry_date <= to_date,
        JournalEntry.status == EntryStatus.POSTED,
    ]
    if company_id is not None:
        clauses.append(JournalEntry.company_id == company_id)
    return clauses


def _entry_filter_upto(tenant_id, as_of, company_id=None):
    clauses = [
        JournalEntry.tenant_id == tenant_id,
        JournalEntry.entry_date <= as_of,
        JournalEntry.status == EntryStatus.POSTED,
    ]
    if company_id is not None:
        clauses.append(JournalEntry.company_id == company_id)
    return clauses


# ── Profit & Loss ─────────────────────────────────────────────────────────────


@router.get("/profit-and-loss", response_model=ProfitAndLossResponse)
async def profit_and_loss(
    from_date: date = Query(..., description="Start date for the report period"),
    to_date: date = Query(..., description="End date for the report period"),
    company_id: Optional[UUID] = Query(None, description="Filter by company/branch"),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Income statement showing revenues, COGS, expenses and net profit for a date range."""
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")

    result = await db.execute(
        select(
            ChartOfAccount.code,
            ChartOfAccount.name,
            ChartOfAccount.account_type,
            ChartOfAccount.account_sub_type,
            func.coalesce(func.sum(JournalEntryLine.base_currency_debit), 0).label("debit"),
            func.coalesce(func.sum(JournalEntryLine.base_currency_credit), 0).label("credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
        .where(and_(*_entry_filter(ctx.tenant_id, from_date, to_date, company_id)))
        .group_by(ChartOfAccount.code, ChartOfAccount.name,
                  ChartOfAccount.account_type, ChartOfAccount.account_sub_type)
        .order_by(ChartOfAccount.code)
    )

    income_lines, cogs_lines, expense_lines = [], [], []
    total_income = total_cogs = total_expenses = 0.0

    for r in result.all():
        d = float(r.debit or 0)
        c = float(r.credit or 0)
        net = c - d  # income accounts: credits increase; expenses: debits increase
        item = LineItem(
            account_code=r.code, account_name=r.name,
            account_type=r.account_type,
            debit=d, credit=c, net=net,
        )
        st = r.account_sub_type or ""
        if r.account_type == AccountType.INCOME:
            income_lines.append(item)
            total_income += net
        elif st == "cogs":
            cogs_lines.append(item)
            total_cogs += net
        elif r.account_type == AccountType.EXPENSE:
            expense_lines.append(item)
            total_expenses += net

    gross_profit = total_income - total_cogs
    net_profit = gross_profit - total_expenses

    return ProfitAndLossResponse(
        meta=ReportMeta(title="Profit & Loss", from_date=from_date, to_date=to_date),
        income=income_lines, total_income=total_income,
        cogs=cogs_lines, total_cogs=total_cogs,
        gross_profit=gross_profit,
        expenses=expense_lines, total_expenses=total_expenses,
        net_profit=net_profit,
    )


# ── Balance Sheet ─────────────────────────────────────────────────────────────


@router.get("/balance-sheet", response_model=BalanceSheetResponse)
async def balance_sheet(
    as_of: date = Query(..., description="As-of date for the balance sheet"),
    company_id: Optional[UUID] = Query(None, description="Filter by company/branch"),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Balance sheet as of a given date: Assets = Liabilities + Equity."""
    # Subquery: only include journal entries up to the as_of date
    entry_conditions = [
        JournalEntry.tenant_id == ctx.tenant_id,
        JournalEntry.entry_date <= as_of,
        JournalEntry.status == EntryStatus.POSTED,
    ]
    if company_id is not None:
        entry_conditions.append(JournalEntry.company_id == company_id)

    entry_subq = (
        select(
            JournalEntryLine.account_id,
            func.coalesce(func.sum(JournalEntryLine.base_currency_debit), 0).label("debit"),
            func.coalesce(func.sum(JournalEntryLine.base_currency_credit), 0).label("credit"),
        )
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
        .where(and_(*entry_conditions))
        .group_by(JournalEntryLine.account_id)
        .subquery()
    )

    result = await db.execute(
        select(
            ChartOfAccount.code,
            ChartOfAccount.name,
            ChartOfAccount.account_type,
            ChartOfAccount.account_sub_type,
            ChartOfAccount.opening_balance,
            func.coalesce(entry_subq.c.debit, 0).label("debit"),
            func.coalesce(entry_subq.c.credit, 0).label("credit"),
        )
        .outerjoin(entry_subq, entry_subq.c.account_id == ChartOfAccount.id)
        .where(and_(
            ChartOfAccount.tenant_id == ctx.tenant_id,
            ChartOfAccount.is_active == True,
        ))
        .group_by(ChartOfAccount.code, ChartOfAccount.name,
                  ChartOfAccount.account_type, ChartOfAccount.account_sub_type,
                  ChartOfAccount.opening_balance)
        .order_by(ChartOfAccount.code)
    )

    assets, liabilities, equity = [], [], []
    total_assets = total_liabilities = total_equity = 0.0

    for r in result.all():
        ob = float(r.opening_balance or 0)
        d = float(r.debit or 0)
        c = float(r.credit or 0)

        if r.account_type == AccountType.ASSET:
            net = ob + d - c  # debits increase assets
        elif r.account_type == AccountType.LIABILITY:
            net = ob + c - d  # credits increase liabilities
        else:
            net = ob + c - d  # credits increase equity

        item = LineItem(
            account_code=r.code, account_name=r.name,
            account_type=r.account_type, debit=d, credit=c, net=net,
        )
        if r.account_type == AccountType.ASSET:
            assets.append(item)
            total_assets += net
        elif r.account_type == AccountType.LIABILITY:
            liabilities.append(item)
            total_liabilities += net
        else:
            equity.append(item)
            total_equity += net

    return BalanceSheetResponse(
        meta=ReportMeta(title="Balance Sheet", from_date=as_of, to_date=as_of),
        assets=assets, total_assets=total_assets,
        liabilities=liabilities, total_liabilities=total_liabilities,
        equity=equity, total_equity=total_equity,
        total_liabilities_and_equity=total_liabilities + total_equity,
    )


# ── Trial Balance ─────────────────────────────────────────────────────────────


@router.get("/trial-balance", response_model=TrialBalanceResponse)
async def trial_balance(
    from_date: date = Query(...),
    to_date: date = Query(...),
    company_id: Optional[UUID] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Trial Balance — all accounts with their debit/credit totals."""
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")

    result = await db.execute(
        select(
            ChartOfAccount.code,
            ChartOfAccount.name,
            ChartOfAccount.account_type,
            func.coalesce(func.sum(JournalEntryLine.base_currency_debit), 0).label("debit"),
            func.coalesce(func.sum(JournalEntryLine.base_currency_credit), 0).label("credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
        .where(and_(*_entry_filter(ctx.tenant_id, from_date, to_date, company_id)))
        .group_by(ChartOfAccount.code, ChartOfAccount.name, ChartOfAccount.account_type)
        .order_by(ChartOfAccount.code)
    )

    entries = []
    total_debit = total_credit = 0.0
    for r in result.all():
        d = float(r.debit or 0)
        c = float(r.credit or 0)
        entries.append(LineItem(
            account_code=r.code, account_name=r.name,
            account_type=r.account_type, debit=d, credit=c, net=d - c,
        ))
        total_debit += d
        total_credit += c

    return TrialBalanceResponse(
        meta=ReportMeta(title="Trial Balance", from_date=from_date, to_date=to_date),
        entries=entries, total_debit=total_debit, total_credit=total_credit,
    )


# ── Cash Flow ─────────────────────────────────────────────────────────────────


@router.get("/cash-flow", response_model=CashFlowResponse)
async def cash_flow(
    from_date: date = Query(...),
    to_date: date = Query(...),
    company_id: Optional[UUID] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Cash flow statement categorised by operating, investing and financing."""
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")

    clauses = _entry_filter(ctx.tenant_id, from_date, to_date, company_id)

    result = await db.execute(
        select(
            ChartOfAccount.code,
            ChartOfAccount.name,
            ChartOfAccount.account_type,
            ChartOfAccount.account_sub_type,
            func.coalesce(func.sum(JournalEntryLine.base_currency_debit), 0).label("debit"),
            func.coalesce(func.sum(JournalEntryLine.base_currency_credit), 0).label("credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
        .where(and_(*clauses))
        .group_by(ChartOfAccount.code, ChartOfAccount.name,
                  ChartOfAccount.account_type, ChartOfAccount.account_sub_type)
        .order_by(ChartOfAccount.code)
    )

    operating_lines, investing_lines, financing_lines = [], [], []
    operating_total = investing_total = financing_total = 0.0

    for r in result.all():
        d = float(r.debit or 0)
        c = float(r.credit or 0)
        # Net change: debit means money out (negative), credit means money in (positive)
        net = c - d
        if net == 0:
            continue

        st = r.account_sub_type or ""
        atype = r.account_type or ""

        # Categorise by account_sub_type
        if st in ("fixed_asset",):
            investing_total += net
            investing_lines.append(LineItem(
                account_code=r.code, account_name=r.name,
                account_type="investing", debit=d, credit=c,
                net=net,
            ))
        elif st in ("payable", "current_liability"):
            financing_total += net
            financing_lines.append(LineItem(
                account_code=r.code, account_name=r.name,
                account_type="financing", debit=d, credit=c,
                net=net,
            ))
        elif atype == AccountType.INCOME:
            # Revenue received — operating
            operating_total += net
            operating_lines.append(LineItem(
                account_code=r.code, account_name=r.name,
                account_type="operating", debit=d, credit=c,
                net=net,
            ))
        elif atype == AccountType.EXPENSE:
            # Expenses paid — operating outflow (negative)
            operating_total += net
            operating_lines.append(LineItem(
                account_code=r.code, account_name=r.name,
                account_type="operating", debit=d, credit=c,
                net=net,
            ))
        else:
            # Everything else (assets other than cash/bank) — operating
            operating_total += net
            operating_lines.append(LineItem(
                account_code=r.code, account_name=r.name,
                account_type="operating", debit=d, credit=c,
                net=net,
            ))

    net_cf = operating_total + investing_total + financing_total

    return CashFlowResponse(
        meta=ReportMeta(title="Cash Flow", from_date=from_date, to_date=to_date),
        operating=operating_lines, net_operating=operating_total,
        investing=investing_lines, net_investing=investing_total,
        financing=financing_lines, net_financing=financing_total,
        net_cash_flow=net_cf,
    )


# ── AR Aging ──────────────────────────────────────────────────────────────────


@router.get("/ar-aging", response_model=ARAgingResponse)
async def ar_aging(
    as_of: date = Query(..., description="Aging as-of date"),
    company_id: Optional[UUID] = Query(None),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    """Accounts Receivable aging buckets as of a given date."""
    clauses = [
        JournalEntry.tenant_id == ctx.tenant_id,
        JournalEntry.entry_date <= as_of,
        JournalEntry.status == EntryStatus.POSTED,
    ]
    if company_id is not None:
        clauses.append(JournalEntry.company_id == company_id)

    result = await db.execute(
        select(ChartOfAccount.id)
        .where(
            and_(
                ChartOfAccount.tenant_id == ctx.tenant_id,
                ChartOfAccount.account_sub_type == AccountSubType.RECEIVABLE,
                ChartOfAccount.is_active == True,
            )
        )
    )
    receivable_ids = [r.id for r in result.all()]

    if not receivable_ids:
        return ARAgingResponse(
            meta=ReportMeta(title="AR Aging", from_date=as_of, to_date=as_of),
            current=0, days_1_30=0, days_31_60=0, days_61_90=0, days_over_90=0,
            total_outstanding=0,
        )

    # Get net outstanding per receivable account (credit balance = money owed to us)
    result = await db.execute(
        select(
            JournalEntryLine.account_id,
            func.coalesce(func.sum(JournalEntryLine.base_currency_debit), 0).label("debit"),
            func.coalesce(func.sum(JournalEntryLine.base_currency_credit), 0).label("credit"),
        )
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
        .where(
            and_(
                JournalEntryLine.account_id.in_(receivable_ids),
                *clauses,
            )
        )
        .group_by(JournalEntryLine.account_id)
    )

    buckets = {
        "current": 0.0,
        "days_1_30": 0.0,
        "days_31_60": 0.0,
        "days_61_90": 0.0,
        "days_over_90": 0.0,
    }
    total_outstanding = 0.0

    for row in result.all():
        # Net credit balance = outstanding
        net = float(row.credit or 0) - float(row.debit or 0)
        if net <= 0:
            continue
        total_outstanding += net

        # TODO: Replace heuristic bucketing with real invoice due-date aging.
        # Current implementation buckets by account-level outstanding amount.
        # When invoices have due_date fields, bucket by days overdue instead.
        if net < 10000:
            buckets["current"] += net
        elif net < 50000:
            buckets["days_1_30"] += net
        elif net < 100000:
            buckets["days_31_60"] += net
        elif net < 200000:
            buckets["days_61_90"] += net
        else:
            buckets["days_over_90"] += net

    return ARAgingResponse(
        meta=ReportMeta(title="AR Aging", from_date=as_of, to_date=as_of),
        current=buckets["current"],
        days_1_30=buckets["days_1_30"],
        days_31_60=buckets["days_31_60"],
        days_61_90=buckets["days_61_90"],
        days_over_90=buckets["days_over_90"],
        total_outstanding=total_outstanding,
    )
