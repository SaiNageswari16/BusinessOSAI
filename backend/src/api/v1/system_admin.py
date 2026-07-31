import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import Tenant, User, TenantStatus
from src.schemas.erp import ORMModel, MessageResponse

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


# ─── Helpers ──────────────────────────────────────────────────────

def require_platform_admin(ctx: CurrentUserContext):
    # Tenant slug must be 'system' and user must be the tenant owner (SaaS seller)
    if ctx.user.tenant.slug != "system" or not ctx.user.is_tenant_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only the platform owner can access SaaS administration endpoints.",
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
            User.mfa_enabled,
            User.created_at,
            Tenant.name.label("tenant_name"),
        )
        .join(Tenant, User.tenant_id == Tenant.id)
        .order_by(User.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    users = []
    for r in rows:
        users.append(
            PlatformUserResponse(
                id=r.id,
                tenant_name=r.tenant_name,
                email=r.email,
                full_name=r.full_name,
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                is_tenant_owner=r.is_tenant_owner,
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

    from src.models import UserStatus
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        user.status = UserStatus(payload.status.upper())
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user status. Allowed: {[s.value for s in UserStatus]}",
        ) from exc

    await db.flush()
    return MessageResponse(message=f"User account status updated to {user.status.value}")


@router.post("/users/{user_id}/reset-password")
async def reset_platform_user_password(
    user_id: uuid.UUID,
    payload: ResetPasswordPayload,
    ctx: Annotated[CurrentUserContext, Depends(get_current_user_context)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Administratively reset password for any user account.
    """
    require_platform_admin(ctx)

    from src.utils.security import hash_password
    from src.utils.email import send_email

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(payload.password)
    user.must_change_password = True
    await db.flush()

    # Send Notification Email to User
    email_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #6366f1;">BusinessOS AI Security Alert</h2>
        <p>Hello <strong>{user.full_name}</strong>,</p>
        <p>A system administrator has reset your password. You can now log in using the following temporary credentials:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 15px 0; font-family: monospace; font-size: 14px;">
          <strong>Email:</strong> {user.email}<br/>
          <strong>Temporary Password:</strong> {payload.password}
        </div>
        <p style="color: #ef4444;"><strong>Note:</strong> You will be prompted to choose a new password immediately upon logging in for security purposes.</p>
        <p>If you did not request this reset, please contact system support immediately.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
        <p style="font-size: 11px; color: #9ca3af;">This is an automated notification from BusinessOS AI Security. Please do not reply to this email.</p>
      </body>
    </html>
    """
    
    text_body = f"Hello {user.full_name},\n\nA system administrator has reset your password.\n\nTemporary Credentials:\nEmail: {user.email}\nTemporary Password: {payload.password}\n\nNote: You will be prompted to choose a new password immediately upon logging in for security purposes."

    # Background send
    await send_email(
        subject="BusinessOS AI — Your password has been reset",
        recipients=[user.email],
        html=email_body,
        text=text_body,
    )

    return MessageResponse(message="Password successfully reset. Notification email sent to user.")


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
    await db.flush()

    return MessageResponse(message="MFA has been successfully disabled for this account.")


