"""Accounting service API routes."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.accounting.models import (
    ChartOfAccount,
    DayClose,
    DayCloseStatus,
    GSTReturn,
    JournalEntry,
    JournalEntryStatus,
    TaxPayment,
)
from src.services.accounting.schemas import (
    ChartOfAccountCreate,
    ChartOfAccountResponse,
    ChartOfAccountUpdate,
    DayCloseCreate,
    DayCloseResponse,
    GSTReturnCreate,
    GSTReturnResponse,
    JournalEntryCreate,
    JournalEntryResponse,
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
