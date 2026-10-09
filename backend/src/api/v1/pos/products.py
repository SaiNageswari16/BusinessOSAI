import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, get_current_user_context
from src.database.session import get_db
from src.models import Product, ProductCategory, EntityStatus
from src.models.inventory import Brand
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
    stmt = (
        select(ProductCategory)
        .where(ProductCategory.tenant_id == ctx.tenant_id, ProductCategory.status == EntityStatus.ACTIVE)
    )
    if ctx.active_company_id:
        stmt = stmt.where(ProductCategory.company_id == ctx.active_company_id)
    stmt = stmt.order_by(ProductCategory.name)
    result = await db.execute(stmt)
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
    
    cat = ProductCategory(tenant_id=ctx.tenant_id, company_id=ctx.active_company_id, **data)
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
        select(ProductCategory).where(ProductCategory.id == category_id, ProductCategory.tenant_id == ctx.tenant_id)
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
        .where(Product.tenant_id == ctx.tenant_id)
    )
    if ctx.active_company_id:
        stmt = stmt.where(Product.company_id == ctx.active_company_id)
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
        data["status"] = EntityStatus.ACTIVE if data.pop("is_active") else EntityStatus.INACTIVE
    if "description" in data:
        data["short_description"] = data.pop("description")
    if "discount" in data:
        data["discount_limit"] = data.pop("discount")

    # Handle brand string
    brand_input = data.pop("brand", None) or data.pop("brand_name", None)
    if brand_input and isinstance(brand_input, str) and brand_input.strip():
        b_name = brand_input.strip()
        b_res = await db.execute(select(Brand).where(Brand.tenant_id == ctx.tenant_id, Brand.name.ilike(b_name)))
        existing_brand = b_res.scalars().first()
        if existing_brand:
            data["brand_id"] = existing_brand.id
        else:
            new_brand = Brand(id=uuid.uuid4(), tenant_id=ctx.tenant_id, name=b_name, status=EntityStatus.ACTIVE)
            db.add(new_brand)
            await db.flush()
            data["brand_id"] = new_brand.id

    data.pop("category_name", None)

    barcode = (data.get("barcode") or "").strip()
    name = (data.get("name") or "").strip()

    # Search for existing product by barcode or by name within active workspace
    existing_prod = None
    if barcode:
        stmt = select(Product).where(
            Product.tenant_id == ctx.tenant_id,
            Product.barcode == barcode
        )
        if ctx.active_company_id:
            stmt = stmt.where(Product.company_id == ctx.active_company_id)
        res = await db.execute(stmt)
        existing_prod = res.scalars().first()

    if not existing_prod and name:
        stmt = select(Product).where(
            Product.tenant_id == ctx.tenant_id,
            func.lower(Product.name) == name.lower()
        )
        if ctx.active_company_id:
            stmt = stmt.where(Product.company_id == ctx.active_company_id)
        res = await db.execute(stmt)
        existing_prod = res.scalars().first()

    user_stock = data.get("initial_stock") if data.get("initial_stock") is not None else (data.get("stock") if data.get("stock") is not None else data.get("current_stock"))
    try:
        clean_stock = int(user_stock) if user_stock is not None else 0
    except Exception:
        clean_stock = 0
    data["initial_stock"] = clean_stock
    data["on_hand_stock"] = clean_stock
    data.pop("stock", None)
    data.pop("current_stock", None)

    valid_cols = {c.name for c in Product.__table__.columns}
    cleaned_data = {k: v for k, v in data.items() if k in valid_cols and k not in ("id", "tenant_id")}

    if existing_prod:
        added_qty = clean_stock
        existing_prod.initial_stock = (existing_prod.initial_stock or 0) + added_qty
        existing_prod.on_hand_stock = (existing_prod.on_hand_stock or 0) + added_qty
        for k, v in cleaned_data.items():
            if k not in ("initial_stock", "on_hand_stock") and v is not None:
                setattr(existing_prod, k, v)

        await db.commit()
        prod_id = existing_prod.id
    else:
        product = Product(tenant_id=ctx.tenant_id, company_id=ctx.active_company_id, **cleaned_data)
        db.add(product)
        await db.commit()
        prod_id = product.id

    # Invalidate products cache
    await invalidate_cache_by_prefix("pos_products")

    # Re-fetch fully loaded product
    res_query = await db.execute(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand))
        .where(Product.id == prod_id)
    )
    product = res_query.scalar_one()

    specs = product.specifications if isinstance(product.specifications, dict) else {}
    res = POSProductResponse.model_construct(
        id=product.id, tenant_id=product.tenant_id, name=product.name, brand=product.brand.name if product.brand else None,
        sku=product.sku, barcode=product.barcode, hsn_code=product.hsn_code, description=product.short_description, image_url=product.image_url,
        category_id=product.category_id, category_name=product.category.name if product.category else None,
        purchase_price=float(product.purchase_price or 0.0), mrp=float(product.mrp or 0.0),
        selling_price=float(product.selling_price or product.mrp or 0.0),
        wholesale_price=float(product.wholesale_price or 0.0),
        b2b_price=float(specs.get("b2b_price") or 0.0),
        min_wholesale_qty=int(product.min_wholesale_qty or 1),
        tax_percent=float(product.tax_percent or 0.0),
        is_tax_inclusive=bool(product.is_tax_inclusive if product.is_tax_inclusive is not None else True),
        discount=float(product.discount_limit or 0.0), stock=int(product.initial_stock or 0),
        reorder_level=int(product.reorder_level or 0), is_active=(product.status == "active" or product.status == EntityStatus.ACTIVE),
        specifications=specs,
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
            dup_stmt = select(Product.id).where(Product.tenant_id == ctx.tenant_id, Product.barcode == barcode)
            if ctx.active_company_id:
                dup_stmt = dup_stmt.where(Product.company_id == ctx.active_company_id)
            res = await db.execute(dup_stmt)
            exists = res.scalar_one_or_none()

        if not exists and name:
            dup_stmt = select(Product.id).where(Product.tenant_id == ctx.tenant_id, func.lower(Product.name) == name.lower())
            if ctx.active_company_id:
                dup_stmt = dup_stmt.where(Product.company_id == ctx.active_company_id)
            res = await db.execute(dup_stmt)
            exists = res.scalar_one_or_none()

        if exists:
            skipped += 1
            continue

        if "is_active" in data:
            data["status"] = EntityStatus.ACTIVE if data.pop("is_active") else EntityStatus.INACTIVE
        if "description" in data:
            data["short_description"] = data.pop("description")
        if "discount" in data:
            data["discount_limit"] = data.pop("discount")

        # Brand handling in bulk
        brand_input = data.pop("brand", None) or data.pop("brand_name", None)
        if brand_input and isinstance(brand_input, str) and brand_input.strip():
            b_name = brand_input.strip()
            b_res = await db.execute(select(Brand).where(Brand.tenant_id == ctx.tenant_id, Brand.name.ilike(b_name)))
            existing_brand = b_res.scalars().first()
            if existing_brand:
                data["brand_id"] = existing_brand.id
            else:
                new_brand = Brand(id=uuid.uuid4(), tenant_id=ctx.tenant_id, name=b_name, status=EntityStatus.ACTIVE)
                db.add(new_brand)
                await db.flush()
                data["brand_id"] = new_brand.id

        data.pop("category_name", None)
        valid_cols = {c.name for c in Product.__table__.columns}
        cleaned_data = {k: v for k, v in data.items() if k in valid_cols and k not in ("id", "tenant_id")}

        prod = Product(tenant_id=ctx.tenant_id, company_id=ctx.active_company_id, **cleaned_data)
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
        .where(Product.id == product_id, Product.tenant_id == ctx.tenant_id)
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
        .where(Product.id == product_id, Product.tenant_id == ctx.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    updates = payload.model_dump(exclude_unset=True)

    # 1. Handle Brand Name/Brand lookup or creation
    brand_input = updates.pop("brand", None) or updates.pop("brand_name", None)
    if brand_input and isinstance(brand_input, str) and brand_input.strip():
        b_name = brand_input.strip()
        b_res = await db.execute(select(Brand).where(Brand.tenant_id == ctx.tenant_id, Brand.name.ilike(b_name)))
        existing_brand = b_res.scalars().first()
        if existing_brand:
            product.brand_id = existing_brand.id
        else:
            new_brand = Brand(id=uuid.uuid4(), tenant_id=ctx.tenant_id, name=b_name, status=EntityStatus.ACTIVE)
            db.add(new_brand)
            await db.flush()
            product.brand_id = new_brand.id

    # 2. Handle Status / is_active
    if "is_active" in updates:
        product.status = EntityStatus.ACTIVE if updates.pop("is_active") else EntityStatus.INACTIVE
    if "status" in updates:
        st = updates.pop("status")
        if isinstance(st, str):
            product.status = EntityStatus.ACTIVE if st.lower() in ("active", "true", "1") else EntityStatus.INACTIVE
        elif isinstance(st, EntityStatus):
            product.status = st

    # 3. Handle Description
    if "description" in updates:
        desc_val = updates.pop("description")
        product.short_description = desc_val
        if not updates.get("long_description"):
            product.long_description = desc_val

    # 4. Handle Discount
    if "discount" in updates:
        product.discount_limit = updates.pop("discount")

    # 5. Handle Stock mappings
    stock_val = updates.pop("stock", None)
    curr_stock_val = updates.pop("current_stock", None)
    if stock_val is not None:
        try:
            val_int = int(stock_val)
            product.initial_stock = val_int
            product.on_hand_stock = val_int
        except Exception:
            pass
    elif curr_stock_val is not None:
        try:
            val_int = int(curr_stock_val)
            product.initial_stock = val_int
            product.on_hand_stock = val_int
        except Exception:
            pass

    # Clean out any non-column / read-only attributes
    updates.pop("category_name", None)
    valid_cols = {c.name for c in Product.__table__.columns}
    for field, val in updates.items():
        if field in valid_cols and field not in ("id", "tenant_id", "created_at", "updated_at"):
            setattr(product, field, val)

    await db.commit()

    # Invalidate cache
    await invalidate_cache_by_prefix("pos_products")

    # Re-fetch with loaded relationships for response
    res_query = await db.execute(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand))
        .where(Product.id == product_id)
    )
    updated_product = res_query.scalar_one()

    specs = updated_product.specifications if isinstance(updated_product.specifications, dict) else {}
    res = POSProductResponse.model_construct(
        id=updated_product.id,
        tenant_id=updated_product.tenant_id,
        name=updated_product.name,
        brand=updated_product.brand.name if updated_product.brand else None,
        sku=updated_product.sku,
        barcode=updated_product.barcode,
        hsn_code=updated_product.hsn_code,
        description=updated_product.short_description,
        image_url=updated_product.image_url,
        category_id=updated_product.category_id,
        category_name=updated_product.category.name if updated_product.category else None,
        purchase_price=float(updated_product.purchase_price or 0.0),
        mrp=float(updated_product.mrp or 0.0),
        selling_price=float(updated_product.selling_price or updated_product.mrp or 0.0),
        wholesale_price=float(updated_product.wholesale_price or 0.0),
        b2b_price=float(specs.get("b2b_price") or 0.0),
        min_wholesale_qty=int(updated_product.min_wholesale_qty or 1),
        tax_percent=float(updated_product.tax_percent or 0.0),
        is_tax_inclusive=bool(updated_product.is_tax_inclusive if updated_product.is_tax_inclusive is not None else True),
        discount=float(updated_product.discount_limit or 0.0),
        stock=int(updated_product.initial_stock or 0),
        reorder_level=int(updated_product.reorder_level or 0),
        is_active=(updated_product.status == "active" or updated_product.status == EntityStatus.ACTIVE),
        specifications=specs,
        created_at=updated_product.created_at,
        updated_at=updated_product.updated_at
    )
    return res


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(
    product_id: uuid.UUID,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.tenant_id == ctx.tenant_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    from sqlalchemy import delete as sql_delete
    from src.models.inventory import (
        StockMovement, StockAdjustment, GoodsReceiptItem, GoodsIssueItem,
        CycleCountItem, ProductBundleItem,
        InventoryBatch, InventorySerial, ProductQRCode, ProductRFID,
        InventoryTransaction, ProductVariant, ProductImage
    )
    from src.models.storefront import StorefrontWishlist

    await db.execute(sql_delete(StockMovement).where(StockMovement.product_id == product_id))
    await db.execute(sql_delete(StockAdjustment).where(StockAdjustment.product_id == product_id))
    await db.execute(sql_delete(GoodsReceiptItem).where(GoodsReceiptItem.product_id == product_id))
    await db.execute(sql_delete(GoodsIssueItem).where(GoodsIssueItem.product_id == product_id))
    await db.execute(sql_delete(CycleCountItem).where(CycleCountItem.product_id == product_id))
    await db.execute(sql_delete(ProductBundleItem).where(ProductBundleItem.product_id == product_id))
    await db.execute(sql_delete(InventoryBatch).where(InventoryBatch.product_id == product_id))
    await db.execute(sql_delete(InventorySerial).where(InventorySerial.product_id == product_id))
    await db.execute(sql_delete(ProductQRCode).where(ProductQRCode.product_id == product_id))
    await db.execute(sql_delete(ProductRFID).where(ProductRFID.product_id == product_id))
    await db.execute(sql_delete(InventoryTransaction).where(InventoryTransaction.product_id == product_id))
    await db.execute(sql_delete(ProductVariant).where(ProductVariant.product_id == product_id))
    await db.execute(sql_delete(ProductImage).where(ProductImage.product_id == product_id))
    try:
        await db.execute(sql_delete(StorefrontWishlist).where(StorefrontWishlist.product_id == product_id))
    except Exception:
        pass

    await db.delete(product)
    await db.commit()
    
    # Invalidate cache
    await invalidate_cache_by_prefix("pos_products")
