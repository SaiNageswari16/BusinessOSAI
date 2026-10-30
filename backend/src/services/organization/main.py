"""Organization service — standalone ASGI app.

Run:  python -m uvicorn src.services.organization.main:app --port 8101
"""
from __future__ import annotations

import logging
import os
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

from src.services.organization.api import router
from src.services.organization import models  # noqa: F401  (registers on this service's base)
from src.services.organization import events  # noqa: F401 - @bus.on registrations
from src.services.organization.outbox import OutboxRelay
from src.services.shared.registry import get_descriptor
from src.services.shared.service_app import create_service_app

_descriptor = get_descriptor("organization")

_dsn = os.environ.get("SERVICE_DATABASE_URL") or os.environ.get("DATABASE_URL_ORGANIZATION")
if not _dsn:
    from src.config import get_settings
    s = get_settings()
    _dsn = (
        f"postgresql+asyncpg://{s.postgres_user}:{s.postgres_password}"
        f"@{s.postgres_host}:{s.postgres_port}/{_descriptor.db_name}"
    )

from sqlalchemy import text
from src.services.shared.service_db import ServiceDatabase

db = ServiceDatabase("organization", _dsn)

_relay = OutboxRelay(db)


async def _on_startup(app):
    async with db.engine.begin() as conn:
        try:
            await conn.execute(
                text("ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS shape VARCHAR(30) DEFAULT 'round'")
            )
        except Exception as e:
            logging.warning("Organization startup migration check: %s", e)
    await _relay.start()


async def _on_shutdown(app):
    await _relay.stop()


app = create_service_app(
    descriptor=_descriptor,
    db=db,
    routers=[router],
    on_startup=_on_startup,
    on_shutdown=_on_shutdown,
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.services.organization.main:app",
        host="127.0.0.1",
        port=_descriptor.port,
        reload=False,
        log_level="info",
    )
