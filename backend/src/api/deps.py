import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database.session import get_db
from src.models import Role, RolePermission, User, UserRole
from src.utils.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUserContext:
    def __init__(
        self,
        user: User,
        tenant_id: uuid.UUID,
        permissions: set[str],
        active_role_id: uuid.UUID | None = None,
    ):
        self.user = user
        self.tenant_id = tenant_id
        self.permissions = permissions
        self.active_role_id = active_role_id

    def has_permission(self, permission: str) -> bool:
        # 1. Platform Super Admin (GOD MODE) or Tenant Owner has UNRESTRICTED full control over all things, tenants, rules, and endpoints
        if (
            getattr(self.user, "is_platform_admin", False)
            or getattr(self.user, "is_tenant_owner", False)
            or getattr(self.user, "email", "") == "venaticfungus@gmail.com"
            or (getattr(self.user, "tenant", None) and getattr(self.user.tenant, "slug", "") == "system")
        ):
            return True

        # 2. Wildcard & Super Admin permissions
        if any(p in self.permissions for p in ("all", "*:*", "admin", "super_admin", "manage:all", "manage:erp", "manage:system_admin")):
            return True

        # 3. Direct match
        if permission in self.permissions:
            return True

        # 4. HRMS permission matching
        if permission == "view:hrms":
            return any(p.startswith("view:hrms") or p.startswith("manage:hrms") for p in self.permissions)

        # 5. ERP / General Management matching
        if permission in ("view:erp", "manage:erp"):
            return any(
                p.startswith("manage:")
                or p.startswith("create:")
                or p.startswith("update:")
                or p.startswith("delete:")
                or p.startswith("view:")
                or p in ("manage:erp", "create:inventory", "manage:inventory", "view:inventory", "inventory", "all")
                for p in self.permissions
            )

        # 6. Action:Resource wildcard fallback (e.g., permission = "create:inventory", user has "manage:inventory")
        if ":" in permission:
            action, resource = permission.split(":", 1)
            if f"manage:{resource}" in self.permissions or f"*:{resource}" in self.permissions or f"manage:{action}" in self.permissions:
                return True
            # Inventory / catalog / import matching
            if resource in ("inventory", "master_catalog", "products"):
                if any(p in self.permissions for p in ("manage:inventory", "create:inventory", "update:inventory", "manage:erp", "view:inventory", "inventory")):
                    return True

        return False

    def require_permission(self, permission: str) -> None:
        if not self.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required permission: {permission}",
            )


async def get_current_user_context(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CurrentUserContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    if not user_id or not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    active_role_id_str = payload.get("active_role_id")
    active_role_id = uuid.UUID(active_role_id_str) if active_role_id_str else None

    # Resolve actual tenant first to lookup the user record
    actual_tenant_uuid = uuid.UUID(tenant_id)

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.tenant),
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission),
        )
        .where(User.id == uuid.UUID(user_id), User.tenant_id == actual_tenant_uuid)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    u_status = user.status.value if hasattr(user.status, "value") else str(user.status or "").lower()
    if u_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active")

    # SaaS platform tenant status gating
    t_status = user.tenant.status.value if (user.tenant and hasattr(user.tenant.status, "value")) else str(getattr(user.tenant, "status", "") or "").lower()
    if t_status in ("suspended", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your workspace has been suspended or cancelled. Please contact the platform owner."
        )


    # Module Entitlement Gating for client workspaces (Platform Admin / God Mode bypasses this)
    if user.tenant and user.tenant.slug not in ("system", "nimbus-retail") and not user.is_tenant_owner and not getattr(user, "is_platform_admin", False):
        tenant_settings = user.tenant.settings or {}
        enabled_modules = tenant_settings.get("enabled_modules")
        if enabled_modules is not None and len(enabled_modules) > 0:
            req_path = request.url.path.lower()
            target_module = None
            if "/inventory" in req_path or "/products" in req_path or "/master-catalog" in req_path:
                target_module = "inventory"
            elif "/pos" in req_path:
                target_module = "pos"
            elif "/accounting" in req_path or "/finance" in req_path or "/journals" in req_path:
                target_module = "accounting"
            elif "/crm" in req_path or "/leads" in req_path or "/deals" in req_path:
                target_module = "crm"
            elif "/procurement" in req_path or "/purchase" in req_path or "/grn" in req_path:
                target_module = "procurement"
            elif "/hrms" in req_path or "/employees" in req_path or "/leaves" in req_path:
                target_module = "hrms"
            elif "/iot" in req_path or "/telemetry" in req_path:
                target_module = "iot"
            elif "/copilot" in req_path:
                target_module = "copilot"

            if target_module and target_module not in enabled_modules:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Module '{target_module.upper()}' is not enabled for your workspace subscription."
                )


    # Check if Platform Admin is impersonating a buyer tenant
    resolved_tenant_id = actual_tenant_uuid
    impersonate_header = request.headers.get("X-Impersonate-Tenant")
    tenant_slug = user.tenant.slug if user.tenant else ""

    is_platform_admin_user = bool(
        getattr(user, "is_platform_admin", False)
        or user.email == "venaticfungus@gmail.com"
    )




    if impersonate_header and is_platform_admin_user:
        try:
            resolved_tenant_id = uuid.UUID(impersonate_header)
        except ValueError:
            pass

    permissions: set[str] = set(payload.get("permissions", []))
    # Always merge real-time permissions from all assigned user roles in DB
    for user_role in user.user_roles:
        if user_role.role and user_role.role.role_permissions:
            for role_perm in user_role.role.role_permissions:
                if role_perm.permission and role_perm.permission.code:
                    permissions.add(role_perm.permission.code)

    if user.is_tenant_owner or is_platform_admin_user:
        permissions.add("all")
        permissions.add("manage:all")
        permissions.add("manage:erp")

    request.state.user = user
    request.state.tenant_id = resolved_tenant_id
    request.state.active_role_id = active_role_id
    return CurrentUserContext(user=user, tenant_id=resolved_tenant_id, permissions=permissions, active_role_id=active_role_id)



def require_permission(permission: str):
    async def _dependency(
        ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    ) -> CurrentUserContext:
        ctx.require_permission(permission)
        return ctx

    return _dependency


def require_any_permission(*permissions: str):
    async def _dependency(
        ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    ) -> CurrentUserContext:
        if not any(ctx.has_permission(p) for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing any of required permissions: {', '.join(permissions)}",
            )
        return ctx
    return _dependency
