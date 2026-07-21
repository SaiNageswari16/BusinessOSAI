from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.database.session import get_db
from src.models.inventory import ProductKit, ProductKitItem
from src.schemas.inventory import ProductKitCreate, ProductKitUpdate, ProductKitResponse
from src.api.deps import CurrentUserContext, require_permission, require_any_permission

router = APIRouter(prefix="/product-kits", tags=["Inventory - Product Kits"])

@router.get("", response_model=List[ProductKitResponse])
async def list_product_kits(
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    result = await db.execute(
        select(ProductKit)
        .where(ProductKit.tenant_id == ctx.tenant_id)
        .options(selectinload(ProductKit.items))
    )
    return result.scalars().all()

@router.post("", response_model=ProductKitResponse, status_code=status.HTTP_201_CREATED)
async def create_product_kit(
    kit_in: ProductKitCreate,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    new_kit = ProductKit(
        id=uuid.uuid4(),
        tenant_id=ctx.tenant_id,
        name=kit_in.name,
        sku=kit_in.sku,
        kit_type=kit_in.kit_type,
        description=kit_in.description
    )
    db.add(new_kit)
    
    for item in kit_in.items:
        new_item = ProductKitItem(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            kit_id=new_kit.id,
            component_name=item.component_name,
            quantity=item.quantity
        )
        db.add(new_item)
        
    await db.commit()
    
    # Reload with items
    result = await db.execute(
        select(ProductKit)
        .where(ProductKit.id == new_kit.id)
        .options(selectinload(ProductKit.items))
    )
    return result.scalar_one()

@router.delete("/{kit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_kit(
    kit_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(select(ProductKit).where(
        ProductKit.id == kit_id, ProductKit.tenant_id == ctx.tenant_id
    ))
    kit = result.scalar_one_or_none()
    if not kit:
        raise HTTPException(status_code=404, detail="Product kit not found")
    
    await db.delete(kit)
    await db.commit()
