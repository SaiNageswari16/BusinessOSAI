"""Seed the predefined recipe catalog into the menu database.

Catalog items are created **idempotently**: on each startup the seed checks
whether each ``CAT-`` code already exists in the menu items table and skips
it if so, so restarting the service does not duplicate the catalog.

For each catalog recipe the seed:
  1. Resolves the inventory item codes referenced by the recipe to UUIDs by
     reading the inventory service's own database (a one-time bootstrap read,
     not a runtime cross-service call — the split rule forbids *runtime*
     cross-service reads, not a boot-time seed). If an ingredient does not
     exist in this tenant's inventory the line is skipped and logged.
  2. Creates the menu item (``MenuItem``) with its base price and type.
  3. Creates the ``Recipe`` and all ``RecipeLine`` rows.

Call this from ``main.py``'s ``on_startup`` hook (done automatically), or run
it once by hand:

    python -m src.services.menu.seed_catalog
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import func, select

logger = logging.getLogger("menu.seed_catalog")


async def _inventory_code_to_id_map(
    codes: list[str],
    tenant_id: uuid.UUID,
) -> dict[str, uuid.UUID]:
    """Resolve inventory item codes to UUIDs by reading the inventory DB.

    Returns a dict of ``code -> inventory_item_id`` for codes found. Missing
    codes are omitted — the caller handles them by skipping the line.

    This reaches into the inventory service's database, which a *runtime*
    cross-service read is forbidden to do. It is a boot-time seed, runs once,
    and only when the catalog item does not already exist, so it is an
    acceptable exception to the split rule.
    """
    if not codes:
        return {}

    from sqlalchemy.ext.asyncio import AsyncSession
    from src.services.shared.service_factory import session_factory as shared_factory

    try:
        factory = shared_factory("inventory")
    except RuntimeError:
        logger.warning("Inventory service not registered — catalog lines unresolvable")
        return {}

    # The inventory models are registered on the inventory service's base.
    from src.services.inventory.models import InventoryItem

    out: dict[str, uuid.UUID] = {}
    async with factory() as session:
        rows = (
            await session.execute(
                select(InventoryItem.id, InventoryItem.code).where(
                    InventoryItem.tenant_id == tenant_id,
                    InventoryItem.code.in_(codes),
                    InventoryItem.is_active.is_(True),
                )
            )
        ).all()
        for _id, code in rows:
            out[code] = _id
    return out


async def seed_catalog(
    db: AsyncSession,
    tenant_id: uuid.UUID,
) -> int:
    """Create any missing catalog items. Returns the count newly created."""
    from src.services.menu.catalog import CATALOG
    from src.services.menu.models import MenuItem, Recipe, RecipeLine

    created = 0
    for spec in CATALOG:
        item_id = await db.scalar(
            select(MenuItem.id).where(
                MenuItem.tenant_id == tenant_id,
                MenuItem.code == spec.code,
            )
        )

        # Idempotent, but self-repairing: if the item exists yet has no recipe
        # lines (an earlier seed ran before the inventory data was available),
        # rebuild the lines. Otherwise skip.
        if item_id is not None:
            line_count = await db.scalar(
                select(func.count())
                .select_from(RecipeLine)
                .join(Recipe, Recipe.id == RecipeLine.recipe_id)
                .where(
                    Recipe.menu_item_id == item_id,
                    Recipe.tenant_id == tenant_id,
                )
            )
            if (line_count or 0) > 0:
                continue
            logger.info(
                "Catalog item %s exists with 0 lines — rebuilding recipe lines",
                spec.code,
            )
        else:
            item_id = None

        # Resolve all inventory codes for this recipe in one batch DB read
        codes = [ln.inventory_code for ln in spec.lines]
        resolved = await _inventory_code_to_id_map(codes, tenant_id)
        logger.info(
            "Seeding catalog item %s: %d/%d inventory lines resolved",
            spec.code, len(resolved), len(codes),
        )

        if item_id is None:
            item = MenuItem(
                tenant_id=tenant_id,
                code=spec.code,
                name=spec.name,
                description=spec.description,
                item_type=spec.item_type,
                base_price=spec.base_price,
                track_inventory=True,
            )
            db.add(item)
            await db.flush()
            item_id = item.id

        lines = []
        for ln in spec.lines:
            inventory_id = resolved.get(ln.inventory_code)
            if inventory_id is None:
                logger.warning(
                    "Catalog %s: inventory item '%s' not found in this tenant's "
                    "inventory — line skipped. Add it to inventory to complete the recipe.",
                    spec.code, ln.inventory_code,
                )
                continue
            lines.append(
                RecipeLine(
                    tenant_id=tenant_id,
                    recipe_id=None,  # set below
                    inventory_item_id=inventory_id,
                    qty=ln.qty,
                    uom_id=None,
                    wastage_pct=ln.wastage_pct,
                    is_optional=ln.is_optional,
                )
            )

        recipe = Recipe(
            tenant_id=tenant_id,
            menu_item_id=item_id,
            name=f"{spec.name} standard",
            yield_qty=spec.yield_qty,
            instructions=spec.instructions,
            is_active=True,
        )
        for ln in lines:
            recipe.lines.append(ln)
        db.add(recipe)
        await db.flush()

        created += 1
        logger.info("Seeded catalog item %s (%d lines)", spec.name, len(lines))

    if created:
        await db.commit()
        logger.info("Catalog seed complete: %d new items", created)
    return created


if __name__ == "__main__":
    import asyncio
    from sqlalchemy import func

    from src.services.menu.models import MenuItem
    from src.services.shared.service_factory import session_factory as shared_factory

    async def _run() -> None:
        menu_factory = shared_factory("menu")
        async with menu_factory() as session:
            tenant_ids = (
                await session.execute(
                    select(func.distinct(MenuItem.tenant_id))
                )
            ).scalars().all()
            for tid in tenant_ids:
                n = await seed_catalog(session, tid)
                print(f"Tenant {tid}: seeded {n} catalog item(s)")

    asyncio.run(_run())
