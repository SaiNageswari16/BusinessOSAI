"""Inventory service models — items, stock, batches, movements, wastage.

Owns ``restaurantos_inventory``. Cross-service columns carry NO foreign key:

  * ``outlet_id``    — organization service
  * ``uom_id``       — organization service (units of measure)
  * ``created_by``   — auth service
  * ``grn_id``       — purchase service (goods receipt notes)
  * ``bill_id``      — billing service
  * ``recipe_id``    — menu service

Real foreign keys exist ONLY between tables in this file: items <-> stock,
batches <-> movements.

Quantities are ``Numeric(14, 4)`` — four decimals is required because a single
kilogram of stock is consumed in hundredths of a gram. Monetary columns stay
``Numeric(12, 2)`` per house rule.
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
ServiceBase = service_base("inventory")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InventoryItemType(str, enum.Enum):
    INGREDIENT = "ingredient"
    SEMI_FINISHED = "semi_finished"
    PACKAGING = "packaging"
    FINISHED = "finished"


class StorageLocationType(str, enum.Enum):
    KITCHEN_STORE = "kitchen_store"
    DRY_STORE = "dry_store"
    WAREHOUSE = "warehouse"
    COLD_STORE = "cold_store"
    BAR_STORE = "bar_store"


class MovementType(str, enum.Enum):
    PURCHASE = "purchase"
    CONSUMPTION = "consumption"
    WASTAGE = "wastage"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    ADJUSTMENT = "adjustment"
    PRODUCTION = "production"
    OPENING = "opening"


class WastageReason(str, enum.Enum):
    SPOILAGE = "spoilage"
    OVERPREP = "overprep"
    DROPPED = "dropped"
    EXPIRED = "expired"
    THEFT = "theft"
    OTHER = "other"


class AdjustmentStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


def status_value(value: object) -> str:
    """Plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Members subclass ``str``, so equality works either way —
    ``m.movement_type != MovementType.WASTAGE`` is correct for both. Only
    ``.value`` is member-specific, and calling it on a loaded row raises
    AttributeError. This accessor is the one that always works.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    Both are Python callables. That is what matters: a *server* default makes
    SQLAlchemy re-SELECT the row to learn the value, and that lazy read lands
    outside the request's async context, failing as MissingGreenlet when
    Pydantic serialises the response. ``default`` and ``onupdate`` are evaluated
    client-side at statement build time and trigger no extra round trip, so they
    are safe — and match every other service in this repo.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class InventoryCategory(ServiceBase, TimestampMixin):
    __tablename__ = "inventory_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryItem(ServiceBase, TimestampMixin):
    __tablename__ = "inventory_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_inv_item_code"),
        Index("ix_inv_items_outlet_type", "outlet_id", "item_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    sku: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    item_type: Mapped[InventoryItemType] = mapped_column(
        String(30), default=InventoryItemType.INGREDIENT
    )

    # Units of measure live in the organization service: bare UUID.
    uom_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_categories.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    # Same service, so a real FK is fine.
    default_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    track_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    track_batch: Mapped[bool] = mapped_column(Boolean, default=False)
    track_expiry: Mapped[bool] = mapped_column(Boolean, default=False)
    # Without this, consumption below zero silently hides a data error.
    allow_negative_stock: Mapped[bool] = mapped_column(Boolean, default=False)

    reorder_level: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    reorder_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    standard_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # No ForeignKey on inventory_item_id, so the join is named explicitly or
    # SQLAlchemy raises at first query.
    stocks: Mapped[list["InventoryStock"]] = relationship(
        back_populates="item",
        primaryjoin="InventoryItem.id == InventoryStock.inventory_item_id",
        foreign_keys="InventoryStock.inventory_item_id",
        cascade="all, delete-orphan",
    )
    category: Mapped["InventoryCategory | None"] = relationship(
        foreign_keys=[category_id]
    )


class StorageLocation(ServiceBase, TimestampMixin):
    __tablename__ = "storage_locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    location_type: Mapped[StorageLocationType] = mapped_column(
        String(30), default=StorageLocationType.KITCHEN_STORE
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryStock(ServiceBase, TimestampMixin):
    """One row per (item, outlet, location).

    ``qty_on_hand`` is the physical truth. ``qty_reserved`` is committed but not
    yet consumed. ``qty_available = on_hand - reserved`` is always derived on
    write rather than stored separately, so the three can never disagree.
    """

    __tablename__ = "inventory_stock"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "outlet_id", "inventory_item_id", "location_id",
            name="uq_inv_stock_location",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    qty_on_hand: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    qty_reserved: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    qty_available: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    avg_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    last_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)

    item: Mapped["InventoryItem"] = relationship(
        back_populates="stocks",
        primaryjoin="InventoryStock.inventory_item_id == InventoryItem.id",
        foreign_keys="InventoryStock.inventory_item_id",
    )


class InventoryBatch(ServiceBase, TimestampMixin):
    """A received lot with its own expiry, for FIFO/FEFO picking.

    ``grn_id`` points at the purchase service, so it is a bare UUID snapshot.
    Stock that arrived with a purchase order stays traceable to it even if the
    GRN is later voided in that service.
    """

    __tablename__ = "inventory_batches"
    __table_args__ = (
        Index("ix_inv_batches_expiry", "outlet_id", "expiry_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    batch_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    grn_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class StockMovement(ServiceBase, TimestampMixin):
    """Append-only stock ledger.

    Every quantity change writes a row here. Stock levels are therefore
    recomputable from this table alone, which is the only way to audit where
    inventory went. A movement with no corresponding stock change is the bug.

    ``reference_type`` / ``reference_id`` are deliberately loose strings: the
    reference points into whatever service triggered the move (a bill, a GRN,
    a purchase order) and those tables are not here.
    """

    __tablename__ = "stock_movements"
    __table_args__ = (
        Index("ix_inv_movements_item_time", "outlet_id", "inventory_item_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    movement_type: Mapped[MovementType] = mapped_column(
        String(30), nullable=False, index=True
    )
    # Signed: positive for stock in, negative for stock out.
    qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    unit_cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_batches.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class WastageLog(ServiceBase, TimestampMixin):
    """Recorded shrinkage.

    Wastage writes a stock movement of type WASTAGE AND a log row here. The log
    carries the reason and value, which a movement alone cannot express — an
    audit needs to know *why* and *how much it cost*, not just that quantity
    left.
    """

    __tablename__ = "wastage_logs"
    __table_args__ = (
        Index("ix_inv_wastage_outlet_time", "outlet_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    reason: Mapped[WastageReason] = mapped_column(
        String(30), nullable=False, default=WastageReason.OTHER
    )
    loss_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_batches.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class StockAdjustment(ServiceBase, TimestampMixin):
    """A manual recount correction, gated by approval.

    Adjusting stock without approval is how a stockroom hides variance. The
    approval step makes the correction attributable to a person and a reason.
    ``qty_delta`` is the signed difference between counted and recorded.
    """

    __tablename__ = "stock_adjustments"
    __table_args__ = (
        Index("ix_inv_adjustments_status", "outlet_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    recorded_qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    counted_qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    qty_delta: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    status: Mapped[AdjustmentStatus] = mapped_column(
        String(20), default=AdjustmentStatus.PENDING, index=True
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
