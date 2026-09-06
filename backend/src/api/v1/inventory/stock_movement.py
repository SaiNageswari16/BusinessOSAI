import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_any_permission, require_permission, CurrentUserContext
from src.models.inventory import StockMovement, Product, Warehouse
from src.models import Company
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
    )
    if ctx.active_company_id:
        stmt = stmt.where(
            or_(
                StockMovement.company_id == ctx.active_company_id,
                StockMovement.source_company_id == ctx.active_company_id,
                StockMovement.target_company_id == ctx.active_company_id,
                StockMovement.company_id == None
            )
        )
    stmt = stmt.order_by(desc(StockMovement.created_at)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    movements = res.scalars().all()
    
    # Pre-cache company and warehouse names
    comp_res = await db.execute(select(Company).where(Company.tenant_id == ctx.tenant_id))
    companies = {c.id: c.name for c in comp_res.scalars().all()}
    
    wh_res = await db.execute(select(Warehouse).where(Warehouse.tenant_id == ctx.tenant_id))
    warehouses = {w.id: w.name for w in wh_res.scalars().all()}
    
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
                company_id=mov.company_id,
                source_company_id=mov.source_company_id,
                target_company_id=mov.target_company_id,
                source_warehouse_id=mov.source_warehouse_id,
                target_warehouse_id=mov.target_warehouse_id,
                source_company_name=companies.get(mov.source_company_id) if mov.source_company_id else None,
                target_company_name=companies.get(mov.target_company_id) if mov.target_company_id else None,
                source_warehouse_name=warehouses.get(mov.source_warehouse_id) if mov.source_warehouse_id else None,
                target_warehouse_name=warehouses.get(mov.target_warehouse_id) if mov.target_warehouse_id else None,
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
    comp_res = await db.execute(select(Company).where(Company.tenant_id == ctx.tenant_id))
    companies = {c.id: c.name for c in comp_res.scalars().all()}
    
    wh_res = await db.execute(select(Warehouse).where(Warehouse.tenant_id == ctx.tenant_id))
    warehouses = {w.id: w.name for w in wh_res.scalars().all()}

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
        company_id=movement.company_id,
        source_company_id=movement.source_company_id,
        target_company_id=movement.target_company_id,
        source_warehouse_id=movement.source_warehouse_id,
        target_warehouse_id=movement.target_warehouse_id,
        source_company_name=companies.get(movement.source_company_id) if movement.source_company_id else None,
        target_company_name=companies.get(movement.target_company_id) if movement.target_company_id else None,
        source_warehouse_name=warehouses.get(movement.source_warehouse_id) if movement.source_warehouse_id else None,
        target_warehouse_name=warehouses.get(movement.target_warehouse_id) if movement.target_warehouse_id else None,
        created_at=movement.created_at,
        updated_at=movement.updated_at
    )


@router.post("/", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_movement(
    data: StockMovementCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:inventory"))
):
    source_cid = data.source_company_id or ctx.active_company_id
    target_cid = data.target_company_id or source_cid
    
    source_prod = await db.get(Product, data.product_id)
    if not source_prod:
        raise HTTPException(status_code=404, detail="Source product not found")

    # If it's a cross-workspace transfer or normal transfer, adjust source stock
    if source_prod.initial_stock is not None:
        source_prod.initial_stock = max(0, source_prod.initial_stock - data.quantity)

    # If cross-workspace transfer, ensure destination company receives stock
    if target_cid and source_cid and str(target_cid) != str(source_cid):
        # Look for matching product in target company by SKU or Name
        target_prod_stmt = select(Product).where(
            Product.tenant_id == ctx.tenant_id,
            Product.company_id == target_cid,
            or_(Product.sku == source_prod.sku, Product.name == source_prod.name)
        )
        target_prod_res = await db.execute(target_prod_stmt)
        target_prod = target_prod_res.scalar_one_or_none()
        
        if target_prod:
            target_prod.initial_stock = (target_prod.initial_stock or 0) + data.quantity
        else:
            # Replicate product in target workspace
            target_prod = Product(
                tenant_id=ctx.tenant_id,
                company_id=target_cid,
                name=source_prod.name,
                sku=f"{source_prod.sku}-W2" if source_prod.sku else f"SKU-{uuid.uuid4().hex[:6].upper()}",
                category_id=source_prod.category_id,
                brand_id=source_prod.brand_id,
                unit_of_measure_id=source_prod.unit_of_measure_id,
                selling_price=source_prod.selling_price,
                cost_price=source_prod.cost_price,
                initial_stock=data.quantity,
                reorder_level=source_prod.reorder_level,
                barcode=source_prod.barcode,
                status=source_prod.status or "Active",
                description=f"Transferred from workspace stock ({data.movement_number})"
            )
            db.add(target_prod)

    new_movement = StockMovement(
        tenant_id=ctx.tenant_id,
        company_id=source_cid,
        source_company_id=source_cid,
        target_company_id=target_cid,
        source_warehouse_id=data.source_warehouse_id,
        target_warehouse_id=data.target_warehouse_id,
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
    comp_res = await db.execute(select(Company).where(Company.tenant_id == ctx.tenant_id))
    companies = {c.id: c.name for c in comp_res.scalars().all()}
    
    wh_res = await db.execute(select(Warehouse).where(Warehouse.tenant_id == ctx.tenant_id))
    warehouses = {w.id: w.name for w in wh_res.scalars().all()}

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
        company_id=new_movement.company_id,
        source_company_id=new_movement.source_company_id,
        target_company_id=new_movement.target_company_id,
        source_warehouse_id=new_movement.source_warehouse_id,
        target_warehouse_id=new_movement.target_warehouse_id,
        source_company_name=companies.get(new_movement.source_company_id) if new_movement.source_company_id else None,
        target_company_name=companies.get(new_movement.target_company_id) if new_movement.target_company_id else None,
        source_warehouse_name=warehouses.get(new_movement.source_warehouse_id) if new_movement.source_warehouse_id else None,
        target_warehouse_name=warehouses.get(new_movement.target_warehouse_id) if new_movement.target_warehouse_id else None,
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
