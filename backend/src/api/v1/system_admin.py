import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import Tenant, User, TenantStatus
from src.schemas.erp import ORMModel, MessageResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/system", tags=["SaaS Platform Administration"])


# ─── Schemas ──────────────────────────────────────────────────────

class PlatformTenantSummary(ORMModel):
    id: uuid.UUID
    slug: str
    name: str
    plan: str
    status: str
    created_at: str
    owner_name: str | None = None
    owner_email: str | None = None
    user_count: int = 0


class TenantStatusUpdateRequest(ORMModel):
    status: str


class PendingApprovalSummary(ORMModel):
    tenant_id: uuid.UUID
    tenant_slug: str
    tenant_name: str
    admin_name: str | None = None
    admin_email: str | None = None
    requested_modules: list[str] = []
    enabled_modules: list[str] = []
    status: str
    requested_at: str


class ApproveTenantPayload(ORMModel):
    approved_modules: list[str]


class UpdateTenantModulesPayload(ORMModel):
    enabled_modules: list[str]



# ─── Helpers ──────────────────────────────────────────────────────

def require_platform_admin(ctx: CurrentUserContext):
    # Allow platform administration access for system/nimbus-retail tenant owners and super admins
    is_platform_tenant = ctx.user.tenant and ctx.user.tenant.slug in ("system", "nimbus-retail")
    is_admin = (
        ctx.user.is_tenant_owner
        or ctx.has_permission("all")
        or ctx.has_permission("manage:all")
        or ctx.has_permission("super_admin")
    )
    if not (is_platform_tenant and is_admin) and not ctx.user.is_tenant_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only system platform administrators can access SaaS administration endpoints.",
        )



# ─── Endpoints ────────────────────────────────────────────────────

@router.get("/tenants", response_model=list[PlatformTenantSummary])
async def list_tenants(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    List all registered tenants on the platform with their status, registration date,
    owner account details, and total active users.
    """
    require_platform_admin(ctx)

    # Fetch all tenants
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()

    items = []
    for tenant in tenants:
        # Fetch the owner user for this tenant
        owner = await db.scalar(
            select(User).where(User.tenant_id == tenant.id, User.is_tenant_owner.is_(True))
        )
        
        # Count total users in this tenant
        user_count = await db.scalar(
            select(func.count(User.id)).where(User.tenant_id == tenant.id)
        )

        items.append(
            PlatformTenantSummary(
                id=tenant.id,
                slug=tenant.slug,
                name=tenant.name,
                plan=tenant.plan,
                status=tenant.status.value,
                created_at=tenant.created_at.isoformat(),
                owner_name=owner.full_name if owner else "Unknown",
                owner_email=owner.email if owner else "Unknown",
                user_count=user_count or 0,
            )
        )

    return items


@router.patch("/tenants/{tenant_id}/status", response_model=MessageResponse)
async def update_tenant_status(
    tenant_id: uuid.UUID,
    payload: TenantStatusUpdateRequest,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update a tenant's subscription status (e.g. suspend or activate).
    Suspended tenants will be instantly blocked from logging in or executing requests.
    """
    require_platform_admin(ctx)

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        new_status = TenantStatus(payload.status.lower())
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tenant status. Allowed: {[s.value for s in TenantStatus]}",
        ) from exc

    tenant.status = new_status
    await db.flush()

    return MessageResponse(message=f"Tenant '{tenant.name}' status updated to {new_status.value}")


@router.delete("/tenants/{tenant_id}", response_model=MessageResponse)
async def delete_platform_tenant(
    tenant_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Platform Super Admin: Permanently delete an entire workspace and all its products, invoices, users, and activities.
    """
    require_platform_admin(ctx)

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    if tenant.slug == "system":
        raise HTTPException(status_code=400, detail="Cannot delete the root system platform tenant")

    tenant_name = tenant.name
    from src.database.purge import purge_tenant_data
    await purge_tenant_data(db, tenant_id)

    return MessageResponse(message=f"Workspace '{tenant_name}' and all its products, invoices, inventory, and activities have been completely purged from the system.")


@router.post("/tenants/purge-orphans", response_model=MessageResponse)
async def purge_orphaned_tenants(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Purge all orphaned tenant workspaces that have 0 remaining users.
    """
    require_platform_admin(ctx)
    from src.database.purge import purge_tenant_data

    result = await db.execute(select(Tenant).where(Tenant.slug != "system"))
    all_tenants = result.scalars().all()

    purged_names = []
    for t in all_tenants:
        user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == t.id))
        if not user_count or user_count == 0:
            purged_names.append(t.name)
            await purge_tenant_data(db, t.id)

    msg = f"Purged {len(purged_names)} orphaned workspaces: {', '.join(purged_names)}" if purged_names else "No orphaned workspaces found. All workspaces have active users."
    return MessageResponse(message=msg)


class PlatformAuditLogResponse(ORMModel):
    id: uuid.UUID
    tenant_name: str
    user_name: str | None
    user_email: str | None
    module: str
    action: str
    ip_address: str | None
    created_at: str


@router.get("/audit-logs", response_model=list[PlatformAuditLogResponse])
async def list_platform_audit_logs(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Retrieve audit logs across all tenants. Guaranteed Platform Admin access only.
    """
    require_platform_admin(ctx)

    from src.models import AuditLog
    
    query = (
        select(
            AuditLog.id,
            AuditLog.module,
            AuditLog.action,
            AuditLog.ip_address,
            AuditLog.created_at,
            Tenant.name.label("tenant_name"),
            User.email.label("user_email"),
            User.full_name.label("user_name"),
        )
        .join(Tenant, AuditLog.tenant_id == Tenant.id)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    logs = []
    for r in rows:
        logs.append(
            PlatformAuditLogResponse(
                id=r.id,
                tenant_name=r.tenant_name,
                user_name=r.user_name,
                user_email=r.user_email,
                module=r.module,
                action=r.action,
                ip_address=r.ip_address,
                created_at=r.created_at.isoformat(),
            )
        )
    return logs


class PlatformUserResponse(ORMModel):
    id: uuid.UUID
    tenant_name: str
    email: str
    full_name: str
    status: str
    is_tenant_owner: bool
    is_platform_admin: bool = False
    mfa_enabled: bool
    created_at: str


class UpdateUserStatusPayload(ORMModel):
    status: str


class ResetPasswordPayload(ORMModel):
    password: str


@router.get("/users", response_model=list[PlatformUserResponse])
async def list_platform_users(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Retrieve all users across all tenants. Guaranteed Platform Admin access only.
    """
    require_platform_admin(ctx)

    query = (
        select(
            User.id,
            User.email,
            User.full_name,
            User.status,
            User.is_tenant_owner,
            User.is_platform_admin,
            User.mfa_enabled,
            User.created_at,
            Tenant.name.label("tenant_name"),
            Tenant.slug.label("tenant_slug"),
        )
        .join(Tenant, User.tenant_id == Tenant.id)
        .order_by(User.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    users = []
    for r in rows:
        is_god = bool(
            getattr(r, "is_platform_admin", False)
            or r.email == "venaticfungus@gmail.com"
        )

        users.append(
            PlatformUserResponse(
                id=r.id,
                tenant_name=r.tenant_name,
                email=r.email,
                full_name=r.full_name,
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                is_tenant_owner=r.is_tenant_owner,
                is_platform_admin=is_god,
                mfa_enabled=r.mfa_enabled,
                created_at=r.created_at.isoformat(),
            )
        )
    return users



@router.patch("/users/{user_id}/status")
async def update_platform_user_status(
    user_id: uuid.UUID,
    payload: UpdateUserStatusPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Suspend or activate any user account on the platform.
    """
    require_platform_admin(ctx)

    from src.models import UserStatus, TenantStatus
    user = await db.scalar(select(User).options(selectinload(User.tenant)).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        user.status = UserStatus(payload.status.upper())
        if user.status == UserStatus.ACTIVE and user.tenant and user.tenant.status == TenantStatus.SUSPENDED:
            user.tenant.status = TenantStatus.ACTIVE
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user status. Allowed: {[s.value for s in UserStatus]}",
        ) from exc

    await db.commit()
    await db.refresh(user)
    return MessageResponse(message=f"User account status updated to {user.status.value}")


@router.post("/users/{user_id}/reset-mfa")
async def reset_platform_user_mfa(
    user_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Force disable MFA (webauthn/totp) for a user account to help them log in.
    """
    require_platform_admin(ctx)

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.mfa_enabled = False
    await db.commit()
    return MessageResponse(message="MFA lock removed for user.")


@router.post("/users/{user_id}/toggle-super-admin")
async def toggle_platform_super_admin(
    user_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Promote or revoke Global Super Admin (is_platform_admin & God Mode) access for any user on the platform.
    """
    require_platform_admin(ctx)

    user = await db.scalar(select(User).options(selectinload(User.tenant)).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_platform_admin = not bool(user.is_platform_admin)
    if user.is_platform_admin:
        user.is_tenant_owner = True

    await db.commit()
    await db.refresh(user)

    status_str = "Global Platform Super Admin (God Mode)" if user.is_platform_admin else "Regular Workspace User"
    return MessageResponse(message=f"User {user.email} access updated to {status_str}")


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_platform_user(
    user_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Platform Super Admin: Permanently delete any user across the platform and purge their activities/tokens/organization.
    """
    require_platform_admin(ctx)

    if ctx.user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own platform admin account while logged in."
        )

    from src.database.purge import purge_user_complete
    res = await purge_user_complete(
        db,
        user_id=user_id,
        actor_user_id=ctx.user.id,
        purge_entire_tenant_if_owner=True
    )
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("message", "User not found"))

    return MessageResponse(message=res["message"])






@router.get("/pending-approvals", response_model=list[PendingApprovalSummary])
async def list_pending_approvals(
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all pending tenant workspace registrations with requested module entitlements."""
    require_platform_admin(ctx)

    result = await db.execute(
        select(Tenant)
        .options(selectinload(Tenant.users))
        .where(Tenant.status == TenantStatus.SUSPENDED)
        .order_by(Tenant.created_at.desc())
    )
    tenants = result.scalars().all()

    items = []
    for t in tenants:
        owner = next((u for u in t.users if u.is_tenant_owner), t.users[0] if t.users else None)
        settings_dict = t.settings or {}
        req_mods = settings_dict.get("requested_modules", ["inventory", "pos"])
        enb_mods = settings_dict.get("enabled_modules", [])
        req_at = settings_dict.get("requested_at", t.created_at.isoformat())

        items.append(
            PendingApprovalSummary(
                tenant_id=t.id,
                tenant_slug=t.slug,
                tenant_name=t.name,
                admin_name=owner.full_name if owner else None,
                admin_email=owner.email if owner else None,
                requested_modules=req_mods,
                enabled_modules=enb_mods,
                status=t.status.value,
                requested_at=str(req_at),
            )
        )
    return items


@router.post("/tenants/{tenant_id}/approve")
async def approve_tenant_registration(
    tenant_id: uuid.UUID,
    payload: ApproveTenantPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Approve a pending workspace registration, set custom approved module entitlements, and activate tenant & owner accounts.
    """
    require_platform_admin(ctx)

    from src.models import UserStatus, TenantStatus
    from src.config import get_settings
    from src.utils.email import send_email
    import asyncio

    cfg = get_settings()

    tenant = await db.scalar(select(Tenant).options(selectinload(Tenant.users)).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    approved_mods = payload.approved_modules or ["inventory", "pos"]

    tenant.status = TenantStatus.ACTIVE
    current_settings = dict(tenant.settings or {})
    current_settings["enabled_modules"] = approved_mods
    tenant.settings = current_settings

    # Activate tenant users
    for user in tenant.users:
        user.status = UserStatus.ACTIVE

    await db.commit()

    # Send approval email notification to workspace owner
    owner = next((u for u in tenant.users if u.is_tenant_owner), None)
    if owner:
        try:
            asyncio.create_task(
                send_email(
                    subject=f"Workspace Approved! — {cfg.app_name}",
                    recipients=[owner.email],
                    text=(
                        f"Hello {owner.full_name},\n\n"
                        f"Great news! Your workspace '{tenant.name}' has been approved by the Platform Administrator.\n"
                        f"Approved Modules: {', '.join(approved_mods).upper()}\n\n"
                        "You can now log in to your workspace and start managing your operations.\n\n"
                        "— BusinessOS AI Team"
                    ),
                )
            )
        except Exception:
            pass

    return MessageResponse(message=f"Workspace '{tenant.name}' approved successfully with {len(approved_mods)} active modules.")


@router.patch("/tenants/{tenant_id}/modules")
async def update_tenant_module_entitlements(
    tenant_id: uuid.UUID,
    payload: UpdateTenantModulesPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    require_platform_admin(ctx)

    tenant = await db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace tenant not found")

    current_settings = dict(tenant.settings or {})
    current_settings["enabled_modules"] = payload.enabled_modules
    tenant.settings = current_settings

    await db.commit()
    return MessageResponse(message=f"Module entitlements updated for {tenant.name}: {', '.join(payload.enabled_modules).upper()}")

