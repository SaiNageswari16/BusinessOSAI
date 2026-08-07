from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from src.database.session import get_db
from src.models.inventory import Warehouse, StorageLocation
from src.schemas.warehouse import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    StorageLocationCreate, StorageLocationUpdate, StorageLocationResponse
)
from typing import Annotated
from src.api.deps import CurrentUserContext, require_any_permission, require_permission

router = APIRouter()

@router.get("/warehouses", response_model=List[WarehouseResponse])
async def get_warehouses(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Warehouse)
        .where(Warehouse.tenant_id == ctx.tenant_id)
        .options(selectinload(Warehouse.locations))
        .order_by(Warehouse.created_at.desc())
    )
    return result.scalars().all()

@router.post("/warehouses", response_model=WarehouseResponse)
async def create_warehouse(
    warehouse_in: WarehouseCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db)
):
    warehouse = Warehouse(
        **warehouse_in.model_dump(),
        tenant_id=ctx.tenant_id
    )
    db.add(warehouse)
    await db.commit()

    result = await db.execute(
        select(Warehouse)
        .where(Warehouse.id == warehouse.id)
        .options(selectinload(Warehouse.locations))
    )
    return result.scalar_one()

@router.delete("/warehouses/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Warehouse).where(
            Warehouse.id == warehouse_id,
            Warehouse.tenant_id == ctx.tenant_id
        )
    )
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
        
    await db.delete(warehouse)
    await db.commit()
    return {"message": "Warehouse deleted successfully"}

# --- Storage Locations ---

@router.get("/locations", response_model=List[StorageLocationResponse])
async def get_storage_locations(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StorageLocation)
        .where(StorageLocation.tenant_id == ctx.tenant_id)
        .order_by(StorageLocation.created_at.desc())
    )
    return result.scalars().all()

@router.post("/warehouses/{warehouse_id}/locations", response_model=StorageLocationResponse)
async def create_storage_location(
    warehouse_id: UUID,
    location_in: StorageLocationCreate,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db)
):
    location = StorageLocation(
        **location_in.model_dump(),
        warehouse_id=warehouse_id,
        tenant_id=ctx.tenant_id
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location

@router.delete("/locations/{location_id}")
async def delete_storage_location(
    location_id: UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StorageLocation).where(
            StorageLocation.id == location_id,
            StorageLocation.tenant_id == ctx.tenant_id
        )
    )
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Storage location not found")
        
    await db.delete(location)
    await db.commit()
    return {"message": "Storage location deleted successfully"}
