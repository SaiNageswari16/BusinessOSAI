"""Delivery service models — dispatch boards, delivery boys, zones, status logs.

Owns ``restaurantos_delivery``. Cross-service columns carry NO foreign key:

  * ``order_id``  — pos service
  * ``outlet_id`` — organization service

``Delivery.order_id`` is deliberately a bare UUID snapshot, not a foreign key.
The pos service owns orders; if an order were ever deleted the dispatch record
must still show which order the delivery served. Order *information* (outlet,
type) never comes from a cross-service read — it arrives on the event payload
that created this delivery (``order.placed``).

``boy_id`` and ``zone_id`` DO carry foreign keys: they point at this service's
own tables (``delivery_boys``, ``delivery_zones``), so they stay inside the
boundary the split exists to protect. Deleting a boy or zone that a delivery
still references must not orphan the dispatch row, so both are
``ON DELETE SET NULL``.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("delivery")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DeliveryStatus(str, enum.Enum):
    """Lifecycle of a delivery.

    ASSIGNED -> DELIVERING -> DELIVERED, with any open state able to move to
    CANCELLED. Terminal states (DELIVERED, CANCELLED) take no further moves.
    """
    ASSIGNED = "assigned"
    DELIVERING = "delivering"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


def status_value(value: object) -> str:
    """Plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Members subclass ``str``, so equality works either way.
    Only ``.value`` is member-specific, and calling it on a loaded row raises
    AttributeError. This accessor is the one that always works.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    A server_default/onupdate function makes SQLAlchemy re-SELECT the row to
    learn the value. That lazy load lands outside the request's async context
    and fails as MissingGreenlet when Pydantic serialises the response, so the
    values are generated in Python instead.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


# ─── Delivery boys ───────────────────────────────────────────────────────────

class DeliveryBoy(ServiceBase, TimestampMixin):
    """A delivery person scoped to one outlet."""

    __tablename__ = "delivery_boys"
    __table_args__ = (
        # One phone per (tenant, outlet) — the dispatch board rings that number.
        UniqueConstraint("tenant_id", "outlet_id", "phone", name="uq_delivery_boy_phone"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: outlets live in the organization service.
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    area: Mapped[str | None] = mapped_column(String(200), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# ─── Delivery zones ──────────────────────────────────────────────────────────

class DeliveryZone(ServiceBase, TimestampMixin):
    """A serviceable area for an outlet, bounded by a radius."""

    __tablename__ = "delivery_zones"
    __table_args__ = (
        UniqueConstraint("tenant_id", "outlet_id", "name", name="uq_delivery_zone_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: outlets live in the organization service.
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    radius_km: Mapped[float] = mapped_column(Numeric(8, 2), default=5, nullable=False)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ─── Deliveries ──────────────────────────────────────────────────────────────

class Delivery(ServiceBase, TimestampMixin):
    """One dispatch for one order, tracked through to delivery.

    ``status`` starts at ASSIGNED: either a boy is set immediately (the
    ``delivery.assigned`` event) or the delivery sits pending on the board
    (the ``delivery.created`` event). The unique (tenant, order) index is the
    structural idempotency guard the ``order.placed`` consumer leans on.
    """

    __tablename__ = "deliveries"
    __table_args__ = (
        # One delivery per order, full stop — the bus dedupe is layer 1, this
        # is layer 2 for any in-ledger-dedup miss or concurrent create.
        UniqueConstraint("tenant_id", "order_id", name="uq_delivery_order"),
        # The live dispatch board: open deliveries of an outlet, newest first.
        Index("ix_deliveries_live", "tenant_id", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: outlets live in the organization service.
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # Bare UUID: orders live in the pos service. The order NUMBER and TYPE are
    # snapshots taken from the event payload, never re-read from pos.
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    boy_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivery_boys.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivery_zones.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    status: Mapped[DeliveryStatus] = mapped_column(
        String(20), nullable=False, default=DeliveryStatus.ASSIGNED, index=True
    )
    # Set when a boy is actually attached to a pending delivery.
    assigned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancel_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    boy: Mapped["DeliveryBoy | None"] = relationship(
        primaryjoin="DeliveryBoy.id == Delivery.boy_id",
        foreign_keys="Delivery.boy_id",
    )
    zone: Mapped["DeliveryZone | None"] = relationship(
        primaryjoin="DeliveryZone.id == Delivery.zone_id",
        foreign_keys="Delivery.zone_id",
    )
    logs: Mapped[list["DeliveryStatusLog"]] = relationship(
        back_populates="delivery",
        primaryjoin="DeliveryStatusLog.delivery_id == Delivery.id",
        foreign_keys="DeliveryStatusLog.delivery_id",
        cascade="all, delete-orphan",
    )


# ─── Status log (audit trail) ────────────────────────────────────────────────

class DeliveryStatusLog(ServiceBase, TimestampMixin):
    """Append-only state trail. One row per transition, never edited in place.

    ``from_status`` is NULL on the opening row (nothing -> assigned), which is
    how the trail shows a delivery's full life: null->assigned->delivering->...
    """

    __tablename__ = "delivery_status_logs"
    __table_args__ = (
        Index("ix_delivery_logs_delivery", "delivery_id", "at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deliveries.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    delivery: Mapped["Delivery"] = relationship(
        back_populates="logs",
        primaryjoin="DeliveryStatusLog.delivery_id == Delivery.id",
        foreign_keys="DeliveryStatusLog.delivery_id",
    )


# ─── Outbox / consumer ledger ────────────────────────────────────────────────

class ConsumedEvent(ServiceBase, TimestampMixin):
    """Durable idempotency ledger — one row per event this service consumed.

    Written by the bus's consumer loop via the installed dedupe ledger
    (``src.services.event_bus.dedupe``), so a redelivered event whose
    event_id is already here is skipped even after a process restart. The
    in-memory dedupe gate in ``EventBus`` alone is not restart-safe; this
    table closes that gap.

    ``event_id`` is the primary key — a redelivery with the same event_id
    is a no-op insert (``ON CONFLICT DO NOTHING``), which is exactly the
    check-then-mark primitive the dedupe helper needs.
    """

    __tablename__ = "consumed_events"

    event_id: Mapped[str] = mapped_column(
        String(64), primary_key=True
    )
    type: Mapped[str] = mapped_column(
        String(120), nullable=False, default="", index=True
    )
    consumed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox row — one per event this service would emit.

    Written in the same transaction as the domain change so the two commit
    or roll back together. A relay marks rows published or dead; pending rows
    are what the relay keeps picking up on crash-recovery. ``event_id`` is
    the bus dedupe key, so a re-delivered event is a no-op on the consumer
    side even if the relay over-publishes it.

    Status transitions: pending -> published (relay succeeded) / dead (retries
    exhausted).
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="delivery")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
