from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database.session import get_db
from src.models.inventory import ProductVariant
from src.schemas.inventory import ProductVariantCreate, ProductVariantUpdate, ProductVariantResponse
from src.api.deps import CurrentUserContext, require_permission, require_any_permission

router = APIRouter(prefix="/product-variants", tags=["Inventory - Product Variants"])

@router.get("", response_model=List[ProductVariantResponse])
async def list_product_variants(
    ctx: CurrentUserContext = Depends(require_any_permission("view:erp", "view:pos")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    result = await db.execute(select(ProductVariant).where(ProductVariant.tenant_id == ctx.tenant_id))
    return result.scalars().all()

@router.post("", response_model=ProductVariantResponse, status_code=status.HTTP_201_CREATED)
async def create_product_variant(
    variant_in: ProductVariantCreate,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    new_variant = ProductVariant(
        id=uuid.uuid4(),
        tenant_id=ctx.tenant_id,
        product_id=variant_in.product_id,
        variant_name=variant_in.variant_name,
        sku=variant_in.sku,
        barcode=variant_in.barcode,
        attributes=variant_in.attributes,
        additional_price=variant_in.additional_price,
        stock_override=variant_in.stock_override
    )
    db.add(new_variant)
    await db.commit()
    await db.refresh(new_variant)
    return new_variant

@router.delete("/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_variant(
    variant_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> None:
    result = await db.execute(select(ProductVariant).where(
        ProductVariant.id == variant_id, ProductVariant.tenant_id == ctx.tenant_id
    ))
    var = result.scalar_one_or_none()
    if not var:
        raise HTTPException(status_code=404, detail="Product variant not found")
    
    await db.delete(var)
    await db.commit()
