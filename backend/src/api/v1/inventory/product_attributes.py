from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database.session import get_db
from src.models.inventory import ProductAttribute
from src.schemas.inventory import ProductAttributeCreate, ProductAttributeUpdate, ProductAttributeResponse
from src.api.deps import CurrentUserContext, require_permission, require_any_permission

router = APIRouter(prefix="/product-attributes", tags=["Inventory - Product Attributes"])

@router.get("", response_model=List[ProductAttributeResponse])
async def list_product_attributes(
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    result = await db.execute(select(ProductAttribute).where(ProductAttribute.tenant_id == ctx.tenant_id))
    return result.scalars().all()

@router.post("", response_model=ProductAttributeResponse, status_code=status.HTTP_201_CREATED)
async def create_product_attribute(
    attribute_in: ProductAttributeCreate,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    new_attr = ProductAttribute(
        id=uuid.uuid4(),
        tenant_id=ctx.tenant_id,
        name=attribute_in.name,
        module=attribute_in.module,
        options=attribute_in.options
    )
    db.add(new_attr)
    await db.commit()
    await db.refresh(new_attr)
    return new_attr

@router.delete("/{attribute_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_attribute(
    attribute_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(select(ProductAttribute).where(
        ProductAttribute.id == attribute_id, ProductAttribute.tenant_id == ctx.tenant_id
    ))
    attr = result.scalar_one_or_none()
    if not attr:
        raise HTTPException(status_code=404, detail="Product attribute not found")
    
    await db.delete(attr)
    await db.commit()
