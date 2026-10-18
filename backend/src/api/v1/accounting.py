"""Accounting endpoints — chart of accounts, journal entries, GST returns.

The POS writes a balanced journal entry for every settled bill: cash/card/UPI
debits against sales and tax credits. The journal is the single source of truth
for the P&L, so the balance check on entry creation is not optional.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    AccountType,
    Bill,
    BillStatus,
    ChartOfAccount,
    GSTReturn,
    JournalEntry,
    JournalEntryLine,
    JournalEntryStatus,
    TaxPayment,
)
from src.schemas.shift import (
    ChartOfAccountCreate,
    ChartOfAccountResponse,
    ChartOfAccountUpdate,
    GSTReturnCreate,
    GSTReturnResponse,
    JournalEntryCreate,
    JournalEntryLineResponse,
    JournalEntryResponse,
    TaxPaymentCreate,
    TaxPaymentResponse,
)
from src.services.kot_service import _status_value
from src.services.number_series import allocate_number

router = APIRouter(prefix="/accounting", tags=["Accounting"])

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Chart of accounts ───────────────────────────────────────────

@router.get("/accounts", response_model=list[ChartOfAccountResponse])
async def list_accounts(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    account_type: str | None = None,
    include_inactive: bool = False,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(ChartOfAccount).where(ChartOfAccount.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(ChartOfAccount.outlet_id == outlet_id)
    if account_type:
        stmt = stmt.where(ChartOfAccount.account_type == account_type)
    if not include_inactive:
        stmt = stmt.where(ChartOfAccount.is_active.is_(True))
    stmt = stmt.order_by(ChartOfAccount.code)
    return [
        ChartOfAccountResponse.model_validate(a)
        for a in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/accounts", response_model=ChartOfAccountResponse,
             status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: ChartOfAccountCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    clash = await db.scalar(
        select(ChartOfAccount.id).where(
            ChartOfAccount.tenant_id == ctx.tenant_id, ChartOfAccount.code == payload.code
        )
    )
    if clash:
        raise HTTPException(
            status_code=409, detail=f"Account code '{payload.code}' already exists"
        )

    if payload.parent_id:
        parent = await db.scalar(
            select(ChartOfAccount).where(
                ChartOfAccount.id == payload.parent_id,
                ChartOfAccount.tenant_id == ctx.tenant_id,
            )
        )
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent account not found")

    account = ChartOfAccount(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return ChartOfAccountResponse.model_validate(account)


@router.put("/accounts/{account_id}", response_model=ChartOfAccountResponse)
async def update_account(
    account_id: uuid.UUID,
    payload: ChartOfAccountUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await db.scalar(
        select(ChartOfAccount).where(
            ChartOfAccount.id == account_id, ChartOfAccount.tenant_id == ctx.tenant_id
        )
    )
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.outlet_id:
        resolve_outlet_id(ctx, account.outlet_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return ChartOfAccountResponse.model_validate(account)


@router.get("/trial-balance", response_model=list[dict])
async def trial_balance(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    """Debit and credit totals per account — the books are balanced when they match."""
    resolve_outlet_id(ctx, outlet_id, required=False)

    stmt = (
        select(
            ChartOfAccount.id,
            ChartOfAccount.code,
            ChartOfAccount.name,
            ChartOfAccount.account_type,
            func.coalesce(func.sum(JournalEntryLine.debit), 0).label("debit"),
            func.coalesce(func.sum(JournalEntryLine.credit), 0).label("credit"),
        )
        .join(JournalEntryLine, JournalEntryLine.account_id == ChartOfAccount.id)
        .join(JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id)
        .where(
            ChartOfAccount.tenant_id == ctx.tenant_id,
            JournalEntry.status == JournalEntryStatus.POSTED,
        )
    )
    if outlet_id:
        stmt = stmt.where(ChartOfAccount.outlet_id == outlet_id)
    if date_from:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)
    stmt = stmt.group_by(
        ChartOfAccount.id, ChartOfAccount.code,
        ChartOfAccount.name, ChartOfAccount.account_type,
    ).order_by(ChartOfAccount.code)

    return [
        {
            "account_id": str(row.id),
            "code": row.code,
            "name": row.name,
            "account_type": _status_value(row.account_type),
            "debit": float(_money(_d(row.debit))),
            "credit": float(_money(_d(row.credit))),
        }
        for row in (await db.execute(stmt)).all()
    ]


# ─── Journal entries ─────────────────────────────────────────────

@router.get("/journals", response_model=list[JournalEntryResponse])
async def list_journals(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 100,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = (
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(JournalEntry.tenant_id == ctx.tenant_id)
    )
    if outlet_id:
        stmt = stmt.where(JournalEntry.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(JournalEntry.status == status_filter)
    if date_from:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)
    stmt = stmt.order_by(JournalEntry.entry_date.desc()).limit(limit)

    return [
        JournalEntryResponse.model_validate(e)
        for e in (await db.execute(stmt)).unique().scalars().all()
    ]


@router.post("/journals", response_model=JournalEntryResponse,
             status_code=status.HTTP_201_CREATED)
async def create_journal(
    payload: JournalEntryCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a journal entry — debits must equal credits or it is rejected."""
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    total_debit = _money(sum((_d(line.debit) for line in payload.lines), Decimal("0")))
    total_credit = _money(sum((_d(line.credit) for line in payload.lines), Decimal("0")))

    if total_debit != total_credit:
        raise HTTPException(
            status_code=422,
            detail=f"Entry is unbalanced — debits ₹{total_debit} vs credits ₹{total_credit}",
        )
    if total_debit == 0:
        raise HTTPException(status_code=422, detail="An entry needs a non-zero amount")

    # Every line must be one-sided and reference a real account
    account_ids = [line.account_id for line in payload.lines]
    accounts = {
        a.id: a
        for a in (
            await db.execute(
                select(ChartOfAccount).where(
                    ChartOfAccount.tenant_id == ctx.tenant_id,
                    ChartOfAccount.id.in_(account_ids),
                )
            )
        ).scalars().all()
    }
    missing = [str(a) for a in account_ids if a not in accounts]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Unknown accounts: {', '.join(missing)}"
        )

    for line in payload.lines:
        if _d(line.debit) > 0 and _d(line.credit) > 0:
            raise HTTPException(
                status_code=422,
                detail=f"A line cannot be both a debit and a credit "
                       f"(account {line.account_id})",
            )
        if _d(line.debit) == 0 and _d(line.credit) == 0:
            raise HTTPException(
                status_code=422,
                detail=f"A line must have a debit or a credit (account {line.account_id})",
            )

    entry = JournalEntry(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        entry_number=await allocate_number(db, ctx.tenant_id, "journal_entry", payload.outlet_id),
        entry_date=payload.entry_date,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        narration=payload.narration,
        status=payload.status,
        posted_by=ctx.user_id if payload.status == JournalEntryStatus.POSTED else None,
    )
    db.add(entry)
    await db.flush()

    for line in payload.lines:
        db.add(JournalEntryLine(
            tenant_id=ctx.tenant_id,
            journal_entry_id=entry.id,
            account_id=line.account_id,
            debit=float(_money(_d(line.debit))),
            credit=float(_money(_d(line.credit))),
            description=line.description,
        ))

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    entry_id = entry.id
    entry = (
        await db.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(
                JournalEntry.id == entry_id,
                JournalEntry.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return JournalEntryResponse.model_validate(entry)


@router.post("/journals/{entry_id}/post", response_model=JournalEntryResponse)
async def post_journal(
    entry_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Post a draft entry — once posted it is locked and feeds the reports."""
    entry = (
        await db.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if entry.outlet_id:
        resolve_outlet_id(ctx, entry.outlet_id)

    if _status_value(entry.status) != JournalEntryStatus.DRAFT.value:
        raise HTTPException(
            status_code=409,
            detail=f"This entry is already {_status_value(entry.status)}",
        )

    # Re-validate at post time — a draft could have been written before a rule change
    total_debit = _money(sum((_d(l.debit) for l in entry.lines or []), Decimal("0")))
    total_credit = _money(sum((_d(l.credit) for l in entry.lines or []), Decimal("0")))
    if total_debit != total_credit:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot post — debits ₹{total_debit} vs credits ₹{total_credit}",
        )

    entry.status = JournalEntryStatus.POSTED
    entry.posted_by = ctx.user_id
    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    entry_id = entry.id
    entry = (
        await db.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(
                JournalEntry.id == entry_id,
                JournalEntry.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return JournalEntryResponse.model_validate(entry)


@router.get("/journals/{entry_id}", response_model=JournalEntryResponse)
async def get_journal(
    entry_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    entry = (
        await db.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if entry.outlet_id:
        resolve_outlet_id(ctx, entry.outlet_id)
    return JournalEntryResponse.model_validate(entry)


# ─── Bill posting ────────────────────────────────────────────────

@router.post("/bills/{bill_id}/post", response_model=JournalEntryResponse)
async def post_bill_to_ledger(
    bill_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    cash_account_id: uuid.UUID,
    sales_account_id: uuid.UUID,
    tax_payable_account_id: uuid.UUID | None = None,
    discount_account_id: uuid.UUID | None = None,
):
    """Turn a settled bill into a double-entry journal.

    Debits the payment tenders, credits net sales, and credits the tax payable
    (and debits any discount) so the entry balances against the gross total.
    """
    bill = (
        await db.execute(
            select(Bill)
            .options(selectinload(Bill.payments))
            .where(Bill.id == bill_id, Bill.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    resolve_outlet_id(ctx, bill.outlet_id)

    if _status_value(bill.status) != BillStatus.SETTLED.value:
        raise HTTPException(
            status_code=409, detail="Only a settled bill can be posted to the ledger"
        )

    already = await db.scalar(
        select(JournalEntry.id).where(
            JournalEntry.tenant_id == ctx.tenant_id,
            JournalEntry.reference_type == "bill",
            JournalEntry.reference_id == bill.bill_number,
        )
    )
    if already:
        raise HTTPException(
            status_code=409,
            detail=f"{bill.bill_number} has already been posted",
        )

    from src.models import PaymentStatus

    # Debit each tender that actually collected money
    lines: list[JournalEntryLine] = []
    by_method: dict[str, Decimal] = {}
    for payment in bill.payments or []:
        if _status_value(payment.status) != PaymentStatus.SUCCESS.value:
            continue
        key = _status_value(payment.method)
        by_method[key] = by_method.get(key, Decimal("0")) + _d(payment.amount)

    if not by_method:
        raise HTTPException(status_code=422, detail="This bill has no successful payments")

    # Cash goes to cash; card/UPI/wallet route through the bank account
    cash_total = by_method.pop("cash", Decimal("0"))
    if cash_total > 0:
        lines.append(JournalEntryLine(
            tenant_id=ctx.tenant_id, account_id=cash_account_id,
            debit=float(_money(cash_total)), credit=0,
            description=f"Cash — {bill.bill_number}",
        ))

    electronic = sum(by_method.values(), Decimal("0"))
    if electronic > 0:
        lines.append(JournalEntryLine(
            tenant_id=ctx.tenant_id, account_id=cash_account_id,
            debit=float(_money(electronic)), credit=0,
            description=f"{'/'.join(sorted(by_method))} — {bill.bill_number}",
        ))

    # Credit net sales (grand total less discount less tax)
    net_sales = _d(bill.subtotal) - _d(bill.discount_total)
    lines.append(JournalEntryLine(
        tenant_id=ctx.tenant_id, account_id=sales_account_id,
        debit=0, credit=float(_money(net_sales)),
        description=f"Sales — {bill.bill_number}",
    ))

    # Discount reduces the revenue we booked
    if _d(bill.discount_total) > 0 and discount_account_id:
        lines.append(JournalEntryLine(
            tenant_id=ctx.tenant_id, account_id=discount_account_id,
            debit=float(_money(_d(bill.discount_total))), credit=0,
            description=f"Discount — {bill.bill_number}",
        ))

    tax_total = (
        _d(bill.tax_total)
        or (_d(bill.cgst_total) + _d(bill.sgst_total) + _d(bill.igst_total))
    )
    if tax_total > 0 and tax_payable_account_id:
        lines.append(JournalEntryLine(
            tenant_id=ctx.tenant_id, account_id=tax_payable_account_id,
            debit=0, credit=float(_money(tax_total)),
            description=f"GST payable — {bill.bill_number}",
        ))

    entry = JournalEntry(
        tenant_id=ctx.tenant_id,
        outlet_id=bill.outlet_id,
        entry_number=await allocate_number(db, ctx.tenant_id, "journal_entry", bill.outlet_id),
        entry_date=date.today(),
        reference_type="bill",
        reference_id=bill.bill_number,
        narration=f"POS sale {bill.bill_number}",
        status=JournalEntryStatus.POSTED,
        posted_by=ctx.user_id,
    )
    db.add(entry)
    await db.flush()

    for line in lines:
        line.journal_entry_id = entry.id
        db.add(line)

    await db.commit()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    entry_id = entry.id
    entry = (
        await db.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(
                JournalEntry.id == entry_id,
                JournalEntry.tenant_id == ctx.tenant_id,
            )
        )
    ).scalar_one()
    return JournalEntryResponse.model_validate(entry)


# ─── GST returns ─────────────────────────────────────────────────

@router.get("/gst-returns", response_model=list[GSTReturnResponse])
async def list_gst_returns(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(GSTReturn).where(GSTReturn.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(GSTReturn.outlet_id == outlet_id)
    stmt = stmt.order_by(GSTReturn.period.desc())
    return [
        GSTReturnResponse.model_validate(r)
        for r in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/gst-returns", response_model=GSTReturnResponse,
             status_code=status.HTTP_201_CREATED)
async def create_gst_return(
    payload: GSTReturnCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Summarise a month's settled bills into a GST return draft."""
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    if payload.return_type not in ("GSTR1", "GSTR3B"):
        raise HTTPException(
            status_code=422, detail="return_type must be 'GSTR1' or 'GSTR3B'"
        )
    if len(payload.period) != 7 or "-" not in payload.period:
        raise HTTPException(
            status_code=422, detail="period must look like '2026-10'"
        )

    clash = await db.scalar(
        select(GSTReturn.id).where(
            GSTReturn.tenant_id == ctx.tenant_id,
            GSTReturn.return_type == payload.return_type,
            GSTReturn.period == payload.period,
        )
    )
    if clash:
        raise HTTPException(
            status_code=409,
            detail=f"{payload.return_type} for {payload.period} already exists",
        )

    year, month = payload.period.split("-")
    from calendar import monthrange
    last_day = monthrange(int(year), int(month))[1]
    start = f"{payload.period}-01T00:00:00"
    end = f"{payload.period}-{last_day:02d}T23:59:59"

    bills = (
        await db.execute(
            select(Bill).where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= start,
                Bill.settled_at <= end,
            )
        )
    ).scalars().all()
    if payload.outlet_id:
        bills = [b for b in bills if b.outlet_id == payload.outlet_id]

    taxable = cgst = sgst = igst = cess = Decimal("0")
    for bill in bills:
        taxable += _d(bill.taxable_amount or bill.subtotal) - _d(bill.discount_total)
        cgst += _d(bill.cgst_total)
        sgst += _d(bill.sgst_total)
        igst += _d(bill.igst_total)
        cess += _d(bill.cess_total)

    gst_return = GSTReturn(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        return_type=payload.return_type,
        period=payload.period,
        status="draft",
        total_taxable_value=float(_money(taxable)),
        total_cgst=float(_money(cgst)),
        total_sgst=float(_money(sgst)),
        total_igst=float(_money(igst)),
        total_cess=float(_money(cess)),
    )
    db.add(gst_return)
    await db.commit()
    await db.refresh(gst_return)
    return GSTReturnResponse.model_validate(gst_return)


@router.post("/gst-returns/{return_id}/file", response_model=GSTReturnResponse)
async def file_gst_return(
    return_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    arn: str,
):
    """Record the acknowledgement number once filed on the GST portal."""
    gst_return = await db.scalar(
        select(GSTReturn).where(
            GSTReturn.id == return_id, GSTReturn.tenant_id == ctx.tenant_id
        )
    )
    if gst_return is None:
        raise HTTPException(status_code=404, detail="GST return not found")
    if gst_return.outlet_id:
        resolve_outlet_id(ctx, gst_return.outlet_id)

    if _status_value(gst_return.status) == "filed":
        raise HTTPException(status_code=409, detail="This return is already filed")

    gst_return.status = "filed"
    gst_return.filed_at = _now_iso()
    gst_return.arn = arn
    await db.commit()
    await db.refresh(gst_return)
    return GSTReturnResponse.model_validate(gst_return)


# ─── Tax payments ────────────────────────────────────────────────

@router.get("/tax-payments", response_model=list[TaxPaymentResponse])
async def list_tax_payments(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(TaxPayment).where(TaxPayment.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(TaxPayment.outlet_id == outlet_id)
    stmt = stmt.order_by(TaxPayment.period.desc())
    return [
        TaxPaymentResponse.model_validate(p)
        for p in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/tax-payments", response_model=TaxPaymentResponse,
             status_code=status.HTTP_201_CREATED)
async def create_tax_payment(
    payload: TaxPaymentCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)
    payment = TaxPayment(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return TaxPaymentResponse.model_validate(payment)


@router.post("/tax-payments/{payment_id}/mark-paid", response_model=TaxPaymentResponse)
async def mark_tax_paid(
    payment_id: uuid.UUID,
    challan_number: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:accounting"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    payment = await db.scalar(
        select(TaxPayment).where(
            TaxPayment.id == payment_id, TaxPayment.tenant_id == ctx.tenant_id
        )
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="Tax payment not found")
    if payment.outlet_id:
        resolve_outlet_id(ctx, payment.outlet_id)

    payment.status = "paid"
    payment.challan_number = challan_number
    payment.paid_at = _now_iso()
    await db.commit()
    await db.refresh(payment)
    return TaxPaymentResponse.model_validate(payment)
