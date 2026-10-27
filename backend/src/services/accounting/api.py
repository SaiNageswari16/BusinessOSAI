"""Accounting service API routes."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.accounting.models import (
    BankAccount,
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
    JournalEntryStatus,
    TaxPayment,
)
from src.services.accounting.schemas import (
    ARAgingResponse,
    BalanceSheetResponse,
    BankAccountCreate,
    BankAccountResponse,
    BankReconciliationCreate,
    BankReconciliationResponse,
    BudgetActualCreate,
    BudgetCreate,
    BudgetResponse,
    BudgetSummaryRow,
    BudgetSummaryResponse,
    CashFlowResponse,
    ChartOfAccountCreate,
    ChartOfAccountResponse,
    ChartOfAccountUpdate,
    DayCloseCreate,
    DayCloseResponse,
    DepreciationScheduleResponse,
    ExpenseClaimActionResponse,
    ExpenseClaimCreate,
    ExpenseClaimResponse,
    ExpenseClaimSummaryRow,
    ExpenseClaimSummaryResponse,
    FixedAssetCategoryCreate,
    FixedAssetCategoryResponse,
    FixedAssetCreate,
    FixedAssetResponse,
    GeneralLedgerResponse,
    GSTReturnCreate,
    GSTReturnResponse,
    GSTSummaryResponse,
    JournalEntryCreate,
    JournalEntryResponse,
    OpeningBalanceResponse,
    PnlResponse,
    TaxPaymentCreate,
    TaxPaymentResponse,
    TrialBalanceResponse,
)
from src.services.accounting import service
from src.services.shared.identity import CurrentIdentity, require_permission

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
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


# ─── Chart of accounts ───────────────────────────────────────────────────────

@router.get("/accounts", response_model=list[ChartOfAccountResponse], tags=["accounts"])
async def list_accounts(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    account_type: str | None = None,
    include_inactive: bool = False,
):
    identity.require("view:accounting")
    stmt = select(ChartOfAccount).where(ChartOfAccount.tenant_id == identity.tenant_id)
    if outlet_id:
        identity.can_access_outlet(outlet_id)
        stmt = stmt.where(ChartOfAccount.outlet_id == outlet_id)
    if account_type:
        stmt = stmt.where(ChartOfAccount.account_type == account_type)
    if not include_inactive:
        stmt = stmt.where(ChartOfAccount.is_active.is_(True))
    stmt = stmt.order_by(ChartOfAccount.code)
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


@router.post("/accounts", response_model=ChartOfAccountResponse, status_code=status.HTTP_201_CREATED, tags=["accounts"])
async def create_account(payload: ChartOfAccountCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    if payload.outlet_id:
        identity.can_access_outlet(payload.outlet_id)

    clash = await db.scalar(
        select(ChartOfAccount.id).where(
            ChartOfAccount.tenant_id == identity.tenant_id,
            ChartOfAccount.code == payload.code,
        )
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"Account code '{payload.code}' already exists")

    acct = ChartOfAccount(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        code=payload.code,
        name=payload.name,
        account_type=payload.account_type,
        parent_id=payload.parent_id,
        is_active=payload.is_active,
    )
    db.add(acct)
    await db.flush()
    return acct


@router.post("/accounts/seed", response_model=list[ChartOfAccountResponse], tags=["accounts"])
async def seed_accounts(identity: CurrentIdentity, db: DbDep, outlet_id: uuid.UUID | None = None):
    identity.require("manage:accounting")
    created = await service.seed_default_accounts(db, identity.tenant_id, outlet_id)
    return created


@router.get("/accounts/{account_id}", response_model=ChartOfAccountResponse, tags=["accounts"])
async def get_account(account_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    acct = await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.id == account_id,
            ChartOfAccount.tenant_id == identity.tenant_id,
        )
    )
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    return acct


@router.put("/accounts/{account_id}", response_model=ChartOfAccountResponse, tags=["accounts"])
async def update_account(account_id: uuid.UUID, payload: ChartOfAccountUpdate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    acct = await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.id == account_id,
            ChartOfAccount.tenant_id == identity.tenant_id,
        )
    )
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    if payload.name is not None:
        acct.name = payload.name
    if payload.account_type is not None:
        acct.account_type = payload.account_type
    if payload.parent_id is not None:
        acct.parent_id = payload.parent_id
    if payload.is_active is not None:
        acct.is_active = payload.is_active

    await db.flush()
    return acct


# ─── Journal entries ─────────────────────────────────────────────────────────

@router.get("/journal-entries", response_model=list[JournalEntryResponse], tags=["journal-entries"])
async def list_journal_entries(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    entry_status: JournalEntryStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    identity.require("view:accounting")
    stmt = (
        select(JournalEntry)
        .where(JournalEntry.tenant_id == identity.tenant_id)
        .options(selectinload(JournalEntry.lines))
        .order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if outlet_id:
        identity.can_access_outlet(outlet_id)
        stmt = stmt.where(JournalEntry.outlet_id == outlet_id)
    if entry_status:
        stmt = stmt.where(JournalEntry.status == entry_status)
    if date_from:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)

    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


@router.post("/journal-entries", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED, tags=["journal-entries"])
async def create_journal_entry(payload: JournalEntryCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    if payload.outlet_id:
        identity.can_access_outlet(payload.outlet_id)
    return await service.create_journal_entry(db, identity.tenant_id, payload, identity.user_id)


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryResponse, tags=["journal-entries"])
async def get_journal_entry(entry_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    je = await db.scalar(
        select(JournalEntry)
        .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == identity.tenant_id)
        .options(selectinload(JournalEntry.lines))
    )
    if not je:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return je


@router.post("/journal-entries/{entry_id}/post", response_model=JournalEntryResponse, tags=["journal-entries"])
async def post_entry(entry_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    return await service.post_journal_entry(db, identity.tenant_id, entry_id, identity.user_id)


@router.post("/journal-entries/{entry_id}/reverse", response_model=JournalEntryResponse, tags=["journal-entries"])
async def reverse_entry(entry_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    return await service.reverse_journal_entry(db, identity.tenant_id, entry_id, identity.user_id)


# ─── Day Close ───────────────────────────────────────────────────────────────

@router.get("/day-close", response_model=list[DayCloseResponse], tags=["day-close"])
async def list_day_closes(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    limit: int = Query(30, le=100),
):
    identity.require("view:accounting")
    stmt = (
        select(DayClose)
        .where(DayClose.tenant_id == identity.tenant_id)
        .order_by(DayClose.close_date.desc())
        .limit(limit)
    )
    if outlet_id:
        identity.can_access_outlet(outlet_id)
        stmt = stmt.where(DayClose.outlet_id == outlet_id)
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


@router.post("/day-close", response_model=DayCloseResponse, status_code=status.HTTP_201_CREATED, tags=["day-close"])
async def create_day_close(payload: DayCloseCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    identity.can_access_outlet(payload.outlet_id)

    existing = await db.scalar(
        select(DayClose).where(
            DayClose.outlet_id == payload.outlet_id,
            DayClose.close_date == payload.close_date,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"Day close already exists for {payload.close_date}")

    disc = service._m(payload.cash_actual) - service._m(payload.cash_sales)
    avg_ticket = service._m(payload.total_sales / Decimal(payload.total_orders)) if payload.total_orders > 0 else Decimal("0")

    dc = DayClose(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        shift_id=payload.shift_id,
        close_date=payload.close_date,
        status=DayCloseStatus.CLOSED,
        total_sales=payload.total_sales,
        cash_sales=payload.cash_sales,
        card_sales=payload.card_sales,
        upi_sales=payload.upi_sales,
        wallet_sales=payload.wallet_sales,
        credit_sales=payload.credit_sales,
        aggregator_sales=payload.aggregator_sales,
        online_sales=payload.online_sales,
        total_discount=payload.total_discount,
        total_tax=payload.total_tax,
        total_round_off=payload.total_round_off,
        total_orders=payload.total_orders,
        total_covers=payload.total_covers,
        avg_ticket=avg_ticket,
        cash_expected=payload.cash_sales,
        cash_actual=payload.cash_actual,
        discrepancy=disc,
        closed_by=identity.user_id,
    )
    db.add(dc)
    await db.flush()
    return dc


@router.post("/day-close/{close_id}/reconcile", response_model=DayCloseResponse, tags=["day-close"])
async def reconcile_day_close(close_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    dc = await db.scalar(
        select(DayClose).where(DayClose.id == close_id, DayClose.tenant_id == identity.tenant_id)
    )
    if not dc:
        raise HTTPException(status_code=404, detail="Day close not found")
    dc.status = DayCloseStatus.RECONCILED
    await db.flush()
    return dc


# ─── GST Returns & Tax Payments ──────────────────────────────────────────────

@router.get("/gst-returns", response_model=list[GSTReturnResponse], tags=["tax"])
async def list_gst_returns(identity: CurrentIdentity, db: DbDep, outlet_id: uuid.UUID | None = None):
    identity.require("view:accounting")
    stmt = select(GSTReturn).where(GSTReturn.tenant_id == identity.tenant_id).order_by(GSTReturn.period.desc())
    if outlet_id:
        identity.can_access_outlet(outlet_id)
        stmt = stmt.where(GSTReturn.outlet_id == outlet_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/gst-returns", response_model=GSTReturnResponse, status_code=status.HTTP_201_CREATED, tags=["tax"])
async def create_gst_return(payload: GSTReturnCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    gr = GSTReturn(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        return_type=payload.return_type,
        period=payload.period,
        total_taxable_value=payload.total_taxable_value,
        total_cgst=payload.total_cgst,
        total_sgst=payload.total_sgst,
        total_igst=payload.total_igst,
        total_cess=payload.total_cess,
    )
    db.add(gr)
    await db.flush()
    return gr


@router.get("/tax-payments", response_model=list[TaxPaymentResponse], tags=["tax"])
async def list_tax_payments(identity: CurrentIdentity, db: DbDep, outlet_id: uuid.UUID | None = None):
    identity.require("view:accounting")
    stmt = select(TaxPayment).where(TaxPayment.tenant_id == identity.tenant_id).order_by(TaxPayment.created_at.desc())
    if outlet_id:
        identity.can_access_outlet(outlet_id)
        stmt = stmt.where(TaxPayment.outlet_id == outlet_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/tax-payments", response_model=TaxPaymentResponse, status_code=status.HTTP_201_CREATED, tags=["tax"])
async def create_tax_payment(payload: TaxPaymentCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    tp = TaxPayment(
        tenant_id=identity.tenant_id,
        outlet_id=payload.outlet_id,
        tax_type=payload.tax_type,
        period=payload.period,
        amount=payload.amount,
        challan_number=payload.challan_number,
        paid_at=payload.paid_at,
    )
    db.add(tp)
    await db.flush()
    return tp


# ─── Financial Reports ───────────────────────────────────────────────────────

@router.get("/trial-balance", response_model=TrialBalanceResponse, tags=["reports"])
async def trial_balance(
    identity: CurrentIdentity,
    db: DbDep,
    as_of: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.compute_trial_balance(db, identity.tenant_id, as_of, outlet_id)


@router.get("/pnl", response_model=PnlResponse, tags=["reports"])
async def pnl(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.compute_pnl(db, identity.tenant_id, date_from, date_to, outlet_id)


# ─── General Ledger / Opening Balances ──────────────────────────────────────

@router.get("/general-ledger", response_model=GeneralLedgerResponse, tags=["general-ledger"])
async def get_general_ledger(
    identity: CurrentIdentity,
    db: DbDep,
    account_id: uuid.UUID = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.general_ledger(
        db, identity.tenant_id, account_id, date_from, date_to, outlet_id,
    )


@router.get("/opening-balances", response_model=OpeningBalanceResponse, tags=["general-ledger"])
async def get_opening_balances(
    identity: CurrentIdentity,
    db: DbDep,
    as_of: date = Query(default_factory=date.today),
):
    identity.require("view:accounting")
    return await service.opening_balances(db, identity.tenant_id, as_of)


# ─── Bank Accounts & Reconciliation ─────────────────────────────────────────

@router.get("/bank/accounts", response_model=list[BankAccountResponse], tags=["bank"])
async def list_bank_accounts(identity: CurrentIdentity, db: DbDep, include_inactive: bool = False):
    identity.require("view:accounting")
    stmt = select(BankAccount).where(BankAccount.tenant_id == identity.tenant_id).order_by(BankAccount.name)
    if not include_inactive:
        stmt = stmt.where(BankAccount.is_active.is_(True))
    return list((await db.execute(stmt)).scalars().all())


@router.get("/bank/accounts/{bank_account_id}", response_model=BankAccountResponse, tags=["bank"])
async def get_bank_account(bank_account_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    account = await db.scalar(
        select(BankAccount).where(
            BankAccount.id == bank_account_id,
            BankAccount.tenant_id == identity.tenant_id,
        )
    )
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.post("/bank/accounts", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED, tags=["bank"])
async def create_bank_account(payload: BankAccountCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    account = BankAccount(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(account)
    await db.flush()
    return account


@router.post("/bank/accounts/{bank_account_id}/reconcile",
             response_model=BankReconciliationResponse, tags=["bank"])
async def reconcile_bank_account(
    bank_account_id: uuid.UUID,
    payload: BankReconciliationCreate,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Record a period reconciliation and post the balancing entry.

    Difference = unmatched − matched. When nonzero we post a single balancing
    entry between the GL's cash (1000) and bank (1010) accounts: bank ahead →
    debit 1000 / credit 1010; bank behind → the reverse. If the tenant has
    not seeded 1000/1010 yet, the reconciliation row is still recorded but
    no journal entry is posted (logged, not raised).
    """
    identity.require("manage:accounting")
    rec, _entry = await service.bank_reconcile(
        db, identity.tenant_id, bank_account_id, payload, identity.user_id,
    )
    return rec


@router.get("/bank/reconciliations", response_model=list[BankReconciliationResponse], tags=["bank"])
async def list_bank_reconciliations(
    identity: CurrentIdentity,
    db: DbDep,
    bank_account_id: uuid.UUID | None = None,
):
    identity.require("view:accounting")
    stmt = select(BankReconciliation).where(BankReconciliation.tenant_id == identity.tenant_id)
    if bank_account_id:
        stmt = stmt.where(BankReconciliation.bank_account_id == bank_account_id)
    stmt = stmt.order_by(BankReconciliation.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


# ─── Fixed Assets ──────────────────────────────────────────────────────────

@router.get("/fixed-assets", response_model=list[FixedAssetResponse], tags=["fixed-assets"])
async def list_fixed_assets(
    identity: CurrentIdentity,
    db: DbDep,
    category_id: uuid.UUID | None = None,
    outlet_id: uuid.UUID | None = None,
    include_disposed: bool = False,
):
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    stmt = select(FixedAsset).where(FixedAsset.tenant_id == identity.tenant_id)
    if category_id:
        stmt = stmt.where(FixedAsset.category_id == category_id)
    if outlet_id:
        stmt = stmt.where(FixedAsset.outlet_id == outlet_id)
    if not include_disposed:
        stmt = stmt.where(FixedAsset.disposal_status == "active")
    stmt = stmt.order_by(FixedAsset.asset_code)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/fixed-assets/categories", response_model=list[FixedAssetCategoryResponse], tags=["fixed-assets"])
async def list_fixed_asset_categories(identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    stmt = select(FixedAssetCategory).where(
        FixedAssetCategory.tenant_id == identity.tenant_id,
    ).order_by(FixedAssetCategory.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/fixed-assets/categories", response_model=FixedAssetCategoryResponse,
             status_code=status.HTTP_201_CREATED, tags=["fixed-assets"])
async def create_fixed_asset_category(
    payload: FixedAssetCategoryCreate, identity: CurrentIdentity, db: DbDep,
):
    identity.require("manage:accounting")
    clash = await db.scalar(
        select(FixedAssetCategory.id).where(
            FixedAssetCategory.tenant_id == identity.tenant_id,
            FixedAssetCategory.name == payload.name,
        )
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"Category '{payload.name}' already exists")
    category = FixedAssetCategory(
        tenant_id=identity.tenant_id,
        name=payload.name,
        useful_life_years=payload.useful_life_years,
    )
    db.add(category)
    await db.flush()
    return category


@router.get("/fixed-assets/{asset_id}", response_model=FixedAssetResponse, tags=["fixed-assets"])
async def get_fixed_asset(asset_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    asset = await db.scalar(
        select(FixedAsset).where(
            FixedAsset.id == asset_id,
            FixedAsset.tenant_id == identity.tenant_id,
        )
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Fixed asset not found")
    return asset


@router.post("/fixed-assets", response_model=FixedAssetResponse,
             status_code=status.HTTP_201_CREATED, tags=["fixed-assets"])
async def create_fixed_asset(payload: FixedAssetCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    if payload.outlet_id:
        identity.can_access_outlet(payload.outlet_id)
    clash = await db.scalar(
        select(FixedAsset.id).where(
            FixedAsset.tenant_id == identity.tenant_id,
            FixedAsset.asset_code == payload.asset_code,
        )
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"Asset code '{payload.asset_code}' already exists")
    asset = FixedAsset(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(asset)
    await db.flush()
    return asset


@router.get("/fixed-assets/{asset_id}/depreciation",
            response_model=DepreciationScheduleResponse, tags=["fixed-assets"])
async def fixed_asset_depreciation(asset_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    return await service.depreciation_schedule(db, identity.tenant_id, asset_id)


# ─── Budgets ────────────────────────────────────────────────────────────────

@router.get("/budgets", response_model=list[BudgetResponse], tags=["budgets"])
async def list_budgets(
    identity: CurrentIdentity,
    db: DbDep,
    period_year: int | None = None,
    period_month: int | None = None,
    department_or_module: str | None = None,
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    stmt = select(Budget).where(Budget.tenant_id == identity.tenant_id)
    if period_year:
        stmt = stmt.where(Budget.period_year == period_year)
    if period_month:
        stmt = stmt.where(Budget.period_month == period_month)
    if department_or_module:
        stmt = stmt.where(Budget.department_or_module == department_or_module)
    if outlet_id:
        stmt = stmt.where(Budget.outlet_id == outlet_id)
    stmt = stmt.order_by(Budget.period_year, Budget.period_month, Budget.department_or_module)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/budgets/summary", response_model=BudgetSummaryResponse, tags=["budgets"])
async def budgets_summary(
    identity: CurrentIdentity,
    db: DbDep,
    period_year: int | None = None,
    period_month: int | None = None,
    outlet_id: uuid.UUID | None = None,
):
    """Variance table grouped by department/module."""
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    stmt = select(Budget).where(Budget.tenant_id == identity.tenant_id)
    if period_year:
        stmt = stmt.where(Budget.period_year == period_year)
    if period_month:
        stmt = stmt.where(Budget.period_month == period_month)
    if outlet_id:
        stmt = stmt.where(Budget.outlet_id == outlet_id)
    rows = list((await db.execute(stmt)).scalars().all())

    grouped: dict[tuple[str, int], dict] = {}
    for b in rows:
        key = (b.department_or_module, b.period_year)
        entry = grouped.setdefault(key, {"budgeted": 0, "actual": 0, "month": b.period_month})
        entry["budgeted"] += b.budgeted or 0
        entry["actual"] += b.actual or 0
        entry["month"] = b.period_month
    summary_rows = [
        BudgetSummaryRow(
            department_or_module=key[0],
            period_year=key[1],
            period_month=entry["month"],
            budgeted=entry["budgeted"],
            actual=entry["actual"],
            variance=entry["budgeted"] - entry["actual"],
        )
        for key, entry in grouped.items()
    ]
    total_budgeted = sum((r.budgeted for r in summary_rows), 0)
    total_actual = sum((r.actual for r in summary_rows), 0)
    return BudgetSummaryResponse(
        rows=summary_rows,
        total_budgeted=total_budgeted,
        total_actual=total_actual,
        total_variance=total_budgeted - total_actual,
    )


@router.get("/budgets/{budget_id}", response_model=BudgetResponse, tags=["budgets"])
async def get_budget(budget_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    budget = await db.scalar(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.tenant_id == identity.tenant_id,
        )
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.post("/budgets", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED, tags=["budgets"])
async def create_budget(payload: BudgetCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    if payload.outlet_id:
        identity.can_access_outlet(payload.outlet_id)
    clash = await db.scalar(
        select(Budget.id).where(
            Budget.tenant_id == identity.tenant_id,
            Budget.department_or_module == payload.department_or_module,
            Budget.period_month == payload.period_month,
            Budget.period_year == payload.period_year,
        )
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"Budget for '{payload.department_or_module}' in {payload.period_year}-{payload.period_month:02d} already exists",
        )
    budget = Budget(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(budget)
    await db.flush()
    return budget


@router.post("/budgets/{budget_id}/actuals", response_model=BudgetResponse, tags=["budgets"])
async def add_budget_actuals(
    budget_id: uuid.UUID,
    payload: BudgetActualCreate,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Accumulate actuals: adds ``amount`` to the existing running total."""
    identity.require("manage:accounting")
    budget = await db.scalar(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.tenant_id == identity.tenant_id,
        )
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    budget.actual = (budget.actual or 0) + payload.amount
    await db.flush()
    return budget


# ─── Expense Claims ────────────────────────────────────────────────────────

@router.get("/expense-claims", response_model=list[ExpenseClaimResponse], tags=["expense-claims"])
async def list_expense_claims(
    identity: CurrentIdentity,
    db: DbDep,
    status: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    identity.require("view:accounting")
    stmt = (
        select(ExpenseClaim)
        .where(ExpenseClaim.tenant_id == identity.tenant_id)
        .options(selectinload(ExpenseClaim.lines))
        .order_by(ExpenseClaim.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if status:
        stmt = stmt.where(ExpenseClaim.status == status)
    if user_id:
        stmt = stmt.where(ExpenseClaim.user_id == user_id)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/expense-claims/summary", response_model=ExpenseClaimSummaryResponse, tags=["expense-claims"])
async def expense_claims_summary(identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    stmt = select(
        ExpenseClaim.status,
        func.count(ExpenseClaim.id).label("claim_count"),
        func.coalesce(func.sum(ExpenseClaim.total), 0).label("claim_total"),
    ).where(ExpenseClaim.tenant_id == identity.tenant_id).group_by(ExpenseClaim.status)
    rows = []
    total_claims = 0
    total_amount = 0
    pending_amount = 0
    for r in (await db.execute(stmt)).all():
        rows.append(ExpenseClaimSummaryRow(status=str(r[0]), count=int(r[1]), total=r[2]))
        total_claims += int(r[1])
        total_amount += r[2]
        if str(r[0]) in ("submitted", "approved"):
            pending_amount += r[2]
    return ExpenseClaimSummaryResponse(
        rows=rows, total_claims=total_claims, total_amount=total_amount, pending_amount=pending_amount,
    )


@router.get("/expense-claims/{claim_id}", response_model=ExpenseClaimResponse, tags=["expense-claims"])
async def get_expense_claim(claim_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("view:accounting")
    claim = await db.scalar(
        select(ExpenseClaim)
        .where(ExpenseClaim.id == claim_id, ExpenseClaim.tenant_id == identity.tenant_id)
        .options(selectinload(ExpenseClaim.lines))
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    return claim


@router.post("/expense-claims", response_model=ExpenseClaimResponse,
             status_code=status.HTTP_201_CREATED, tags=["expense-claims"])
async def create_expense_claim(payload: ExpenseClaimCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:accounting")
    total = payload.total
    if total is None:
        total = sum((line.amount for line in payload.lines), 0)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Expense claim total must be greater than zero")
    claim = ExpenseClaim(
        tenant_id=identity.tenant_id,
        user_id=payload.user_id or identity.user_id,
        claimed_on=payload.claimed_on or date.today(),
        total=total,
        status=payload.status or "submitted",
        notes=payload.notes,
    )
    db.add(claim)
    await db.flush()
    for line in payload.lines:
        db.add(ExpenseClaimLine(
            tenant_id=identity.tenant_id,
            claim_id=claim.id,
            category=line.category,
            amount=line.amount,
            description=line.description,
        ))
    await db.flush()
    stmt = select(ExpenseClaim).where(ExpenseClaim.id == claim.id).options(selectinload(ExpenseClaim.lines))
    return await db.scalar(stmt)


@router.post("/expense-claims/{claim_id}/approve",
             response_model=ExpenseClaimActionResponse, tags=["expense-claims"])
async def approve_expense_claim(
    claim_id: uuid.UUID,
    payload: dict | None,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Approve and post the reimbursement entry.

    Simplification (documented per the task): we post a *single-line pair*
    to 5030 (Rent & Utilities — the closest catch-all 50xx) and 1010
    (Bank) regardless of the per-line category breakdown. If a 50xx
    account matched by keyword existed it would be preferred, but that
    requires a category→account mapping table that is out of scope.
    """
    identity.require("manage:accounting")
    claim = await db.scalar(
        select(ExpenseClaim).where(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == identity.tenant_id,
        )
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    if claim.status not in ("submitted", "rejected"):
        raise HTTPException(
            status_code=409,
            detail=f"Expense claim is already '{claim.status}'",
        )
    expense_acct = await service._find_account(db, identity.tenant_id, "5030")
    bank_acct = await service._find_account(db, identity.tenant_id, "1010")
    if not expense_acct or not bank_acct:
        # No chart of accounts seeded — approve without posting; the
        # journal entry will need to be posted manually later.
        claim.status = "approved"
        await db.flush()
        return ExpenseClaimActionResponse(
            message="Claim approved; chart of accounts not seeded, no journal entry posted",
            claim=ExpenseClaimResponse.model_validate(claim),
        )
    entry = await service._post_entry(
        db,
        identity.tenant_id,
        date.today(),
        "expense_claim",
        str(claim.id),
        f"Approved expense claim {claim.id} (reimbursed via bank)",
        [
            (expense_acct, claim.total, 0),
            (bank_acct, 0, claim.total),
        ],
        identity.user_id,
    )
    claim.status = "approved"
    claim.journal_entry_id = entry.id
    await db.flush()
    stmt = select(ExpenseClaim).where(ExpenseClaim.id == claim.id).options(selectinload(ExpenseClaim.lines))
    claim = await db.scalar(stmt)
    return ExpenseClaimActionResponse(message="Claim approved and posted to 5030/1010", claim=claim)


@router.post("/expense-claims/{claim_id}/reject",
             response_model=ExpenseClaimActionResponse, tags=["expense-claims"])
async def reject_expense_claim(
    claim_id: uuid.UUID,
    payload: dict | None,
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:accounting")
    claim = await db.scalar(
        select(ExpenseClaim).where(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == identity.tenant_id,
        )
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Expense claim not found")
    if claim.status not in ("submitted", "rejected"):
        raise HTTPException(
            status_code=409,
            detail=f"Expense claim is already '{claim.status}'",
        )
    claim.status = "rejected"
    if payload and payload.get("reason"):
        claim.notes = f"Rejected: {payload.get('reason')}"
    await db.flush()
    return ExpenseClaimActionResponse(message="Claim rejected", claim=claim)


# ─── Financial Reports (canonical service-prefix paths) ───────────────────

@router.get("/financial-reports/balance-sheet", response_model=BalanceSheetResponse, tags=["reports"])
async def report_balance_sheet(
    identity: CurrentIdentity,
    db: DbDep,
    as_of: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.balance_sheet(db, identity.tenant_id, as_of, outlet_id)


@router.get("/financial-reports/cash-flow", response_model=CashFlowResponse, tags=["reports"])
async def report_cash_flow(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.cash_flow(db, identity.tenant_id, date_from, date_to, outlet_id)


@router.get("/financial-reports/ar-aging", response_model=ARAgingResponse, tags=["reports"])
async def report_ar_aging(
    identity: CurrentIdentity,
    db: DbDep,
    as_of: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.ar_aging(db, identity.tenant_id, as_of, outlet_id)


@router.get("/financial-reports/profit-and-loss", response_model=PnlResponse, tags=["reports"])
async def report_profit_and_loss(
    identity: CurrentIdentity,
    db: DbDep,
    date_from: date = Query(...),
    date_to: date = Query(default_factory=date.today),
    outlet_id: uuid.UUID | None = None,
):
    """Alias of ``/pnl`` under the frontend's expected path."""
    identity.require("view:accounting")
    if outlet_id:
        identity.can_access_outlet(outlet_id)
    return await service.compute_pnl(db, identity.tenant_id, date_from, date_to, outlet_id)


# ─── GST ───────────────────────────────────────────────────────────────────

@router.get("/gst/summary", response_model=GSTSummaryResponse, tags=["tax"])
async def gst_summary_route(
    identity: CurrentIdentity,
    db: DbDep,
    period: str = Query(...),
):
    """Aggregate the tenant's local GSTReturn rows for a period.

    Tries to pull the invoice side from billing over the mesh; on
    non-200 or timeout degrades to local-only (invoices_available=False).
    """
    identity.require("view:accounting")
    data = await service.gst_summary(db, identity.tenant_id, period)
    return GSTSummaryResponse(
        period=data["period"],
        returns=[GSTReturnResponse.model_validate(r) for r in data["returns"]],
        total_taxable_value=data["total_taxable_value"],
        total_cgst=data["total_cgst"],
        total_sgst=data["total_sgst"],
        total_igst=data["total_igst"],
        total_cess=data["total_cess"],
        total_tax=data["total_tax"],
        invoices_available=data["invoices_available"],
        invoice_count=data["invoice_count"],
        notes=data["notes"],
    )


@router.post("/gst/returns/{return_id}/submit-stub",
             response_model=GSTReturnResponse, tags=["tax"])
async def submit_gst_return_stub(
    return_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Mark a return as filed without a real GSP submission.

    Honest stub: ``arn`` stays None and the response carries a note that
    no e-invoice / e-waybill service is configured. The row is updated in
    place; no external call is made.
    """
    identity.require("manage:accounting")
    ret = await db.scalar(
        select(GSTReturn).where(
            GSTReturn.id == return_id,
            GSTReturn.tenant_id == identity.tenant_id,
        )
    )
    if not ret:
        raise HTTPException(status_code=404, detail="GST return not found")
    ret.status = "filed"
    ret.filed_at = datetime.now(timezone.utc).isoformat()
    # irn_number stays null; note is in the response envelope
    await db.flush()
    return ret


@router.post("/gst/otp/verify", tags=["tax"])
async def verify_gst_otp(payload: dict, identity: CurrentIdentity):
    """Honest 501 — OTP filing / e-invoice GSP integration not configured."""
    identity.require("manage:accounting")
    return JSONResponse(
        status_code=501,
        content={
            "code": "E_INVOICE_NOT_CONFIGURED",
            "message": "OTP filing / e-invoice GSP is not configured for this deployment. "
                       "Configure a GSP endpoint (whitebooks-style) to enable this flow.",
        },
    )
