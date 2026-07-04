import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Role, UserRole

SUPER_ADMIN_ROLE_NAME = "Super Admin"
RESERVED_ROLE_NAMES = {SUPER_ADMIN_ROLE_NAME.lower()}


def is_super_admin_role(role: Role) -> bool:
    return role.is_system and role.name.strip().lower() == SUPER_ADMIN_ROLE_NAME.lower()


def can_manage_super_admin(*, is_tenant_owner: bool, has_super_admin_role: bool) -> bool:
    return is_tenant_owner or has_super_admin_role


async def get_super_admin_role(db: AsyncSession, tenant_id: uuid.UUID) -> Role | None:
    result = await db.execute(
        select(Role).where(
            Role.tenant_id == tenant_id,
            Role.is_system.is_(True),
            func.lower(Role.name) == SUPER_ADMIN_ROLE_NAME.lower(),
        )
    )
    return result.scalar_one_or_none()


async def user_has_super_admin_role(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> bool:
    super_role = await get_super_admin_role(db, tenant_id)
    if super_role is None:
        return False
    assigned = await db.scalar(
        select(UserRole.id).where(UserRole.user_id == user_id, UserRole.role_id == super_role.id)
    )
    return assigned is not None


async def validate_role_assignment(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    actor_is_tenant_owner: bool,
    role_ids: list[uuid.UUID],
) -> None:
    """
    Ensures only the tenant owner (or an existing Super Admin) can assign
    the Super Admin role. Regular users / admins cannot self-escalate to Super Admin.
    """
    if not role_ids:
        raise HTTPException(status_code=400, detail="At least one role must be assigned")

    super_role = await get_super_admin_role(db, tenant_id)
    if super_role is None or super_role.id not in role_ids:
        # Not assigning super admin — no special check needed
        return

    # Super Admin is being assigned — only tenant owner or existing super admins may do this
    actor_is_super = await user_has_super_admin_role(db, actor_user_id, tenant_id)
    if not (actor_is_tenant_owner or actor_is_super):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the tenant owner or an existing Super Admin can assign the Super Admin role",
        )



def assert_role_name_allowed(name: str) -> None:
    if name.strip().lower() in RESERVED_ROLE_NAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super Admin is a reserved system role and cannot be created manually",
        )
