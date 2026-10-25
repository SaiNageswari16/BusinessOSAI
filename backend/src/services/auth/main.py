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
from src.services.auth.outbox import OutboxRelay
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

_relay = OutboxRelay(db)


async def _on_startup(app) -> None:
    await _reconcile_auth_columns()
    await _relay.start()


async def _reconcile_auth_columns() -> None:
    """Add columns that exist in the SQLAlchemy model but are missing from
    the live ``users`` table — the classic case where ``create_all`` runs on
    a database that already has the table, so new columns are silently skipped.

    Only additive DDL is applied (``ADD COLUMN IF NOT EXISTS``); no column is
    ever dropped or retyped, so existing data is never at risk.
    """
    import logging
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    _logger = logging.getLogger("auth.schema")

    engine = create_async_engine(_dsn)
    try:
        async with engine.begin() as conn:
            # Discover which columns are actually missing, then add just those.
            cols_rows = await conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'users'"
                )
            )
            present = {r[0] for r in cols_rows}

            # The model declares these; add any that are not yet in the DB.
            expected: list[tuple[str, str]] = [
                ("mfa_secret", "VARCHAR(64) NULL"),
                ("mfa_enabled", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("token_revoked_before", "TIMESTAMPTZ NULL"),
                ("last_login_at", "TIMESTAMPTZ NULL"),
            ]
            for col_name, col_def in expected:
                if col_name not in present:
                    await conn.execute(
                        text(
                            f'ALTER TABLE users ADD COLUMN IF NOT EXISTS '
                            f'"{col_name}" {col_def}'
                        )
                    )
                    _logger.info("Added missing column users.%s", col_name)
    finally:
        await engine.dispose()


async def _on_shutdown(app) -> None:
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
        "src.services.auth.main:app",
        host="127.0.0.1",
        port=_descriptor.port,
        reload=False,
        log_level="info",
    )
