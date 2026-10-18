"""POS service logic — order construction, totals, lifecycle, numbering.

Totals math is copied from the monolith's ``order_service.recalculate_order``
byte-for-byte on purpose: subtotal = line gross + addon gross, and
grand_total = subtotal - discount_total + tax_total. Service charge is
deliberately excluded here and decided at bill time, so the POS's view of the
total matches the kitchen's and never drifts from the bill's.
"""
from __future__ import annotations

import enum
import uuid
from decimal import ROUND_HALF_UP, Decimal
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.pos.models import (
    NumberCounter,
    Order,
    OrderItem,
    OrderItemAddon,
    OrderItemCourse,
    OrderItemStatus,
    OrderStatus,
    status_value,
)
from src.services.pos.schemas import OrderLineCreate

COURSE_NAMES = {1: "Starters", 2: "Main course", 3: "Dessert"}


def _d(value) -> Decimal:
    """Coerce a DB-sourced value to Decimal without banker's-rounding drift.

    Numeric(12,2) comes back as Decimal already, but a float sneaking in from a
    payload would round the *wrong* way under Decimal(str(float)), so everything
    goes through str() first.
    """
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def load_order(
    db: AsyncSession, tenant_id: uuid.UUID, order_id: uuid.UUID
) -> Order | None:
    """Fetch an order with its lines and addons eagerly loaded.

    Eager here rather than lazy: this module's session runs with
    expire_on_commit=False and lazy loads would fire outside the request's
    async context, surfacing as MissingGreenlet during response serialisation.
    """
    from sqlalchemy.orm import selectinload

    return (
        await db.execute(
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.addons),
                selectinload(Order.courses),
            )
            .where(Order.id == order_id, Order.tenant_id == tenant_id)
        )
    ).scalars().first()


async def reload_order(db: AsyncSession, order: Order) -> Order:
    """Return ``order``'s row with items/addons/courses eagerly loaded.

    Needed after inserting lines into an order object that was constructed in
    Python rather than fetched — its ``items`` collection is empty and reading
    it would trigger a lazy load, which fails outside a synchronous context
    with MissingGreenlet. Every function that walks ``order.items`` takes a
    reloaded order, so this is the one place the graph gets re-read.
    """
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.addons),
            selectinload(Order.courses),
        )
        .where(Order.id == order.id)
    )
    return result.scalars().one()


def _line_total(line: OrderLineCreate) -> tuple[Decimal, Decimal]:
    """Return (subtotal_contribution, discount_amount) for one line.

    The client-supplied ``unit_price`` is authoritative — it is the price the
    POS displayed to the customer, which may predate a menu edit. We never
    re-price from the menu here: an order records what was sold.
    """
    addons = sum(
        (_d(a.price) * Decimal(int(a.qty or 1)) for a in line.addons),
        Decimal("0"),
    )
    gross = _d(line.unit_price) * Decimal(int(line.qty or 1)) + addons

    discount_amount = Decimal("0")
    if line.discount_pct:
        discount_amount = _money(gross * _d(line.discount_pct) / Decimal("100"))

    return _money(gross), discount_amount


async def add_lines(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order: Order,
    lines: list[OrderLineCreate],
) -> Order:
    """Append lines to a draft order, then recompute totals and courses."""
    for line in lines:
        gross, discount_amount = _line_total(line)
        item = OrderItem(
            tenant_id=tenant_id,
            order_id=order.id,
            menu_item_id=line.menu_item_id,
            variant_id=line.variant_id,
            combo_id=line.combo_id,
            item_name=line.item_name,
            variant_name=line.variant_name,
            unit_price=_money(_d(line.unit_price)),
            qty=int(line.qty or 1),
            status=OrderItemStatus.ORDERED,
            course_number=int(line.course_number or 1),
            notes=line.notes,
            discount_pct=line.discount_pct,
            discount_amount=discount_amount,
            tax_code_id=line.tax_code_id,
            tax_amount=_money(_d(line.tax_amount)),
            kitchen_station_id=line.kitchen_station_id,
            # total = gross - discount + tax, the same expression as the order's
            total=_money(gross - discount_amount + _d(line.tax_amount)),
        )
        db.add(item)
        await db.flush()
        for a in line.addons:
            db.add(OrderItemAddon(
                tenant_id=tenant_id,
                order_item_id=item.id,
                addon_id=a.addon_id,
                modifier_id=a.modifier_id,
                name=a.name,
                price=_money(_d(a.price)),
                qty=int(a.qty or 1),
            ))
        await db.flush()

    await _sync_position(db, tenant_id, order)
    # Lines were just inserted, so order.items is still empty in memory.
    # Re-read the graph before anything walks it, or the totals come out zero.
    order = await reload_order(db, order)
    await ensure_courses(db, tenant_id, order)
    await recalculate_order(db, order)
    return order


async def _sync_position(db: AsyncSession, tenant_id: uuid.UUID, order: Order) -> None:
    """Renumber lines 0..n-1 in insertion order.

    Presentation order is positional, so a deletion mid-order must not leave a
    gap that the KOT renders as a missing dish.
    """
    stmt = (
        select(OrderItem)
        .where(OrderItem.order_id == order.id, OrderItem.tenant_id == tenant_id)
        .order_by(OrderItem.created_at.asc(), OrderItem.id.asc())
    )
    for i, item in enumerate((await db.execute(stmt)).scalars().all()):
        if item.position != i:
            item.position = i
            await db.flush()


async def ensure_courses(db: AsyncSession, tenant_id: uuid.UUID, order: Order) -> None:
    """Maintain course bookkeeping rows for every course the order uses."""
    from sqlalchemy.orm import selectinload

    if not order.courses:
        order = (
            await db.execute(
                select(Order)
                .options(
                    selectinload(Order.items),
                    selectinload(Order.courses),
                )
                .where(Order.id == order.id)
            )
        ).scalars().one()

    existing = {c.course_number: c for c in (order.courses or [])}
    used = {
        (i.course_number or 1)
        for i in (order.items or [])
        if status_value(i.status) != OrderItemStatus.CANCELLED
    }

    for number in sorted(used):
        if number not in existing:
            course = OrderItemCourse(
                tenant_id=tenant_id,
                order_id=order.id,
                course_number=number,
                name=COURSE_NAMES.get(number),
                status="pending",
            )
            db.add(course)
            existing[number] = course

    for number, course in existing.items():
        if number not in used and course.status == "pending":
            await db.delete(course)


async def recalculate_order(db: AsyncSession, order: Order) -> Order:
    """Recompute the denormalised order totals from live lines."""
    subtotal = Decimal("0")
    discount_total = Decimal("0")
    tax_total = Decimal("0")

    for item in order.items or []:
        if status_value(item.status) == OrderItemStatus.CANCELLED:
            continue
        gross = _d(item.unit_price) * Decimal(int(item.qty or 1))
        addons_total = sum(
            (_d(a.price) * Decimal(int(a.qty or 1)) for a in (item.addons or [])),
            Decimal("0"),
        )
        subtotal += gross + addons_total
        discount_total += _d(item.discount_amount)
        tax_total += _d(item.tax_amount)

    order.subtotal = _money(subtotal)
    order.discount_total = _money(discount_total)
    order.tax_total = _money(tax_total)
    order.grand_total = _money(subtotal - discount_total + tax_total)
    await db.flush()
    return order


def item_count(order: Order) -> int:
    """Qty-weighted count of non-cancelled lines."""
    return sum(
        int(i.qty or 1) for i in (order.items or [])
        if status_value(i.status) != OrderItemStatus.CANCELLED
    )


def order_lines_payload(order: Order) -> list[dict]:
    """The per-line data an event consumer needs to act on this order.

    Self-contained on purpose: the kitchen must be able to build a KOT without
    calling back into pos, and without the menu — the menu may have changed in
    between, and the KOT must show what was ordered.
    """
    out = []
    for item in order.items or []:
        if status_value(item.status) == OrderItemStatus.CANCELLED:
            continue
        out.append({
            "item_id": str(item.id),
            "menu_item_id": str(item.menu_item_id) if item.menu_item_id else None,
            "name": item.item_name,
            "variant": item.variant_name,
            "qty": int(item.qty or 1),
            "notes": item.notes,
            "course_number": int(item.course_number or 1),
            # Without this the kitchen cannot route a line to its station and
            # every dish lands on one default station. It is the cashier's
            # choice at order time, not something the kitchen can infer.
            "station_id": str(item.kitchen_station_id) if item.kitchen_station_id else None,
            "addons": [
                {"name": a.name, "price": float(a.price), "qty": int(a.qty or 1)}
                for a in (item.addons or [])
            ],
        })
    return out


async def place_order(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order
) -> Order:
    """Move a draft to placed and stamp the time.

    Refuses an empty order: nothing to cook, nothing to bill, and the KOT
    consumer would happily create a blank ticket from it.
    """
    if status_value(order.status) != OrderStatus.DRAFT:
        raise ValueError(f"Cannot place an order in status {status_value(order.status)}")
    await recalculate_order(db, order)
    if not item_count(order):
        raise ValueError("Cannot place an order with no items")
    order.status = OrderStatus.PLACED
    order.placed_at = _now()
    await db.flush()
    return order


async def cancel_order(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order, reason: str | None = None
) -> Order:
    """Cancel an order and every line on it.

    Lines are marked individually rather than deleted, so the audit trail of
    what was ordered survives — deleting them would also make the bill
    impossible to explain afterwards.
    """
    current = status_value(order.status)
    if current in (OrderStatus.SETTLED, OrderStatus.CANCELLED):
        raise ValueError(f"Cannot cancel an order in status {current}")
    for item in order.items or []:
        if status_value(item.status) != OrderItemStatus.CANCELLED:
            item.status = OrderItemStatus.CANCELLED
    order.status = OrderStatus.CANCELLED
    order.notes = f"{order.notes or ''}\n[cancelled: {reason or 'no reason'}]".strip()
    await db.flush()
    return order


async def allocate_order_number(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID,
    code: str | None = None,
) -> str:
    """Allocate the next order number for this outlet, monthly-resetting.

    Mirrors the monolith's ``number_series`` behaviour, but backed by this
    service's own counter table — pos cannot read the organization service's
    database. The number is allocated inside the caller's transaction, and the
    counter row is locked for its duration, so two concurrent cashiers at one
    outlet cannot receive the same number.

    ``code`` is the outlet's short code for the prefix (e.g. "MAIN"). It is
    passed in rather than looked up, because outlets belong to another service
    and pos has no table for them. Callers that do not know the code get
    "MAIN", the same fallback the monolith uses.
    """
    now = _now()
    key = f"order:{outlet_id}:{now:%Y-%m}"
    prefix = f"ORD-{(code or 'MAIN').upper()}-{now:%y%m}-"

    counter = (
        await db.execute(
            select(NumberCounter)
            .where(
                NumberCounter.tenant_id == tenant_id,
                NumberCounter.key == key,
            )
            .with_for_update()
        )
    ).scalars().first()

    if counter is None:
        counter = NumberCounter(
            tenant_id=tenant_id,
            key=key,
            prefix=prefix,
            next_number=1,
        )
        db.add(counter)
        await db.flush()
        # Re-select under lock now that the row exists — otherwise a concurrent
        # allocator could create its own row and both would start at 1.
        counter = (
            await db.execute(
                select(NumberCounter).where(
                    NumberCounter.tenant_id == tenant_id,
                    NumberCounter.key == key,
                )
                .with_for_update()
            )
        ).scalars().one()

    number = counter.next_number
    counter.next_number = number + 1
    await db.flush()
    return f"{counter.prefix}{str(number).zfill(4)}"


async def next_token_number(
    db: AsyncSession, tenant_id: uuid.UUID, outlet_id: uuid.UUID
) -> int:
    """Next queue token for this outlet, 1-based and monotonic within a day."""
    today_start = datetime.now(timezone.utc).date()
    today = datetime(today_start.year, today_start.month, today_start.day, tzinfo=timezone.utc)
    top = await db.scalar(
        select(func.max(Order.token_number)).where(
            Order.tenant_id == tenant_id,
            Order.outlet_id == outlet_id,
            Order.token_number.is_not(None),
            Order.placed_at >= today,
        )
    )
    return int(top or 0) + 1


async def count_orders(
    db: AsyncSession, tenant_id: uuid.UUID, *, outlet_id=None,
    status_filter=None, table_id=None, active_only=False,
) -> int:
    stmt = select(func.count(Order.id)).where(Order.tenant_id == tenant_id)
    if outlet_id:
        stmt = stmt.where(Order.outlet_id == outlet_id)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if table_id:
        stmt = stmt.where(Order.table_id == table_id)
    if active_only:
        stmt = stmt.where(Order.status.not_in([OrderStatus.SETTLED, OrderStatus.CANCELLED]))
    return int(await db.scalar(stmt) or 0)


class PosError(Exception):
    """A rejected state transition. The API layer maps this to 409."""


def _require_transition(order: Order, to: OrderStatus, allowed: set[OrderStatus]) -> None:
    current = status_value(order.status)
    if current not in allowed:
        raise PosError(f"Cannot move an order from {current} to {to.value}")


# Transitions the kitchen/billing feedback drives. Deliberately narrow: an
# order cannot jump straight from placed to settled, which would skip the
# kitchen step and bill a meal that was never prepared.
ALLOWED_FROM_PLACED = {OrderStatus.IN_KITCHEN, OrderStatus.PREPARING, OrderStatus.CANCELLED}
ALLOWED_FROM_IN_KITCHEN = {OrderStatus.PREPARING, OrderStatus.PARTIALLY_SERVED, OrderStatus.SERVED, OrderStatus.CANCELLED}
ALLOWED_FROM_PREPARING = {OrderStatus.PREPARING, OrderStatus.SERVED, OrderStatus.CANCELLED}
ALLOWED_FROM_SERVED = {OrderStatus.BILL_REQUESTED, OrderStatus.SETTLED}
ALLOWED_FROM_BILL_REQUESTED = {OrderStatus.SETTLED}


def _allowed_to(order: Order) -> set[OrderStatus]:
    cur = status_value(order.status)
    return {
        OrderStatus.PLACED: ALLOWED_FROM_PLACED,
        OrderStatus.IN_KITCHEN: ALLOWED_FROM_IN_KITCHEN,
        OrderStatus.PREPARING: ALLOWED_FROM_PREPARING,
        OrderStatus.SERVED: ALLOWED_FROM_SERVED,
        OrderStatus.BILL_REQUESTED: ALLOWED_FROM_BILL_REQUESTED,
    }.get(OrderStatus(cur), set())


async def update_order_status(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order, to: OrderStatus
) -> Order:
    """Apply a validated status transition."""
    cur = status_value(order.status)
    if cur == to.value:
        return order
    _require_transition(order, to, _allowed_to(order))
    order.status = to
    if to in (OrderStatus.SETTLED, OrderStatus.CANCELLED) and not order.closed_at:
        order.closed_at = _now()
    await db.flush()
    return order
