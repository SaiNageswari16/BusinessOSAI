"""Auth service endpoints.

Route groups and who may call them:

* ``/login``, ``/refresh``, ``/register`` — unauthenticated by necessity, and
  reached through the gateway, which only enforces a token when one is sent.
* ``/me``, ``/logout`` — any valid token.
* ``/users``, ``/roles`` — ``manage:users`` / ``manage:roles``.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.auth import service
from src.services.auth.models import Role, Tenant, User, UserRole, UserStatus
from src.services.auth.permissions import (
    PERMISSION_CATALOGUE,
    unknown_permissions,
)
from src.services.auth.schemas import (
    LoginRequest,
    LogoutRequest,
    PasswordChange,
    RefreshRequest,
    RoleAssign,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
    TenantRegister,
    TenantResponse,
    TokenPair,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from src.services.event_bus.bus import Event, bus
from src.services.shared.identity import CurrentIdentity, client_ip

router = APIRouter()


async def get_db(request: Request) -> AsyncSession:
    """One session per request, committed on success, rolled back on error."""
    session = request.app.state.db.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


DbDep = Annotated[AsyncSession, Depends(get_db)]


def _ev(topic: str, tenant_id=None, data: dict | None = None) -> Event:
    return Event(type=topic, tenant_id=tenant_id, data=data or {}, source_service="auth")


def _ua(request: Request) -> str | None:
    return request.headers.get("user-agent")


# ─── Registration ───────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
    tags=["registration"],
    summary="Create a tenant and its owner, and log in",
)
async def register(payload: TenantRegister, request: Request, db: DbDep):
    """First-run signup. Returns tokens so the caller is logged in immediately."""
    tenant, user = await service.register_tenant(
        db,
        tenant_name=payload.tenant_name,
        tenant_slug=payload.tenant_slug,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )

    await bus.publish(_ev(
        "tenant.created", tenant.id, data={"slug": tenant.slug, "name": tenant.name}
    ))
    await bus.publish(_ev(
        "user.created", tenant.id,
        data={"user_id": str(user.id), "email": user.email},
    ))

    return await service.issue_tokens(
        db, user, user_agent=_ua(request), ip_address=client_ip(request)
    )


# ─── Login / refresh / logout ───────────────────────────────────────────────

@router.post("/login", response_model=TokenPair, tags=["session"],
             summary="Exchange credentials for a token pair")
async def login(payload: LoginRequest, request: Request, db: DbDep):
    user = await service.authenticate(
        db,
        email=payload.email,
        password=payload.password,
        tenant_slug=payload.tenant_slug,
    )
    return await service.issue_tokens(
        db,
        user,
        active_outlet_id=payload.outlet_id,
        user_agent=_ua(request),
        ip_address=client_ip(request),
    )


@router.post("/refresh", response_model=TokenPair, tags=["session"],
             summary="Rotate a refresh token")
async def refresh(payload: RefreshRequest, request: Request, db: DbDep):
    return await service.rotate_refresh_token(
        db,
        refresh_token=payload.refresh_token,
        user_agent=_ua(request),
        ip_address=client_ip(request),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["session"],
             summary="Revoke one refresh token")
async def logout(payload: LogoutRequest, db: DbDep):
    """Always 204, even for an unknown token — logging out is idempotent."""
    await service.revoke_refresh_token(db, payload.refresh_token)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT, tags=["session"],
             summary="Revoke every session for the caller")
async def logout_all(identity: CurrentIdentity, db: DbDep):
    await service.revoke_all_for_user(db, identity.user_id)


# ─── Current user ───────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse, tags=["session"])
async def me(identity: CurrentIdentity, db: DbDep):
    """The caller's own record, read from the database rather than the token.

    The token carries identity for authorisation; this returns the live row,
    so a name or status changed since the token was issued shows up here.
    """
    user = await db.get(User, identity.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT, tags=["session"],
             summary="Change your password and end all sessions")
async def change_own_password(
    payload: PasswordChange, identity: CurrentIdentity, db: DbDep
):
    user = await db.get(User, identity.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    await service.change_password(
        db,
        user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )


# ─── Users ──────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse], tags=["users"])
async def list_users(identity: CurrentIdentity, db: DbDep):
    identity.require("manage:users")
    return (await db.execute(
        select(User).where(User.tenant_id == identity.tenant_id).order_by(User.email)
    )).scalars().all()


@router.post("/users", response_model=UserResponse,
             status_code=status.HTTP_201_CREATED, tags=["users"])
async def create_user(payload: UserCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:users")

    # Only an owner may mint another owner; a manager with manage:users
    # creating an owner account would be a privilege-escalation path.
    if payload.is_tenant_owner and not identity.is_tenant_owner:
        raise HTTPException(
            status_code=403, detail="Only a tenant owner can create another owner"
        )

    user = await service.create_user(
        db,
        tenant_id=identity.tenant_id,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        phone=payload.phone,
        role_slugs=payload.role_slugs,
        is_tenant_owner=payload.is_tenant_owner,
    )
    await bus.publish(_ev(
        "user.created", identity.tenant_id,
        data={"user_id": str(user.id), "email": user.email},
    ))
    return user


@router.get("/users/{user_id}", response_model=UserResponse, tags=["users"])
async def get_user(user_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:users")
    user = await db.scalar(
        select(User).where(User.id == user_id, User.tenant_id == identity.tenant_id)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse, tags=["users"])
async def update_user(
    user_id: uuid.UUID, payload: UserUpdate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:users")
    user = await db.scalar(
        select(User).where(User.id == user_id, User.tenant_id == identity.tenant_id)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.status is not None:
        try:
            new_status = UserStatus(payload.status)
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"status must be one of: {[s.value for s in UserStatus]}",
            )
        # Locking yourself out is never intentional.
        if user.id == identity.user_id and new_status != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=400, detail="You cannot deactivate your own account"
            )
        user.status = new_status
        if new_status != UserStatus.ACTIVE:
            # A deactivated user must not keep a working session.
            await service.revoke_all_for_user(db, user.id)

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone

    await bus.publish(_ev(
        "user.updated", identity.tenant_id, data={"user_id": str(user.id)}
    ))
    return user


@router.post("/users/{user_id}/roles", response_model=RoleResponse, tags=["users"],
             summary="Grant a role to a user")
async def grant_role(
    user_id: uuid.UUID, payload: RoleAssign, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:roles")
    user = await db.scalar(
        select(User).where(User.id == user_id, User.tenant_id == identity.tenant_id)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    link = await service.assign_role(
        db,
        tenant_id=identity.tenant_id,
        user_id=user.id,
        role_slug=payload.role_slug,
        outlet_id=payload.outlet_id,
    )
    role = await db.get(Role, link.role_id)
    return role


@router.delete("/users/{user_id}/roles/{role_id}",
               status_code=status.HTTP_204_NO_CONTENT, tags=["users"])
async def revoke_role(
    user_id: uuid.UUID, role_id: uuid.UUID, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:roles")
    link = await db.scalar(
        select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
            UserRole.tenant_id == identity.tenant_id,
        )
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Role assignment not found")
    await db.delete(link)


# ─── Roles ──────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[RoleResponse], tags=["roles"])
async def list_roles(identity: CurrentIdentity, db: DbDep):
    identity.require("view:roles")
    return (await db.execute(
        select(Role).where(Role.tenant_id == identity.tenant_id).order_by(Role.name)
    )).scalars().all()


@router.post("/roles", response_model=RoleResponse,
             status_code=status.HTTP_201_CREATED, tags=["roles"])
async def create_role(payload: RoleCreate, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:roles")

    bad = unknown_permissions(payload.permissions)
    if bad:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown permission(s): {bad}. See GET /permissions.",
        )

    clash = await db.scalar(
        select(Role.id).where(
            Role.tenant_id == identity.tenant_id, Role.slug == payload.slug
        )
    )
    if clash:
        raise HTTPException(
            status_code=409, detail=f"Role '{payload.slug}' already exists"
        )

    role = Role(
        tenant_id=identity.tenant_id,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        permissions=payload.permissions,
    )
    db.add(role)
    await db.flush()
    return role


@router.patch("/roles/{role_id}", response_model=RoleResponse, tags=["roles"])
async def update_role(
    role_id: uuid.UUID, payload: RoleUpdate, identity: CurrentIdentity, db: DbDep
):
    identity.require("manage:roles")
    role = await db.scalar(
        select(Role).where(Role.id == role_id, Role.tenant_id == identity.tenant_id)
    )
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")

    if payload.permissions is not None:
        bad = unknown_permissions(payload.permissions)
        if bad:
            raise HTTPException(
                status_code=422, detail=f"Unknown permission(s): {bad}"
            )
        # Editing a system role would change what "manager" means for every
        # user holding it, with no way to tell who was affected.
        if role.is_system and not identity.is_tenant_owner:
            raise HTTPException(
                status_code=403, detail="Only a tenant owner can edit a system role"
            )
        role.permissions = payload.permissions

    if payload.name is not None:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    if payload.is_active is not None:
        role.is_active = payload.is_active

    return role


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["roles"])
async def delete_role(role_id: uuid.UUID, identity: CurrentIdentity, db: DbDep):
    identity.require("manage:roles")
    role = await db.scalar(
        select(Role).where(Role.id == role_id, Role.tenant_id == identity.tenant_id)
    )
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")

    held = await db.scalar(
        select(UserRole.id).where(UserRole.role_id == role.id).limit(1)
    )
    if held:
        raise HTTPException(
            status_code=409,
            detail="Role is still assigned to users — revoke it first",
        )
    await db.delete(role)


# ─── Catalogue ──────────────────────────────────────────────────────────────

@router.get("/permissions", tags=["roles"],
            summary="Every permission code this deployment understands")
async def list_permissions(identity: CurrentIdentity):
    identity.require("view:roles")
    return {
        "count": len(PERMISSION_CATALOGUE),
        "permissions": [
            {"code": code, "name": name, "module": module}
            for code, (name, module) in sorted(PERMISSION_CATALOGUE.items())
        ],
        "wildcards_supported": ["<module>:*", "*"],
    }


@router.get("/tenants/current", response_model=TenantResponse, tags=["registration"])
async def current_tenant(identity: CurrentIdentity, db: DbDep):
    tenant = await db.get(Tenant, identity.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.get("/tenants", response_model=list[TenantResponse], tags=["registration"])
async def list_tenants(db: DbDep):
    """Platform-scoped tenant listing.

    Intentionally unauthenticated at the route level: this endpoint is called
    by the platform service over the internal service-to-service path, where
    the gateway has already verified the caller holds a platform-realm token.
    Exposing this through the public gateway would list every tenant's basic
    details to any unauthenticated caller, so the gateway must block this
    route for tenant-realm callers. The platform service is the only caller.
    """
    res = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    return list(res.scalars().all())
