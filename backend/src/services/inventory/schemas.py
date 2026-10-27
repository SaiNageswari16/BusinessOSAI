"""Inventory service schemas."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from src.services.inventory.models import (
    AdjustmentStatus,
    InventoryItemType,
    MovementType,
    StorageLocationType,
    WastageReason,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Items ───────────────────────────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=30)
    sku: str | None = Field(default=None, max_length=50)
    description: str | None = None
    item_type: InventoryItemType = InventoryItemType.INGREDIENT
    uom_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    default_location_id: uuid.UUID | None = None
    track_stock: bool = True
    track_batch: bool = False
    track_expiry: bool = False
    allow_negative_stock: bool = False
    reorder_level: float = Field(ge=0, default=0)
    reorder_qty: float = Field(ge=0, default=0)
    standard_cost: float = Field(ge=0, default=0)
    outlet_id: uuid.UUID | None = None


class InventoryItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    item_type: InventoryItemType | None = None
    standard_cost: float | None = Field(default=None, ge=0)
    reorder_level: float | None = Field(default=None, ge=0)
    reorder_qty: float | None = Field(default=None, ge=0)
    is_active: bool | None = None
    allow_negative_stock: bool | None = None


class InventoryItemResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    sku: str | None
    description: str | None
    item_type: InventoryItemType
    uom_id: uuid.UUID | None
    category_id: uuid.UUID | None
    default_location_id: uuid.UUID | None
    track_stock: bool
    track_batch: bool
    track_expiry: bool
    allow_negative_stock: bool
    reorder_level: float
    reorder_qty: float
    standard_cost: float
    is_active: bool
    created_at: datetime


class StockResponse(OrmModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    outlet_id: uuid.UUID
    location_id: uuid.UUID | None
    qty_on_hand: float
    qty_reserved: float
    qty_available: float
    avg_cost: float
    last_cost: float


class ItemWithStockResponse(OrmModel):
    """Item plus its per-location stock, for the stockroom board."""

    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    item_type: InventoryItemType
    standard_cost: float
    reorder_level: float
    is_active: bool
    stocks: list[StockResponse] = Field(default_factory=list)
    total_on_hand: float = 0.0
    total_available: float = 0.0


# ─── Locations ───────────────────────────────────────────────────────────────

class StorageLocationCreate(BaseModel):
    outlet_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    location_type: StorageLocationType = StorageLocationType.KITCHEN_STORE
    module: str = Field(default="restaurant", max_length=50)
    is_central: bool = False
    parent_location_id: uuid.UUID | None = None


class StorageLocationResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    location_type: StorageLocationType
    module: str = "restaurant"
    is_central: bool = False
    parent_location_id: uuid.UUID | None = None
    is_active: bool
    created_at: datetime


# ─── Movements ───────────────────────────────────────────────────────────────

class OpeningStockIn(BaseModel):
    """Set opening stock, which is also the first stock movement."""

    qty: float = Field(gt=0)
    unit_cost: float = Field(ge=0, default=0)
    location_id: uuid.UUID | None = None


class MovementResponse(OrmModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    outlet_id: uuid.UUID
    location_id: uuid.UUID | None
    movement_type: MovementType
    qty: float
    unit_cost: float
    reference_type: str | None
    reference_id: str | None
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime


# ─── Wastage ────────────────────────────────────────────────────────────────

class WastageIn(BaseModel):
    qty: float = Field(gt=0)
    reason: WastageReason = WastageReason.OTHER
    batch_id: uuid.UUID | None = None
    notes: str | None = None


class WastageResponse(OrmModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    outlet_id: uuid.UUID
    qty: float
    reason: WastageReason
    loss_amount: float
    batch_id: uuid.UUID | None
    notes: str | None
    created_at: datetime


# ─── Adjustments ─────────────────────────────────────────────────────────────

class AdjustmentRequest(BaseModel):
    """Propose a recount correction for approval."""

    counted_qty: float = Field(ge=0)
    location_id: uuid.UUID | None = None
    reason: str | None = None


class AdjustmentApprove(BaseModel):
    approve: bool
    reason: str | None = None


class AdjustmentResponse(OrmModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    outlet_id: uuid.UUID
    location_id: uuid.UUID | None
    recorded_qty: float
    counted_qty: float
    qty_delta: float
    status: AdjustmentStatus
    reason: str | None
    requested_by: uuid.UUID | None
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    created_at: datetime


# ─── Recipe deduction ────────────────────────────────────────────────────────

class RecipeLineSnapshot(BaseModel):
    """One ingredient need for a single portion.

    Pulled from the menu service's recipe over HTTP — recipes are not in this
    database, and a FK to them would be a cross-service foreign key. Snapshotting
    also means a later recipe edit does not rewrite what a sold dish consumed.
    """

    inventory_item_id: uuid.UUID
    qty_per_portion: float = Field(gt=0)


class DeductionResult(BaseModel):
    """What a recipe deduction actually did, per ingredient."""

    inventory_item_id: uuid.UUID
    required: float
    deducted: float
    short: float
    shortage: bool = False
    movement_id: uuid.UUID | None = None


# ─── Categories & Adjustments ────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    outlet_id: uuid.UUID | None = None
    description: str | None = None


class CategoryResponse(OrmModel):
    id: uuid.UUID
    name: str
    outlet_id: uuid.UUID | None = None
    is_active: bool = True
    created_at: datetime


class QuickAdjustmentCreate(BaseModel):
    item_id: str
    outlet_id: uuid.UUID | None = None
    qty_counted: float | None = None
    counted_qty: float | None = None
    qty_delta: float | None = None
    location_id: uuid.UUID | None = None
    reason: str | None = None


# ─── Stock Transfers (Hub & Spoke / Central to Module) ───────────────────────

class StockTransferCreate(BaseModel):
    outlet_id: uuid.UUID
    inventory_item_id: uuid.UUID
    source_location_id: uuid.UUID
    destination_location_id: uuid.UUID
    qty: float = Field(gt=0)
    notes: str | None = None


class StockTransferResponse(BaseModel):
    item_id: uuid.UUID
    item_name: str
    source_location_id: uuid.UUID
    source_location_name: str
    destination_location_id: uuid.UUID
    destination_location_name: str
    qty: float
    source_movement_id: uuid.UUID
    destination_movement_id: uuid.UUID
    transferred_at: datetime


# ─── Batches & FEFO ─────────────────────────────────────────────────────────

class BatchResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    inventory_item_id: uuid.UUID
    location_id: uuid.UUID | None
    batch_number: str
    expiry_date: date | None
    qty: float
    cost: float
    grn_id: uuid.UUID | None
    created_at: datetime


class BatchListResponse(BaseModel):
    items: list[BatchResponse]
    total: int


class ExpiryScanEntry(BaseModel):
    batch_id: uuid.UUID
    batch_number: str
    inventory_item_id: uuid.UUID
    item_name: str | None = None
    qty: float
    expiry_date: str
    status: str  # "expired" | "expiring" | "ok"


class ExpiryScanResponse(BaseModel):
    items: list[ExpiryScanEntry]
    total: int
    within_days: int


# ─── Manual stock-in (no GRN) ────────────────────────────────────────────────

class StockInRequest(BaseModel):
    qty: float = Field(gt=0)
    unit_cost: float | None = Field(default=None, ge=0)
    location_id: uuid.UUID | None = None
    notes: str | None = None


class StockInResponse(BaseModel):
    movement_id: uuid.UUID
    qty: float
    location_id: uuid.UUID | None
    reference_type: str


# ─── Global & Module Multi-Tier Inventory Rollup ─────────────────────────────

class ModuleStockBreakdown(BaseModel):
    location_id: uuid.UUID
    location_name: str
    module: str
    location_type: str
    is_central: bool
    qty_on_hand: float
    qty_available: float


class GlobalItemRollup(BaseModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    sku: str | None
    item_type: InventoryItemType
    standard_cost: float
    reorder_level: float
    is_active: bool
    total_global_on_hand: float
    total_global_available: float
    central_warehouse_on_hand: float
    module_stocks: list[ModuleStockBreakdown] = Field(default_factory=list)
    stock_status: str  # "OK", "Low", "Critical"


class GlobalInventoryOverview(BaseModel):
    total_items: int
    total_value: float
    central_warehouse_value: float
    module_values: dict[str, float] = Field(default_factory=dict)
    low_stock_count: int
    critical_stock_count: int
    items: list[GlobalItemRollup] = Field(default_factory=list)


# ─── Module Direct Stock Consumption (POS / Kitchen) ────────────────────────

class StockConsumptionCreate(BaseModel):
    outlet_id: uuid.UUID
    inventory_item_id: uuid.UUID
    location_id: uuid.UUID | None = None
    module: str = "restaurant"
    qty: float = Field(gt=0)
    reference_type: str = "pos_sale"
    reference_id: str | None = None
    notes: str | None = None


# ─── Barcodes / QR / RFID identifiers (label management) ───────────────────

class BarcodeEntry(OrmModel):
    """One row of the barcode list: the item's identity plus its code."""
    id: uuid.UUID
    product_name: str
    sku: str | None = None
    barcode: str | None = None
    format: str | None = None
    selling_price: float | None = None
    image_url: str | None = None
    category_name: str | None = None


class BarcodePeek(BaseModel):
    """The next unique barcode, computed but not yet persisted."""
    barcode: str
    format: str
    is_unique: bool = True


class BarcodeGenerated(BaseModel):
    barcode: str
    format: str
    is_unique: bool = True
    product_id: uuid.UUID | None = None
    product_name: str | None = None
    note: str | None = None


class BulkBarcodeResult(BaseModel):
    message: str
    generated_count: int
    products: list[BarcodeEntry] = Field(default_factory=list)


class BatchPrintPayload(BaseModel):
    """The label data the frontend turns into print media.

    String-only on purpose — no server-side image generation. The client
    owns how the label looks (font, size, silent-printer layout).
    """
    printed: int
    labels: list[BarcodeEntry] = Field(default_factory=list)
    products: list[BarcodeEntry] = Field(default_factory=list)


class BatchPrintIn(BaseModel):
    product_ids: list[uuid.UUID] = Field(default_factory=list)


class BarcodeLookup(BaseModel):
    found: bool
    barcode: str | None = None
    item: BarcodeEntry | None = None
    message: str | None = None


# ─── Expiry & manufacturing cohort reports ─────────────────────────────────

class BucketStats(BaseModel):
    count: int
    units: int


class ExpirySummaryResponse(BaseModel):
    today: str
    expired: BucketStats
    expiring_30: BucketStats
    expiring_90: BucketStats
    no_expiry: BucketStats | None = None


class ExpiryBatchItem(OrmModel):
    id: uuid.UUID
    batch_number: str
    product_name: str | None = None
    sku: str | None = None
    warehouse_name: str | None = None
    quantity: float
    remaining_quantity: float
    manufacturing_date: date | None = None
    expiry_date: date | None = None
    status: str
    days_to_expiry: int | None = None
    supplier: str | None = None


class ManufacturingCohorts(BaseModel):
    today: str
    cohorts: dict[str, BucketStats]
    serials_tracked: int


class WriteOffResult(BaseModel):
    message: str
    batch_id: uuid.UUID
    qty_written_off: float


# ─── QR codes ──────────────────────────────────────────────────────────────

class QRCodeIn(BaseModel):
    item_id: uuid.UUID | None = None
    # The frontend sends its own field name for the item binding.
    product_id: uuid.UUID | None = None
    # Either ``code`` or ``qr_data`` is required; ``qr_data`` is the
    # frontend's name for the machine-readable payload.
    code: str | None = None
    qr_data: str | None = None
    label: str | None = None
    qr_type: str = "QR"
    version: str | None = None
    error_correction: str | None = None
    active: bool = True
    outlet_id: uuid.UUID | None = None
    notes: str | None = None

    def resolve(self) -> tuple[str, str | None]:
        """Return the mandatory code and the payload to store."""
        code = self.code or self.qr_data
        if not code:
            raise ValueError("A QR payload is required (code or qr_data)")
        return code, (self.qr_data or self.code)


class QRCodeUpdate(BaseModel):
    code: str | None = None
    qr_data: str | None = None
    label: str | None = None
    qr_type: str | None = None
    version: str | None = None
    error_correction: str | None = None
    active: bool | None = None
    item_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    outlet_id: uuid.UUID | None = None
    notes: str | None = None


class QRCodeResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    item_id: uuid.UUID | None
    product_id: uuid.UUID | None = None
    code: str
    qr_data: str | None
    label: str | None
    qr_type: str
    version: str | None
    error_correction: str | None
    active: bool
    outlet_id: uuid.UUID | None
    print_count: int
    last_printed_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class QRPrintResult(BaseModel):
    message: str
    print_count: int
    id: uuid.UUID


# ─── RFID tags ─────────────────────────────────────────────────────────────

class RFIDIn(BaseModel):
    item_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    # Either ``rfid`` or ``tag_uid`` (the frontend's name for it).
    rfid: str | None = Field(default=None, max_length=50)
    tag_uid: str | None = Field(default=None, max_length=50)
    status: str = "active"
    tag_type: str | None = None
    frequency: str | None = None
    protocol: str | None = None
    memory_bits: int | None = None
    label: str | None = None
    outlet_id: uuid.UUID | None = None
    notes: str | None = None


class RFIDUpdate(BaseModel):
    rfid: str | None = None
    tag_uid: str | None = None
    status: str | None = None
    tag_type: str | None = None
    frequency: str | None = None
    protocol: str | None = None
    memory_bits: int | None = None
    label: str | None = None
    item_id: uuid.UUID | None = None
    product_id: uuid.UUID | None = None
    outlet_id: uuid.UUID | None = None
    notes: str | None = None


class RFIDResponse(OrmModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    item_id: uuid.UUID | None
    product_id: uuid.UUID | None = None
    rfid: str
    tag_uid: str | None = None
    status: str
    tag_type: str | None
    frequency: str | None
    protocol: str | None
    memory_bits: int | None
    label: str | None
    outlet_id: uuid.UUID | None
    write_count: int
    last_seen_at: datetime | None
    last_seen_location: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

