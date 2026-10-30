"""Delivery event consumers — react to the order lifecycle.

Before this module the service *declared* its bus subscriptions in the registry
but had no handlers: a delivery order placed in pos never opened a dispatch,
and a cancelled order's open delivery stayed live on the board forever. These
consumers close that gap. They are registered on the shared bus singleton at
import time; ``main.py`` imports this module for that side effect.

House rules observed:
  * handlers get their own session from the service's module-level ``db``
    (never a request session — they run outside any request);
  * idempotency is structural (a guard query on the unique tenant+order index)
    ON TOP of the durable ``consumed_events`` ledger gate in the consumer loop
    — the ledger dedupes across restarts, the guard dedupes the in-ledger miss;
  * no cross-service DB reads: order information (outlet, order type) comes
    ONLY from the event payload; a bare ``order_id`` UUID is what we store;
  * the outbox row is written in the SAME transaction as the domain change,
    committed together; then a local publish runs in-process handlers;
  * a handler that fails rolls back, logs, and raises — a dead consumer must
    not look alive, so the bus can redeliver rather than silently drop it.
"""
from __future__ import annotations

import logging
import uuid

from src.services.delivery import service as svc
from src.services.delivery.models import Delivery
from src.services.delivery.outbox import record_event
from src.services.event_bus.bus import Event, bus

logger = logging.getLogger("delivery.events")


def _handler_db():
    """A session owned by an event handler, not by a request."""
    from src.services.delivery.main import db as _db

    return _db.session_factory()


def _coerce_uuid(value) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _tenant(event: Event) -> uuid.UUID | None:
    """Tenant id from an event, always as a UUID (the bus may send a str)."""
    value = event.tenant_id
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


# ─── Consumers ────────────────────────────────────────────────────────────────

@bus.on("order.placed")
async def _on_order_placed(event: Event) -> None:
    """Open an unassigned delivery for a delivery-type order.

    Only ``order_type == "delivery"`` orders produce a dispatch — dine-in and
    takeaway orders have no delivery leg, and opening a row for them would
    clutter the board with work that never ships. The outlet comes from the
    payload (or the event envelope); we never read the pos service's database.
    """
    data = event.data or {}
    if data.get("order_type") != "delivery":
        return
    order_id = _coerce_uuid(data.get("order_id"))
    if order_id is None:
        return
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    if tenant is None:
        return
    outlet = _coerce_uuid(event.outlet_id) or _coerce_uuid(data.get("outlet_id"))

    db = _handler_db()
    try:
        # Structural idempotency: the unique (tenant, order) index means at
        # most one delivery per order. If one already exists we do nothing —
        # a redelivered order.placed must not open a second dispatch.
        existing = await svc.find_delivery_for_order(db, tenant, order_id)
        if existing is not None:
            return

        delivery = await svc.create_delivery(db, tenant, order_id, outlet_id=outlet)

        # outbox delivery.created in the SAME transaction as the row, so both
        # commit or roll back together.
        event_out = Event(
            type="delivery.created",
            tenant_id=tenant,
            outlet_id=outlet,
            data={
                "delivery_id": str(delivery.id),
                "order_id": str(order_id),
                "outlet_id": str(outlet) if outlet else None,
                "zone_id": None,
                "status": "assigned",
            },
            source_service="delivery",
        )
        await record_event(db, type="delivery.created",
                           data=event_out.data, tenant_id=tenant,
                           outlet_id=outlet, event_id=event_out.event_id)
        await db.commit()
        await bus.publish(event_out, local=True)
        logger.info("order.placed %s -> pending delivery %s",
                    order_id, delivery.id)
    except Exception:
        await db.rollback()
        logger.exception("delivery: order.placed handler failed for order %s",
                         order_id)
        raise
    finally:
        await db.close()


@bus.on("order.cancelled")
async def _on_order_cancelled(event: Event) -> None:
    """Cancel the order's open delivery, if one is still open.

    A closed delivery (delivered, or already cancelled) is left alone — a late
    cancel arriving after the delivery finished is a no-op, not an error. The
    payload carries no outlet, so the outlet is resolved from the delivery row
    we already own.
    """
    data = event.data or {}
    order_id = _coerce_uuid(data.get("order_id"))
    if order_id is None:
        return
    tenant = _coerce_uuid(event.tenant_id) or _coerce_uuid(data.get("tenant_id"))
    if tenant is None:
        return
    reason = data.get("reason")

    db = _handler_db()
    try:
        delivery: Delivery | None = await svc.find_delivery_for_order(db, tenant, order_id)
        if delivery is None:
            # No delivery was ever opened for this order (a non-delivery type,
            # or the order.placed event was never received). Nothing to cancel.
            return
        if not await svc.cancel(db, tenant, delivery, reason=reason):
            # Closed already — a redelivery of order.cancelled is a no-op.
            return

        # outbox delivery.cancelled in the SAME transaction as the state move.
        event_out = Event(
            type="delivery.cancelled",
            tenant_id=tenant,
            outlet_id=delivery.outlet_id,
            data={
                "delivery_id": str(delivery.id),
                "order_id": str(order_id),
                "reason": reason or "order cancelled",
            },
            source_service="delivery",
        )
        await record_event(db, type="delivery.cancelled",
                           data=event_out.data, tenant_id=tenant,
                           outlet_id=delivery.outlet_id, event_id=event_out.event_id)
        await db.commit()
        await bus.publish(event_out, local=True)
        logger.info("order.cancelled %s -> delivery %s cancelled",
                    order_id, delivery.id)
    except Exception:
        await db.rollback()
        logger.exception("delivery: order.cancelled handler failed for order %s",
                         order_id)
        raise
    finally:
        await db.close()
