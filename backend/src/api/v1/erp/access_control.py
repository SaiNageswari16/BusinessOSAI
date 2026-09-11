import logging
import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_permission, require_any_permission
from src.config import get_settings
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import Company, EntityStatus, Permission, Role, RolePermission, User, UserBranch, UserRole, UserStatus
from src.schemas.erp import (
    MessageResponse,
    PermissionResponse,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    UserCreate,
    UserResponse,
    UserUpdate,
    WorkspaceResponse,
    WorkspaceCreate,
    WorkspaceUpdate,
    ApiKeyCreate,
    ApiKeyResponse,
    MfaPolicyCreate,
    MfaPolicyResponse,
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

logger = logging.getLogger(__name__)
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
    from src.models import Tenant
    result = await db.execute(
        select(RolePermission)
        .options(selectinload(RolePermission.permission))
        .where(RolePermission.role_id == role.id)
    )
    permissions = [rp.permission for rp in result.scalars().all()]

    tenant = await db.get(Tenant, role.tenant_id)
    t_settings = tenant.settings or {} if tenant else {}
    role_mods = t_settings.get("role_modules", {}).get(str(role.id))
    role_tabs = t_settings.get("role_tabs", {}).get(str(role.id))

    return RoleResponse(
        id=role.id,
        tenant_id=role.tenant_id,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        status=role.status.value,
        permissions=[PermissionResponse.model_validate(p) for p in permissions],
        enabled_modules=role_mods,
        enabled_tabs=role_tabs,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


async def _user_to_response(db: AsyncSession, user: User) -> UserResponse:
    from src.schemas.erp import RoleSummary
    from src.models import Company, Tenant

    result = await db.execute(
        select(UserRole).options(selectinload(UserRole.role)).where(UserRole.user_id == user.id)
    )
    user_roles = result.scalars().all()
    user_company_id = None
    for ur in user_roles:
        if ur.company_id:
            user_company_id = ur.company_id
            break

    company_name = None
    if user_company_id:
        c_obj = await db.get(Company, user_company_id)
        if c_obj:
            company_name = c_obj.name

    roles = [
        RoleSummary(
            id=ur.role.id,
            name=ur.role.name,
            is_default=ur.is_default,
            company_id=ur.company_id,
            company_name=company_name if ur.company_id == user_company_id else None
        )
        for ur in user_roles
    ]

    tenant = await db.get(Tenant, user.tenant_id)
    t_settings = tenant.settings or {} if tenant else {}
    user_mods = t_settings.get("user_modules", {}).get(str(user.id))
    user_tabs = t_settings.get("user_tabs", {}).get(str(user.id))

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
        is_tenant_owner=user.is_tenant_owner,
        last_login_at=user.last_login_at,
        company_id=user_company_id,
        company_name=company_name,
        roles=roles,
        enabled_modules=user_mods,
        enabled_tabs=user_tabs,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )



@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:roles", "manage:roles", "view:permission_matrix", "view:access_control", "view:erp", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Permission).order_by(Permission.module, Permission.code))
    return result.scalars().all()


@router.get("/roles", response_model=PaginatedResponse[RoleResponse])
async def list_roles(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:roles", "manage:roles", "view:permission_matrix", "view:access_control", "view:erp", "manage:erp"))],
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

    if payload.enabled_modules is not None or payload.enabled_tabs is not None:
        from sqlalchemy.orm.attributes import flag_modified
        from src.models import Tenant
        tenant = await db.get(Tenant, ctx.tenant_id)
        if tenant:
            t_settings = dict(tenant.settings or {})
            if payload.enabled_modules is not None:
                r_mods = dict(t_settings.get("role_modules") or {})
                r_mods[str(role.id)] = payload.enabled_modules
                t_settings["role_modules"] = r_mods
            if payload.enabled_tabs is not None:
                r_tabs = dict(t_settings.get("role_tabs") or {})
                r_tabs[str(role.id)] = payload.enabled_tabs
                t_settings["role_tabs"] = r_tabs
            tenant.settings = t_settings
            flag_modified(tenant, "settings")

    await db.commit()
    await db.refresh(role)
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

    updates = payload.model_dump(exclude_unset=True, exclude={"permission_codes", "enabled_modules", "enabled_tabs"})
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

    if payload.enabled_modules is not None or payload.enabled_tabs is not None:
        from sqlalchemy.orm.attributes import flag_modified
        from src.models import Tenant
        tenant = await db.get(Tenant, ctx.tenant_id)
        if tenant:
            t_settings = dict(tenant.settings or {})
            if payload.enabled_modules is not None:
                r_mods = dict(t_settings.get("role_modules") or {})
                r_mods[str(role.id)] = payload.enabled_modules
                t_settings["role_modules"] = r_mods
            if payload.enabled_tabs is not None:
                r_tabs = dict(t_settings.get("role_tabs") or {})
                r_tabs[str(role.id)] = payload.enabled_tabs
                t_settings["role_tabs"] = r_tabs
            tenant.settings = t_settings
            flag_modified(tenant, "settings")

    await db.commit()
    await db.refresh(role)
    return await _role_to_response(db, role)



@router.get("/users", response_model=PaginatedResponse[UserResponse])
async def list_users(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:users", "manage:users", "view:access_control", "view:erp", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str | None = None,
    company_id: uuid.UUID | None = Query(None, description="Filter by company / workspace"),
    all_workspaces: bool = Query(False, description="Whether to include users from all workspaces"),
):
    query = select(User).where(User.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))

    target_cid = company_id or (None if all_workspaces else ctx.active_company_id)
    if target_cid:
        # Include users assigned to target_cid or tenant owners
        subq = select(UserRole.user_id).where(UserRole.company_id == target_cid)
        query = query.where((User.id.in_(subq)) | (User.is_tenant_owner == True))

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

    actor_can_grant_admin = ctx.user.is_tenant_owner or (ctx.user.tenant and ctx.user.tenant.slug == "system")
    is_owner_flag = payload.is_tenant_owner if actor_can_grant_admin else False

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
        is_tenant_owner=is_owner_flag,
    )
    db.add(user)
    await db.flush()

    assigned_cid = payload.company_id or ctx.active_company_id
    final_company_id = None
    if assigned_cid:
        try:
            cid_uuid = uuid.UUID(str(assigned_cid))
            valid_company = await db.scalar(
                select(Company).where(Company.id == cid_uuid, Company.tenant_id == ctx.tenant_id)
            )
            if valid_company:
                final_company_id = valid_company.id
        except (ValueError, TypeError):
            final_company_id = None

    for role_id in payload.role_ids:
        role = await db.scalar(select(Role).where(Role.id == role_id, Role.tenant_id == ctx.tenant_id))
        if role:
            db.add(
                UserRole(
                    user_id=user.id,
                    role_id=role.id,
                    company_id=final_company_id,
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

    if payload.enabled_modules is not None or payload.enabled_tabs is not None:
        from sqlalchemy.orm.attributes import flag_modified
        from src.models import Tenant
        tenant = await db.get(Tenant, ctx.tenant_id)
        if tenant:
            t_settings = dict(tenant.settings or {})
            if payload.enabled_modules is not None:
                u_mods = dict(t_settings.get("user_modules") or {})
                u_mods[str(user.id)] = payload.enabled_modules
                t_settings["user_modules"] = u_mods
            if payload.enabled_tabs is not None:
                u_tabs = dict(t_settings.get("user_tabs") or {})
                u_tabs[str(user.id)] = payload.enabled_tabs
                t_settings["user_tabs"] = u_tabs
            tenant.settings = t_settings
            flag_modified(tenant, "settings")

    await write_audit_log(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user.id,
        company_id=assigned_cid,
        module="erp",
        action="created",
        entity_type="user",
        entity_id=user.id,
        new_values={"email": user.email, "full_name": user.full_name, "company_id": str(assigned_cid) if assigned_cid else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(user)
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

    actor_can_grant_admin = ctx.user.is_tenant_owner or (ctx.user.tenant and ctx.user.tenant.slug == "system") or getattr(ctx.user, "is_platform_admin", False)

    updates = payload.model_dump(exclude_unset=True, exclude={"role_ids", "branch_ids", "password", "company_id", "enabled_modules", "enabled_tabs"})
    if "is_tenant_owner" in updates:
        if not actor_can_grant_admin:
            updates.pop("is_tenant_owner", None)
        else:
            user.is_tenant_owner = updates["is_tenant_owner"]

    if "status" in updates:
        updates["status"] = _parse_user_status(updates["status"])
    for key, value in updates.items():
        setattr(user, key, value)

    if payload.password:
        user.password_hash = hash_password(payload.password)
        user.must_change_password = False

    if payload.must_change_password is not None:
        user.must_change_password = payload.must_change_password

    assigned_cid = payload.company_id if payload.company_id is not None else ctx.active_company_id
    final_company_id = None
    if assigned_cid:
        try:
            cid_uuid = uuid.UUID(str(assigned_cid))
            valid_company = await db.scalar(
                select(Company).where(Company.id == cid_uuid, Company.tenant_id == ctx.tenant_id)
            )
            if valid_company:
                final_company_id = valid_company.id
        except (ValueError, TypeError):
            final_company_id = None

    if payload.role_ids is not None:
        await validate_role_assignment(
            db,
            tenant_id=ctx.tenant_id,
            actor_user_id=ctx.user.id,
            actor_is_tenant_owner=ctx.user.is_tenant_owner,
            role_ids=payload.role_ids,
        )

        super_role = await get_super_admin_role(db, ctx.tenant_id)
        is_still_owner = updates.get("is_tenant_owner", user.is_tenant_owner)
        if is_still_owner and super_role and super_role.id not in payload.role_ids:
            if not (getattr(ctx.user, "is_platform_admin", False) or (ctx.user.tenant and ctx.user.tenant.slug == "system")):
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
                    company_id=final_company_id,
                    is_default=payload.default_role_id == role_id,
                )
            )
    elif payload.company_id is not None:
        existing_roles = (await db.execute(select(UserRole).where(UserRole.user_id == user.id))).scalars().all()
        for ur in existing_roles:
            ur.company_id = final_company_id

    if payload.branch_ids is not None:
        existing_branches = await db.execute(select(UserBranch).where(UserBranch.user_id == user.id))
        for ub in existing_branches.scalars().all():
            await db.delete(ub)
        await db.flush()
        for idx, branch_id in enumerate(payload.branch_ids):
            db.add(UserBranch(user_id=user.id, branch_id=branch_id, is_primary=idx == 0))

    if payload.enabled_modules is not None or payload.enabled_tabs is not None:
        from sqlalchemy.orm.attributes import flag_modified
        from src.models import Tenant
        tenant = await db.get(Tenant, ctx.tenant_id)
        if tenant:
            t_settings = dict(tenant.settings or {})
            if payload.enabled_modules is not None:
                u_mods = dict(t_settings.get("user_modules") or {})
                u_mods[str(user.id)] = payload.enabled_modules
                t_settings["user_modules"] = u_mods
            if payload.enabled_tabs is not None:
                u_tabs = dict(t_settings.get("user_tabs") or {})
                u_tabs[str(user.id)] = payload.enabled_tabs
                t_settings["user_tabs"] = u_tabs
            tenant.settings = t_settings
            flag_modified(tenant, "settings")

    await db.commit()
    await db.refresh(user)
    return await _user_to_response(db, user)


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_erp_user(
    user_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Tenant Workspace Admin: Permanently delete a user from the workspace.
    """
    if ctx.user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own user account")

    user = await db.scalar(
        select(User).where(User.id == user_id, User.tenant_id == ctx.tenant_id)
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found in this workspace")

    if user.is_tenant_owner and not (ctx.user.is_tenant_owner or ctx.user.is_platform_admin):
        raise HTTPException(status_code=403, detail="Only workspace owners or platform admins can delete workspace owner accounts")

    from src.database.purge import purge_user_complete
    res = await purge_user_complete(
        db,
        user_id=user_id,
        actor_user_id=ctx.user.id,
        purge_entire_tenant_if_owner=False
    )
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("message", "User not found"))

    return MessageResponse(message=res["message"])


# ─── ERP Workspaces Endpoints ─────────────────────────────────────

@router.get("/workspaces", response_model=list[WorkspaceResponse])
async def list_workspaces(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:workspaces", "manage:workspaces", "view:settings", "manage:settings", "view:erp", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Workspace
    result = await db.execute(select(Workspace).where(Workspace.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:workspaces", "manage:settings", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Workspace
    workspace = Workspace(
        tenant_id=ctx.tenant_id,
        company_id=payload.company_id,
        branch_id=payload.branch_id,
        name=payload.name,
        theme=payload.theme,
        language=payload.language,
        timezone=payload.timezone,
        status=EntityStatus(payload.status),
    )
    db.add(workspace)
    await db.flush()
    return workspace


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: uuid.UUID,
    payload: WorkspaceUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:workspaces", "manage:settings", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Workspace
    workspace = await db.scalar(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.tenant_id == ctx.tenant_id)
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "status" and val is not None:
            setattr(workspace, field, EntityStatus(val))
        elif val is not None:
            setattr(workspace, field, val)

    await db.flush()
    return workspace


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:workspaces", "manage:settings", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Workspace
    workspace = await db.scalar(
        select(Workspace).where(Workspace.id == workspace_id, Workspace.tenant_id == ctx.tenant_id)
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    await db.delete(workspace)
    await db.flush()


# ─── API Keys Endpoints ───────────────────────────────────────────

@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:api_keys", "manage:api_keys", "view:settings", "manage:settings", "view:erp", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import ApiKey
    result = await db.execute(select(ApiKey).where(ApiKey.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/api-keys", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def generate_api_key(
    payload: ApiKeyCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:api_keys", "manage:settings", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    import secrets
    from src.models import ApiKey
    
    # Generate mock secure key representation
    secret_key = f"sk_{payload.env.lower()}_{secrets.token_hex(20)}"
    api_key = ApiKey(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        service=payload.service,
        env=payload.env,
        secret_key=secret_key,
        status=EntityStatus(payload.status),
    )
    db.add(api_key)
    await db.flush()
    return api_key


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:api_keys", "manage:settings", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import ApiKey
    api_key = await db.scalar(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.tenant_id == ctx.tenant_id)
    )
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(api_key)
    await db.flush()


# ─── MFA Policies Endpoints ───────────────────────────────────────

@router.get("/mfa-policies", response_model=list[MfaPolicyResponse])
async def list_mfa_policies(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:mfa_policies", "manage:mfa_policies", "view:settings", "manage:settings", "view:erp", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import MfaPolicy
    result = await db.execute(select(MfaPolicy).where(MfaPolicy.tenant_id == ctx.tenant_id))
    return result.scalars().all()


@router.post("/mfa-policies", response_model=MfaPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_mfa_policy(
    payload: MfaPolicyCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:mfa_policies", "manage:settings", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import MfaPolicy
    policy = MfaPolicy(
        tenant_id=ctx.tenant_id,
        role_id=payload.role_id,
        methods=payload.methods,
        timeout=payload.timeout,
        restrict_ip=payload.restrict_ip,
        status=EntityStatus(payload.status),
    )
    db.add(policy)
    await db.flush()
    return policy


@router.patch("/mfa-policies/{policy_id}", response_model=MfaPolicyResponse)
async def update_mfa_policy(
    policy_id: uuid.UUID,
    payload: MfaPolicyCreate,  # Reuse create payload for simple patch updates
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:mfa_policies", "manage:settings", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import MfaPolicy
    policy = await db.scalar(
        select(MfaPolicy).where(MfaPolicy.id == policy_id, MfaPolicy.tenant_id == ctx.tenant_id)
    )
    if not policy:
        raise HTTPException(status_code=404, detail="MFA Policy not found")

    policy.role_id = payload.role_id
    policy.methods = payload.methods
    policy.timeout = payload.timeout
    policy.restrict_ip = payload.restrict_ip
    policy.status = EntityStatus(payload.status)

    await db.flush()
    return policy


@router.delete("/mfa-policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mfa_policy(
    policy_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("manage:mfa_policies", "manage:settings", "manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import MfaPolicy
    policy = await db.scalar(
        select(MfaPolicy).where(MfaPolicy.id == policy_id, MfaPolicy.tenant_id == ctx.tenant_id)
    )
    if not policy:
        raise HTTPException(status_code=404, detail="MFA Policy not found")
    await db.delete(policy)
    await db.flush()



