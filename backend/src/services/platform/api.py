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
    TenantModuleState,
    _utcnow,
)
from src.services.platform.schemas import (
    AccessPolicyCreateRequest,
    AccessPolicyResponse,
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
    plugins = await PlatformService.list_plugins(session)
    return [
        {
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
        for p in plugins
    ]


@router.post("/plugins/{plugin_id}/toggle-kill-switch", response_model=PluginManifestResponse)
async def toggle_plugin_kill_switch(
    plugin_id: str,
    is_active: bool,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
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
        # The auth /register endpoint returns a TokenPair (tokens only). The
        # tenant_id and user_id are not in the response — the platform DB
        # must learn them from a follow-up. Since we don't have a way to
        # call "GET /tenants/current" without the owner's token, we use the
        # platform admin's own context: the owner's user token is in reg_body.
        owner_token = reg_body.get("access_token")
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
        # UserResponse.tenant_id is authoritative here. It is not in the JWT
        # claims that the auth service builds — /me returns the ORM object,
        # which carries the real column value.
        tenant_id = uuid.UUID(me_body.get("tenant_id"))
        owner_user_id = uuid.UUID(me_body.get("id"))

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
