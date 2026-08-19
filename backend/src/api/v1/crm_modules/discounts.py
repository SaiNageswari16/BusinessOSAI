"""Discounts backend endpoints."""
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
    CustomerSegment,
    CustomerWallet,
    Discount,
    MembershipPlan,
)
from src.schemas.crm import (
    DiscountCreate,
    DiscountResponse,
    DiscountUpdate,
    DiscountValidateRequest,
    DiscountValidateResponse,
)
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.notifications import add_system_notification

router = APIRouter(prefix="/crm/discounts", tags=["CRM - Discounts"])


async def _discount_or_404(db, discount_id, tenant_id):
    d = await db.scalar(
        select(Discount).where(Discount.id == discount_id, Discount.tenant_id == tenant_id)
    )
    if not d:
        raise HTTPException(status_code=404, detail="Discount not found")
    return d


# ─── CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse[DiscountResponse])
async def list_discounts(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_discounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str | None = None,
    status_filter: str | None = None,
    active_only: bool = False,
):
    q = select(Discount).where(Discount.tenant_id == ctx.tenant_id)
    if search:
        term = f"%{search}%"
        q = q.where(or_(Discount.name.ilike(term), Discount.code.ilike(term)))
    if status_filter:
        q = q.where(Discount.status == status_filter)
    if active_only:
        q = q.where(Discount.status == "Active")
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(Discount.priority.desc(), Discount.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [DiscountResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)


@router.get("/lookup/{code}")
async def lookup_discount_by_code(
    code: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_discounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Quick lookup of a discount by its coupon code."""
    d = await db.scalar(
        select(Discount).where(
            Discount.tenant_id == ctx.tenant_id,
            Discount.code == code,
        )
    )
    if not d:
        raise HTTPException(status_code=404, detail="Discount code not found")
    return DiscountResponse.model_validate(d)


@router.post("", response_model=DiscountResponse, status_code=status.HTTP_201_CREATED)
async def create_discount(
    payload: DiscountCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_discounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    discount = Discount(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(discount)
    await db.flush()
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="discount_created", entity_type="discount",
        entity_id=discount.id, new_values=payload.model_dump(mode="json"),
    )
    await db.commit()
    return discount


@router.get("/{discount_id}", response_model=DiscountResponse)
async def get_discount(
    discount_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_discounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    discount = await _discount_or_404(db, discount_id, ctx.tenant_id)
    return DiscountResponse.model_validate(discount)


@router.patch("/{discount_id}", response_model=DiscountResponse)
async def update_discount(
    discount_id: uuid.UUID,
    payload: DiscountUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_discounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    discount = await _discount_or_404(db, discount_id, ctx.tenant_id)
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(discount, k, v)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="discount_updated", entity_type="discount",
        entity_id=discount.id, new_values=updates,
    )
    await db.commit()
    return discount


@router.delete("/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_discount(
    discount_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_discounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    discount = await _discount_or_404(db, discount_id, ctx.tenant_id)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="discount_deleted", entity_type="discount",
        entity_id=discount.id,
    )
    await db.delete(discount)
    await db.commit()


# ─── Discount Validation ─────────────────────────────────────────────

@router.post("/validate", response_model=DiscountValidateResponse)
async def validate_discount(
    payload: DiscountValidateRequest,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_discounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Validate a discount code against customer/order context and compute the discount amount."""
    now = date.today()

    # 1. Find discount
    discount = await db.scalar(
        select(Discount).where(
            Discount.tenant_id == ctx.tenant_id,
            Discount.code == payload.code,
        )
    )
    if not discount:
        return DiscountValidateResponse(valid=False, reason="Discount code not found", discount_amount=0, final_amount=payload.order_amount)

    # 2. Status check
    if discount.status != "Active":
        return DiscountValidateResponse(valid=False, reason=f"Discount is {discount.status.lower()}", discount_amount=0, final_amount=payload.order_amount)

    # 3. Validity period
    if discount.valid_from and now < discount.valid_from:
        return DiscountValidateResponse(valid=False, reason="Discount not yet active", discount_amount=0, final_amount=payload.order_amount)
    if discount.valid_until and now > discount.valid_until:
        return DiscountValidateResponse(valid=False, reason="Discount has expired", discount_amount=0, final_amount=payload.order_amount)

    # 4. Channel check
    if payload.channel and discount.applicable_channels and payload.channel not in [c.lower() for c in discount.applicable_channels]:
        return DiscountValidateResponse(valid=False, reason="Not valid for this channel", discount_amount=0, final_amount=payload.order_amount)

    # 5. Minimum order
    if discount.min_order_amount and payload.order_amount < discount.min_order_amount:
        return DiscountValidateResponse(valid=False, reason=f"Minimum order amount is {discount.min_order_amount}", discount_amount=0, final_amount=payload.order_amount)

    # 6. Per-customer usage
    if payload.customer_id and discount.usage_limit_per_customer:
        usage = discount.used_customer_ids or []
        customer_usage = sum(1 for uid in usage if str(uid) == str(payload.customer_id))
        if customer_usage >= discount.usage_limit_per_customer:
            return DiscountValidateResponse(valid=False, reason="Usage limit reached for this customer", discount_amount=0, final_amount=payload.order_amount)

    # 7. Global usage
    if discount.usage_limit_total and discount.used_count >= discount.usage_limit_total:
        return DiscountValidateResponse(valid=False, reason="Discount has reached its global usage limit", discount_amount=0, final_amount=payload.order_amount)

    # 8. Target matching
    if payload.customer_id and discount.applies_to != "all_customers":
        target_ids = discount.target_customer_ids or []
        target_groups = discount.target_group_ids or []
        target_segments = discount.target_segment_ids or []
        target_memberships = discount.target_membership_ids or []

        in_target = False
        if str(payload.customer_id) in [str(x) for x in target_ids]:
            in_target = True
        else:
            # Check group membership
            group_memberships = await db.scalar(
                select(func.count()).select_from(
                    select(CustomerGroupMember).where(
                        CustomerGroupMember.customer_id == payload.customer_id,
                        CustomerGroupMember.group_id.in_(target_groups),
                    ).subquery()
                )
            )
            if group_memberships > 0:
                in_target = True
            else:
                # Check segment membership
                for seg_id in target_segments:
                    seg = await db.scalar(
                        select(CustomerSegment).where(CustomerSegment.id == seg_id)
                    )
                    if seg and seg.mode == "manual" and str(payload.customer_id) in [str(x) for x in (seg.manual_customer_ids or [])]:
                        in_target = True
                        break
                    elif seg and seg.mode == "rules":
                        # For auto-computed, check if customer matches (simplified)
                        # Full rule evaluation would go here
                        in_target = True  # Assume member for now

                # Check membership
                if not in_target:
                    membership = await db.scalar(
                        select(CustomerMembership).where(
                            CustomerMembership.customer_id == payload.customer_id,
                            CustomerMembership.plan_id.in_(target_memberships),
                            CustomerMembership.status == "Active",
                        )
                    )
                    if membership:
                        in_target = True

        if not in_target:
            return DiscountValidateResponse(valid=False, reason="Discount does not apply to this customer", discount_amount=0, final_amount=payload.order_amount)

    # Compute discount amount
    discount_amount = 0.0
    if discount.discount_type == "percentage":
        discount_amount = payload.order_amount * (discount.value / 100)
        if discount.max_discount_amount:
            discount_amount = min(discount_amount, discount.max_discount_amount)
    elif discount.discount_type == "fixed_amount":
        discount_amount = min(discount.value, payload.order_amount)
    elif discount.discount_type == "free_shipping":
        discount_amount = 0  # Handled separately

    final_amount = max(0, payload.order_amount - discount_amount)

    return DiscountValidateResponse(
        valid=True,
        discount=DiscountResponse.model_validate(discount),
        discount_amount=round(discount_amount, 2),
        final_amount=round(final_amount, 2),
    )


@router.post("/apply/{discount_id}")
async def apply_discount(
    discount_id: uuid.UUID,
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_discounts"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    order_amount: float = 0,
):
    """Apply a discount to a customer's wallet (for cashback/refund style discounts)."""
    discount = await _discount_or_404(db, discount_id, ctx.tenant_id)

    # Validate
    result = await validate_discount(
        DiscountValidateRequest(
            code=discount.code,
            customer_id=customer_id,
            order_amount=order_amount,
        ),
        ctx,
        db,
    )
    if not result.valid:
        raise HTTPException(status_code=400, detail=result.reason)

    # Record usage
    if discount.used_customer_ids is None:
        discount.used_customer_ids = []
    if str(customer_id) not in [str(x) for x in discount.used_customer_ids]:
        discount.used_customer_ids.append(str(customer_id))
    discount.used_count += 1

    # If cashback type, credit wallet
    if discount.discount_type in {"cashback", "promotion"} and result.discount_amount > 0:
        customer = await db.scalar(
            select(Customer).where(Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id)
        )
        if customer:
            wallet = await db.scalar(
                select(CustomerWallet).where(
                    CustomerWallet.tenant_id == ctx.tenant_id,
                    CustomerWallet.customer_id == customer_id,
                )
            )
            if not wallet:
                wallet = CustomerWallet(tenant_id=ctx.tenant_id, customer_id=customer_id)
                db.add(wallet)
                await db.flush()
            wallet.balance = (wallet.balance or 0.0) + result.discount_amount

    await db.commit()
    return {"success": True, "discount_amount": result.discount_amount, "final_amount": result.final_amount}
