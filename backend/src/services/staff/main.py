"""Staff service entry point.

Run directly:
    python -m src.services.staff.main
or via run_services.py, which imports `app` from this module.

The models import MUST come before build_service: that is what registers the
tables on this service's own metadata, which is what create_all reads during
the app's lifespan. Without it the database is created empty.
"""
from __future__ import annotations

from src.services.shared.registry import get_descriptor
from src.services.shared.service_factory import build_service
from src.services.event_bus.dedupe import install_service_ledger
from src.services.staff import models  # noqa: F401 - registers tables first
from src.services.staff.api import router as staff_router, hrms_api_router

TAGS = [
    {"name": "staff", "description": "Employees, rosters, attendance, tips, feedback"},
    {"name": "hrms", "description": "Complete Enterprise HRMS Studios & Workflows"},
]

async def _on_startup(app) -> None:
    install_service_ledger(app.state.db)
    await _ensure_company_rows(app.state.db)


async def _ensure_company_rows(db) -> None:
    """Seed the tenant's monolith-compat Company/Branch/Tenant rows on boot.

    In the microservice split the tenant IS the company; the HRMS API
    (generated from the monolith) still expects one Company row + one HQ
    Branch row + one Tenant row per tenant. Creating them at startup makes
    the legacy fallbacks in attendance.py / recruitment.py / payroll.py work
    with real rows. Existing tenants are matched by key; the lookup is a
    no-op when the rows already exist.

    The compat ``Tenant`` row is keyed with ``id == tenant_id`` (matching the
    monolith, where the tenant row's PK *was* the tenant uuid) because payroll
    resolves the payslip company name via ``select(Tenant).where(Tenant.id ==
    ctx.tenant_id)``.
    """
    from sqlalchemy import func, select, text
    from src.services.staff.models import Branch, Company, Tenant

    async with db.session_factory() as session:
        # Distinct tenants that have staff data (employees or departments).
        tenants = (await session.execute(
            text("SELECT DISTINCT tenant_id FROM employees UNION "
                 "SELECT DISTINCT tenant_id FROM departments")
        )).scalars().all()
        existing = set((await session.execute(
            select(Company.tenant_id)
        )).scalars().all())
        existing_tenants = set((await session.execute(
            select(Tenant.tenant_id)
        )).scalars().all())
        for tenant_id in tenants:
            if tenant_id not in existing:
                comp = Company(tenant_id=tenant_id, slug="primary",
                               name="Workspace", status="active")
                session.add(comp)
                await session.flush()
                session.add(Branch(tenant_id=tenant_id, company_id=comp.id,
                                   code="HQ", name="Headquarters",
                                   status="active"))
                existing.add(tenant_id)
            if tenant_id not in existing_tenants:
                session.add(Tenant(id=tenant_id, tenant_id=tenant_id,
                                   slug="primary", name="Workspace",
                                   status="active"))
                existing_tenants.add(tenant_id)
        await session.commit()


app, db = build_service(
    "staff", [staff_router],
    on_startup=_on_startup,
    tags=TAGS,
)

# Mount canonical HRMS API directly at /api/v1 so that calls to /api/v1/hrms/* and /api/v1/erp/* resolve seamlessly
app.include_router(hrms_api_router, prefix="/api/v1")


# ─── Legacy query-param tolerance ────────────────────────────────────────────
# The HRMS frontend (and stale localStorage) may send company_id values that
# are not UUIDs ("c1", "", mock ids). FastAPI would 422 on every such
# request, breaking whole pages. This middleware silently drops any
# company_id/branch_id query param that is not a valid 32-char hex UUID so
# the handler's "company_id or ctx.active_company_id" fallback kicks in.

import uuid as _uuid_mod
from starlette.types import ASGIApp, Receive, Scope, Send

_COMPANY_PARAM_NAMES = ("company_id", "branch_id")


def _is_uuid(value: str) -> bool:
    try:
        _uuid_mod.UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _clean_query_params(scope: Scope) -> None:
    qs = scope.get("query_string", b"")
    if not qs:
        return
    from urllib.parse import parse_qsl, urlencode
    pairs = parse_qsl(qs.decode("latin-1"), keep_blank_values=True)
    kept = [
        (k, v) for k, v in pairs
        if not (k in _COMPANY_PARAM_NAMES and not _is_uuid(v))
    ]
    if len(kept) != len(pairs):
        scope["query_string"] = urlencode(kept, doseq=False).encode("latin-1")


class _CompanyParamToleranceMiddleware:
    """Raw ASGI middleware: drops non-UUID company_id/branch_id query params."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") in ("http", "websocket"):
            _clean_query_params(scope)
        await self.app(scope, receive, send)


app.add_middleware(_CompanyParamToleranceMiddleware)



if __name__ == "__main__":
    import uvicorn

    descriptor = get_descriptor("staff")
    uvicorn.run(app, host="0.0.0.0", port=descriptor.port, log_level="info")
