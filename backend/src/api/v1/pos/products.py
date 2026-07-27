import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import Product, ProductCategory, EntityStatus
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
        select(ProductCategory)
        .where(ProductCategory.tenant_id == ctx.user.tenant_id, ProductCategory.status == EntityStatus.ACTIVE)
        .order_by(ProductCategory.name)
    )
    categories = result.scalars().all()
    
    out = []
    for c in categories:
        d = POSCategoryResponse.model_construct(
            id=c.id, name=c.name, description=c.description,
            color=None, icon=None, is_active=(c.status == EntityStatus.ACTIVE),
            created_at=c.created_at, updated_at=c.updated_at
        )
        out.append(d)
    return out


@router.post("/categories", response_model=POSCategoryResponse, status_code=201)
async def create_category(
    payload: POSCategoryCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump()
    # Handle status vs is_active mapping implicitly or explicitly if needed
    if "is_active" in data:
        data["status"] = "active" if data.pop("is_active") else "inactive"
    
    cat = ProductCategory(tenant_id=ctx.user.tenant_id, **data)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    # Ensure response matches POS schema
    res = POSCategoryResponse.model_validate(cat)
    res.is_active = (cat.status == "active")
    return res


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductCategory).where(ProductCategory.id == category_id, ProductCategory.tenant_id == ctx.user.tenant_id)
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
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand))
        .where(Product.tenant_id == ctx.user.tenant_id)
    )
    if active_only:
        stmt = stmt.where(Product.status == EntityStatus.ACTIVE)
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            Product.name.ilike(like)
            | Product.barcode.ilike(like)
            | Product.sku.ilike(like)
        )
    stmt = stmt.order_by(Product.name).limit(limit)
    result = await db.execute(stmt)
    products = result.scalars().all()

    # Enrich with category name
    out = []
    for p in products:
        d = POSProductResponse.model_construct(
            id=p.id, tenant_id=p.tenant_id, name=p.name, brand=p.brand.name if p.brand else None,
            sku=p.sku, barcode=p.barcode, description=p.short_description, image_url=p.image_url,
            category_id=p.category_id, category_name=p.category.name if p.category else None,
            purchase_price=p.purchase_price, mrp=p.mrp, selling_price=p.selling_price or p.mrp or 0.0,
            tax_percent=p.tax_percent, discount=p.discount_limit, stock=p.initial_stock,
            reorder_level=p.reorder_level, is_active=(p.status == EntityStatus.ACTIVE),
            created_at=p.created_at, updated_at=p.updated_at
        )
        out.append(d)
    return out


@router.post("/products", response_model=POSProductResponse, status_code=201)
async def create_product(
    payload: POSProductCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    data = payload.model_dump()
    if "is_active" in data:
        data["status"] = "active" if data.pop("is_active") else "inactive"
    if "description" in data:
        data["short_description"] = data.pop("description")
    if "discount" in data:
        data["discount_limit"] = data.pop("discount")
        
    product = Product(tenant_id=ctx.user.tenant_id, **data)
    db.add(product)
    await db.commit()
    await db.refresh(product, ["category", "brand"])
    
    res = POSProductResponse.model_construct(
        id=product.id, tenant_id=product.tenant_id, name=product.name, brand=product.brand.name if product.brand else None,
        sku=product.sku, barcode=product.barcode, description=product.short_description, image_url=product.image_url,
        category_id=product.category_id, category_name=product.category.name if product.category else None,
        purchase_price=product.purchase_price, mrp=product.mrp, selling_price=product.selling_price or product.mrp or 0.0,
        tax_percent=product.tax_percent, discount=product.discount_limit, stock=product.initial_stock,
        reorder_level=product.reorder_level, is_active=(product.status == "active"),
        created_at=product.created_at, updated_at=product.updated_at
    )
    return res


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
        select(Product.sku, Product.barcode)
        .where(Product.tenant_id == tenant_id)
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
            
        new_products.append(Product(tenant_id=tenant_id, **p.model_dump()))

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
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand))
        .where(Product.id == product_id, Product.tenant_id == ctx.user.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    res = POSProductResponse.model_construct(
        id=product.id, tenant_id=product.tenant_id, name=product.name, brand=product.brand.name if product.brand else None,
        sku=product.sku, barcode=product.barcode, description=product.short_description, image_url=product.image_url,
        category_id=product.category_id, category_name=product.category.name if product.category else None,
        purchase_price=product.purchase_price, mrp=product.mrp, selling_price=product.selling_price or product.mrp or 0.0,
        tax_percent=product.tax_percent, discount=product.discount_limit, stock=product.initial_stock,
        reorder_level=product.reorder_level, is_active=(product.status == "active"),
        created_at=product.created_at, updated_at=product.updated_at
    )
    return res


@router.patch("/products/{product_id}", response_model=POSProductResponse)
async def update_product(
    product_id: uuid.UUID,
    payload: POSProductUpdate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand))
        .where(Product.id == product_id, Product.tenant_id == ctx.user.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    updates = payload.model_dump(exclude_unset=True)
    if "is_active" in updates:
        updates["status"] = "active" if updates.pop("is_active") else "inactive"
    if "description" in updates:
        updates["short_description"] = updates.pop("description")
    if "discount" in updates:
        updates["discount_limit"] = updates.pop("discount")

    for field, val in updates.items():
        setattr(product, field, val)
    await db.commit()
    await db.refresh(product, ["category", "brand"])
    
    res = POSProductResponse.model_construct(
        id=product.id, tenant_id=product.tenant_id, name=product.name, brand=product.brand.name if product.brand else None,
        sku=product.sku, barcode=product.barcode, description=product.short_description, image_url=product.image_url,
        category_id=product.category_id, category_name=product.category.name if product.category else None,
        purchase_price=product.purchase_price, mrp=product.mrp, selling_price=product.selling_price or product.mrp or 0.0,
        tax_percent=product.tax_percent, discount=product.discount_limit, stock=product.initial_stock,
        reorder_level=product.reorder_level, is_active=(product.status == "active"),
        created_at=product.created_at, updated_at=product.updated_at
    )
    return res


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.tenant_id == ctx.user.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    await db.delete(product)
    await db.commit()
