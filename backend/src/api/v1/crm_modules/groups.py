"""Customer Groups backend endpoints."""
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
    CustomerGroup,
    CustomerGroupMember,
    User,
)
from src.schemas.crm import (
    CustomerGroupCreate,
    CustomerGroupResponse,
    CustomerGroupUpdate,
    GroupMemberAdd,
    GroupMemberRemove,
)
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.notifications import add_system_notification

router = APIRouter(prefix="/crm/groups", tags=["CRM - Customer Groups"])


async def _group_or_404(db: AsyncSession, group_id: uuid.UUID, tenant_id: uuid.UUID) -> CustomerGroup:
    group = await db.scalar(
        select(CustomerGroup).where(CustomerGroup.id == group_id, CustomerGroup.tenant_id == tenant_id)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Customer group not found")
    return group


# ─── CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[CustomerGroupResponse])
async def list_groups(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_groups"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str | None = None,
    status_filter: str | None = None,
):
    q = select(CustomerGroup).where(CustomerGroup.tenant_id == ctx.tenant_id)
    if search:
        term = f"%{search}%"
        q = q.where(or_(CustomerGroup.name.ilike(term), CustomerGroup.description.ilike(term)))
    if status_filter:
        q = q.where(CustomerGroup.status == status_filter)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(CustomerGroup.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [CustomerGroupResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)


@router.post("", response_model=CustomerGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: CustomerGroupCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_groups"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = CustomerGroup(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(group)
    await db.flush()
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="group_created", entity_type="customer_group",
        entity_id=group.id, new_values=payload.model_dump(mode="json"),
    )
    await db.commit()
    return group


@router.get("/{group_id}", response_model=CustomerGroupResponse)
async def get_group(
    group_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_groups"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await _group_or_404(db, group_id, ctx.tenant_id)
    return CustomerGroupResponse.model_validate(group)


@router.patch("/{group_id}", response_model=CustomerGroupResponse)
async def update_group(
    group_id: uuid.UUID,
    payload: CustomerGroupUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_groups"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await _group_or_404(db, group_id, ctx.tenant_id)
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(group, k, v)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="group_updated", entity_type="customer_group",
        entity_id=group.id, new_values=updates,
    )
    await db.commit()
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_groups"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await _group_or_404(db, group_id, ctx.tenant_id)
    if group.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete a system group")
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="group_deleted", entity_type="customer_group",
        entity_id=group.id,
    )
    await db.delete(group)
    await db.commit()


# ─── Membership Management ───────────────────────────────────────────

@router.post("/{group_id}/members")
async def add_members(
    group_id: uuid.UUID,
    payload: GroupMemberAdd,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_groups"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await _group_or_404(db, group_id, ctx.tenant_id)
    added = 0
    for cid in payload.customer_ids:
        existing = await db.scalar(
            select(CustomerGroupMember).where(
                CustomerGroupMember.group_id == group_id,
                CustomerGroupMember.customer_id == cid,
            )
        )
        if existing:
            continue
        customer = await db.scalar(select(Customer).where(Customer.id == cid, Customer.tenant_id == ctx.tenant_id))
        if not customer:
            continue
        member = CustomerGroupMember(
            group_id=group_id,
            customer_id=cid,
            added_by=ctx.user.id,
            reason=payload.reason,
        )
        db.add(member)
        added += 1
    group.member_count = await db.scalar(
        select(func.count()).where(CustomerGroupMember.group_id == group_id)
    )
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="group_members_added",
        entity_type="customer_group", entity_id=group_id,
        new_values={"count": added},
    )
    await db.commit()
    return {"added": added}


@router.delete("/{group_id}/members")
async def remove_members(
    group_id: uuid.UUID,
    payload: GroupMemberRemove,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_groups"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    group = await _group_or_404(db, group_id, ctx.tenant_id)
    removed = 0
    for cid in payload.customer_ids:
        result = await db.execute(
            select(CustomerGroupMember).where(
                CustomerGroupMember.group_id == group_id,
                CustomerGroupMember.customer_id == cid,
            )
        )
        member = result.scalar_one_or_none()
        if member:
            await db.delete(member)
            removed += 1
    group.member_count = await db.scalar(
        select(func.count()).where(CustomerGroupMember.group_id == group_id)
    )
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="group_members_removed",
        entity_type="customer_group", entity_id=group_id,
        new_values={"count": removed},
    )
    await db.commit()
    return {"removed": removed}


@router.get("/{group_id}/members")
async def list_group_members(
    group_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_groups"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    await _group_or_404(db, group_id, ctx.tenant_id)
    q = (
        select(CustomerGroupMember, Customer)
        .join(Customer, CustomerGroupMember.customer_id == Customer.id)
        .where(CustomerGroupMember.group_id == group_id)
    )
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(CustomerGroupMember.joined_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for member, customer in rows:
        items.append({
            "member_id": str(member.id),
            "joined_at": member.joined_at.isoformat(),
            "reason": member.reason,
            "customer": {
                "id": str(customer.id),
                "name": customer.name,
                "email": customer.email,
                "phone": customer.phone,
                "customer_type": customer.customer_type,
                "lifecycle_stage": customer.lifecycle_stage,
                "lifetime_value": float(customer.lifetime_value or 0),
            },
        })
    return paginate(items, total or 0, page, page_size)
