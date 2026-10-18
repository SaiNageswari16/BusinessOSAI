"""Menu service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.services.menu.models import CategoryType, ItemType, PricingRuleType


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Categories ──────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(max_length=100)
    slug: str = Field(max_length=100)
    description: str | None = None
    category_type: CategoryType = CategoryType.FOOD
    is_veg_only: bool = False
    sort_order: int = 0
    available_from: str | None = None
    available_to: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    is_veg_only: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    available_from: str | None = None
    available_to: str | None = None


class CategoryResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    slug: str
    description: str | None
    category_type: CategoryType
    is_veg_only: bool
    is_active: bool
    sort_order: int
    available_from: str | None
    available_to: str | None
    created_at: datetime


# ─── Variants / addons ───────────────────────────────────────────────────────

class VariantCreate(BaseModel):
    name: str = Field(max_length=100)
    price_delta: float = 0
    is_default: bool = False
    sort_order: int = 0


class VariantResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    name: str
    price_delta: float
    is_default: bool
    is_active: bool
    sort_order: int


class AddonGroupCreate(BaseModel):
    name: str = Field(max_length=100)
    min_select: int = 0
    max_select: int = 1
    sort_order: int = 0


class AddonGroupResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    name: str
    min_select: int
    max_select: int
    is_active: bool
    sort_order: int


class AddonCreate(BaseModel):
    # Redundant with {group_id} in the path — optional there, optional here.
    group_id: uuid.UUID | None = None
    name: str = Field(max_length=100)
    price: float = 0
    sort_order: int = 0


class AddonResponse(OrmModel):
    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    price: float
    is_active: bool
    sort_order: int


# ─── Items ───────────────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    name: str = Field(max_length=200)
    code: str = Field(max_length=30)
    description: str | None = None
    item_type: ItemType = ItemType.VEG
    short_name: str | None = Field(default=None, max_length=50)
    base_price: float = Field(default=0, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    mrp: float | None = Field(default=None, ge=0)
    prep_time_minutes: int | None = None
    serving_size: str | None = None
    kitchen_station_id: uuid.UUID | None = None
    tax_code_id: uuid.UUID | None = None
    hsn_code: str | None = None
    track_inventory: bool = False
    image_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    sort_order: int = 0


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    item_type: ItemType | None = None
    short_name: str | None = Field(default=None, max_length=50)
    category_id: uuid.UUID | None = None
    base_price: float | None = Field(default=None, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    mrp: float | None = Field(default=None, ge=0)
    prep_time_minutes: int | None = None
    serving_size: str | None = None
    kitchen_station_id: uuid.UUID | None = None
    tax_code_id: uuid.UUID | None = None
    hsn_code: str | None = None
    is_active: bool | None = None
    is_available: bool | None = None
    track_inventory: bool | None = None
    image_url: str | None = None
    tags: list[str] | None = None
    sort_order: int | None = None


class ItemResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    category_id: uuid.UUID | None
    name: str
    code: str
    description: str | None
    item_type: ItemType
    short_name: str | None
    is_active: bool
    is_available: bool
    base_price: float
    cost_price: float | None
    mrp: float | None
    prep_time_minutes: int | None
    serving_size: str | None
    kitchen_station_id: uuid.UUID | None
    tax_code_id: uuid.UUID | None
    hsn_code: str | None
    track_inventory: bool
    image_url: str | None
    tags: list
    sort_order: int
    created_at: datetime
    updated_at: datetime


class ItemDetailResponse(ItemResponse):
    """Item plus its variants and addon groups — the POS pricing view."""

    variants: list[VariantResponse] = Field(default_factory=list)
    addon_groups: list[AddonGroupResponse] = Field(default_factory=list)


# ─── Modifiers ───────────────────────────────────────────────────────────────

class ModifierGroupCreate(BaseModel):
    name: str = Field(max_length=100)
    min_select: int = 0
    max_select: int = 1


class ModifierGroupResponse(OrmModel):
    id: uuid.UUID
    name: str
    min_select: int
    max_select: int
    is_active: bool


class ModifierCreate(BaseModel):
    # Redundant with {group_id} in the path — optional there, optional here.
    group_id: uuid.UUID | None = None
    name: str = Field(max_length=100)
    price_delta: float = 0
    sort_order: int = 0


class ModifierResponse(OrmModel):
    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    price_delta: float
    is_active: bool
    sort_order: int


# ─── Recipes ─────────────────────────────────────────────────────────────────

class RecipeLineCreate(BaseModel):
    inventory_item_id: uuid.UUID
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    wastage_pct: float = Field(default=0, ge=0, le=100)
    is_optional: bool = False


class RecipeLineResponse(OrmModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    qty: float
    uom_id: uuid.UUID | None
    wastage_pct: float
    is_optional: bool


class RecipeCreate(BaseModel):
    name: str = Field(max_length=200)
    variant_id: uuid.UUID | None = None
    yield_qty: float = 1
    yield_uom_id: uuid.UUID | None = None
    instructions: str | None = None
    lines: list[RecipeLineCreate] = Field(default_factory=list)


class RecipeResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None
    name: str
    yield_qty: float
    yield_uom_id: uuid.UUID | None
    instructions: str | None
    is_active: bool
    lines: list[RecipeLineResponse] = Field(default_factory=list)


# ─── Combos ──────────────────────────────────────────────────────────────────

class ComboItemCreate(BaseModel):
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    qty: int = 1


class ComboCreate(BaseModel):
    name: str = Field(max_length=200)
    code: str = Field(max_length=30)
    description: str | None = None
    combo_price: float = Field(ge=0)
    items: list[ComboItemCreate] = Field(default_factory=list)


class ComboItemResponse(OrmModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None
    qty: int


class ComboResponse(OrmModel):
    id: uuid.UUID
    name: str
    code: str
    description: str | None
    combo_price: float
    is_active: bool
    items: list[ComboItemResponse] = Field(default_factory=list)


# ─── Pricing rules ───────────────────────────────────────────────────────────

class PricingRuleCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(max_length=150)
    rule_type: PricingRuleType = PricingRuleType.HAPPY_HOUR
    conditions: dict = Field(default_factory=dict)
    discount_pct: float = Field(default=0, ge=0, le=100)
    priority: int = 0


class PricingRuleResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    rule_type: PricingRuleType
    conditions: dict
    discount_pct: float
    priority: int
    is_active: bool
