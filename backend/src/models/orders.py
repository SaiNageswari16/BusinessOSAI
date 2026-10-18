import enum
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
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

from src.database.base import (
    Base,
    TenantScopedMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    db_enum,
    enum_values,
)


# ─── Orders ──────────────────────────────────────────────────────

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


class Order(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_outlet_status", "outlet_id", "status"),
        Index("ix_orders_outlet_created", "outlet_id", "created_at"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    order_type: Mapped[OrderType] = mapped_column(
        db_enum(OrderType, name="order_type"), default=OrderType.DINE_IN, index=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        db_enum(OrderStatus, name="order_status"), default=OrderStatus.DRAFT, index=True
    )

    table_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurant_tables.id", ondelete="SET NULL"), nullable=True, index=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id", ondelete="SET NULL"), nullable=True
    )
    covers: Mapped[int] = mapped_column(Integer, default=1)
    waiter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True
    )

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)

    # Aggregator provenance
    aggregator_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    aggregator_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_parcel: Mapped[bool] = mapped_column(Boolean, default=False)
    token_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    placed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    closed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Denormalised totals — recalculated by order_service on every mutation
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    service_charge: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    outlet: Mapped["Outlet"] = relationship(foreign_keys=[outlet_id])
    table: Mapped["RestaurantTable | None"] = relationship(foreign_keys=[table_id])
    customer: Mapped["Customer | None"] = relationship(foreign_keys=[customer_id])
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    kots: Mapped[list["KOT"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    courses: Mapped[list["OrderItemCourse"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItemStatus(str, enum.Enum):
    ORDERED = "ordered"
    SENT_TO_KITCHEN = "sent_to_kitchen"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"
    CANCELLED = "cancelled"


class OrderItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "order_items"
    __table_args__ = (
        Index("ix_order_items_order", "order_id", "status"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_item_variants.id", ondelete="SET NULL"), nullable=True
    )
    combo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("combos.id", ondelete="SET NULL"), nullable=True
    )

    # Snapshot — the bill must show what was actually ordered
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    variant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    status: Mapped[OrderItemStatus] = mapped_column(
        db_enum(OrderItemStatus, name="order_item_status"), default=OrderItemStatus.ORDERED, index=True
    )
    # Course pacing: 1=starter, 2=main, 3=dessert
    course_number: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    discount_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tax_codes.id", ondelete="SET NULL"), nullable=True
    )
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    kitchen_station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kitchen_stations.id", ondelete="SET NULL"), nullable=True
    )

    order: Mapped["Order"] = relationship(back_populates="items", foreign_keys=[order_id])
    addons: Mapped[list["OrderItemAddon"]] = relationship(
        back_populates="order_item", cascade="all, delete-orphan"
    )
    kot_items: Mapped[list["KOTItem"]] = relationship(
        back_populates="order_item", cascade="all, delete-orphan"
    )
    tax_code: Mapped["TaxCode | None"] = relationship(foreign_keys=[tax_code_id])


class OrderItemAddon(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "order_item_addons"

    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    addon_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_item_addons.id", ondelete="SET NULL"), nullable=True
    )
    modifier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modifiers.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    qty: Mapped[int] = mapped_column(Integer, default=1)

    order_item: Mapped["OrderItem"] = relationship(back_populates="addons", foreign_keys=[order_item_id])


class OrderItemCourse(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Explicit course control for paced dine-in service."""

    __tablename__ = "order_item_courses"
    __table_args__ = (
        UniqueConstraint("order_id", "course_number", name="uq_order_course_number"),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    fired_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    served_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    order: Mapped["Order"] = relationship(back_populates="courses", foreign_keys=[order_id])


# ─── Table occupancy ─────────────────────────────────────────────

class TableSessionStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class TableSession(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "table_sessions"
    __table_args__ = (
        Index("ix_table_sessions_active", "outlet_id", "table_id", "status"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurant_tables.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[TableSessionStatus] = mapped_column(
        db_enum(TableSessionStatus, name="table_session_status"), default=TableSessionStatus.ACTIVE
    )
    covers: Mapped[int] = mapped_column(Integer, default=1)
    waiter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    started_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ended_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    table: Mapped["RestaurantTable"] = relationship(foreign_keys=[table_id])


# ─── Reservations ────────────────────────────────────────────────

class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SEATED = "seated"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    COMPLETED = "completed"


class Reservation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "reservations"
    __table_args__ = (
        Index("ix_reservations_outlet_time", "outlet_id", "reserved_from"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurant_tables.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    reservation_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    covers: Mapped[int] = mapped_column(Integer, default=2)
    reserved_from: Mapped[str] = mapped_column(String(50), nullable=False)
    reserved_to: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[ReservationStatus] = mapped_column(
        db_enum(ReservationStatus, name="reservation_status"), default=ReservationStatus.PENDING, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    occasion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    deposit_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    table: Mapped["RestaurantTable | None"] = relationship(foreign_keys=[table_id])


class WaitlistStatus(str, enum.Enum):
    WAITING = "waiting"
    SEATED = "seated"
    CANCELLED = "cancelled"


class Waitlist(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "waitlist"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    covers: Mapped[int] = mapped_column(Integer, default=2)
    requested_at: Mapped[str] = mapped_column(String(50), nullable=False)
    quoted_wait_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[WaitlistStatus] = mapped_column(
        db_enum(WaitlistStatus, name="waitlist_status"), default=WaitlistStatus.WAITING
    )
