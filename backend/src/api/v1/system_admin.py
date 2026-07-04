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
