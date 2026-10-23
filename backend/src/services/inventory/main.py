"""Inventory service entry point.

Run directly:
    python -m src.services.inventory.main
or via run_services.py, which imports `app` from this module.

The models import MUST come before build_service: that is what registers the
tables on this service's own metadata, which is what create_all reads during
the app's lifespan. Without it the database is created empty.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.event_bus.dedupe import install_service_ledger
from src.services.inventory.outbox import OutboxRelay
from src.services.inventory import models  # noqa: F401 - registers tables first
from src.services.inventory.api import router as inventory_router

TAGS = [
    {"name": "inventory", "description": "Items, stock, movements, wastage, adjustments"},
]


async def _on_startup(app=None) -> None:
    """Add migration-only columns to storage_locations if they are missing.

    Runs after build_service has bound the app's state, so we use app.state.db
    rather than the module-level db which is still None at this point.
    """
    from sqlalchemy import text

    db = app.state.db if app is not None else None
    if db is None:
        return
    async with db.engine.begin() as conn:
        await conn.execute(
            text("ALTER TABLE storage_locations ADD COLUMN IF NOT EXISTS module VARCHAR(50) DEFAULT 'restaurant'")
        )
        await conn.execute(
            text("ALTER TABLE storage_locations ADD COLUMN IF NOT EXISTS is_central BOOLEAN DEFAULT FALSE")
        )
        await conn.execute(
            text("ALTER TABLE storage_locations ADD COLUMN IF NOT EXISTS parent_location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL")
        )


_relay = OutboxRelay(None)  # db handle bound at module level after build_service


async def _on_startup_outbox(app) -> None:
    _relay._db = app.state.db
    install_service_ledger(app.state.db)
    await _relay.start()


async def _on_shutdown_outbox(app) -> None:
    await _relay.stop()


async def _on_chained_startup(app) -> None:
    """Chain the column-migration startup with the outbox relay start."""
    await _on_startup(app)
    await _on_startup_outbox(app)


# build_service creates this service's own database and the FastAPI app. The
# module-level `db` is what api.py's event handlers use for their own sessions
# — they run outside any request, so they cannot borrow a request's session.
app, db = build_service(
    "inventory", [inventory_router],
    on_startup=_on_chained_startup,
    on_shutdown=_on_shutdown_outbox,
    tags=TAGS,
)
_relay._db = db


if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("inventory")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")