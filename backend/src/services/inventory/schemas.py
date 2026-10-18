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


class StorageLocationResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    name: str
    location_type: StorageLocationType
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
    outlet_id: uuid.UUID
    item_id: uuid.UUID
    qty_counted: float | None = None
    counted_qty: float | None = None
    location_id: uuid.UUID | None = None
    reason: str | None = None
