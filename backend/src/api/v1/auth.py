import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from src.api.deps import CurrentUserContext, get_current_user_context, require_permission
from src.database.session import get_db
from src.models import RefreshToken, Role, Tenant, User, UserRole
from src.schemas.core import (
    AssignRoleRequest,
    LoginRequest,
    MeResponse,
    PasswordChangeRequest,
    RefreshRequest,
    RoleCreate,
    RoleResponse,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from src.utils.security import (
    create_access_token,
    create_refresh_token,
    create_super_admin_role,
    decode_token,
    generate_token,
    hash_password,
    hash_token,
    seed_permissions,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


async def _issue_tokens(db: AsyncSession, user: User) -> TokenResponse:
    # Pick the first assigned role as the active role for the session
    active_role_id: uuid.UUID | None = None
    if user.user_roles:
        active_role_id = user.user_roles[0].role_id

    # Identity claims carried in the token itself. Microservices validate
    # this locally (no per-request call back to auth), so permissions,
    # outlet scope and profile have to travel with it.
    identity = await _build_identity_claims(db, user, active_role_id)

    access = create_access_token(
        user.id, user.tenant_id, active_role_id, claims=identity
    )
    refresh = generate_token(48)

    db.add(RefreshToken(
        tenant_id=user.tenant_id,
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    ))
    await db.commit()

    from src.config import get_settings
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=get_settings().access_token_expire_minutes * 60,
    )


async def _build_identity_claims(
    db: AsyncSession, user: User, active_role_id: uuid.UUID | None
) -> dict:
    """Resolve permissions + outlet scope for the token payload."""
    from src.api.deps import _collect_permissions, _is_admin
    from src.models import Outlet

    outlets = list((await db.execute(
        select(Outlet).where(
            Outlet.tenant_id == user.tenant_id, Outlet.is_active.is_(True)
        )
    )).scalars().all())
    outlet_ids = {o.id for o in outlets}

    permissions = _collect_permissions(user, active_role_id)
    is_owner = _is_admin(user, active_role_id)

    # A user's outlet_ids list is an allowlist; empty means "every outlet
    # in the tenant".
    scoped = [uuid.UUID(str(o)) for o in (user.outlet_ids or [])]
    allowed = scoped if scoped else [o.id for o in outlets]

    return {
        "email": user.email,
        "full_name": user.full_name or "",
        "permissions": sorted(permissions),
        "is_tenant_owner": is_owner,
        "tenant_slug": user.tenant.slug if user.tenant else "",
        "allowed_outlet_ids": [str(o) for o in allowed],
        "active_outlet_id": str(allowed[0]) if allowed else None,
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticate with email + password."""
    result = await db.execute(
        select(User)
        .options(joinedload(User.tenant), selectinload(User.user_roles))
        .where(User.email == payload.email.lower())
        .limit(1)
    )
    user = result.scalars().first()

    if user is None or not verify_password(payload.password, user.hashed_password or ""):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user_status = user.status.value if hasattr(user.status, "value") else str(user.status or "").lower()
    if user_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active")

    if user.tenant is not None:
        tenant_status = (
            user.tenant.status.value
            if hasattr(user.tenant.status, "value")
            else str(user.tenant.status or "").lower()
        )
        if tenant_status in ("suspended", "cancelled"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your workspace has been suspended or cancelled.",
            )

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return await _issue_tokens(db, user)


@router.post("/register", response_model=TokenResponse)
async def register(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a tenant owner + tenant in one step (bootstrap endpoint)."""
    email = payload.email.lower()

    existing = await db.scalar(select(User.id).where(User.email == email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Permissions must exist before we build the Super Admin role
    await seed_permissions(db)

    tenant = Tenant(
        name=payload.full_name,
        slug=email.split("@")[0].replace(".", "-") + "-" + generate_token(4),
        status="active",
        plan="trial",
    )
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        is_tenant_owner=True,
        email_verified=False,
        status="active",
        outlet_ids=[str(o) for o in payload.outlet_ids],
    )
    db.add(user)
    await db.flush()

    role = await create_super_admin_role(db, tenant.id)
    db.add(UserRole(tenant_id=tenant.id, user_id=user.id, role_id=role.id))
    await db.flush()

    await db.refresh(user, attribute_names=["user_roles"])
    return await _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Exchange a valid refresh token for a new token pair."""
    try:
        data = decode_token(payload.refresh_token, expected_type="refresh")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    token_hash = hash_token(payload.refresh_token)
    stored = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    if stored is None or stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = await db.scalar(select(User).where(User.id == stored.user_id))
    if user is None or user.status.value != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not available")

    # Rotate: revoke the old token
    stored.revoked = True
    await db.commit()

    return await _issue_tokens(db, user)


@router.post("/logout")
async def logout(
    payload: RefreshRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Revoke a refresh token."""
    token_hash = hash_token(payload.refresh_token)
    stored = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if stored and stored.tenant_id == ctx.tenant_id:
        stored.revoked = True
        await db.commit()
    return {"detail": "Logged out"}


@router.get("/me", response_model=MeResponse)
async def me(ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)]):
    """Current user identity, permissions and outlet access."""
    role_names = [
        ur.role.name for ur in (ctx.user.user_roles or []) if ur.role
    ]
    return MeResponse(
        id=ctx.user.id,
        tenant_id=ctx.tenant_id,
        email=ctx.user.email,
        full_name=ctx.user.full_name,
        phone=ctx.user.phone,
        is_tenant_owner=ctx.is_tenant_owner,
        tenant_slug=ctx.tenant_slug,
        permissions=sorted(ctx.permissions),
        roles=role_names,
        active_role_id=ctx.active_role_id,
        outlet_ids=ctx.user.outlet_ids or [],
        active_outlet_id=ctx.active_outlet_id,
    )


@router.post("/password/change")
async def change_password(
    payload: PasswordChangeRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Change the current user's password."""
    if not verify_password(payload.current_password, ctx.user.hashed_password or ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    ctx.user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return {"detail": "Password updated"}


# ─── Roles & users (admin) ───────────────────────────────────────

@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:roles"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    roles = (await db.execute(select(Role).where(Role.tenant_id == ctx.tenant_id))).scalars().all()
    out = []
    for r in roles:
        codes = [rp.permission.code for rp in (r.role_permissions or []) if rp.permission]
        out.append(RoleResponse(
            id=r.id, tenant_id=r.tenant_id, name=r.name, description=r.description,
            is_system=r.is_system, is_active=r.is_active, permission_codes=codes,
        ))
    return out


@router.post("/roles", response_model=RoleResponse)
async def create_role(
    payload: RoleCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:roles"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from src.models import Permission, RolePermission

    role = Role(
        tenant_id=ctx.tenant_id, name=payload.name,
        description=payload.description, is_system=False,
    )
    db.add(role)
    await db.flush()

    if payload.permission_codes:
        perms = (await db.execute(
            select(Permission).where(Permission.code.in_(payload.permission_codes))
        )).scalars().all()
        for p in perms:
            db.add(RolePermission(role_id=role.id, permission_id=p.id))
    await db.commit()

    codes = [rp.permission.code for rp in (role.role_permissions or []) if rp.permission]
    return RoleResponse(
        id=role.id, tenant_id=role.tenant_id, name=role.name,
        description=role.description, is_system=role.is_system,
        is_active=role.is_active, permission_codes=codes,
    )


@router.post("/users/{user_id}/roles")
async def assign_role(
    user_id: uuid.UUID,
    payload: AssignRoleRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await db.scalar(select(User).where(User.id == user_id, User.tenant_id == ctx.tenant_id))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    role = await db.scalar(select(Role).where(Role.id == payload.role_id, Role.tenant_id == ctx.tenant_id))
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")

    if payload.outlet_id:
        ctx.require_outlet_access(payload.outlet_id)

    db.add(UserRole(
        tenant_id=ctx.tenant_id, user_id=user.id,
        role_id=role.id, outlet_id=payload.outlet_id,
    ))
    await db.commit()
    return {"detail": "Role assigned"}


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:users"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    users = (await db.execute(
        select(User).where(User.tenant_id == ctx.tenant_id).order_by(User.created_at.desc())
    )).scalars().all()
    return [UserResponse.model_validate(u) for u in users]
