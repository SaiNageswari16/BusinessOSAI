"""Menu, recipe, combo and pricing-rule endpoints."""
import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, resolve_outlet_id
from src.database.session import get_db
from src.models import (
    Combo,
    ComboItem,
    KitchenStation,
    MenuCategory,
    MenuItem,
    MenuItemAddon,
    MenuItemAddonGroup,
    MenuItemVariant,
    Modifier,
    ModifierGroup,
    PricingRule,
    Recipe,
    RecipeLine,
)
from src.schemas.menu import (
    ComboCreate,
    ComboItemCreate,
    ComboItemResponse,
    ComboItemUpdate,
    ComboResponse,
    ComboUpdate,
    MenuCategoryCreate,
    MenuCategoryResponse,
    MenuCategoryUpdate,
    MenuItemAddonCreate,
    MenuItemAddonGroupCreate,
    MenuItemAddonGroupResponse,
    MenuItemAddonGroupUpdate,
    MenuItemAddonResponse,
    MenuItemAddonUpdate,
    MenuItemAvailabilityUpdate,
    MenuItemCreate,
    MenuItemResponse,
    MenuItemUpdate,
    MenuItemVariantCreate,
    MenuItemVariantResponse,
    MenuItemVariantUpdate,
    ModifierCreate,
    ModifierGroupCreate,
    ModifierGroupResponse,
    ModifierGroupUpdate,
    ModifierResponse,
    ModifierUpdate,
    PricingRuleCreate,
    PricingRuleResponse,
    PricingRuleUpdate,
    RecipeLineCreate,
    RecipeLineResponse,
    RecipeLineUpdate,
    RecipeResponse,
    RecipeUpsert,
)
router = APIRouter(prefix="/menu", tags=["Menu"])


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return slug or uuid.uuid4().hex[:8]


async def _next_item_code(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Sequential short code for menu items — MI-0001, MI-0002 ..."""
    stmt = select(MenuItem.code).where(MenuItem.tenant_id == tenant_id)
    codes = (await db.execute(stmt)).scalars().all()
    highest = 0
    for code in codes:
        match = re.match(r"^MI-(\d+)$", code or "")
        if match:
            highest = max(highest, int(match.group(1)))
    return f"MI-{highest + 1:04d}"


async def _next_combo_code(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    stmt = select(Combo.code).where(Combo.tenant_id == tenant_id)
    codes = (await db.execute(stmt)).scalars().all()
    highest = 0
    for code in codes:
        match = re.match(r"^CB-(\d+)$", code or "")
        if match:
            highest = max(highest, int(match.group(1)))
    return f"CB-{highest + 1:04d}"


# ─── Categories ──────────────────────────────────────────────────

@router.get("/categories", response_model=list[MenuCategoryResponse])
async def list_categories(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    include_inactive: bool = False,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(MenuCategory).where(MenuCategory.tenant_id == ctx.tenant_id)
    if outlet_id:
        # Outlet-specific plus tenant-wide (shared) categories
        stmt = stmt.where(
            (MenuCategory.outlet_id == outlet_id) | (MenuCategory.outlet_id.is_(None))
        )
    if not include_inactive:
        stmt = stmt.where(MenuCategory.is_active.is_(True))
    stmt = stmt.order_by(MenuCategory.sort_order, MenuCategory.name)
    return [MenuCategoryResponse.model_validate(c) for c in (await db.execute(stmt)).scalars().all()]


@router.post("/categories", response_model=MenuCategoryResponse,
             status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: MenuCategoryCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    slug = slugify(payload.name)
    clash = await db.scalar(
        select(MenuCategory.id).where(
            MenuCategory.tenant_id == ctx.tenant_id, MenuCategory.slug == slug
        )
    )
    if clash:
        raise HTTPException(status_code=409, detail="A category with this name already exists")

    category = MenuCategory(tenant_id=ctx.tenant_id, **payload.model_dump(), slug=slug)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return MenuCategoryResponse.model_validate(category)


@router.put("/categories/{category_id}", response_model=MenuCategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    payload: MenuCategoryUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    category = await db.scalar(
        select(MenuCategory).where(
            MenuCategory.id == category_id, MenuCategory.tenant_id == ctx.tenant_id
        )
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    resolve_outlet_id(ctx, category.outlet_id, required=False)

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        new_slug = slugify(data["name"])
        if new_slug != category.slug:
            clash = await db.scalar(
                select(MenuCategory.id).where(
                    MenuCategory.tenant_id == ctx.tenant_id,
                    MenuCategory.slug == new_slug,
                    MenuCategory.id != category_id,
                )
            )
            if clash:
                raise HTTPException(status_code=409, detail="A category with this name already exists")
            category.slug = new_slug

    for field, value in data.items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return MenuCategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    category = await db.scalar(
        select(MenuCategory).where(
            MenuCategory.id == category_id, MenuCategory.tenant_id == ctx.tenant_id
        )
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    resolve_outlet_id(ctx, category.outlet_id, required=False)

    # Items keep a NULL category rather than being deleted with it
    for item in category.items or []:
        item.category_id = None
    category.is_active = False
    await db.commit()


# ─── Items ───────────────────────────────────────────────────────

@router.get("/items", response_model=list[MenuItemResponse])
async def list_items(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    available_only: bool = False,
    search: str | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(MenuItem).where(MenuItem.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(
            (MenuItem.outlet_id == outlet_id) | (MenuItem.outlet_id.is_(None))
        )
    if category_id:
        stmt = stmt.where(MenuItem.category_id == category_id)
    if available_only:
        stmt = stmt.where(MenuItem.is_available.is_(True), MenuItem.is_active.is_(True))
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(MenuItem.name.ilike(pattern))
    stmt = stmt.order_by(MenuItem.sort_order, MenuItem.name)
    return [MenuItemResponse.model_validate(i) for i in (await db.execute(stmt)).scalars().all()]


@router.post("/items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: MenuItemCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    if payload.kitchen_station_id:
        station = await db.scalar(
            select(KitchenStation.id).where(
                KitchenStation.id == payload.kitchen_station_id,
                KitchenStation.tenant_id == ctx.tenant_id,
            )
        )
        if station is None:
            raise HTTPException(status_code=400, detail="Kitchen station not found")

    code = await _next_item_code(db, ctx.tenant_id)
    item = MenuItem(tenant_id=ctx.tenant_id, code=code, **payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return MenuItemResponse.model_validate(item)


@router.get("/items/{item_id}", response_model=MenuItemResponse)
async def get_item(
    item_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    resolve_outlet_id(ctx, item.outlet_id, required=False)
    return MenuItemResponse.model_validate(item)


@router.put("/items/{item_id}", response_model=MenuItemResponse)
async def update_item(
    item_id: uuid.UUID,
    payload: MenuItemUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    resolve_outlet_id(ctx, item.outlet_id, required=False)

    if payload.kitchen_station_id:
        station = await db.scalar(
            select(KitchenStation.id).where(
                KitchenStation.id == payload.kitchen_station_id,
                KitchenStation.tenant_id == ctx.tenant_id,
            )
        )
        if station is None:
            raise HTTPException(status_code=400, detail="Kitchen station not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return MenuItemResponse.model_validate(item)


@router.post("/items/{item_id}/availability", response_model=MenuItemResponse)
async def set_item_availability(
    item_id: uuid.UUID,
    payload: MenuItemAvailabilityUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Sold-out toggle — the captain's tablet hits this constantly."""
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    resolve_outlet_id(ctx, item.outlet_id, required=False)

    item.is_available = payload.is_available
    await db.commit()
    await db.refresh(item)
    return MenuItemResponse.model_validate(item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    resolve_outlet_id(ctx, item.outlet_id, required=False)
    # Deactivate rather than delete — historical orders reference this item
    item.is_active = False
    item.is_available = False
    await db.commit()


# ─── Variants (portion sizes) ────────────────────────────────────

@router.get("/items/{item_id}/variants", response_model=list[MenuItemVariantResponse])
async def list_variants(
    item_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    resolve_outlet_id(ctx, item.outlet_id, required=False)

    stmt = (
        select(MenuItemVariant)
        .where(MenuItemVariant.menu_item_id == item_id, MenuItemVariant.tenant_id == ctx.tenant_id)
        .order_by(MenuItemVariant.sort_order)
    )
    return [MenuItemVariantResponse.model_validate(v) for v in (await db.execute(stmt)).scalars().all()]


@router.post("/items/{item_id}/variants", response_model=MenuItemVariantResponse,
             status_code=status.HTTP_201_CREATED)
async def create_variant(
    item_id: uuid.UUID,
    payload: MenuItemVariantCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    resolve_outlet_id(ctx, item.outlet_id, required=False)

    variant = MenuItemVariant(
        tenant_id=ctx.tenant_id, menu_item_id=item_id, **payload.model_dump()
    )
    db.add(variant)
    await db.flush()

    if payload.is_default:
        # Only one default variant per item
        others = (
            await db.execute(
                select(MenuItemVariant).where(
                    MenuItemVariant.menu_item_id == item_id,
                    MenuItemVariant.tenant_id == ctx.tenant_id,
                    MenuItemVariant.id != variant.id,
                    MenuItemVariant.is_default.is_(True),
                )
            )
        ).scalars().all()
        for other in others:
            other.is_default = False

    await db.commit()
    await db.refresh(variant)
    return MenuItemVariantResponse.model_validate(variant)


@router.put("/variants/{variant_id}", response_model=MenuItemVariantResponse)
async def update_variant(
    variant_id: uuid.UUID,
    payload: MenuItemVariantUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    variant = await db.scalar(
        select(MenuItemVariant)
        .options(selectinload(MenuItemVariant.menu_item))
        .where(MenuItemVariant.id == variant_id, MenuItemVariant.tenant_id == ctx.tenant_id)
    )
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    resolve_outlet_id(ctx, variant.menu_item.outlet_id if variant.menu_item else None, required=False)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(variant, field, value)
    await db.flush()

    if payload.is_default:
        others = (
            await db.execute(
                select(MenuItemVariant).where(
                    MenuItemVariant.menu_item_id == variant.menu_item_id,
                    MenuItemVariant.tenant_id == ctx.tenant_id,
                    MenuItemVariant.id != variant.id,
                    MenuItemVariant.is_default.is_(True),
                )
            )
        ).scalars().all()
        for other in others:
            other.is_default = False

    await db.commit()
    await db.refresh(variant)
    return MenuItemVariantResponse.model_validate(variant)


@router.delete("/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variant(
    variant_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    variant = await db.scalar(
        select(MenuItemVariant)
        .options(selectinload(MenuItemVariant.menu_item))
        .where(MenuItemVariant.id == variant_id, MenuItemVariant.tenant_id == ctx.tenant_id)
    )
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    resolve_outlet_id(ctx, variant.menu_item.outlet_id if variant.menu_item else None, required=False)
    variant.is_active = False
    await db.commit()


# ─── Addon groups & addons ───────────────────────────────────────

@router.get("/items/{item_id}/addon-groups", response_model=list[MenuItemAddonGroupResponse])
async def list_addon_groups(
    item_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = (
        select(MenuItemAddonGroup)
        .where(
            MenuItemAddonGroup.menu_item_id == item_id,
            MenuItemAddonGroup.tenant_id == ctx.tenant_id,
        )
        .order_by(MenuItemAddonGroup.sort_order)
    )
    return [
        MenuItemAddonGroupResponse.model_validate(g)
        for g in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/items/{item_id}/addon-groups", response_model=MenuItemAddonGroupResponse,
             status_code=status.HTTP_201_CREATED)
async def create_addon_group(
    item_id: uuid.UUID,
    payload: MenuItemAddonGroupCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    resolve_outlet_id(ctx, item.outlet_id, required=False)

    group = MenuItemAddonGroup(
        tenant_id=ctx.tenant_id, menu_item_id=item_id, **payload.model_dump()
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return MenuItemAddonGroupResponse.model_validate(group)


@router.put("/addon-groups/{group_id}", response_model=MenuItemAddonGroupResponse)
async def update_addon_group(
    group_id: uuid.UUID,
    payload: MenuItemAddonGroupUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await db.scalar(
        select(MenuItemAddonGroup).where(
            MenuItemAddonGroup.id == group_id, MenuItemAddonGroup.tenant_id == ctx.tenant_id
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Addon group not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    await db.commit()
    await db.refresh(group)
    return MenuItemAddonGroupResponse.model_validate(group)


@router.delete("/addon-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_addon_group(
    group_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await db.scalar(
        select(MenuItemAddonGroup).where(
            MenuItemAddonGroup.id == group_id, MenuItemAddonGroup.tenant_id == ctx.tenant_id
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Addon group not found")
    await db.delete(group)
    await db.commit()


@router.post("/addon-groups/{group_id}/addons", response_model=MenuItemAddonResponse,
             status_code=status.HTTP_201_CREATED)
async def create_addon(
    group_id: uuid.UUID,
    payload: MenuItemAddonCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await db.scalar(
        select(MenuItemAddonGroup).where(
            MenuItemAddonGroup.id == group_id, MenuItemAddonGroup.tenant_id == ctx.tenant_id
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Addon group not found")

    addon = MenuItemAddon(
        tenant_id=ctx.tenant_id, addon_group_id=group_id, **payload.model_dump()
    )
    db.add(addon)
    await db.commit()
    await db.refresh(addon)
    return MenuItemAddonResponse.model_validate(addon)


@router.put("/addons/{addon_id}", response_model=MenuItemAddonResponse)
async def update_addon(
    addon_id: uuid.UUID,
    payload: MenuItemAddonUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    addon = await db.scalar(
        select(MenuItemAddon).where(
            MenuItemAddon.id == addon_id, MenuItemAddon.tenant_id == ctx.tenant_id
        )
    )
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(addon, field, value)
    await db.commit()
    await db.refresh(addon)
    return MenuItemAddonResponse.model_validate(addon)


@router.delete("/addons/{addon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_addon(
    addon_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    addon = await db.scalar(
        select(MenuItemAddon).where(
            MenuItemAddon.id == addon_id, MenuItemAddon.tenant_id == ctx.tenant_id
        )
    )
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found")
    addon.is_available = False
    await db.commit()


# ─── Modifier groups ─────────────────────────────────────────────

@router.get("/modifier-groups", response_model=list[ModifierGroupResponse])
async def list_modifier_groups(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stmt = (
        select(ModifierGroup)
        .where(ModifierGroup.tenant_id == ctx.tenant_id, ModifierGroup.is_active.is_(True))
        .order_by(ModifierGroup.name)
    )
    return [
        ModifierGroupResponse.model_validate(g) for g in (await db.execute(stmt)).scalars().all()
    ]


@router.post("/modifier-groups", response_model=ModifierGroupResponse,
             status_code=status.HTTP_201_CREATED)
async def create_modifier_group(
    payload: ModifierGroupCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = ModifierGroup(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return ModifierGroupResponse.model_validate(group)


@router.put("/modifier-groups/{group_id}", response_model=ModifierGroupResponse)
async def update_modifier_group(
    group_id: uuid.UUID,
    payload: ModifierGroupUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await db.scalar(
        select(ModifierGroup).where(
            ModifierGroup.id == group_id, ModifierGroup.tenant_id == ctx.tenant_id
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Modifier group not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    await db.commit()
    await db.refresh(group)
    return ModifierGroupResponse.model_validate(group)


@router.post("/modifier-groups/{group_id}/modifiers", response_model=ModifierResponse,
             status_code=status.HTTP_201_CREATED)
async def create_modifier(
    group_id: uuid.UUID,
    payload: ModifierCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await db.scalar(
        select(ModifierGroup).where(
            ModifierGroup.id == group_id, ModifierGroup.tenant_id == ctx.tenant_id
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Modifier group not found")

    modifier = Modifier(tenant_id=ctx.tenant_id, group_id=group_id, **payload.model_dump())
    db.add(modifier)
    await db.commit()
    await db.refresh(modifier)
    return ModifierResponse.model_validate(modifier)


@router.put("/modifiers/{modifier_id}", response_model=ModifierResponse)
async def update_modifier(
    modifier_id: uuid.UUID,
    payload: ModifierUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    modifier = await db.scalar(
        select(Modifier).where(
            Modifier.id == modifier_id, Modifier.tenant_id == ctx.tenant_id
        )
    )
    if modifier is None:
        raise HTTPException(status_code=404, detail="Modifier not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(modifier, field, value)
    await db.commit()
    await db.refresh(modifier)
    return ModifierResponse.model_validate(modifier)


# ─── Recipes ─────────────────────────────────────────────────────

@router.get("/items/{item_id}/recipe", response_model=RecipeResponse | None)
async def get_recipe(
    item_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:recipes"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    variant_id: uuid.UUID | None = None,
):
    stmt = (
        select(Recipe)
        .options(selectinload(Recipe.lines))
        .where(Recipe.menu_item_id == item_id, Recipe.tenant_id == ctx.tenant_id)
    )
    if variant_id:
        stmt = stmt.where(Recipe.variant_id == variant_id)
    else:
        stmt = stmt.where(Recipe.variant_id.is_(None))

    recipe = (await db.execute(stmt)).scalars().first()
    if recipe is None:
        return None
    return RecipeResponse.model_validate(recipe)


@router.put("/items/{item_id}/recipe", response_model=RecipeResponse)
async def upsert_recipe(
    item_id: uuid.UUID,
    payload: RecipeUpsert,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:recipes"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """PUT semantics — replaces the recipe header and all lines for this item."""
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    resolve_outlet_id(ctx, item.outlet_id, required=False)

    existing = (
        await db.execute(
            select(Recipe).where(
                Recipe.menu_item_id == item_id,
                Recipe.variant_id == payload.variant_id,
                Recipe.tenant_id == ctx.tenant_id,
            )
        )
    ).scalars().first()

    if existing:
        existing.name = payload.name
        existing.yield_qty = payload.yield_qty
        existing.yield_uom_id = payload.yield_uom_id
        existing.instructions = payload.instructions
        existing.is_active = payload.is_active
        recipe = existing
        # Replace lines wholesale
        for line in list(recipe.lines or []):
            await db.delete(line)
        await db.flush()
    else:
        recipe = Recipe(
            tenant_id=ctx.tenant_id,
            menu_item_id=item_id,
            variant_id=payload.variant_id,
            name=payload.name,
            yield_qty=payload.yield_qty,
            yield_uom_id=payload.yield_uom_id,
            instructions=payload.instructions,
            is_active=payload.is_active,
        )
        db.add(recipe)
        await db.flush()

    for line in payload.lines:
        db.add(RecipeLine(
            tenant_id=ctx.tenant_id,
            recipe_id=recipe.id,
            ingredient_id=line.ingredient_id,
            qty=line.qty,
            uom_id=line.uom_id,
            wastage_pct=line.wastage_pct,
            is_optional=line.is_optional,
        ))

    await db.flush()
    # refresh() doesn't populate relationships — re-fetch with lines loaded
    recipe_id = recipe.id
    recipe = (
        await db.execute(
            select(Recipe)
            .options(selectinload(Recipe.lines))
            .where(Recipe.id == recipe_id, Recipe.tenant_id == ctx.tenant_id)
        )
    ).scalar_one()
    return RecipeResponse.model_validate(recipe)


@router.post("/recipes/{recipe_id}/lines", response_model=RecipeLineResponse,
             status_code=status.HTTP_201_CREATED)
async def add_recipe_line(
    recipe_id: uuid.UUID,
    payload: RecipeLineCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:recipes"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    recipe = await db.scalar(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.tenant_id == ctx.tenant_id)
    )
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    line = RecipeLine(tenant_id=ctx.tenant_id, recipe_id=recipe_id, **payload.model_dump())
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return RecipeLineResponse.model_validate(line)


@router.put("/recipe-lines/{line_id}", response_model=RecipeLineResponse)
async def update_recipe_line(
    line_id: uuid.UUID,
    payload: RecipeLineUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:recipes"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    line = await db.scalar(
        select(RecipeLine).where(RecipeLine.id == line_id, RecipeLine.tenant_id == ctx.tenant_id)
    )
    if line is None:
        raise HTTPException(status_code=404, detail="Recipe line not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(line, field, value)
    await db.commit()
    await db.refresh(line)
    return RecipeLineResponse.model_validate(line)


@router.delete("/recipe-lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe_line(
    line_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:recipes"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    line = await db.scalar(
        select(RecipeLine).where(RecipeLine.id == line_id, RecipeLine.tenant_id == ctx.tenant_id)
    )
    if line is None:
        raise HTTPException(status_code=404, detail="Recipe line not found")
    await db.delete(line)
    await db.commit()


# ─── Combos ──────────────────────────────────────────────────────

@router.get("/combos", response_model=list[ComboResponse])
async def list_combos(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    include_inactive: bool = False,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(Combo).where(Combo.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where((Combo.outlet_id == outlet_id) | (Combo.outlet_id.is_(None)))
    if not include_inactive:
        stmt = stmt.where(Combo.is_active.is_(True))
    stmt = stmt.order_by(Combo.name)
    return [ComboResponse.model_validate(c) for c in (await db.execute(stmt)).scalars().all()]


@router.post("/combos", response_model=ComboResponse, status_code=status.HTTP_201_CREATED)
async def create_combo(
    payload: ComboCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:combos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)
    code = await _next_combo_code(db, ctx.tenant_id)
    combo = Combo(tenant_id=ctx.tenant_id, code=code, **payload.model_dump())
    db.add(combo)
    await db.commit()
    await db.refresh(combo)
    return ComboResponse.model_validate(combo)


@router.get("/combos/{combo_id}", response_model=ComboResponse)
async def get_combo(
    combo_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    combo = await db.scalar(
        select(Combo).where(Combo.id == combo_id, Combo.tenant_id == ctx.tenant_id)
    )
    if combo is None:
        raise HTTPException(status_code=404, detail="Combo not found")
    resolve_outlet_id(ctx, combo.outlet_id, required=False)
    return ComboResponse.model_validate(combo)


@router.put("/combos/{combo_id}", response_model=ComboResponse)
async def update_combo(
    combo_id: uuid.UUID,
    payload: ComboUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:combos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    combo = await db.scalar(
        select(Combo).where(Combo.id == combo_id, Combo.tenant_id == ctx.tenant_id)
    )
    if combo is None:
        raise HTTPException(status_code=404, detail="Combo not found")
    resolve_outlet_id(ctx, combo.outlet_id, required=False)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(combo, field, value)
    await db.commit()
    await db.refresh(combo)
    return ComboResponse.model_validate(combo)


@router.get("/combos/{combo_id}/items", response_model=list[ComboItemResponse])
async def list_combo_items(
    combo_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    combo = await db.scalar(
        select(Combo).where(Combo.id == combo_id, Combo.tenant_id == ctx.tenant_id)
    )
    if combo is None:
        raise HTTPException(status_code=404, detail="Combo not found")

    stmt = select(ComboItem).where(ComboItem.combo_id == combo_id)
    return [ComboItemResponse.model_validate(i) for i in (await db.execute(stmt)).scalars().all()]


@router.post("/combos/{combo_id}/items", response_model=ComboItemResponse,
             status_code=status.HTTP_201_CREATED)
async def add_combo_item(
    combo_id: uuid.UUID,
    payload: ComboItemCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:combos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    combo = await db.scalar(
        select(Combo).where(Combo.id == combo_id, Combo.tenant_id == ctx.tenant_id)
    )
    if combo is None:
        raise HTTPException(status_code=404, detail="Combo not found")

    item = ComboItem(tenant_id=ctx.tenant_id, combo_id=combo_id, **payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ComboItemResponse.model_validate(item)


@router.put("/combo-items/{item_id}", response_model=ComboItemResponse)
async def update_combo_item(
    item_id: uuid.UUID,
    payload: ComboItemUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:combos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(ComboItem).where(ComboItem.id == item_id, ComboItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Combo item not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return ComboItemResponse.model_validate(item)


@router.delete("/combo-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_combo_item(
    item_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:combos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    item = await db.scalar(
        select(ComboItem).where(ComboItem.id == item_id, ComboItem.tenant_id == ctx.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Combo item not found")
    await db.delete(item)
    await db.commit()


# ─── Pricing rules ───────────────────────────────────────────────

@router.get("/pricing-rules", response_model=list[PricingRuleResponse])
async def list_pricing_rules(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:menu_items"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    outlet_id: uuid.UUID | None = None,
    menu_item_id: uuid.UUID | None = None,
):
    resolve_outlet_id(ctx, outlet_id, required=False)
    stmt = select(PricingRule).where(PricingRule.tenant_id == ctx.tenant_id)
    if outlet_id:
        stmt = stmt.where(
            (PricingRule.outlet_id == outlet_id) | (PricingRule.outlet_id.is_(None))
        )
    if menu_item_id:
        stmt = stmt.where(PricingRule.menu_item_id == menu_item_id)
    stmt = stmt.order_by(PricingRule.priority.desc())
    return [PricingRuleResponse.model_validate(r) for r in (await db.execute(stmt)).scalars().all()]


@router.post("/pricing-rules", response_model=PricingRuleResponse,
             status_code=status.HTTP_201_CREATED)
async def create_pricing_rule(
    payload: PricingRuleCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:pricing_rules"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    resolve_outlet_id(ctx, payload.outlet_id, required=False)

    if payload.discount_pct is None and payload.discount_amount is None:
        raise HTTPException(
            status_code=400, detail="Provide either discount_pct or discount_amount"
        )

    rule = PricingRule(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return PricingRuleResponse.model_validate(rule)


@router.put("/pricing-rules/{rule_id}", response_model=PricingRuleResponse)
async def update_pricing_rule(
    rule_id: uuid.UUID,
    payload: PricingRuleUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:pricing_rules"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rule = await db.scalar(
        select(PricingRule).where(PricingRule.id == rule_id, PricingRule.tenant_id == ctx.tenant_id)
    )
    if rule is None:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    resolve_outlet_id(ctx, rule.outlet_id, required=False)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return PricingRuleResponse.model_validate(rule)


@router.delete("/pricing-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pricing_rule(
    rule_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:pricing_rules"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rule = await db.scalar(
        select(PricingRule).where(PricingRule.id == rule_id, PricingRule.tenant_id == ctx.tenant_id)
    )
    if rule is None:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    resolve_outlet_id(ctx, rule.outlet_id, required=False)
    rule.is_active = False
    await db.commit()
