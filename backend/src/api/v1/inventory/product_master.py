import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, Header, UploadFile, File
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_any_permission, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import EntityStatus
from src.models.inventory import ProductCategory, Brand, UnitOfMeasure, Product, MasterCatalogProduct
from src.schemas.inventory import (
    ProductCategoryCreate, ProductCategoryResponse, ProductCategoryUpdate,
    ProductCategoryBulkCreate, ProductCategoryBulkResponse,
    BrandCreate, BrandResponse, BrandUpdate,
    UnitOfMeasureCreate, UnitOfMeasureResponse, UnitOfMeasureUpdate,
    ProductCreate, ProductResponse, ProductUpdate,
    MasterProductBulkCreate, MasterProductBulkResponse, MasterProductImportItem,
    PublicProductResponse
)
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.redis_cache import cache_response, invalidate_cache_by_prefix

router = APIRouter()

def _parse_status(value: str) -> EntityStatus:
    try:
        return EntityStatus(value.lower())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid status: {value}") from exc

import json
import os

HSN_DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "data", "hsn_codes_gst.json")

from sqlalchemy import or_
from src.models.inventory import HSNMaster

@router.get("/hsn-codes")
async def list_hsn_codes(
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = None,
    limit: int = Query(1000, ge=1, le=2000),
):
    """Retrieve official Indian GST HSN codes and corresponding GST tax rates from SQL Database."""
    try:
        query = select(HSNMaster)
        if search and search.strip():
            s = f"%{search.strip()}%"
            query = query.where(or_(HSNMaster.hsn_code.ilike(s), HSNMaster.description.ilike(s)))
        query = query.limit(limit)
        res = await db.execute(query)
        rows = res.scalars().all()
        if rows:
            return [{"hsn_code": r.hsn_code, "description": r.description, "gst_rate": r.gst_rate} for r in rows]
    except Exception:
        pass

    if os.path.exists(HSN_DATA_FILE):
        try:
            with open(HSN_DATA_FILE, "r", encoding="utf-8") as f:
                hsn_list = json.load(f)
            if search:
                s = search.lower().strip()
                hsn_list = [h for h in hsn_list if s in h["hsn_code"].lower() or s in h["description"].lower()]
            return hsn_list[:limit]
        except Exception:
            return []
    return []


# ==========================================
# Product Categories
# ==========================================


@router.get("/categories", response_model=PaginatedResponse[ProductCategoryResponse])
@cache_response(expire=300, prefix="pos_categories")
async def list_product_categories(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    query = select(ProductCategory).where(ProductCategory.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(ProductCategory.name.ilike(f"%{search}%"))
        
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ProductCategory.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/categories", response_model=ProductCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_product_category(
    payload: ProductCategoryCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cat_code = payload.category_code
    if not cat_code:
        cat_code = f"CAT-{uuid.uuid4().hex[:6].upper()}"
        
    # Check duplicate
    existing = await db.scalar(select(ProductCategory).where(
        ProductCategory.category_code == cat_code,
        ProductCategory.tenant_id == ctx.tenant_id
    ))
    if existing:
        raise HTTPException(status_code=400, detail=f"Category Code '{cat_code}' already exists.")

    cat = ProductCategory(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        category_code=cat_code,
        description=payload.description,
        parent_id=payload.parent_id,
        status=_parse_status(payload.status or "active"),
    )
    db.add(cat)
    await db.flush()
    await db.commit()
    await db.commit()
    # Invalidate categories cache
    await invalidate_cache_by_prefix("pos_categories")
    return cat


@router.post("/categories/bulk", response_model=ProductCategoryBulkResponse, status_code=status.HTTP_201_CREATED)
async def bulk_create_product_categories(
    payload: ProductCategoryBulkCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not payload.categories:
        return ProductCategoryBulkResponse(created_count=0, skipped_count=0, errors=[])

    tenant_id = ctx.tenant_id
    existing_result = await db.execute(
        select(ProductCategory.category_code)
        .where(ProductCategory.tenant_id == tenant_id, ProductCategory.category_code.isnot(None))
    )
    existing_codes = {r for r in existing_result.scalars().all()}

    new_cats = []
    skipped = 0
    errors = []

    for idx, c in enumerate(payload.categories):
        cat_code = c.category_code
        if not cat_code:
            cat_code = f"CAT-{uuid.uuid4().hex[:6].upper()}"
            
        if cat_code in existing_codes:
            skipped += 1
            errors.append(f"Row {idx + 1}: Category Code '{cat_code}' already exists.")
            continue
            
        existing_codes.add(cat_code)
        
        cat = ProductCategory(
            tenant_id=tenant_id,
            name=c.name,
            category_code=cat_code,
            description=c.description,
            parent_id=c.parent_id,
            status=_parse_status(c.status or "active"),
        )
        new_cats.append(cat)

    if new_cats:
        db.add_all(new_cats)
        await db.commit()
        # Invalidate categories cache
        await invalidate_cache_by_prefix("pos_categories")

    return ProductCategoryBulkResponse(
        created_count=len(new_cats),
        skipped_count=skipped,
        errors=errors
    )



@router.patch("/categories/{cat_id}", response_model=ProductCategoryResponse)
async def update_product_category(
    cat_id: uuid.UUID,
    payload: ProductCategoryUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cat = await db.scalar(select(ProductCategory).where(
        ProductCategory.id == cat_id, ProductCategory.tenant_id == ctx.tenant_id
    ))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"]:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(cat, key, value)

    await db.commit()
    return cat


@router.delete("/categories/all", status_code=status.HTTP_200_OK)
async def delete_all_product_categories(
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import update
    await db.execute(
        update(Product).where(Product.tenant_id == ctx.tenant_id).values(category_id=None)
    )
    result = await db.execute(
        select(ProductCategory).where(ProductCategory.tenant_id == ctx.tenant_id)
    )
    cats = result.scalars().all()
    count = len(cats)
    for cat in cats:
        await db.delete(cat)
    await db.commit()
    await invalidate_cache_by_prefix("pos_categories")
    return {"message": f"Successfully deleted {count} categories", "count": count}


@router.delete("/categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_category(
    cat_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cat = await db.scalar(select(ProductCategory).where(
        ProductCategory.id == cat_id, ProductCategory.tenant_id == ctx.tenant_id
    ))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()


# ==========================================
# Brands
# ==========================================

@router.get("/brands", response_model=PaginatedResponse[BrandResponse])
async def list_brands(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    query = select(Brand).where(Brand.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(Brand.name.ilike(f"%{search}%"))
        
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Brand.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.post("/brands", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    payload: BrandCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    brand = Brand(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        description=payload.description,
        manufacturer=payload.manufacturer,
        status=_parse_status(payload.status or "active"),
    )
    db.add(brand)
    await db.flush()
    await db.commit()
    return brand


@router.patch("/brands/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: uuid.UUID,
    payload: BrandUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    brand = await db.scalar(select(Brand).where(
        Brand.id == brand_id, Brand.tenant_id == ctx.tenant_id
    ))
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    updates = payload.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"]:
        updates["status"] = _parse_status(updates["status"])
    for key, value in updates.items():
        setattr(brand, key, value)

    await db.commit()
    return brand


@router.delete("/brands/all", status_code=status.HTTP_200_OK)
async def delete_all_brands(
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import update
    await db.execute(
        update(Product).where(Product.tenant_id == ctx.tenant_id).values(brand_id=None)
    )
    result = await db.execute(
        select(Brand).where(Brand.tenant_id == ctx.tenant_id)
    )
    brands = result.scalars().all()
    count = len(brands)
    for brand in brands:
        await db.delete(brand)
    await db.commit()
    return {"message": f"Successfully deleted {count} brands", "count": count}


@router.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(
    brand_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    brand = await db.scalar(select(Brand).where(
        Brand.id == brand_id, Brand.tenant_id == ctx.tenant_id
    ))
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    await db.delete(brand)
    await db.commit()


# ==========================================
# Units of Measure
# ==========================================

DEFAULT_UOMS = [
    {"name": "Pieces", "abbreviation": "pcs", "description": "Individual unit or item count"},
    {"name": "Kilograms", "abbreviation": "kg", "description": "Unit of mass (weight)"},
    {"name": "Grams", "abbreviation": "g", "description": "Unit of mass (weight)"},
    {"name": "Liters", "abbreviation": "L", "description": "Unit of liquid volume"},
    {"name": "Milliliters", "abbreviation": "ml", "description": "Unit of liquid volume"},
    {"name": "Meters", "abbreviation": "m", "description": "Unit of length"},
    {"name": "Centimeters", "abbreviation": "cm", "description": "Unit of length"},
    {"name": "Box", "abbreviation": "box", "description": "Box container packaging"},
    {"name": "Pack", "abbreviation": "pk", "description": "Pack or packet packaging"},
    {"name": "Carton", "abbreviation": "ctn", "description": "Carton or case bulk packaging"},
    {"name": "Dozen", "abbreviation": "doz", "description": "Set of 12 items"},
    {"name": "Set", "abbreviation": "set", "description": "Composite set of items"},
]

async def auto_seed_default_uoms(db: AsyncSession, tenant_id: uuid.UUID):
    existing_count = await db.scalar(
        select(func.count()).select_from(UnitOfMeasure).where(UnitOfMeasure.tenant_id == tenant_id)
    )
    if (existing_count or 0) == 0:
        for uom_def in DEFAULT_UOMS:
            uom = UnitOfMeasure(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name=uom_def["name"],
                abbreviation=uom_def["abbreviation"],
                description=uom_def["description"],
                status=EntityStatus.ACTIVE,
            )
            db.add(uom)
        await db.commit()

@router.get("/uoms", response_model=PaginatedResponse[UnitOfMeasureResponse])
async def list_uoms(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    query = select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == ctx.tenant_id)
    if search:
        query = query.where(UnitOfMeasure.name.ilike(f"%{search}%") | UnitOfMeasure.abbreviation.ilike(f"%{search}%"))
        
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    if (total or 0) == 0 and not search:
        await auto_seed_default_uoms(db, ctx.tenant_id)
        query = select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == ctx.tenant_id)
        total = await db.scalar(select(func.count()).select_from(query.subquery()))

    result = await db.execute(
        query.order_by(UnitOfMeasure.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)



@router.post("/uoms", response_model=UnitOfMeasureResponse, status_code=status.HTTP_201_CREATED)
async def create_uom(
    payload: UnitOfMeasureCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    uom = UnitOfMeasure(
        tenant_id=ctx.tenant_id,
        name=payload.name,
        abbreviation=payload.abbreviation,
        description=payload.description,
        status=_parse_status(payload.status or "active"),
    )
    db.add(uom)
    await db.flush()
    await db.commit()
    return uom


@router.delete("/uoms/{uom_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_uom(
    uom_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    uom = await db.scalar(select(UnitOfMeasure).where(
        UnitOfMeasure.id == uom_id, UnitOfMeasure.tenant_id == ctx.tenant_id
    ))
    if not uom:
        raise HTTPException(status_code=404, detail="UOM not found")
    await db.delete(uom)
    await db.commit()


# ==========================================
# Products
# ==========================================

@router.get("/products", response_model=PaginatedResponse[ProductResponse])
@cache_response(expire=60, prefix="pos_products")
async def list_products(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: str | None = None,
    category_id: uuid.UUID | None = None,
    brand_id: uuid.UUID | None = None,
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
):
    query = (
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand), selectinload(Product.uom))
        .where(Product.tenant_id == ctx.tenant_id)
    )
    
    if search:
        words = [w.strip() for w in search.strip().split() if w.strip()]
        if words:
            conditions = []
            for w in words:
                like = f"%{w}%"
                conditions.append(
                    Product.name.ilike(like) | Product.sku.ilike(like) | Product.barcode.ilike(like)
                )
            from sqlalchemy import and_
            query = query.where(and_(*conditions))
    if category_id:
        query = query.where(Product.category_id == category_id)
    if brand_id:
        query = query.where(Product.brand_id == brand_id)
        
    total = await db.scalar(select(func.count()).select_from(query.subquery()))

    sort_col = Product.name
    if sort_by == "sku":
        sort_col = Product.sku
    elif sort_by == "created_at":
        sort_col = Product.created_at
    elif sort_by == "mrp":
        sort_col = Product.mrp
    elif sort_by == "selling_price":
        sort_col = Product.selling_price

    if sort_order.lower() == "desc":
        order_clause = sort_col.desc()
    else:
        order_clause = sort_col.asc()

    result = await db.execute(
        query.order_by(order_clause, Product.id.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    products = result.scalars().all()

    
    out = []
    for p in products:
        d = ProductResponse.model_validate(p)
        d.category_name = p.category.name if p.category else None
        d.brand_name = p.brand.name if p.brand else None
        d.uom_name = p.uom.name if p.uom else None
        out.append(d)
        
    return paginate(out, total or 0, page, page_size)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = payload.model_dump()
    brand_name = data.pop("brand", None)
    data["status"] = _parse_status(data.get("status") or "active")

    # Sync / Find Brand
    brand_id = data.get("brand_id")
    if brand_name and brand_name.strip():
        b_name = brand_name.strip()
        b_res = await db.execute(select(Brand).where(Brand.tenant_id == ctx.tenant_id, Brand.name.ilike(b_name)))
        existing_brand = b_res.scalars().first()
        if existing_brand:
            brand_id = existing_brand.id
        else:
            new_brand = Brand(id=uuid.uuid4(), tenant_id=ctx.tenant_id, name=b_name, status=EntityStatus.ACTIVE)
            db.add(new_brand)
            await db.flush()
            brand_id = new_brand.id
    data["brand_id"] = brand_id


    barcode = (data.get("barcode") or "").strip()
    name = (data.get("name") or "").strip()

    existing_prod = None
    if barcode:
        stmt = select(Product).where(Product.tenant_id == ctx.tenant_id, Product.barcode == barcode)
        res = await db.execute(stmt)
        existing_prod = res.scalars().first()

    if not existing_prod and name:
        stmt = select(Product).where(Product.tenant_id == ctx.tenant_id, func.lower(Product.name) == name.lower())
        res = await db.execute(stmt)
        existing_prod = res.scalars().first()

    if existing_prod:
        added_stock = data.get("initial_stock") or 1
        existing_prod.initial_stock = (existing_prod.initial_stock or 0) + added_stock
        if data.get("mrp"):
            existing_prod.mrp = data["mrp"]
        if data.get("selling_price"):
            existing_prod.selling_price = data["selling_price"]
        if data.get("purchase_price"):
            existing_prod.purchase_price = data["purchase_price"]
        if brand_id:
            existing_prod.brand_id = brand_id

        await db.commit()
        await db.refresh(existing_prod, ["category", "brand", "uom"])
        product = existing_prod
    else:
        product = Product(
            tenant_id=ctx.tenant_id,
            **data
        )
        db.add(product)
        await db.flush()
        await db.refresh(product, ["category", "brand", "uom"])

    # Cache in global master catalog if it has a barcode and doesn't exist yet
    if product.barcode and product.barcode.strip():
        clean_barcode = product.barcode.strip()
        existing_mc_res = await db.execute(
            select(MasterCatalogProduct).where(MasterCatalogProduct.barcode == clean_barcode)
        )
        existing_mc = existing_mc_res.scalars().first()
        if not existing_mc:
            # Decide if enrichment is needed: no image or no specs means we enqueue for background AI fetch
            needs_enrichment = not (product.image_url and product.short_description)
            new_mc = MasterCatalogProduct(
                id=uuid.uuid4(),
                tenant_id=None,
                name=product.name,
                brand=product.brand.name if product.brand else "General",
                barcode=clean_barcode,
                sku_code=product.sku,
                hsn_code="150990",  # General default
                cost_price=product.purchase_price or 0.0,
                mrp=product.mrp or 0.0,
                sale_price=product.selling_price or product.mrp or 0.0,
                weight="Standard",
                quantity=1.0,
                tax=product.tax_percent or 18.0,
                type="CGST + SGST",
                category=product.category.name if product.category else "General",
                sub_category=product.category.name if product.category else "General",
                short_description=product.short_description or "",
                specifications="Created from tenant inventory",
                source="AI_WEB_SEARCH",
                ai_search_done=not needs_enrichment,
                rag_status="pending" if needs_enrichment else "completed",
            )
            db.add(new_mc)
        elif not existing_mc.ai_search_done:
            # Already in catalog but not yet enriched — leave it in queue
            pass
        else:
            # Already enriched catalog entry exists — mark for re-enrichment if local product has no image
            if not (product.image_url and product.short_description):
                existing_mc.ai_search_done = False
                existing_mc.rag_status = "pending"

    await db.commit()
    
    product = await db.scalar(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.brand),
            selectinload(Product.uom)
        )
        .where(Product.id == product.id)
    )
    
    res = ProductResponse.model_validate(product)
    res.category_name = product.category.name if product.category else None
    res.brand_name = product.brand.name if product.brand else None
    res.uom_name = product.uom.name if product.uom else None
    
    # Invalidate products cache
    await invalidate_cache_by_prefix("pos_products")
    
    return res


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    product = await db.scalar(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand), selectinload(Product.uom))
        .where(Product.id == product_id, Product.tenant_id == ctx.tenant_id)
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = payload.model_dump(exclude_unset=True)
    
    if "brand" in updates:
        brand_name = updates.pop("brand", None)
        if brand_name and brand_name.strip():
            b_name = brand_name.strip()
            b_res = await db.execute(select(Brand).where(Brand.tenant_id == ctx.tenant_id, Brand.name.ilike(b_name)))
            existing_brand = b_res.scalars().first()
            if existing_brand:
                product.brand_id = existing_brand.id
            else:
                new_brand = Brand(id=uuid.uuid4(), tenant_id=ctx.tenant_id, name=b_name, status=EntityStatus.ACTIVE)
                db.add(new_brand)
                await db.flush()
                product.brand_id = new_brand.id


    if "status" in updates and updates["status"]:
        updates["status"] = _parse_status(updates["status"])
        
    for key, value in updates.items():
        setattr(product, key, value)

    # Cache in global master catalog if it has a barcode and doesn't exist yet
    if product.barcode and product.barcode.strip():
        clean_barcode = product.barcode.strip()
        existing_mc_res = await db.execute(
            select(MasterCatalogProduct).where(MasterCatalogProduct.barcode == clean_barcode)
        )
        if not existing_mc_res.scalars().first():
            new_mc = MasterCatalogProduct(
                id=uuid.uuid4(),
                tenant_id=None,
                name=product.name,
                brand=product.brand.name if product.brand else "General",
                barcode=clean_barcode,
                sku_code=product.sku,
                hsn_code="150990",  # General default
                cost_price=product.purchase_price or 0.0,
                mrp=product.mrp or 0.0,
                sale_price=product.selling_price or product.mrp or 0.0,
                weight="Standard",
                quantity=1.0,
                tax=product.tax_percent or 18.0,
                type="CGST + SGST",
                category=product.category.name if product.category else "General",
                sub_category=product.category.name if product.category else "General",
                short_description=product.short_description or "",
                specifications="Updated from tenant inventory",
                source="AI_WEB_SEARCH"
            )
            db.add(new_mc)

    await db.commit()
    
    product = await db.scalar(
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.brand),
            selectinload(Product.uom)
        )
        .where(Product.id == product.id)
    )
    
    res = ProductResponse.model_validate(product)
    res.category_name = product.category.name if product.category else None
    res.brand_name = product.brand.name if product.brand else None
    res.uom_name = product.uom.name if product.uom else None
    
    # Invalidate products cache
    await invalidate_cache_by_prefix("pos_products")
    
    return res


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    product = await db.scalar(select(Product).where(
        Product.id == product_id, Product.tenant_id == ctx.tenant_id
    ))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
    await db.commit()
    
    # Invalidate products cache
    await invalidate_cache_by_prefix("pos_products")


@router.post("/products/master-import", response_model=MasterProductBulkResponse, status_code=status.HTTP_201_CREATED)
async def master_import_products(
    payload: MasterProductBulkCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant_id = ctx.tenant_id
    
    # 1. Collect unique names
    brand_names = {item.brand_name.strip() for item in payload.items if item.brand_name and item.brand_name.strip()}
    category_names = {item.category_name.strip() for item in payload.items if item.category_name and item.category_name.strip()}
    sub_category_names = {(item.category_name.strip(), item.sub_category_name.strip()) for item in payload.items if item.category_name and item.category_name.strip() and item.sub_category_name and item.sub_category_name.strip()}
    uom_names = {item.uom_name.strip() for item in payload.items if item.uom_name and item.uom_name.strip()}

    brands_created = 0
    categories_created = 0
    uoms_created = 0
    products_created = 0
    skipped_count = 0
    errors = []

    # 2. Sync Brands
    brand_map = {}
    if brand_names:
        existing_brands = await db.execute(select(Brand).where(Brand.tenant_id == tenant_id, Brand.name.in_(brand_names)))
        for b in existing_brands.scalars().all():
            brand_map[b.name.lower()] = b.id
        
        for b_name in brand_names:
            if b_name.lower() not in brand_map:
                new_brand = Brand(id=uuid.uuid4(), tenant_id=tenant_id, name=b_name, status=EntityStatus.ACTIVE)
                db.add(new_brand)
                brand_map[b_name.lower()] = new_brand.id
                brands_created += 1

    # 3. Sync Categories (Only map existing categories, DO NOT auto-create new categories during import!)
    category_map = {}
    if category_names:
        existing_cats = await db.execute(select(ProductCategory).where(ProductCategory.tenant_id == tenant_id, ProductCategory.name.in_(category_names)))
        for c in existing_cats.scalars().all():
            category_map[c.name.lower()] = c.id
                
    # 4. Sync Sub Categories (Only map existing sub-categories, DO NOT auto-create new sub-categories during import!)
    sub_category_map = {}
    if sub_category_names:
        sub_cat_names_only = {sub for (_, sub) in sub_category_names}
        existing_sub_cats = await db.execute(select(ProductCategory).where(ProductCategory.tenant_id == tenant_id, ProductCategory.name.in_(sub_cat_names_only), ProductCategory.parent_id.isnot(None)))
        for sc in existing_sub_cats.scalars().all():
            sub_category_map[sc.name.lower()] = sc.id

    # Flush to get IDs for inserts
    await db.flush()

    # 4.5 Sync UOMs
    uom_map = {}
    if uom_names:
        existing_uoms = await db.execute(select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == tenant_id, UnitOfMeasure.name.in_(uom_names)))
        for u in existing_uoms.scalars().all():
            uom_map[u.name.lower()] = u.id
            
        for u_name in uom_names:
            if u_name.lower() not in uom_map:
                new_uom = UnitOfMeasure(id=uuid.uuid4(), tenant_id=tenant_id, name=u_name, abbreviation=u_name[:20], status=EntityStatus.ACTIVE)
                db.add(new_uom)
                uom_map[u_name.lower()] = new_uom.id
                uoms_created += 1

    await db.flush()

    # 4.6 HSN Code & GST Tax Schedule Lookup
    hsn_codes = {item.hsn_code.strip() for item in payload.items if item.hsn_code and item.hsn_code.strip()}
    hsn_tax_map = {}
    if hsn_codes:
        hsn_res = await db.execute(select(HSNMaster.hsn_code, HSNMaster.gst_rate).where(HSNMaster.hsn_code.in_(hsn_codes)))
        for hsn_c, gst_r in hsn_res.all():
            hsn_tax_map[hsn_c.strip()] = float(gst_r)

    # 5. Check existing SKUs
    all_skus = {item.sku for item in payload.items if item.sku}
    existing_skus = set()
    if all_skus:
        existing_res = await db.execute(select(Product.sku).where(Product.tenant_id == tenant_id, Product.sku.in_(all_skus)))
        existing_skus = {sku for sku in existing_res.scalars().all()}

    # 6. Create Products
    for item in payload.items:
        if item.sku in existing_skus:
            skipped_count += 1
            continue

        brand_id = None
        if item.brand_name and item.brand_name.strip():
            brand_id = brand_map.get(item.brand_name.strip().lower())
            
        category_id = None
        if item.sub_category_name and item.sub_category_name.strip():
            category_id = sub_category_map.get(item.sub_category_name.strip().lower())
        elif item.category_name and item.category_name.strip():
            category_id = category_map.get(item.category_name.strip().lower())

        uom_id = None
        if item.uom_name and item.uom_name.strip():
            uom_id = uom_map.get(item.uom_name.strip().lower())

        item_hsn = item.hsn_code.strip() if item.hsn_code and item.hsn_code.strip() else None
        item_tax = item.tax_percent or 0.0
        if item_hsn and (not item_tax or item_tax == 0.0):
            if item_hsn in hsn_tax_map:
                item_tax = hsn_tax_map[item_hsn]

        new_product = Product(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name=item.name,
            sku=item.sku,
            barcode=item.barcode,
            hsn_code=item_hsn,
            short_description=item.short_description,
            long_description=item.long_description,
            brand_id=brand_id,
            category_id=category_id,
            uom_id=uom_id,
            purchase_price=item.purchase_price,
            mrp=item.mrp,
            selling_price=item.selling_price,
            wholesale_price=item.wholesale_price or 0.0,
            min_wholesale_qty=item.min_wholesale_qty or 1,
            tax_percent=item_tax,
            discount_limit=item.discount_limit,
            initial_stock=item.initial_stock,
            reorder_level=item.reorder_level,
            safety_stock=item.safety_stock,
            status=_parse_status(item.status) if item.status else EntityStatus.ACTIVE
        )
        db.add(new_product)
        products_created += 1
        existing_skus.add(item.sku)

        # Cache in global master catalog if we can resolve a valid barcode
        clean_barcode = None
        if item.barcode and item.barcode.strip():
            clean_barcode = item.barcode.strip()
        elif item.sku and item.sku.strip().isdigit() and len(item.sku.strip()) in [8, 12, 13, 14]:
            clean_barcode = item.sku.strip()

        if clean_barcode:
            existing_mc_res = await db.execute(
                select(MasterCatalogProduct).where(MasterCatalogProduct.barcode == clean_barcode)
            )
            existing_mc = existing_mc_res.scalars().first()
            if existing_mc:
                # Instant enrichment from pre-existing Master Catalog match
                is_generic = (
                    not new_product.name or
                    new_product.name.strip().lower() in ("unnamed product", "unnamed", "none", "null") or
                    new_product.name.startswith("SKU-")
                )
                if is_generic and existing_mc.name and not existing_mc.name.strip().lower().startswith("unnamed"):
                    new_product.name = existing_mc.name.strip()
                if existing_mc.image_url and not new_product.image_url:
                    new_product.image_url = existing_mc.image_url
                if existing_mc.short_description and not new_product.short_description:
                    new_product.short_description = existing_mc.short_description
                if (not new_product.mrp or new_product.mrp == 0) and existing_mc.mrp and existing_mc.mrp > 0:
                    new_product.mrp = existing_mc.mrp
                if (not new_product.selling_price or new_product.selling_price == 0) and existing_mc.sale_price and existing_mc.sale_price > 0:
                    new_product.selling_price = existing_mc.sale_price

            if not existing_mc:
                # Products imported without images/specs are always queued for background AI enrichment
                new_mc = MasterCatalogProduct(
                    id=uuid.uuid4(),
                    tenant_id=None,
                    name=new_product.name or item.name,
                    brand=item.brand_name.strip() if item.brand_name else "General",
                    barcode=clean_barcode,
                    sku_code=item.sku,
                    hsn_code="150990",
                    cost_price=item.purchase_price or 0.0,
                    mrp=item.mrp or 0.0,
                    sale_price=item.selling_price or 0.0,
                    weight=item.uom_name or "Standard",
                    quantity=1.0,
                    tax=item.tax_percent or 18.0,
                    type="CGST + SGST",
                    category=item.category_name.strip() if item.category_name else "General",
                    sub_category=item.sub_category_name.strip() if item.sub_category_name else "General",
                    short_description=item.short_description or "",
                    specifications="Imported from bulk Excel/CSV upload — pending AI enrichment",
                    source="AI_WEB_SEARCH",
                    ai_search_done=False,
                    rag_status="pending",
                )
                db.add(new_mc)
            elif not existing_mc.ai_search_done:
                # Already queued — leave it
                pass

            else:
                # Re-queue if item was imported with minimal info
                needs_enrichment = not (item.short_description and item.mrp and item.mrp > 0)
                if needs_enrichment:
                    existing_mc.ai_search_done = False
                    existing_mc.rag_status = "pending"

    await db.commit()
    
    # Invalidate products & categories cache
    await invalidate_cache_by_prefix("pos_products")
    await invalidate_cache_by_prefix("pos_categories")

    return MasterProductBulkResponse(
        products_created=products_created,
        brands_created=brands_created,
        categories_created=categories_created,
        uoms_created=uoms_created,
        skipped_count=skipped_count,
        errors=errors
    )


@router.post("/products/upload-image")
async def upload_product_image(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    file: UploadFile = File(...)
):
    import os
    import shutil

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) # backend
    images_dir = os.path.join(base_dir, "images")
    os.makedirs(images_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"prod_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(images_dir, filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"image_url": f"/images/{filename}"}



# ==========================================
# Public Storefront Endpoints
# ==========================================

async def get_public_tenant_id(
    db: AsyncSession = Depends(get_db),
    x_tenant_id: str | None = Header(None)
) -> uuid.UUID | None:
    """For multi-tenant marketplace, returns a specific tenant ID only when
    explicitly requested via X-Tenant-Id header.  Returns None to indicate
    'show all tenants'."""
    if x_tenant_id:
        try:
            return uuid.UUID(x_tenant_id)
        except ValueError:
            pass
    return None


@router.get("/public/categories", response_model=PaginatedResponse[ProductCategoryResponse], tags=["Storefront Public"])
async def list_public_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    x_tenant_id: str | None = Header(None),
):
    """Returns distinct active product categories across ALL tenants (or one tenant if X-Tenant-Id sent)."""
    query = select(ProductCategory).where(
        ProductCategory.status == EntityStatus.ACTIVE
    )
    if x_tenant_id:
        try:
            query = query.where(ProductCategory.tenant_id == uuid.UUID(x_tenant_id))
        except ValueError:
            pass

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ProductCategory.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(result.scalars().all(), total or 0, page, page_size)


@router.get("/public/products", response_model=PaginatedResponse[PublicProductResponse], tags=["Storefront Public"])
async def list_public_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    category_id: str | None = None,
    search: str | None = None,
    x_tenant_id: str | None = Header(None),
):
    """Returns products from ALL tenants for the marketplace storefront.
    Optionally filtered to one tenant via X-Tenant-Id header.
    This enables the Amazon-style marketplace where every tenant's inventory
    is visible to shoppers."""
    from src.models import Tenant

    query = select(Product).options(
        selectinload(Product.category),
        selectinload(Product.brand),
        selectinload(Product.images),
        selectinload(Product.variants)
    ).where(
        Product.status == EntityStatus.ACTIVE
    )

    # Filter to specific tenant if requested
    if x_tenant_id:
        try:
            query = query.where(Product.tenant_id == uuid.UUID(x_tenant_id))
        except ValueError:
            pass

    if category_id:
        try:
            query = query.where(Product.category_id == uuid.UUID(category_id))
        except ValueError:
            pass

    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Product.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )

    products = result.scalars().all()

    # Build a quick tenant-name lookup to avoid N+1 queries
    tenant_ids = list({p.tenant_id for p in products if p.tenant_id})
    tenant_names: dict[uuid.UUID, str] = {}
    if tenant_ids:
        t_result = await db.execute(
            select(Tenant.id, Tenant.name).where(Tenant.id.in_(tenant_ids))
        )
        tenant_names = {row.id: row.name for row in t_result.all()}

    response_items = []
    for p in products:
        response_items.append(PublicProductResponse(
            id=p.id,
            name=p.name,
            sku=p.sku,
            category_name=p.category.name if p.category else None,
            brand=p.brand.name if p.brand else None,
            short_description=p.short_description,
            image_url=p.image_url,
            mrp=float(p.mrp or 0),
            selling_price=float(p.selling_price or 0),
            stock=int(p.initial_stock or 0),
            seller_name=tenant_names.get(p.tenant_id),
            tenant_id=p.tenant_id,
            images=p.images,
            variants=p.variants
        ))

    return paginate(response_items, total or 0, page, page_size)
