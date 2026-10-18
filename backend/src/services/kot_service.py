"""KOT / kitchen service — firing, station routing, status transitions.

Design notes:

- Firing is explicit. A captain builds a running order, then fires courses.
  One Order can produce many KOTs over its lifetime.
- One KOT per station per fire. Items are grouped by their station so each
  ticket goes to exactly one screen/printer.
- KOTItem snapshots name/variant/modifiers so later menu edits don't rewrite
  what the kitchen originally received.
- OrderItem and KOTItem statuses are kept in sync — when a KOT line is marked
  ready, the backing order item moves to READY; served likewise.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import (
    KOT,
    KOTItem,
    KOTPriority,
    KOTStatus,
    KitchenStation,
    Order,
    OrderItem,
    OrderItemStatus,
    OrderStatus,
    TableStatus,
)
from src.services.number_series import allocate_number
from src.utils.enums import enum_value

# Which KOT statuses imply the backing order-item status
_ITEM_STATUS_FOR_KOT = {
    "pending": OrderItemStatus.SENT_TO_KITCHEN,
    "acknowledged": OrderItemStatus.SENT_TO_KITCHEN,
    "preparing": OrderItemStatus.PREPARING,
    "ready": OrderItemStatus.READY,
    "served": OrderItemStatus.SERVED,
    "cancelled": OrderItemStatus.CANCELLED,
}

# Allowed KOT status transitions (forward-only, with cancel from anywhere)
_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"acknowledged", "preparing", "ready", "served", "cancelled"},
    "acknowledged": {"preparing", "ready", "served", "cancelled"},
    "preparing": {"ready", "served", "cancelled"},
    "ready": {"served", "cancelled"},
    "served": set(),
    "cancelled": set(),
}


# Kept as an alias so existing callers keep working; new code should import
# `enum_value` from src.utils.enums directly.
_status_value = enum_value


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_order(db: AsyncSession, tenant_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = (
        await db.execute(
            select(Order)
            .options(
                selectinload(Order.items).selectinload(OrderItem.addons),
                selectinload(Order.kots).selectinload(KOT.items),
                selectinload(Order.table),
            )
            .where(Order.id == order_id, Order.tenant_id == tenant_id)
        )
    ).scalars().first()
    if order is None:
        raise ValueError("Order not found")
    return order


async def _station_load(db: AsyncSession, station_id: uuid.UUID) -> int:
    """How many live tickets a station already has — used for backlog checks."""
    stmt = (
        select(KOT.id)
        .where(
            KOT.station_id == station_id,
            KOT.status.in_([KOTStatus.PENDING, KOTStatus.ACKNOWLEDGED, KOTStatus.PREPARING]),
        )
    )
    return len((await db.execute(stmt)).scalars().all())


async def _resolve_priority(order: Order, requested: str | None) -> KOTPriority:
    if requested:
        try:
            return KOTPriority(requested)
        except ValueError:
            pass
    # A long-waiting table is treated as RUSH so the kitchen sees it bubbling up
    if order.created_at:
        try:
            created = order.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            waited_minutes = (datetime.now(timezone.utc) - created).total_seconds() / 60
            if waited_minutes > 45:
                return KOTPriority.RUSH
        except Exception:
            pass
    return KOTPriority.NORMAL


async def fire_kot(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order_id: uuid.UUID,
    *,
    course_numbers: list[int] | None = None,
    order_item_ids: list[uuid.UUID] | None = None,
    priority: str | None = None,
    notes: str | None = None,
) -> list[KOT]:
    """Send unfired order items to the kitchen, grouped into one KOT per station.

    Returns the KOTs created. The caller commits.
    """
    order = await _get_order(db, tenant_id, order_id)

    if _status_value(order.status) in ("settled", "cancelled"):
        raise ValueError(f"Cannot fire a {_status_value(order.status)} order")

    # Only items that are ordered and not already on a ticket can fire
    fireable = [
        item for item in order.items
        if _status_value(item.status) == OrderItemStatus.ORDERED.value
    ]

    if order_item_ids:
        wanted = {str(i) for i in order_item_ids}
        fireable = [i for i in fireable if str(i.id) in wanted]
    if course_numbers:
        wanted_courses = set(course_numbers)
        fireable = [i for i in fireable if i.course_number in wanted_courses]

    if not fireable:
        return []

    resolved_priority = await _resolve_priority(order, priority)

    # Group by station. Items with no station land in a shared "unassigned" bucket.
    buckets: dict[uuid.UUID | None, list[OrderItem]] = {}
    for item in fireable:
        buckets.setdefault(item.kitchen_station_id, []).append(item)

    created: list[KOT] = []

    for station_id, items in buckets.items():
        kot = KOT(
            tenant_id=tenant_id,
            outlet_id=order.outlet_id,
            order_id=order.id,
            table_id=order.table_id,
            station_id=station_id,
            kot_number=await allocate_number(db, tenant_id, "kot", order.outlet_id),
            status=KOTStatus.PENDING,
            priority=resolved_priority,
            course_number=items[0].course_number,
            notes=notes,
            fired_at=_now_iso(),
            printed_count=0,
        )
        db.add(kot)
        await db.flush()

        for item in items:
            # Snapshot the modifiers/addons as the kitchen should see them
            modifier_snapshot = [
                {
                    "name": a.name,
                    "price": float(a.price or 0),
                    "qty": int(a.qty or 1),
                }
                for a in item.addons or []
            ]

            db.add(KOTItem(
                tenant_id=tenant_id,
                kot_id=kot.id,
                order_item_id=item.id,
                menu_item_id=item.menu_item_id,
                variant_id=item.variant_id,
                name=item.item_name,
                variant_name=item.variant_name,
                qty=int(item.qty or 1),
                status=KOTStatus.PENDING.value,
                course_number=item.course_number,
                notes=item.notes,
                modifiers=modifier_snapshot,
            ))

            item.status = OrderItemStatus.SENT_TO_KITCHEN

        created.append(kot)

    # The order is now in the kitchen's hands
    if _status_value(order.status) in (OrderStatus.DRAFT.value, OrderStatus.PLACED.value):
        order.status = OrderStatus.IN_KITCHEN

    return created


def can_transition(current: str, target: str) -> bool:
    return target in _ALLOWED_TRANSITIONS.get(current, set())


async def set_kot_status(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    kot_id: uuid.UUID,
    target: str,
    *,
    changed_by: uuid.UUID | None = None,
    reason: str | None = None,
) -> KOT:
    """Move a KOT through its lifecycle, cascading to items and the order."""
    kot = (
        await db.execute(
            select(KOT)
            .options(selectinload(KOT.items).selectinload(KOTItem.order_item))
            .where(KOT.id == kot_id, KOT.tenant_id == tenant_id)
        )
    ).scalars().first()
    if kot is None:
        raise ValueError("KOT not found")

    current = _status_value(kot.status)
    if not can_transition(current, target):
        raise ValueError(f"Cannot move KOT from {current} to {target}")

    now = _now_iso()
    kot.status = KOTStatus(target)

    if target == "acknowledged" and not kot.acknowledged_at:
        kot.acknowledged_at = now
    elif target == "preparing":
        if not kot.acknowledged_at:
            kot.acknowledged_at = now
    elif target == "ready":
        kot.ready_at = now
    elif target == "served":
        kot.served_at = now
    elif target == "cancelled":
        if reason:
            kot.notes = (kot.notes or "") + f"\n[CANCELLED] {reason}".rstrip()

    # Cascade to the ticket's lines and their backing order items
    item_status = _ITEM_STATUS_FOR_KOT.get(target)
    if item_status is not None:
        for kot_item in kot.items or []:
            if _status_value(kot_item.status) in ("served", "cancelled"):
                continue
            kot_item.status = target
            if target == "preparing" and not kot_item.prepared_at:
                kot_item.prepared_at = None
            elif target in ("ready", "served"):
                kot_item.prepared_at = now
            if kot_item.order_item is not None:
                kot_item.order_item.status = item_status

    db.add(_status_log(
        tenant_id, kot, current, target, changed_by, reason
    ))

    await _sync_order_after_kitchen_change(db, kot.order_id)

    return kot


def _status_log(
    tenant_id: uuid.UUID,
    kot: KOT,
    from_status: str,
    to_status: str,
    changed_by: uuid.UUID | None,
    reason: str | None,
):
    from src.models import KOTStatusLog
    return KOTStatusLog(
        tenant_id=tenant_id,
        kot_id=kot.id,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        reason=reason,
    )


async def set_kot_item_status(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    kot_item_id: uuid.UUID,
    target: str,
    *,
    changed_by: uuid.UUID | None = None,
    reason: str | None = None,
) -> KOTItem:
    """Mark a single kitchen line, then roll the parent KOT up to match."""
    kot_item = (
        await db.execute(
            select(KOTItem)
            .options(selectinload(KOTItem.kot).selectinload(KOT.items))
            .where(KOTItem.id == kot_item_id, KOTItem.tenant_id == tenant_id)
        )
    ).scalars().first()
    if kot_item is None:
        raise ValueError("KOT item not found")

    current = _status_value(kot_item.status)
    if current == "served" or current == "cancelled":
        raise ValueError(f"Item is already {current}")

    kot_item.status = target
    if target in ("ready", "served"):
        kot_item.prepared_at = _now_iso()

    order_item_status = _ITEM_STATUS_FOR_KOT.get(target)
    if order_item_status and kot_item.order_item is not None:
        kot_item.order_item.status = order_item_status

    kot = kot_item.kot
    if kot is not None:
        # Roll the ticket up: served only when every line is served
        line_statuses = {_status_value(i.status) for i in kot.items or []}
        if line_statuses and line_statuses <= {"served"}:
            kot.status = KOTStatus.SERVED
            kot.served_at = _now_iso()
        elif "ready" in line_statuses and not (line_statuses - {"ready", "served"}):
            if _status_value(kot.status) != "served":
                kot.status = KOTStatus.READY
                kot.ready_at = _now_iso()
        elif "preparing" in line_statuses and _status_value(kot.status) in ("pending", "acknowledged"):
            kot.status = KOTStatus.PREPARING

    await _sync_order_after_kitchen_change(db, kot.order_id if kot else None)
    return kot_item


async def _sync_order_after_kitchen_change(
    db: AsyncSession, order_id: uuid.UUID | None
) -> None:
    """Recompute the order's kitchen-facing status from its items."""
    if order_id is None:
        return

    order = (
        await db.execute(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.id == order_id)
        )
    ).scalars().first()
    if order is None:
        return

    current = _status_value(order.status)
    if current in (OrderStatus.SETTLED.value, OrderStatus.CANCELLED.value):
        return

    statuses = [_status_value(i.status) for i in order.items or []]
    if not statuses:
        return

    live = [s for s in statuses if s != OrderItemStatus.CANCELLED.value]
    if not live:
        order.status = OrderStatus.CANCELLED
        return

    if all(s == OrderItemStatus.SERVED.value for s in live):
        order.status = OrderStatus.SERVED
    elif any(s == OrderItemStatus.READY.value for s in live):
        order.status = OrderStatus.PARTIALLY_SERVED
    elif any(s in (OrderItemStatus.PREPARING.value, OrderItemStatus.SENT_TO_KITCHEN.value) for s in live):
        order.status = OrderStatus.PREPARING
    elif current == OrderStatus.DRAFT.value and live:
        order.status = OrderStatus.PLACED


async def mark_kot_printed(db: AsyncSession, kot: KOT) -> KOT:
    kot.printed_count = int(kot.printed_count or 0) + 1
    await db.flush()
    return kot


async def cancel_fired_item(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order_item_id: uuid.UUID,
    *,
    changed_by: uuid.UUID | None = None,
    reason: str | None = None,
) -> None:
    """Cancel an item already in the kitchen — the kitchen must see the void."""
    order_item = (
        await db.execute(
            select(OrderItem)
            .options(selectinload(OrderItem.kot_items))
            .where(OrderItem.id == order_item_id, OrderItem.tenant_id == tenant_id)
        )
    ).scalars().first()
    if order_item is None:
        raise ValueError("Order item not found")

    order_item.status = OrderItemStatus.CANCELLED

    for kot_item in order_item.kot_items or []:
        if _status_value(kot_item.status) in ("served", "cancelled"):
            continue
        kot_item.status = KOTStatus.CANCELLED.value
        kot = (
            await db.execute(
                select(KOT)
                .options(selectinload(KOT.items))
                .where(KOT.id == kot_item.kot_id)
            )
        ).scalars().first()
        if kot is not None and _status_value(kot.status) not in ("served", "cancelled"):
            remaining = {
                _status_value(i.status) for i in kot.items or []
            } - {"cancelled"}
            if remaining:
                # Still has live lines — keep the ticket open so the kitchen
                # continues prepping what's left
                kot.notes = (kot.notes or "") + f"\n[ITEM VOIDED] {order_item.item_name}".rstrip()
            else:
                kot.status = KOTStatus.CANCELLED
                kot.notes = (kot.notes or "") + f"\n[CANCELLED] {reason or 'item voided'}".rstrip()
                from src.models import KOTStatusLog
                db.add(KOTStatusLog(
                    tenant_id=tenant_id,
                    kot_id=kot.id,
                    from_status="pending",
                    to_status="cancelled",
                    changed_by=changed_by,
                    reason=reason or "item voided",
                ))

    await _sync_order_after_kitchen_change(db, order_item.order_id)
