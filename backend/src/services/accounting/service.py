"""Accounting service business logic."""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.accounting.models import (
    AccountType,
    BankReconciliation,
    Budget,
    ChartOfAccount,
    DayClose,
    DayCloseStatus,
    ExpenseClaim,
    ExpenseClaimLine,
    FixedAsset,
    FixedAssetCategory,
    GSTReturn,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
    TaxPayment,
)
from src.services.accounting.schemas import (
    ARAgingResponse,
    BalanceSheetResponse,
    BudgetActualCreate,
    BudgetCreate,
    BudgetSummaryResponse,
    BudgetSummaryRow,
    BudgetResponse,
    CashFlowResponse,
    ChartOfAccountCreate,
    DayCloseCreate,
    DepreciationPeriod,
    DepreciationScheduleResponse,
    ExpenseClaimCreate,
    ExpenseClaimSummaryResponse,
    ExpenseClaimSummaryRow,
    ExpenseClaimResponse,
    FixedAssetCreate,
    FixedAssetCategoryCreate,
    FixedAssetCategoryResponse,
    FixedAssetResponse,
    GeneralLedgerResponse,
    GeneralLedgerRow,
    GSTReturnCreate,
    JournalEntryCreate,
    LineItem,
    OpeningBalanceResponse,
    OpeningBalanceRow,
    PnlResponse,
    PnlRow,
    ReportMeta,
    TaxPaymentCreate,
    TrialBalanceResponse,
    TrialBalanceRow,
)

logger = logging.getLogger("accounting.service")
TWO_PLACES = Decimal("0.01")


def _m(val) -> Decimal:
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


DEFAULT_ACCOUNTS = [
    ("1000", "Cash in Hand", AccountType.ASSET),
    ("1010", "Bank Account", AccountType.ASSET),
    ("1020", "Accounts Receivable", AccountType.ASSET),
    ("1030", "Inventory Asset", AccountType.ASSET),
    ("2000", "Accounts Payable", AccountType.LIABILITY),
    ("2010", "CGST Payable", AccountType.LIABILITY),
    ("2020", "SGST Payable", AccountType.LIABILITY),
    ("2030", "IGST Payable", AccountType.LIABILITY),
    ("3000", "Owner's Equity", AccountType.EQUITY),
    ("4000", "Food & Beverage Sales", AccountType.REVENUE),
    ("4010", "Service Charge Revenue", AccountType.REVENUE),
    ("4020", "Delivery & Packaging Revenue", AccountType.REVENUE),
    ("5000", "Cost of Goods Sold", AccountType.EXPENSE),
    ("5010", "Wastage Expense", AccountType.EXPENSE),
    ("5020", "Salary & Wages", AccountType.EXPENSE),
    ("5030", "Rent & Utilities", AccountType.EXPENSE),
]


async def seed_default_accounts(db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID | None = None) -> list[ChartOfAccount]:
    """Ensure standard restaurant chart of accounts exists for tenant."""
    created = []
    for code, name, acct_type in DEFAULT_ACCOUNTS:
        existing = await db.scalar(
            select(ChartOfAccount).where(
                ChartOfAccount.tenant_id == tenant_id,
                ChartOfAccount.code == code,
            )
        )
        if not existing:
            acct = ChartOfAccount(
                tenant_id=tenant_id,
                outlet_id=outlet_id,
                code=code,
                name=name,
                account_type=acct_type,
                is_active=True,
            )
            db.add(acct)
            created.append(acct)
    if created:
        await db.flush()
    return created


async def create_journal_entry(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: JournalEntryCreate,
    user_id: uuid.UUID | None = None,
) -> JournalEntry:
    # 1. Assert balance
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    for line in payload.lines:
        total_debit += _m(line.debit)
        total_credit += _m(line.credit)

    if total_debit != total_credit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Journal entry is not balanced: Debits ({total_debit}) != Credits ({total_credit})",
        )
    if total_debit <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Journal entry amounts must be greater than zero",
        )

    # 2. Number series
    if not payload.entry_number:
        seq = (await db.scalar(
            select(func.count(JournalEntry.id)).where(JournalEntry.tenant_id == tenant_id)
        )) or 0
        entry_number = f"JE-{datetime.now().strftime('%y%m')}-{seq + 1:04d}"
    else:
        entry_number = payload.entry_number

    je = JournalEntry(
        tenant_id=tenant_id,
        outlet_id=payload.outlet_id,
        entry_number=entry_number,
        entry_date=payload.entry_date,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        narration=payload.narration,
        status=JournalEntryStatus.DRAFT,
        posted_by=user_id,
    )
    db.add(je)
    await db.flush()

    for line in payload.lines:
        jl = JournalEntryLine(
            tenant_id=tenant_id,
            journal_entry_id=je.id,
            account_id=line.account_id,
            debit=_m(line.debit),
            credit=_m(line.credit),
            description=line.description,
        )
        db.add(jl)

    await db.flush()
    stmt = select(JournalEntry).where(JournalEntry.id == je.id).options(selectinload(JournalEntry.lines))
    return await db.scalar(stmt)


async def post_journal_entry(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    entry_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
) -> JournalEntry:
    stmt = select(JournalEntry).where(
        JournalEntry.id == entry_id,
        JournalEntry.tenant_id == tenant_id,
    ).options(selectinload(JournalEntry.lines))
    je = await db.scalar(stmt)
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if je.status == JournalEntryStatus.POSTED:
        return je
    je.status = JournalEntryStatus.POSTED
    je.posted_by = user_id or je.posted_by
    await db.flush()
    return je


async def reverse_journal_entry(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    entry_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
) -> JournalEntry:
    stmt = select(JournalEntry).where(
        JournalEntry.id == entry_id,
        JournalEntry.tenant_id == tenant_id,
    ).options(selectinload(JournalEntry.lines))
    orig = await db.scalar(stmt)
    if not orig:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if orig.status != JournalEntryStatus.POSTED:
        raise HTTPException(status_code=400, detail="Only posted entries can be reversed")

    seq = (await db.scalar(
        select(func.count(JournalEntry.id)).where(JournalEntry.tenant_id == tenant_id)
    )) or 0
    rev_no = f"REV-{datetime.now().strftime('%y%m')}-{seq + 1:04d}"

    rev = JournalEntry(
        tenant_id=tenant_id,
        outlet_id=orig.outlet_id,
        entry_number=rev_no,
        entry_date=date.today(),
        reference_type="REVERSAL",
        reference_id=orig.entry_number,
        narration=f"Reversal of {orig.entry_number}: {orig.narration or ''}",
        status=JournalEntryStatus.POSTED,
        posted_by=user_id,
    )
    db.add(rev)
    await db.flush()

    for line in orig.lines:
        rl = JournalEntryLine(
            tenant_id=tenant_id,
            journal_entry_id=rev.id,
            account_id=line.account_id,
            debit=line.credit,   # swap debit & credit
            credit=line.debit,
            description=f"Reversal: {line.description or ''}",
        )
        db.add(rl)

    orig.status = JournalEntryStatus.REVERSED
    await db.flush()
    stmt = select(JournalEntry).where(JournalEntry.id == rev.id).options(selectinload(JournalEntry.lines))
    return await db.scalar(stmt)


async def compute_trial_balance(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    as_of: date,
    outlet_id: uuid.UUID | None = None,
) -> TrialBalanceResponse:
    stmt = (
        select(
            ChartOfAccount.id,
            ChartOfAccount.code,
            ChartOfAccount.name,
            ChartOfAccount.account_type,
            func.coalesce(func.sum(JournalEntryLine.debit), 0).label("tot_debit"),
            func.coalesce(func.sum(JournalEntryLine.credit), 0).label("tot_credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.entry_date <= as_of,
        )
    )
    if outlet_id:
        stmt = stmt.where(JournalEntry.outlet_id == outlet_id)

    stmt = stmt.group_by(
        ChartOfAccount.id, ChartOfAccount.code, ChartOfAccount.name, ChartOfAccount.account_type
    ).order_by(ChartOfAccount.code)

    rows = []
    grand_debit = Decimal("0")
    grand_credit = Decimal("0")

    for r in (await db.execute(stmt)).all():
        deb = _m(r.tot_debit)
        crd = _m(r.tot_credit)
        grand_debit += deb
        grand_credit += crd
        net = deb - crd
        rows.append(
            TrialBalanceRow(
                account_id=r.id,
                code=r.code,
                name=r.name,
                account_type=str(r.account_type),
                total_debit=deb,
                total_credit=crd,
                net_balance=net,
            )
        )

    return TrialBalanceResponse(
        as_of=as_of,
        rows=rows,
        total_debit=grand_debit,
        total_credit=grand_credit,
        is_balanced=(grand_debit == grand_credit),
    )


async def compute_pnl(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> PnlResponse:
    stmt = (
        select(
            ChartOfAccount.account_type,
            ChartOfAccount.name,
            func.coalesce(func.sum(JournalEntryLine.debit), 0).label("tot_debit"),
            func.coalesce(func.sum(JournalEntryLine.credit), 0).label("tot_credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.account_type.in_([AccountType.REVENUE, AccountType.EXPENSE]),
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.entry_date >= date_from,
            JournalEntry.entry_date <= date_to,
        )
    )
    if outlet_id:
        stmt = stmt.where(JournalEntry.outlet_id == outlet_id)

    stmt = stmt.group_by(ChartOfAccount.account_type, ChartOfAccount.name)

    rev_rows = []
    exp_rows = []
    total_rev = Decimal("0")
    total_exp = Decimal("0")

    for r in (await db.execute(stmt)).all():
        deb = _m(r.tot_debit)
        crd = _m(r.tot_credit)
        if str(r.account_type) == AccountType.REVENUE:
            net = crd - deb
            total_rev += net
            rev_rows.append(PnlRow(category="Revenue", account_name=r.name, amount=net))
        else:
            net = deb - crd
            total_exp += net
            exp_rows.append(PnlRow(category="Expense", account_name=r.name, amount=net))

    return PnlResponse(
        date_from=date_from,
        date_to=date_to,
        revenue_rows=rev_rows,
        expense_rows=exp_rows,
        total_revenue=total_rev,
        total_expense=total_exp,
        net_profit=total_rev - total_exp,
    )


# ─── Shared posting helpers ──────────────────────────────────────────────────


async def _find_account(db: AsyncSession, tenant_id: uuid.UUID, code: str) -> ChartOfAccount | None:
    """The tenant's (first) active chart-of-accounts row for a code."""
    return await db.scalar(
        select(ChartOfAccount)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.code == code,
            ChartOfAccount.is_active.is_(True),
        )
        .order_by(ChartOfAccount.created_at)
        .limit(1)
    )


async def _post_entry(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    entry_date: date,
    reference_type: str,
    reference_id: str | None,
    narration: str,
    lines: list[tuple[ChartOfAccount, Decimal, Decimal]],
    user_id: uuid.UUID | None = None,
) -> JournalEntry:
    """Create an already-POSTED journal entry.

    ``lines`` is a list of ``(account, debit, credit)``. Callers own the
    accounting judgement (what to debit/credit); this helper owns only the
    mechanics: balanced check, entry number, POSTED status.
    """
    total_debit = sum(d for _, d, _ in lines)
    total_credit = sum(c for _, _, c in lines)
    if total_debit != total_credit or total_debit <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System journal entry is not balanced; refusing to post",
        )
    seq = (await db.scalar(
        select(func.count(JournalEntry.id)).where(JournalEntry.tenant_id == tenant_id)
    )) or 0
    je = JournalEntry(
        tenant_id=tenant_id,
        entry_number=f"SYS-{datetime.now().strftime('%y%m')}-{seq + 1:04d}",
        entry_date=entry_date,
        reference_type=reference_type,
        reference_id=reference_id,
        narration=narration,
        status=JournalEntryStatus.POSTED,
        posted_by=user_id,
    )
    db.add(je)
    await db.flush()
    for account, debit, credit in lines:
        db.add(JournalEntryLine(
            tenant_id=tenant_id,
            journal_entry_id=je.id,
            account_id=account.id,
            debit=_m(debit),
            credit=_m(credit),
        ))
    await db.flush()
    return je


# ─── General ledger & opening balances ──────────────────────────────────────


async def general_ledger(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    account_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> GeneralLedgerResponse:
    """Opening balance + chronological lines with running balance.

    Only POSTED entries count: drafts and reversed entries are excluded by
    the status filter (a reversal posts a new mirror entry, so the net stays
    correct).
    """
    acct = await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.id == account_id,
            ChartOfAccount.tenant_id == tenant_id,
        )
    )
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    def _opening_stmt():
        stmt = (
            select(
                func.coalesce(func.sum(JournalEntryLine.debit), 0).label("d"),
                func.coalesce(func.sum(JournalEntryLine.credit), 0).label("c"),
            )
            .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
            .where(
                JournalEntryLine.account_id == account_id,
                JournalEntryLine.tenant_id == tenant_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.entry_date < date_from,
            )
        )
        if outlet_id:
            stmt = stmt.where(JournalEntry.outlet_id == outlet_id)
        return stmt

    open_row = (await db.execute(_opening_stmt())).one()
    opening = _m(open_row[0]) - _m(open_row[1])

    stmt = (
        select(JournalEntryLine, JournalEntry.entry_number, JournalEntry.entry_date,
               JournalEntry.reference_type, JournalEntry.reference_id, JournalEntry.narration)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .where(
            JournalEntryLine.account_id == account_id,
            JournalEntryLine.tenant_id == tenant_id,
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.entry_date >= date_from,
            JournalEntry.entry_date <= date_to,
        )
        .order_by(JournalEntry.entry_date.asc(), JournalEntry.created_at.asc(),
                  JournalEntryLine.id.asc())
    )
    if outlet_id:
        stmt = stmt.where(JournalEntry.outlet_id == outlet_id)

    rows: list[GeneralLedgerRow] = []
    running = opening
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    for line, number, entry_date, ref_type, ref_id, narration in (await db.execute(stmt)).all():
        if _m(line.debit) == 0 and _m(line.credit) == 0:
            continue
        running += _m(line.debit) - _m(line.credit)
        total_debit += _m(line.debit)
        total_credit += _m(line.credit)
        rows.append(GeneralLedgerRow(
            entry_id=line.journal_entry_id,
            entry_number=number,
            entry_date=entry_date,
            reference_type=ref_type,
            reference_id=ref_id,
            narration=narration,
            description=line.description,
            debit=_m(line.debit),
            credit=_m(line.credit),
            running_balance=running,
        ))

    return GeneralLedgerResponse(
        account_id=account_id,
        account_code=acct.code,
        account_name=acct.name,
        date_from=date_from,
        date_to=date_to,
        opening_balance=opening,
        closing_balance=running,
        total_debit=total_debit,
        total_credit=total_credit,
        rows=rows,
    )


async def opening_balances(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    as_of: date,
) -> OpeningBalanceResponse:
    """Net position per account for everything posted *before* ``as_of``."""
    stmt = (
        select(
            ChartOfAccount.id, ChartOfAccount.code, ChartOfAccount.name,
            ChartOfAccount.account_type,
            func.coalesce(func.sum(JournalEntryLine.debit), 0).label("tot_debit"),
            func.coalesce(func.sum(JournalEntryLine.credit), 0).label("tot_credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.entry_date < as_of,
        )
        .group_by(ChartOfAccount.id, ChartOfAccount.code, ChartOfAccount.name,
                  ChartOfAccount.account_type)
        .order_by(ChartOfAccount.code)
    )
    rows: list[OpeningBalanceRow] = []
    for r in (await db.execute(stmt)).all():
        deb = _m(r.tot_debit)
        crd = _m(r.tot_credit)
        rows.append(OpeningBalanceRow(
            account_id=r.id,
            code=r.code,
            name=r.name,
            account_type=str(r.account_type),
            total_debit=deb,
            total_credit=crd,
            net_balance=deb - crd,
        ))
    return OpeningBalanceResponse(as_of=as_of, rows=rows)


# ─── Bank reconciliation ────────────────────────────────────────────────────


async def bank_reconcile(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    bank_account_id: uuid.UUID,
    payload,
    user_id: uuid.UUID | None,
):
    """Record a period reconciliation and post the balancing entry.

    Difference = unmatched − matched. When nonzero we post a balancing entry
    between the GL's cash account (1000) and bank account (1010) so the two
    sides agree: bank says more than the books (difference > 0) → debit
    1000 cash, credit 1010 bank; the opposite when the bank is behind.
    """
    from src.services.accounting.models import BankAccount

    account = await db.scalar(
        select(BankAccount).where(
            BankAccount.id == bank_account_id,
            BankAccount.tenant_id == tenant_id,
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    difference = _m(payload.unmatched_amount) - _m(payload.matched_amount)
    rec = BankReconciliation(
        tenant_id=tenant_id,
        bank_account_id=bank_account_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
        matched_amount=_m(payload.matched_amount),
        unmatched_amount=_m(payload.unmatched_amount),
        status="reconciled",
        reconciled_by=user_id,
        notes=payload.notes,
    )
    db.add(rec)

    entry = None
    if difference != 0:
        cash = await _find_account(db, tenant_id, "1000")
        bank_acct = await _find_account(db, tenant_id, "1010")
        if cash and bank_acct:
            if difference > 0:
                lines = [(cash, difference, Decimal("0")), (bank_acct, Decimal("0"), difference)]
            else:
                lines = [(bank_acct, -difference, Decimal("0")), (cash, Decimal("0"), -difference)]
            entry = await _post_entry(
                db,
                tenant_id,
                payload.period_end,
                "bank_reconciliation",
                None,
                f"Bank reconciliation {payload.period_start}..{payload.period_end} "
                f"(difference {difference})",
                lines,
                user_id,
            )
            rec.journal_entry_id = entry.id
        else:
            logger.warning("Reconciliation %s: 1000/1010 accounts missing; no balancing entry", rec.id)
    await db.flush()
    return rec, entry


# ─── Fixed assets ───────────────────────────────────────────────────────────


def _months_between(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + (end.month - start.month)


async def depreciation_schedule(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    asset_id: uuid.UUID,
) -> DepreciationScheduleResponse:
    """Straight-line monthly: (cost − salvage) / life / 12 per month.

    Pure projection from the asset's stored fields — it does not move
    ``accumulated_depreciation``.
    """
    asset = await db.scalar(
        select(FixedAsset).where(
            FixedAsset.id == asset_id,
            FixedAsset.tenant_id == tenant_id,
        )
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Fixed asset not found")

    life_years = asset.useful_life_years
    if not life_years or life_years <= 0:
        if asset.category_id:
            cat = await db.scalar(
                select(FixedAssetCategory).where(
                    FixedAssetCategory.id == asset.category_id,
                    FixedAssetCategory.tenant_id == tenant_id,
                )
            )
            life_years = (cat.useful_life_years if cat else None) or life_years or 1
        else:
            life_years = 1

    cost = _m(asset.purchase_cost)
    salvage = _m(asset.salvage_value)
    depreciable = max(cost - salvage, Decimal("0"))
    months_total = life_years * 12
    monthly = (depreciable / months_total).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

    elapsed = max(_months_between(asset.purchase_date, date.today()), 0)
    periods_total = min(max(elapsed, 1), months_total)

    periods: list[DepreciationPeriod] = []
    opening = cost
    for index in range(periods_total):
        depreciation = monthly
        if index == months_total - 1 or opening - depreciation < salvage:
            depreciation = max(opening - salvage, Decimal("0"))
        closing = opening - depreciation
        label_year = asset.purchase_date.year
        label_month = asset.purchase_date.month + index
        while label_month > 12:
            label_month -= 12
            label_year += 1
        periods.append(DepreciationPeriod(
            period=f"{label_year:04d}-{label_month:02d}",
            opening_book_value=opening,
            depreciation=depreciation,
            closing_book_value=closing,
        ))
        opening = closing

    return DepreciationScheduleResponse(
        asset_id=asset.id,
        asset_code=asset.asset_code,
        name=asset.name,
        purchase_cost=cost,
        salvage_value=salvage,
        useful_life_years=life_years,
        monthly_depreciation=monthly,
        straight_line_base=depreciable,
        periods=periods,
    )


# ─── Balance sheet / cash flow / AR aging ───────────────────────────────────


async def balance_sheet(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    as_of: date,
    outlet_id: uuid.UUID | None = None,
) -> BalanceSheetResponse:
    """Cumulative balance sheet as of ``as_of``.

    Credit-bill exposure is deliberately NOT pulled from billing over the
    mesh (billing's invoice routes land in parallel); it is reflected locally
    through the AR (1020) and AP (2000) balances posted by the bill/payable
    handlers — see the notes field.
    """
    stmt = (
        select(
            ChartOfAccount.code, ChartOfAccount.name, ChartOfAccount.account_type,
            func.coalesce(func.sum(JournalEntryLine.debit), 0).label("d"),
            func.coalesce(func.sum(JournalEntryLine.credit), 0).label("c"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.is_active.is_(True),
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.entry_date <= as_of,
        )
    )
    if outlet_id:
        stmt = stmt.where(JournalEntry.outlet_id == outlet_id)
    stmt = stmt.group_by(ChartOfAccount.code, ChartOfAccount.name,
                         ChartOfAccount.account_type).order_by(ChartOfAccount.code)

    assets: list[LineItem] = []
    liabilities: list[LineItem] = []
    equity: list[LineItem] = []
    total_assets = Decimal("0")
    total_liabilities = Decimal("0")
    total_equity = Decimal("0")

    for r in (await db.execute(stmt)).all():
        code, name, atype = r.code, r.name, str(r.account_type)
        d, c = _m(r.d), _m(r.c)
        if atype == AccountType.ASSET:
            net = d - c
            item = LineItem(code, name, atype, d, c, net)
            assets.append(item)
            total_assets += net
        elif atype == AccountType.LIABILITY:
            net = c - d
            item = LineItem(code, name, atype, d, c, net)
            liabilities.append(item)
            total_liabilities += net
        elif atype == AccountType.EQUITY:
            net = c - d
            item = LineItem(code, name, atype, d, c, net)
            equity.append(item)
            total_equity += net

    # Fixed assets at net book value (cost less accumulated depreciation).
    fa_row = (await db.execute(
        select(
            func.coalesce(func.sum(FixedAsset.purchase_cost), 0),
            func.coalesce(func.sum(FixedAsset.accumulated_depreciation), 0),
        ).where(FixedAsset.tenant_id == tenant_id, FixedAsset.disposal_status == "active")
    )).one()
    fa_cost, fa_accum = _m(fa_row[0]), _m(fa_row[1])
    fa_nbv = max(fa_cost - fa_accum, Decimal("0"))
    if fa_cost:
        assets.append(LineItem(account_code="6000", account_name="Fixed Assets (Net Book Value)",
                               account_type="asset", debit=fa_cost, credit=fa_accum, net=fa_nbv))
        total_assets += fa_nbv

    # Retained earnings: cumulative revenue less cumulative expense, posted.
    retained_stmt = (
        select(ChartOfAccount.account_type,
               func.coalesce(func.sum(JournalEntryLine.debit), 0),
               func.coalesce(func.sum(JournalEntryLine.credit), 0))
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
        .where(
            ChartOfAccount.tenant_id == tenant_id,
            ChartOfAccount.account_type.in_([AccountType.REVENUE, AccountType.EXPENSE]),
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.entry_date <= as_of,
        )
    )
    if outlet_id:
        retained_stmt = retained_stmt.where(JournalEntry.outlet_id == outlet_id)
    retained_stmt = retained_stmt.group_by(ChartOfAccount.account_type)
    retained = Decimal("0")
    for r in (await db.execute(retained_stmt)).all():
        if str(r.account_type) == AccountType.REVENUE:
            retained += _m(r[2]) - _m(r[1])
        else:
            retained -= _m(r[1]) - _m(r[2])
    if retained != 0:
        equity.append(LineItem("3010", "Retained Earnings", "equity",
                               Decimal("0"), Decimal("0"), retained))
        total_equity += retained

    notes = [
        "Credit-sale exposure is read from the local AR (1020) / AP (2000) "
        "balances posted by the billing handlers, not from a live mesh call "
        "to /billing/bills — billing's new invoice routes are landing in "
        "parallel, so the report stays computable when billing is down."
    ]

    return BalanceSheetResponse(
        meta=ReportMeta(title="Balance Sheet", from_date=as_of, to_date=as_of),
        assets=assets,
        total_assets=total_assets,
        liabilities=liabilities,
        total_liabilities=total_liabilities,
        equity=equity,
        total_equity=total_equity,
        total_liabilities_and_equity=total_liabilities + total_equity,
        notes=notes,
    )


async def cash_flow(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    outlet_id: uuid.UUID | None = None,
) -> CashFlowResponse:
    """Simplified cash flow from journal lines in the period.

    * operating  — net movement of cash accounts (1000/1010) in the period,
      minus investing and financing (residual method);
    * investing  — cash postings tagged reference_type="fixed_asset";
    * financing  — net change in owner's equity (3000) in the period.
    """
    cash_codes = ("1000", "1010")
    cash_ids: list[uuid.UUID] = []
    equity_id: uuid.UUID | None = None
    for code in (*cash_codes, "3000"):
        acct = await _find_account(db, tenant_id, code)
        if acct:
            if code in cash_codes:
                cash_ids.append(acct.id)
            else:
                equity_id = acct.id
    if not cash_ids:
        return CashFlowResponse(
            meta=ReportMeta(title="Cash Flow", from_date=date_from, to_date=date_to),
        )

    def _lines_stmt(account_ids: list[uuid.UUID] | None, ref_type: str | None = None):
        stmt = (
            select(
                JournalEntry.reference_type,
                func.coalesce(func.sum(JournalEntryLine.debit), 0).label("d"),
                func.coalesce(func.sum(JournalEntryLine.credit), 0).label("c"),
            )
            .join(JournalEntry, JournalEntry.id == JournalEntryLine.journal_entry_id)
            .where(
                JournalEntryLine.tenant_id == tenant_id,
                JournalEntryLine.account_id.in_(account_ids),
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.entry_date >= date_from,
                JournalEntry.entry_date <= date_to,
            )
        )
        if ref_type:
            stmt = stmt.where(JournalEntry.reference_type == ref_type)
        if outlet_id:
            stmt = stmt.where(JournalEntry.outlet_id == outlet_id)
        return stmt

    total_row = await db.execute(
        _lines_stmt(cash_ids).group_by(JournalEntry.reference_type)
    ).all()
    cash_in = sum(_m(r.c) for r in total_row)
    cash_out = sum(_m(r.d) for r in total_row)

    inv_row = await db.execute(_lines_stmt(cash_ids, "fixed_asset")).fetchone()
    investing_net = (_m(inv_row.c) - _m(inv_row.d)) if inv_row else Decimal("0")
    investing_lines: list[LineItem] = []
    if inv_row and (inv_row.d or inv_row.c):
        investing_lines.append(LineItem("6000", "Fixed Asset Purchases", "investing",
                                        _m(inv_row.d), _m(inv_row.c), investing_net))

    financing_net = Decimal("0")
    financing_lines: list[LineItem] = []
    if equity_id:
        fin_row = (await db.execute(
            _lines_stmt([equity_id]).group_by(JournalEntry.reference_type)
        )).all()
        financing_net = sum(_m(r.c) - _m(r.d) for r in fin_row)
        if financing_net != 0:
            financing_lines.append(LineItem("3000", "Owner's Equity", "financing",
                                            Decimal("0"), Decimal("0"), financing_net))

    operating_net = (cash_in - cash_out) - investing_net - financing_net
    meta = ReportMeta(title="Cash Flow", from_date=date_from, to_date=date_to)
    return CashFlowResponse(
        meta=meta,
        operating=[LineItem("1000/1010", "Cash & Bank Net (operating)", "operating",
                            cash_out, cash_in, operating_net)],
        net_operating=operating_net,
        investing=investing_lines,
        net_investing=investing_net,
        financing=financing_lines,
        net_financing=financing_net,
        net_cash_flow=operating_net + investing_net + financing_net,
    )


async def ar_aging(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    as_of: date | None = None,
    outlet_id: uuid.UUID | None = None,
) -> ARAgingResponse:
    """AR buckets from posted 1020 postings (reference_type="bill").

    Buckets by the age of the bill's 1020 posting: 0-30d → current, 31-60d →
    days_1_30, 61-90d → days_31_60, 91-120d → days_61_90, 120+d →
    days_over_90. The bill.paid handler (landing in parallel) feeds the 1020
    credit lines that reduce each bill's outstanding; until it exists the
    buckets simply show gross bill postings. Degrades to empty buckets —
    never errors — when 1020 is unseeded or has no bill postings.
    """
    as_of = as_of or date.today()
    ar = await _find_account(db, tenant_id, "1020")
    if ar is None:
        meta = ReportMeta(title="AR Aging", from_date=as_of, to_date=as_of)
        return ARAgingResponse(meta=meta, buckets_available=False)

    # Outstanding per bill: net debit on that bill's 1020 lines. Credits from
    # bill.paid reduce it to zero; negative nets (over-collected) are clamped.
    stmt = (
        select(
            JournalEntry.reference_id,
            func.min(JournalEntry.entry_date).label("first_posted"),
            func.coalesce(func.sum(JournalEntryLine.debit - JournalEntryLine.credit), 0),
        )
        .join(JournalEntryLine, JournalEntryLine.journal_entry_id == JournalEntry.id)
        .where(
            JournalEntryLine.account_id == ar.id,
            JournalEntryLine.tenant_id == tenant_id,
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.reference_type == "bill",
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.entry_date <= as_of,
        )
    )
    if outlet_id:
        stmt = stmt.where(JournalEntry.outlet_id == outlet_id)
    stmt = stmt.group_by(JournalEntry.reference_id)

    buckets = {"current": Decimal("0"), "days_1_30": Decimal("0"), "days_31_60": Decimal("0"),
               "days_61_90": Decimal("0"), "days_over_90": Decimal("0")}
    for _ref_id, first_posted, net_outstanding in (await db.execute(stmt)).all():
        amount = _m(net_outstanding)
        if amount <= 0 or first_posted is None:
            continue
        age = (as_of - first_posted).days
        if age <= 30:
            buckets["current"] += amount
        elif age <= 60:
            buckets["days_1_30"] += amount
        elif age <= 90:
            buckets["days_31_60"] += amount
        elif age <= 120:
            buckets["days_61_90"] += amount
        else:
            buckets["days_over_90"] += amount

    total = sum(buckets.values())
    return ARAgingResponse(
        meta=ReportMeta(title="AR Aging", from_date=as_of, to_date=as_of),
        current=buckets["current"],
        days_1_30=buckets["days_1_30"],
        days_31_60=buckets["days_31_60"],
        days_61_90=buckets["days_61_90"],
        days_over_90=buckets["days_over_90"],
        total_outstanding=total,
        buckets_available=True,
    )


# ─── GST ────────────────────────────────────────────────────────────────────


def _parse_period(period: str) -> tuple[int, int]:
    """``"YYYY-MM"`` → (year, month); default to the current month when bad."""
    try:
        parts = period.split("-")
        year, month = int(parts[0]), int(parts[1])
        if 1 <= month <= 12:
            return year, month
    except (IndexError, ValueError):
        pass
    now = date.today()
    return now.year, now.month


def _month_range(year: int, month: int) -> tuple[date, date]:
    first = date(year, month, 1)
    next_month = date(year + (month // 12), (month % 12) + 1, 1)
    last = next_month - timedelta(days=1)
    return first, last


async def gst_summary(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    period: str,
) -> dict:
    """GSTR-1-flavoured summary for a month.

    Local source of truth is the tenant's GSTReturn rows. The invoice side is
    pulled from billing over the mesh (GET /billing/invoices?date_from&to);
    billing's new invoice routes land in parallel, so any non-200 / timeout
    degrades to ``invoices_available: false`` and the local-only numbers.
    """
    year, month = _parse_period(period)
    month_from, month_to = _month_range(year, month)

    gst_rows = (await db.execute(
        select(GSTReturn).where(
            GSTReturn.tenant_id == tenant_id,
            GSTReturn.period == period,
        )
    )).scalars().all()

    totals = {
        "taxable": Decimal("0"),
        "cgst": Decimal("0"),
        "sgst": Decimal("0"),
        "igst": Decimal("0"),
        "cess": Decimal("0"),
    }
    for row in gst_rows:
        totals["taxable"] += _m(row.total_taxable_value)
        totals["cgst"] += _m(row.total_cgst)
        totals["sgst"] += _m(row.total_sgst)
        totals["igst"] += _m(row.total_igst)
        totals["cess"] += _m(row.total_cess)

    notes: list[str] = []
    invoices_available = False
    invoice_count = 0
    try:
        import httpx

        from src.services.shared.registry import base_url, get_descriptor

        descriptor = get_descriptor("billing")
        if descriptor is not None:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
                res = await client.get(
                    f"{base_url(descriptor)}/api/v1/billing/invoices",
                    params={"date_from": month_from.isoformat(),
                            "date_to": month_to.isoformat()},
                    headers={"X-Identity-Tenant-Id": str(tenant_id)},
                )
            if res.status_code == 200:
                body = res.json()
                items = body.get("items", body if isinstance(body, list) else [])
                for item in items:
                    invoice_count += 1
                invoices_available = True
            else:
                notes.append(
                    "Invoice-side data unavailable (billing returned "
                    f"{res.status_code}); summary computed from local GSTReturn rows only."
                )
        else:
            notes.append("Billing service not registered; invoice-side data unavailable.")
    except Exception:
        notes.append("Invoice-side data unavailable (billing unreachable); "
                     "summary computed from local GSTReturn rows only.")

    return {
        "period": period,
        "returns": [r for r in gst_rows],
        "total_taxable_value": totals["taxable"],
        "total_cgst": totals["cgst"],
        "total_sgst": totals["sgst"],
        "total_igst": totals["igst"],
        "total_cess": totals["cess"],
        "total_tax": totals["cgst"] + totals["sgst"] + totals["igst"] + totals["cess"],
        "invoices_available": invoices_available,
        "invoice_count": invoice_count,
        "notes": notes,
    }
