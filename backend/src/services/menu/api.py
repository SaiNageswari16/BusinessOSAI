"""Menu service endpoints."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.services.event_bus.bus import Event, bus
from src.services.menu.models import (
    Combo,
    ComboItem,
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
from src.services.menu.schemas import (
    AddonCreate,
    AddonGroupCreate,
    AddonGroupResponse,
    AddonResponse,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    ComboCreate,
    ComboItemCreate,
    ComboResponse,
    ItemCreate,
    ItemDetailResponse,
    ItemResponse,
    ItemUpdate,
    ModifierCreate,
    ModifierGroupCreate,
    ModifierGroupResponse,
    ModifierResponse,
    PricingRuleCreate,
    PricingRuleResponse,
    RecipeCreate,
    RecipeLineCreate,
    RecipeLineResponse,
    RecipeResponse,
    VariantCreate,
    VariantResponse,
)
from src.services.shared.identity import CurrentIdentity

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _ev(topic, tenant_id=None, outlet_id=None, data=None) -> Event:
    return Event(type=topic, tenant_id=tenant_id, outlet_id=outlet_id,
                 data=data or {}, source_service="menu")


# ─── Categories ──────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse], tags=["categories"])
async def list_categories(
    identity: CurrentIdentity, db: DbDep, outlet_id: uuid.UUID | None = None
):
    stmt = select(MenuCategory).where(MenuCategory.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(MenuCategory.outlet_id == outlet_id)
    stmt = stmt.order_by(MenuCategory.sort_order, MenuCategory.name)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/categories", response_model=CategoryResponse,
             status_code=status.HTTP_201_CREATED, tags=["categories"])
async def create_category(
    payload: CategoryCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    clash = await db.scalar(
        select(MenuCategory.id).where(
            MenuCategory.tenant_id == identity.tenant_id,
            MenuCategory.slug == payload.slug,
        )
    )
    if clash:
        raise HTTPException(status_code=409,
                            detail=f"Category slug '{payload.slug}' already exists")
    category = MenuCategory(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(category)
    await db.flush()
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse,
            tags=["categories"])
async def update_category(
    category_id: uuid.UUID, payload: CategoryUpdate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    category = await db.scalar(
        select(MenuCategory).where(
            MenuCategory.id == category_id,
            MenuCategory.tenant_id == identity.tenant_id,
        )
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.flush()
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT,
               tags=["categories"])
async def delete_category(
    category_id: uuid.UUID, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    category = await db.scalar(
        select(MenuCategory).where(
            MenuCategory.id == category_id,
            MenuCategory.tenant_id == identity.tenant_id,
        )
    )
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(category)


# ─── Items ───────────────────────────────────────────────────────────────────

@router.get("/items", response_model=list[ItemResponse], tags=["items"])
async def list_items(
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    item_type: str | None = None,
    available_only: bool = False,
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, le=500),
    offset: int = 0,
):
    stmt = select(MenuItem).where(MenuItem.tenant_id == identity.tenant_id)
    if outlet_id:
        stmt = stmt.where(MenuItem.outlet_id == outlet_id)
    if category_id:
        stmt = stmt.where(MenuItem.category_id == category_id)
    if item_type:
        stmt = stmt.where(MenuItem.item_type == item_type)
    if available_only:
        stmt = stmt.where(MenuItem.is_available.is_(True))
    if search:
        stmt = stmt.where(MenuItem.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(MenuItem.sort_order, MenuItem.name).limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED,
             tags=["items"])
async def create_item(payload: ItemCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:menu")
    clash = await db.scalar(
        select(MenuItem.id).where(
            MenuItem.tenant_id == identity.tenant_id,
            MenuItem.code == payload.code,
        )
    )
    if clash:
        raise HTTPException(status_code=409,
                            detail=f"Item code '{payload.code}' already exists")
    item = MenuItem(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    await bus.publish(_ev("menu.item.created", identity.tenant_id, outlet_id=item.outlet_id,
                          data={"code": item.code, "name": item.name}))
    return item


@router.get("/items/{item_id}", response_model=ItemDetailResponse, tags=["items"])
async def get_item(item_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    """Full pricing view: item + variants + addon groups."""
    item = await db.scalar(
        select(MenuItem)
        .where(MenuItem.id == item_id, MenuItem.tenant_id == identity.tenant_id)
        .options(
            selectinload(MenuItem.variants),
            selectinload(MenuItem.addon_groups).selectinload(
                MenuItemAddonGroup.addons
            ),
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/items/{item_id}", response_model=ItemResponse, tags=["items"])
async def update_item(
    item_id: uuid.UUID, payload: ItemUpdate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    item = await db.scalar(
        select(MenuItem).where(
            MenuItem.id == item_id, MenuItem.tenant_id == identity.tenant_id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.flush()
    await bus.publish(_ev("menu.item.updated", identity.tenant_id, outlet_id=item.outlet_id,
                          data={"code": item.code, "name": item.name}))
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["items"])
async def delete_item(item_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:menu")
    item = await db.scalar(
        select(MenuItem).where(
            MenuItem.id == item_id, MenuItem.tenant_id == identity.tenant_id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    await db.flush()


@router.get("/items/{item_id}/price", tags=["items"])
async def compute_price(
    item_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    variant_id: uuid.UUID | None = None,
    addon_ids: list[uuid.UUID] = Query(default_factory=list),
):
    """Unit price for a configured item.

    POS calls this instead of reimplementing the variant/addon arithmetic.
    """
    item = await db.scalar(
        select(MenuItem)
        .where(MenuItem.id == item_id, MenuItem.tenant_id == identity.tenant_id)
        .options(
            selectinload(MenuItem.variants),
            selectinload(MenuItem.addon_groups).selectinload(
                MenuItemAddonGroup.addons
            ),
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    price = float(item.base_price)
    if variant_id is not None:
        variant = next((v for v in item.variants if v.id == variant_id), None)
        if variant is None:
            raise HTTPException(status_code=404, detail="Variant not found")
        price += float(variant.price_delta)

    chosen: list[dict] = []
    for group in item.addon_groups:
        picked = [a for a in group.addons if a.id in set(addon_ids)]
        if not picked:
            continue
        if len(picked) < group.min_select or len(picked) > group.max_select:
            raise HTTPException(
                status_code=400,
                detail=f"Group '{group.name}' needs {group.min_select}–{group.max_select} "
                       f"addons, got {len(picked)}",
            )
        for addon in picked:
            price += float(addon.price)
            chosen.append({"group": group.name, "addon": addon.name,
                           "price": float(addon.price)})

    return {"item_id": str(item.id), "unit_price": round(price, 2), "addons": chosen}


# ─── Variants ────────────────────────────────────────────────────────────────

@router.post("/items/{item_id}/variants", response_model=VariantResponse,
             status_code=status.HTTP_201_CREATED, tags=["items"])
async def create_variant(
    item_id: uuid.UUID, payload: VariantCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    item = await _require_item(db, identity, item_id)
    variant = MenuItemVariant(
        tenant_id=identity.tenant_id, menu_item_id=item.id, **payload.model_dump()
    )
    if payload.is_default:
        # SQLAlchemy 2.0 has no select().update() — use an UPDATE statement, or
        # a second default variant would silently coexist with this one.
        await db.execute(
            update(MenuItemVariant)
            .where(MenuItemVariant.menu_item_id == item.id,
                   MenuItemVariant.is_default.is_(True))
            .values(is_default=False)
        )
    db.add(variant)
    await db.flush()
    return variant


@router.delete("/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT,
               tags=["items"])
async def delete_variant(
    variant_id: uuid.UUID, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    variant = await db.scalar(
        select(MenuItemVariant).where(
            MenuItemVariant.id == variant_id,
            MenuItemVariant.tenant_id == identity.tenant_id,
        )
    )
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    await db.delete(variant)


# ─── Addons ──────────────────────────────────────────────────────────────────

@router.post("/items/{item_id}/addon-groups", response_model=AddonGroupResponse,
             status_code=status.HTTP_201_CREATED, tags=["items"])
async def create_addon_group(
    item_id: uuid.UUID, payload: AddonGroupCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    item = await _require_item(db, identity, item_id)
    group = MenuItemAddonGroup(
        tenant_id=identity.tenant_id, menu_item_id=item.id, **payload.model_dump()
    )
    db.add(group)
    await db.flush()
    return group


@router.post("/addon-groups/{group_id}/addons", response_model=AddonResponse,
             status_code=status.HTTP_201_CREATED, tags=["items"])
async def create_addon(
    group_id: uuid.UUID, payload: AddonCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    group = await db.scalar(
        select(MenuItemAddonGroup).where(
            MenuItemAddonGroup.id == group_id,
            MenuItemAddonGroup.tenant_id == identity.tenant_id,
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Addon group not found")
    # The addon belongs to the group named in the URL; payload.group_id is only
    # a cross-check so a mismatched body can't attach the addon elsewhere.
    data = payload.model_dump()
    if data.get("group_id") is not None and data["group_id"] != group.id:
        raise HTTPException(
            status_code=400,
            detail="group_id in body does not match the group in the URL",
        )
    data["group_id"] = group.id
    addon = MenuItemAddon(tenant_id=identity.tenant_id, **data)
    db.add(addon)
    await db.flush()
    return addon


@router.delete("/addons/{addon_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["items"])
async def delete_addon(addon_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:menu")
    addon = await db.scalar(
        select(MenuItemAddon).where(
            MenuItemAddon.id == addon_id,
            MenuItemAddon.tenant_id == identity.tenant_id,
        )
    )
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found")
    await db.delete(addon)


# ─── Modifiers ───────────────────────────────────────────────────────────────

@router.get("/modifier-groups", response_model=list[ModifierGroupResponse],
            tags=["modifiers"])
async def list_modifier_groups(identity: CurrentIdentity, db: DbDep):
    return list((await db.execute(
        select(ModifierGroup).where(
            ModifierGroup.tenant_id == identity.tenant_id
        ).order_by(ModifierGroup.name)
    )).scalars().all())


@router.post("/modifier-groups", response_model=ModifierGroupResponse,
             status_code=status.HTTP_201_CREATED, tags=["modifiers"])
async def create_modifier_group(
    payload: ModifierGroupCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    group = ModifierGroup(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(group)
    await db.flush()
    return group


@router.post("/modifier-groups/{group_id}/modifiers", response_model=ModifierResponse,
             status_code=status.HTTP_201_CREATED, tags=["modifiers"])
async def create_modifier(
    group_id: uuid.UUID, payload: ModifierCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    group = await db.scalar(
        select(ModifierGroup).where(
            ModifierGroup.id == group_id,
            ModifierGroup.tenant_id == identity.tenant_id,
        )
    )
    if group is None:
        raise HTTPException(status_code=404, detail="Modifier group not found")
    data = payload.model_dump()
    if data.get("group_id") is not None and data["group_id"] != group.id:
        raise HTTPException(
            status_code=400,
            detail="group_id in body does not match the group in the URL",
        )
    data["group_id"] = group.id
    modifier = Modifier(tenant_id=identity.tenant_id, **data)
    db.add(modifier)
    await db.flush()
    return modifier


@router.delete("/modifiers/{modifier_id}", status_code=status.HTTP_204_NO_CONTENT,
               tags=["modifiers"])
async def delete_modifier(
    modifier_id: uuid.UUID, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    modifier = await db.scalar(
        select(Modifier).where(
            Modifier.id == modifier_id,
            Modifier.tenant_id == identity.tenant_id,
        )
    )
    if modifier is None:
        raise HTTPException(status_code=404, detail="Modifier not found")
    await db.delete(modifier)


# ─── Recipes ─────────────────────────────────────────────────────────────────

@router.get("/items/{item_id}/recipes", response_model=list[RecipeResponse],
            tags=["recipes"])
async def list_recipes(
    item_id: uuid.UUID, identity: CurrentIdentity, db: DbDep
):
    """Inventory calls this to resolve an item's bill of materials."""
    recipes = (await db.execute(
        select(Recipe)
        .where(Recipe.menu_item_id == item_id, Recipe.tenant_id == identity.tenant_id)
        .options(selectinload(Recipe.lines))
    )).scalars().all()
    return list(recipes)


@router.post("/items/{item_id}/recipes", response_model=RecipeResponse,
             status_code=status.HTTP_201_CREATED, tags=["recipes"])
async def create_recipe(
    item_id: uuid.UUID, payload: RecipeCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    item = await _require_item(db, identity, item_id)
    recipe = Recipe(
        tenant_id=identity.tenant_id,
        menu_item_id=item.id,
        name=payload.name,
        variant_id=payload.variant_id,
        yield_qty=payload.yield_qty,
        yield_uom_id=payload.yield_uom_id,
        instructions=payload.instructions,
    )
    for line in payload.lines:
        recipe.lines.append(RecipeLine(tenant_id=identity.tenant_id,
                                       **line.model_dump()))
    db.add(recipe)
    item.track_inventory = True
    await db.flush()
    return recipe


@router.put("/recipes/{recipe_id}/lines", response_model=RecipeResponse,
            tags=["recipes"])
async def replace_recipe_lines(
    recipe_id: uuid.UUID,
    lines: list[RecipeLineCreate],
    identity: CurrentIdentity,
    db: DbDep,
):
    identity.require("manage:menu")
    recipe = await db.scalar(
        select(Recipe)
        .where(Recipe.id == recipe_id, Recipe.tenant_id == identity.tenant_id)
        .options(selectinload(Recipe.lines))
    )
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    recipe.lines.clear()
    for line in lines:
        recipe.lines.append(RecipeLine(tenant_id=identity.tenant_id, **line.model_dump()))
    await db.flush()
    return recipe


@router.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT,
               tags=["recipes"])
async def delete_recipe(recipe_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:menu")
    recipe = await db.scalar(
        select(Recipe).where(
            Recipe.id == recipe_id, Recipe.tenant_id == identity.tenant_id
        )
    )
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    await db.delete(recipe)


# ─── Combos ──────────────────────────────────────────────────────────────────

@router.get("/combos", response_model=list[ComboResponse], tags=["combos"])
async def list_combos(identity: CurrentIdentity, db: DbDep):
    combos = (await db.execute(
        select(Combo)
        .where(Combo.tenant_id == identity.tenant_id, Combo.is_active.is_(True))
        .options(selectinload(Combo.items))
        .order_by(Combo.name)
    )).scalars().all()
    return list(combos)


@router.post("/combos", response_model=ComboResponse, status_code=status.HTTP_201_CREATED,
             tags=["combos"])
async def create_combo(payload: ComboCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:menu")
    combo = Combo(
        tenant_id=identity.tenant_id,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        combo_price=payload.combo_price,
    )
    for entry in payload.items:
        combo.items.append(ComboItem(tenant_id=identity.tenant_id, **entry.model_dump()))
    db.add(combo)
    await db.flush()
    return combo


@router.delete("/combos/{combo_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["combos"])
async def delete_combo(combo_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:menu")
    combo = await db.scalar(
        select(Combo).where(
            Combo.id == combo_id, Combo.tenant_id == identity.tenant_id
        )
    )
    if combo is None:
        raise HTTPException(status_code=404, detail="Combo not found")
    combo.is_active = False
    await db.flush()


# ─── Pricing rules ───────────────────────────────────────────────────────────

@router.get("/pricing-rules", response_model=list[PricingRuleResponse],
            tags=["pricing"])
async def list_pricing_rules(
    identity: CurrentIdentity, db: DbDep, outlet_id: uuid.UUID | None = None
):
    stmt = select(PricingRule).where(
        PricingRule.tenant_id == identity.tenant_id,
        PricingRule.is_active.is_(True),
    )
    if outlet_id:
        # A rule with no outlet is global — it applies everywhere, so it must be
        # included in every outlet's effective rule set, not filtered out.
        stmt = stmt.where(
            or_(PricingRule.outlet_id.is_(None), PricingRule.outlet_id == outlet_id)
        )
    stmt = stmt.order_by(PricingRule.priority.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("/pricing-rules", response_model=PricingRuleResponse,
             status_code=status.HTTP_201_CREATED, tags=["pricing"])
async def create_pricing_rule(
    payload: PricingRuleCreate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    rule = PricingRule(tenant_id=identity.tenant_id, **payload.model_dump())
    db.add(rule)
    await db.flush()
    return rule


@router.delete("/pricing-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT,
               tags=["pricing"])
async def delete_pricing_rule(
    rule_id: uuid.UUID, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    rule = await db.scalar(
        select(PricingRule).where(
            PricingRule.id == rule_id, PricingRule.tenant_id == identity.tenant_id
        )
    )
    if rule is None:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    await db.delete(rule)


# ─── helpers ─────────────────────────────────────────────────────────────────

async def _require_item(db: AsyncSession, identity: CurrentIdentity, item_id) -> MenuItem:
    item = await db.scalar(
        select(MenuItem).where(
            MenuItem.id == item_id, MenuItem.tenant_id == identity.tenant_id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item
