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
from src.services.menu.outbox import record_event
from src.services.menu.schemas import (
    AddonCreate,
    AddonGroupCreate,
    AddonGroupResponse,
    AddonResponse,
    AddonUpdate,
    AiReconcileRequest,
    AiReconcileResponse,
    AiRecipeSearchRequest,
    AiRecipeSearchResponse,
    AiReorderRequest,
    AiReorderResponse,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    ComboCreate,
    ComboItemCreate,
    ComboResponse,
    ComboUpdate,
    ItemCreate,
    ItemDetailResponse,
    ItemResponse,
    ItemUpdate,
    ModifierCreate,
    ModifierGroupCreate,
    ModifierGroupResponse,
    ModifierResponse,
    ModifierUpdate,
    PricingRuleCreate,
    PricingRuleResponse,
    PricingRuleUpdate,
    RecipeCreate,
    RecipeBreakdownLine,
    RecipeBreakdownResponse,
    RecipeUpdate,
    VariantUpdate,
    RecipeLineCreate,
    RecipeLineResponse,
    RecipeResponse,
    RecipeSearchResponse,
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


# ─── Recipe catalog: search (RAG retrieval) + scaled breakdown ──────────────
#
# The catalog is the library of predefined recipes a chef picks from before a
# dish exists on the menu. Catalog items are ordinary menu items whose code
# starts with "CAT-" — the seed in ``catalog.py`` creates them on startup.
# Keeping them as regular menu items (rather than a parallel table) means the
# existing recipe endpoints, costing and stock-deduction paths all work on a
# catalog recipe with no special-casing.


def _ingredient_names_for_spec(spec) -> dict[str, str]:
    """Build an ``inventory_code -> name`` map for one catalog recipe spec.

    Names come straight from the static catalog data in ``catalog.py`` —
    each ``CatalogLine`` carries a human-readable ``name`` field that is the
    source of truth for what that ingredient is called. No database or HTTP
    lookup is required, so search works even if the inventory service is
    offline. Returns an empty dict if ``spec`` is None.
    """
    if spec is None:
        return {}
    return {ln.inventory_code: (ln.name or ln.inventory_code).lower()
            for ln in spec.lines}


# The search route must be registered before /items/{item_id} so FastAPI
# matches "search" literally instead of trying to parse it as a UUID.

@router.get("/items/search", response_model=list[RecipeSearchResponse],
            tags=["recipes"])
async def search_recipes(
    identity: CurrentIdentity,
    db: DbDep,
    q: str = Query(default="", description="Free-text query: dish, ingredient, or tag."),
    limit: int = Query(default=20, ge=1, le=100),
    category: str | None = Query(default=None, description="Filter by item type."),
):
    """Search the predefined recipe catalog — the retrieval step.

    RAG's retrieval half: given a chef's words ("something with chicken and
    rice", "quick veg starter"), return the catalog recipes that best match,
    ranked. Scoring is deliberately lexical and transparent:

    * name match — 4 points per matched term
    * description / tag / instruction match — 2 points per matched term
    * shared ingredient — 1 point per ingredient the query names

    This runs with no LLM and no API key, so the page works on a fresh
    checkout. The scoring lives in one function (``_score_recipe``) behind one
    endpoint precisely so it can later be swapped for an embedding-based
    ranker without the frontend changing at all.

    With an empty query every catalog recipe is returned, ranked by name, so
    the page opens as a browsable library rather than an empty box.
    """
    stmt = (
        select(MenuItem)
        .where(
            MenuItem.tenant_id == identity.tenant_id,
            MenuItem.code.like("CAT-%"),
            MenuItem.is_active.is_(True),
        )
        .options(selectinload(MenuItem.recipes).selectinload(Recipe.lines))
    )
    if category:
        stmt = stmt.where(MenuItem.item_type == category)

    items = (await db.execute(stmt)).scalars().all()

    from src.services.menu.catalog import catalog_by_code
    catalog_by_code_map = catalog_by_code()

    terms = [t for t in q.lower().replace(",", " ").split() if t]
    results: list[RecipeSearchResponse] = []
    for it in items:
        active = next((r for r in it.recipes if r.is_active), None)
        if active is None:
            continue
        spec = catalog_by_code_map.get(it.code)
        inv = _ingredient_names_for_spec(spec)
        score, reasons = _score_recipe(it, active, terms, inv, spec)
        if terms and score <= 0:
            continue
        results.append(
            RecipeSearchResponse(
                item_id=it.id,
                code=it.code,
                name=it.name,
                description=it.description,
                item_type=str(it.item_type),
                base_price=float(it.base_price or 0),
                yield_qty=float(active.yield_qty or 1),
                instructions=active.instructions,
                ingredient_count=len(spec.lines) if spec else len(active.lines),
                score=round(score, 2),
                match_reasons=reasons,
            )
        )

    results.sort(key=lambda r: (-r.score, r.name.lower()))
    return results[:limit]


def _score_recipe(
    item: MenuItem,
    recipe: Recipe,
    terms: list[str],
    inv: dict[str, str],
    spec=None,
) -> tuple[float, list[str]]:
    """Lexical relevance score for one catalog recipe against the query terms.

    Returns ``(score, reasons)``. ``reasons`` names the actual things that
    matched so the UI can explain *why* a recipe was returned rather than
    presenting an opaque rank.

    ``inv`` is an ``inventory_code -> lowercased name`` map built from the
    catalog spec, so a term like "chicken" matches a recipe that uses
    chicken even when the dish is called "Dum Biryani". No cross-service
    lookup is required.
    """
    if not terms:
        return 1.0, ["Full catalog"]

    score = 0.0
    reasons: list[str] = []

    name = item.name.lower()
    desc = (item.description or "").lower()
    instr = (recipe.instructions or "").lower()

    # Build the ingredient-name list from the static catalog spec.
    ingredient_names: list[str] = []
    if spec:
        for ln_spec in spec.lines:
            ingredient_names.append(inv.get(ln_spec.inventory_code, ""))

    for term in terms:
        hit = False
        if term in name:
            score += 4
            hit = True
            reasons.append(f"matched dish name '{term}'")
        if term in desc or term in instr:
            score += 2
            hit = True
            reasons.append(f"matched description '{term}'")
        for iname in ingredient_names:
            if iname and term in iname:
                score += 1
                hit = True
                reasons.append(f"uses {iname}")
                break
        if not hit:
            # A partial token match is worth a little — "chicken" should still
            # surface "Chicken Tikka Kebab" even if the term is a substring.
            if any(term in n for n in [name, desc, instr, *ingredient_names] if n):
                score += 0.5
                reasons.append(f"partial match on '{term}'")

    return score, reasons


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
    await record_event(
        db, type="menu.item.created", tenant_id=identity.tenant_id,
        outlet_id=item.outlet_id,
        data={"code": item.code, "name": item.name, "item_id": str(item.id)},
    )
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
    await record_event(
        db, type="menu.item.updated", tenant_id=identity.tenant_id,
        outlet_id=item.outlet_id,
        data={"code": item.code, "name": item.name, "item_id": str(item.id)},
    )
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
    await record_event(
        db, type="menu.item.deactivated", tenant_id=identity.tenant_id,
        outlet_id=item.outlet_id,
        data={"code": item.code, "name": item.name, "item_id": str(item.id)},
    )


@router.get("/items/{item_id}/price", tags=["items"])
async def compute_price(
    item_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    variant_id: uuid.UUID | None = None,
    addon_ids: list[uuid.UUID] = Query(default_factory=list),
    qty: int = Query(default=1, ge=1),
):
    """Unit price for a configured item, after all applicable pricing rules.

    POS calls this instead of reimplementing the variant/addon/rule arithmetic.
    ``qty`` matters because BULK rules only apply above a threshold.
    """
    from datetime import datetime, timezone

    from src.services.menu import pricing as pricing_engine

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

    # Pricing rules (happy hour / day part / seasonal / bulk) discount the
    # computed base+variant+addon price. The rule set depends on outlet and
    # the current time — same inputs POS has at the moment it prices the cart.
    rules = list((await db.execute(
        select(PricingRule).where(
            PricingRule.tenant_id == identity.tenant_id,
            PricingRule.is_active.is_(True),
            or_(PricingRule.outlet_id.is_(None),
                 PricingRule.outlet_id == item.outlet_id),
        ).order_by(PricingRule.priority.desc())
    )).scalars().all())

    priced = pricing_engine.apply_pricing_rules(
        price, rules, item=item, at=datetime.now(timezone.utc),
        outlet_id=item.outlet_id, qty=qty,
    )

    return {
        "item_id": str(item.id),
        "unit_price": priced["final_price"],
        "unit_price_before_rules": round(price, 2),
        "discount_total": priced["discount_total"],
        "applied_rules": priced["applied_rules"],
        "addons": chosen,
    }


@router.get("/items/{item_id}/recipe-lines", tags=["recipes"])
async def item_recipe_lines(
    item_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    outlet_id: uuid.UUID | None = None,
):
    """The item's active bill of materials, as the inventory service consumes it.

    The inventory ``bill.paid`` handler and the manual ``deduct-recipe`` flow
    fetch lines from this route over HTTP — recipes live in the menu database
    and must not be foreign-keyed into inventory. Without this route,
    recipe-driven stock deduction silently returns nothing and sold dishes
    never shrink stock.

    The active recipe is the item's active recipe (``is_active=True``); if an
    item has several, the one whose ``variant_id`` matches the requested
    variant wins, else the most recently updated active recipe is returned.
    ``outlet_id`` is accepted for forward-compatibility with per-outlet BOM
    overrides and is currently ignored (recipes are org-wide).
    """
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == identity.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")

    recipes = (await db.execute(
        select(Recipe)
        .where(Recipe.menu_item_id == item_id, Recipe.tenant_id == identity.tenant_id,
               Recipe.is_active.is_(True))
        .options(selectinload(Recipe.lines))
        .order_by(Recipe.updated_at.desc())
    )).scalars().all()

    if not recipes:
        # No recipe yet: nothing to deduct. This is a valid state (item not
        # tracked), not an error — inventory treats an empty list as "skip".
        return {"menu_item_id": str(item_id), "lines": []}

    recipe = recipes[0]
    lines = [
        {
            "inventory_item_id": str(line.inventory_item_id),
            "qty_per_portion": float(line.qty),
            "wastage_pct": float(line.wastage_pct or 0),
            "is_optional": bool(line.is_optional),
        }
        for line in recipe.lines
    ]
    return {
        "menu_item_id": str(item_id),
        "recipe_id": str(recipe.id),
        "yield_qty": float(recipe.yield_qty or 1),
        "lines": lines,
    }


# ─── Recipe catalog: search (RAG retrieval) + scaled breakdown ──────────────
#
# The catalog is the library of predefined recipes a chef picks from before a
# dish exists on the menu. Catalog items are ordinary menu items whose code
# starts with "CAT-" — the seed in ``catalog.py`` creates them on startup.
# Keeping them as regular menu items (rather than a parallel table) means the
# existing recipe endpoints, costing and stock-deduction paths all work on a
# catalog recipe with no special-casing.


@router.get("/items/{item_id}/recipe-breakdown",
            response_model=RecipeBreakdownResponse, tags=["recipes"])
async def recipe_breakdown(
    item_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    portions: int = Query(default=1, ge=1, le=1000,
                          description="How many servings to scale the recipe to."),
):
    """The recipe's ingredient breakdown, scaled to N portions.

    This is the page's core read: every ingredient of the dish with the
    quantity the kitchen must actually pull — the per-portion qty scaled by
    ``portions``, inflated by that ingredient's wastage allowance.

    **This endpoint does not read inventory.** It returns the bill of
    materials — ingredient ids, quantities, wastage — and stops there. Live
    stock and cost live in the inventory service, and the menu service does
    not read another service's data; that would break the microservice split
    and would need a cross-service trust path the architecture deliberately
    does not have.

    The caller (the frontend) joins this against the inventory service's
    item list, which it already loads for the stockroom, and computes
    sufficiency and cost. The join key is ``inventory_item_id``, which is
    present on every line.
    """
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id,
                               MenuItem.tenant_id == identity.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")

    recipe = await db.scalar(
        select(Recipe)
        .where(Recipe.menu_item_id == item_id,
               Recipe.tenant_id == identity.tenant_id,
               Recipe.is_active.is_(True))
        .options(selectinload(Recipe.lines))
        .order_by(Recipe.updated_at.desc())
    )
    if recipe is None:
        raise HTTPException(status_code=404, detail="Item has no active recipe")

    yield_qty = float(recipe.yield_qty or 1) or 1.0

    lines: list[RecipeBreakdownLine] = []
    for ln in recipe.lines:
        per_portion = float(ln.qty or 0)
        wastage = float(ln.wastage_pct or 0)
        # Required pull for N portions: the recipe's qty is stated for one
        # yield batch, so divide by the yield to get a per-portion figure,
        # scale by N, then add the wastage allowance on top.
        required = per_portion / yield_qty * portions * (1 + wastage / 100.0)
        lines.append(
            RecipeBreakdownLine(
                inventory_item_id=ln.inventory_item_id,
                name="",
                code="",
                unit="",
                qty_per_portion=round(per_portion / yield_qty, 4),
                wastage_pct=wastage,
                required_for_n=round(required, 4),
                available_stock=0.0,
                is_sufficient=False,
                shortfall=0.0,
                standard_cost=None,
                line_cost=None,
            )
        )

    return RecipeBreakdownResponse(
        item_id=item.id,
        name=item.name,
        yield_qty=yield_qty,
        portions=portions,
        total_cost=None,
        cost_known=False,
        lines=lines,
        shortage_lines=[],
    )


# ─── AI recipe search (global + LLM + inventory reconcile + auto-PO) ──────
#
# Three endpoints, tag "ai", backed by src/services/menu/recipe_ai.py:
#   POST /ai-recipe-search    — global realtime recipe search: LLM
#                               (Gemini -> Claude failover, multimodal) +
#                               Zomato/Swiggy when enabled + always-available
#                               catalog, with per-tenant rate limit, in-memory
#                               cache, and graceful no-key degradation
#   POST /ai-recipe-reconcile — match a recipe's ingredients against live stock
#   POST /ai-recipe-reorder   — draft POs for missing lines, purchase
#                               requests for low lines, idempotent against
#                               open POs/PRs
#
# Reconcile/reorder cross service boundaries over HTTP (inventory cost-lookup
# and items; purchase vendor-items, vendors, open PO/PR, create PO/PR) using
# the trusted-identity-header pattern in shared/identity.py.


from src.services.menu.recipe_ai import (  # noqa: E402
    ai_recipe_reconcile_endpoint,
    ai_recipe_reorder_endpoint,
    ai_recipe_search_endpoint,
)

# The menu service owns the recipe BOMs; these three endpoints sit on the
# menu router so a single "recipe" page doesn't have to hop services for the
# LLM/catalog search, the live-inventory reconcile, and the auto-PO step.


@router.post("/ai-recipe-search", response_model=AiRecipeSearchResponse,
             tags=["ai"], status_code=status.HTTP_200_OK)
async def ai_recipe_search(
    payload: AiRecipeSearchRequest, identity: CurrentIdentity, db: DbDep
) -> AiRecipeSearchResponse:
    """Global realtime AI recipe search — see recipe_ai.ai_recipe_search_endpoint."""
    return await ai_recipe_search_endpoint(payload, identity, db)


@router.post("/ai-recipe-reconcile", response_model=AiReconcileResponse,
             tags=["ai"], status_code=status.HTTP_200_OK)
async def ai_recipe_reconcile(
    payload: AiReconcileRequest, identity: CurrentIdentity, db: DbDep
) -> AiReconcileResponse:
    """Reconcile a recipe against live inventory — see recipe_ai.

    ``outlet_id`` on the payload narrows the menu-item lookup to one outlet
    when the tenant runs the same dish on several; empty = tenant-wide.
    """
    return await ai_recipe_reconcile_endpoint(
        payload, identity, db, outlet_id=payload.outlet_id
    )


@router.post("/ai-recipe-reorder", response_model=AiReorderResponse,
             tags=["ai"], status_code=status.HTTP_200_OK)
async def ai_recipe_reorder(
    payload: AiReorderRequest, identity: CurrentIdentity, db: DbDep
) -> AiReorderResponse:
    """Auto-create draft POs for missing/low lines — see recipe_ai."""
    return await ai_recipe_reorder_endpoint(payload, identity, db)


@router.get("/items/{item_id}/cost", tags=["recipes"])
async def item_food_cost(
    item_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Computed food cost for the item from its recipe, plus margin.

    This is the number a chef or F&B director actually wants to see: what each
    dish costs to make (recipe lines x inventory standard cost, scaled to the
    recipe yield) and what margin that leaves against the selling price. Cost
    is fetched from the inventory service over HTTP — inventory owns
    ``standard_cost``; the menu service must not read that column directly.

    If the inventory service is unavailable the cost lines come back with
    ``standard_cost=null`` and the totals are null rather than zero — a silent
    zero would read as "this dish is free to make", which is the wrong signal.
    """
    item = await db.scalar(
        select(MenuItem).where(MenuItem.id == item_id, MenuItem.tenant_id == identity.tenant_id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")

    body = await item_recipe_lines(item_id, identity, db)
    lines = body["lines"]
    yield_qty = float(body.get("yield_qty") or 1) or 1.0

    # Cost per ingredient, by unit. Inventory owns standard_cost; fetch it.
    import httpx
    from src.services.shared.registry import base_url, get_descriptor

    inv_descriptor = get_descriptor("inventory")
    costs: dict[str, float | None] = {}
    if inv_descriptor is not None and lines:
        ids = [l["inventory_item_id"] for l in lines]
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{base_url(inv_descriptor)}/items/cost-lookup",
                    params={"ids": ids},
                    headers={"X-Identity-Tenant-Id": str(identity.tenant_id)},
                )
                if resp.status_code == 200:
                    for it in resp.json().get("items", []):
                        if it.get("found"):
                            costs[it["id"]] = it.get("standard_cost")
        except Exception:
            costs = {}

    total_cost = 0.0
    cost_known = bool(costs)
    per_line = []
    for line in lines:
        iid = line["inventory_item_id"]
        unit_cost = costs.get(iid)
        # Qty in the recipe is per the recipe yield; scale to a single unit
        # of the sold item by dividing by yield_qty (yield_qty is "how many
        # of this item this recipe makes").
        portion_cost = (float(line["qty_per_portion"]) / yield_qty * unit_cost) if unit_cost is not None else None
        per_line.append({
            "inventory_item_id": iid,
            "qty_per_portion": line["qty_per_portion"],
            "standard_cost": unit_cost,
            "line_cost": round(portion_cost, 4) if portion_cost is not None else None,
        })
        if portion_cost is not None:
            total_cost += portion_cost

    selling_price = float(item.base_price)
    cost = round(total_cost, 2) if cost_known and lines else None
    margin = round(selling_price - cost, 2) if cost is not None else None
    food_cost_pct = round((cost / selling_price * 100), 1) if (cost is not None and selling_price) else None

    return {
        "menu_item_id": str(item_id),
        "name": item.name,
        "selling_price": selling_price,
        "food_cost": cost,
        "margin": margin,
        "food_cost_pct": food_cost_pct,
        "cost_known": cost_known,
        "lines": per_line,
    }


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


@router.put("/variants/{variant_id}", response_model=VariantResponse, tags=["items"])
async def update_variant(
    variant_id: uuid.UUID, payload: VariantUpdate, identity: CurrentIdentity, db: DbDep
):
    """Edit a variant in place — name, price_delta, default flag, active state.
    Live price editing is a hard POS requirement, not delete-and-recreate."""
    identity.require("manage:menu")
    variant = await db.scalar(
        select(MenuItemVariant).where(
            MenuItemVariant.id == variant_id,
            MenuItemVariant.tenant_id == identity.tenant_id,
        )
    )
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")

    data = payload.model_dump(exclude_unset=True)
    if data.pop("is_default", None):
        await db.execute(
            update(MenuItemVariant)
            .where(MenuItemVariant.menu_item_id == variant.menu_item_id,
                   MenuItemVariant.is_default.is_(True))
            .values(is_default=False)
        )
    for field, value in data.items():
        setattr(variant, field, value)
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


@router.put("/addons/{addon_id}", response_model=AddonResponse, tags=["items"])
async def update_addon(
    addon_id: uuid.UUID, payload: AddonUpdate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    addon = await db.scalar(
        select(MenuItemAddon).where(
            MenuItemAddon.id == addon_id,
            MenuItemAddon.tenant_id == identity.tenant_id,
        )
    )
    if addon is None:
        raise HTTPException(status_code=404, detail="Addon not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(addon, field, value)
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


@router.put("/modifiers/{modifier_id}", response_model=ModifierResponse,
            tags=["modifiers"])
async def update_modifier(
    modifier_id: uuid.UUID, payload: ModifierUpdate, identity: CurrentIdentity, db: DbDep
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
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(modifier, field, value)
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
    """Create (or replace, if the same recipe name exists) an item's BOM.

    Up-sert on ``(item, name, variant)`` so a chef re-entering the same
    recipe updates it instead of stacking a duplicate active BOM — which
    would make the next deduction ambiguous. On create-or-update the new
    recipe becomes the item's active one (other active recipes for the same
    variant are deactivated), so there is always exactly one live BOM to
    deduct stock against.
    """
    identity.require("manage:menu")
    item = await _require_item(db, identity, item_id)

    existing = (await db.execute(
        select(Recipe).where(
            Recipe.menu_item_id == item.id,
            Recipe.tenant_id == identity.tenant_id,
            Recipe.name == payload.name,
            Recipe.variant_id == payload.variant_id,
        ).options(selectinload(Recipe.lines))
    )).scalars().first()

    if existing is not None:
        recipe = existing
        recipe.yield_qty = payload.yield_qty
        recipe.yield_uom_id = payload.yield_uom_id
        recipe.instructions = payload.instructions
        recipe.is_active = True
        # Full replace of the line set, not an append.
        recipe.lines = []
    else:
        recipe = Recipe(
            tenant_id=identity.tenant_id,
            menu_item_id=item.id,
            name=payload.name,
            variant_id=payload.variant_id,
            yield_qty=payload.yield_qty,
            yield_uom_id=payload.yield_uom_id,
            instructions=payload.instructions,
            is_active=True,
        )
        db.add(recipe)

    for line in payload.lines:
        recipe.lines.append(RecipeLine(tenant_id=identity.tenant_id,
                                       **line.model_dump()))

    # Exactly one active recipe per (item, variant): deactivate siblings.
    siblings = (await db.execute(
        select(Recipe).where(
            Recipe.menu_item_id == item.id,
            Recipe.tenant_id == identity.tenant_id,
            Recipe.variant_id == payload.variant_id,
            Recipe.id != recipe.id,
            Recipe.is_active.is_(True),
        )
    )).scalars().all()
    for s in siblings:
        s.is_active = False

    item.track_inventory = True
    await db.flush()
    await record_event(
        db, type="menu.item.updated", tenant_id=identity.tenant_id,
        outlet_id=item.outlet_id,
        data={"item_id": str(item.id), "code": item.code},
    )
    return recipe


@router.get("/items/{item_id}/recipe", response_model=RecipeResponse, tags=["recipes"])
async def active_recipe(
    item_id: uuid.UUID,
    identity: CurrentIdentity,
    db: DbDep,
    variant_id: uuid.UUID | None = Query(default=None),
):
    """The item's single active BOM.

    ``list_recipes`` returns every recipe on the item (history); this returns
    the one that inventory actually deducts from — the active recipe for the
    item (and requested variant). This is what a POS screen and the KDS
    should surface: "this dish costs these ingredients, right now."
    """
    recipes = (await db.execute(
        select(Recipe)
        .where(
            Recipe.menu_item_id == item_id,
            Recipe.tenant_id == identity.tenant_id,
            Recipe.is_active.is_(True),
        )
        .options(selectinload(Recipe.lines))
        .order_by(Recipe.updated_at.desc())
    )).scalars().all()

    if not recipes:
        raise HTTPException(status_code=404, detail="No active recipe for this item")
    if variant_id is not None:
        match = next((r for r in recipes if r.variant_id is not None
                      and str(r.variant_id) == str(variant_id)), None)
        if match is not None:
            return match
    return recipes[0]


@router.put("/recipes/{recipe_id}", response_model=RecipeResponse, tags=["recipes"])
async def update_recipe_meta(
    recipe_id: uuid.UUID,
    payload: RecipeUpdate,
    identity: CurrentIdentity,
    db: DbDep,
):
    """Edit a recipe's metadata (name/yield/instructions/active). BOM lines
    have their own replace route — a full BOM swap, not a metadata field."""
    identity.require("manage:menu")
    recipe = await db.scalar(
        select(Recipe)
        .where(Recipe.id == recipe_id, Recipe.tenant_id == identity.tenant_id)
        .options(selectinload(Recipe.lines))
    )
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(recipe, field, value)
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


@router.put("/combos/{combo_id}", response_model=ComboResponse, tags=["combos"])
async def update_combo(
    combo_id: uuid.UUID, payload: ComboUpdate, identity: CurrentIdentity, db: DbDep
):
    """Edit a combo in place — price, description, validity window, active
    state. Item list changes go through add/delete, not this route."""
    identity.require("manage:menu")
    combo = await db.scalar(
        select(Combo)
        .where(Combo.id == combo_id, Combo.tenant_id == identity.tenant_id)
        .options(selectinload(Combo.items))
    )
    if combo is None:
        raise HTTPException(status_code=404, detail="Combo not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(combo, field, value)
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


@router.put("/pricing-rules/{rule_id}", response_model=PricingRuleResponse,
            tags=["pricing"])
async def update_pricing_rule(
    rule_id: uuid.UUID, payload: PricingRuleUpdate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:menu")
    rule = await db.scalar(
        select(PricingRule).where(
            PricingRule.id == rule_id, PricingRule.tenant_id == identity.tenant_id
        )
    )
    if rule is None:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
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
