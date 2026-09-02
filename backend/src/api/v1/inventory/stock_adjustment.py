import uuid
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_any_permission, require_permission, CurrentUserContext
from src.models.inventory import StockAdjustment, StockMovement, Product
from src.schemas.inventory_operations import (
    StockAdjustmentCreate, StockAdjustmentResponse, StockAdjustmentUpdate,
    StockAdjustmentBatchCreate
)

router = APIRouter()

@router.get("/", response_model=List[StockAdjustmentResponse])
async def list_stock_adjustments(
    skip: int = 0,
    limit: int = 150,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))
):
    stmt = (
        select(StockAdjustment)
        .where(StockAdjustment.tenant_id == ctx.tenant_id)
        .order_by(desc(StockAdjustment.created_at))
        .offset(skip)
        .limit(limit)
    )
    res = await db.execute(stmt)
    adjustments = res.scalars().all()
    
    responses = []
    for adj in adjustments:
        prod = await db.get(Product, adj.product_id)
        responses.append(
            StockAdjustmentResponse(
                id=adj.id,
                tenant_id=adj.tenant_id,
                adjustment_number=adj.adjustment_number,
                product_id=adj.product_id,
                product_name=prod.name if prod else "Unknown Product",
                sku=prod.sku if prod else None,
                current_stock=prod.initial_stock if prod else 0,
                adjustment_type=adj.adjustment_type,
                quantity_changed=adj.quantity_changed,
                reason=adj.reason,
                status=adj.status,
                created_at=adj.created_at,
                updated_at=adj.updated_at
            )
        )
    return responses


@router.get("/{adjustment_id}", response_model=StockAdjustmentResponse)
async def get_stock_adjustment(
    adjustment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos", "view:inventory"))
):
    stmt = select(StockAdjustment).where(
        StockAdjustment.id == adjustment_id,
        StockAdjustment.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    adj = res.scalar_one_or_none()
    
    if not adj:
        raise HTTPException(status_code=404, detail="Stock Adjustment not found")
        
    prod = await db.get(Product, adj.product_id)
    return StockAdjustmentResponse(
        id=adj.id,
        tenant_id=adj.tenant_id,
        adjustment_number=adj.adjustment_number,
        product_id=adj.product_id,
        product_name=prod.name if prod else "Unknown Product",
        sku=prod.sku if prod else None,
        current_stock=prod.initial_stock if prod else 0,
        adjustment_type=adj.adjustment_type,
        quantity_changed=adj.quantity_changed,
        reason=adj.reason,
        status=adj.status,
        created_at=adj.created_at,
        updated_at=adj.updated_at
    )


@router.post("/", response_model=StockAdjustmentResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_adjustment(
    data: StockAdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:inventory"))
):
    # 1. Update Product On-Hand Stock in Real Time
    prod = await db.get(Product, data.product_id)
    if not prod or prod.tenant_id != ctx.tenant_id:
        raise HTTPException(status_code=404, detail="Product not found.")

    current_stock = prod.initial_stock if prod.initial_stock is not None else 0
    new_stock = current_stock + data.quantity_changed
    prod.initial_stock = max(0, new_stock) if data.quantity_changed < 0 and abs(data.quantity_changed) > current_stock else new_stock

    # 2. Record Stock Adjustment
    new_adjustment = StockAdjustment(
        tenant_id=ctx.tenant_id,
        adjustment_number=data.adjustment_number,
        product_id=data.product_id,
        adjustment_type=data.adjustment_type,
        quantity_changed=data.quantity_changed,
        reason=data.reason,
        status=data.status or "Completed"
    )
    db.add(new_adjustment)

    # 3. Create StockMovement Entry into Activity Ledger
    is_reduction = data.quantity_changed < 0
    movement = StockMovement(
        tenant_id=ctx.tenant_id,
        movement_number=f"MOV-{data.adjustment_number[-10:]}-{uuid.uuid4().hex[:4].upper()}",
        product_id=data.product_id,
        source_location="Main Warehouse" if is_reduction else "Stock Discovery / Surplus",
        destination_location=f"Write-Off ({data.adjustment_type})" if is_reduction else "Main Warehouse",
        quantity=abs(data.quantity_changed),
        notes=f"Stock Adjustment {data.adjustment_number} ({data.adjustment_type}): {data.reason or 'Physical audit count adjustment'}",
        status="Completed"
    )
    db.add(movement)

    await db.commit()
    await db.refresh(new_adjustment)

    return StockAdjustmentResponse(
        id=new_adjustment.id,
        tenant_id=new_adjustment.tenant_id,
        adjustment_number=new_adjustment.adjustment_number,
        product_id=new_adjustment.product_id,
        product_name=prod.name,
        sku=prod.sku,
        current_stock=prod.initial_stock,
        adjustment_type=new_adjustment.adjustment_type,
        quantity_changed=new_adjustment.quantity_changed,
        reason=new_adjustment.reason,
        status=new_adjustment.status,
        created_at=new_adjustment.created_at,
        updated_at=new_adjustment.updated_at
    )


@router.post("/batch", response_model=List[StockAdjustmentResponse], status_code=status.HTTP_201_CREATED)
async def create_stock_adjustments_batch(
    payload: StockAdjustmentBatchCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:inventory"))
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items provided in batch adjustment.")

    created_adjustments = []
    warehouse_name = payload.warehouse or "Main Warehouse"

    for item in payload.items:
        prod = await db.get(Product, item.product_id)
        if not prod or prod.tenant_id != ctx.tenant_id:
            continue

        # 1. Update Product On-Hand Stock
        current_stock = prod.initial_stock if prod.initial_stock is not None else 0
        new_stock = current_stock + item.quantity_changed
        prod.initial_stock = max(0, new_stock) if item.quantity_changed < 0 and abs(item.quantity_changed) > current_stock else new_stock

        # 2. Record Stock Adjustment
        adj_type = item.adjustment_type or payload.adjustment_type or "Write-Off"
        adj = StockAdjustment(
            tenant_id=ctx.tenant_id,
            adjustment_number=payload.adjustment_number,
            product_id=item.product_id,
            adjustment_type=adj_type,
            quantity_changed=item.quantity_changed,
            reason=item.reason or payload.reason,
            status="Completed"
        )
        db.add(adj)

        # 3. Create StockMovement Entry into Activity Ledger
        is_reduction = item.quantity_changed < 0
        movement = StockMovement(
            tenant_id=ctx.tenant_id,
            movement_number=f"MOV-{payload.adjustment_number[-10:]}-{uuid.uuid4().hex[:4].upper()}",
            product_id=item.product_id,
            source_location=f"{warehouse_name}" if is_reduction else "Stock Discovery / Surplus",
            destination_location=f"Write-Off ({adj_type})" if is_reduction else f"{warehouse_name}",
            quantity=abs(item.quantity_changed),
            notes=f"Batch Adjustment {payload.adjustment_number} ({adj_type}): {item.reason or payload.reason or 'Physical count audit variance'}",
            status="Completed"
        )
        db.add(movement)
        created_adjustments.append((adj, prod))

    await db.commit()

    responses = []
    for adj, prod in created_adjustments:
        await db.refresh(adj)
        responses.append(
            StockAdjustmentResponse(
                id=adj.id,
                tenant_id=adj.tenant_id,
                adjustment_number=adj.adjustment_number,
                product_id=adj.product_id,
                product_name=prod.name,
                sku=prod.sku,
                current_stock=prod.initial_stock,
                adjustment_type=adj.adjustment_type,
                quantity_changed=adj.quantity_changed,
                reason=adj.reason,
                status=adj.status,
                created_at=adj.created_at,
                updated_at=adj.updated_at
            )
        )
    return responses


@router.delete("/{adjustment_id}")
async def delete_stock_adjustment(
    adjustment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:inventory"))
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
