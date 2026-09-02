import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_any_permission, require_permission, CurrentUserContext
from src.models.inventory import StockMovement, Product
from src.schemas.inventory_operations import StockMovementCreate, StockMovementResponse, StockMovementUpdate

router = APIRouter()

@router.get("/", response_model=List[StockMovementResponse])
async def list_stock_movements(
    skip: int = 0,
    limit: int = 150,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))
):
    stmt = (
        select(StockMovement)
        .where(StockMovement.tenant_id == ctx.tenant_id)
        .order_by(desc(StockMovement.created_at))
        .offset(skip)
        .limit(limit)
    )
    res = await db.execute(stmt)
    movements = res.scalars().all()
    
    responses = []
    for mov in movements:
        prod = await db.get(Product, mov.product_id)
        responses.append(
            StockMovementResponse(
                id=mov.id,
                tenant_id=mov.tenant_id,
                movement_number=mov.movement_number,
                product_id=mov.product_id,
                product_name=prod.name if prod else "Unknown Product",
                sku=prod.sku if prod else None,
                source_location=mov.source_location,
                destination_location=mov.destination_location,
                quantity=mov.quantity,
                notes=mov.notes,
                status=mov.status,
                created_at=mov.created_at,
                updated_at=mov.updated_at
            )
        )
    return responses


@router.get("/{movement_id}", response_model=StockMovementResponse)
async def get_stock_movement(
    movement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))
):
    stmt = select(StockMovement).where(
        StockMovement.id == movement_id,
        StockMovement.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    movement = res.scalar_one_or_none()
    
    if not movement:
        raise HTTPException(status_code=404, detail="Stock Movement not found")
        
    prod = await db.get(Product, movement.product_id)
    return StockMovementResponse(
        id=movement.id,
        tenant_id=movement.tenant_id,
        movement_number=movement.movement_number,
        product_id=movement.product_id,
        product_name=prod.name if prod else "Unknown Product",
        sku=prod.sku if prod else None,
        source_location=movement.source_location,
        destination_location=movement.destination_location,
        quantity=movement.quantity,
        notes=movement.notes,
        status=movement.status,
        created_at=movement.created_at,
        updated_at=movement.updated_at
    )


@router.post("/", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_movement(
    data: StockMovementCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:inventory"))
):
    new_movement = StockMovement(
        tenant_id=ctx.tenant_id,
        movement_number=data.movement_number,
        product_id=data.product_id,
        source_location=data.source_location,
        destination_location=data.destination_location,
        quantity=data.quantity,
        notes=data.notes,
        status=data.status or "Completed"
    )
    
    db.add(new_movement)
    await db.commit()
    await db.refresh(new_movement)
    
    prod = await db.get(Product, new_movement.product_id)
    return StockMovementResponse(
        id=new_movement.id,
        tenant_id=new_movement.tenant_id,
        movement_number=new_movement.movement_number,
        product_id=new_movement.product_id,
        product_name=prod.name if prod else "Unknown Product",
        sku=prod.sku if prod else None,
        source_location=new_movement.source_location,
        destination_location=new_movement.destination_location,
        quantity=new_movement.quantity,
        notes=new_movement.notes,
        status=new_movement.status,
        created_at=new_movement.created_at,
        updated_at=new_movement.updated_at
    )


@router.delete("/{movement_id}")
async def delete_stock_movement(
    movement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:inventory"))
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
