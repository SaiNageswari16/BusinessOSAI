from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database.session import get_db
from src.models.inventory import ProductImage
from src.schemas.inventory import ProductImageCreate, ProductImageUpdate, ProductImageResponse
from src.api.deps import CurrentUserContext, require_permission, require_any_permission

router = APIRouter(prefix="/product-images", tags=["Inventory - Product Images"])

@router.get("", response_model=List[ProductImageResponse])
async def list_product_images(
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    result = await db.execute(select(ProductImage).where(ProductImage.tenant_id == ctx.tenant_id))
    return result.scalars().all()

@router.post("", response_model=ProductImageResponse, status_code=status.HTTP_201_CREATED)
async def create_product_image(
    image_in: ProductImageCreate,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    new_image = ProductImage(
        id=uuid.uuid4(),
        tenant_id=ctx.tenant_id,
        product_id=image_in.product_id,
        image_url=image_in.image_url,
        is_primary=image_in.is_primary,
        display_order=image_in.display_order
    )
    db.add(new_image)
    await db.commit()
    await db.refresh(new_image)
    return new_image

@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_image(
    image_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(select(ProductImage).where(
        ProductImage.id == image_id, ProductImage.tenant_id == ctx.tenant_id
    ))
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Product image not found")
    
    await db.delete(img)
    await db.commit()
