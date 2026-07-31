from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.database.session import get_db
from src.models.inventory import ProductBundle, ProductBundleItem
from src.schemas.inventory import ProductBundleCreate, ProductBundleUpdate, ProductBundleResponse
from src.api.deps import CurrentUserContext, require_permission, require_any_permission

router = APIRouter(prefix="/product-bundles", tags=["Inventory - Product Bundles"])

@router.get("", response_model=List[ProductBundleResponse])
async def list_product_bundles(
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    result = await db.execute(
        select(ProductBundle)
        .where(ProductBundle.tenant_id == ctx.tenant_id)
        .options(selectinload(ProductBundle.items))
    )
    return result.scalars().all()

@router.post("", response_model=ProductBundleResponse, status_code=status.HTTP_201_CREATED)
async def create_product_bundle(
    bundle_in: ProductBundleCreate,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    new_bundle = ProductBundle(
        id=uuid.uuid4(),
        tenant_id=ctx.tenant_id,
        name=bundle_in.name,
        sku=bundle_in.sku,
        description=bundle_in.description,
        price=bundle_in.price
    )
    db.add(new_bundle)
    
    for item in bundle_in.items:
        new_item = ProductBundleItem(
            id=uuid.uuid4(),
            tenant_id=ctx.tenant_id,
            bundle_id=new_bundle.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(new_item)
        
    await db.commit()
    
    # Reload with items
    result = await db.execute(
        select(ProductBundle)
        .where(ProductBundle.id == new_bundle.id)
        .options(selectinload(ProductBundle.items))
    )
    return result.scalar_one()

@router.delete("/{bundle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_bundle(
    bundle_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(select(ProductBundle).where(
        ProductBundle.id == bundle_id, ProductBundle.tenant_id == ctx.tenant_id
    ))
    bundle = result.scalar_one_or_none()
    if not bundle:
        raise HTTPException(status_code=404, detail="Product bundle not found")
    
    await db.delete(bundle)
    await db.commit()
