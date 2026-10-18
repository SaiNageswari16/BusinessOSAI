import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database.session import get_db
from src.models import Outlet, Role, RolePermission, Tenant, User, UserRole
from src.utils.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUserContext:
    """Resolved identity for a request: user, tenant, permissions, active outlet."""

    def __init__(
        self,
        user: User,
        tenant_id: uuid.UUID,
        permissions: set[str],
        active_role_id: uuid.UUID | None = None,
        is_tenant_owner: bool = False,
        tenant_slug: str = "",
        active_outlet_id: uuid.UUID | None = None,
        allowed_outlet_ids: set[uuid.UUID] | None = None,
    ):
        self.user = user
        self.tenant_id = tenant_id
        self.permissions = permissions
        self.active_role_id = active_role_id
        self.is_tenant_owner = is_tenant_owner
        self.tenant_slug = tenant_slug
        self.active_outlet_id = active_outlet_id
        self.allowed_outlet_ids = allowed_outlet_ids or set()

    @property
    def user_id(self) -> uuid.UUID:
        return self.user.id

    def has_permission(self, permission: str) -> bool:
        # Tenant owner and platform admin are unrestricted
        if getattr(self.user, "is_platform_admin", False) or self.is_tenant_owner:
            return True

        # Unrestricted wildcards
        if any(p in self.permissions for p in ("all", "*:*", "super_admin", "manage:all", "*")):
            return True

        # Exact match
        if permission in self.permissions:
            return True

        # manage:X grants view:X
        if permission.startswith("view:"):
            resource = permission[len("view:"):]
            if f"manage:{resource}" in self.permissions or f"*:{resource}" in self.permissions:
                return True

        return False

    def require_permission(self, permission: str) -> None:
        if not self.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required permission: {permission}",
            )

    def require_outlet_access(self, outlet_id: uuid.UUID | str | None) -> None:
        """Block access to an outlet the user isn't assigned to.

        An empty allowed_outlet_ids means 'all outlets in the tenant'.
        """
        if outlet_id is None or self.is_tenant_owner:
            return
        if not self.allowed_outlet_ids:
            return
        try:
            parsed = outlet_id if isinstance(outlet_id, uuid.UUID) else uuid.UUID(str(outlet_id))
        except (ValueError, TypeError):
            raise HTTPException(status_code=404, detail="Outlet not found")
        if parsed not in self.allowed_outlet_ids:
            # 404 rather than 403 — don't confirm the outlet exists
            raise HTTPException(status_code=404, detail="Outlet not found")


def _collect_permissions(user: User, active_role_id: uuid.UUID | None) -> set[str]:
    permissions: set[str] = set()
    for user_role in user.user_roles or []:
        if active_role_id and user_role.role_id != active_role_id:
            continue
        role = user_role.role
        if not role or not role.role_permissions:
            continue
        for rp in role.role_permissions:
            if rp.permission and rp.permission.code:
                permissions.add(rp.permission.code)
    return permissions


def _is_admin(user: User, active_role_id: uuid.UUID | None) -> bool:
    if getattr(user, "is_platform_admin", False) or user.is_tenant_owner:
        return True
    keywords = ("super admin", "platform super admin", "administrator", "owner", "admin")
    for user_role in user.user_roles or []:
        if active_role_id and user_role.role_id != active_role_id:
            continue
        if user_role.role and any(k in (user_role.role.name or "").lower() for k in keywords):
            return True
    return False


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

    try:
        tenant_uuid = uuid.UUID(tenant_id)
        user_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    active_role_id = None
    if payload.get("active_role_id"):
        try:
            active_role_id = uuid.UUID(payload["active_role_id"])
        except (ValueError, TypeError):
            active_role_id = None

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.tenant),
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission),
        )
        .where(User.id == user_uuid, User.tenant_id == tenant_uuid)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user_status = user.status.value if hasattr(user.status, "value") else str(user.status or "").lower()
    if user_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active")

    if user.tenant:
        t_status = (
            user.tenant.status.value
            if hasattr(user.tenant.status, "value")
            else str(getattr(user.tenant, "status", "") or "").lower()
        )
        if t_status in ("suspended", "cancelled"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your workspace has been suspended or cancelled.",
            )

    permissions = _collect_permissions(user, active_role_id)
    is_admin = _is_admin(user, active_role_id)
    if is_admin:
        permissions.update({"all", "*:*", "super_admin", "manage:all"})

    # Outlet access: empty list on the user = all outlets in the tenant
    raw_outlet_ids = user.outlet_ids or []
    allowed = set()
    for oid in raw_outlet_ids:
        try:
            allowed.add(uuid.UUID(str(oid)))
        except (ValueError, TypeError):
            continue

    # Optional active-outlet override via header (used by the outlet switcher)
    active_outlet_id = None
    header_outlet = request.headers.get("X-Outlet-Id")
    if header_outlet:
        try:
            candidate = uuid.UUID(header_outlet)
            if not allowed or candidate in allowed:
                active_outlet_id = candidate
        except (ValueError, TypeError):
            active_outlet_id = None

    return CurrentUserContext(
        user=user,
        tenant_id=tenant_uuid,
        permissions=permissions,
        active_role_id=active_role_id,
        is_tenant_owner=bool(user.is_tenant_owner),
        tenant_slug=(user.tenant.slug if user.tenant else ""),
        active_outlet_id=active_outlet_id,
        allowed_outlet_ids=allowed,
    )


def require_permission(permission: str):
    async def _dependency(
        ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    ) -> CurrentUserContext:
        if getattr(ctx.user, "is_platform_admin", False) or ctx.is_tenant_owner:
            return ctx
        ctx.require_permission(permission)
        return ctx

    return _dependency


def require_any_permission(*permissions: str):
    async def _dependency(
        ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    ) -> CurrentUserContext:
        if getattr(ctx.user, "is_platform_admin", False) or ctx.is_tenant_owner:
            return ctx
        if not any(ctx.has_permission(p) for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required one of: {', '.join(permissions)}",
            )
        return ctx

    return _dependency


def resolve_outlet_id(
    ctx: CurrentUserContext,
    outlet_id: uuid.UUID | str | None,
    required: bool = True,
) -> uuid.UUID | None:
    """Resolve the outlet for a request, honouring the X-Outlet-Id override.

    Raises 404 (not 403) when the user has no access to the requested outlet.
    """
    candidate = ctx.active_outlet_id or outlet_id
    if candidate is None:
        if required:
            raise HTTPException(status_code=400, detail="outlet_id is required")
        return None
    ctx.require_outlet_access(candidate)
    try:
        return candidate if isinstance(candidate, uuid.UUID) else uuid.UUID(str(candidate))
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Outlet not found")


def get_db_dep() -> AsyncSession:
    return Depends(get_db)
