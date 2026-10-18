"""Service application factory.

Every microservice is built with ``create_service_app``. That gives each one:
  * its own lifespan (DB connect, event-bus start, handler registration)
  * a /health endpoint reporting db + event-bus state
  * standard exception handlers returning the shared ErrorEnvelope
  * the standard CORS posture

A service is plugged OUT by deleting its directory; nothing else changes.
A service is plugged IN by adding a descriptor to ``registry.py``.
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.services.event_bus.bus import Event, bus
from src.services.shared.base import ErrorDetail, ErrorEnvelope
from src.services.shared.registry import ServiceDescriptor
from src.services.shared.service_db import ServiceDatabase

logger = logging.getLogger("service")


async def ensure_service_schema(descriptor: ServiceDescriptor) -> list[str]:
    """Create this service's database and tables if they don't exist yet.

    Called from each service's lifespan. Its ``models`` module must already be
    imported — it is, because ``main.py`` imports it at module scope, before it
    calls ``create_service_app``, which is what builds the app this lifespan
    belongs to. Without that import the service's tables are not on its
    registry yet, and this would create an empty database.

    Returns the tables that exist afterwards, so a caller that wants to log
    what it booted with can.
    """
    from src.config import get_settings
    from src.services.shared.schema_bootstrap import bootstrap_service
    from src.services.shared.service_db import service_base

    settings = get_settings()

    # Read this service's OWN registry. Its models module is already imported
    # at this point (main.py imports it before create_service_app), so the
    # tables are on its metadata — no need to import every service's models,
    # and no risk of another service's broken import stopping this one booting.
    #
    # ``bootstrap_all`` uses ``_service_tables()``, which imports every
    # service's models. Doing that here would defeat the isolation this whole
    # path exists to protect: one service with a broken models module would
    # leave its siblings with empty schemas.
    tables = sorted(service_base(descriptor.name).metadata.tables)

    result = await bootstrap_service(
        descriptor,
        user=settings.postgres_user,
        password=settings.postgres_password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        tables=tables,
    )
    if "error" in result:
        raise RuntimeError(result["error"])
    if not tables:
        logger.warning(
            "Service '%s' has no models registered — its database was created "
            "empty. Import its models module before create_service_app().",
            descriptor.name,
        )
        return []
    logger.info(
        "Schema ready for '%s': %d table(s) in %s",
        descriptor.name, len(tables), descriptor.db_name,
    )
    return tables

ERROR_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    502: "UPSTREAM_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


def create_service_app(
    descriptor: ServiceDescriptor,
    db: ServiceDatabase,
    routers: list | None = None,
    on_startup=None,
    on_shutdown=None,
    version: str = "1.0.0",
    tags: list[dict] | None = None,
) -> FastAPI:
    """Build a standalone FastAPI app for one microservice."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info("Starting service '%s' v%s", descriptor.name, version)

        # Create this service's own database and tables before serving.
        #
        # Without this, a service starts against an empty database and every
        # query fails with `relation "..." does not exist`, which surfaces as a
        # 500 from the handler below. The schema has to exist somewhere, and
        # the service that owns it is the only component that knows which
        # tables it has.
        #
        # Both steps are idempotent — create_all only emits DDL for tables
        # that are missing — so this is safe on every boot and against an
        # already-populated database.
        if os.environ.get("AUTO_CREATE_SCHEMA", "true").lower() != "false":
            try:
                await ensure_service_schema(descriptor)
            except Exception as exc:  # noqa: BLE001
                # A missing schema is fatal for this service, but logging and
                # continuing lets /health report the real state instead of
                # the process dying before it can answer anything.
                logger.error(
                    "Could not create schema for '%s': %s", descriptor.name, exc
                )

        # The service name selects this service's own consumer group. Without it
        # all services share one group and Redis load-balances each event to a
        # single consumer — so an event lands on whichever service happens to be
        # polling, and if that one doesn't subscribe to the topic it is acked
        # and lost. One group per service is what makes this a fan-out bus.
        bus.configure(_redis_url(), descriptor.name)
        await bus.start()
        if on_startup is not None:
            await on_startup(app)
        yield
        if on_shutdown is not None:
            await on_shutdown(app)
        await bus.stop()
        await db.dispose()

    app = FastAPI(
        title=f"RestaurantOS — {descriptor.name}",
        description=descriptor.description,
        version=version,
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
        openapi_tags=tags,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Stash the descriptor + db so handlers and middleware can reach them
    # without threading them through every signature.
    app.state.descriptor = descriptor
    app.state.db = db

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        response = await call_next(request)
        elapsed = (time.perf_counter() - started) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Service"] = descriptor.name
        logger.info(
            "%s %s -> %s (%.1fms) rid=%s",
            request.method, request.url.path, response.status_code,
            elapsed, request_id,
        )
        return response

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        logger.exception("Unhandled error in %s: %s", descriptor.name, exc)
        return JSONResponse(
            status_code=500,
            content=ErrorEnvelope(
                error=ErrorDetail(code="INTERNAL_ERROR", message="Internal server error"),
                service=descriptor.name,
                request_id=getattr(request.state, "request_id", None),
            ).model_dump(mode="json"),
        )

    from fastapi import HTTPException as _HTTPException

    @app.exception_handler(_HTTPException)
    async def http_error(request: Request, exc: _HTTPException):
        detail = exc.detail
        if isinstance(detail, dict):
            message = detail.get("message", str(detail))
            code = detail.get("code", ERROR_CODES.get(exc.status_code, "ERROR"))
            field = detail.get("field")
        else:
            message = str(detail)
            code = ERROR_CODES.get(exc.status_code, "ERROR")
            field = None
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorEnvelope(
                error=ErrorDetail(code=code, message=message, field=field),
                service=descriptor.name,
                request_id=getattr(request.state, "request_id", None),
            ).model_dump(mode="json"),
            headers=getattr(exc, "headers", None),
        )

    @app.get("/health", tags=["ops"])
    async def health():
        db_ok = await db.health()
        return {
            "service": descriptor.name,
            "status": "up" if db_ok else "degraded",
            "version": version,
            "database": "up" if db_ok else "down",
            "event_bus": "up" if bus.redis_available else "degraded",
        }

    @app.get("/_events/stats", tags=["ops"], include_in_schema=False)
    async def event_stats():
        return bus.stats()

    for r in routers or []:
        # Mount at this service's canonical prefix (/api/v1/<service>) so the
        # gateway can proxy to the identical path the client used.
        app.include_router(r, prefix=descriptor.route_prefix)

    return app


def _redis_url() -> str | None:
    import os

    if os.environ.get("REDIS_ENABLED", "true").lower() == "false":
        return None
    url = os.environ.get("REDIS_URL")
    return url or "redis://localhost:6379/0"


def make_event(
    topic: str,
    data: dict,
    tenant_id=None,
    outlet_id=None,
    source: str = "unknown",
    replayed: bool = False,
) -> Event:
    """Build an Event with this service's name stamped in."""
    return Event(
        type=topic,
        data=data,
        tenant_id=tenant_id,
        outlet_id=outlet_id,
        source_service=source,
        replayed=replayed,
    )


__all__ = ["create_service_app", "make_event", "ERROR_CODES"]
