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


class ExpiryStatus(str, enum.Enum):
    """Where a batch stands against its expiry date at check time — this is
    what a FEFO gate reports, not just whether an item has expiry tracking
    on at all."""
    OK = "ok"
    EXPIRING = "expiring"
    EXPIRED = "expired"


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
    # Sale price of the finished good. Null for an ingredient — cost is what
    # the item is worth on the shelf; the barcode/label printouts use it.
    selling_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Phase 2 (product catalog + barcodes): the scannable identity of the
    # item. Nullable because an item exists before anyone labels it, and the
    # barcode generator fills it in later. Uniqueness is per database (this
    # service owns one tenant estate), across items AND batches — see
    # ``barcode_engine.is_unique``.
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

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
    module: Mapped[str] = mapped_column(String(50), default="restaurant", index=True)
    is_central: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    parent_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"),
        nullable=True, index=True,
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
    # When the lot was made. Paired with ``expiry_date`` it gives the age
    # buckets the manufacturing-cohort report reads; a lot with no
    # manufacturing date is simply not counted in a cohort.
    manufacturing_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    # Lot status: "Available", "Consumed" (written off), "Quarantined".
    # Plain String, per the house rule for status columns.
    status: Mapped[str] = mapped_column(String(30), default="Available", index=True)
    supplier: Mapped[str | None] = mapped_column(String(150), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    cost: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    grn_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # A lot can carry its own scannable label (case stickers, pallet tags).
    # Uniqueness is checked across items AND lots — see barcode_engine.
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)


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



class InventoryBrand(ServiceBase, TimestampMixin):
    """A brand for the product catalog.

    ``outlet_id`` NULL means the brand is org-level (shared by every outlet);
    set, it belongs to one outlet only. No brand model existed before Phase 2,
    and the inventory service is where the product master lives, so it owns
    the table rather than borrowing the organization's.
    """

    __tablename__ = "inventory_brands"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_inv_brand_name"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryQRCode(ServiceBase, TimestampMixin):
    """A printed QR label for an item.

    ``code`` is the payload the QR encodes — a URL for the item's page, or
    any other machine-readable string. ``active`` is a soft flag so a label
    can be retired without losing its print history.
    """

    __tablename__ = "inventory_qrcodes"
    __table_args__ = (
        Index("ix_inv_qrcodes_item", "tenant_id", "item_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    # Same service, same database — a real foreign key is correct here.
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )
    code: Mapped[str] = mapped_column(String(250), nullable=False)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # The machine-readable payload the printed QR encodes — a URL to the
    # item's page or any other string. The frontend label manager speaks
    # this field's name (``qr_data``); ``code`` stays as the human label
    # text printed next to it. The frontend's ``product_id`` is this
    # estate's ``item_id`` — the API maps between the two names.
    qr_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Encoding metadata: which QR type/version the label uses, and how
    # aggressively it is corrected so it stays readable when torn.
    qr_type: Mapped[str] = mapped_column(String(30), default="QR")
    version: Mapped[str | None] = mapped_column(String(10), nullable=True)
    error_correction: Mapped[str | None] = mapped_column(String(10), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    print_count: Mapped[int] = mapped_column(Integer, default=0)
    last_printed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class InventoryRFIDTag(ServiceBase, TimestampMixin):
    """An RFID tag bound to an item.

    ``rfid`` is the tag's own UID (EPC/TID as written on the tag). It is
    unique per tenant: the same physical tag must not be bound to two items
    in one estate, because a scan resolves to exactly one item.
    """

    __tablename__ = "inventory_rfid_tags"
    __table_args__ = (
        UniqueConstraint("tenant_id", "rfid", name="uq_inv_rfid_value"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    rfid: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Tag hardware description: the kind of tag (UHF EPC, HF, etc.), the
    # operating frequency and the protocol it speaks. The frontend's
    # ``tag_uid`` is this estate's ``rfid`` column; the API maps between
    # the two names.
    tag_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(30), nullable=True)
    protocol: Mapped[str | None] = mapped_column(String(30), nullable=True)
    memory_bits: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # How many times the tag has been written to, and when/where it was last
    # read. A scan bumps ``write_count`` and stamps the location, which is
    # what makes a tag's movement history auditable.
    write_count: Mapped[int] = mapped_column(Integer, default=0)
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_seen_location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class InventoryCycleCount(ServiceBase, TimestampMixin):
    """A stocktake of one outlet.

    Status is a plain String, per house rule: ``draft`` (snapshot taken, no
    counts recorded), ``in_progress`` (counts coming in), ``approved`` (the
    variances have been posted to the ledger). Approval is the gate — a
    count never moves stock by itself.
    """

    __tablename__ = "inventory_cycle_counts"
    __table_args__ = (
        Index("ix_inv_cycle_counts_outlet", "outlet_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    count_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    count_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_variance: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class InventoryCycleCountItem(ServiceBase, TimestampMixin):
    """One line of a cycle count: what the system thought, what was counted.

    ``system_qty`` is the snapshot taken when the count was opened, so a
    later stock movement cannot silently rewrite the baseline the counter
    was counting against.
    """

    __tablename__ = "inventory_cycle_count_items"
    __table_args__ = (
        UniqueConstraint(
            "count_id", "item_id", name="uq_inv_cycle_count_item"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    count_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_cycle_counts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_locations.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    system_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    counted_qty: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True)
    diff: Mapped[float] = mapped_column(Numeric(14, 4), default=0)


class ExpiryWriteOff(ServiceBase, TimestampMixin):
    """An audited write-off of an expired lot.

    A write-off zeroes the batch's remaining quantity and stamps its status
    "Consumed" — but the audit needs to know *how much* was written off,
    *why*, and *by whom*, so that fact lives in a dedicated row rather than
    only in the batch's free-text notes. One write-off per lot line.
    """

    __tablename__ = "inventory_expiry_write_offs"
    __table_args__ = (
        Index("ix_inv_write_offs_batch", "tenant_id", "batch_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    qty_written_off: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    reason: Mapped[str] = mapped_column(String(100), default="expired")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )


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
    source_service: Mapped[str] = mapped_column(String(50), default="inventory")
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
