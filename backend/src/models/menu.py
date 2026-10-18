import enum
import uuid

from sqlalchemy import (
    Boolean,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
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


# ─── Categories ───────────────────────────────────────────────────

class CategoryType(str, enum.Enum):
    FOOD = "food"
    BEVERAGE = "beverage"
    DESSERT = "dessert"
    COMBO = "combo"
    ADDON = "addon"


class MenuCategory(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "menu_categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_tenant_category_slug"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_type: Mapped[CategoryType] = mapped_column(
        db_enum(CategoryType, name="category_type"), default=CategoryType.FOOD
    )
    is_veg_only: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # Time-based menus (breakfast / lunch / dinner). NULL = always available.
    available_from: Mapped[str | None] = mapped_column(String(5), nullable=True)
    available_to: Mapped[str | None] = mapped_column(String(5), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    items: Mapped[list["MenuItem"]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )


# ─── Items ────────────────────────────────────────────────────────

class ItemType(str, enum.Enum):
    VEG = "veg"
    EGG = "egg"
    NON_VEG = "non_veg"
    VEGAN = "vegan"


class MenuItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "menu_items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_menu_item_code"),
        Index("ix_menu_items_outlet_category", "outlet_id", "category_id", "is_available"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    item_type: Mapped[ItemType] = mapped_column(
        db_enum(ItemType, name="item_type"), default=ItemType.VEG
    )
    short_name: Mapped[str | None] = mapped_column(String(50), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    base_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    cost_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=True)
    mrp: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    prep_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    serving_size: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Default kitchen routing
    kitchen_station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kitchen_stations.id", ondelete="SET NULL"), nullable=True, index=True
    )

    tax_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tax_codes.id", ondelete="SET NULL"), nullable=True
    )
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Drives automatic recipe-based stock deduction on bill settlement
    track_inventory: Mapped[bool] = mapped_column(Boolean, default=False)

    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    category: Mapped["MenuCategory | None"] = relationship(back_populates="items", foreign_keys=[category_id])
    variants: Mapped[list["MenuItemVariant"]] = relationship(
        back_populates="menu_item", cascade="all, delete-orphan"
    )
    addon_groups: Mapped[list["MenuItemAddonGroup"]] = relationship(
        back_populates="menu_item", cascade="all, delete-orphan"
    )
    recipe: Mapped["Recipe | None"] = relationship(
        back_populates="menu_item", cascade="all, delete-orphan", uselist=False
    )


class MenuItemVariant(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Portion sizes — Half / Full / Regular / Large."""

    __tablename__ = "menu_item_variants"

    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    cost_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    menu_item: Mapped["MenuItem"] = relationship(back_populates="variants", foreign_keys=[menu_item_id])


class MenuItemAddonGroup(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "menu_item_addon_groups"

    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_selections: Mapped[int] = mapped_column(Integer, default=0)
    max_selections: Mapped[int] = mapped_column(Integer, default=1)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    menu_item: Mapped["MenuItem"] = relationship(back_populates="addon_groups", foreign_keys=[menu_item_id])
    addons: Mapped[list["MenuItemAddon"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class MenuItemAddon(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "menu_item_addons"

    addon_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_item_addon_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    is_veg: Mapped[bool] = mapped_column(Boolean, default=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    group: Mapped["MenuItemAddonGroup"] = relationship(back_populates="addons", foreign_keys=[addon_group_id])


# ─── Reusable modifier groups ────────────────────────────────────

class ModifierGroup(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Reusable sets like "Spice Level", "Sugar Level", "Extra Cheese"."""

    __tablename__ = "modifier_groups"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_selections: Mapped[int] = mapped_column(Integer, default=0)
    max_selections: Mapped[int] = mapped_column(Integer, default=1)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    modifiers: Mapped[list["Modifier"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class Modifier(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "modifiers"

    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modifier_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    group: Mapped["ModifierGroup"] = relationship(back_populates="modifiers", foreign_keys=[group_id])


# ─── Recipe / BOM ────────────────────────────────────────────────

class Recipe(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "recipes"

    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_item_variants.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    yield_qty: Mapped[float] = mapped_column(Numeric(12, 4), default=1)
    yield_uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    menu_item: Mapped["MenuItem"] = relationship(back_populates="recipe", foreign_keys=[menu_item_id])
    lines: Mapped[list["RecipeLine"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan"
    )


class RecipeLine(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "recipe_lines"

    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ingredient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    qty: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    wastage_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False)

    recipe: Mapped["Recipe"] = relationship(back_populates="lines", foreign_keys=[recipe_id])
    ingredient: Mapped["InventoryItem"] = relationship(foreign_keys=[ingredient_id])


# ─── Combos ──────────────────────────────────────────────────────

class Combo(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "combos"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_combo_code"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    combo_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    available_from: Mapped[str | None] = mapped_column(String(5), nullable=True)
    available_to: Mapped[str | None] = mapped_column(String(5), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    items: Mapped[list["ComboItem"]] = relationship(
        back_populates="combo", cascade="all, delete-orphan"
    )


class ComboItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "combo_items"

    combo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("combos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=False
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_item_variants.id", ondelete="SET NULL"), nullable=True
    )
    qty: Mapped[int] = mapped_column(Integer, default=1)
    is_choice: Mapped[bool] = mapped_column(Boolean, default=False)
    choice_group: Mapped[str | None] = mapped_column(String(50), nullable=True)

    combo: Mapped["Combo"] = relationship(back_populates="items", foreign_keys=[combo_id])
    menu_item: Mapped["MenuItem"] = relationship(foreign_keys=[menu_item_id])


# ─── Pricing rules (happy hour / day-part) ───────────────────────

class PricingRuleType(str, enum.Enum):
    HAPPY_HOUR = "happy_hour"
    DAY_PART = "day_part"
    SEASONAL = "seasonal"
    BULK = "bulk"


class PricingRule(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "pricing_rules"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    rule_type: Mapped[PricingRuleType] = mapped_column(
        db_enum(PricingRuleType, name="pricing_rule_type"), default=PricingRuleType.HAPPY_HOUR
    )
    discount_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    valid_from: Mapped[str | None] = mapped_column(String(5), nullable=True)
    valid_to: Mapped[str | None] = mapped_column(String(5), nullable=True)
    days_of_week: Mapped[list] = mapped_column(JSONB, default=list)  # [0..6], 0=Monday
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    menu_item: Mapped["MenuItem | None"] = relationship(foreign_keys=[menu_item_id])
