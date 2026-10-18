"""POS service models — orders, order items, table sessions, reservations.

Owns ``restaurantos_pos``. ``outlet_id``, ``table_id``, ``section_id``,
``customer_id``, ``menu_item_id``, ``variant_id``, ``combo_id``, ``addon_id``,
``modifier_id``, ``waiter_id``, ``shift_id`` and ``tax_code_id`` are ALL bare
UUID columns with NO foreign key: outlets/tables/sections belong to the
organization service, menu entities to the menu service, customers to the
customers service, users/shifts to auth/staff, tax codes to billing. Those
are the boundaries.

Order items snapshot name and price. The bill must show what was actually
ordered, not what the menu says today — a menu change has to be able to reach
pos without rewriting history.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("pos")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class OrderType(str, enum.Enum):
    DINE_IN = "dine_in"
    TAKEAWAY = "takeaway"
    DELIVERY = "delivery"
    AGGREGATOR = "aggregator"
    QSR = "qsr"


class OrderStatus(str, enum.Enum):
    DRAFT = "draft"
    PLACED = "placed"
    IN_KITCHEN = "in_kitchen"
    PREPARING = "preparing"
    PARTIALLY_SERVED = "partially_served"
    SERVED = "served"
    BILL_REQUESTED = "bill_requested"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class OrderItemStatus(str, enum.Enum):
    ORDERED = "ordered"
    SENT_TO_KITCHEN = "sent_to_kitchen"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"
    CANCELLED = "cancelled"


class TableSessionStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SEATED = "seated"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    COMPLETED = "completed"


class WaitlistStatus(str, enum.Enum):
    WAITING = "waiting"
    SEATED = "seated"
    CANCELLED = "cancelled"


def status_value(value: object) -> str:
    """The plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. The members subclass ``str``, so equality and comparison
    work either way — ``o.status != OrderStatus.CANCELLED`` is right for both.
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


class Order(ServiceBase, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_pos_orders_outlet_status", "outlet_id", "status"),
        Index("ix_pos_orders_outlet_created", "outlet_id", "created_at"),
        UniqueConstraint("tenant_id", "order_number", name="uq_pos_tenant_order_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Bare UUID: the outlet belongs to the organization service.
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    order_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    order_type: Mapped[OrderType] = mapped_column(
        String(20), default=OrderType.DINE_IN, index=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        String(30), default=OrderStatus.DRAFT, index=True
    )

    table_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    covers: Mapped[int] = mapped_column(Integer, default=1)
    waiter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(
        String(30), nullable=True, index=True
    )

    # Aggregator provenance — how this order arrived, for third-party orders.
    aggregator_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    aggregator_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_parcel: Mapped[bool] = mapped_column(Boolean, default=False)
    token_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    placed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Denormalised totals — recalculated by service.recalculate_totals on every
    # mutation. Stored so listing orders never has to aggregate items.
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    service_charge: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    # No ForeignKey constraints exist on these columns, so SQLAlchemy cannot
    # infer a join and would raise at first query. Every relationship here
    # therefore names its join and its foreign key explicitly.
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        primaryjoin="Order.id == OrderItem.order_id",
        foreign_keys="OrderItem.order_id",
        cascade="all, delete-orphan",
        order_by="OrderItem.position",
    )
    courses: Mapped[list["OrderItemCourse"]] = relationship(
        back_populates="order",
        primaryjoin="Order.id == OrderItemCourse.order_id",
        foreign_keys="OrderItemCourse.order_id",
        cascade="all, delete-orphan",
        order_by="OrderItemCourse.course_number",
    )


class OrderItem(ServiceBase, TimestampMixin):
    __tablename__ = "order_items"
    __table_args__ = (
        Index("ix_pos_order_items_order", "order_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Snapshot keys back to the menu service, but with no constraint — the
    # menu may change or be deleted without invalidating an order.
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    variant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    combo_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Snapshot — the bill must show what was actually ordered.
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    variant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Presentation order within the order.
    position: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[OrderItemStatus] = mapped_column(
        String(30), default=OrderItemStatus.ORDERED, index=True
    )
    # Course pacing: 1=starter, 2=main, 3=dessert.
    course_number: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    discount_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_code_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    # Which kitchen station prepared this. Null means unassigned.
    kitchen_station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    order: Mapped["Order"] = relationship(
        back_populates="items",
        primaryjoin="OrderItem.order_id == Order.id",
        foreign_keys="OrderItem.order_id",
    )
    addons: Mapped[list["OrderItemAddon"]] = relationship(
        back_populates="order_item",
        primaryjoin="OrderItem.id == OrderItemAddon.order_item_id",
        foreign_keys="OrderItemAddon.order_item_id",
        cascade="all, delete-orphan",
    )


class OrderItemAddon(ServiceBase, TimestampMixin):
    """An addon or modifier chosen for one line, snapshotted by value."""

    __tablename__ = "order_item_addons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    addon_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    modifier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    qty: Mapped[int] = mapped_column(Integer, default=1)

    order_item: Mapped["OrderItem"] = relationship(
        back_populates="addons",
        primaryjoin="OrderItemAddon.order_item_id == OrderItem.id",
        foreign_keys="OrderItemAddon.order_item_id",
    )


class OrderItemCourse(ServiceBase, TimestampMixin):
    """Explicit course control for paced dine-in service."""

    __tablename__ = "order_item_courses"
    __table_args__ = (
        UniqueConstraint("order_id", "course_number", name="uq_pos_order_course_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    course_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    fired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    served_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    order: Mapped["Order"] = relationship(
        back_populates="courses",
        primaryjoin="OrderItemCourse.order_id == Order.id",
        foreign_keys="OrderItemCourse.order_id",
    )


class TableSession(ServiceBase, TimestampMixin):
    """One table's occupancy from seating to bill close."""

    __tablename__ = "table_sessions"
    __table_args__ = (
        Index("ix_pos_table_sessions_active", "outlet_id", "table_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    status: Mapped[TableSessionStatus] = mapped_column(
        String(20), default=TableSessionStatus.ACTIVE
    )
    covers: Mapped[int] = mapped_column(Integer, default=1)
    waiter_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Reservation(ServiceBase, TimestampMixin):
    __tablename__ = "reservations"
    __table_args__ = (
        Index("ix_pos_reservations_outlet_time", "outlet_id", "reserved_from"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    table_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    reservation_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    covers: Mapped[int] = mapped_column(Integer, default=2)
    reserved_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    reserved_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[ReservationStatus] = mapped_column(
        String(20), default=ReservationStatus.PENDING, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    occasion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    deposit_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)


class Waitlist(ServiceBase, TimestampMixin):
    __tablename__ = "waitlist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    covers: Mapped[int] = mapped_column(Integer, default=2)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    quoted_wait_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[WaitlistStatus] = mapped_column(
        String(20), default=WaitlistStatus.WAITING
    )


class NumberCounter(ServiceBase, TimestampMixin):
    """Per-outlet monotonic counter for document numbers.

    The monolith reads this from the organization service's ``number_series``
    table, but pos cannot query another service's database — that would couple
    the two through a foreign key on shared state. It keeps its own counter in
    its own database instead. The numbers will not match the organization
    service's series, which is correct for a split: each service owns its
    numbering.

    ``key`` includes the month, so a monthly reset is a new row rather than a
    mutation — safer under concurrency, since a lost UPDATE would silently
    reuse a number.
    """

    __tablename__ = "number_counters"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_pos_number_counter_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # e.g. "order:outlet-uuid:2026-10"
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    prefix: Mapped[str] = mapped_column(String(40), nullable=False)
    next_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
