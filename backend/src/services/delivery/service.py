"""Delivery service logic — dispatch, boys, zones, and the status state machine.

Pure business rules that raise ``DeliveryError``; the API layer maps that to
409/404. No session commits happen here — the caller (api.py) owns the
transaction so a domain write and its outbox row commit or roll back
together.

The status state machine is the heart of dispatch:

    assigned -> delivering -> delivered
    assigned -> cancelled
    delivering -> cancelled

Terminal states (delivered, cancelled) take no further moves. The move set is
driven by ``_ALLOWED_FROM``; anything not listed is rejected, so a delivered
or cancelled delivery can never be re-opened or re-transitioned.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.delivery.models import (
    Delivery,
    DeliveryBoy,
    DeliveryStatus,
    DeliveryStatusLog,
    DeliveryZone,
    status_value,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class DeliveryError(Exception):
    """A rejected delivery operation. The API layer maps this to 409 or 400."""


# The move set. A state absent from the left side is terminal.
_ALLOWED_FROM: dict[str, set[str]] = {
    status_value(DeliveryStatus.ASSIGNED): {
        status_value(DeliveryStatus.DELIVERING),
        status_value(DeliveryStatus.CANCELLED),
    },
    status_value(DeliveryStatus.DELIVERING): {
        status_value(DeliveryStatus.DELIVERED),
        status_value(DeliveryStatus.CANCELLED),
    },
}


def is_open(value: object) -> bool:
    """Whether a status is still live (a boy could still be carrying it)."""
    return status_value(value) in (
        status_value(DeliveryStatus.ASSIGNED),
        status_value(DeliveryStatus.DELIVERING),
    )


def _log(db: AsyncSession, delivery: Delivery, from_status: str | None,
         to_status: str, note: str | None = None) -> None:
    """One append-only audit row for a transition."""
    db.add(DeliveryStatusLog(
        delivery_id=delivery.id,
        from_status=from_status,
        to_status=to_status,
        at=_now(),
        note=note,
    ))


# ─── Loading ─────────────────────────────────────────────────────────────────

async def load_boy(db: AsyncSession, tenant_id: uuid.UUID,
                   boy_id: uuid.UUID) -> DeliveryBoy | None:
    return await db.scalar(
        select(DeliveryBoy).where(
            DeliveryBoy.id == boy_id,
            DeliveryBoy.tenant_id == tenant_id,
        )
    )


async def load_zone(db: AsyncSession, tenant_id: uuid.UUID,
                    zone_id: uuid.UUID) -> DeliveryZone | None:
    return await db.scalar(
        select(DeliveryZone).where(
            DeliveryZone.id == zone_id,
            DeliveryZone.tenant_id == tenant_id,
        )
    )


async def load_delivery(db: AsyncSession, tenant_id: uuid.UUID,
                        delivery_id: uuid.UUID) -> Delivery | None:
    """Fetch a delivery with its boy and zone eager-loaded.

    Eager, not lazy: the session runs with expire_on_commit=False and a lazy
    load would fire outside the request's async context, surfacing as
    MissingGreenlet when Pydantic serialises the response.
    """
    return await db.scalar(
        select(Delivery)
        .options(
            selectinload(Delivery.boy),
            selectinload(Delivery.zone),
        )
        .where(
            Delivery.id == delivery_id,
            Delivery.tenant_id == tenant_id,
        )
    )


async def find_delivery_for_order(db: AsyncSession, tenant_id: uuid.UUID,
                                  order_id: uuid.UUID) -> Delivery | None:
    """The one delivery for an order (enforced unique by uq_delivery_order)."""
    return await db.scalar(
        select(Delivery)
        .options(selectinload(Delivery.boy), selectinload(Delivery.zone))
        .where(
            Delivery.tenant_id == tenant_id,
            Delivery.order_id == order_id,
        )
        .limit(1)
    )


# ─── Create / assign ─────────────────────────────────────────────────────────

async def create_delivery(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    order_id: uuid.UUID,
    *,
    outlet_id: uuid.UUID | None = None,
    zone_id: uuid.UUID | None = None,
    boy_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> Delivery:
    """Create the dispatch for an order, optionally with a boy attached.

    With a boy: the delivery is ASSIGNED immediately and stamped
    ``assigned_at`` — the caller emits ``delivery.assigned``. Without: it sits
    pending on the board (ASSIGNED, no boy) — the caller emits
    ``delivery.created``. Both open with a null->assigned audit row.
    """
    delivery = Delivery(
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        order_id=order_id,
        zone_id=zone_id,
        boy_id=None,
        status=DeliveryStatus.ASSIGNED,
        notes=notes,
    )
    db.add(delivery)
    await db.flush()

    if boy_id is not None:
        boy = await load_boy(db, tenant_id, boy_id)
        if boy is None:
            raise DeliveryError("Delivery boy not found")
        await attach_boy(db, delivery, boy)
    else:
        _log(db, delivery, None, status_value(DeliveryStatus.ASSIGNED))
    await db.flush()
    return delivery


async def attach_boy(db: AsyncSession, delivery: Delivery,
                     boy: DeliveryBoy, note: str | None = None) -> None:
    """Attach a boy to a delivery: set the boy, mark ASSIGNED, audit it."""
    if not is_open(delivery.status):
        raise DeliveryError(
            f"Cannot assign a boy to a {status_value(delivery.status)} delivery"
        )
    from_status = status_value(delivery.status) if delivery.boy_id else None
    delivery.boy_id = boy.id
    delivery.status = DeliveryStatus.ASSIGNED
    delivery.assigned_at = _now()
    if note is not None:
        delivery.notes = note
    _log(db, delivery, from_status, status_value(DeliveryStatus.ASSIGNED),
         note=note)
    await db.flush()


# ─── State machine ───────────────────────────────────────────────────────────

async def transition(db: AsyncSession, tenant_id: uuid.UUID, delivery: Delivery,
                     to_status: str, note: str | None = None) -> None:
    """Move a delivery to ``to_status`` per the dispatch state machine.

    Rejected moves (unknown state, same state, or an illegal jump) raise
    ``DeliveryError``. A legal move stamps the timestamp / reason columns and
    writes the audit row in the same transaction.
    """
    current = status_value(delivery.status)
    to_status = status_value(to_status)

    if to_status not in (
        status_value(DeliveryStatus.DELIVERING),
        status_value(DeliveryStatus.DELIVERED),
        status_value(DeliveryStatus.CANCELLED),
    ):
        raise DeliveryError(f"Unknown delivery status: {to_status}")
    if to_status == current:
        raise DeliveryError(f"Delivery is already {current}")
    if to_status not in _ALLOWED_FROM.get(current, set()):
        raise DeliveryError(
            f"Cannot move a delivery from {current} to {to_status}"
        )

    delivery.status = DeliveryStatus(to_status)
    if to_status == status_value(DeliveryStatus.DELIVERED):
        delivery.delivered_at = _now()
    if to_status == status_value(DeliveryStatus.CANCELLED):
        delivery.cancel_reason = note or "cancelled"
    _log(db, delivery, current, to_status, note=note)
    await db.flush()


async def cancel(db: AsyncSession, tenant_id: uuid.UUID, delivery: Delivery,
                 reason: str | None = None) -> bool:
    """Cancel an open delivery. Returns False when there is nothing to cancel.

    A closed delivery (delivered / already cancelled) is left alone — a
    late ``order.cancelled`` arriving after the delivery completed is a
    no-op, not an error.
    """
    if not is_open(delivery.status):
        return False
    await transition(db, tenant_id, delivery,
                     status_value(DeliveryStatus.CANCELLED), note=reason)
    return True
