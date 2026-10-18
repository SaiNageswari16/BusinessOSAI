"""Recipe costing — what a dish actually costs to make.

Cost is the sum of every recipe line's ingredient quantity × its rate, grossed
up for wastage and divided by the recipe yield. Rates are maintained on the
inventory item, so updating a supplier price updates the food cost everywhere.
"""
import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models import InventoryItem, Recipe, RecipeLine

TWO_PLACES = Decimal("0.01")


def _d(value) -> Decimal:
    return Decimal("0") if value is None else Decimal(str(value))


def _m(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


async def recipe_cost(
    db: AsyncSession, recipe_id: uuid.UUID, tenant_id: uuid.UUID
) -> dict[str, Any]:
    """Cost breakdown for one recipe.

    Returns the per-line detail plus the total per yield unit, which is the
    food cost used for menu-engineering margins.
    """
    recipe = await db.scalar(
        select(Recipe)
        .options(
            selectinload(Recipe.lines).selectinload(RecipeLine.ingredient)
        )
        .where(Recipe.id == recipe_id, Recipe.tenant_id == tenant_id)
    )
    if recipe is None:
        raise ValueError(f"Recipe {recipe_id} not found")

    lines: list[dict[str, Any]] = []
    total = Decimal("0")

    for line in recipe.lines or []:
        ingredient = line.ingredient
        if ingredient is None:
            continue

        qty = _d(line.qty)
        rate = _d(ingredient.standard_cost)
        wastage = _d(line.wastage_pct) / Decimal("100")

        # A 10% wastage means 1.1 units must be bought per unit used
        effective_qty = qty * (Decimal("1") + wastage)
        line_cost = effective_qty * rate
        total += line_cost

        lines.append({
            "ingredient_id": str(ingredient.id),
            "ingredient_name": ingredient.name,
            "code": ingredient.code,
            "qty": float(qty),
            "uom": ingredient.uom.name if ingredient.uom else None,
            "rate": float(_m(rate)),
            "wastage_pct": float(_d(line.wastage_pct)),
            "line_cost": float(_m(line_cost)),
            "is_optional": bool(line.is_optional),
        })

    yield_qty = _d(recipe.yield_qty) or Decimal("1")
    cost_per_unit = total / yield_qty

    return {
        "recipe_id": str(recipe.id),
        "recipe_name": recipe.name,
        "menu_item_id": str(recipe.menu_item_id),
        "yield_qty": float(yield_qty),
        "total_cost": float(_m(total)),
        "cost_per_unit": float(_m(cost_per_unit)),
        "lines": lines,
    }


async def menu_item_cost(
    db: AsyncSession, menu_item_id: uuid.UUID, tenant_id: uuid.UUID
) -> Decimal:
    """Food cost for one menu item, or zero if it has no active recipe."""
    recipe = await db.scalar(
        select(Recipe).where(
            Recipe.menu_item_id == menu_item_id,
            Recipe.tenant_id == tenant_id,
            Recipe.is_active.is_(True),
        )
    )
    if recipe is None:
        return Decimal("0")

    breakdown = await recipe_cost(db, recipe.id, tenant_id)
    return _d(breakdown["cost_per_unit"])


async def menu_item_costs(
    db: AsyncSession, menu_item_ids: list[uuid.UUID], tenant_id: uuid.UUID
) -> dict[uuid.UUID, Decimal]:
    """Food cost for many items at once — one query, then local arithmetic.

    Reports ask for hundreds of items, so this avoids a query per dish.
    """
    if not menu_item_ids:
        return {}

    recipes = (
        await db.execute(
            select(Recipe)
            .options(
                selectinload(Recipe.lines).selectinload(RecipeLine.ingredient)
            )
            .where(
                Recipe.tenant_id == tenant_id,
                Recipe.menu_item_id.in_(menu_item_ids),
                Recipe.is_active.is_(True),
            )
        )
    ).scalars().all()

    costs: dict[uuid.UUID, Decimal] = {}
    for recipe in recipes:
        total = Decimal("0")
        for line in recipe.lines or []:
            if line.ingredient is None:
                continue
            wastage = _d(line.wastage_pct) / Decimal("100")
            total += (
                _d(line.qty) * (Decimal("1") + wastage)
                * _d(line.ingredient.standard_cost)
            )

        yield_qty = _d(recipe.yield_qty) or Decimal("1")
        costs[recipe.menu_item_id] = _m(total / yield_qty)

    return costs


def margin(
    price: Decimal, cost: Decimal
) -> tuple[Decimal, Decimal]:
    """(margin_amount, margin_pct) for a selling price and food cost."""
    amount = _d(price) - _d(cost)
    pct = (amount / _d(price) * Decimal("100")) if _d(price) > 0 else Decimal("0")
    return _m(amount), _m(pct)


def suggested_price(
    cost: Decimal, target_margin_pct: Decimal, current_price: Decimal | None = None,
    max_increase_pct: Decimal = Decimal("15"),
) -> Decimal:
    """A price that hits the target margin, capped against the current price.

    Restaurants cannot reprice overnight, so the suggestion is limited to a
    single, defensible increase.
    """
    cost = _d(cost)
    if cost <= 0:
        return _m(_d(current_price or 0))

    target = cost / (Decimal("1") - _d(target_margin_pct) / Decimal("100"))

    if current_price is not None and _d(current_price) > 0:
        ceiling = _d(current_price) * (Decimal("1") + _d(max_increase_pct) / Decimal("100"))
        # Never suggest a cut, and never jump more than the cap
        return _m(max(_d(current_price), min(target, ceiling)))

    return _m(target)


async def theoretical_vs_actual(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    outlet_id: uuid.UUID,
    menu_item_id: uuid.UUID,
    qty_sold: int,
) -> dict[str, Any]:
    """Expected ingredient usage vs what left the store.

    A gap beyond the recipe wastage points to over-portioning, spoilage, or
    untracked comps — the classic food-variance check.
    """
    recipe = await db.scalar(
        select(Recipe)
        .options(
            selectinload(Recipe.lines).selectinload(RecipeLine.ingredient)
        )
        .where(
            Recipe.menu_item_id == menu_item_id,
            Recipe.tenant_id == tenant_id,
            Recipe.is_active.is_(True),
        )
    )
    if recipe is None:
        return {"menu_item_id": str(menu_item_id), "has_recipe": False}

    expected: list[dict[str, Any]] = []
    for line in recipe.lines or []:
        if line.ingredient is None or line.is_optional:
            continue
        wastage = _d(line.wastage_pct) / Decimal("100")
        per_plate = _d(line.qty) * (Decimal("1") + wastage)
        expected.append({
            "ingredient_id": str(line.ingredient.id),
            "ingredient_name": line.ingredient.name,
            "uom": line.ingredient.uom.name if line.ingredient.uom else None,
            "per_plate": float(per_plate),
            "expected_total": float(_m(per_plate * _d(qty_sold))),
        })

    return {
        "menu_item_id": str(menu_item_id),
        "has_recipe": True,
        "qty_sold": qty_sold,
        "expected": expected,
    }


# Kept for callers that just want the ingredient rate table
async def ingredient_rates(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, Decimal]:
    items = (
        await db.execute(
            select(InventoryItem).where(
                InventoryItem.tenant_id == tenant_id,
                InventoryItem.is_active.is_(True),
            )
        )
    ).scalars().all()
    return {str(item.id): _m(_d(item.standard_cost)) for item in items}
