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


# ─── Items ───────────────────────────────────────────────────────

class InventoryItemType(str, enum.Enum):
    INGREDIENT = "ingredient"
    SEMI_FINISHED = "semi_finished"
    PACKAGING = "packaging"
    FINISHED = "finished"


class InventoryItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "inventory_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_inventory_item_code"),
        Index("ix_inventory_items_outlet_type", "outlet_id", "item_type"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    sku: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    item_type: Mapped[InventoryItemType] = mapped_column(
        db_enum(InventoryItemType, name="inventory_item_type"), default=InventoryItemType.INGREDIENT
    )

    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_categories.id", ondelete="SET NULL"), nullable=True
    )
    default_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"), nullable=True
    )

    track_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    track_batch: Mapped[bool] = mapped_column(Boolean, default=False)
    track_expiry: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_negative_stock: Mapped[bool] = mapped_column(Boolean, default=False)

    reorder_level: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    reorder_qty: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    standard_cost: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    uom: Mapped["UnitOfMeasure | None"] = relationship(foreign_keys=[uom_id])
    stocks: Mapped[list["InventoryStock"]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )


class InventoryCategory(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "inventory_categories"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class StorageLocationType(str, enum.Enum):
    KITCHEN_STORE = "kitchen_store"
    FREEZER = "freezer"
    COLD_STORAGE = "cold_storage"
    DRY_STORE = "dry_store"
    BAR_STORE = "bar_store"


class StorageLocation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "storage_locations"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    location_type: Mapped[StorageLocationType] = mapped_column(
        db_enum(StorageLocationType, name="storage_location_type"), default=StorageLocationType.KITCHEN_STORE
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryStock(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "inventory_stock"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "outlet_id", "inventory_item_id", "location_id",
            name="uq_tenant_item_stock_location",
        ),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="CASCADE"), nullable=True
    )
    qty_on_hand: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    qty_reserved: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    qty_available: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    avg_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    last_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)

    item: Mapped["InventoryItem"] = relationship(back_populates="stocks", foreign_keys=[inventory_item_id])


class InventoryBatch(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "inventory_batches"
    __table_args__ = (
        Index("ix_inventory_batches_expiry", "outlet_id", "expiry_date"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"), nullable=True
    )
    batch_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    expiry_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    grn_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goods_receipt_notes.id", ondelete="SET NULL"), nullable=True
    )


# ─── Stock movements ─────────────────────────────────────────────

class MovementType(str, enum.Enum):
    PURCHASE = "purchase"
    CONSUMPTION = "consumption"
    WASTAGE = "wastage"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    ADJUSTMENT = "adjustment"
    PRODUCTION = "production"
    OPENING = "opening"


class StockMovement(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "stock_movements"
    __table_args__ = (
        Index("ix_stock_movements_item_time", "outlet_id", "inventory_item_id", "created_at"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"), nullable=True
    )
    movement_type: Mapped[MovementType] = mapped_column(
        db_enum(MovementType, name="movement_type"), nullable=False, index=True
    )
    qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_batches.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


# ─── Wastage ─────────────────────────────────────────────────────

class WastageReason(str, enum.Enum):
    SPOILAGE = "spoilage"
    OVERPREP = "overprep"
    DROPPED = "dropped"
    STAFF_MEAL = "staff_meal"
    COMP = "comp"
    EXPIRED = "expired"
    TRIAL = "trial"


class WastageLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "wastage_logs"
    __table_args__ = (
        Index("ix_wastage_logs_outlet_time", "outlet_id", "created_at"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    wastage_number: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True
    )
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True
    )
    qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    reason: Mapped[WastageReason] = mapped_column(
        db_enum(WastageReason, name="wastage_reason"), nullable=False
    )
    cost: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    logged_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)


# ─── Stock adjustments ───────────────────────────────────────────

class AdjustmentStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


class StockAdjustment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "stock_adjustments"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    adjustment_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AdjustmentStatus] = mapped_column(
        db_enum(AdjustmentStatus, name="adjustment_status"), default=AdjustmentStatus.DRAFT
    )
    variance_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    variance_value: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    lines: Mapped[list["StockAdjustmentLine"]] = relationship(
        back_populates="adjustment", cascade="all, delete-orphan"
    )


class StockAdjustmentLine(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "stock_adjustment_lines"

    adjustment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stock_adjustments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"), nullable=True
    )
    system_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    counted_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    variance_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)

    adjustment: Mapped["StockAdjustment"] = relationship(back_populates="lines", foreign_keys=[adjustment_id])


# ─── Inter-outlet transfers ──────────────────────────────────────

class TransferStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_TRANSIT = "in_transit"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class InterOutletTransfer(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "inter_outlet_transfers"

    from_outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transfer_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[TransferStatus] = mapped_column(
        db_enum(TransferStatus, name="transfer_status"), default=TransferStatus.DRAFT
    )
    dispatched_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    received_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    received_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    lines: Mapped[list["InterOutletTransferLine"]] = relationship(
        back_populates="transfer", cascade="all, delete-orphan"
    )


class InterOutletTransferLine(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "inter_outlet_transfer_lines"

    transfer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inter_outlet_transfers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False
    )
    qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    sent_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    received_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    variance_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)

    transfer: Mapped["InterOutletTransfer"] = relationship(back_populates="lines", foreign_keys=[transfer_id])


# ─── Production / prep ───────────────────────────────────────────

class ProductionBatch(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "production_batches"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipe_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True
    )
    batch_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    produced_qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    produced_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    produced_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expiry_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cost: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
