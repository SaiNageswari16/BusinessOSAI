"""Build a service's ASGI app + database from its registry entry alone.

Every service is wired the same way: resolve its DSN, open its own
ServiceDatabase, register its models on ServiceBase, mount its router. Keeping
that in one place means a new service is a five-line main.py and can't drift
from its siblings.
"""
from __future__ import annotations

import logging
import os

from src.services.shared.registry import ServiceDescriptor, get_descriptor
from src.services.shared.service_app import create_service_app
from src.services.shared.service_db import ServiceDatabase

logger = logging.getLogger("service")


def resolve_dsn(descriptor: ServiceDescriptor) -> str:
    """Precedence: explicit override > this service's env var > built from settings."""
    override = os.environ.get("SERVICE_DATABASE_URL")
    if override:
        return override
    per_service = os.environ.get(f"DATABASE_URL_{descriptor.name.upper()}")
    if per_service:
        return per_service
    from src.config import get_settings

    s = get_settings()
    return (
        f"postgresql+asyncpg://{s.postgres_user}:{s.postgres_password}"
        f"@{s.postgres_host}:{s.postgres_port}/{descriptor.db_name}"
    )


def build_service(name: str, routers, on_startup=None, tags: list[dict] | None = None):
    """Return ``(app, db)`` for a registered service.

    Importing the service's models module is the caller's job — that's what
    puts its tables on this service's own metadata, which is what
    ``create_all`` reads. It must be imported before ``build_service`` runs,
    because ``create_service_app`` creates the schema during the app's lifespan.
    """
    descriptor = get_descriptor(name)
    if descriptor is None:
        raise RuntimeError(f"Service '{name}' is not in the registry")

    dsn = resolve_dsn(descriptor)
    db = ServiceDatabase(name, dsn)
    app = create_service_app(descriptor=descriptor, db=db, routers=routers,
                             on_startup=on_startup, tags=tags)
    logger.info("Service '%s' wired on port %s -> %s",
                name, descriptor.port, descriptor.db_name)
    return app, db
