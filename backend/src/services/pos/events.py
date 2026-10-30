"""POS event consumers — feedback from kitchen, billing and delivery.

Before this module the POS declared its bus subscriptions in the registry but
had no handlers: ``kot.served`` never advanced the order, ``bill.paid`` never
settled it or closed its table session, and a delivered takeaway order sat
stuck in KITCHEN forever. These consumers close that gap. They are registered
on the shared bus singleton at import time; ``main.py`` imports this module
for that side effect.

House rules observed:
  * handlers get their own session from the service's module-level ``db``
    (never a request session — they run outside any request);
  * idempotency is structural: the state machine in ``service.py`` only lets
    an order advance when the transition is legal, so a redelivered event is
    a no-op rather than a double-advance;
  * no cross-service reads: the payload carries the ids, and everything else
    is looked up in this service's own tables;
  * when a handler changes something, its event is written to the outbox in
    the SAME transaction as the domain change, so the relay delivers it even
    if the bus is down;
  * a handler that fails rolls back, logs, and propagates — bus.py catches
    and logs it, so a wedged consumer does not look healthy.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.event_bus.bus import Event, bus
from src.services.pos.models import (
    Order,
    OrderStatus,
    OrderType,
    TableSession,
    TableSessionStatus,
    status_value,
)
from src.services.pos import service as svc
from src.services.pos.outbox import record_event

logger = logging.getLogger("pos.events")


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _stamp() -> datetime:
    return datetime.now(timezone.utc)


def _handler_db() -> AsyncSession:
    """A session owned by an event handler, not by a request."""
    from src.services.pos.main import db as _db

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

    The bus serialises tenant_id as a string across processes; dispatch within
    one process keeps the UUID. Accept both, degrade to a skipped event on a
    malformed value.
    """
    value = _coerce_uuid(event.tenant_id) or _coerce_uuid((event.data or {}).get("tenant_id"))
    return value


async def _load_order(
    db: AsyncSession, tenant_id: uuid.UUID, order_id: uuid.UUID
) -> Order | None:
    """The order with its graph eagerly loaded, tenant-scoped.

    Returns None when the order belongs to another tenant (or does not exist):
    a foreign event is simply not our business, so the handler is a no-op.
    """
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.tenant_id == tenant_id)
    )
    order = result.scalars().first()
    if order is None:
        return None
    return await svc.reload_order(db, order)


async def _advance_order(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order, to: OrderStatus
) -> None:
    """Move the order to ``to`` if — and only if — the state machine allows it,
    and publish the change through the outbox in the same transaction.

    The legality check on ``_allowed_to`` is the structural idempotency layer:
    once the order has reached ``to`` (or passed it), the target is no longer
    reachable and a redelivered event does nothing. ``from`` is stamped from
    the status BEFORE the write, for the payload's audit trail.
    """
    cur = status_value(order.status)
    if cur == to.value:
        return
    if to not in svc._allowed_to(order):
        logger.info(
            "pos: order %s is %s; %s transition not allowed, skipping",
            order.id, cur, to.value,
        )
        return
    before = await svc.update_order_status(db, tenant_id, order, to)
    await record_event(
        db,
        type="order.status.changed",
        tenant_id=tenant_id,
        outlet_id=before.outlet_id,
        data={
            "order_id": str(before.id),
            "order_number": before.order_number,
            "from": cur,
            "to": status_value(before.status),
        },
    )


async def _close_session_for_order(
    db: AsyncSession, tenant_id: uuid.UUID, order: Order
) -> TableSession | None:
    """Close this order's open table session and emit the close event.

    An already-closed session is a no-op, so a redelivered ``bill.paid``
    cannot double-close. The close is written to the outbox in the same
    transaction as the status change.
    """
    session = await db.scalar(
        select(TableSession).where(
            TableSession.tenant_id == tenant_id,
            TableSession.order_id == order.id,
            TableSession.status == TableSessionStatus.ACTIVE,
        )
    )
    if session is None:
        return None
    session.status = TableSessionStatus.CLOSED
    session.ended_at = _stamp()
    await record_event(
        db,
        type="table_session.closed",
        tenant_id=tenant_id,
        outlet_id=session.outlet_id,
        data={
            # Both key spellings: this service has historically published
            # "session_id", the pinned contract says "table_session_id", and
            # organization accepts whichever is present.
            "session_id": str(session.id),
            "table_session_id": str(session.id),
            "table_id": str(session.table_id),
            "order_id": str(order.id),
        },
    )
    return session


# ─── Consumers ────────────────────────────────────────────────────────────────


@bus.on("kot.served")
async def _on_kot_served(event: Event) -> None:
    """Kitchen confirms the food was served — advance the order to SERVED.

    Idempotent: an order already at (or past) SERVED cannot legally move to
    SERVED again, so a redelivery is a no-op by the state machine itself.
    """
    data = event.data or {}
    tenant = _tenant(event)
    order_id = _coerce_uuid(data.get("order_id"))
    if tenant is None or order_id is None:
        return
    db = _handler_db()
    try:
        order = await _load_order(db, tenant, order_id)
        if order is None:
            logger.info(
                "pos: kot.served for order %s unknown to tenant %s; ignoring",
                order_id, tenant,
            )
            return
        await _advance_order(db, tenant, order, OrderStatus.SERVED)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("pos: kot.served handler failed for order %s", order_id)
        raise
    finally:
        await db.close()


@bus.on("bill.paid")
async def _on_bill_paid(event: Event) -> None:
    """A settled bill — settle the order and free its table.

    Only acts on settled bills that carry an order_id: a cash bill without an
    order (walk-in, counter) has nothing here to settle. The table session
    close emits ``table_session.closed`` in the same transaction, which the
    organization service consumes to flip the table back to FREE.
    """
    data = event.data or {}
    if str(data.get("status", "")).lower() != "settled":
        return
    order_id = _coerce_uuid(data.get("order_id"))
    if order_id is None:
        return
    tenant = _tenant(event)
    if tenant is None:
        return
    db = _handler_db()
    try:
        order = await _load_order(db, tenant, order_id)
        if order is None:
            logger.info(
                "pos: bill.paid for order %s unknown to tenant %s; ignoring",
                order_id, tenant,
            )
            return
        await _advance_order(db, tenant, order, OrderStatus.SETTLED)
        session = await _close_session_for_order(db, tenant, order)
        await db.commit()
        logger.info(
            "pos: bill %s settled order %s%s",
            data.get("bill_id"), order_id,
            f" and closed table session {session.id}" if session else "",
        )
    except Exception:
        await db.rollback()
        logger.exception("pos: bill.paid handler failed for order %s", order_id)
        raise
    finally:
        await db.close()


@bus.on("delivery.delivered")
async def _on_delivery_delivered(event: Event) -> None:
    """The delivery boy marked the order delivered — serve it.

    Only delivery-type orders reach here in practice (the delivery service
    creates deliveries from ``order.placed`` for order_type=delivery), but
    the type check keeps a stray payload honest: a dine-in order cannot be
    "delivered", and an order that has already settled or cancelled is a
    no-op by the state machine.
    """
    data = event.data or {}
    order_id = _coerce_uuid(data.get("order_id"))
    tenant = _tenant(event)
    if tenant is None or order_id is None:
        return
    db = _handler_db()
    try:
        order = await _load_order(db, tenant, order_id)
        if order is None:
            logger.info(
                "pos: delivery.delivered for order %s unknown to tenant %s; ignoring",
                order_id, tenant,
            )
            return
        if status_value(order.order_type) != OrderType.DELIVERY.value:
            logger.info(
                "pos: delivery.delivered for non-delivery order %s (%s); ignoring",
                order_id, status_value(order.order_type),
            )
            return
        await _advance_order(db, tenant, order, OrderStatus.SERVED)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("pos: delivery.delivered handler failed for order %s", order_id)
        raise
    finally:
        await db.close()
