"""API Gateway — the single public entry point.

Responsibilities:
  1. Route /api/v1/<service>/... to that service over HTTP.
  2. Authenticate ONCE at the edge (validate JWT, check permission) so
     services trust the forwarded identity headers.
  3. Aggregate health across all services.
  4. Enforce the cross-service call policy: services never call each other
     directly — everything crosses the network through this gateway.

Forwarded identity headers (set here, trusted by services):
  X-Identity-User-Id, X-Identity-Tenant-Id, X-Identity-Email,
  X-Identity-Permissions (comma-joined), X-Identity-Is-Owner,
  X-Identity-Active-Outlet, X-Identity-Allowed-Outlets
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Annotated

import httpx
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from src.services.shared.base import ErrorDetail, ErrorEnvelope
from src.services.shared.identity import Identity, bearer_scheme, _decode, dev_fallback_enabled, build_dev_fallback_identity
from src.services.shared.registry import (
    all_services,
    alias_target,
    base_url,
    enabled_services,
    get_descriptor,
    ServiceDescriptor,
)

logger = logging.getLogger("gateway")

GATEWAY_VERSION = "1.0.0"
SERVICE_TIMEOUT = float(os.environ.get("GATEWAY_TIMEOUT_SECONDS", "30"))
MAX_BODY_BYTES = 25 * 1024 * 1024


# ─── Per-tenant module gate ───────────────────────────────────────────────────
#
# The platform service owns TenantModuleState (which verticals each tenant has
# on). The gateway consults a single small platform endpoint,
# GET /module-gate/check?tenant_id=...&module_key=..., and caches the answer
# in-process with a short TTL so the common case (module active, or never
# managed) costs one HTTP round-trip per TTL window, not per request.
#
# Failure policy is "fail open": if the platform service is unreachable the
# request proceeds. A control-plane outage must not take down the data plane;
# the platform is not load-bearing for a request that would otherwise succeed.
# This is deliberate and documented, not a bug.

_MODULE_GATE_TTL_SECONDS = int(os.environ.get("MODULE_GATE_TTL_SECONDS", "5"))
_module_gate_cache: dict[tuple[str, str], tuple[float, bool]] = {}


async def _module_gate_allows(
    http: httpx.AsyncClient,
    tenant_id: str,
    module_key: str,
) -> bool:
    """Is ``module_key`` active for this tenant? Fail open on any error."""
    key = (tenant_id, module_key)
    now = time.monotonic()
    if key in _module_gate_cache:
        checked_at, allowed = _module_gate_cache[key]
        if now - checked_at < _MODULE_GATE_TTL_SECONDS:
            return allowed

    platform_descriptor = get_descriptor("platform")
    if platform_descriptor is None:
        return True  # platform not registered: nothing to gate against
    try:
        resp = await http.get(
            f"{base_url(platform_descriptor)}/api/v1/platform/module-gate/check",
            params={"tenant_id": tenant_id, "module_key": module_key},
            timeout=2.0,
        )
        allowed = resp.status_code == 200 and resp.json().get("allowed", True)
    except Exception:
        # Fail open: a slow or down platform service should not 503 the whole
        # data plane. The cache is left untouched so the next call retries.
        return True
    _module_gate_cache[key] = (now, allowed)
    return allowed


def create_gateway() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.http = httpx.AsyncClient(
            timeout=httpx.Timeout(SERVICE_TIMEOUT),
            limits=httpx.Limits(max_connections=200, max_keepalive_connections=50),
        )
        yield
        await app.state.http.aclose()

    gateway = FastAPI(
        title="RestaurantOS — API Gateway",
        description="Single entry point routing to the RestaurantOS microservices.",
        version=GATEWAY_VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    gateway.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @gateway.middleware("http")
    async def context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Gateway error on %s", request.url.path)
            response = JSONResponse(
                status_code=500,
                content=ErrorEnvelope(
                    error=ErrorDetail(code="INTERNAL_ERROR", message="Gateway error"),
                    service="gateway",
                    request_id=request_id,
                ).model_dump(mode="json"),
            )
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Gateway"] = "restaurantos-gateway"
        response.headers["X-Response-Time-Ms"] = (
            f"{(time.perf_counter() - started) * 1000:.1f}"
        )
        return response

    from fastapi import HTTPException as _HTTPException
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException

    @gateway.exception_handler(_HTTPException)
    async def http_error(request: Request, exc: _HTTPException):
        return _error_response(
            request, exc.status_code, _code_for(exc.status_code), str(exc.detail),
            headers=getattr(exc, "headers", None),
        )

    @gateway.exception_handler(StarletteHTTPException)
    async def starlette_http_error(request: Request, exc: StarletteHTTPException):
        # Plain routing 404/405 — route it to the envelope too, so clients
        # never have to parse two different error shapes.
        return _error_response(
            request, exc.status_code, _code_for(exc.status_code),
            str(exc.detail or "Not found"),
        )

    @gateway.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return _error_response(
            request, 422, "VALIDATION_ERROR",
            "Request validation failed", field=str(exc.errors()),
        )

    _register_ops_routes(gateway)
    _register_service_proxy(gateway)
    return gateway


def _code_for(status_code: int) -> str:
    return {
        400: "BAD_REQUEST", 401: "UNAUTHENTICATED", 403: "FORBIDDEN",
        404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 409: "CONFLICT",
        422: "VALIDATION_ERROR", 429: "RATE_LIMITED", 500: "INTERNAL_ERROR",
        502: "UPSTREAM_ERROR", 503: "SERVICE_UNAVAILABLE", 504: "UPSTREAM_TIMEOUT",
    }.get(status_code, "ERROR")


def _error_response(
    request, status_code: int, code: str, message: str,
    field=None, headers: dict | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ErrorEnvelope(
            error=ErrorDetail(code=code, message=message, field=field),
            service="gateway",
            request_id=getattr(request.state, "request_id", None),
        ).model_dump(mode="json"),
        headers=headers,
    )


# ─── Ops ────────────────────────────────────────────────────────────────────

def _register_ops_routes(gateway: FastAPI) -> None:
    @gateway.get("/health", tags=["ops"])
    async def health():
        client: httpx.AsyncClient = gateway.state.http

        async def probe(d: ServiceDescriptor) -> tuple[str, dict]:
            """One service's health, never raising."""
            entry: dict = {"service": d.name, "status": "down", "database": "unknown",
                           "event_bus": "unknown", "latency_ms": None}
            try:
                t0 = time.perf_counter()
                r = await client.get(f"{base_url(d)}/health")
                entry["latency_ms"] = round((time.perf_counter() - t0) * 1000, 1)
                if r.status_code == 200:
                    body = r.json()
                    entry.update({
                        "status": body.get("status", "up"),
                        "database": body.get("database", "unknown"),
                        "event_bus": body.get("event_bus", "unknown"),
                    })
            except Exception as exc:
                entry["error"] = type(exc).__name__
            return d.name, entry

        # Concurrently, not in a loop. A service that is simply not running
        # costs a full TCP connect timeout, and eleven of those in series put
        # this endpoint at ~22s — past the point where callers give up. The
        # registry declares 13 services but only a few are implemented, so the
        # down ones are the common case, not the exception.
        probed = await asyncio.gather(*(probe(d) for d in enabled_services()))
        services = dict(probed)

        up = sum(1 for s in services.values() if s["status"] == "up")
        overall = "ok" if up == len(services) else ("degraded" if up else "down")
        return {
            "status": overall,
            "gateway": "restaurantos-gateway",
            "version": GATEWAY_VERSION,
            "services_up": up,
            "services_total": len(services),
            "services": services,
        }

    @gateway.get("/services", tags=["ops"])
    async def list_services():
        return {
            "services": [
                {
                    "name": d.name,
                    "description": d.description,
                    "route_prefix": d.route_prefix,
                    "port": d.port,
                    "database": d.db_name,
                    "url": base_url(d),
                    "permissions": list(d.permissions),
                    "publishes": list(d.publishes),
                    "subscribes": list(d.subscribes),
                }
                for d in all_services()
            ]
        }

    @gateway.get("/", tags=["ops"])
    async def root():
        return {
            "app": "RestaurantOS",
            "version": GATEWAY_VERSION,
            "architecture": "microservices",
            "docs": "/docs",
            "api": "/api/v1",
            "services": [d.name for d in all_services()],
        }


# ─── Proxy ──────────────────────────────────────────────────────────────────

_HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length",
}


def _forwarded_headers(request: Request, identity: Identity | None) -> dict[str, str]:
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in _HOP_BY_HOP and not k.lower().startswith("x-identity-")
    }
    headers["X-Request-ID"] = getattr(request.state, "request_id", "")
    if identity is not None:
        headers.update({
            "X-Identity-User-Id": str(identity.user_id),
            "X-Identity-Tenant-Id": str(identity.tenant_id),
            "X-Identity-Email": identity.email,
            "X-Identity-Full-Name": identity.full_name,
            "X-Identity-Permissions": ",".join(sorted(identity.permissions)),
            "X-Identity-Roles": ",".join(sorted(identity.roles)),
            "X-Identity-Is-Owner": "true" if identity.is_tenant_owner else "false",
            "X-Identity-Tenant-Slug": identity.tenant_slug,
            "X-Identity-Active-Outlet": (
                str(identity.active_outlet_id) if identity.active_outlet_id else ""
            ),
            "X-Identity-Allowed-Outlets": ",".join(
                str(o) for o in sorted(identity.allowed_outlet_ids, key=str)
            ),
        })
    return headers


def _register_service_proxy(gateway: FastAPI) -> None:
    """Catch-all proxy: /api/v1/<service>/<rest> -> that service's app."""

    @gateway.api_route(
        "/api/v1/{service}/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        include_in_schema=False,
    )
    async def proxy(request: Request, service: str, path: str):
        descriptor = get_descriptor(service)
        # An aliased prefix (e.g. /hrms, /erp) has its descriptor resolved to
        # the owning service (staff) so identity + module gate evaluate against
        # the owner's module_key, but the request is forwarded using the alias
        # path verbatim — the owning service mounts its routers under that
        # exact prefix (staff exposes /api/v1/hrms/... and /api/v1/erp/...
        # directly), so no rewrite is needed.
        forward_service = service
        if descriptor is None or not descriptor.enabled:
            return JSONResponse(
                status_code=404,
                content=ErrorEnvelope(
                    error=ErrorDetail(
                        code="SERVICE_NOT_FOUND",
                        message=(
                            f"Service '{service}' is not registered. "
                            f"Available: {[d.name for d in enabled_services()]}"
                        ),
                    ),
                    service="gateway",
                    request_id=request.state.request_id,
                ).model_dump(mode="json"),
            )

        # Authenticate at the edge, once.
        credentials = await bearer_scheme(request)
        identity: Identity | None = None
        if credentials is not None:
            try:
                identity = _decode(credentials)
            except Exception:
                identity = None

        # The token bootstrap endpoints must be reachable with NO token — that
        # is the whole point of them: they are how you get a token. Gating them
        # on authentication is a circular lockout (401 on login, so no token,
        # so everything else is 401). Same for the refresh rotation. These are
        # safe without an edge check because the service validates the actual
        # credentials (email+password) and issues the token; the gateway adds
        # nothing here.
        # Tenant-side module status (GET /platform/tenants/me/modules) mirrors
        # the gateway's own gate check, but for the browser: the UI needs to
        # know *which* modules are active so it can hide suspended ribbon
        # studios instead of rendering a page of 404s. It must resolve
        # identity for a normal user token AND skip the module gate — a
        # suspended staff module must not hide its own status endpoint, or
        # the ribbon could never re-activate its UI.
        is_module_status_probe = (
            service == "platform"
            and path.startswith("tenants/me/modules")
            and request.method == "GET"
        )
        if is_module_status_probe:
            # Not bootstrap: it must still authenticate (the endpoint decodes
            # the user token itself), but it rides through the module gate
            # untouched, with the caller's identity forwarded.
            if identity is None:
                if not dev_fallback_enabled():
                    return JSONResponse(
                        status_code=401,
                        content=ErrorEnvelope(
                            error=ErrorDetail(
                                code="UNAUTHENTICATED",
                                message="Not authenticated",
                            ),
                            service="gateway",
                            request_id=request.state.request_id,
                        ).model_dump(mode="json"),
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                from src.services.shared.identity import build_dev_fallback_identity
                identity = await build_dev_fallback_identity(request)
            client_probe: httpx.AsyncClient = gateway.state.http
            target = f"{base_url(descriptor)}/api/v1/{forward_service}/{path}"
            if request.url.query:
                target += f"?{request.url.query}"
            upstream = await client_probe.request(
                request.method,
                target,
                content=(await request.body()) or None,
                headers=_forwarded_headers(request, identity),
            )
            return Response(
                content=upstream.content,
                status_code=upstream.status_code,
                headers={k: v for k, v in upstream.headers.items()
                         if k.lower() not in _HOP_BY_HOP and k.lower() != "content-length"},
            )
        is_token_bootstrap = (
            (service == "auth" and path.startswith("login") and request.method == "POST")
            or (service == "auth" and path.startswith("refresh") and request.method == "POST")
            or (service == "auth" and path.startswith("register") and request.method == "POST")
            or (service == "platform" and path.startswith("auth/login") and request.method == "POST")
        )
        if is_token_bootstrap:
            # Forward as-is; the downstream service handles authentication.
            client: httpx.AsyncClient = gateway.state.http
            target = f"{base_url(descriptor)}/api/v1/{forward_service}/{path}"
            if request.url.query:
                target += f"?{request.url.query}"
            body = await request.body()
            upstream = await client.request(
                request.method,
                target,
                content=body or None,
                headers=_forwarded_headers(request, None),
            )
            return Response(
                content=upstream.content,
                status_code=upstream.status_code,
                headers={k: v for k, v in upstream.headers.items()
                         if k.lower() not in _HOP_BY_HOP and k.lower() != "content-length"},
            )

        if identity is None:
            # Mirror the gate in shared/identity.py — a single source of
            # truth for the fallback policy, enforced at both edges.
            if not dev_fallback_enabled():
                return JSONResponse(
                    status_code=401,
                    content=ErrorEnvelope(
                        error=ErrorDetail(
                            code="UNAUTHENTICATED",
                            message="Not authenticated",
                        ),
                        service="gateway",
                        request_id=request.state.request_id,
                    ).model_dump(mode="json"),
                    headers={"WWW-Authenticate": "Bearer"},
                )
            from src.services.shared.identity import build_dev_fallback_identity

            identity = await build_dev_fallback_identity(request)

        # Per-tenant module gate. Runs for every service that opted in via
        # the registry's enforce_module_gate flag — currently all the
        # industry verticals (menu, pos, kitchen, billing, inventory,
        # purchase, staff, customers, loyalty, accounting, reports), each
        # with its own module_key. A request whose tenant has that module
        # suspended/archived in the platform DB gets a 404 with the standard
        # "not found" envelope — no hint that the module exists for a
        # different tenant. A tenant with no module-state row at all is
        # allowed, so turning the flag on for a service never breaks a
        # tenant that was never put under module management.
        if descriptor.enforce_module_gate and identity is not None and not is_module_status_probe:
            module_key = descriptor.module_key or descriptor.name
            client_for_gate: httpx.AsyncClient = gateway.state.http
            if not await _module_gate_allows(
                client_for_gate, str(identity.tenant_id), module_key
            ):
                return JSONResponse(
                    status_code=404,
                    content=ErrorEnvelope(
                        error=ErrorDetail(
                            code="MODULE_NOT_ACTIVE",
                            message=f"Module '{module_key}' is not active for this tenant",
                        ),
                        service="gateway",
                        request_id=request.state.request_id,
                    ).model_dump(mode="json"),
                )

        client: httpx.AsyncClient = gateway.state.http
        target = f"{base_url(descriptor)}/api/v1/{forward_service}/{path}"
        if request.url.query:
            target += f"?{request.url.query}"

        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content=ErrorEnvelope(
                    error=ErrorDetail(code="PAYLOAD_TOO_LARGE",
                                      message="Request body too large"),
                    service="gateway",
                    request_id=request.state.request_id,
                ).model_dump(mode="json"),
            )

        try:
            upstream = await client.request(
                request.method,
                target,
                content=body or None,
                headers=_forwarded_headers(request, identity),
            )
        except httpx.TimeoutException:
            return JSONResponse(
                status_code=504,
                content=ErrorEnvelope(
                    error=ErrorDetail(
                        code="UPSTREAM_TIMEOUT",
                        message=f"Service '{service}' timed out",
                    ),
                    service="gateway",
                    request_id=request.state.request_id,
                ).model_dump(mode="json"),
            )
        except httpx.RequestError as exc:
            logger.warning("Service '%s' unreachable: %s", service, exc)
            return JSONResponse(
                status_code=503,
                content=ErrorEnvelope(
                    error=ErrorDetail(
                        code="SERVICE_UNAVAILABLE",
                        message=f"Service '{service}' is unreachable",
                    ),
                    service="gateway",
                    request_id=request.state.request_id,
                ).model_dump(mode="json"),
            )

        # Pass the upstream body through verbatim — it's already the
        # service's own ErrorEnvelope on failure, or its payload on success.
        # Raw Response (not JSONResponse) so bytes aren't re-serialised and
        # the upstream content-type is preserved.
        out_headers = {
            k: v for k, v in upstream.headers.items()
            if k.lower() not in _HOP_BY_HOP
        }
        out_headers["X-Service"] = service
        out_headers.pop("content-length", None)
        out_headers.pop("Content-Length", None)
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            headers=out_headers,
        )
