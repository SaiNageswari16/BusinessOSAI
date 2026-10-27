"""Customers service models — profiles, dining preferences, visit history.

Owns ``restaurantos_customers``. Cross-service columns carry NO foreign key:

  * ``outlet_id`` — organization service
  * ``bill_id``   — billing service
  * ``order_id``  — pos service

The ``customers`` table is the source of truth for a guest. Billing and pos
hold only a bare ``customer_id`` and never this row, which is why a customer
edit in this service is visible everywhere without a foreign key.
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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("customers")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CustomerStatus(str, enum.Enum):
    ACTIVE = "active"
    VIP = "vip"
    BLACKLISTED = "blacklisted"
    ARCHIVED = "archived"


class FeedbackStatus(str, enum.Enum):
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class FeedbackSource(str, enum.Enum):
    POS = "pos"
    QR = "qr"
    WHATSAPP = "whatsapp"
    GOOGLE = "google"
    ZOMATO = "zomato"
    SWIGGY = "swiggy"


def status_value(value: object) -> str:
    """Plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Only ``.value`` is member-specific, so calling it on a
    loaded row raises AttributeError.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    Python callables for both: a *server* default makes SQLAlchemy re-SELECT the
    row to learn the value, and that lazy read lands outside the request's async
    context, failing as MissingGreenlet during Pydantic serialisation. ``default``
    and ``onupdate`` are evaluated client-side at statement build time.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class Customer(ServiceBase, TimestampMixin):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "phone", name="uq_cust_phone"),
        Index("ix_cust_outlet_status", "outlet_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    # The primary lookup key for the front of house: a walk-in is found by phone.
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    anniversary: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Free-form CRM tags: "allergy-cream", "prefers-window", "no-spicy".
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[CustomerStatus] = mapped_column(
        String(20), default=CustomerStatus.ACTIVE, index=True
    )
    dietary: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Denormalised lifetime totals, updated on bill.paid. Stored here so a
    # customer board does not have to query billing for every guest.
    total_visits: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    last_visit_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    preferences: Mapped["CustomerPreferences | None"] = relationship(
        back_populates="customer", uselist=False,
        primaryjoin="Customer.id == CustomerPreferences.customer_id",
        foreign_keys="CustomerPreferences.customer_id",
        cascade="all, delete-orphan",
    )


class CustomerPreferences(ServiceBase, TimestampMixin):
    """Dining preferences, separate from the profile.

    Kept as its own table rather than more JSONB on ``Customer`` because the
    front of house edits these constantly while everything else on a profile is
    stable, and a separate row means an edit does not touch the identity
    columns — no churn on the unique-constraint key.
    """

    __tablename__ = "customer_preferences"
    __table_args__ = (
        UniqueConstraint("customer_id", name="uq_cust_preferences"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    favourite_dishes: Mapped[list] = mapped_column(JSONB, default=list)
    allergies: Mapped[list] = mapped_column(JSONB, default=list)
    dislikes: Mapped[list] = mapped_column(JSONB, default=list)
    seating_preference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer: Mapped["Customer"] = relationship(
        back_populates="preferences",
        primaryjoin="CustomerPreferences.customer_id == Customer.id",
        foreign_keys="CustomerPreferences.customer_id",
    )


class CustomerVisit(ServiceBase, TimestampMixin):
    """One settled bill per row — the visit history a guest actually had.

    Written on ``bill.paid``. ``order_id`` and ``bill_id`` are bare UUIDs into
    the pos and billing services; this row is the durable record that a visit
    happened, so the history survives both of those services' rows being
    purged or retained on their own schedules.
    """

    __tablename__ = "customer_visits"
    __table_args__ = (
        Index("ix_cust_visits_customer_time", "customer_id", "visited_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    covers: Mapped[int] = mapped_column(Integer, default=1)
    visited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


class Feedback(ServiceBase, TimestampMixin):
    """Guest feedback, linked to a bill or order by bare UUID.

    Ratings are intentionally nullable per-dimension: a guest who rated only
    the food must not be forced to invent a service score to save the row.
    """

    __tablename__ = "feedback"
    __table_args__ = (
        Index("ix_cust_feedback_outlet_time", "outlet_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    rating_overall: Mapped[int] = mapped_column(Integer, default=5)
    rating_food: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating_service: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating_ambience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[FeedbackStatus] = mapped_column(
        String(20), default=FeedbackStatus.NEW, index=True
    )
    source: Mapped[FeedbackSource] = mapped_column(
        String(20), default=FeedbackSource.POS
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
    source_service: Mapped[str] = mapped_column(String(50), default="customers")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
