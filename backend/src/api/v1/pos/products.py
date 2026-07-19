import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import POSProduct, POSCategory
from src.schemas.erp import (
    POSProductCreate, POSProductUpdate, POSProductResponse,
    POSCategoryCreate, POSCategoryResponse,
    POSProductBulkCreate, POSProductBulkResponse,
)

router = APIRouter(tags=["POS - Products"])


# ─── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[POSCategoryResponse])
async def list_categories(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(POSCategory)
        .where(POSCategory.tenant_id == ctx.user.tenant_id, POSCategory.is_active == True)
        .order_by(POSCategory.name)
    )
    return result.scalars().all()


@router.post("/categories", response_model=POSCategoryResponse, status_code=201)
async def create_category(
    payload: POSCategoryCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    cat = POSCategory(tenant_id=ctx.user.tenant_id, **payload.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(POSCategory).where(POSCategory.id == category_id, POSCategory.tenant_id == ctx.user.tenant_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found.")
    await db.delete(cat)
    await db.commit()


# ─── Products ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=list[POSProductResponse])
async def list_products(
    category_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(200, le=500),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(POSProduct)
        .options(selectinload(POSProduct.category))
        .where(POSProduct.tenant_id == ctx.user.tenant_id)
    )
    if active_only:
        stmt = stmt.where(POSProduct.is_active == True)
    if category_id:
        stmt = stmt.where(POSProduct.category_id == category_id)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            POSProduct.name.ilike(like)
            | POSProduct.barcode.ilike(like)
            | POSProduct.sku.ilike(like)
        )
    stmt = stmt.order_by(POSProduct.name).limit(limit)
    result = await db.execute(stmt)
    products = result.scalars().all()

    # Enrich with category name
    out = []
    for p in products:
        d = POSProductResponse.model_validate(p)
        d.category_name = p.category.name if p.category else None
        out.append(d)
    return out


@router.post("/products", response_model=POSProductResponse, status_code=201)
async def create_product(
    payload: POSProductCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    product = POSProduct(tenant_id=ctx.user.tenant_id, **payload.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.post("/products/bulk", response_model=POSProductBulkResponse, status_code=201)
async def bulk_create_products(
    payload: POSProductBulkCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    if not payload.products:
        return POSProductBulkResponse(created_count=0, skipped_count=0, errors=[])

    # Fetch existing SKUs and Barcodes to avoid duplicates
    tenant_id = ctx.user.tenant_id
    existing_result = await db.execute(
        select(POSProduct.sku, POSProduct.barcode)
        .where(POSProduct.tenant_id == tenant_id)
    )
    existing_records = existing_result.all()
    existing_skus = {r.sku for r in existing_records if r.sku}
    existing_barcodes = {r.barcode for r in existing_records if r.barcode}

    new_products = []
    skipped = 0
    errors = []

    for idx, p in enumerate(payload.products):
        # Convert empty strings to None for unique fields
        if not p.sku or p.sku.strip() == "":
            p.sku = None
        if not p.barcode or p.barcode.strip() == "":
            p.barcode = None

        if p.sku and p.sku in existing_skus:
            skipped += 1
            errors.append(f"Row {idx + 1}: SKU '{p.sku}' already exists.")
            continue
        if p.barcode and p.barcode in existing_barcodes:
            skipped += 1
            errors.append(f"Row {idx + 1}: Barcode '{p.barcode}' already exists.")
            continue
        
        # Add to sets to prevent duplicates within the same batch
        if p.sku: existing_skus.add(p.sku)
        if p.barcode: existing_barcodes.add(p.barcode)
            
        new_products.append(POSProduct(tenant_id=tenant_id, **p.model_dump()))

    if new_products:
        db.add_all(new_products)
        await db.commit()

    return POSProductBulkResponse(
        created_count=len(new_products),
        skipped_count=skipped,
        errors=errors
    )


@router.get("/products/{product_id}", response_model=POSProductResponse)
async def get_product(
    product_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(POSProduct)
        .options(selectinload(POSProduct.category))
        .where(POSProduct.id == product_id, POSProduct.tenant_id == ctx.user.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    d = POSProductResponse.model_validate(product)
    d.category_name = product.category.name if product.category else None
    return d


@router.patch("/products/{product_id}", response_model=POSProductResponse)
async def update_product(
    product_id: uuid.UUID,
    payload: POSProductUpdate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(POSProduct).where(POSProduct.id == product_id, POSProduct.tenant_id == ctx.user.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, val)
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(POSProduct).where(POSProduct.id == product_id, POSProduct.tenant_id == ctx.user.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    await db.delete(product)
    await db.commit()
