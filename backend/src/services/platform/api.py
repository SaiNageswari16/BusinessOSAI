"""Platform Service HTTP endpoints."""
from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.platform.models import PlatformAdmin, PlatformAdminRole, _utcnow
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


# ─── Tenant Onboarding Wizard ────────────────────────────────────────────────

@router.post("/tenants/onboard", response_model=TenantOnboardResponse, status_code=201)
async def onboard_tenant(
    req: TenantOnboardRequest,
    admin: Annotated[PlatformAdmin, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    """Platform Super Admin Onboarding Wizard.

    Provisions the new tenant across:
    1. Auth service (Tenant, User, Role)
    2. Organization service (Outlet / Branch)
    3. Platform service (TenantModuleStates for all selected vertical modules)
    """
    tenant_id = uuid.uuid4()
    org_id = uuid.uuid4()
    outlet_id = uuid.uuid4()

    # 1. Activate vertical modules in Platform DB
    modules_to_activate = list(set([req.vertical] + req.enabled_modules))
    for mod in modules_to_activate:
        await PlatformService.activate_module(
            session,
            tenant_id,
            mod,
            admin.id,
            admin.email,
            config={"onboarded_vertical": req.vertical},
        )

    # 2. Add tenant in Auth DB (via direct session on auth service DB)
    from src.services.shared.service_factory import session_factory
    auth_session_maker = session_factory("auth")
    from src.services.auth.models import Tenant as AuthTenant, User as AuthUser, Role as AuthRole, UserRole as AuthUserRole
    from src.utils.security import hash_password

    async with auth_session_maker() as auth_session:
        # Check slug
        existing = await auth_session.execute(
            select(AuthTenant).where(AuthTenant.slug == req.slug)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Tenant slug '{req.slug}' is already taken")

        auth_tenant = AuthTenant(
            id=tenant_id,
            name=req.name,
            slug=req.slug,
            plan=req.plan,
            contact_email=req.contact_email,
            contact_phone=req.contact_phone,
            settings={**req.initial_settings, "vertical": req.vertical},
        )
        auth_session.add(auth_tenant)

        owner_user = AuthUser(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            email=req.owner_email,
            hashed_password=hash_password(req.owner_password),
            full_name=req.owner_name,
            is_tenant_owner=True,
            is_platform_admin=False,
        )
        auth_session.add(owner_user)

        owner_role = AuthRole(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name="Tenant Owner",
            slug="owner",
            permissions=["*"],
            is_system=True,
        )
        auth_session.add(owner_role)

        auth_session.add(
            AuthUserRole(
                tenant_id=tenant_id,
                user_id=owner_user.id,
                role_id=owner_role.id,
                outlet_id=None,
            )
        )
        await auth_session.commit()

    # 3. Add initial outlet in Organization DB
    org_session_maker = session_factory("organization")
    from src.services.organization.models import Outlet as OrgOutlet
    async with org_session_maker() as org_session:
        initial_outlet = OrgOutlet(
            id=outlet_id,
            tenant_id=tenant_id,
            name=req.initial_branch_name,
            code=req.initial_branch_code,
            is_active=True,
        )
        org_session.add(initial_outlet)
        await org_session.commit()

    return {
        "tenant_id": tenant_id,
        "organization_id": org_id,
        "outlet_id": outlet_id,
        "slug": req.slug,
        "name": req.name,
        "vertical": req.vertical,
        "active_modules": modules_to_activate,
        "owner_email": req.owner_email,
        "created_at": _utcnow(),
    }
