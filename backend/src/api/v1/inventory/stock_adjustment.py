import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_any_permission, require_permission, CurrentUserContext
from src.models.inventory import StockAdjustment
from src.schemas.inventory_operations import StockAdjustmentCreate, StockAdjustmentResponse, StockAdjustmentUpdate

router = APIRouter()

@router.get("/", response_model=List[StockAdjustmentResponse])
async def list_stock_adjustments(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(StockAdjustment).where(StockAdjustment.tenant_id == ctx.tenant_id).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{adjustment_id}", response_model=StockAdjustmentResponse)
async def get_stock_adjustment(
    adjustment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(StockAdjustment).where(
        StockAdjustment.id == adjustment_id,
        StockAdjustment.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    adjustment = res.scalar_one_or_none()
    
    if not adjustment:
        raise HTTPException(status_code=404, detail="Stock Adjustment not found")
        
    return adjustment


@router.post("/", response_model=StockAdjustmentResponse)
async def create_stock_adjustment(
    data: StockAdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    new_adjustment = StockAdjustment(
        tenant_id=ctx.tenant_id,
        adjustment_number=data.adjustment_number,
        product_id=data.product_id,
        adjustment_type=data.adjustment_type,
        quantity_changed=data.quantity_changed,
        reason=data.reason,
        status=data.status
    )
    
    db.add(new_adjustment)
    await db.commit()
    await db.refresh(new_adjustment)
    return new_adjustment


@router.delete("/{adjustment_id}")
async def delete_stock_adjustment(
    adjustment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    stmt = select(StockAdjustment).where(
        StockAdjustment.id == adjustment_id,
        StockAdjustment.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    adjustment = res.scalar_one_or_none()
    
    if not adjustment:
        raise HTTPException(status_code=404, detail="Stock Adjustment not found")
        
    await db.delete(adjustment)
    await db.commit()
    return {"status": "success"}
