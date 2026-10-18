import enum
import uuid

from sqlalchemy import (
    Boolean,
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


# ─── Kitchen stations ────────────────────────────────────────────

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


class KitchenStation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "kitchen_stations"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    station_type: Mapped[StationType] = mapped_column(
        db_enum(StationType, name="station_type"), default=StationType.OTHER
    )
    printer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("printers.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Backpressure: max concurrent open tickets before new ones queue
    capacity_concurrent: Mapped[int] = mapped_column(Integer, default=10)
    avg_prep_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    kots: Mapped[list["KOT"]] = relationship(back_populates="station")


# ─── KDS devices ─────────────────────────────────────────────────

class KDSDevice(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "kds_devices"
    __table_args__ = (
        UniqueConstraint("device_token", name="uq_kds_device_token"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kitchen_stations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    device_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    station: Mapped["KitchenStation | None"] = relationship(foreign_keys=[station_id])


# ─── KOT (Kitchen Order Ticket) ──────────────────────────────────

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


class KOT(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "kots"
    __table_args__ = (
        Index("ix_kots_outlet_status_station", "outlet_id", "status", "station_id"),
        Index("ix_kots_order", "order_id"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    table_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurant_tables.id", ondelete="SET NULL"), nullable=True
    )
    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kitchen_stations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    kot_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    status: Mapped[KOTStatus] = mapped_column(
        db_enum(KOTStatus, name="kot_status"), default=KOTStatus.PENDING, index=True
    )
    priority: Mapped[KOTPriority] = mapped_column(
        db_enum(KOTPriority, name="kot_priority"), default=KOTPriority.NORMAL
    )

    # Course number this ticket was fired for
    course_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    fired_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    acknowledged_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ready_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    served_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    printed_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    order: Mapped["Order"] = relationship(back_populates="kots")
    station: Mapped["KitchenStation"] = relationship(back_populates="kots", foreign_keys=[station_id])
    table: Mapped["RestaurantTable | None"] = relationship(foreign_keys=[table_id])
    items: Mapped[list["KOTItem"]] = relationship(
        back_populates="kot", cascade="all, delete-orphan"
    )
    status_logs: Mapped[list["KOTStatusLog"]] = relationship(
        back_populates="kot", cascade="all, delete-orphan"
    )


class KOTItemStatus(str, enum.Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"
    CANCELLED = "cancelled"


class KOTItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "kot_items"

    kot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="SET NULL"), nullable=True
    )
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_item_variants.id", ondelete="SET NULL"), nullable=True
    )
    # Snapshot — survives later menu edits
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    variant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[KOTItemStatus] = mapped_column(
        db_enum(KOTItemStatus, name="kot_item_status"), default=KOTItemStatus.PENDING
    )
    course_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    modifiers: Mapped[list] = mapped_column(JSONB, default=list)  # snapshot of chosen addons
    prepared_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    kot: Mapped["KOT"] = relationship(back_populates="items", foreign_keys=[kot_id])
    order_item: Mapped["OrderItem | None"] = relationship(back_populates="kot_items", foreign_keys=[order_item_id])


class KOTStatusLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "kot_status_logs"
    __table_args__ = (
        Index("ix_kot_status_logs_kot", "kot_id", "created_at"),
    )

    kot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    kot: Mapped["KOT"] = relationship(back_populates="status_logs", foreign_keys=[kot_id])
