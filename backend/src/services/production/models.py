"""Production service models — processes, runs, plans.

Owns ``restaurantos_production``. Cross-service columns carry NO foreign key:

  * ``outlet_id``   — organization service
  * ``output_item`` — inventory service (the finished good produced)
  * ``raw_item_id`` — inventory service (a process line's raw input)

The inventory ids are deliberately bare UUID snapshots. Inventory owns its
items; if one were ever deleted the production master must still say what the
process turned raw material into. ``*_name`` columns next to the ids are name
snapshots taken when the master row was written: production cannot read the
inventory database, so when it emits ``production.run.completed`` or
``production.po.requested`` the consumers resolve those names (or the ids)
inside their own services.

Real foreign keys exist ONLY between tables in this file:
process <-> lines, process <-> runs, process <-> plan lines.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("production")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RunStatus(str, enum.Enum):
    PLANNED = "planned"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RunSource(str, enum.Enum):
    MANUAL = "manual"
    EXCEL = "excel"
    PLAN = "plan"


def status_value(value: object) -> str:
    """Plain string for a status/source field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Members subclass ``str``, so equality works either way —
    ``run.status != RunStatus.COMPLETED`` is correct for both. Only ``.value``
    is member-specific, and calling it on a loaded row raises AttributeError.
    This accessor is the one that always works.
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


class ProductionProcess(ServiceBase, TimestampMixin):
    """A production master: what a process turns raw material into, and how much.

    One process describes one conversion — e.g. "make 500 ml chutney from 2 kg
    tamarind, 500 g sugar, 200 ml oil". ``output_qty``/``output_uom`` say what
    one run of the process yields; the lines say what it costs in raw material
    per that yield, with an optional process loss factor on top.
    """

    __tablename__ = "production_processes"
    __table_args__ = (
        Index("ix_prod_processes_tenant_outlet", "tenant_id", "outlet_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: outlets live in the organization service.
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Bare UUID snapshot: the finished good lives in the inventory service.
    output_item: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # Name snapshot of the finished good — see the module docstring.
    output_item_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # What one run yields. The lines express raw usage PER this yield.
    output_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    output_uom: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # No ForeignKey would be needed even for same-service lines (there IS one
    # here), but the join is named explicitly because the child's FK column
    # participates in a delete-orphan cascade.
    lines: Mapped[list["ProductionProcessLine"]] = relationship(
        back_populates="process",
        primaryjoin="ProductionProcess.id == ProductionProcessLine.process_id",
        foreign_keys="ProductionProcessLine.process_id",
        cascade="all, delete-orphan",
    )


class ProductionProcessLine(ServiceBase, TimestampMixin):
    """One raw input of a process: per the process's output yield."""

    __tablename__ = "production_process_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    process_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_processes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Bare UUID snapshot: the raw item lives in the inventory service.
    raw_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # Name snapshot of the raw item — what a raise-po payload carries, because
    # production cannot resolve names against the inventory database.
    raw_item_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    uom: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # Extra loss on top of the recipe usage, as a percentage of the line qty.
    loss_pct: Mapped[float | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )

    process: Mapped["ProductionProcess"] = relationship(
        back_populates="lines",
        primaryjoin="ProductionProcessLine.process_id == ProductionProcess.id",
        foreign_keys="ProductionProcessLine.process_id",
    )


class ProductionRun(ServiceBase, TimestampMixin):
    """One execution of a process at an outlet, with a real outcome.

    The lifecycle is PLANNED -> STARTED -> COMPLETED (or CANCELLED out of any
    open state). Only COMPLETED emits stock movements — a run that was started
    and abandoned must not have deducted raws or added finished goods.
    """

    __tablename__ = "production_runs"
    __table_args__ = (
        Index("ix_prod_runs_tenant_outlet_status", "tenant_id", "outlet_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: outlets live in the organization service.
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    process_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_processes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    status: Mapped[RunStatus] = mapped_column(
        String(20), default=RunStatus.PLANNED, nullable=False, index=True
    )
    planned_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    # What actually came out, recorded on completion. Null until then.
    output_qty_actual: Mapped[float | None] = mapped_column(
        Numeric(14, 4), nullable=True
    )
    # manual | excel | plan — how the run was born.
    source: Mapped[RunSource] = mapped_column(
        String(20), default=RunSource.MANUAL, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ProductionPlanLine(ServiceBase, TimestampMixin):
    """Forward planning: "produce this much of this process on this date".

    A plan line is a target, not a commitment — starting the run is what
    commits it. Status is a plain String per the house rule: ``open`` (still a
    target), ``fulfilled`` (a run started from it), ``cancelled``.
    """

    __tablename__ = "production_plan_lines"
    __table_args__ = (
        Index("ix_prod_plan_lines_date", "tenant_id", "target_date", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: outlets live in the organization service.
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    process_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_processes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    target_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    planned_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox row — one per event this service would emit.

    Written in the same transaction as the domain change so the two commit or
    roll back together. A relay marks rows published or dead; pending rows are
    what the relay keeps picking up on crash-recovery. ``event_id`` is the
    bus dedupe key, so a re-delivered event is a no-op on the consumer side
    even if the relay over-publishes it.

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
    source_service: Mapped[str] = mapped_column(String(50), default="production")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
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
