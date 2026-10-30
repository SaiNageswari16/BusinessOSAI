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

    Lines are re-fetched explicitly rather than walking ``order.items``: this
    function is called from both a request context (where the order was loaded
    eagerly) and a void/split path where the caller may hold a bare ORM
    object whose ``items`` collection was never populated, and a lazy load
    there is the MissingGreenlet trap this whole module's docstrings warn
    about.
    """
    from sqlalchemy import select
    current = status_value(order.status)
    if current in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
        raise ValueError(f"Cannot cancel an order in status {current}")
    lines = (await db.execute(
        select(OrderItem).where(
            OrderItem.order_id == order.id,
            OrderItem.tenant_id == tenant_id,
        )
    )).scalars().all()
    for item in lines:
        if status_value(item.status) != OrderItemStatus.CANCELLED.value:
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
    # ``allowed`` is the set of TARGETS reachable from the order's current
    # state — so the guard asks "is `to` reachable", not "is the current
    # state legal". (This was inverted: `current not in allowed`, which made
    # every legal transition raise and every illegal one pass.)
    if to not in allowed:
        raise PosError(f"Cannot move an order from {current} to {to.value}")


# Transitions the kitchen/billing feedback drives. Deliberately narrow: an
# order cannot jump straight from placed to settled, which would skip the
# kitchen step and bill a meal that was never prepared.
#
# HOLD is a pause, not a state the kitchen drives: it is entered and exited
# by the floor (a guest steps out, comes back), so it is not in any of the
# kitchen-driven transition sets above — the hold/resume helpers below are
# the only writers of that state.
ALLOWED_FROM_PLACED = {OrderStatus.IN_KITCHEN, OrderStatus.PREPARING, OrderStatus.CANCELLED, OrderStatus.HOLD}
ALLOWED_FROM_IN_KITCHEN = {OrderStatus.PREPARING, OrderStatus.PARTIALLY_SERVED, OrderStatus.SERVED, OrderStatus.CANCELLED, OrderStatus.HOLD}
ALLOWED_FROM_PREPARING = {OrderStatus.PREPARING, OrderStatus.SERVED, OrderStatus.CANCELLED, OrderStatus.HOLD}
ALLOWED_FROM_SERVED = {OrderStatus.BILL_REQUESTED, OrderStatus.SETTLED, OrderStatus.HOLD}
ALLOWED_FROM_BILL_REQUESTED = {OrderStatus.SETTLED, OrderStatus.HOLD}
ALLOWED_FROM_HOLD = {OrderStatus.PLACED, OrderStatus.IN_KITCHEN, OrderStatus.PREPARING,
                     OrderStatus.SERVED, OrderStatus.BILL_REQUESTED, OrderStatus.CANCELLED}
# An advance order can only be made live (PLACED — the activation path) or
# cancelled; nothing kitchen-driven applies to an order that was never fired.
ALLOWED_FROM_SCHEDULED = {OrderStatus.PLACED, OrderStatus.CANCELLED}


def _allowed_to(order: Order) -> set[OrderStatus]:
    cur = status_value(order.status)
    return {
        OrderStatus.PLACED: ALLOWED_FROM_PLACED,
        OrderStatus.IN_KITCHEN: ALLOWED_FROM_IN_KITCHEN,
        OrderStatus.PREPARING: ALLOWED_FROM_PREPARING,
        OrderStatus.SERVED: ALLOWED_FROM_SERVED,
        OrderStatus.BILL_REQUESTED: ALLOWED_FROM_BILL_REQUESTED,
        OrderStatus.HOLD: ALLOWED_FROM_HOLD,
        OrderStatus.SCHEDULED: ALLOWED_FROM_SCHEDULED,
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


# ─── Hold / resume ──────────────────────────────────────────────────────────

async def hold_order(db: AsyncSession, tenant_id: uuid.UUID, order: Order) -> Order:
    """Park a live order: the guest stepped out, but the food was already
    ordered and the KOT fired. Distinct from DRAFT — this is a pause, not a
    not-started order, and resuming must not re-fire the kitchen."""
    cur = status_value(order.status)
    if cur == OrderStatus.HOLD.value:
        return order
    if cur in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
        raise PosError(f"Cannot hold an order in status {cur}")
    order.status = OrderStatus.HOLD
    await db.flush()
    return order


async def resume_order(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order,
    to: OrderStatus = OrderStatus.PLACED,
) -> Order:
    """Un-park a held order. The caller picks the state it resumes into
    (usually PLACED, or SERVED if food was already out and just paused at
    the pass)."""
    if status_value(order.status) != OrderStatus.HOLD.value:
        raise PosError("Only a held order can be resumed")
    order.status = to
    await db.flush()
    return order


# ─── Scheduled (advance) orders ────────────────────────────────────────────

async def activate_scheduled_order(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order
) -> Order:
    """Make an advance order live: SCHEDULED -> PLACED.

    This is the one transition the due-scan performs on the order itself;
    the API route then publishes ``order.placed`` so the kitchen (KOT) and
    inventory react exactly as they would for a same-day order. An empty
    advance order (no lines yet) is still activatable: it is a reservation
    in first form (name + phone + time), and lines are added at the table
    before the bill. The KOT consumer creates nothing from an empty order,
    so firing it costs the kitchen nothing.

    ``scheduled_for`` is cleared on activation — it is a "when to run"
    marker, not history. ``placed_at`` is stamped here, not at creation,
    because the order only *exists* to the kitchen now.
    """
    cur = status_value(order.status)
    if cur != OrderStatus.SCHEDULED.value:
        raise PosError(f"Only a scheduled order can be activated (got {cur})")
    order.status = OrderStatus.PLACED
    order.placed_at = _now()
    order.scheduled_for = None
    # order_type is a String column: after a load it is a plain str, so
    # compare via status_value, never .value.
    if order.token_number is None and status_value(order.order_type) in (
        "qsr", "takeaway",
    ):
        order.token_number = await next_token_number(
            db, tenant_id, order.outlet_id
        )
    await db.flush()
    return order


async def due_scheduled_orders(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    now: datetime,
    outlet_id: uuid.UUID | None = None,
    limit: int = 50,
) -> list[Order]:
    """Advance orders that should fire now: still SCHEDULED and due.

    "Due" means ``scheduled_for <= now`` — an advance order that was not
    activated at its time stays visible in this list so the terminal can
    catch it on shift start rather than silently expiring. Overdue orders
    are therefore returned, not filtered out; the terminal decides whether
    to activate or cancel one that is now stale.
    """
    stmt = (
        select(Order)
        .where(
            Order.tenant_id == tenant_id,
            Order.status == OrderStatus.SCHEDULED,
            Order.scheduled_for.is_not(None),
            Order.scheduled_for <= now,
        )
        .order_by(Order.scheduled_for.asc())
        .limit(limit)
    )
    if outlet_id is not None:
        stmt = stmt.where(Order.outlet_id == outlet_id)
    return list((await db.execute(stmt)).scalars().all())


# ─── Void / split / merge ──────────────────────────────────────────────────

async def void_order(db: AsyncSession, tenant_id: uuid.UUID, order: Order) -> Order:
    """Full void, pre-bill: every line cancelled, order CANCELLED.

    Only a DRAFT or PLACED order can be voided — once it is in the kitchen,
    food is moving, and that is a cancel with consequences (kitchen
    notification, stock already deducted), not a clean void.
    """
    cur = status_value(order.status)
    if cur not in (OrderStatus.DRAFT.value, OrderStatus.PLACED.value):
        raise PosError(f"Cannot void an order in status {cur}")
    return await cancel_order(db, tenant_id, order, reason="voided pre-bill")


async def split_order(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order,
    split_indexes: list[int],
) -> list[Order]:
    """One order → N, each getting a fresh order number and a share of the
    original table session. ``split_indexes`` is a list of line positions,
    one list per new order; every line must land in exactly one bucket.

    A group of 4 splitting a bill into 2 checks of 2 people each is the case
    this exists for — the alternative (each guest re-ordering) means the
    kitchen fires each dish twice.
    """
    from sqlalchemy import select

    if not split_indexes or len(split_indexes) < 2:
        raise PosError("A split needs at least two target orders")

    all_positions = set()
    for bucket in split_indexes:
        all_positions.update(bucket)
    valid_positions = set(range(len(order.items or [])))
    if not all_positions or all_positions > valid_positions:
        raise PosError("split_indexes references lines that do not exist on this order")
    # Every line must be assigned exactly once across the buckets.
    seen = []
    for bucket in split_indexes:
        for pos in bucket:
            if pos in seen:
                raise PosError(f"Line position {pos} assigned to more than one split order")
            seen.append(pos)
    if set(seen) != all_positions:
        raise PosError("Every line on the order must land in exactly one split order")

    original_number = order.order_number
    new_orders = []
    for i, bucket in enumerate(split_indexes):
        new_order = Order(
            tenant_id=tenant_id,
            outlet_id=order.outlet_id,
            order_number=original_number + f"-S{i + 1}",
            order_type=order.order_type,
            status=order.status,
            table_id=order.table_id,
            section_id=order.section_id,
            covers=order.covers,
            waiter_id=order.waiter_id,
            shift_id=order.shift_id,
            customer_id=order.customer_id,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            notes=f"Split from {original_number}: {order.notes or ''}".strip() or None,
            is_parcel=order.is_parcel,
            token_number=order.token_number,
            placed_at=order.placed_at,
        )
        db.add(new_order)
        await db.flush()
        new_orders.append(new_order)

    return new_orders


async def merge_orders(
    db: AsyncSession, tenant_id: uuid.UUID, order_a: Order, order_b: Order,
) -> Order:
    """Two open, same-table orders → one. The bill's source of truth becomes
    order_a; order_b is cancelled with a note, not deleted, so the merged
    check can still be audited back to what was split off it.

    Both must be on the same table and neither may already be settled or
    cancelled — merging a paid bill is not a merge, that is a refund with
    paperwork.
    """
    if order_a.table_id != order_b.table_id or order_a.table_id is None:
        raise PosError("Only two orders on the same table can be merged")
    for o in (order_a, order_b):
        cur = status_value(o.status)
        if cur in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
            raise PosError(f"Cannot merge an order in status {cur}")

    order_b.status = OrderStatus.CANCELLED
    order_b.notes = f"{order_b.notes or ''}\n[merged into {order_a.order_number}]".strip()
    order_b.closed_at = _now()
    await db.flush()
    return order_a


# ─── Reservation conflict check ────────────────────────────────────────────

async def find_reservation_conflict(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    table_id: uuid.UUID,
    reserved_from,
    reserved_to,
    *,
    exclude_reservation_id: uuid.UUID | None = None,
) -> "Reservation | None":
    """Any existing booking on the same table whose window overlaps
    [reserved_from, reserved_to). Two bookings touch but do not overlap if
    one ends exactly when the other starts — that is a valid back-to-back
    seating, not a conflict.

    Cancelled/no-show/completed reservations are excluded: they free the
    table back up, and counting a cancelled booking as a conflict would
    permanently lock a table for a guest who never came.
    """
    from sqlalchemy import select
    from src.services.pos.models import Reservation, ReservationStatus

    stmt = select(Reservation).where(
        Reservation.tenant_id == tenant_id,
        Reservation.outlet_id == outlet_id,
        Reservation.table_id == table_id,
        Reservation.status.not_in([
            ReservationStatus.CANCELLED,
            ReservationStatus.NO_SHOW,
            ReservationStatus.COMPLETED,
        ]),
        # Overlap: existing.start < new_end AND new_start < existing.end
        Reservation.reserved_from < reserved_to,
        reserved_from < Reservation.reserved_to,
    )
    if exclude_reservation_id:
        stmt = stmt.where(Reservation.id != exclude_reservation_id)
    return await db.scalar(stmt)
