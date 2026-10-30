"""Organization event consumers — automatic table lifecycle.

Before this module the table board only moved when a person called
``PUT /tables/{id}/status`` (the old POS integration). The pos service now
publishes ``table_session.opened`` / ``table_session.closed`` /
``order.placed`` / ``bill.paid`` and nothing here was listening, so the
floor plan froze the moment a guest sat down. These consumers close that
gap: occupancy now follows the session lifecycle, not a human's memory.

Registered on the shared bus singleton at import time; ``main.py`` imports
this module for that side effect.

House rules observed:
  * handlers get their own session from the service's module-level ``db``
    (never a request session — they run outside any request);
  * every table write goes through ``record_event`` (the outbox row commits
    in the same transaction), so the table.status.changed event is durable
    per tenant+outlet;
  * idempotency is structural: the target status is compared against the
    current one and a no-op leaves the table alone — a redelivered event
    cannot churn the board or double-emit;
  * no cross-service reads: the payloads carry ``table_id``/``outlet_id``;
    we only touch this service's own ``restaurant_tables``;
  * a handler failure rolls back, logs, and propagates — the bus catches
    and logs it, so a dead consumer does not look alive.
"""
from __future__ import annotations

import enum
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.organization.models import RestaurantTable, TableStatus
from src.services.organization.outbox import record_event

logger = logging.getLogger("organization.events")


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.organization.main import db as _db

    return _db.session_factory()


def _coerce_uuid(value) -> uuid.UUID | None:
    """Parse a UUID from event data without raising on bad input."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _tenant(event: Event) -> uuid.UUID | None:
    """Tenant id from an event, always as a UUID.

    The bus serialises tenant_id as a string across processes; dispatch
    within one process keeps the UUID. Accept both, degrade to a skipped
    event on a malformed value.
    """
    return (
        _coerce_uuid(event.tenant_id)
        or _coerce_uuid((event.data or {}).get("tenant_id"))
    )


def _status_value(value: object) -> str:
    """Plain string for a status however it was obtained (enum or loaded str)."""
    return value.value if isinstance(value, enum.Enum) else str(value)


async def _find_table(
    db: AsyncSession,
    tenant: uuid.UUID,
    table_id: uuid.UUID,
    outlet_id: uuid.UUID | None,
) -> RestaurantTable | None:
    """The table row, tenant-scoped — and outlet-scoped when a key is
    available. A table belongs to exactly one outlet, so the outlet check
    is belt-and-braces; it degrades to tenant-only when the payload has no
    outlet, never to a cross-tenant read."""
    stmt = select(RestaurantTable).where(
        RestaurantTable.tenant_id == tenant,
        RestaurantTable.id == table_id,
    )
    if outlet_id:
        stmt = stmt.where(RestaurantTable.outlet_id == outlet_id)
    return await db.scalar(stmt)


async def _move_table(
    event: Event, to: TableStatus, reason: str
) -> None:
    """One table write in one session: find, guard, write, outbox, commit.

    Every consumer runs through this so they keep the house shape — own
    session, structural guard, commit/rollback, log-and-raise. The
    compare-then-write in ``_set_table_status`` is the idempotency layer:
    a redelivery whose target already holds moves nothing and emits no
    event.
    """
    data = event.data or {}
    table_id = _coerce_uuid(data.get("table_id"))
    tenant = _tenant(event)
    if table_id is None or tenant is None:
        return
    outlet_id = (
        _coerce_uuid(event.outlet_id)
        or _coerce_uuid(data.get("outlet_id"))
    )

    db = _handler_db()
    try:
        table = await _find_table(db, tenant, table_id, outlet_id)
        if table is None:
            # Unknown table for this tenant (foreign payload, or a deleted
            # table): nothing to keep coherent, and a redelivery would find
            # the same thing. Log and move on — one bad table must not wedge
            # the bus.
            logger.info(
                "organization: table %s not found for tenant %s; skipping %s",
                table_id, tenant, reason,
            )
            return
        cur = _status_value(table.status)
        target = _status_value(to)
        if cur == target:
            return  # structural guard: already in the target state
        table.status = to
        await record_event(
            db,
            type="table.status.changed",
            tenant_id=tenant,
            outlet_id=table.outlet_id,
            data={
                "table_id": str(table.id),
                "from": cur,
                "to": target,
                "reason": reason,
            },
        )
        await db.commit()
        logger.info(
            "organization: table %s %s -> %s (%s)",
            table_id, cur, target, reason,
        )
    except Exception:
        await db.rollback()
        logger.exception(
            "organization: table move to %s failed for table %s",
            _status_value(to), table_id,
        )
        raise
    finally:
        await db.close()


# ─── Consumers ────────────────────────────────────────────────────────────────


@bus.on("table_session.opened")
async def _on_table_session_opened(event: Event) -> None:
    """A session opened at this table — it is occupied.

    The PRIMARY path for a table becoming occupied: pos publishes it when a
    dine-in order (or a waitlist seating) starts the occupancy record.
    """
    await _move_table(event, TableStatus.OCCUPIED, "table_session.opened")


@bus.on("table_session.closed")
async def _on_table_session_closed(event: Event) -> None:
    """A session closed — the table is free again.

    The PRIMARY path for a table coming back free. pos publishes it when a
    session is closed directly, and its own bill.paid consumer re-emits it
    when a settled bill closes the order's session.
    """
    await _move_table(event, TableStatus.FREE, "table_session.closed")


@bus.on("order.placed")
async def _on_order_placed(event: Event) -> None:
    """A dine-in order landed on a table — it is occupied.

    Acts only on ``order_type == "dine_in"`` with a ``table_id``: a
    takeaway or delivery order has no table to occupy, and those payloads
    carry no table key, so they degrade to a no-op by construction. This
    is the belt for the session's suspenders — a dine-in order that placed
    without an explicit session open still keeps the board coherent.
    """
    data = event.data or {}
    if str(data.get("order_type", "")).lower() != "dine_in":
        return
    await _move_table(event, TableStatus.OCCUPIED, "order.placed")


@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """A settled bill — a safety net for the table coming back free.

    The PRIMARY free path is ``table_session.closed`` (pos's bill.paid
    consumer closes the session and publishes it). This handler only acts
    when the settled payload carries a resolvable table key; today the
    pinned bill.paid contract has no table key, so on the live fleet this
    is a logged no-op — it keeps the board coherent if the payload ever
    grows a table key and a session-close is lost.
    """
    data = event.data or {}
    if str(data.get("status", "")).lower() != "settled":
        return
    if _coerce_uuid(data.get("table_id")) is None:
        # No table to resolve here: table_session.closed owns this bill's
        # table lifecycle. Debug only — logging every bill.paid would turn
        # the floor into a firehose.
        logger.debug(
            "organization: bill.paid %s carries no table key; "
            "relying on table_session.closed", data.get("bill_id"),
        )
        return
    await _move_table(event, TableStatus.FREE, "bill.paid (safety net)")
