"""Inventory, stock, wastage, adjustment, transfer and production schemas."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.inventory import (
    AdjustmentStatus,
    InventoryItemType,
    MovementType,
    StorageLocationType,
    TransferStatus,
    WastageReason,
)


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Categories & locations ──────────────────────────────────────

class InventoryCategoryCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class InventoryCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    is_active: bool | None = None


class InventoryCategoryResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    description: str | None
    is_active: bool
    created_at: datetime


class StorageLocationCreate(BaseModel):
    outlet_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    location_type: StorageLocationType = StorageLocationType.KITCHEN_STORE


class StorageLocationUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    location_type: StorageLocationType | None = None
    is_active: bool | None = None


class StorageLocationResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    location_type: str
    is_active: bool
    created_at: datetime


# ─── Items ───────────────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    item_type: InventoryItemType = InventoryItemType.INGREDIENT
    uom_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    default_location_id: uuid.UUID | None = None
    track_stock: bool = True
    track_batch: bool = False
    track_expiry: bool = False
    allow_negative_stock: bool = False
    reorder_level: float = Field(default=0, ge=0)
    reorder_qty: float = Field(default=0, ge=0)
    standard_cost: float = Field(default=0, ge=0)
    image_url: str | None = Field(default=None, max_length=500)


class InventoryItemUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    item_type: InventoryItemType | None = None
    uom_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    default_location_id: uuid.UUID | None = None
    track_stock: bool | None = None
    track_batch: bool | None = None
    track_expiry: bool | None = None
    allow_negative_stock: bool | None = None
    reorder_level: float | None = Field(default=None, ge=0)
    reorder_qty: float | None = Field(default=None, ge=0)
    standard_cost: float | None = Field(default=None, ge=0)
    image_url: str | None = None
    is_active: bool | None = None


class InventoryItemResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    sku: str | None
    description: str | None
    item_type: str
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
    image_url: str | None
    created_at: datetime
    updated_at: datetime


# ─── Stock ───────────────────────────────────────────────────────

class InventoryStockResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    inventory_item_id: uuid.UUID
    location_id: uuid.UUID | None
    qty_on_hand: float
    qty_reserved: float
    qty_available: float
    avg_cost: float
    last_cost: float
    updated_at: datetime


class StockAdjustLine(BaseModel):
    inventory_item_id: uuid.UUID
    location_id: uuid.UUID | None = None
    counted_qty: float = Field(ge=0)
    unit_cost: float | None = Field(default=None, ge=0)


class StockAdjustRequest(BaseModel):
    """Quick single-item count correction from the stock screen."""
    inventory_item_id: uuid.UUID
    location_id: uuid.UUID | None = None
    counted_qty: float = Field(ge=0)
    reason: str = Field(min_length=1, max_length=500)
    unit_cost: float | None = Field(default=None, ge=0)


class LowStockItem(BaseModel):
    inventory_item_id: uuid.UUID
    name: str
    code: str
    qty_available: float
    reorder_level: float
    reorder_qty: float
    uom_id: uuid.UUID | None


# ─── Movements ───────────────────────────────────────────────────

class StockMovementResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    inventory_item_id: uuid.UUID
    location_id: uuid.UUID | None
    movement_type: str
    qty: float
    uom_id: uuid.UUID | None
    unit_cost: float
    reference_type: str | None
    reference_id: str | None
    batch_id: uuid.UUID | None
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime


class StockMovementCreate(BaseModel):
    """Manual stock entry — opening stock or an unrecorded correction."""
    outlet_id: uuid.UUID
    inventory_item_id: uuid.UUID
    location_id: uuid.UUID | None = None
    movement_type: MovementType
    qty: float
    uom_id: uuid.UUID | None = None
    unit_cost: float = Field(default=0, ge=0)
    reference_type: str | None = Field(default=None, max_length=50)
    reference_id: str | None = Field(default=None, max_length=100)
    notes: str | None = None


# ─── Wastage ─────────────────────────────────────────────────────

class WastageCreate(BaseModel):
    outlet_id: uuid.UUID
    inventory_item_id: uuid.UUID | None = None
    menu_item_id: uuid.UUID | None = None
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    reason: WastageReason
    cost: float | None = Field(default=None, ge=0)
    notes: str | None = None


class WastageUpdate(BaseModel):
    qty: float | None = Field(default=None, gt=0)
    reason: WastageReason | None = None
    cost: float | None = Field(default=None, ge=0)
    notes: str | None = None


class WastageResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    wastage_number: str
    inventory_item_id: uuid.UUID | None
    menu_item_id: uuid.UUID | None
    qty: float
    uom_id: uuid.UUID | None
    reason: str
    cost: float
    notes: str | None
    logged_by: uuid.UUID | None
    approved_by: uuid.UUID | None
    is_approved: bool
    created_at: datetime


# ─── Stock adjustments ───────────────────────────────────────────

class StockAdjustmentCreate(BaseModel):
    outlet_id: uuid.UUID
    reason: str = Field(min_length=1)
    lines: list[StockAdjustLine] = Field(min_length=1)


class StockAdjustmentLineResponse(ORMBase):
    id: uuid.UUID
    adjustment_id: uuid.UUID
    inventory_item_id: uuid.UUID
    location_id: uuid.UUID | None
    system_qty: float
    counted_qty: float
    variance_qty: float
    unit_cost: float


class StockAdjustmentResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    adjustment_number: str
    reason: str
    status: str
    variance_qty: float
    variance_value: float
    created_by: uuid.UUID | None
    approved_by: uuid.UUID | None
    approved_at: str | None
    lines: list[StockAdjustmentLineResponse] = Field(default_factory=list)
    created_at: datetime


# ─── Inter-outlet transfers ──────────────────────────────────────

class TransferLineIn(BaseModel):
    inventory_item_id: uuid.UUID
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None


class TransferLineReceive(BaseModel):
    line_id: uuid.UUID
    received_qty: float = Field(ge=0)


class TransferCreate(BaseModel):
    from_outlet_id: uuid.UUID
    to_outlet_id: uuid.UUID
    notes: str | None = None
    lines: list[TransferLineIn] = Field(min_length=1)


class TransferReceiveRequest(BaseModel):
    lines: list[TransferLineReceive] = Field(min_length=1)
    notes: str | None = None


class TransferLineResponse(ORMBase):
    id: uuid.UUID
    transfer_id: uuid.UUID
    inventory_item_id: uuid.UUID
    qty: float
    uom_id: uuid.UUID | None
    sent_qty: float
    received_qty: float
    variance_qty: float


class TransferResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    from_outlet_id: uuid.UUID
    to_outlet_id: uuid.UUID
    transfer_number: str
    status: str
    dispatched_at: str | None
    received_at: str | None
    received_by: uuid.UUID | None
    notes: str | None
    lines: list[TransferLineResponse] = Field(default_factory=list)
    created_at: datetime


# ─── Production batches ──────────────────────────────────────────

class ProductionBatchCreate(BaseModel):
    outlet_id: uuid.UUID
    recipe_id: uuid.UUID | None = None
    produced_qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    cost: float = Field(default=0, ge=0)
    expiry_at: str | None = Field(default=None, max_length=50)
    notes: str | None = None


class ProductionBatchResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    recipe_id: uuid.UUID | None
    batch_number: str
    produced_qty: float
    uom_id: uuid.UUID | None
    produced_at: str | None
    produced_by: uuid.UUID | None
    expiry_at: str | None
    cost: float
    notes: str | None
    created_at: datetime


class ConsumptionReportRow(BaseModel):
    inventory_item_id: uuid.UUID
    item_name: str
    total_consumed: float
    total_cost: float
    uom_id: uuid.UUID | None


class ConsumptionReport(BaseModel):
    outlet_id: uuid.UUID
    date_from: date
    date_to: date
    rows: list[ConsumptionReportRow] = Field(default_factory=list)
    total_cost: float = 0


class AdjustmentStatusRef(BaseModel):
    """Reference for enum values used by clients."""
    statuses: list[str] = [s.value for s in AdjustmentStatus]
    transfer_statuses: list[str] = [s.value for s in TransferStatus]
