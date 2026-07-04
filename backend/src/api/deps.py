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
        return permission in self.permissions

    def require_permission(self, permission: str) -> None:
        if not self.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
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
    if user.status.value != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active")

    # SaaS platform tenant status gating
    if user.tenant.status.value in ("suspended", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your workspace has been suspended or cancelled. Please contact the platform owner."
        )

    # Check if Platform Admin is impersonating a buyer tenant
    resolved_tenant_id = actual_tenant_uuid
    impersonate_header = request.headers.get("X-Impersonate-Tenant")
    if impersonate_header and user.tenant.slug == "system" and user.is_tenant_owner:
        try:
            resolved_tenant_id = uuid.UUID(impersonate_header)
        except ValueError:
            pass

    permissions: set[str] = set(payload.get("permissions", []))
    if not permissions:
        # If permissions are not in token, fall back to aggregate of all roles
        for user_role in user.user_roles:
            for role_perm in user_role.role.role_permissions:
                permissions.add(role_perm.permission.code)

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
