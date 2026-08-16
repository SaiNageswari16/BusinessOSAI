import os
import shutil
from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from src.database.session import get_db
from src.models.inventory import ProductImage, Product
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

    # If primary, also update Product.image_url
    if image_in.is_primary:
        prod_res = await db.execute(
            select(Product).where(Product.id == image_in.product_id, Product.tenant_id == ctx.tenant_id)
        )
        prod = prod_res.scalar_one_or_none()
        if prod:
            prod.image_url = image_in.image_url

    await db.commit()
    await db.refresh(new_image)
    return new_image

@router.post("/upload-single")
async def upload_single_product_image(
    product_id: uuid.UUID = Form(...),
    is_primary: bool = Form(True),
    file: UploadFile = File(...),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    images_dir = os.path.join(base_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"prod_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(images_dir, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    image_url = f"/images/{filename}"

    # Update Product
    prod_res = await db.execute(
        select(Product).where(Product.id == product_id, Product.tenant_id == ctx.tenant_id)
    )
    prod = prod_res.scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if is_primary or not prod.image_url:
        prod.image_url = image_url

    # Create ProductImage gallery entry
    new_image = ProductImage(
        id=uuid.uuid4(),
        tenant_id=ctx.tenant_id,
        product_id=product_id,
        image_url=image_url,
        is_primary=is_primary,
        display_order=0
    )
    db.add(new_image)
    await db.commit()

    return {
        "success": True,
        "image_url": image_url,
        "product_id": str(product_id),
        "product_name": prod.name
    }

@router.post("/bulk-upload-by-barcode")
async def bulk_upload_images_by_barcode(
    files: List[UploadFile] = File(...),
    ctx: CurrentUserContext = Depends(require_permission("manage:erp")),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk Upload Product Images matching filename to Product Barcode or SKU.
    e.g. 8901030383123.jpg or SKU-1002.png
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    images_dir = os.path.join(base_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    results = []
    matched_count = 0
    unmatched_count = 0

    for file in files:
        raw_name = file.filename or ""
        stem = os.path.splitext(raw_name)[0].strip()
        ext = os.path.splitext(raw_name)[1] or ".jpg"

        if not stem:
            results.append({"filename": raw_name, "matched": False, "error": "Invalid filename"})
            unmatched_count += 1
            continue

        # Look up product by Barcode or SKU
        prod_res = await db.execute(
            select(Product).where(
                Product.tenant_id == ctx.tenant_id,
                or_(
                    Product.barcode.ilike(stem),
                    Product.sku.ilike(stem)
                )
            ).limit(1)
        )
        product = prod_res.scalar_one_or_none()

        if product:
            saved_filename = f"prod_{stem}_{uuid.uuid4().hex[:6]}{ext}"
            filepath = os.path.join(images_dir, saved_filename)
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            image_url = f"/images/{saved_filename}"
            product.image_url = image_url

            # Add to ProductImage gallery
            new_image = ProductImage(
                id=uuid.uuid4(),
                tenant_id=ctx.tenant_id,
                product_id=product.id,
                image_url=image_url,
                is_primary=True,
                display_order=0
            )
            db.add(new_image)

            matched_count += 1
            results.append({
                "filename": raw_name,
                "matched": True,
                "product_id": str(product.id),
                "product_name": product.name,
                "sku": product.sku,
                "barcode": product.barcode,
                "image_url": image_url
            })
        else:
            unmatched_count += 1
            results.append({
                "filename": raw_name,
                "matched": False,
                "searched_code": stem,
                "error": f"No product found with barcode or SKU '{stem}'"
            })

    await db.commit()

    return {
        "total_files": len(files),
        "matched_count": matched_count,
        "unmatched_count": unmatched_count,
        "results": results
    }

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
