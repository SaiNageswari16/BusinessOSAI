"""Accounting service business logic."""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.accounting.models import (
    AccountType,
    ChartOfAccount,
    DayClose,
    DayCloseStatus,
    GSTReturn,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
    TaxPayment,
)
from src.services.accounting.schemas import (
    ChartOfAccountCreate,
    DayCloseCreate,
    GSTReturnCreate,
    JournalEntryCreate,
    PnlResponse,
    PnlRow,
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
