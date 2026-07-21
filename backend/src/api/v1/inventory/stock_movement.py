import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_any_permission, require_permission, CurrentUserContext
from src.models.inventory import StockMovement
from src.schemas.inventory_operations import StockMovementCreate, StockMovementResponse, StockMovementUpdate

router = APIRouter()

@router.get("/", response_model=List[StockMovementResponse])
async def list_stock_movements(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(StockMovement).where(StockMovement.tenant_id == ctx.tenant_id).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{movement_id}", response_model=StockMovementResponse)
async def get_stock_movement(
    movement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(StockMovement).where(
        StockMovement.id == movement_id,
        StockMovement.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    movement = res.scalar_one_or_none()
    
    if not movement:
        raise HTTPException(status_code=404, detail="Stock Movement not found")
        
    return movement


@router.post("/", response_model=StockMovementResponse)
async def create_stock_movement(
    data: StockMovementCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    new_movement = StockMovement(
        tenant_id=ctx.tenant_id,
        movement_number=data.movement_number,
        product_id=data.product_id,
        source_location=data.source_location,
        destination_location=data.destination_location,
        quantity=data.quantity,
        notes=data.notes,
        status=data.status
    )
    
    db.add(new_movement)
    await db.commit()
    await db.refresh(new_movement)
    return new_movement


@router.delete("/{movement_id}")
async def delete_stock_movement(
    movement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    stmt = select(StockMovement).where(
        StockMovement.id == movement_id,
        StockMovement.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    movement = res.scalar_one_or_none()
    
    if not movement:
        raise HTTPException(status_code=404, detail="Stock Movement not found")
        
    await db.delete(movement)
    await db.commit()
    return {"status": "success"}
