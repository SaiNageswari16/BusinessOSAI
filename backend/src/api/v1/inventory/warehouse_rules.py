from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Annotated

from src.database.session import get_db
from src.models.inventory import PutAwayRule, PickingRule
from src.schemas.warehouse import (
    PutAwayRuleCreate, PutAwayRuleUpdate, PutAwayRuleResponse,
    PickingRuleCreate, PickingRuleUpdate, PickingRuleResponse,
)
from src.api.deps import CurrentUserContext, require_any_permission, require_permission

router = APIRouter()


# ─── Put-Away Rules ───────────────────────────────────────────────────

@router.get("/put-away-rules", response_model=List[PutAwayRuleResponse])
async def list_put_away_rules(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PutAwayRule)
        .where(PutAwayRule.tenant_id == ctx.tenant_id)
        .order_by(PutAwayRule.priority.asc(), PutAwayRule.created_at.desc())
    )
    return result.scalars().all()


@router.post("/put-away-rules", response_model=PutAwayRuleResponse)
async def create_put_away_rule(
    rule_in: PutAwayRuleCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    rule = PutAwayRule(**rule_in.model_dump(), tenant_id=ctx.tenant_id)
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/put-away-rules/{rule_id}", response_model=PutAwayRuleResponse)
async def get_put_away_rule(
    rule_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PutAwayRule).where(
            PutAwayRule.id == rule_id,
            PutAwayRule.tenant_id == ctx.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Put-away rule not found")
    return rule


@router.patch("/put-away-rules/{rule_id}", response_model=PutAwayRuleResponse)
async def update_put_away_rule(
    rule_id: str,
    rule_in: PutAwayRuleUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PutAwayRule).where(
            PutAwayRule.id == rule_id,
            PutAwayRule.tenant_id == ctx.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Put-away rule not found")

    for k, v in rule_in.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)

    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/put-away-rules/{rule_id}")
async def delete_put_away_rule(
    rule_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PutAwayRule).where(
            PutAwayRule.id == rule_id,
            PutAwayRule.tenant_id == ctx.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Put-away rule not found")

    await db.delete(rule)
    await db.commit()
    return {"message": "Put-away rule deleted"}


# ─── Picking Rules ───────────────────────────────────────────────────

@router.get("/picking-rules", response_model=List[PickingRuleResponse])
async def list_picking_rules(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PickingRule)
        .where(PickingRule.tenant_id == ctx.tenant_id)
        .order_by(PickingRule.created_at.desc())
    )
    return result.scalars().all()


@router.post("/picking-rules", response_model=PickingRuleResponse)
async def create_picking_rule(
    rule_in: PickingRuleCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    rule = PickingRule(**rule_in.model_dump(), tenant_id=ctx.tenant_id)
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/picking-rules/{rule_id}", response_model=PickingRuleResponse)
async def get_picking_rule(
    rule_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PickingRule).where(
            PickingRule.id == rule_id,
            PickingRule.tenant_id == ctx.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Picking rule not found")
    return rule


@router.patch("/picking-rules/{rule_id}", response_model=PickingRuleResponse)
async def update_picking_rule(
    rule_id: str,
    rule_in: PickingRuleUpdate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PickingRule).where(
            PickingRule.id == rule_id,
            PickingRule.tenant_id == ctx.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Picking rule not found")

    for k, v in rule_in.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)

    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/picking-rules/{rule_id}")
async def delete_picking_rule(
    rule_id: str,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PickingRule).where(
            PickingRule.id == rule_id,
            PickingRule.tenant_id == ctx.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Picking rule not found")

    await db.delete(rule)
    await db.commit()
    return {"message": "Picking rule deleted"}
