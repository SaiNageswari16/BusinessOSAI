"""Menu, recipe, combo and pricing schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.menu import CategoryType, ItemType, PricingRuleType


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Categories ──────────────────────────────────────────────────

class MenuCategoryCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    category_type: CategoryType = CategoryType.FOOD
    is_veg_only: bool = False
    sort_order: int = 0
    available_from: str | None = Field(default=None, max_length=5)
    available_to: str | None = Field(default=None, max_length=5)
    image_url: str | None = Field(default=None, max_length=500)


class MenuCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    category_type: CategoryType | None = None
    is_veg_only: bool | None = None
    sort_order: int | None = None
    available_from: str | None = Field(default=None, max_length=5)
    available_to: str | None = Field(default=None, max_length=5)
    image_url: str | None = None
    is_active: bool | None = None


class MenuCategoryResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    slug: str
    description: str | None
    category_type: str
    is_veg_only: bool
    is_active: bool
    sort_order: int
    available_from: str | None
    available_to: str | None
    image_url: str | None
    created_at: datetime


# ─── Items ───────────────────────────────────────────────────────

class MenuItemCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    description: str | None = None
    item_type: ItemType = ItemType.VEG
    base_price: float = Field(ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    mrp: float | None = Field(default=None, ge=0)
    prep_time_minutes: int | None = None
    serving_size: str | None = Field(default=None, max_length=100)
    kitchen_station_id: uuid.UUID | None = None
    tax_code_id: uuid.UUID | None = None
    hsn_code: str | None = Field(default=None, max_length=20)
    track_inventory: bool = False
    image_url: str | None = Field(default=None, max_length=500)
    tags: list[str] = Field(default_factory=list)
    sort_order: int = 0


class MenuItemUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = Field(default=None, max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    description: str | None = None
    item_type: ItemType | None = None
    base_price: float | None = Field(default=None, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    mrp: float | None = Field(default=None, ge=0)
    prep_time_minutes: int | None = None
    serving_size: str | None = Field(default=None, max_length=100)
    kitchen_station_id: uuid.UUID | None = None
    tax_code_id: uuid.UUID | None = None
    hsn_code: str | None = Field(default=None, max_length=20)
    track_inventory: bool | None = None
    image_url: str | None = None
    tags: list[str] | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class MenuItemAvailabilityUpdate(BaseModel):
    """Quick toggle used by the POS floor — sold out / back in stock."""
    is_available: bool


class MenuItemResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    category_id: uuid.UUID | None
    name: str
    code: str
    short_name: str | None
    description: str | None
    item_type: str
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


# ─── Variants (portion sizes) ────────────────────────────────────

class MenuItemVariantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    is_default: bool = False
    sort_order: int = 0


class MenuItemVariantUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    price: float | None = Field(default=None, ge=0)
    cost_price: float | None = Field(default=None, ge=0)
    is_default: bool | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class MenuItemVariantResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    menu_item_id: uuid.UUID
    name: str
    price: float
    cost_price: float | None
    is_default: bool
    is_active: bool
    sort_order: int


# ─── Addon groups & addons ───────────────────────────────────────

class MenuItemAddonGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    min_selections: int = Field(default=0, ge=0)
    max_selections: int = Field(default=1, ge=0)
    is_required: bool = False
    sort_order: int = 0


class MenuItemAddonGroupUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    min_selections: int | None = Field(default=None, ge=0)
    max_selections: int | None = Field(default=None, ge=0)
    is_required: bool | None = None
    sort_order: int | None = None


class MenuItemAddonGroupResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    menu_item_id: uuid.UUID
    name: str
    min_selections: int
    max_selections: int
    is_required: bool
    sort_order: int


class MenuItemAddonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(default=0, ge=0)
    is_veg: bool = True
    sort_order: int = 0


class MenuItemAddonUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    price: float | None = Field(default=None, ge=0)
    is_veg: bool | None = None
    sort_order: int | None = None
    is_available: bool | None = None


class MenuItemAddonResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    addon_group_id: uuid.UUID
    name: str
    price: float
    is_veg: bool
    is_available: bool
    sort_order: int


# ─── Reusable modifier groups ────────────────────────────────────

class ModifierGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    min_selections: int = Field(default=0, ge=0)
    max_selections: int = Field(default=1, ge=0)
    is_required: bool = False


class ModifierGroupUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    min_selections: int | None = Field(default=None, ge=0)
    max_selections: int | None = Field(default=None, ge=0)
    is_required: bool | None = None
    is_active: bool | None = None


class ModifierGroupResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    min_selections: int
    max_selections: int
    is_required: bool
    is_active: bool


class ModifierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(default=0, ge=0)
    is_default: bool = False
    sort_order: int = 0


class ModifierUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    price: float | None = Field(default=None, ge=0)
    is_default: bool | None = None
    sort_order: int | None = None
    is_available: bool | None = None


class ModifierResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    group_id: uuid.UUID
    name: str
    price: float
    is_default: bool
    is_available: bool
    sort_order: int


# ─── Recipes ─────────────────────────────────────────────────────

class RecipeLineCreate(BaseModel):
    ingredient_id: uuid.UUID
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    wastage_pct: float = Field(default=0, ge=0, le=100)
    is_optional: bool = False


class RecipeLineUpdate(BaseModel):
    qty: float | None = Field(default=None, gt=0)
    uom_id: uuid.UUID | None = None
    wastage_pct: float | None = Field(default=None, ge=0, le=100)
    is_optional: bool | None = None


class RecipeLineResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    recipe_id: uuid.UUID
    ingredient_id: uuid.UUID
    qty: float
    uom_id: uuid.UUID | None
    wastage_pct: float
    is_optional: bool


class RecipeUpsert(BaseModel):
    """PUT semantics — creates or replaces the recipe header for an item."""
    variant_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    yield_qty: float = Field(default=1, gt=0)
    yield_uom_id: uuid.UUID | None = None
    instructions: str | None = None
    is_active: bool = True
    lines: list[RecipeLineCreate] = Field(default_factory=list)


class RecipeResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None
    name: str
    yield_qty: float
    yield_uom_id: uuid.UUID | None
    instructions: str | None
    is_active: bool
    lines: list[RecipeLineResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ─── Combos ──────────────────────────────────────────────────────

class ComboCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    combo_price: float = Field(ge=0)
    available_from: str | None = Field(default=None, max_length=5)
    available_to: str | None = Field(default=None, max_length=5)
    image_url: str | None = Field(default=None, max_length=500)


class ComboUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    combo_price: float | None = Field(default=None, ge=0)
    available_from: str | None = Field(default=None, max_length=5)
    available_to: str | None = Field(default=None, max_length=5)
    image_url: str | None = None
    is_active: bool | None = None


class ComboResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    description: str | None
    combo_price: float
    is_active: bool
    available_from: str | None
    available_to: str | None
    image_url: str | None
    created_at: datetime


class ComboItemCreate(BaseModel):
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None = None
    qty: int = Field(default=1, ge=1)
    is_choice: bool = False
    choice_group: str | None = Field(default=None, max_length=50)


class ComboItemUpdate(BaseModel):
    qty: int | None = Field(default=None, ge=1)
    is_choice: bool | None = None
    choice_group: str | None = Field(default=None, max_length=50)


class ComboItemResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    combo_id: uuid.UUID
    menu_item_id: uuid.UUID
    variant_id: uuid.UUID | None
    qty: int
    is_choice: bool
    choice_group: str | None


# ─── Pricing rules ───────────────────────────────────────────────

class PricingRuleCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    menu_item_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    rule_type: PricingRuleType = PricingRuleType.HAPPY_HOUR
    discount_pct: float | None = Field(default=None, ge=0, le=100)
    discount_amount: float | None = Field(default=None, ge=0)
    valid_from: str | None = Field(default=None, max_length=5)
    valid_to: str | None = Field(default=None, max_length=5)
    days_of_week: list[int] = Field(default_factory=list)
    priority: int = 0


class PricingRuleUpdate(BaseModel):
    menu_item_id: uuid.UUID | None = None
    name: str | None = Field(default=None, max_length=200)
    rule_type: PricingRuleType | None = None
    discount_pct: float | None = Field(default=None, ge=0, le=100)
    discount_amount: float | None = Field(default=None, ge=0)
    valid_from: str | None = Field(default=None, max_length=5)
    valid_to: str | None = Field(default=None, max_length=5)
    days_of_week: list[int] | None = None
    priority: int | None = None
    is_active: bool | None = None


class PricingRuleResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    menu_item_id: uuid.UUID | None
    name: str
    rule_type: str
    discount_pct: float | None
    discount_amount: float | None
    valid_from: str | None
    valid_to: str | None
    days_of_week: list
    priority: int
    is_active: bool
    created_at: datetime
