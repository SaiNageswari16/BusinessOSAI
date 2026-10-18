"""Auth service — standalone ASGI app.

Run:  python -m uvicorn src.services.auth.main:app --port 8100
"""
from __future__ import annotations

import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

from src.services.auth import models  # noqa: F401  (registers on this service's base)
from src.services.auth.api import router
from src.services.shared.registry import get_descriptor
from src.services.shared.service_app import create_service_app

_descriptor = get_descriptor("auth")

_dsn = os.environ.get("SERVICE_DATABASE_URL") or os.environ.get("DATABASE_URL_AUTH")
if not _dsn:
    from src.config import get_settings

    s = get_settings()
    _dsn = (
        f"postgresql+asyncpg://{s.postgres_user}:{s.postgres_password}"
        f"@{s.postgres_host}:{s.postgres_port}/{_descriptor.db_name}"
    )

from src.services.shared.service_db import ServiceDatabase

db = ServiceDatabase("auth", _dsn)

app = create_service_app(
    descriptor=_descriptor,
    db=db,
    routers=[router],
    on_startup=None,
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.services.auth.main:app",
        host="127.0.0.1",
        port=_descriptor.port,
        reload=False,
        log_level="info",
    )
