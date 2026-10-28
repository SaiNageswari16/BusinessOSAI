"""Platform Service HTTP endpoints."""
from __future__ import annotations

import logging
import uuid
from typing import Annotated, Any

logger = logging.getLogger("platform_api")

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.platform.models import (
    AccessPolicy,
    ModuleLifecycleState,
    PlatformAdmin,
    PlatformAdminRole,
    PlatformAuditEntry,
    PluginManifest,
    TenantModuleState,
    _utcnow,
)
from src.services.platform.schemas import (
    AccessPolicyCreateRequest,
    AccessPolicyResponse,
    AdminCreateRequest,
    AdminListResponse,
    AdminUpdateRequest,
    AuditEntryResponse,
    AuditListResponse,
    FleetHealthReport,
    ModuleLifecycleRequest,
    PermissionCreateRequest,
    PermissionItem,
    PlatformAdminResponse,
    PlatformLoginRequest,
    PlatformTokenResponse,
    PluginManifestResponse,
    TenantModuleStateResponse,
    TenantOnboardRequest,
    TenantOnboardResponse,
    TenantRosterItem,
    TenantRosterResponse,
    TenantSummaryResponse,
)
from src.services.platform.service import PlatformService
from src.services.shared.service_factory import get_session
from src.utils.security import decode_access_token

router = APIRouter(tags=["platform"])
bearer = HTTPBearer(auto_error=False)


# ─── Auth Dependency ─────────────────────────────────────────────────────────

async def require_platform_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PlatformAdmin:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Platform super admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = decode_access_token(credentials.credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid platform token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if claims.get("auth_realm") != "platform":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant tokens cannot access the platform control plane",
        )

    admin_id = uuid.UUID(claims["sub"])
    res = await session.execute(
        select(PlatformAdmin).where(
            PlatformAdmin.id == admin_id, PlatformAdmin.is_active.is_(True)
        )
    )
    admin = res.scalar_one_or_none()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Platform administrator not found or inactive",
        )
    return admin


def require_role(*roles: str):
    """Role-scoped gate. ``super_admin`` always passes; any other admin must
    hold one of ``roles``.

    Without this, every route that takes ``require_platform_admin`` treats
    all four roles as equivalent — an ``ops_admin`` could create a
    ``super_admin``, flip a kill-switch, or delete a policy. The roles exist
    in the model and the UI labels them, but nothing enforced them; this is
    that enforcement.
    """
    async def _dep(
        admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    ) -> PlatformAdmin:
        if admin.role == "super_admin" or admin.role in roles:
            return admin
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires role {list(roles)} (or super_admin); you are {admin.role}",
        )
    return _dep


# ─── Auth Endpoints ──────────────────────────────────────────────────────────

@router.post("/auth/login", response_model=PlatformTokenResponse)
async def platform_login(
    req: PlatformLoginRequest, session: Annotated[AsyncSession, Depends(get_session)]
):
    admin = await PlatformService.authenticate_admin(session, req.email, req.password)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid platform admin credentials",
        )
    token = PlatformService.issue_platform_token(admin)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 43200,
        "admin": {
            "id": admin.id,
            "email": admin.email,
            "full_name": admin.full_name,
            "role": admin.role,
            "is_active": admin.is_active,
            "last_login_at": admin.last_login_at,
            "created_at": admin.created_at,
        },
    }


@router.get("/auth/me", response_model=PlatformAdminResponse)
async def platform_me(admin: Annotated[PlatformAdmin, Depends(require_platform_admin)]):
    return {
        "id": admin.id,
        "email": admin.email,
        "full_name": admin.full_name,
        "role": admin.role,
        "is_active": admin.is_active,
        "last_login_at": admin.last_login_at,
        "created_at": admin.created_at,
    }


# ─── Plugin Marketplace Endpoints ────────────────────────────────────────────

@router.get("/plugins", response_model=list[PluginManifestResponse])
async def list_plugins(
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """The full module catalogue: the six seeded verticals plus one row per
    core service (menu, pos, kitchen, ... reports). Core services are the
    ones the gateway's per-tenant module gate actually keys on, so this is
    the list a platform admin should be toggling.

    Each entry carries ``gated`` — whether the gateway enforces the
    per-tenant module check for this service — so the admin UI can say the
    truth about what suspending a row will (or won't) do in the data plane.
    """
    from src.services.shared.registry import all_services
    from src.services.platform.models import PluginManifest

    plugins = await PlatformService.list_plugins(session)
    seeded_ids = {p.id for p in plugins}
    core_rows: list[PluginManifest] = []
    for descriptor in all_services():
        if descriptor.name in ("auth", "platform") or descriptor.name in seeded_ids:
            continue  # auth/platform never gate; verticals already have rows
        existing = await session.execute(
            select(PluginManifest).where(PluginManifest.id == descriptor.name)
        )
        row = existing.scalar_one_or_none()
        if row is None:
            row = PluginManifest(
                id=descriptor.name,
                name=descriptor.name,
                version="1.0.0",
                category="core_addon",
                description=descriptor.description,
                is_system=True,
                is_active=True,
            )
            session.add(row)
        core_rows.append(row)
    if core_rows:
        await session.commit()

    descriptors_by_name = {d.name: d for d in all_services()}
    out = []
    for p in [*plugins, *core_rows]:
        descriptor = descriptors_by_name.get(p.id)
        out.append({
            "id": p.id,
            "name": p.name,
            "version": p.version,
            "category": p.category,
            "description": p.description,
            "icon": p.icon,
            "required_capabilities": p.required_capabilities,
            "permissions": p.permissions,
            "navigation": p.navigation,
            "settings_schema": p.settings_schema,
            "is_system": p.is_system,
            "is_active": p.is_active,
            # A core service row is only useful if the gateway enforces its
            # per-tenant module check; report that honestly.
            "gated": bool(descriptor and descriptor.enforce_module_gate),
        })
    return out


@router.post("/plugins/{plugin_id}/toggle-kill-switch", response_model=PluginManifestResponse)
async def toggle_plugin_kill_switch(
    plugin_id: str,
    is_active: bool,
    admin: Annotated[PlatformAdmin, Depends(require_role("super_admin", "ops_admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        p = await PlatformService.toggle_plugin_kill_switch(
            session, plugin_id, is_active, admin.email
        )
        return {
            "id": p.id,
            "name": p.name,
            "version": p.version,
            "category": p.category,
            "description": p.description,
            "icon": p.icon,
            "required_capabilities": p.required_capabilities,
            "permissions": p.permissions,
            "navigation": p.navigation,
            "settings_schema": p.settings_schema,
            "is_system": p.is_system,
            "is_active": p.is_active,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ─── Tenant Module Lifecycle ─────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}/modules", response_model=list[TenantModuleStateResponse])
async def get_tenant_modules(
    tenant_id: uuid.UUID,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    modules = await PlatformService.get_tenant_modules(session, tenant_id)
    return [
        {
            "id": m.id,
            "tenant_id": m.tenant_id,
            "plugin_id": m.plugin_id,
            "state": m.state,
            "activated_version": m.activated_version,
            "schema_version": m.schema_version,
            "config": m.config,
            "activated_at": m.activated_at,
            "suspended_at": m.suspended_at,
            "archived_at": m.archived_at,
        }
        for m in modules
    ]


@router.post(
    "/tenants/{tenant_id}/modules/{plugin_id}/activate",
    response_model=TenantModuleStateResponse,
)
async def activate_tenant_module(
    tenant_id: uuid.UUID,
    plugin_id: str,
    req: ModuleLifecycleRequest,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        m = await PlatformService.activate_module(
            session, tenant_id, plugin_id, admin.id, admin.email, req.config
        )
        return {
            "id": m.id,
            "tenant_id": m.tenant_id,
            "plugin_id": m.plugin_id,
            "state": m.state,
            "activated_version": m.activated_version,
            "schema_version": m.schema_version,
            "config": m.config,
            "activated_at": m.activated_at,
            "suspended_at": m.suspended_at,
            "archived_at": m.archived_at,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/tenants/{tenant_id}/modules/{plugin_id}/suspend",
    response_model=TenantModuleStateResponse,
)
async def suspend_tenant_module(
    tenant_id: uuid.UUID,
    plugin_id: str,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        m = await PlatformService.suspend_module(
            session, tenant_id, plugin_id, admin.id, admin.email
        )
        return {
            "id": m.id,
            "tenant_id": m.tenant_id,
            "plugin_id": m.plugin_id,
            "state": m.state,
            "activated_version": m.activated_version,
            "schema_version": m.schema_version,
            "config": m.config,
            "activated_at": m.activated_at,
            "suspended_at": m.suspended_at,
            "archived_at": m.archived_at,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/tenants/{tenant_id}/modules/{plugin_id}/archive",
    response_model=TenantModuleStateResponse,
)
async def archive_tenant_module(
    tenant_id: uuid.UUID,
    plugin_id: str,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        m = await PlatformService.archive_module(
            session, tenant_id, plugin_id, admin.id, admin.email
        )
        return {
            "id": m.id,
            "tenant_id": m.tenant_id,
            "plugin_id": m.plugin_id,
            "state": m.state,
            "activated_version": m.activated_version,
            "schema_version": m.schema_version,
            "config": m.config,
            "activated_at": m.activated_at,
            "suspended_at": m.suspended_at,
            "archived_at": m.archived_at,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ─── Module gate check (consumed by the API gateway) ────────────────────────

@router.get("/module-gate/check")
async def module_gate_check(
    tenant_id: uuid.UUID,
    module_key: str,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Answer one gateway question: is ``module_key`` active for this tenant?

    The gateway calls this on every proxied request to a module-gated
    service, and caches the answer briefly (see the gateway's ``_module_gate``
    helper) so a tenant with no module state rows in the platform DB never
    pays a round-trip on every request.

    The decision logic:
      * No TenantModuleState row for this (tenant, module_key) at all:
        the tenant has never been under module management for this module,
        so the module is active by default. This is the key property that
        makes it safe to turn on ``enforce_module_gate`` for an existing
        service without breaking any tenant that has not yet been onboarded
        through the platform — absence of a row means "unmanaged", not
        "suspended".
      * A row exists and ``state == "active"``: allow.
      * A row exists in any other state (suspended, archived, migrating,
        install_failed): block with a 404, indistinguishable from an
        unregistered route — the tenant should not learn that a disabled
        module's endpoints exist at all.

    No auth at this route: the gateway is the only caller, and the gateway
    itself is already authenticated before it proxies. A direct call from
    outside would be meaningless — it returns a state row, not data.
    """
    # Global kill-switch: when the module's PluginManifest is de-activated the
    # whole vertical is off for everyone, tenant row or not. This is the
    # data-plane effect the toggle advertised but the gate never consulted.
    # ``PluginManifest.id`` matches the service name for core services, which
    # is exactly what the gateway keys ``module_key`` on, so the lookup is the
    # same key the gate already uses.
    manifest_res = await session.execute(
        select(PluginManifest).where(PluginManifest.id == module_key)
    )
    manifest = manifest_res.scalar_one_or_none()
    if manifest is not None and not manifest.is_active:
        return {"module_key": module_key, "state": "kill_switched", "allowed": False}

    res = await session.execute(
        select(TenantModuleState).where(
            TenantModuleState.tenant_id == tenant_id,
            TenantModuleState.plugin_id == module_key,
        )
    )
    row = res.scalar_one_or_none()
    if row is None:
        return {"module_key": module_key, "state": "active_by_default", "allowed": True}
    return {
        "module_key": module_key,
        "state": str(getattr(row.state, "value", row.state)),
        "allowed": str(getattr(row.state, "value", row.state)) == ModuleLifecycleState.ACTIVE.value,
    }


# ─── Tenant-facing module status ─────────────────────────────────────────────
#
# The UI needs to know *which* modules are active for the tenant so ribbons
# and nav chrome can hide suspended studios instead of rendering a page of
# 404s. The gateway's /module-gate/check above is deliberately unauthenticated
# because only the gateway calls it; this route is the tenant-side twin and
# authenticates a normal user token.

@router.get("/tenants/me/modules")
async def my_module_status(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Report the module lifecycle state of the caller's tenant.

    Returns one entry per module that has a TenantModuleState row for the
    caller's tenant. Modules with no row are "active by default" and are
    simply absent from the list (same convention as the gate check), so the
    caller treats "not listed" as allowed.

    Auth: any valid user token from the auth service. The identity is
    resolved through the shared gateway/identity machinery so the tenant is
    the caller's own tenant (or the impersonation target, when an admin
    carries the X-Impersonate-Tenant header — matching every other
    tenant-scoped route in the fleet).
    """
    from src.utils.security import decode_access_token

    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Not authenticated"},
        )
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Invalid token"},
        )
    tenant_id = (
        request.headers.get("X-Impersonate-Tenant")
        or str(payload.get("tenant_id") or payload.get("tenant") or "")
    )
    if not tenant_id:
        return {"tenant_id": None, "modules": []}
    try:
        parsed_tenant = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_TENANT", "message": "Invalid tenant identifier"},
        )
    res = await session.execute(
        select(TenantModuleState).where(TenantModuleState.tenant_id == parsed_tenant)
    )
    rows = list(res.scalars().all())
    modules = [
        {
            "module_key": row.plugin_id,
            "state": str(getattr(row.state, "value", row.state)),
        }
        for row in rows
    ]
    # Global kill-switches block the gate for EVERY tenant regardless of
    # per-tenant rows — so report them here too, otherwise a ribbon built
    # from this endpoint keeps showing tabs the gate would 404. A kill-
    # switched module that also has a tenant row keeps the tenant row's
    # state (the gate consults the kill-switch first, but either way the
    # answer is "blocked", so the UI only needs to know it is not active).
    have = {m["module_key"] for m in modules}
    ks_res = await session.execute(
        select(PluginManifest).where(PluginManifest.is_active.is_(False))
    )
    for ks in ks_res.scalars():
        if ks.id not in have:
            modules.append({"module_key": ks.id, "state": "kill_switched"})
    return {"tenant_id": str(parsed_tenant), "modules": modules}


# ─── Tenant Roster (full auth-service list, paged) ─────────────────────────

@router.get("/tenants/all", response_model=TenantRosterResponse)
async def list_all_tenants(
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    """The complete tenant roster — every tenant the auth service knows,
    not just the ones the platform has managed.

    This is the "thousands of tenants" view: at fleet scale the module-
    state table only contains tenants someone has onboarded, so the
    control plane needs to see (and be able to onboard) the rest. It is
    paged server-side so a 10k-tenant deployment never dumps the whole
    table to the browser.
    """
    limit = max(1, min(limit, 500))
    try:
        roster, total = await PlatformService.list_all_tenants(
            session, search=search, limit=limit, offset=offset,
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Enrich roster rows with platform-managed module state.
    from src.services.platform.models import ModuleLifecycleState as _MLS
    managed_ids = [uuid.UUID(t["id"]) for t in roster if t.get("id")]
    module_map: dict[uuid.UUID, list[str]] = {}
    version_map: dict[uuid.UUID, dict[str, str]] = {}
    managed_set: set[uuid.UUID] = set()
    if managed_ids:
        rows = await session.execute(
            select(TenantModuleState).where(
                TenantModuleState.tenant_id.in_(managed_ids),
                TenantModuleState.state == _MLS.ACTIVE,
            )
        )
        for m in rows.scalars().all():
            module_map.setdefault(m.tenant_id, []).append(m.plugin_id)
            version_map.setdefault(m.tenant_id, {})[m.plugin_id] = m.activated_version
            managed_set.add(m.tenant_id)

    out: list[TenantRosterItem] = []
    for t in roster:
        tid = uuid.UUID(t["id"]) if t.get("id") else None
        entry = TenantRosterItem(
            id=tid,
            name=t.get("name") or t.get("slug") or "Unknown",
            slug=t.get("slug") or str(tid),
            status=t.get("status") or "active",
            plan=t.get("plan") or "pro",
            created_at=t.get("created_at") or _utcnow(),
            active_modules=sorted(module_map.get(tid, [])) if tid else [],
            module_versions=version_map.get(tid, {}) if tid else {},
            is_managed=bool(tid and tid in managed_set),
        )
        out.append(entry)

    return TenantRosterResponse(items=out, total=total)


# ─── Audit Trail ────────────────────────────────────────────────────────────

def _audit_entry_dict(e: PlatformAuditEntry) -> dict:
    return {
        "id": e.id,
        "admin_id": e.admin_id,
        "admin_email": e.admin_email,
        "action": e.action,
        "target_type": e.target_type,
        "target_id": e.target_id,
        "details": e.details,
        "ip_address": e.ip_address,
        "created_at": e.created_at,
    }


@router.get("/audit", response_model=AuditListResponse)
async def list_audit(
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: int = 100,
    offset: int = 0,
    action: str | None = None,
    admin_email: str | None = None,
    target_type: str | None = None,
):
    """Page through the immutable control-plane audit log.

    Every module lifecycle change, policy write, and admin account action
    lands here — the answer to "who did what to which tenant, and when"
    for compliance review. Filter by action / admin / target type; the page
    is capped at 500 rows.
    """
    items, total = await PlatformService.list_audit(
        session, limit=limit, offset=offset,
        action=action, admin_email=admin_email, target_type=target_type,
    )
    return {
        "items": [_audit_entry_dict(e) for e in items],
        "total": total,
        "has_more": offset + len(items) < total,
    }


# ─── Admin Users ────────────────────────────────────────────────────────────

def _admin_dict(a: PlatformAdmin) -> dict:
    return {
        "id": a.id,
        "email": a.email,
        "full_name": a.full_name,
        "role": a.role,
        "is_active": a.is_active,
        "last_login_at": a.last_login_at,
        "created_at": a.created_at,
    }


@router.get("/admins", response_model=AdminListResponse)
async def list_admins(
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Everyone with access to the control plane — the fleet's first line of
    defence is a short, known, active list of people."""
    admins = await PlatformService.list_admins(session)
    return {"items": [_admin_dict(a) for a in admins], "total": len(admins)}


@router.post("/admins", response_model=PlatformAdminResponse, status_code=201)
async def create_admin(
    req: AdminCreateRequest,
    admin: Annotated[PlatformAdmin, Depends(require_role("super_admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        created = await PlatformService.create_admin(
            session, req.email, req.password, req.full_name, req.role, admin.email,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _admin_dict(created)


@router.patch("/admins/{admin_id}", response_model=PlatformAdminResponse)
async def update_admin(
    admin_id: uuid.UUID,
    req: AdminUpdateRequest,
    admin: Annotated[PlatformAdmin, Depends(require_role("super_admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        updated = await PlatformService.update_admin(
            session, admin_id, req.model_dump(exclude_unset=True), admin.email,
        )
    except ValueError as exc:
        detail = str(exc)
        code = 404 if "not found" in detail else 409
        raise HTTPException(status_code=code, detail=detail)
    return _admin_dict(updated)


# ─── Permissions & Policies ─────────────────────────────────────────────────

@router.get("/permissions", response_model=list[PermissionItem])
async def list_permissions(
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
    module: str | None = None,
):
    perms = await PlatformService.list_permissions(session, module)
    return [
        {
            "code": p.code,
            "module": p.module,
            "name": p.name,
            "description": p.description,
            "tier": p.tier,
            "is_system": p.is_system,
        }
        for p in perms
    ]


@router.post("/permissions", response_model=PermissionItem, status_code=201)
async def create_permission(
    req: PermissionCreateRequest,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    try:
        p = await PlatformService.create_permission(
            session, req.code, req.module, req.name, req.description, req.tier, admin.email
        )
        return {
            "code": p.code,
            "module": p.module,
            "name": p.name,
            "description": p.description,
            "tier": p.tier,
            "is_system": p.is_system,
        }
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/policies", response_model=list[AccessPolicyResponse])
async def list_policies(
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
    tenant_id: uuid.UUID | None = None,
):
    policies = await PlatformService.list_policies(session, tenant_id)
    return [
        {
            "id": pol.id,
            "tenant_id": pol.tenant_id,
            "subject": pol.subject,
            "module": pol.module,
            "resource": pol.resource,
            "operation": pol.operation,
            "effect": pol.effect,
            "params": pol.params,
            "condition": pol.condition,
            "priority": pol.priority,
            "created_at": pol.created_at,
        }
        for pol in policies
    ]


@router.delete("/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: uuid.UUID,
    admin: Annotated[PlatformAdmin, Depends(require_role("super_admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Retire an ABAC policy. The rule's content is captured in the audit log,
    so what was enforced is reconstructable after deletion."""
    try:
        await PlatformService.delete_policy(session, policy_id, admin.email)
    except ValueError as exc:
        detail = str(exc)
        code = 404 if "not found" in detail.lower() else 400
        raise HTTPException(status_code=code, detail=detail)


@router.post("/policies", response_model=AccessPolicyResponse, status_code=201)
async def create_policy(
    req: AccessPolicyCreateRequest,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    policy = await PlatformService.create_policy(
        session, req.model_dump(exclude_unset=True), admin.email
    )
    return {
        "id": policy.id,
        "tenant_id": policy.tenant_id,
        "subject": policy.subject,
        "module": policy.module,
        "resource": policy.resource,
        "operation": policy.operation,
        "effect": policy.effect,
        "params": policy.params,
        "condition": policy.condition,
        "priority": policy.priority,
        "created_at": policy.created_at,
    }


# ─── Fleet Health Telemetry ──────────────────────────────────────────────────

@router.get("/fleet/health", response_model=FleetHealthReport)
async def fleet_health(admin: Annotated[PlatformAdmin, Depends(require_platform_admin)]):
    return await PlatformService.probe_fleet_health()

@router.get("/tenants", response_model=list[TenantSummaryResponse])
async def list_all_tenants(
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """List tenants known to the platform, with their active modules.

    The tenant universe here is the set of tenant_ids that appear in
    TenantModuleState — i.e. tenants that have ever had a module activated
    or suspended through the platform control plane. A tenant that was
    created in the auth service but has not yet been onboarded through the
    platform will not appear; that is by design, because the platform only
    owns rows for tenants it has managed. Cross-service tenant data (names,
    slugs, plans) is fetched over HTTP from the auth service when available
    and falls back to a synthetic identifier otherwise.
    """
    res = await session.execute(
        select(TenantModuleState.tenant_id)
        .order_by(TenantModuleState.tenant_id)
        .distinct()
    )
    tenant_ids = [row[0] for row in res.all()]

    mod_map: dict[uuid.UUID, list[str]] = {}
    active_versions: dict[uuid.UUID, dict[str, str]] = {}
    if tenant_ids:
        mod_res = await session.execute(
            select(TenantModuleState).where(
                TenantModuleState.tenant_id.in_(tenant_ids),
                TenantModuleState.state == ModuleLifecycleState.ACTIVE,
            )
        )
        for m in mod_res.scalars().all():
            mod_map.setdefault(m.tenant_id, []).append(m.plugin_id)
            active_versions.setdefault(m.tenant_id, {})[m.plugin_id] = m.activated_version

    # Try to enrich with real tenant names via the auth service. If the auth
    # service is not running or has no platform-facing list endpoint, fall
    # back to a synthetic identifier rather than crossing the DB boundary.
    tenant_details: dict[uuid.UUID, dict] = {}
    try:
        import httpx
        from src.services.shared.registry import base_url, get_descriptor

        auth_descriptor = get_descriptor("auth")
        if auth_descriptor is not None:
            async with httpx.AsyncClient(timeout=5.0) as client:
                list_resp = await client.get(
                    f"{base_url(auth_descriptor)}/api/v1/auth/tenants"
                )
                if list_resp.status_code == 200:
                    for t in list_resp.json():
                        try:
                            tenant_details[uuid.UUID(t["id"])] = t
                        except (KeyError, ValueError):
                            continue
    except Exception:
        # Auth service unavailable: fall through to synthetic identifiers.
        pass

    out: list[dict] = []
    for tid in tenant_ids:
        detail = tenant_details.get(tid, {})
        out.append({
            "tenant_id": tid,
            "name": detail.get("name") or f"Tenant {str(tid)[:8]}",
            "slug": detail.get("slug") or str(tid),
            "status": detail.get("status") or "active",
            "plan": detail.get("plan") or "pro",
            "contact_email": detail.get("contact_email"),
            "active_modules": sorted(mod_map.get(tid, [])),
            "created_at": detail.get("created_at") or _utcnow(),
            "module_versions": active_versions.get(tid, {}),
        })
    return out


@router.post("/tenants/onboard", response_model=TenantOnboardResponse, status_code=201)
async def onboard_tenant(
    req: TenantOnboardRequest,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Platform Super Admin Onboarding Wizard.

    Provisions a new tenant by calling the owning services over HTTP — never
    by reaching into their databases. Each service owns its own schema and
    its own default-role seeding; the platform service orchestrates and
    writes its own module-state rows in a single transaction, after all
    remote calls succeed.

    Steps:
      1. auth service /register   — creates tenant, owner user, and default roles
                                    in one transaction on the auth database
      2. organization service      — creates the first outlet (branch)
      3. platform service          — activates the selected modules locally

    Ordering matters: the auth call is idempotent-on-conflict (409 if the
    slug exists), so a retry of the whole wizard is safe. If step 2 fails
    after step 1 succeeded, the tenant exists with no outlet; the platform
    admin can re-run onboarding with the same slug (409) or create the
    outlet manually via the organization service.
    """
    import httpx

    from src.services.shared.registry import base_url, get_descriptor

    # ── Step 1: create tenant + owner via auth service ────────────────────
    auth_descriptor = get_descriptor("auth")
    if auth_descriptor is None:
        raise HTTPException(status_code=503, detail="Auth service is not registered in the platform")

    # The platform realm's own token is scoped to platform:* only (task #3
    # removed the wildcard), so the auth service — which enforces its own
    # permissions — needs a direct call that doesn't go through the tenant
    # Identity system. The /register endpoint is deliberately unauthenticated
    # (first-run signup), so we call it on the service's own port.
    auth_base = base_url(auth_descriptor)
    async with httpx.AsyncClient(timeout=30.0) as client:
        reg_resp = await client.post(
            f"{auth_base}/api/v1/auth/register",
            json={
                "tenant_name": req.name,
                "tenant_slug": req.slug,
                "email": req.owner_email,
                "password": req.owner_password,
                "full_name": req.owner_name,
            },
        )
        if reg_resp.status_code == 409:
            raise HTTPException(
                status_code=409,
                detail=f"Tenant slug '{req.slug}' is already taken",
            )
        if reg_resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=reg_resp.status_code,
                detail=f"Auth service rejected onboarding: {reg_resp.text[:500]}",
            )

        reg_body = reg_resp.json()
        owner_token = reg_body.get("access_token")

        # Resolve tenant_id + owner_user_id from the token's own claims rather
        # than a second round-trip to /me: a JWT is the token's claims — no
        # user lookup, no 404 risk if the auth DB row is slow to appear in
        # this very same request. The /me call was 404-ing because auth
        # decodes the token's user_id and then does db.get(User, user_id);
        # reading straight from the claims is simpler and equally authoritative
        # for this step (we just issued the token moments ago).
        import base64, json as _json

        def _jwt_claims(token: str) -> dict:
            try:
                payload_b64 = token.split(".")[1]
                payload_b64 += "=" * (-len(payload_b64) % 4)
                return _json.loads(base64.urlsafe_b64decode(payload_b64.encode()))
            except Exception:
                return {}

        claims = _jwt_claims(owner_token) if owner_token else {}
        raw_tenant = claims.get("tenant_id")
        raw_user = claims.get("sub")

        # Belt-and-braces: if the token somehow lacks either claim (older
        # token format, or a future change that drops them), fall back to the
        # /me lookup — and a 404 there is a real 502, not a silent wrong-value.
        if not raw_tenant or not raw_user:
            me_resp = await client.get(
                f"{auth_base}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            if me_resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Auth service did not return owner identity: {me_resp.text[:300]}",
                )
            me_body = me_resp.json()
            tenant_id = uuid.UUID(me_body.get("tenant_id"))
            owner_user_id = uuid.UUID(me_body.get("id"))
        else:
            tenant_id = uuid.UUID(raw_tenant)
            owner_user_id = uuid.UUID(raw_user)

    # ── Step 1b: grant owner + manager roles, and the seeded default roles ─
    # /register already creates the "owner" and "manager" default roles and
    # assigns the owner role to the new user. The platform admin chooses
    # whether the tenant starts with the manager role granted too — most
    # onboarding flows do want it, so default the call to include both.
    async with httpx.AsyncClient(timeout=30.0) as client:
        for slug in ("owner", "manager"):
            grant_resp = await client.post(
                f"{auth_base}/api/v1/auth/users/{owner_user_id}/roles",
                json={"role_slug": slug},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            # 409 (already granted) and 404 (role not seeded in this tenant)
            # are both acceptable mid-onboarding — log, don't fail.
            if grant_resp.status_code not in (200, 201, 409):
                logger.warning(
                    "Role grant '%s' for user %s returned %d: %s",
                    slug, owner_user_id, grant_resp.status_code, grant_resp.text[:200],
                )

    # ── Step 2: create the first outlet via organization service ─────────
    # The organization service requires a tenant-scoped Identity to create an
    # outlet. We call it using the owner's freshly-issued token (step 1),
    # so the outlet lands in the correct tenant without any cross-DB write.
    org_descriptor = get_descriptor("organization")
    if org_descriptor is None:
        raise HTTPException(status_code=503, detail="Organization service is not registered in the platform")

    outlet_id: uuid.UUID | None = None
    async with httpx.AsyncClient(timeout=30.0) as client:
        outlet_resp = await client.post(
            f"{base_url(org_descriptor)}/api/v1/organization/outlets",
            json={
                "name": req.initial_branch_name,
                "code": req.initial_branch_code,
            },
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        if outlet_resp.status_code in (200, 201):
            outlet_body = outlet_resp.json()
            outlet_id = uuid.UUID(outlet_body.get("id"))
        elif outlet_resp.status_code == 409:
            # An outlet with this code already exists in the tenant; that is
            # not a failure — it means a previous onboarding run created it.
            pass
        else:
            # The outlet is not required for the tenant to be usable (a tenant
            # can add outlets later), so a failure here is logged and
            # non-fatal. The tenant and owner are already fully provisioned.
            logger.warning(
                "Outlet creation failed for tenant %s: %s %s",
                tenant_id, outlet_resp.status_code, outlet_resp.text[:300],
            )

    # ── Step 3: activate the selected modules in the platform DB ─────────
    modules_to_activate = sorted(set([req.vertical] + req.enabled_modules))
    for mod in modules_to_activate:
        await PlatformService.activate_module(
            session,
            tenant_id,
            mod,
            admin.id,
            admin.email,
            config={"onboarded_vertical": req.vertical},
        )

    return {
        "tenant_id": tenant_id,
        "organization_id": tenant_id,  # same tenant is the org root
        "outlet_id": outlet_id or uuid.UUID(int=0),
        "slug": req.slug,
        "name": req.name,
        "vertical": req.vertical,
        "active_modules": modules_to_activate,
        "owner_email": req.owner_email,
        "created_at": _utcnow(),
    }
