"""Printers service — printer & POS-device registry, print job queue, audit log.

Owns ``restaurantos_printers``. Cross-service columns carry NO foreign key:

  * ``outlet_id`` — organization service

Printer destinations, device pairing and the print-job queue are all local to
this service; the job's ``payload`` JSONB column snapshots whatever the
publishing event carried (KOT items, bill lines), so receipt preview and
dispatch never read another service's database.
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
ServiceBase = service_base("printers")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PrinterType(str, enum.Enum):
    THERMAL = "THERMAL"
    NETWORK = "NETWORK"
    KDS = "KDS"
    QR = "QR"


class Destination(str, enum.Enum):
    RECEIPT = "RECEIPT"
    KDS = "KDS"
    CHEF = "CHEF"
    BAR = "BAR"


class PrinterHealth(str, enum.Enum):
    HEALTHY = "HEALTHY"
    UNREACHABLE = "UNREACHABLE"
    UNKNOWN = "UNKNOWN"


class DeviceKind(str, enum.Enum):
    POS = "POS"
    KDS = "KDS"
    PRINTER = "PRINTER"
    TABLET = "TABLET"


class DeviceStatus(str, enum.Enum):
    PENDING = "PENDING"
    BOUND = "BOUND"
    REVOKED = "REVOKED"


class JobSourceType(str, enum.Enum):
    KOT = "KOT"
    BILL = "BILL"
    ORDER = "ORDER"
    TEST = "TEST"


class JobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    ACKED = "ACKED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


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


class Printer(ServiceBase, TimestampMixin):
    """A physical print destination registered against an outlet.

    ``default_destination`` routes KOT/bill/order jobs for the outlet to this
    printer when no explicit ``printer_id`` is carried on the job.
    """

    __tablename__ = "printers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "outlet_id", "name", name="uq_printer_tenant_outlet_name"),
        Index("ix_printer_tenant_status", "tenant_id", "active"),
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
    printer_type: Mapped[PrinterType] = mapped_column(String(20), nullable=False)
    host: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=9100)
    paper_width_mm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    default_destination: Mapped[Destination | None] = mapped_column(
        String(20), nullable=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    health: Mapped[PrinterHealth] = mapped_column(
        String(20), nullable=False, default=PrinterHealth.UNKNOWN
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class DeviceRegistration(ServiceBase, TimestampMixin):
    """A POS/KDS/tablet device paired with the tenant by a device code.

    ``device_code`` is the pairing code the hardware presents at setup time;
    it is unique within a tenant. ``bound_printer_id`` links a device to a
    print destination — a real FK, since the printer lives in THIS database.
    """

    __tablename__ = "device_registrations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "device_code", name="uq_device_tenant_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    device_code: Mapped[str] = mapped_column(String(80), nullable=False)
    device_kind: Mapped[DeviceKind] = mapped_column(String(20), nullable=False)
    bound_printer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("printers.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[DeviceStatus] = mapped_column(
        String(20), nullable=False, default=DeviceStatus.PENDING
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    bound_printer: Mapped["Printer | None"] = relationship(
        primaryjoin="DeviceRegistration.bound_printer_id == Printer.id",
        foreign_keys="DeviceRegistration.bound_printer_id",
    )


class PrintJob(ServiceBase, TimestampMixin):
    """One queued print. Created by event consumers or test prints.

    The dispatcher marks QUEUED -> SENT/FAILED/EXPIRED; ``payload`` snapshots
    the source document (KOT items, bill lines, ...) so dispatch and preview
    stay inside this database.
    """

    __tablename__ = "print_jobs"
    __table_args__ = (
        Index("ix_print_job_tenant_status_requested", "tenant_id", "status", "requested_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    printer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("printers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_type: Mapped[JobSourceType] = mapped_column(String(20), nullable=False)
    source_ref: Mapped[str] = mapped_column(String(120), nullable=False)
    destination: Mapped[Destination] = mapped_column(String(20), nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        String(20), nullable=False, default=JobStatus.QUEUED, index=True
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retry: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    logs: Mapped[list["PrintLog"]] = relationship(
        back_populates="job",
        primaryjoin="PrintJob.id == PrintLog.print_job_id",
        foreign_keys="PrintLog.print_job_id",
        cascade="all, delete-orphan",
    )


class PrintLog(ServiceBase):
    """Append-only status audit for a print job.

    On the service base (so it lands in this service's metadata) but WITHOUT
    TimestampMixin: a log row records an instant and is never updated, so an
    ``updated_at`` column would be noise on an audit trail.
    """

    __tablename__ = "print_logs"
    __table_args__ = (
        Index("ix_print_log_job", "print_job_id", "at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    print_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("print_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    job: Mapped["PrintJob"] = relationship(
        back_populates="logs",
        primaryjoin="PrintLog.print_job_id == PrintJob.id",
        foreign_keys="PrintLog.print_job_id",
    )


class ConsumedEvent(ServiceBase, TimestampMixin):
    """Durable idempotency ledger — one row per event this service consumed.

    Written by the bus's consumer loop via the installed dedupe ledger
    (``src.services.event_bus.dedupe``), so a redelivered event whose
    event_id is already here is skipped even after a process restart.

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
    are what the relay keeps picking up on crash-recovery.

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
    source_service: Mapped[str] = mapped_column(String(50), default="printers")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
