from typing import Any, List
import os
import uuid as uuid_mod
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
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
    image_id: uuid_mod.UUID,
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


@router.patch("/{image_id}", response_model=ProductImageResponse)
async def update_product_image(
    image_id: uuid_mod.UUID,
    image_in: ProductImageUpdate,
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    result = await db.execute(select(ProductImage).where(
        ProductImage.id == image_id, ProductImage.tenant_id == ctx.tenant_id
    ))
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Product image not found")

    if image_in.product_id is not None:
        img.product_id = image_in.product_id
    if image_in.image_url is not None:
        img.image_url = image_in.image_url
    if image_in.is_primary is not None:
        img.is_primary = image_in.is_primary
    if image_in.display_order is not None:
        img.display_order = image_in.display_order

    await db.commit()
    await db.refresh(img)
    return img


@router.post("/upload", response_model=ProductImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_product_image(
    product_id: uuid_mod.UUID = Query(...),
    file: UploadFile = File(...),
    is_primary: bool = Query(False),
    display_order: int = Query(0),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
) -> Any:
    # Validate product belongs to tenant
    from src.models.inventory import Product
    prod = await db.scalar(select(Product).where(
        Product.id == product_id, Product.tenant_id == ctx.tenant_id
    ))
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate file type
    allowed_ext = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(allowed_ext))}")

    # Save file under /images/<tenant_id>/<uuid>.<ext>
    tenant_dir = os.path.join("images", str(ctx.tenant_id))
    os.makedirs(tenant_dir, exist_ok=True)
    new_name = f"{uuid_mod.uuid4().hex}{ext}"
    dest_path = os.path.join(tenant_dir, new_name)
    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    image_url = f"/images/{ctx.tenant_id}/{new_name}"

    new_image = ProductImage(
        id=uuid_mod.uuid4(),
        tenant_id=ctx.tenant_id,
        product_id=product_id,
        image_url=image_url,
        is_primary=is_primary,
        display_order=display_order,
    )
    db.add(new_image)
    await db.commit()
    await db.refresh(new_image)
    return new_image
