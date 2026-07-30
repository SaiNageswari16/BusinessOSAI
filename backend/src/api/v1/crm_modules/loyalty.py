"""Loyalty Program backend endpoints."""
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
    CustomerWallet,
    LoyaltyProgram,
    LoyaltyTransaction,
)
from src.schemas.crm import (
    CustomerLoyaltySummary,
    LoyaltyProgramCreate,
    LoyaltyProgramResponse,
    LoyaltyProgramUpdate,
    LoyaltyTransactionCreate,
    LoyaltyTransactionResponse,
)
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.notifications import add_system_notification

router = APIRouter(prefix="/crm/loyalty", tags=["CRM - Loyalty Program"])


# ─── Program CRUD ────────────────────────────────────────────────────

@router.get("/programs", response_model=PaginatedResponse[LoyaltyProgramResponse])
async def list_programs(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
):
    q = select(LoyaltyProgram).where(LoyaltyProgram.tenant_id == ctx.tenant_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(LoyaltyProgram.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [LoyaltyProgramResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)


@router.post("/programs", response_model=LoyaltyProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program(
    payload: LoyaltyProgramCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    program = LoyaltyProgram(tenant_id=ctx.tenant_id, **payload.model_dump())
    db.add(program)
    await db.flush()
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="loyalty_program_created", entity_type="loyalty_program",
        entity_id=program.id, new_values=payload.model_dump(mode="json"),
    )
    await db.commit()
    return program


@router.get("/programs/{program_id}", response_model=LoyaltyProgramResponse)
async def get_program(
    program_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    program = await db.scalar(
        select(LoyaltyProgram).where(LoyaltyProgram.id == program_id, LoyaltyProgram.tenant_id == ctx.tenant_id)
    )
    if not program:
        raise HTTPException(status_code=404, detail="Loyalty program not found")
    return LoyaltyProgramResponse.model_validate(program)


@router.patch("/programs/{program_id}", response_model=LoyaltyProgramResponse)
async def update_program(
    program_id: uuid.UUID,
    payload: LoyaltyProgramUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    program = await db.scalar(
        select(LoyaltyProgram).where(LoyaltyProgram.id == program_id, LoyaltyProgram.tenant_id == ctx.tenant_id)
    )
    if not program:
        raise HTTPException(status_code=404, detail="Loyalty program not found")
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(program, k, v)
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="loyalty_program_updated", entity_type="loyalty_program",
        entity_id=program.id, new_values=updates,
    )
    await db.commit()
    return program


@router.delete("/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    program_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    program = await db.scalar(
        select(LoyaltyProgram).where(LoyaltyProgram.id == program_id, LoyaltyProgram.tenant_id == ctx.tenant_id)
    )
    if not program:
        raise HTTPException(status_code=404, detail="Loyalty program not found")
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="loyalty_program_deleted", entity_type="loyalty_program",
        entity_id=program.id,
    )
    await db.delete(program)
    await db.commit()


# ─── Transaction Processing ──────────────────────────────────────────

def _calculate_tier(points, tier_definitions):
    """Determine the customer's tier based on total points."""
    current = "Bronze"
    for tier in reversed(tier_definitions):
        min_pts = tier.get("min_points", 0)
        if points >= min_pts:
            current = tier["name"]
            break
    return current


def _tier_progress(points, tier_definitions):
    """Calculate % progress toward next tier."""
    for tier in reversed(tier_definitions):
        min_pts = tier.get("min_points", 0)
        max_pts = tier.get("max_points")
        if points >= min_pts:
            if max_pts:
                return min(100.0, ((points - min_pts) / (max_pts - min_pts)) * 100)
            return 100.0
    return 0.0


@router.post("/transactions", response_model=LoyaltyTransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_loyalty_transaction(
    payload: LoyaltyTransactionCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Process a loyalty transaction — earn, redeem, bonus, etc."""
    return await _create_loyalty_transaction(db, ctx, payload)


async def _create_loyalty_transaction(
    db: AsyncSession,
    ctx: CurrentUserContext,
    payload: LoyaltyTransactionCreate,
):
    """Shared loyalty transaction logic."""
    customer = await db.scalar(
        select(Customer).where(Customer.id == payload.customer_id, Customer.tenant_id == ctx.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get active loyalty program
    program = await db.scalar(
        select(LoyaltyProgram).where(
            LoyaltyProgram.tenant_id == ctx.tenant_id,
            LoyaltyProgram.is_active == True,
        )
    )
    if not program:
        raise HTTPException(status_code=400, detail="No active loyalty program found")

    tier_defs = program.tier_definitions or []

    current_balance = customer.loyalty_points_balance or 0
    balance_after = current_balance + payload.points

    if balance_after < 0:
        raise HTTPException(status_code=400, detail="Insufficient loyalty points")

    tier = _calculate_tier(balance_after, tier_defs)
    tier_progress = _tier_progress(balance_after, tier_defs)

    # Update customer
    customer.loyalty_points_balance = balance_after
    customer.loyalty_tier = tier
    customer.loyalty_tier_progress = tier_progress

    tx = LoyaltyTransaction(
        tenant_id=ctx.tenant_id,
        customer_id=payload.customer_id,
        transaction_type=payload.transaction_type,
        points=payload.points,
        balance_after=balance_after,
        tier_at_time=customer.loyalty_tier,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        program_id=program.id,
        description=payload.description,
        expires_at=payload.expires_at,
        initiated_by=ctx.user.id,
    )
    db.add(tx)

    # Update membership tier if applicable
    membership = await db.scalar(
        select(CustomerMembership).where(
            CustomerMembership.tenant_id == ctx.tenant_id,
            CustomerMembership.customer_id == payload.customer_id,
        )
    )
    if membership:
        membership.tier = tier
        membership.tier_progress = tier_progress

    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="loyalty_transaction",
        entity_type="loyalty_transaction", entity_id=tx.id,
        new_values={"points": payload.points, "type": payload.transaction_type},
    )
    await db.commit()
    return tx


# ─── Customer Loyalty Summary ────────────────────────────────────────

@router.get("/customers/{customer_id}", response_model=CustomerLoyaltySummary)
async def get_customer_loyalty(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    customer = await db.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    recent = await db.execute(
        select(LoyaltyTransaction).where(
            LoyaltyTransaction.tenant_id == ctx.tenant_id,
            LoyaltyTransaction.customer_id == customer_id,
        ).order_by(LoyaltyTransaction.created_at.desc()).limit(10)
    )

    tier_defs = []  # Could be fetched from active program

    next_tier = None
    points_to_next = None
    current = customer.loyalty_points_balance or 0
    for tier in tier_defs:
        min_pts = tier.get("min_points", 0)
        max_pts = tier.get("max_points")
        if current >= min_pts:
            if max_pts and current < max_pts:
                next_tier = tier.get("name")
                points_to_next = max_pts - current
            break

    # Calculate totals from transactions
    all_txs = await db.execute(
        select(LoyaltyTransaction).where(
            LoyaltyTransaction.tenant_id == ctx.tenant_id,
            LoyaltyTransaction.customer_id == customer_id,
        )
    )
    lifetime_earned = 0
    lifetime_redeemed = 0
    for tx in all_txs.scalars().all():
        if tx.points > 0:
            lifetime_earned += tx.points
        else:
            lifetime_redeemed += abs(tx.points)

    last_tx = recent.scalars().first()

    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "points_balance": customer.loyalty_points_balance or 0,
        "tier": customer.loyalty_tier,
        "tier_progress": float(customer.loyalty_tier_progress or 0),
        "next_tier": next_tier,
        "points_to_next_tier": points_to_next,
        "lifetime_earned": lifetime_earned,
        "lifetime_redeemed": lifetime_redeemed,
        "last_accrued_at": last_tx.created_at if last_tx and last_tx.points > 0 else None,
        "recent_transactions": [],
    }


@router.get("/customers/{customer_id}/transactions")
async def list_loyalty_transactions(
    customer_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    transaction_type: str | None = None,
):
    customer = await db.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == ctx.tenant_id)
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    q = select(LoyaltyTransaction).where(
        LoyaltyTransaction.tenant_id == ctx.tenant_id,
        LoyaltyTransaction.customer_id == customer_id,
    )
    if transaction_type:
        q = q.where(LoyaltyTransaction.transaction_type == transaction_type)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(LoyaltyTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [LoyaltyTransactionResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)


# ─── Alias endpoints matching frontend routes ────────────────────────

@router.get("/rules", response_model=PaginatedResponse[LoyaltyProgramResponse])
async def list_rules(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    search: str | None = None,
):
    """Alias for /programs — matches frontend route."""
    q = select(LoyaltyProgram).where(LoyaltyProgram.tenant_id == ctx.tenant_id)
    if search:
        term = f"%{search}%"
        q = q.where(or_(LoyaltyProgram.name.ilike(term), LoyaltyProgram.description.ilike(term)))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(LoyaltyProgram.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [LoyaltyProgramResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)


@router.get("/rules/{rule_id}", response_model=LoyaltyProgramResponse)
async def get_rule(
    rule_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Alias for /programs/{program_id} — matches frontend route."""
    program = await db.scalar(
        select(LoyaltyProgram).where(LoyaltyProgram.id == rule_id, LoyaltyProgram.tenant_id == ctx.tenant_id)
    )
    if not program:
        raise HTTPException(status_code=404, detail="Loyalty rule not found")
    return LoyaltyProgramResponse.model_validate(program)


@router.post("/rules/{rule_id}/toggle", response_model=LoyaltyProgramResponse)
async def toggle_rule(
    rule_id: uuid.UUID,
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Alias for /programs/{program_id} PATCH — matches frontend toggle route."""
    program = await db.scalar(
        select(LoyaltyProgram).where(LoyaltyProgram.id == rule_id, LoyaltyProgram.tenant_id == ctx.tenant_id)
    )
    if not program:
        raise HTTPException(status_code=404, detail="Loyalty rule not found")
    is_active = payload.get("is_active")
    if is_active is not None:
        program.is_active = is_active
    await write_audit_log(
        db, tenant_id=ctx.tenant_id, user_id=ctx.user.id,
        module="crm", action="loyalty_rule_toggled", entity_type="loyalty_program",
        entity_id=program.id, new_values={"is_active": is_active},
    )
    await db.commit()
    return LoyaltyProgramResponse.model_validate(program)


@router.post("/points/add", response_model=LoyaltyTransactionResponse, status_code=status.HTTP_201_CREATED)
async def add_points(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Alias for /transactions — add (earn) loyalty points."""
    customer_id = payload.get("customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="customer_id required")
    from uuid import UUID
    tx_payload = LoyaltyTransactionCreate(
        customer_id=UUID(customer_id) if isinstance(customer_id, str) else customer_id,
        transaction_type="manual_credit",
        points=abs(int(payload.get("points", 0))),
        description=payload.get("description") or "Points added",
        reference_type=payload.get("reference_id"),
    )
    return await _create_loyalty_transaction(db, ctx, tx_payload)


@router.post("/points/redeem", response_model=LoyaltyTransactionResponse, status_code=status.HTTP_201_CREATED)
async def redeem_points(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Alias for /transactions — redeem loyalty points."""
    customer_id = payload.get("customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="customer_id required")
    from uuid import UUID
    tx_payload = LoyaltyTransactionCreate(
        customer_id=UUID(customer_id) if isinstance(customer_id, str) else customer_id,
        transaction_type="loyalty_redemption",
        points=-abs(int(payload.get("points", 0))),
        description=payload.get("description") or "Points redeemed",
    )
    return await _create_loyalty_transaction(db, ctx, tx_payload)


@router.get("/transactions", response_model=PaginatedResponse[LoyaltyTransactionResponse])
async def list_transactions(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("view:crm_loyalty"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    customer_id: uuid.UUID | None = None,
    transaction_type: str | None = None,
):
    """Alias for /customers/{customer_id}/transactions — matches frontend route."""
    q = select(LoyaltyTransaction).where(LoyaltyTransaction.tenant_id == ctx.tenant_id)
    if customer_id:
        q = q.where(LoyaltyTransaction.customer_id == customer_id)
    if transaction_type:
        q = q.where(LoyaltyTransaction.transaction_type == transaction_type)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.execute(
        q.order_by(LoyaltyTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [LoyaltyTransactionResponse.model_validate(r) for r in rows.scalars().all()]
    return paginate(items, total or 0, page, page_size)
