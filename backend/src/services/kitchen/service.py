"""Kitchen service logic — KOT creation, status transitions, numbering.

The kitchen is a pure consumer of the POS's events. It never calls back into
pos to build a ticket: the ``order.placed`` payload is deliberately
self-contained with snapshotted lines, so the KOT is correct even if the
menu or the order changes after the fact.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.kitchen.models import (
    KOT,
    KOTItem,
    KOTItemStatus,
    KOTStatus,
    KOTStatusLog,
    KitchenStation,
    NumberCounter,
    status_value,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid_or_none(value) -> uuid.UUID | None:
    """Parse a UUID out of event data, tolerating anything malformed.

    Event payloads are JSON, so every UUID arrives as a string. Assigning a
    string to a ``UUID`` column would raise a statement error on insert
    ("invalid input syntax for type uuid") — the first order.placed would then
    fail every time and the kitchen would never receive a ticket.
    """
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


class KitchenError(Exception):
    """A rejected KOT state transition. The API layer maps this to 409."""


# The pass moves a ticket forward only. Jumping a ticket from pending straight
# to ready would record food as done that was never started, which corrupts
# every prep-time metric downstream.
ALLOWED_FROM_PENDING = {KOTStatus.ACKNOWLEDGED, KOTStatus.PREPARING, KOTStatus.READY, KOTStatus.CANCELLED}
ALLOWED_FROM_ACKNOWLEDGED = {KOTStatus.PREPARING, KOTStatus.READY, KOTStatus.CANCELLED}
ALLOWED_FROM_PREPARING = {KOTStatus.PREPARING, KOTStatus.READY, KOTStatus.SERVED, KOTStatus.CANCELLED}
ALLOWED_FROM_READY = {KOTStatus.SERVED}
ALLOWED_FROM_SERVED = set()


def _allowed_to(kot: KOT) -> set[KOTStatus]:
    cur = status_value(kot.status)
    return {
        KOTStatus.PENDING: ALLOWED_FROM_PENDING,
        KOTStatus.ACKNOWLEDGED: ALLOWED_FROM_ACKNOWLEDGED,
        KOTStatus.PREPARING: ALLOWED_FROM_PREPARING,
        KOTStatus.READY: ALLOWED_FROM_READY,
        KOTStatus.SERVED: ALLOWED_FROM_SERVED,
    }.get(KOTStatus(cur), set())


async def load_kot(db: AsyncSession, tenant_id: uuid.UUID, kot_id: uuid.UUID) -> KOT | None:
    """Fetch a ticket with its items eagerly loaded.

    Eager, not lazy: the session runs with expire_on_commit=False and a lazy
    load would fire outside the request's async context, surfacing as
    MissingGreenlet when Pydantic serialises the response.
    """
    return (
        await db.execute(
            select(KOT)
            .options(selectinload(KOT.items), selectinload(KOT.status_logs))
            .where(KOT.id == kot_id, KOT.tenant_id == tenant_id)
        )
    ).scalars().first()


async def load_station(
    db: AsyncSession, tenant_id: uuid.UUID, station_id: uuid.UUID
) -> KitchenStation | None:
    return await db.scalar(
        select(KitchenStation).where(
            KitchenStation.id == station_id,
            KitchenStation.tenant_id == tenant_id,
        )
    )


async def open_ticket_count(db: AsyncSession, tenant_id: uuid.UUID, station_id: uuid.UUID) -> int:
    """Live load on one station — the number the pass screen shows."""
    return int(await db.scalar(
        select(func.count(KOT.id)).where(
            KOT.tenant_id == tenant_id,
            KOT.station_id == station_id,
            KOT.status.not_in([KOTStatus.SERVED, KOTStatus.CANCELLED]),
        )
    ) or 0)


async def station_load_map(
    db: AsyncSession, tenant_id: uuid.UUID, station_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """Open-ticket counts for many stations in ONE query.

    Called while iterating a station list, so a per-station count would be
    an N+1 — a real problem on a board that polls every couple of seconds.
    """
    if not station_ids:
        return {}
    rows = (
        await db.execute(
            select(KOT.station_id, func.count(KOT.id))
            .where(
                KOT.tenant_id == tenant_id,
                KOT.station_id.in_(station_ids),
                KOT.status.not_in([KOTStatus.SERVED, KOTStatus.CANCELLED]),
            )
            .group_by(KOT.station_id)
        )
    ).all()
    return {station_id: int(count or 0) for station_id, count in rows}


async def create_kots_from_order_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    order_id: str,
    order_number: str | None,
    outlet_id: str,
    table_id: str | None,
    table_name: str | None = None,
    order_type: str | None,
    covers: int = 1,
    lines: list[dict],
) -> list[KOT]:
    """Turn an order.placed payload into KOT tickets, grouped by station.

    Grouping by ``station_id`` means a curry dish and a fried dish from the
    same order become two tickets, so two stations can work one order in
    parallel — firing the whole order to a single station would serialise it.
    Lines with no station go to the outlet's default station, and if there is
    none at all we skip them rather than inventing a station out of nothing.

    The payload carries snapshotted names and addons, so this never touches
    the menu service. That is deliberate: the menu may change between the sale
    and the cook, and the KOT must show what was ordered.
    """
    outlet = _uuid_or_none(outlet_id)
    order = _uuid_or_none(order_id)
    table = _uuid_or_none(table_id)
    if outlet is None or order is None:
        return []

    stations = {
        s.id: s
        for s in (
            await db.execute(
                select(KitchenStation).where(
                    KitchenStation.tenant_id == tenant_id,
                    KitchenStation.outlet_id == outlet,
                    KitchenStation.is_active.is_(True),
                )
            )
        ).scalars().all()
    }
    if not stations:
        return []

    # Bucket lines by station. A missing or unknown station falls back to the
    # lexicographically first station for this outlet, which is deterministic
    # so a replayed event produces the same grouping.
    default_id = min(stations)
    by_station: dict[uuid.UUID, list[dict]] = {}
    for line in lines or []:
        # Parse defensively: a malformed id in one line must not abort the
        # whole ticket build. It falls back to the default station instead.
        candidate = _uuid_or_none(line.get("station_id"))
        target = candidate if candidate in stations else default_id
        by_station.setdefault(target, []).append(line)

    created: list[KOT] = []
    for station_id, bucket in by_station.items():
        station = stations[station_id]
        # One ticket per course, so paced dine-in service does not dump a
        # starter and a dessert on the pass at the same moment.
        by_course: dict[int, list[dict]] = {}
        for line in bucket:
            by_course.setdefault(int(line.get("course_number") or 1), []).append(line)

        for course_number in sorted(by_course):
            course_lines = by_course[course_number]
            # Idempotency. Bus delivery is at-least-once, so this event can
            # arrive more than once — once live, again after an unacked
            # redelivery. Without this check a replay prints the same dish a
            # second time, which the kitchen reads as two separate orders.
            # The bus dedupes only within this process; a duplicate delivered
            # after a restart is invisible to it, so the guard must live here.
            existing = await db.scalar(
                select(KOT.id).where(
                    KOT.tenant_id == tenant_id,
                    KOT.order_id == order,
                    KOT.station_id == station_id,
                    KOT.course_number == course_number,
                )
            )
            if existing:
                continue
            kot = KOT(
                tenant_id=tenant_id,
                outlet_id=outlet,
                order_id=order,
                order_number=order_number,
                table_id=table,
                table_name=table_name,
                station_id=station_id,
                kot_number=await allocate_kot_number(db, tenant_id, station.id),
                status=KOTStatus.PENDING,
                course_number=course_number,
                fired_at=_now(),
                covers=covers,
                order_type=order_type,
            )
            db.add(kot)
            await db.flush()

            for position, line in enumerate(course_lines):
                db.add(KOTItem(
                    tenant_id=tenant_id,
                    kot_id=kot.id,
                    order_item_id=line.get("item_id"),
                    menu_item_id=line.get("menu_item_id"),
                    name=line.get("name") or "Unlabelled item",
                    variant_name=line.get("variant"),
                    station_id=target,
                    qty=int(line.get("qty") or 1),
                    position=position,
                    status=KOTItemStatus.PENDING,
                    course_number=int(line.get("course_number") or 1),
                    notes=line.get("notes"),
                    modifiers=line.get("addons") or [],
                ))
            await db.flush()
            db.add(KOTStatusLog(
                tenant_id=tenant_id,
                kot_id=kot.id,
                from_status=None,
                to_status=status_value(KOTStatus.PENDING),
                reason="ticket created",
            ))
            await db.flush()
            created.append(kot)
    return created


async def allocate_kot_number(
    db: AsyncSession, tenant_id: uuid.UUID, station: KitchenStation
) -> str:
    """Next KOT number for this station, monthly-resetting.

    Same shape as pos's order numbering: kitchen owns its ticket sequence in
    its own database and cannot read the organization service's series. The
    counter row is locked for the duration of the transaction, so two
    concurrent fires cannot receive the same number.
    """
    now = _now()
    key = f"kot:{station.id}:{now:%Y-%m}"
    prefix = f"KOT-{now:%y%m}-{str(station.id)[:4].upper()}-"

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
        # concurrent firer could create its own row and both start at 1.
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


async def update_kot_status(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    kot: KOT,
    to: KOTStatus,
    *,
    changed_by: uuid.UUID | None = None,
    reason: str | None = None,
) -> KOT:
    """Move a ticket forward, recording the transition and stamping time."""
    cur = status_value(kot.status)
    if cur == to.value:
        return kot
    allowed = _allowed_to(kot)
    if to not in allowed:
        raise KitchenError(f"Cannot move a KOT from {cur} to {to.value}")

    stamp = _now()
    if to == KOTStatus.ACKNOWLEDGED and not kot.acknowledged_at:
        kot.acknowledged_at = stamp
    elif to == KOTStatus.READY and not kot.ready_at:
        kot.ready_at = stamp
    elif to == KOTStatus.SERVED and not kot.served_at:
        kot.served_at = stamp

    kot.status = to
    db.add(KOTStatusLog(
        tenant_id=tenant_id,
        kot_id=kot.id,
        from_status=cur,
        to_status=status_value(to),
        changed_by=changed_by,
        reason=reason,
    ))
    await db.flush()
    return kot


async def update_kot_item_status(
    db: AsyncSession, tenant_id: uuid.UUID, kot: KOT,
    item_id: uuid.UUID, to: KOTItemStatus,
) -> KOTItem:
    """Move one component. Lets the pass mark a single dish ready early."""
    item = None
    for candidate in (await _items(kot)):
        if candidate.id == item_id:
            item = candidate
            break
    if item is None:
        raise KitchenError("KOT item not found")
    item.status = to
    if to == KOTItemStatus.PREPARING and not item.prepared_at:
        item.prepared_at = _now()
    await db.flush()
    return item


async def _items(kot: KOT) -> list[KOTItem]:
    return list(kot.items or [])


async def cancel_kots_for_order(
    db: AsyncSession, tenant_id: uuid.UUID, order_id: str, reason: str | None = None
) -> int:
    """Cancel every open ticket for an order.

    Called when the POS cancels an order — food already on the pass must stop,
    or the kitchen keeps cooking a meal nobody is paying for. Tickets already
    served stay as-is: the food left, and cancelling the record would erase
    what actually happened.
    """
    if not tenant_id or not order_id:
        return 0
    order = uuid.UUID(order_id)
    kots = (
        await db.execute(
            select(KOT)
            .options(selectinload(KOT.items))
            .where(
                KOT.tenant_id == tenant_id,
                KOT.order_id == order,
                KOT.status.not_in([KOTStatus.SERVED, KOTStatus.CANCELLED]),
            )
        )
    ).scalars().all()

    for kot in kots:
        cur = status_value(kot.status)
        kot.status = KOTStatus.CANCELLED
        for item in (kot.items or []):
            if status_value(item.status) != KOTItemStatus.CANCELLED:
                item.status = KOTItemStatus.CANCELLED
        db.add(KOTStatusLog(
            tenant_id=tenant_id,
            kot_id=kot.id,
            from_status=cur,
            to_status=status_value(KOTStatus.CANCELLED),
            reason=reason or "order cancelled",
        ))
    if kots:
        await db.flush()
    return len(kots)
