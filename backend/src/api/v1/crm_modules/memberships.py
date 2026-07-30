"""Membership Plans backend endpoints."""
import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUserContext, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import (
    Customer,
    CustomerGroupMember,
    CustomerMembership,
    MembershipPlan,
    User,
)
from src.schemas.crm import (
    CustomerMembershipResponse,
    MembershipEnrollRequest,
    MembershipPlanCreate,
    MembershipPlanResponse,
    MembershipPlanUpdate,
)
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.notifications import add_system_notification

router = APIRouter(prefix="/crm/membership-plans", tags=["CRM - Membership Plans"])


async def _plan_or_404(db, plan_id, tenant_id):
    plan = await db.scalar(
        select(MembershipPlan).where(MembershipPlan.id == plan_id, MembershipPlan.tenant_id == tenant_id)
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found")
    return plan


# ─── Plan CRUD ───────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[MembershipPlanResponse])
async def list_plans(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str | None = None,
    status_filter: str | None = None,
):
    q = select(MembershipPlan).where(MembershipPlan.tenant_id == ctx.tenant_id)
    if search:
        term = f"%{search}%"
        q = q.where(or_(MembershipPlan.name.ilike(term), MembershipPlan.description.ilike(term)))
    if status_filter:
        q = q.where(MembershipPlan.status == status_filter)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(MembershipPlan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [MembershipPlanResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)


@router.post("", response_model=MembershipPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: MembershipPlanCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = MembershipPlan(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(plan)
    await db.flush()
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="plan_created", entity_type="membership_plan",
        entity_id=plan.id, new_values=payload.model_dump(mode="json"),
    )
    await db.commit()
    return plan


@router.get("/{plan_id}", response_model=MembershipPlanResponse)
async def get_plan(
    plan_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await _plan_or_404(db, plan_id, ctx.tenant_id)
    return MembershipPlanResponse.model_validate(plan)


@router.patch("/{plan_id}", response_model=MembershipPlanResponse)
async def update_plan(
    plan_id: uuid.UUID,
    payload: MembershipPlanUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await _plan_or_404(db, plan_id, ctx.tenant_id)
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(plan, k, v)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="plan_updated", entity_type="membership_plan",
        entity_id=plan.id, new_values=updates,
    )
    await db.commit()
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await _plan_or_404(db, plan_id, ctx.tenant_id)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="plan_deleted", entity_type="membership_plan",
        entity_id=plan.id,
    )
    await db.delete(plan)
    await db.commit()


# ─── Member Management ───────────────────────────────────────────────

@router.post("/{plan_id}/enroll", response_model=CustomerMembershipResponse, status_code=status.HTTP_201_CREATED)
async def enroll_customer(
    plan_id: uuid.UUID,
    payload: MembershipEnrollRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await _plan_or_404(db, plan_id, ctx.tenant_id)
    customer = await db.scalar(
        select(Customer).where(Customer.id == payload.customer_id, Customer.tenant_id == ctx.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Check existing
    existing = await db.scalar(
        select(CustomerMembership).where(
            CustomerMembership.tenant_id == ctx.tenant_id,
            CustomerMembership.customer_id == payload.customer_id,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Customer already has an active membership")

    # Calculate expiry
    expires_at = payload.expires_at
    if not expires_at and plan.max_duration_months:
        from dateutil.relativedelta import relativedelta
        expires_at = date.today() + relativedelta(months=plan.max_duration_months)

    membership = CustomerMembership(
        tenant_id=ctx.tenant_id,
        customer_id=payload.customer_id,
        plan_id=plan_id,
        expires_at=expires_at,
    )
    db.add(membership)
    plan.subscriber_count += 1

    await add_system_notification(
        db, ctx.tenant_id,
        f"New Membership: {customer.name}",
        f"{customer.name} enrolled in {plan.name}",
        "crm",
    )
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="customer_enrolled",
        entity_type="membership_plan", entity_id=plan_id,
        new_values={"customer_id": str(payload.customer_id)},
    )
    await db.commit()
    return membership


@router.post("/{plan_id}/unenroll/{customer_id}", status_code=status.HTTP_200_OK)
async def unenroll_customer(
    plan_id: uuid.UUID,
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    reason: str = "",
):
    plan = await _plan_or_404(db, plan_id, ctx.tenant_id)
    membership = await db.scalar(
        select(CustomerMembership).where(
            CustomerMembership.tenant_id == ctx.tenant_id,
            CustomerMembership.customer_id == customer_id,
            CustomerMembership.plan_id == plan_id,
        )
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    membership.status = "Cancelled"
    membership.cancelled_at = datetime.now(timezone.utc)
    membership.cancellation_reason = reason
    plan.subscriber_count = max(0, plan.subscriber_count - 1)
    await db.commit()
    return {"success": True}


@router.get("/customers/{customer_id}", response_model=CustomerMembershipResponse)
async def get_customer_membership(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    membership = await db.scalar(
        select(CustomerMembership).where(
            CustomerMembership.tenant_id == ctx.tenant_id,
            CustomerMembership.customer_id == customer_id,
        )
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Customer has no membership")
    return membership


@router.get("/customers/{customer_id}/history")
async def get_membership_history(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    memberships = await db.execute(
        select(CustomerMembership, MembershipPlan)
        .join(MembershipPlan, CustomerMembership.plan_id == MembershipPlan.id)
        .where(
            CustomerMembership.tenant_id == ctx.tenant_id,
            CustomerMembership.customer_id == customer_id,
        )
        .order_by(CustomerMembership.created_at.desc())
    )
    items = []
    for m, p in memberships:
        items.append({
            "membership_id": str(m.id),
            "plan_name": p.name,
            "plan_code": p.plan_code,
            "status": m.status,
            "tier": m.tier,
            "tier_progress": float(m.tier_progress or 0),
            "points_earned": m.points_earned,
            "points_redeemed": m.points_redeemed,
            "total_spend_with_plan": float(m.total_spend_with_plan or 0),
            "enrolled_at": m.enrolled_at.isoformat(),
            "expires_at": m.expires_at.isoformat() if m.expires_at else None,
            "cancelled_at": m.cancelled_at.isoformat() if m.cancelled_at else None,
        })
    return items


@router.get("/{plan_id}/members", response_model=PaginatedResponse)
async def list_plan_members(
    plan_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_memberships"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    await _plan_or_404(db, plan_id, ctx.tenant_id)
    q = (
        select(CustomerMembership, Customer)
        .join(Customer, CustomerMembership.customer_id == Customer.id)
        .where(CustomerMembership.plan_id == plan_id, CustomerMembership.tenant_id == ctx.tenant_id)
    )
    if search:
        term = f"%{search}%"
        q = q.where(or_(Customer.name.ilike(term), Customer.email.ilike(term)))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(CustomerMembership.enrolled_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for m, c in rows:
        items.append({
            "membership_id": str(m.id),
            "customer_id": str(c.id),
            "customer_name": c.name,
            "customer_email": c.email,
            "status": m.status,
            "tier": m.tier,
            "tier_progress": float(m.tier_progress or 0),
            "points_earned": m.points_earned,
            "points_redeemed": m.points_redeemed,
            "enrolled_at": m.enrolled_at.isoformat(),
            "expires_at": m.expires_at.isoformat() if m.expires_at else None,
        })
    return paginate(items, total or 0, page, page_size)
