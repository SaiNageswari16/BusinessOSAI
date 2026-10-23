"""Menu service — standalone ASGI app.

Run:  python -m uvicorn src.services.menu.main:app --port 8102
"""
from __future__ import annotations

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

from sqlalchemy import func, select  # noqa: F401

from src.services.menu import models  # noqa: F401  (registers on this service's base)
from src.services.menu.api import router
from src.services.menu.seed_catalog import seed_catalog
from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service

TAGS = [
    {"name": "items", "description": "Menu items and pricing"},
    {"name": "categories", "description": "Menu categories"},
    {"name": "modifiers", "description": "Modifier groups and modifiers"},
    {"name": "recipes", "description": "Bills of materials (consumed by inventory)"},
    {"name": "combos", "description": "Combo deals"},
    {"name": "pricing", "description": "Time-based and bulk pricing rules"},
    {"name": "ai", "description": "AI recipe search, inventory reconcile, auto-PO"},
]


async def _on_startup(app) -> None:
    """Seed the predefined recipe catalog on every boot (idempotent).

    The seed needs a tenant id — it seeds for every tenant that has at least
    one menu item already, because the catalog is scoped to a tenant and we
    do not want to create it for tenants that do not use the menu service at
    all.

    Runs quietly on failure: a missing inventory service or a network blip
    should not take the menu service down.
    """
    logger = logging.getLogger("menu.seed")
    try:
        async with app.state.db.session_factory() as session:
            tenant_ids = (
                await session.execute(
                    select(func.distinct(models.MenuItem.tenant_id))
                )
            ).scalars().all()
            if not tenant_ids:
                # No tenants in this menu DB yet — seed will run on next boot
                # after the first tenant creates a menu item.
                return
            for tid in tenant_ids:
                await seed_catalog(session, tid)
            logger.info("Catalog seed complete for %d tenant(s)", len(tenant_ids))
    except Exception as exc:
        logger.warning("Catalog seed failed (service will start regardless): %s", exc)


app, db = build_service("menu", [router], on_startup=_on_startup, tags=TAGS)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.services.menu.main:app",
        host="127.0.0.1",
        port=get_descriptor("menu").port,
        reload=False,
        log_level="info",
    )
