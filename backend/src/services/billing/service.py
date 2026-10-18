"""Billing service logic — bill construction, taxes, settlement, refunds.

Money rules are ported from the monolith's ``billing_service`` and follow
Indian restaurant practice: item-level GST, service charge on the
*discounted* subtotal, then the grand total rounded to the nearest rupee.

    gross            = sum(unit_price * qty + addons)
    taxable          = gross - discount, floored at zero
    service_charge   = taxable * pct / 100
    line tax split   = per-line taxable * each tax pct
    raw_total        = taxable + service_charge + packaging + tip + tax
    round_off        = nearest rupee - raw_total
    grand_total      = raw_total + round_off

All money is Decimal internally; the API serialises to float.

Cross-service effect: the monolith settled the bill by writing
``order.status = SETTLED`` and closing KOTs directly. Billing cannot write to
pos's or kitchen's database — it publishes ``bill.paid`` and lets them react.
That is the whole point of the split.
"""
from __future__ import annotations

import uuid
from decimal import ROUND_HALF_UP, Decimal
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.billing.models import (
    Bill,
    BillItem,
    BillPayment,
    BillStatus,
    CashMovementType,
    NumberCounter,
    PaymentMethod,
    PaymentStatus,
    Shift,
    ShiftCashMovement,
    ShiftStatus,
    status_value,
)

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    """Coerce to Decimal without banker's-rounding drift.

    Numeric(12,2) comes back as Decimal already, but a float from a payload
    would round the wrong way under Decimal(str(float)), so everything goes
    through str() first.
    """
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid_or_none(value) -> uuid.UUID | None:
    """Parse a UUID out of event data, tolerating anything malformed.

    Event payloads are JSON, so every UUID arrives as a string. Assigning a
    string to a UUID column would raise "invalid input syntax for type uuid"
    on insert — the first bill created from an event would then fail every
    time.
    """
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


class BillingError(Exception):
    """A rejected bill operation. The API layer maps this to 409 or 400."""


# ─── Loading ─────────────────────────────────────────────────────────────────

async def load_bill(db: AsyncSession, tenant_id: uuid.UUID, bill_id: uuid.UUID) -> Bill | None:
    """Fetch a bill with its items and payments eagerly loaded.

    Eager, not lazy: the session runs with expire_on_commit=False and a lazy
    load would fire outside the request's async context, surfacing as
    MissingGreenlet when Pydantic serialises the response.
    """
    return (
        await db.execute(
            select(Bill)
            .options(selectinload(Bill.items), selectinload(Bill.payments))
            .where(Bill.id == bill_id, Bill.tenant_id == tenant_id)
        )
    ).scalars().first()


# ─── Numbering ───────────────────────────────────────────────────────────────

async def allocate_bill_number(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID,
    code: str | None = None,
) -> str:
    """Next bill number for this outlet, monthly-resetting.

    Billing owns its sequence in its own database. The monolith pulled this
    from the organization service's ``number_series`` table; a service cannot
    query a peer's database, so the counter lives here. The row is locked for
    the duration of the transaction, so two concurrent settlements cannot
    receive the same number.
    """
    now = _now()
    key = f"bill:{outlet_id}:{now:%Y-%m}"
    prefix = f"BIL-{(code or 'MAIN').upper()}-{now:%y%m}-"

    counter = (
        await db.execute(
            select(NumberCounter)
            .where(NumberCounter.tenant_id == tenant_id, NumberCounter.key == key)
            .with_for_update()
        )
    ).scalars().first()

    if counter is None:
        counter = NumberCounter(
            tenant_id=tenant_id, key=key, prefix=prefix, next_number=1
        )
        db.add(counter)
        await db.flush()
        # Re-select under lock now that the row exists — otherwise a
        # concurrent settler could create its own row and both start at 1.
        counter = (
            await db.execute(
                select(NumberCounter).where(
                    NumberCounter.tenant_id == tenant_id, NumberCounter.key == key
                )
                .with_for_update()
            )
        ).scalars().one()

    number = counter.next_number
    counter.next_number = number + 1
    await db.flush()
    return f"{counter.prefix}{str(number).zfill(4)}"


# ─── Bill construction ───────────────────────────────────────────────────────

async def build_bill(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    outlet_id: uuid.UUID,
    order_id: uuid.UUID | None,
    order_number: str | None,
    lines: list[dict],
    covers: int = 1,
    discount_total: Decimal = Decimal("0"),
    service_charge_pct: Decimal = Decimal("0"),
    packaging_charge: Decimal = Decimal("0"),
    tip: Decimal = Decimal("0"),
    apply_round_off: bool = True,
    customer_name: str | None = None,
    customer_phone: str | None = None,
    customer_id: uuid.UUID | None = None,
    shift_id: uuid.UUID | None = None,
    cashier_id: uuid.UUID | None = None,
) -> Bill:
    """Build a bill from snapshotted lines.

    The lines arrive already snapshotted by the caller, each carrying its own
    unit price, qty, discount and addon values. Billing therefore never needs
    the menu service: a rate or name change after the sale must not rewrite
    what was actually charged.

    Cart-level discounts are spread pro-rata across lines, so a 100 rupee cart
    discount is attributable to each dish in proportion to its value. Without
    this the tax base is right but no single line explains the discount.
    """
    discount_total = _money(_d(discount_total))
    service_charge_pct = _d(service_charge_pct)
    packaging_charge = _money(_d(packaging_charge))
    tip = _money(_d(tip))

    # Gross before discount — item lines plus their addons.
    gross = Decimal("0")
    for line in lines or []:
        gross += _d(line.get("unit_price")) * Decimal(int(line.get("qty") or 1))
        for addon in line.get("addons") or []:
            gross += _d(addon.get("price")) * Decimal(int(addon.get("qty") or 1))
    gross = _money(gross)

    taxable = _money(gross - discount_total)
    if taxable < 0:
        taxable = Decimal("0")

    # Service charge on the discounted amount, matching the monolith.
    service_charge = _money(taxable * service_charge_pct / Decimal("100"))

    bill = Bill(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        order_id=order_id,
        order_number=order_number,
        bill_number=await allocate_bill_number(db, tenant_id, outlet_id),
        covers=covers,
        status=BillStatus.DRAFT,
        discount_total=discount_total,
        service_charge=service_charge,
        service_charge_pct=service_charge_pct if service_charge_pct else None,
        packaging_charge=packaging_charge,
        tip=tip,
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_id=customer_id,
        shift_id=shift_id,
        cashier_id=cashier_id,
    )
    db.add(bill)
    await db.flush()

    # Snapshot lines with their per-item tax split.
    cgst_total = sgst_total = igst_total = cess_total = tax_total = Decimal("0")
    for line in lines or []:
        item_gross = _d(line.get("unit_price")) * Decimal(int(line.get("qty") or 1))
        for addon in line.get("addons") or []:
            item_gross += _d(addon.get("price")) * Decimal(int(addon.get("qty") or 1))

        # Item's own discount, plus its share of any cart-level discount.
        item_discount = _money(_d(line.get("discount_amount")) +
                               _money(_d(line.get("unit_price")) * Decimal(int(line.get("qty") or 1)) *
                                      _d(line.get("discount_pct") or 0) / Decimal("100")))
        if discount_total > 0 and gross > 0:
            item_discount += _money(item_gross * discount_total / gross)

        item_taxable = _money(max(item_gross - item_discount, Decimal("0")))

        cgst_pct = _d(line.get("cgst_pct"))
        sgst_pct = _d(line.get("sgst_pct"))
        igst_pct = _d(line.get("igst_pct"))
        cess_pct = _d(line.get("cess_pct"))

        cgst = _money(item_taxable * cgst_pct / Decimal("100"))
        sgst = _money(item_taxable * sgst_pct / Decimal("100"))
        igst = _money(item_taxable * igst_pct / Decimal("100"))
        cess = _money(item_taxable * cess_pct / Decimal("100"))
        line_tax = cgst + sgst + igst + cess

        cgst_total += cgst
        sgst_total += sgst
        igst_total += igst
        cess_total += cess
        tax_total += line_tax

        db.add(BillItem(
            tenant_id=tenant_id,
            bill_id=bill.id,
            order_item_id=_uuid_or_none(line.get("order_item_id")),
            menu_item_id=_uuid_or_none(line.get("menu_item_id")),
            name=line.get("name") or "Unlabelled item",
            variant_name=line.get("variant_name"),
            qty=int(line.get("qty") or 1),
            unit_price=_d(line.get("unit_price")),
            discount_pct=line.get("discount_pct"),
            discount_amount=_money(item_discount),
            tax_code_id=_uuid_or_none(line.get("tax_code_id")),
            hsn_code=line.get("hsn_code"),
            tax_pct=(cgst_pct + sgst_pct + igst_pct + cess_pct) or None,
            cgst=cgst,
            sgst=sgst,
            igst=igst,
            cess=cess,
            line_total=_money(item_taxable + line_tax),
        ))

    bill.subtotal = _money(gross)
    bill.taxable_amount = taxable
    bill.tax_total = _money(tax_total)
    bill.cgst_total = _money(cgst_total)
    bill.sgst_total = _money(sgst_total)
    bill.igst_total = _money(igst_total)
    bill.cess_total = _money(cess_total)

    # Round-off to the nearest rupee.
    raw_total = (
        taxable + service_charge + packaging_charge + tip + tax_total
    )
    rounded = _money(raw_total)
    round_off = Decimal("0")
    if apply_round_off:
        nearest = Decimal(int(rounded.to_integral_value(rounding=ROUND_HALF_UP)))
        round_off = nearest - rounded
        rounded = nearest

    bill.grand_total = rounded
    bill.round_off = round_off
    await db.flush()
    return bill


# ─── Settlement ──────────────────────────────────────────────────────────────

async def settle_bill(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    bill: Bill,
    payments: list[dict],
    *,
    cashier_id: uuid.UUID | None = None,
) -> Bill:
    """Record payments against a bill and mark it settled when fully paid.

    Ported from the monolith. The overpay rule matters: cash may overpay
    because change is due, but a card or UPI charge may not, since an
    over-charged gateway payment has to be reversed.
    """
    cur = status_value(bill.status)
    if cur == BillStatus.SETTLED:
        raise BillingError("This bill is already settled")
    if cur == BillStatus.VOID:
        raise BillingError("This bill was voided")

    already_paid = sum(
        _d(p.amount) for p in (bill.payments or [])
        if status_value(p.status) == PaymentStatus.SUCCESS
    )
    outstanding = _money(_d(bill.grand_total) - already_paid)

    incoming = _money(sum(_d(p.get("amount")) for p in payments))
    if incoming <= 0:
        raise BillingError("Enter a payment amount")

    if incoming > outstanding:
        cash_overpay = sum(
            _d(p.get("amount")) for p in payments
            if p.get("method") == PaymentMethod.CASH
        )
        if _money(incoming - outstanding) > cash_overpay:
            raise BillingError(
                f"Payment exceeds the balance by ₹{incoming - outstanding}"
            )

    for payment in payments:
        raw_m = payment.get("method")
        m_str = raw_m.value if hasattr(raw_m, "value") else str(raw_m).split(".")[-1].lower()
        method = PaymentMethod(m_str)
        # Credit never settles immediately — it is an IOU.
        pay_status = PaymentStatus.PENDING if method == PaymentMethod.CREDIT \
            else PaymentStatus.SUCCESS
        db.add(BillPayment(
            tenant_id=tenant_id,
            bill_id=bill.id,
            shift_id=bill.shift_id,
            method=method,
            amount=_money(_d(payment.get("amount"))),
            reference=payment.get("reference"),
            gateway=payment.get("gateway"),
            gateway_txn_id=payment.get("gateway_txn_id"),
            status=pay_status,
            card_last4=payment.get("card_last4"),
            card_type=payment.get("card_type"),
            upi_vpa=payment.get("upi_vpa"),
            idempotency_key=payment.get("idempotency_key"),
        ))

    paid = sum(_d(p.amount) for p in (bill.payments or [])) + incoming
    bill.paid_amount = _money(paid)
    bill.change_amount = _money(max(paid - _d(bill.grand_total), Decimal("0")))
    bill.cashier_id = cashier_id

    if paid >= _d(bill.grand_total):
        bill.status = BillStatus.SETTLED
        bill.settled_at = _now()

    await db.flush()
    return bill


async def refund_payment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    bill: Bill,
    payment_id: uuid.UUID,
    amount: Decimal | None = None,
    reason: str | None = None,
) -> BillPayment:
    """Refund a payment in full or part.

    Partial refunds must not over-refund: the amount taken back is capped at
    what was actually paid and not already refunded. Refunding past that would
    produce a credit the customer never lost.
    """
    payment = None
    for candidate in (bill.payments or []):
        if candidate.id == payment_id:
            payment = candidate
            break
    if payment is None:
        raise BillingError("Payment not found on this bill")
    if status_value(payment.status) == PaymentStatus.REFUNDED:
        raise BillingError("This payment is already fully refunded")
    if status_value(payment.status) != PaymentStatus.SUCCESS:
        raise BillingError(f"Cannot refund a payment in status {status_value(payment.status)}")

    already_refunded = _d(payment.refunded_amount)
    remaining = _d(payment.amount) - already_refunded
    requested = _money(_d(amount)) if amount is not None else remaining
    if requested <= 0:
        raise BillingError("Enter a refund amount")
    if requested > remaining:
        raise BillingError(
            f"Refund of ₹{requested} exceeds the remaining ₹{remaining}"
        )

    payment.refunded_amount = _money(already_refunded + requested)
    payment.refunded_at = _now()
    payment.status = (
        PaymentStatus.REFUNDED if payment.refunded_amount >= _d(payment.amount)
        else PaymentStatus.SUCCESS
    )
    # The payment's reference holds the reason: Bill has no notes column, so
    # the audit trail for *why* money moved back lives on the money record.
    if reason:
        payment.reference = f"[refund] {reason}"

    # Money back in changes what is owed.
    bill.paid_amount = _money(_d(bill.paid_amount) - requested)
    bill.change_amount = _money(max(_d(bill.paid_amount) - _d(bill.grand_total), Decimal("0")))
    if status_value(bill.status) == BillStatus.SETTLED:
        bill.status = BillStatus.REFUNDED

    await db.flush()
    return payment


# ─── Void ────────────────────────────────────────────────────────────────────

async def void_bill(
    db: AsyncSession, tenant_id: uuid.UUID, bill: Bill, reason: str | None = None
) -> Bill:
    """Void a bill.

    A bill with money already taken cannot be voided — that would erase a
    real transaction. Refund the payments first, then void.
    """
    cur = status_value(bill.status)
    if cur == BillStatus.VOID:
        raise BillingError("This bill is already void")
    if cur == BillStatus.SETTLED:
        raise BillingError("Settled bills cannot be voided; refund the payments first")
    bill.status = BillStatus.VOID
    bill.void_reason = reason
    await db.flush()
    return bill


# ─── Aggregate read for reporting ────────────────────────────────────────────

async def bill_counts(db: AsyncSession, tenant_id: uuid.UUID,
                      outlet_id: uuid.UUID | None = None) -> dict[str, int]:
    stmt = select(Bill.status, func.count(Bill.id)).where(
        Bill.tenant_id == tenant_id
    )
    if outlet_id:
        stmt = stmt.where(Bill.outlet_id == outlet_id)
    rows = (await db.execute(stmt.group_by(Bill.status))).all()
    out = {status_value(s): int(n or 0) for s, n in rows}
    return out


# ─── Shifts ──────────────────────────────────────────────────────────────────

async def open_shift(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    user_id: uuid.UUID,
    opening_cash: Decimal = Decimal("0"),
    shift_type: str = "MORNING",
    denominations: dict | None = None,
    notes: str | None = None,
) -> Shift:
    """Open a cashier shift with a float.

    One open shift per (outlet, cashier): allowing two would let a cashier
    close one at a clean balance and hide the other. Refused, not merged.
    """
    existing = await db.scalar(
        select(Shift).where(
            Shift.tenant_id == tenant_id,
            Shift.outlet_id == outlet_id,
            Shift.user_id == user_id,
            Shift.status == ShiftStatus.OPEN,
        )
    )
    if existing is not None:
        raise BillingError("This cashier already has an open shift")

    shift = Shift(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        user_id=user_id,
        shift_number=await allocate_bill_number(
            db, tenant_id, outlet_id, code=f"SH-{shift_type}"
        ),
        shift_type=shift_type,
        status=ShiftStatus.OPEN,
        opening_cash=_money(_d(opening_cash)),
        denominations=denominations or {},
        notes=notes,
        opened_at=_now(),
    )
    db.add(shift)
    await db.flush()
    return shift


async def load_shift(
    db: AsyncSession, tenant_id: uuid.UUID, shift_id: uuid.UUID
) -> Shift | None:
    """Fetch a shift with its cash movements eagerly loaded.

    Eager, not lazy — a lazy load during Pydantic serialisation would raise
    MissingGreenlet.
    """
    return (
        await db.execute(
            select(Shift)
            .options(selectinload(Shift.cash_movements))
            .where(Shift.id == shift_id, Shift.tenant_id == tenant_id)
        )
    ).scalars().first()


async def cash_movement(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    shift: Shift,
    movement_type: CashMovementType,
    amount: Decimal,
    *,
    reason: str | None = None,
    created_by: uuid.UUID | None = None,
) -> ShiftCashMovement:
    """Record cash moving in or out of the drawer.

    Paid-in cash is the only kind that is expected to grow the drawer, so the
    closing balance is opening + paid_in - paid_out + pickup - drop. Tracking
    each as its own movement is what makes that reconciliation auditable —
    updating a running total would lose the ability to explain it.
    """
    if status_value(shift.status) != ShiftStatus.OPEN:
        raise BillingError("Cannot record a cash movement on a closed shift")
    amt = _money(_d(amount))
    if amt <= 0:
        raise BillingError("Cash movement amount must be positive")

    movement = ShiftCashMovement(
        tenant_id=tenant_id,
        shift_id=shift.id,
        movement_type=movement_type,
        amount=amt,
        reason=reason,
        created_by=created_by,
    )
    db.add(movement)
    await db.flush()
    return movement


async def close_shift(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    shift: Shift,
    closing_cash_actual: Decimal,
    *,
    closed_by: uuid.UUID | None = None,
    denominations: dict | None = None,
    discrepancy_reason: str | None = None,
    discrepancy_approved_by: uuid.UUID | None = None,
) -> Shift:
    """Close a shift and reconcile the drawer.

    Expected = opening + cash paid in - paid out + pickup - drop. Comparing that
    to what is actually counted gives the discrepancy. A non-zero discrepancy is
    NOT an error — shortages happen — but it must be recorded and attributed,
    and it should be approved by someone other than the cashier.
    """
    if status_value(shift.status) != ShiftStatus.OPEN:
        raise BillingError("This shift is already closed")

    # Keyed by the enum member itself, not by its string form. status_value()
    # exists for loading rows from Postgres where the value is a bare str; here
    # the column was set in Python and is still an enum member, and indexing a
    # dict of enum keys with strings would silently miss every entry.
    def _member(value) -> CashMovementType:
        return value if isinstance(value, CashMovementType) \
            else CashMovementType(str(value))

    amounts = {t: Decimal("0") for t in CashMovementType}
    for movement in (shift.cash_movements or []):
        amounts[_member(movement.movement_type)] += _d(movement.amount)

    expected = (
        _d(shift.opening_cash)
        + amounts[CashMovementType.PAID_IN]
        - amounts[CashMovementType.PAID_OUT]
        + amounts[CashMovementType.PICKUP]
        - amounts[CashMovementType.DROP]
    )
    actual = _money(_d(closing_cash_actual))
    expected = _money(expected)

    shift.closing_cash_expected = expected
    shift.closing_cash_actual = actual
    shift.discrepancy = _money(actual - expected)
    shift.status = ShiftStatus.CLOSED
    shift.closed_at = _now()
    shift.closed_by = closed_by
    if denominations:
        shift.denominations = denominations
    if discrepancy_reason:
        shift.discrepancy_reason = discrepancy_reason
    if shift.discrepancy != 0 and discrepancy_approved_by is None:
        raise BillingError(
            f"Shift has a ₹{shift.discrepancy} discrepancy that requires approval"
        )
    shift.discrepancy_approved_by = discrepancy_approved_by
    await db.flush()
    return shift
