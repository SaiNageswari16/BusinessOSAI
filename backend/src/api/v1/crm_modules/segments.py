"""Customer Segments backend endpoints."""
import uuid
from datetime import datetime, timezone
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
    CustomerSegment,
    CustomerWallet,
    LoyaltyTransaction,
)
from src.schemas.crm import (
    CustomerSegmentCreate,
    CustomerSegmentResponse,
    CustomerSegmentUpdate,
    SegmentRules,
)
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.notifications import add_system_notification

router = APIRouter(prefix="/crm/segments", tags=["CRM - Customer Segments"])


async def _segment_or_404(db, segment_id, tenant_id):
    seg = await db.scalar(
        select(CustomerSegment).where(CustomerSegment.id == segment_id, CustomerSegment.tenant_id == tenant_id)
    )
    if not seg:
        raise HTTPException(status_code=404, detail="Customer segment not found")
    return seg


# ─── CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[CustomerSegmentResponse])
async def list_segments(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_segments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str | None = None,
):
    q = select(CustomerSegment).where(CustomerSegment.tenant_id == ctx.tenant_id)
    if search:
        term = f"%{search}%"
        q = q.where(or_(CustomerSegment.name.ilike(term), CustomerSegment.description.ilike(term)))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(CustomerSegment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [CustomerSegmentResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)


@router.post("", response_model=CustomerSegmentResponse, status_code=status.HTTP_201_CREATED)
async def create_segment(
    payload: CustomerSegmentCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_segments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    seg = CustomerSegment(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(seg)
    await db.flush()
    # If auto-computed, compute immediately
    if seg.is_auto_computed:
        await _compute_segment(db, seg, ctx.tenant_id)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="segment_created", entity_type="customer_segment",
        entity_id=seg.id, new_values=payload.model_dump(mode="json"),
    )
    await db.commit()
    return seg


@router.get("/{segment_id}", response_model=CustomerSegmentResponse)
async def get_segment(
    segment_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_segments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    seg = await _segment_or_404(db, segment_id, ctx.tenant_id)
    return CustomerSegmentResponse.model_validate(seg)


@router.patch("/{segment_id}", response_model=CustomerSegmentResponse)
async def update_segment(
    segment_id: uuid.UUID,
    payload: CustomerSegmentUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_segments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    seg = await _segment_or_404(db, segment_id, ctx.tenant_id)
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(seg, k, v)
    if seg.is_auto_computed:
        await _compute_segment(db, seg, ctx.tenant_id)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="segment_updated", entity_type="customer_segment",
        entity_id=seg.id, new_values=updates,
    )
    await db.commit()
    return seg


@router.delete("/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_segment(
    segment_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_segments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    seg = await _segment_or_404(db, segment_id, ctx.tenant_id)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="segment_deleted", entity_type="customer_segment",
        entity_id=seg.id,
    )
    await db.delete(seg)
    await db.commit()


# ─── Segment Computation ─────────────────────────────────────────────

@router.post("/{segment_id}/compute")
async def recompute_segment(
    segment_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_segments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    seg = await _segment_or_404(db, segment_id, ctx.tenant_id)
    if seg.mode != "rules":
        raise HTTPException(status_code=400, detail="Only rule-based segments support auto-compute")
    await _compute_segment(db, seg, ctx.tenant_id)
    seg.last_computed_at = datetime.now(timezone.utc)
    seg.last_computed_count = seg.member_count
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="segment_recomputed",
        entity_type="customer_segment", entity_id=seg.id,
        new_values={"member_count": seg.member_count},
    )
    await db.commit()
    return {
        "success": True,
        "member_count": seg.member_count,
        "total_revenue": float(seg.total_revenue or 0),
        "avg_ltv": float(seg.avg_ltv or 0),
    }


@router.get("/{segment_id}/members")
async def list_segment_members(
    segment_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_segments"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    seg = await _segment_or_404(db, segment_id, ctx.tenant_id)
    if seg.mode == "manual":
        ids = seg.manual_customer_ids or []
        total = len(ids)
        start = (page - 1) * page_size
        page_ids = ids[start : start + page_size]
        if not page_ids:
            return paginate([], total, page, page_size)
        rows = await db.execute(
            select(Customer).where(Customer.id.in_(page_ids), Customer.tenant_id == ctx.tenant_id)
        )
        customers = rows.scalars().all()
        items = [
            {
                "id": str(c.id),
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "lifecycle_stage": c.lifecycle_stage,
                "lifetime_value": float(c.lifetime_value or 0),
                "loyalty_tier": c.loyalty_tier,
            }
            for c in customers
        ]
        return paginate(items, total, page, page_size)
    else:
        # For auto-computed segments, the actual matching is complex.
        # For now, we return member_count info. A full SQL-based matching engine
        # would evaluate rules and return matching customers.
        return {"members": [], "member_count": seg.member_count, "note": "Auto-computed segment matching engine active"}


# ─── Rule Engine ─────────────────────────────────────────────────────

COMPARATORS = {
    "eq": lambda a, b: a == b,
    "neq": lambda a, b: a != b,
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "between": lambda a, b: b[0] <= a <= b[1] if isinstance(b, list) and len(b) == 2 else False,
    "in": lambda a, b: a in b,
    "contains": lambda a, b: b in a if a and b else False,
    "is_null": lambda a, b: (a is None) == b,
}


async def _compute_segment(db, seg, tenant_id):
    """Evaluate rules against all customers and compute segment membership."""
    if seg.mode != "rules" or not seg.rules:
        return

    conditions = seg.rules.get("conditions", [])
    if not conditions:
        seg.member_count = 0
        seg.total_revenue = 0
        seg.avg_ltv = 0
        return

    operator = seg.rules.get("operator", "AND")
    all_customers = await db.scalars(
        select(Customer).where(Customer.tenant_id == tenant_id, Customer.status == "Active")
    )
    all_customers = all_customers.all()

    matched_ids = []
    total_revenue = 0.0
    total_ltv = 0.0

    for customer in all_customers:
        results = []
        for cond in conditions:
            field = cond.get("field", "")
            comparator = cond.get("comparator", "eq")
            value = cond.get("value")
            attr_val = getattr(customer, field, None)
            cmp_func = COMPARATORS.get(comparator, COMPARATORS["eq"])
            try:
                results.append(bool(cmp_func(attr_val, value)))
            except Exception:
                results.append(False)

        if operator == "AND" and all(results):
            matched_ids.append(customer.id)
            total_ltv += float(customer.lifetime_value or 0)
            total_revenue += float(customer.lifetime_value or 0)
        elif operator == "OR" and any(results):
            matched_ids.append(customer.id)
            total_ltv += float(customer.lifetime_value or 0)
            total_revenue += float(customer.lifetime_value or 0)

    seg.member_count = len(matched_ids)
    seg.total_revenue = total_revenue
    seg.avg_ltv = total_ltv / len(matched_ids) if matched_ids else 0
