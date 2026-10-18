"""Shift and day-close endpoints — cash drawer control."""
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
    Bill,
    BillPayment,
    BillStatus,
    CashMovementType,
    DayClose,
    DayCloseStatus,
    PaymentMethod,
    PaymentStatus,
    Shift,
    ShiftCashMovement,
    ShiftStatus,
)
from src.schemas.shift import (
    CashMovementCreate,
    CashMovementResponse,
    DayCloseCreate,
    DayCloseResponse,
    ShiftClose,
    ShiftOpen,
    ShiftResponse,
    ShiftSummary,
)
from src.services.number_series import allocate_number

router = APIRouter(prefix="/shifts", tags=["Shifts"])

TWO_PLACES = Decimal("0.01")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _s(value) -> str:
    """Enum → its string value."""
    return value.value if hasattr(value, "value") else str(value or "")


async def _get_shift_for_ctx(
    db: AsyncSession, ctx: CurrentUserContext, shift_id: uuid.UUID
) -> Shift:
    shift = (
        await db.execute(
            select(Shift)
            .options(selectinload(Shift.cash_movements))
            .where(Shift.id == shift_id, Shift.tenant_id == ctx.tenant_id)
        )
    ).scalars().first()
    if shift is None:
        raise HTTPException(status_code=404, detail="Shift not found")
    resolve_outlet_id(ctx, shift.outlet_id)
    return shift


async def _open_shift_for_outlet(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID
) -> Shift | None:
    return (
        await db.execute(
            select(Shift).where(
                Shift.tenant_id == tenant_id,
                Shift.outlet_id == outlet_id,
                Shift.status == ShiftStatus.OPEN,
            )
        )
    ).scalars().first()


async def _expected_cash_for_shift(db: AsyncSession, shift: Shift) -> Decimal:
    """Opening float plus cash billed, minus change given and drawer movements."""
    total = _d(shift.opening_cash)

    payments = (
        await db.execute(
            select(BillPayment).where(
                BillPayment.shift_id == shift.id,
                BillPayment.method == PaymentMethod.CASH,
                BillPayment.status == PaymentStatus.SUCCESS,
            )
        )
    ).scalars().all()

    for payment in payments:
        total += _d(payment.amount)
        # Change handed back to the guest leaves the drawer
        bill = await db.scalar(select(Bill).where(Bill.id == payment.bill_id))
        if bill is not None and _d(bill.change_amount) > 0:
            total -= _d(bill.change_amount)

    for movement in shift.cash_movements or []:
        if movement.movement_type in (CashMovementType.PAID_OUT, CashMovementType.DROP):
            total -= _d(movement.amount)
        elif movement.movement_type in (CashMovementType.PAID_IN, CashMovementType.PICKUP):
            total += _d(movement.amount)

    return _money(total)


# ─── Shifts ──────────────────────────────────────────────────────

@router.get("", response_model=list[ShiftResponse])
@router.get("/", response_model=list[ShiftResponse])
async def list_shifts(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Shift).where(Shift.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(Shift.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Shift.status == status_filter)
    stmt = stmt.order_by(Shift.created_at.desc()).limit(limit).offset(offset)
    return [
        ShiftResponse.model_validate(s)
        for s in (await db.execute(stmt)).scalars().all()
    ]


@router.get("/current", response_model=ShiftResponse | None)
async def get_current_shift(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID,
):
    """The POS looks this up on boot — null means a shift must be opened first."""
    resolve_outlet_id(ctx, outlet_id)
    shift = await _open_shift_for_outlet(db, ctx.tenant_id, outlet_id)
    if shift is None:
        return None
    return ShiftResponse.model_validate(shift)


@router.post("", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
async def open_shift(
    payload: ShiftOpen,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id)

    existing = await _open_shift_for_outlet(db, ctx.tenant_id, payload.outlet_id)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"A shift is already open here ({existing.shift_number}) — close it first",
        )

    shift = Shift(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        user_id=ctx.user_id,
        shift_number=await allocate_number(db, ctx.tenant_id, "shift", payload.outlet_id),
        shift_type=payload.shift_type,
        status=ShiftStatus.OPEN,
        opening_cash=_money(_d(payload.opening_cash)),
        opened_at=_now(),
        notes=payload.notes,
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return ShiftResponse.model_validate(shift)


@router.get("/day-close", response_model=list[DayCloseResponse])
async def list_day_closes(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    limit: int = 90,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(DayClose).where(DayClose.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(DayClose.outlet_id == outlet_id)
    stmt = stmt.order_by(DayClose.close_date.desc()).limit(limit)
    return [
        DayCloseResponse.model_validate(d)
        for d in (await db.execute(stmt)).scalars().all()
    ]


@router.get("/{shift_id}", response_model=ShiftResponse)
async def get_shift(
    shift_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return ShiftResponse.model_validate(await _get_shift_for_ctx(db, ctx, shift_id))


@router.get("/{shift_id}/expected-cash", response_model=dict)
async def get_expected_cash(
    shift_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """What the drawer should hold — shown to the cashier before closing."""
    shift = await _get_shift_for_ctx(db, ctx, shift_id)
    expected = await _expected_cash_for_shift(db, shift)
    return {"shift_id": str(shift.id), "expected_cash": float(expected)}


@router.get("/{shift_id}/summary", response_model=ShiftSummary)
async def get_shift_summary(
    shift_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """The shift-close screen's numbers, in one call."""
    shift = await _get_shift_for_ctx(db, ctx, shift_id)

    bills = (
        await db.execute(
            select(Bill).where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.shift_id == shift.id,
                Bill.status == BillStatus.SETTLED,
            )
        )
    ).scalars().all()

    gross = discount = tax = Decimal("0")
    tips = Decimal("0")
    by_method = {
        "cash": Decimal("0"), "card": Decimal("0"), "upi": Decimal("0"),
        "wallet": Decimal("0"), "credit": Decimal("0"),
        "aggregator": Decimal("0"), "online": Decimal("0"),
    }

    for bill in bills:
        gross += _d(bill.grand_total)
        discount += _d(bill.discount_total)
        tax += _d(bill.tax_total)
        tips += _d(bill.tip)
        for payment in bill.payments or []:
            if _s(payment.status) != PaymentStatus.SUCCESS.value:
                continue
            key = _s(payment.method)
            if key in by_method:
                by_method[key] += _d(payment.amount)

    return ShiftSummary(
        shift_id=shift.id,
        shift_number=shift.shift_number,
        status=_s(shift.status),
        opened_at=shift.opened_at,
        closed_at=shift.closed_at,
        opening_cash=float(_d(shift.opening_cash)),
        closing_cash_expected=(
            float(shift.closing_cash_expected)
            if shift.closing_cash_expected is not None else None
        ),
        closing_cash_actual=(
            float(shift.closing_cash_actual)
            if shift.closing_cash_actual is not None else None
        ),
        discrepancy=float(shift.discrepancy) if shift.discrepancy is not None else None,
        total_bills=len(bills),
        gross_sales=float(_money(gross)),
        total_discount=float(_money(discount)),
        total_tax=float(_money(tax)),
        net_sales=float(_money(gross - discount - tax)),
        cash_sales=float(_money(by_method["cash"])),
        card_sales=float(_money(by_method["card"])),
        upi_sales=float(_money(by_method["upi"])),
        wallet_sales=float(_money(by_method["wallet"])),
        credit_sales=float(_money(by_method["credit"])),
        aggregator_sales=float(_money(by_method["aggregator"])),
        online_sales=float(_money(by_method["online"])),
        total_tips=float(_money(tips)),
        cash_movements=[
            CashMovementResponse.model_validate(m)
            for m in (shift.cash_movements or [])
        ],
    )


@router.post("/{shift_id}/cash-movements", response_model=CashMovementResponse,
             status_code=status.HTTP_201_CREATED)
async def add_cash_movement(
    shift_id: uuid.UUID,
    payload: CashMovementCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cash out (refund, float), cash in (top-up), drawer drop, pickup."""
    shift = await _get_shift_for_ctx(db, ctx, shift_id)
    if _s(shift.status) != ShiftStatus.OPEN.value:
        raise HTTPException(status_code=409, detail="This shift is already closed")

    movement = ShiftCashMovement(
        tenant_id=ctx.tenant_id,
        shift_id=shift.id,
        movement_type=payload.movement_type,
        amount=_money(_d(payload.amount)),
        reason=payload.reason,
        created_by=ctx.user_id,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return CashMovementResponse.model_validate(movement)


@router.get("/{shift_id}/cash-movements", response_model=list[CashMovementResponse])
async def list_cash_movements(
    shift_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _get_shift_for_ctx(db, ctx, shift_id)
    stmt = (
        select(ShiftCashMovement)
        .where(ShiftCashMovement.shift_id == shift_id)
        .order_by(ShiftCashMovement.created_at)
    )
    return [
        CashMovementResponse.model_validate(m)
        for m in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/{shift_id}/close", response_model=ShiftResponse)
async def close_shift(
    shift_id: uuid.UUID,
    payload: ShiftClose,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("close:shifts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Close the drawer and compute the variance against the expected cash."""
    shift = await _get_shift_for_ctx(db, ctx, shift_id)
    if _s(shift.status) != ShiftStatus.OPEN.value:
        raise HTTPException(status_code=409, detail="This shift is already closed")

    # A cashier cannot close their own shift — an operator must verify it
    if shift.user_id == ctx.user_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot close your own shift — ask an operator to close it",
        )

    expected = await _expected_cash_for_shift(db, shift)
    actual = _money(_d(payload.closing_cash_actual))

    shift.status = ShiftStatus.CLOSED
    shift.closed_at = _now()
    shift.closed_by = ctx.user_id
    shift.closing_cash_expected = expected
    shift.closing_cash_actual = actual
    shift.discrepancy = _money(actual - expected)
    shift.discrepancy_approved_by = ctx.user_id
    shift.denominations = payload.denominations or {}
    if payload.discrepancy_reason:
        shift.discrepancy_reason = payload.discrepancy_reason
    if payload.notes:
        shift.notes = (shift.notes or "") + f"\n[CLOSE] {payload.notes}".rstrip()

    await db.commit()
    await db.refresh(shift)
    return ShiftResponse.model_validate(shift)


# ─── Day close ───────────────────────────────────────────────────

@router.post("/day-close", response_model=DayCloseResponse,
             status_code=status.HTTP_201_CREATED)
async def run_day_close(
    payload: DayCloseCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:day_close"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Aggregate a business day's settled bills into the DayClose ledger row."""
    resolve_outlet_id(ctx, payload.outlet_id)

    existing = await db.scalar(
        select(DayClose).where(
            DayClose.tenant_id == ctx.tenant_id,
            DayClose.outlet_id == payload.outlet_id,
            DayClose.close_date == payload.close_date,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"{payload.close_date} is already closed for this outlet",
        )

    day_start = f"{payload.close_date.isoformat()}T00:00:00"
    day_end = f"{payload.close_date.isoformat()}T23:59:59"

    bills = (
        await db.execute(
            select(Bill)
            .options(selectinload(Bill.payments))
            .where(
                Bill.tenant_id == ctx.tenant_id,
                Bill.outlet_id == payload.outlet_id,
                Bill.status == BillStatus.SETTLED,
                Bill.settled_at >= day_start,
                Bill.settled_at <= day_end,
            )
        )
    ).scalars().all()

    total_sales = total_discount = total_tax = total_round_off = Decimal("0")
    total_covers = 0
    by_method = {
        "cash": Decimal("0"), "card": Decimal("0"), "upi": Decimal("0"),
        "wallet": Decimal("0"), "credit": Decimal("0"),
        "aggregator_paid": Decimal("0"), "online": Decimal("0"),
    }

    for bill in bills:
        total_sales += _d(bill.grand_total)
        total_discount += _d(bill.discount_total)
        total_tax += _d(bill.tax_total)
        total_round_off += _d(bill.round_off)
        total_covers += int(bill.covers or 0)

        for payment in bill.payments or []:
            if _s(payment.status) != PaymentStatus.SUCCESS.value:
                continue
            key = _s(payment.method)
            if key in by_method:
                by_method[key] += _d(payment.amount)

    day_close = DayClose(
        tenant_id=ctx.tenant_id,
        outlet_id=payload.outlet_id,
        shift_id=payload.shift_id,
        close_date=payload.close_date,
        status=DayCloseStatus.CLOSED,
        total_sales=_money(total_sales),
        cash_sales=_money(by_method["cash"]),
        card_sales=_money(by_method["card"]),
        upi_sales=_money(by_method["upi"]),
        wallet_sales=_money(by_method["wallet"]),
        credit_sales=_money(by_method["credit"]),
        aggregator_sales=_money(by_method["aggregator_paid"]),
        online_sales=_money(by_method["online"]),
        total_discount=_money(total_discount),
        total_tax=_money(total_tax),
        total_round_off=_money(total_round_off),
        total_orders=len(bills),
        total_covers=total_covers,
        avg_ticket=(
            _money(total_sales / Decimal(len(bills))) if bills else Decimal("0")
        ),
        # DayClose.cash_* is declared int-like Numeric — store the counted cash
        # in cash_actual and derive the variance from the cash billings
        cash_expected=float(_money(by_method["cash"])),
        cash_actual=0.0,
        discrepancy=0.0,
        closed_by=ctx.user_id,
        closed_at=_now(),
        notes=payload.notes,
    )
    db.add(day_close)
    await db.commit()
    await db.refresh(day_close)
    return DayCloseResponse.model_validate(day_close)


@router.put("/day-close/{day_close_id}", response_model=DayCloseResponse)
async def reconcile_day_close(
    day_close_id: uuid.UUID,
    cash_actual: float,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:day_close"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    notes: str | None = None,
):
    """Count the safe and reconcile the day against the ledger."""
    day_close = await db.scalar(
        select(DayClose).where(
            DayClose.id == day_close_id, DayClose.tenant_id == ctx.tenant_id
        )
    )
    if day_close is None:
        raise HTTPException(status_code=404, detail="Day close not found")
    resolve_outlet_id(ctx, day_close.outlet_id)

    if _s(day_close.status) == DayCloseStatus.RECONCILED.value:
        raise HTTPException(status_code=409, detail="This day is already reconciled")

    day_close.cash_actual = _money(_d(cash_actual))
    day_close.discrepancy = _money(_d(cash_actual) - _d(day_close.cash_expected))
    day_close.status = DayCloseStatus.RECONCILED
    day_close.closed_by = ctx.user_id
    day_close.closed_at = _now()
    if notes:
        day_close.notes = ((day_close.notes or "") + f"\n{notes}").strip()

    await db.commit()
    await db.refresh(day_close)
    return DayCloseResponse.model_validate(day_close)
