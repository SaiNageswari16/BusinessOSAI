"""Kitchen service models — stations, KDS devices, KOT tickets and items.

Owns ``restaurantos_kitchen``. ``outlet_id``, ``order_id``, ``table_id``,
``order_item_id``, ``menu_item_id``, ``variant_id`` and ``changed_by`` are
ALL bare UUID columns with NO foreign key:

  * outlets and tables live in the organization service
  * orders and order items live in the pos service
  * menu entities live in the menu service
  * users live in the auth service

``kot_items`` deliberately duplicates ``order_items`` data rather than
referencing it by key alone. A kitchen ticket must still be printable and
auditable if the order or the menu changes later, and it must not require a
network round-trip to render on the pass screen.
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
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("kitchen")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StationType(str, enum.Enum):
    TANDOOR = "tandoor"
    FRY = "fry"
    GRILL = "grill"
    CURRY = "curry"
    SALAD = "salad"
    DESSERT = "dessert"
    BEVERAGE = "beverage"
    COUNTER = "counter"
    CHINESE = "chinese"
    BAKERY = "bakery"
    OTHER = "other"


class KOTStatus(str, enum.Enum):
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"
    CANCELLED = "cancelled"


class KOTPriority(str, enum.Enum):
    NORMAL = "normal"
    RUSH = "rush"
    VIP = "vip"


class KOTItemStatus(str, enum.Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"
    CANCELLED = "cancelled"


def status_value(value: object) -> str:
    """The plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. The members subclass ``str``, so equality works either
    way — ``kot.status != KOTStatus.CANCELLED`` is correct for both. Only
    ``.value`` is member-specific, and calling it on a loaded row raises
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


class KitchenStation(ServiceBase, TimestampMixin):
    __tablename__ = "kitchen_stations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: the outlet belongs to the organization service.
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    station_type: Mapped[StationType] = mapped_column(
        String(30), default=StationType.OTHER
    )
    printer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Backpressure: max concurrent open tickets before new ones queue.
    capacity_concurrent: Mapped[int] = mapped_column(Integer, default=10)
    avg_prep_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # No ForeignKey on station_id, so the join must be named explicitly or
    # SQLAlchemy raises at first query.
    kots: Mapped[list["KOT"]] = relationship(
        back_populates="station",
        primaryjoin="KitchenStation.id == KOT.station_id",
        foreign_keys="KOT.station_id",
    )


class KDSDevice(ServiceBase, TimestampMixin):
    """A kitchen display screen, authenticated by token rather than JWT.

    The pass screen is a thin client; it polls with a device token so it can
    show live ticket state without a user signing in per refresh.
    """

    __tablename__ = "kds_devices"
    __table_args__ = (
        UniqueConstraint("device_token", name="uq_kitchen_kds_device_token"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    device_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class KOT(ServiceBase, TimestampMixin):
    """Kitchen Order Ticket — one dish batch for one station."""

    __tablename__ = "kots"
    __table_args__ = (
        Index("ix_kitchen_kots_outlet_status_station", "outlet_id", "status", "station_id"),
        Index("ix_kitchen_kots_order", "order_id"),
        Index("ix_kitchen_kots_station_fired", "station_id", "fired_at"),
        UniqueConstraint("tenant_id", "kot_number", name="uq_kitchen_tenant_kot_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # The originating pos order, kept for reporting and cancellation.
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    order_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    table_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    table_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    kot_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    status: Mapped[KOTStatus] = mapped_column(
        String(30), default=KOTStatus.PENDING, index=True
    )
    priority: Mapped[KOTPriority] = mapped_column(
        String(20), default=KOTPriority.NORMAL
    )
    # Course number this ticket was fired for, when paced service applies.
    course_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    fired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ready_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    served_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    printed_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Captured from the event at fire time — a ticket must remain meaningful
    # after the order itself is edited or closed.
    covers: Mapped[int] = mapped_column(Integer, default=1)
    order_type: Mapped[str] = mapped_column(String(30), nullable=True)

    station: Mapped["KitchenStation"] = relationship(
        back_populates="kots",
        primaryjoin="KOT.station_id == KitchenStation.id",
        foreign_keys="KOT.station_id",
    )
    items: Mapped[list["KOTItem"]] = relationship(
        back_populates="kot",
        primaryjoin="KOT.id == KOTItem.kot_id",
        foreign_keys="KOTItem.kot_id",
        cascade="all, delete-orphan",
        order_by="KOTItem.position",
    )
    status_logs: Mapped[list["KOTStatusLog"]] = relationship(
        back_populates="kot",
        primaryjoin="KOT.id == KOTStatusLog.kot_id",
        foreign_keys="KOTStatusLog.kot_id",
        cascade="all, delete-orphan",
    )


class KOTItem(ServiceBase, TimestampMixin):
    """One line on a ticket, fully snapshotted from the order."""

    __tablename__ = "kot_items"
    __table_args__ = (
        Index("ix_kitchen_kot_items_kot", "kot_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    kot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kots.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Traceability back to the source order line, no constraint.
    order_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    variant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Which station was chosen at order time, snapshotted from the order line.
    # Redundant with the parent KOT's station, but a ticket can be split or
    # reassigned, and the line-level record is what explains where it went.
    station_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Snapshot — survives later menu edits.
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    variant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    position: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[KOTItemStatus] = mapped_column(
        String(30), default=KOTItemStatus.PENDING, index=True
    )
    course_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Chosen addons, snapshotted as data rather than joined rows.
    modifiers: Mapped[list] = mapped_column(JSONB, default=list)
    prepared_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    kot: Mapped["KOT"] = relationship(
        back_populates="items",
        primaryjoin="KOTItem.kot_id == KOT.id",
        foreign_keys="KOTItem.kot_id",
    )


class KOTStatusLog(ServiceBase, TimestampMixin):
    """Append-only history of a ticket's state, for kitchen audits."""

    __tablename__ = "kot_status_logs"
    __table_args__ = (
        Index("ix_kitchen_kot_status_logs_kot", "kot_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    kot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kots.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    from_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    kot: Mapped["KOT"] = relationship(
        back_populates="status_logs",
        primaryjoin="KOTStatusLog.kot_id == KOT.id",
        foreign_keys="KOTStatusLog.kot_id",
    )


class NumberCounter(ServiceBase, TimestampMixin):
    """Per-station KOT number counter.

    Same shape as the pos service's counter — kitchen issues its own ticket
    numbers and cannot reach the organization service's series table.
    """

    __tablename__ = "kitchen_number_counters"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_kitchen_counter_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # e.g. "kot:<station_id>:2026-10"
    key: Mapped[str] = mapped_column(String(160), nullable=False)
    prefix: Mapped[str] = mapped_column(String(40), nullable=False)
    next_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)



class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox row — one per event this service would emit.

    Written in the same transaction as the domain change so the two commit or
    roll back together. The relay marks rows published or dead; pending rows
    are what the relay keeps picking up on crash-recovery.

    Status transitions: pending -> published (relay succeeded) / dead (retries
    exhausted). ``event_id`` is the bus dedupe key, so a re-delivered event
    is a no-op on the consumer side even if the relay over-publishes it.
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    event_id: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="kitchen")
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


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
