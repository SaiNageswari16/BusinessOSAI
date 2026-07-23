import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_db, require_any_permission, require_permission, CurrentUserContext
from src.models.inventory import CycleCount, CycleCountItem
from src.schemas.inventory_operations import CycleCountCreate, CycleCountResponse, CycleCountUpdate

router = APIRouter()

@router.get("/", response_model=List[CycleCountResponse])
async def list_cycle_counts(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(CycleCount).where(CycleCount.tenant_id == ctx.tenant_id).options(selectinload(CycleCount.items)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{count_id}", response_model=CycleCountResponse)
async def get_cycle_count(
    count_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos"))
):
    stmt = select(CycleCount).where(
        CycleCount.id == count_id,
        CycleCount.tenant_id == ctx.tenant_id
    ).options(selectinload(CycleCount.items))
    res = await db.execute(stmt)
    count_record = res.scalar_one_or_none()
    
    if not count_record:
        raise HTTPException(status_code=404, detail="Cycle Count not found")
        
    return count_record


@router.post("/", response_model=CycleCountResponse)
async def create_cycle_count(
    data: CycleCountCreate,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    new_count = CycleCount(
        tenant_id=ctx.tenant_id,
        count_number=data.count_number,
        location=data.location,
        auditor=data.auditor,
        notes=data.notes,
        status=data.status
    )
    
    if data.items:
        for item in data.items:
            new_item = CycleCountItem(
                tenant_id=ctx.tenant_id,
                product_id=item.product_id,
                system_quantity=item.system_quantity,
                counted_quantity=item.counted_quantity,
                variance=item.variance
            )
            new_count.items.append(new_item)
            
    db.add(new_count)
    await db.commit()
    await db.refresh(new_count)
    
    # Reload with items
    stmt = select(CycleCount).where(CycleCount.id == new_count.id).options(selectinload(CycleCount.items))
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete("/{count_id}")
async def delete_cycle_count(
    count_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp"))
):
    stmt = select(CycleCount).where(
        CycleCount.id == count_id,
        CycleCount.tenant_id == ctx.tenant_id
    )
    res = await db.execute(stmt)
    count_record = res.scalar_one_or_none()
    
    if not count_record:
        raise HTTPException(status_code=404, detail="Cycle Count not found")
        
    await db.delete(count_record)
    await db.commit()
    return {"status": "success"}
