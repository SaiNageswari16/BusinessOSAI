"""Platform Control Plane & Super Admin Service — standalone ASGI app.

Run: python -m uvicorn src.services.platform.main:app --port 8113
"""
from __future__ import annotations

import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

from src.services.platform import models  # noqa: F401
from src.services.platform.api import router
from src.services.platform.outbox import OutboxRelay
from src.services.shared.registry import get_descriptor
from src.services.shared.service_app import create_service_app

_descriptor = get_descriptor("platform")

_dsn = os.environ.get("SERVICE_DATABASE_URL") or os.environ.get("DATABASE_URL_PLATFORM")
if not _dsn:
    from src.config import get_settings

    s = get_settings()
    _dsn = (
        f"postgresql+asyncpg://{s.postgres_user}:{s.postgres_password}"
        f"@{s.postgres_host}:{s.postgres_port}/{_descriptor.db_name}"
    )

from src.services.shared.service_db import ServiceDatabase

db = ServiceDatabase("platform", _dsn)

_relay = OutboxRelay(db)


async def _on_startup(app=None):
    from src.services.shared.service_factory import session_factory
    from src.services.platform.service import PlatformService

    maker = session_factory("platform")
    async with maker() as session:
        await PlatformService.seed_defaults(session)
    # Start the outbox relay so pending module-lifecycle events reach the
    # event bus (and the gateway's gate-cache invalidation channel).
    await _relay.start()


async def _on_shutdown(app=None):
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
        "src.services.platform.main:app",
        host="127.0.0.1",
        port=_descriptor.port,
        reload=False,
        log_level="info",
    )
