import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission
from src.config import get_settings
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import EntityStatus, Permission, Role, RolePermission, User, UserBranch, UserRole, UserStatus
from src.schemas.erp import (
    PermissionResponse,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from src.utils.email import send_email
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.rbac_policy import (
    assert_role_name_allowed,
    can_manage_super_admin,
    get_super_admin_role,
    is_super_admin_role,
    user_has_super_admin_role,
    validate_role_assignment,
)

from src.utils.security import hash_password

router = APIRouter(prefix="/erp", tags=["Core ERP - Access Control"])

settings = get_settings()


def _parse_user_status(value: str) -> UserStatus:
    try:
        return UserStatus(value.lower())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}") from exc


def _parse_entity_status(value: str) -> EntityStatus:
    try:
        return EntityStatus(value.lower())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}") from exc


async def _role_to_response(db: AsyncSession, role: Role) -> RoleResponse:
    result = await db.execute(
        select(RolePermission)
        .options(selectinload(RolePermission.permission))
        .where(RolePermission.role_id == role.id)
    )
    permissions = [rp.permission for rp in result.scalars().all()]
    return RoleResponse(
        id=role.id,
        tenant_id=role.tenant_id,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        status=role.status.value,
        permissions=[PermissionResponse.model_validate(p) for p in permissions],
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


async def _user_to_response(db: AsyncSession, user: User) -> UserResponse:
    from src.schemas.erp import RoleSummary

    result = await db.execute(
        select(UserRole).options(selectinload(UserRole.role)).where(UserRole.user_id == user.id)
    )
    roles = [
        RoleSummary(id=ur.role.id, name=ur.role.name, is_default=ur.is_default)
        for ur in result.scalars().all()
    ]
    return UserResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        full_name=user.full_name,
        employee_id=user.employee_id,
        phone=user.phone,
        avatar_initials=user.avatar_initials,
        status=user.status.value,
        mfa_enabled=user.mfa_enabled,
        must_change_password=user.must_change_password,
        last_login_at=user.last_login_at,
        roles=roles,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:roles"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Permission).order_by(Permission.module, Permission.code))
    return result.scalars().all()


@router.get("/roles", response_model=PaginatedResponse[RoleResponse])
async def list_roles(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
):
    query = select(Role).where(Role.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(Role.name).offset((page - 1) * page_size).limit(page_size))
    roles = result.scalars().all()
    items = [await _role_to_response(db, role) for role in roles]
    return paginate(items, total or 0, page, page_size)


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:roles"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    assert_role_name_allowed(payload.name)

    role = Role(
        tenant_id=ctx.tenant_id,
        name=payload.name.strip(),
        description=payload.description,
        status=_parse_entity_status(payload.status),
    )
    db.add(role)
    await db.flush()

    if payload.permission_codes:
        perms = await db.execute(select(Permission).where(Permission.code.in_(payload.permission_codes)))
        for perm in perms.scalars().all():
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    return await _role_to_response(db, role)


@router.patch("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: uuid.UUID,
    payload: RoleUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:roles"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    role = await db.scalar(select(Role).where(Role.id == role_id, Role.tenant_id == ctx.tenant_id))
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        actor_is_super = await user_has_super_admin_role(db, ctx.user.id, ctx.tenant_id)
        if not can_manage_super_admin(
            is_tenant_owner=ctx.user.is_tenant_owner,
            has_super_admin_role=actor_is_super,
        ):
            raise HTTPException(status_code=403, detail="Only the tenant owner or Super Admin can modify system roles")
        if payload.name and payload.name.strip().lower() != role.name.strip().lower():
            raise HTTPException(status_code=400, detail="System role name cannot be changed")
        if payload.permission_codes is not None:
            raise HTTPException(status_code=400, detail="Super Admin permissions are managed by the platform")

    updates = payload.model_dump(exclude_unset=True, exclude={"permission_codes"})
    if "status" in updates:
        updates["status"] = _parse_entity_status(updates["status"])
    for key, value in updates.items():
        setattr(role, key, value)

    if payload.permission_codes is not None:
        existing = await db.execute(select(RolePermission).where(RolePermission.role_id == role.id))
        for rp in existing.scalars().all():
            await db.delete(rp)
        await db.flush()
        perms = await db.execute(select(Permission).where(Permission.code.in_(payload.permission_codes)))
        for perm in perms.scalars().all():
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))


    return await _role_to_response(db, role)


@router.get("/users", response_model=PaginatedResponse[UserResponse])
async def list_users(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str | None = None,
):
    query = select(User).where(User.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size))
    users = result.scalars().all()
    items = [await _user_to_response(db, user) for user in users]
    return paginate(items, total or 0, page, page_size)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.scalar(
        select(User).where(User.tenant_id == ctx.tenant_id, User.email == payload.email.lower())
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered for this tenant")

    if not payload.password and not payload.send_invite:
        raise HTTPException(status_code=400, detail="Password is required when not sending an invite")

    if payload.role_ids:
        await validate_role_assignment(
            db,
            tenant_id=ctx.tenant_id,
            actor_user_id=ctx.user.id,
            actor_is_tenant_owner=ctx.user.is_tenant_owner,
            role_ids=payload.role_ids,
        )
    else:
        raise HTTPException(status_code=400, detail="At least one role must be assigned")

    temp_password = payload.password or secrets.token_urlsafe(12)
    if payload.must_change_password is not None:
        must_change_password = payload.must_change_password
    elif payload.send_invite or payload.password:
        must_change_password = True
    else:
        must_change_password = True

    if not must_change_password and not ctx.user.is_tenant_owner:
        must_change_password = True
    user = User(
        tenant_id=ctx.tenant_id,
        email=payload.email.lower(),
        password_hash=hash_password(temp_password),
        full_name=payload.full_name,
        employee_id=payload.employee_id,
        phone=payload.phone,
        avatar_initials=payload.avatar_initials,
        status=_parse_user_status(payload.status),
        must_change_password=must_change_password,
    )
    db.add(user)
    await db.flush()

    for role_id in payload.role_ids:
        role = await db.scalar(select(Role).where(Role.id == role_id, Role.tenant_id == ctx.tenant_id))
        if role:
            db.add(
                UserRole(
                    user_id=user.id,
                    role_id=role.id,
                    is_default=payload.default_role_id == role_id,
                )
            )

    for idx, branch_id in enumerate(payload.branch_ids):
        db.add(UserBranch(user_id=user.id, branch_id=branch_id, is_primary=idx == 0))

    if payload.send_invite:
        try:
            await send_email(
                subject=f"Welcome to {settings.app_name}",
                recipients=[user.email],
                text=(
                    f"Hello {user.full_name},\n\n"
                    f"Your account has been created in {settings.app_name}.\n"
                    f"Use the following temporary password to log in and set your own password:\n\n"
                    f"Temporary password: {temp_password}\n\n"
                    f"Login URL: {settings.frontend_url}\n\n"
                    "For security, please change this password the first time you log in."
                ),
            )
        except Exception:
            pass

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        module="erp",
        action="created",
        entity_type="user",
        entity_id=user.id,
        new_values={"email": user.email, "full_name": user.full_name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return await _user_to_response(db, user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await db.scalar(select(User).where(User.id == user_id, User.tenant_id == ctx.tenant_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = payload.model_dump(exclude_unset=True, exclude={"role_ids", "branch_ids", "password"})
    if "status" in updates:
        updates["status"] = _parse_user_status(updates["status"])
    for key, value in updates.items():
        setattr(user, key, value)

    if payload.password:
        user.password_hash = hash_password(payload.password)
        user.must_change_password = False

    if payload.must_change_password is not None:
        user.must_change_password = payload.must_change_password

    if payload.role_ids is not None:
        await validate_role_assignment(
            db,
            tenant_id=ctx.tenant_id,
            actor_user_id=ctx.user.id,
            actor_is_tenant_owner=ctx.user.is_tenant_owner,
            role_ids=payload.role_ids,
        )

        super_role = await get_super_admin_role(db, ctx.tenant_id)
        if user.is_tenant_owner and super_role and super_role.id not in payload.role_ids:
            raise HTTPException(
                status_code=400,
                detail="The tenant owner must retain the Super Admin role",
            )

        existing_roles = await db.execute(select(UserRole).where(UserRole.user_id == user.id))
        for ur in existing_roles.scalars().all():
            await db.delete(ur)
        await db.flush()
        for role_id in payload.role_ids:
            db.add(
                UserRole(
                    user_id=user.id,
                    role_id=role_id,
                    is_default=payload.default_role_id == role_id,
                )
            )

    if payload.branch_ids is not None:
        existing_branches = await db.execute(select(UserBranch).where(UserBranch.user_id == user.id))
        for ub in existing_branches.scalars().all():
            await db.delete(ub)
        await db.flush()
        for idx, branch_id in enumerate(payload.branch_ids):
            db.add(UserBranch(user_id=user.id, branch_id=branch_id, is_primary=idx == 0))

    return await _user_to_response(db, user)

