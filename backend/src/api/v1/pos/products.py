import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
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
from src.utils.redis_cache import cache_response, invalidate_cache_by_prefix

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
            id=c.id, name=c.name, description=c.description, parent_id=c.parent_id,
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
    
    # Invalidate categories cache
    await invalidate_cache_by_prefix("pos_categories")
    
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
    
    # Invalidate categories cache
    await invalidate_cache_by_prefix("pos_categories")


# ─── Products ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=list[POSProductResponse])
async def list_products(
    category_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(2000, le=5000),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand))
        .where(Product.tenant_id == ctx.user.tenant_id)
    )
    if active_only:
        stmt = stmt.where(or_(Product.status == EntityStatus.ACTIVE, Product.status == None))
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            Product.name.ilike(like)
            | Product.barcode.ilike(like)
            | Product.sku.ilike(like)
        )
    stmt = stmt.order_by(Product.updated_at.desc(), Product.name.asc()).limit(limit)
    result = await db.execute(stmt)
    products = result.scalars().all()

    # Enrich with category name and tier specifications
    out = []
    for p in products:
        specs = p.specifications if isinstance(p.specifications, dict) else {}
        b2b_p = float(specs.get("b2b_price") or 0.0)
        d = POSProductResponse.model_construct(
            id=p.id, tenant_id=p.tenant_id, name=p.name, brand=p.brand.name if p.brand else None,
            sku=p.sku, barcode=p.barcode, hsn_code=p.hsn_code, description=p.short_description, image_url=p.image_url,
            category_id=p.category_id, category_name=p.category.name if p.category else None,
            purchase_price=float(p.purchase_price or 0.0), mrp=float(p.mrp or 0.0),
            selling_price=float(p.selling_price or p.mrp or 0.0),
            wholesale_price=float(p.wholesale_price or 0.0),
            b2b_price=b2b_p,
            min_wholesale_qty=int(p.min_wholesale_qty or 1),
            tax_percent=float(p.tax_percent or 0.0),
            is_tax_inclusive=bool(p.is_tax_inclusive if p.is_tax_inclusive is not None else True),
            discount=float(p.discount_limit or 0.0), stock=int(p.initial_stock or 0),
            reorder_level=int(p.reorder_level or 0), is_active=(p.status == EntityStatus.ACTIVE or p.status == None),
            specifications=specs,
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

    barcode = (data.get("barcode") or "").strip()
    name = (data.get("name") or "").strip()

    # Search for existing product by barcode or by name
    existing_prod = None
    if barcode:
        stmt = select(Product).where(
            Product.tenant_id == ctx.user.tenant_id,
            Product.barcode == barcode
        )
        res = await db.execute(stmt)
        existing_prod = res.scalars().first()

    if not existing_prod and name:
        stmt = select(Product).where(
            Product.tenant_id == ctx.user.tenant_id,
            func.lower(Product.name) == name.lower()
        )
        res = await db.execute(stmt)
        existing_prod = res.scalars().first()

    if existing_prod:
        added_qty = data.get("initial_stock") or data.get("stock") or 1
        existing_prod.initial_stock = (existing_prod.initial_stock or 0) + added_qty
        if data.get("mrp"):
            existing_prod.mrp = data["mrp"]
        if data.get("selling_price"):
            existing_prod.selling_price = data["selling_price"]
        if data.get("purchase_price"):
            existing_prod.purchase_price = data["purchase_price"]
        if data.get("short_description"):
            existing_prod.short_description = data["short_description"]
        if data.get("image_url"):
            existing_prod.image_url = data["image_url"]

        await db.commit()
        await db.refresh(existing_prod, ["category", "brand"])
        product = existing_prod
    else:
        product = Product(tenant_id=ctx.user.tenant_id, **data)
        db.add(product)
        await db.commit()
        await db.refresh(product, ["category", "brand"])

    # Invalidate products cache
    await invalidate_cache_by_prefix("pos_products")

    res = POSProductResponse.model_construct(
        id=product.id, tenant_id=product.tenant_id, name=product.name, brand=product.brand.name if product.brand else None,
        sku=product.sku, barcode=product.barcode, description=product.short_description, image_url=product.image_url,
        category_id=product.category_id, category_name=product.category.name if product.category else None,
        purchase_price=float(product.purchase_price or 0.0), mrp=float(product.mrp or 0.0),
        selling_price=float(product.selling_price or product.mrp or 0.0),
        wholesale_price=float(product.wholesale_price or 0.0), min_wholesale_qty=int(product.min_wholesale_qty or 1),
        tax_percent=float(product.tax_percent or 0.0), discount=float(product.discount_limit or 0.0), stock=int(product.initial_stock or 0),
        reorder_level=int(product.reorder_level or 0), is_active=(product.status == "active" or product.status == EntityStatus.ACTIVE),
        created_at=product.created_at, updated_at=product.updated_at
    )
    return res


@router.post("/products/bulk", response_model=POSProductBulkResponse, status_code=201)
async def bulk_create_products(
    payload: POSProductBulkCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    skipped = 0
    errors = []
    new_products = []

    for item in payload.products:
        data = item.model_dump()
        barcode = (data.get("barcode") or "").strip()
        name = (data.get("name") or "").strip()

        # Check duplicate
        exists = None
        if barcode:
            res = await db.execute(
                select(Product.id).where(Product.tenant_id == ctx.user.tenant_id, Product.barcode == barcode)
            )
            exists = res.scalar_one_or_none()

        if not exists and name:
            res = await db.execute(
                select(Product.id).where(Product.tenant_id == ctx.user.tenant_id, func.lower(Product.name) == name.lower())
            )
            exists = res.scalar_one_or_none()

        if exists:
            skipped += 1
            continue

        if "is_active" in data:
            data["status"] = "active" if data.pop("is_active") else "inactive"
        if "description" in data:
            data["short_description"] = data.pop("description")
        if "discount" in data:
            data["discount_limit"] = data.pop("discount")

        prod = Product(tenant_id=ctx.user.tenant_id, **data)
        new_products.append(prod)

    if new_products:
        db.add_all(new_products)
        await db.commit()
        # Invalidate cache
        await invalidate_cache_by_prefix("pos_products")

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

    specs = product.specifications if isinstance(product.specifications, dict) else {}
    b2b_p = float(specs.get("b2b_price") or 0.0)
    res = POSProductResponse.model_construct(
        id=product.id, tenant_id=product.tenant_id, name=product.name, brand=product.brand.name if product.brand else None,
        sku=product.sku, barcode=product.barcode, hsn_code=product.hsn_code, description=product.short_description, image_url=product.image_url,
        category_id=product.category_id, category_name=product.category.name if product.category else None,
        purchase_price=float(product.purchase_price or 0.0), mrp=float(product.mrp or 0.0),
        selling_price=float(product.selling_price or product.mrp or 0.0),
        wholesale_price=float(product.wholesale_price or 0.0),
        b2b_price=b2b_p,
        min_wholesale_qty=int(product.min_wholesale_qty or 1),
        tax_percent=float(product.tax_percent or 0.0),
        is_tax_inclusive=bool(product.is_tax_inclusive if product.is_tax_inclusive is not None else True),
        discount=float(product.discount_limit or 0.0), stock=int(product.initial_stock or 0),
        reorder_level=int(product.reorder_level or 0), is_active=(product.status == "active" or product.status == EntityStatus.ACTIVE),
        specifications=specs,
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
    
    # Invalidate cache
    await invalidate_cache_by_prefix("pos_products")
    
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
    
    # Invalidate cache
    await invalidate_cache_by_prefix("pos_products")
