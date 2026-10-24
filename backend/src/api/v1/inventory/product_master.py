import uuid
import re
import random
from datetime import datetime, date
from typing import Annotated, Optional, List, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, Header, UploadFile, File
from sqlalchemy import func, select, Text, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import CurrentUserContext, require_any_permission, require_permission
from src.database.init_db import write_audit_log
from src.database.session import get_db
from src.models import EntityStatus, Company
from src.models.inventory import (
    ProductCategory, Brand, UnitOfMeasure, Product, MasterCatalogProduct,
    InventoryBatch, TraceabilityEvent, Warehouse
)
from src.schemas.inventory import (
    ProductCategoryCreate, ProductCategoryResponse, ProductCategoryUpdate,
    ProductCategoryBulkCreate, ProductCategoryBulkResponse,
    BrandCreate, BrandResponse, BrandUpdate,
    UnitOfMeasureCreate, UnitOfMeasureResponse, UnitOfMeasureUpdate,
    ProductCreate, ProductResponse, ProductUpdate,
    ProductBulkDeleteRequest, ProductBulkDeleteResponse,
    MasterProductBulkCreate, MasterProductBulkResponse, MasterProductImportItem,
    PublicProductResponse
)
from src.utils.pagination import PaginatedResponse, paginate
from src.utils.redis_cache import cache_response, invalidate_cache_by_prefix

router = APIRouter()

def _parse_status(value: Any) -> EntityStatus:
    if value is None or value == "":
        return EntityStatus.ACTIVE
    s = str(value).strip().lower()
    if s in ("active", "true", "1", "yes", "y", "enable", "enabled", "on", "valid", "published"):
        return EntityStatus.ACTIVE
    if s in ("inactive", "false", "0", "no", "n", "disable", "disabled", "off", "invalid"):
        return EntityStatus.INACTIVE
    if s in ("draft", "pending"):
        return EntityStatus.DRAFT
    if s in ("archived", "deleted", "archive"):
        return EntityStatus.ARCHIVED
    try:
        return EntityStatus(s)
    except Exception:
        return EntityStatus.ACTIVE

import json
import os
import base64
from pathlib import Path

def _save_base64_image_if_present(image_url: str | None) -> str | None:
    if not image_url or not isinstance(image_url, str):
        return image_url
    if image_url.startswith("data:image/") and ";base64," in image_url:
        try:
            header, encoded = image_url.split(";base64,", 1)
            ext = "png"
            if "jpeg" in header or "jpg" in header:
                ext = "jpg"
            elif "webp" in header:
                ext = "webp"
            elif "svg" in header:
                ext = "svg"

            backend_dir = Path(__file__).resolve().parents[4]
            upload_dir = backend_dir / "upload_images"
            images_dir = backend_dir / "images"
            upload_dir.mkdir(parents=True, exist_ok=True)
            images_dir.mkdir(parents=True, exist_ok=True)

            filename = f"prod_{uuid.uuid4().hex}.{ext}"
            file_path = upload_dir / filename
            images_path = images_dir / filename
            decoded_bytes = base64.b64decode(encoded)
            with open(file_path, "wb") as f:
                f.write(decoded_bytes)
            with open(images_path, "wb") as f:
                f.write(decoded_bytes)
            return f"/upload_images/{filename}"
        except Exception as e:
            print(f"Failed to decode and save base64 image: {e}")
            return image_url
    return image_url

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


@router.post("/suggest-hsn")
@router.post("/products/suggest-hsn")
async def suggest_hsn(
    payload: dict,
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Real-Time AI HSN & GST Suggestion: Uses Gemini AI and official GST master tables
    to dynamically determine the official Indian GST HSN Code, Tax Rate, UOM, and Tax-Inclusive status in real-time.
    """
    import httpx
    from src.config.settings import get_settings
    settings = get_settings()

    name = (payload.get("name") or payload.get("product_name") or "").strip()
    cat = (payload.get("category") or "").strip()
    desc = (payload.get("description") or "").strip()

    if not name and not cat:
        raise HTTPException(status_code=400, detail="Product name or category required for real-time AI classification.")

    # 1. Real-Time Gemini AI Model Query (Live)
    if settings.gemini_api_key:
        try:
            prompt = f"""You are an Indian Retail Product, GST and HSN/SAC Classification System.
Classify the following product into its accurate Official Indian GST HSN Code, applicable GST Council Tax Rate (0, 5, 12, 18, or 28), standard commercial UOM, whether Indian retail MRP is tax-inclusive, and the typical Indian Market MRP (in INR ₹), Retail Selling Price (in INR ₹), Wholesale Bulk Price (in INR ₹, typically 15-20% below retail), and B2B Distributor/Institutional Contract Price (in INR ₹, typically 25-35% below retail).

Product Name: "{name}"
Category: "{cat}"
Description: "{desc}"

Respond with ONLY a valid JSON object matching this schema:
{{
  "hsn_code": "Official 4 to 8 digit HSN code string",
  "gst_rate": 18.0,
  "description": "Official commodity description",
  "category": "Official Retail Category",
  "uom": "Standard Unit e.g. Pcs, Kg, Ltr, Btl, Box, Pack, Strip, Unit",
  "is_tax_inclusive": true,
  "estimated_mrp": 240.0,
  "estimated_selling_price": 200.0,
  "estimated_wholesale_price": 165.0,
  "estimated_b2b_price": 140.0,
  "confidence": 0.98
}}"""
            model = getattr(settings, "gemini_model", "gemini-3.6-flash") or "gemini-3.6-flash"
            async with httpx.AsyncClient(timeout=9.0) as client:
                ai_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.gemini_api_key}"
                ai_resp = await client.post(
                    ai_url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.05, "responseMimeType": "application/json"}
                    }
                )
                if ai_resp.status_code == 200:
                    ai_data = ai_resp.json()
                    candidates = ai_data.get("candidates", [])
                    if candidates and candidates[0].get("content", {}).get("parts"):
                        raw_text = candidates[0]["content"]["parts"][0]["text"]
                        parsed = json.loads(raw_text)
                        if parsed.get("hsn_code") and parsed.get("gst_rate") is not None:
                            ai_mrp = float(parsed.get("estimated_mrp") or 0.0)
                            ai_price = float(parsed.get("estimated_selling_price") or 0.0)
                            ai_ws = float(parsed.get("estimated_wholesale_price") or 0.0)
                            ai_b2b = float(parsed.get("estimated_b2b_price") or 0.0)

                            if ai_price <= 0 and ai_mrp > 0:
                                ai_price = round(ai_mrp * 0.85, 2)
                            elif ai_mrp <= 0 and ai_price > 0:
                                ai_mrp = round(ai_price * 1.25, 2)
                            elif ai_price <= 0 and ai_mrp <= 0:
                                ai_mrp = 220.0
                                ai_price = 190.0

                            if ai_ws <= 0:
                                ai_ws = round(ai_price * 0.82, 2)
                            if ai_b2b <= 0:
                                ai_b2b = round(ai_price * 0.70, 2)

                            return {
                                "success": True,
                                "found": True,
                                "is_realtime_ai": True,
                                "hsn_code": str(parsed["hsn_code"]).strip(),
                                "gst_rate": float(parsed["gst_rate"]),
                                "description": parsed.get("description", "Indian GST Council Classification"),
                                "category": parsed.get("category", cat or "General Retail"),
                                "uom": parsed.get("uom", "Pcs"),
                                "is_tax_inclusive": bool(parsed.get("is_tax_inclusive", True)),
                                "estimated_mrp": ai_mrp,
                                "estimated_selling_price": ai_price,
                                "estimated_wholesale_price": ai_ws,
                                "estimated_b2b_price": ai_b2b,
                                "confidence": float(parsed.get("confidence", 0.98))
                            }
        except Exception as ai_err:
            print(f"Realtime Gemini AI HSN classification note: {ai_err}")

    # Helper for realistic keyword-based 3-tier price estimation (MRP, Retail, Wholesale, B2B)
    def get_market_estimate(pname: str):
        p = pname.lower()
        if any(w in p for w in ["toothbrush", "brush", "tongue"]):
            return 65.0, 55.0, 45.0, 38.0
        if any(w in p for w in ["toothpaste", "paste", "dant"]):
            return 120.0, 105.0, 88.0, 75.0
        if any(w in p for w in ["tea", "yerba", "mate", "chai", "coffee", "brew"]):
            return 240.0, 200.0, 165.0, 140.0
        if any(w in p for w in ["biscuit", "cookie", "rusk", "bread", "pain", "cake", "snack"]):
            return 160.0, 135.0, 110.0, 92.0
        if any(w in p for w in ["shampoo", "serum", "conditioner", "perfume", "deodorant"]):
            return 290.0, 245.0, 200.0, 170.0
        if any(w in p for w in ["soap", "wash", "gel", "lotion"]):
            return 85.0, 75.0, 60.0, 50.0
        if any(w in p for w in ["oil", "ghee", "butter"]):
            return 210.0, 185.0, 155.0, 135.0
        if any(w in p for w in ["rice", "grain", "atta", "dal", "pulses"]):
            return 95.0, 82.0, 68.0, 58.0
        if any(w in p for w in ["chocolate", "candy", "sweet"]):
            return 110.0, 95.0, 78.0, 65.0
        return 175.0, 150.0, 125.0, 105.0

    # 2. Real-Time Database Search across HSN Master Table
    try:
        search_words = [w for w in name.split() if len(w) > 2]
        for word in search_words:
            res = await db.execute(
                select(HSNMaster).where(
                    or_(
                        HSNMaster.description.ilike(f"%{word}%"),
                        HSNMaster.hsn_code.ilike(f"%{word}%")
                    )
                ).limit(1)
            )
            match = res.scalar_one_or_none()
            if match:
                est_mrp, est_sp, est_ws, est_b2b = get_market_estimate(name)
                return {
                    "success": True,
                    "found": True,
                    "is_realtime_ai": False,
                    "hsn_code": match.hsn_code,
                    "gst_rate": float(match.gst_rate),
                    "description": match.description,
                    "category": cat or "General Goods",
                    "uom": "Pcs",
                    "is_tax_inclusive": True,
                    "estimated_mrp": est_mrp,
                    "estimated_selling_price": est_sp,
                    "estimated_wholesale_price": est_ws,
                    "estimated_b2b_price": est_b2b,
                    "confidence": 0.90
                }
    except Exception as db_err:
        print(f"HSN database lookup note: {db_err}")

    # 3. Dynamic Category Fallback
    est_mrp, est_sp, est_ws, est_b2b = get_market_estimate(name)
    combined = f"{name.lower()} {cat.lower()}"
    if any(k in combined for k in ["butter", "ghee", "cheese", "paneer", "dairy"]):
        return {"success": True, "found": True, "hsn_code": "0405", "gst_rate": 12.0, "description": "Dairy spreads, butter and fats", "category": "Dairy Products", "uom": "Gm", "is_tax_inclusive": True, "estimated_mrp": est_mrp, "estimated_selling_price": est_sp, "estimated_wholesale_price": est_ws, "estimated_b2b_price": est_b2b, "confidence": 0.95}
    if any(k in combined for k in ["milk"]):
        return {"success": True, "found": True, "hsn_code": "0401", "gst_rate": 5.0, "description": "Fresh milk and cream", "category": "Dairy & Milk", "uom": "Ltr", "is_tax_inclusive": True, "estimated_mrp": 68.0, "estimated_selling_price": 64.0, "estimated_wholesale_price": 54.0, "estimated_b2b_price": 48.0, "confidence": 0.95}
    if any(k in combined for k in ["shampoo", "hair oil", "serum", "conditioner", "soap", "paste", "brush"]):
        return {"success": True, "found": True, "hsn_code": "3305", "gst_rate": 18.0, "description": "Personal care preparations", "category": "Personal Care", "uom": "Btl", "is_tax_inclusive": True, "estimated_mrp": est_mrp, "estimated_selling_price": est_sp, "estimated_wholesale_price": est_ws, "estimated_b2b_price": est_b2b, "confidence": 0.95}
    if any(k in combined for k in ["biscuit", "cookie", "rusk", "bread", "pain", "cake", "snack"]):
        return {"success": True, "found": True, "hsn_code": "1905", "gst_rate": 18.0, "description": "Biscuits, bakery and bakers' wares", "category": "Bakery", "uom": "Pcs", "is_tax_inclusive": True, "estimated_mrp": est_mrp, "estimated_selling_price": est_sp, "estimated_wholesale_price": est_ws, "estimated_b2b_price": est_b2b, "confidence": 0.95}
    if any(k in combined for k in ["rice", "grain", "flour", "atta"]):
        return {"success": True, "found": True, "hsn_code": "1006", "gst_rate": 5.0, "description": "Rice and grains", "category": "Staples", "uom": "Kg", "is_tax_inclusive": True, "estimated_mrp": est_mrp, "estimated_selling_price": est_sp, "estimated_wholesale_price": est_ws, "estimated_b2b_price": est_b2b, "confidence": 0.95}
    if any(k in combined for k in ["oil"]):
        return {"success": True, "found": True, "hsn_code": "1512", "gst_rate": 5.0, "description": "Edible cooking oils", "category": "Edible Oils", "uom": "Ltr", "is_tax_inclusive": True, "estimated_mrp": est_mrp, "estimated_selling_price": est_sp, "estimated_wholesale_price": est_ws, "estimated_b2b_price": est_b2b, "confidence": 0.95}

    return {
        "success": True,
        "found": True,
        "hsn_code": "1905",
        "gst_rate": 18.0,
        "description": "General Commercial Commodities",
        "category": cat or "General Retail",
        "uom": "Pcs",
        "is_tax_inclusive": True,
        "estimated_mrp": est_mrp,
        "estimated_selling_price": est_sp,
        "estimated_wholesale_price": est_ws,
        "estimated_b2b_price": est_b2b,
        "confidence": 0.80
    }


# ==========================================
# Product Categories
# ==========================================


@router.get("/categories", response_model=PaginatedResponse[ProductCategoryResponse])
async def list_product_categories(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    query = select(ProductCategory).where(ProductCategory.tenant_id == ctx.tenant_id)
    if ctx.active_company_id:
        query = query.where(or_(ProductCategory.company_id == ctx.active_company_id, ProductCategory.company_id == None))
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
        company_id=ctx.active_company_id,
        name=payload.name,
        category_code=cat_code,
        description=payload.description,
        parent_id=payload.parent_id,
        status=_parse_status(payload.status or "active"),
    )
    db.add(cat)
    await db.flush()
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
        update(Product).where(Product.tenant_id == ctx.tenant_id).values({Product.category_id: None})
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
    if ctx.active_company_id:
        query = query.where(or_(Brand.company_id == ctx.active_company_id, Brand.company_id == None))
    if search:
        query = query.where(Brand.name.ilike(f"%{search}%"))
        
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(Brand.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    brands = list(result.scalars().all())
    
    if brands:
        brand_ids = [b.id for b in brands]
        counts_res = await db.execute(
            select(Product.brand_id, func.count(Product.id))
            .where(Product.tenant_id == ctx.tenant_id, Product.brand_id.in_(brand_ids))
            .group_by(Product.brand_id)
        )
        counts_map = {row[0]: row[1] for row in counts_res.all()}
        for b in brands:
            b.products_count = counts_map.get(b.id, 0)
            
    return paginate(brands, total or 0, page, page_size)


@router.post("/brands", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    payload: BrandCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    brand = Brand(
        tenant_id=ctx.tenant_id,
        company_id=ctx.active_company_id,
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
        update(Product).where(Product.tenant_id == ctx.tenant_id).values({Product.brand_id: None})
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
    if ctx.active_company_id:
        query = query.where(or_(UnitOfMeasure.company_id == ctx.active_company_id, UnitOfMeasure.company_id == None))
    if search:
        query = query.where(UnitOfMeasure.name.ilike(f"%{search}%") | UnitOfMeasure.abbreviation.ilike(f"%{search}%"))
        
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    if (total or 0) == 0 and not search:
        await auto_seed_default_uoms(db, ctx.tenant_id)
        query = select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == ctx.tenant_id)
        if ctx.active_company_id:
            query = query.where(or_(UnitOfMeasure.company_id == ctx.active_company_id, UnitOfMeasure.company_id == None))
        total = await db.scalar(select(func.count()).select_from(query.subquery()))

    result = await db.execute(
        query.order_by(UnitOfMeasure.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    uoms = list(result.scalars().all())
    
    if uoms:
        uom_ids = [u.id for u in uoms]
        prod_q = select(Product.uom_id, func.count(Product.id)).where(Product.tenant_id == ctx.tenant_id, Product.uom_id.in_(uom_ids))
        if ctx.active_company_id:
            prod_q = prod_q.where(Product.company_id == ctx.active_company_id)
        counts_res = await db.execute(prod_q.group_by(Product.uom_id))
        counts_map = {row[0]: row[1] for row in counts_res.all()}
        for u in uoms:
            u.products_count = counts_map.get(u.id, 0)
            
    return paginate(uoms, total or 0, page, page_size)



@router.post("/uoms", response_model=UnitOfMeasureResponse, status_code=status.HTTP_201_CREATED)
async def create_uom(
    payload: UnitOfMeasureCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    uom = UnitOfMeasure(
        tenant_id=ctx.tenant_id,
        company_id=ctx.active_company_id,
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
async def list_products(
    ctx: Annotated[CurrentUserContext, Depends(require_any_permission("view:erp", "view:pos"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=50000),
    search: str | None = None,
    category_id: uuid.UUID | None = None,
    category_name: str | None = None,
    sub_category: str | None = None,
    brand_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    sort_by: str = Query("updated_at"),
    sort_order: str = Query("desc"),
):
    query = (
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand), selectinload(Product.uom))
        .where(Product.tenant_id == ctx.tenant_id)
    )
    
    target_company_id = company_id or ctx.active_company_id
    if target_company_id:
        if ctx.is_primary_company:
            query = query.where(or_(Product.company_id == target_company_id, Product.company_id == None))
        else:
            query = query.where(Product.company_id == target_company_id)
    
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
    elif category_name and category_name.strip():
        cat_term = f"%{category_name.strip()}%"
        query = query.outerjoin(ProductCategory, Product.category_id == ProductCategory.id).where(
            or_(
                ProductCategory.name.ilike(cat_term),
                func.cast(Product.specifications, Text).ilike(cat_term)
            )
        )
    if sub_category and sub_category.strip():
        sub_term = f"%{sub_category.strip()}%"
        query = query.where(func.cast(Product.specifications, Text).ilike(sub_term))
    if brand_id:
        query = query.where(Product.brand_id == brand_id)
        
    total = await db.scalar(select(func.count()).select_from(query.subquery()))

    sort_col = Product.updated_at
    s_by = (sort_by or "").lower().strip()
    if s_by == "name":
        sort_col = Product.name
    elif s_by in ("sku", "item_code", "code"):
        sort_col = Product.sku
    elif s_by == "barcode":
        sort_col = Product.barcode
    elif s_by in ("created_at", "last_added", "newest"):
        sort_col = Product.created_at
    elif s_by == "updated_at":
        sort_col = Product.updated_at
    elif s_by == "mrp":
        sort_col = Product.mrp
    elif s_by in ("selling_price", "price"):
        sort_col = Product.selling_price
    elif s_by in ("stock", "initial_stock", "on_hand_stock"):
        sort_col = Product.initial_stock

    if (sort_order or "").lower().strip() == "asc":
        order_clause = sort_col.asc()
    else:
        order_clause = sort_col.desc()

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
        d.stock = p.initial_stock
        d.current_stock = p.initial_stock
        out.append(d)
        
    return paginate(out, total or 0, page, page_size)


def _parse_date_safe(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, date):
        return datetime.combine(val, datetime.min.time())
    s = str(val).strip()
    if not s or s.lower() in ("none", "null", "undefined", "nan", ""):
        return None
    
    # Try ISO format
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        pass

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            continue
    return None


async def _sync_product_inventory_batch(
    db: AsyncSession,
    product: Product,
    raw_data: dict,
    ctx: CurrentUserContext,
) -> Optional[InventoryBatch]:
    try:
        specs = dict(product.specifications) if isinstance(product.specifications, dict) else {}
        if isinstance(raw_data.get("specifications"), dict):
            specs.update(raw_data["specifications"])

        batch_num = (
            specs.get("stock_batch_number")
            or raw_data.get("stock_batch_number")
            or specs.get("opening_stock_batch_number")
            or raw_data.get("opening_stock_batch_number")
            or specs.get("batch_number")
            or raw_data.get("batch_number")
            or ""
        )
        if isinstance(batch_num, str):
            batch_num = batch_num.strip()
        else:
            batch_num = str(batch_num).strip() if batch_num is not None else ""

        has_manual_batch = bool(
            specs.get("has_manual_batch")
            or raw_data.get("has_manual_batch")
        )

        expiry_raw = (
            specs.get("stock_batch_expiry_date")
            or raw_data.get("stock_batch_expiry_date")
            or specs.get("opening_stock_batch_expiry_date")
            or raw_data.get("opening_stock_batch_expiry_date")
            or specs.get("expiry_date")
            or raw_data.get("expiry_date")
        )

        mfg_raw = (
            specs.get("mfg_date")
            or raw_data.get("mfg_date")
            or specs.get("manufacturing_date")
            or raw_data.get("manufacturing_date")
        )

        # Only sync or generate a batch if batch tracking was explicitly requested or batch info provided
        if not batch_num and not has_manual_batch and not expiry_raw:
            return None

        # Auto-generate batch code if empty
        if not batch_num:
            today_str = datetime.utcnow().strftime("%Y%m%d")
            rand_suffix = f"{random.randint(1000, 9999)}"
            batch_num = f"BAT-{today_str}-{rand_suffix}"

        # Sync back to specifications
        specs["stock_batch_number"] = batch_num
        specs["has_manual_batch"] = True
        product.specifications = specs

        # Resolve warehouse
        wh_str = (product.warehouse or specs.get("warehouse") or raw_data.get("warehouse") or "").strip()
        warehouse_id = None
        warehouse_name = wh_str or None
        if wh_str:
            wh_uuid = None
            try:
                wh_uuid = uuid.UUID(wh_str)
            except Exception:
                pass
            if wh_uuid:
                wh_res = await db.execute(
                    select(Warehouse).where(
                        Warehouse.tenant_id == ctx.tenant_id,
                        Warehouse.id == wh_uuid,
                    )
                )
                target_wh = wh_res.scalars().first()
                if target_wh:
                    warehouse_id = target_wh.id
                    warehouse_name = target_wh.name
            if not warehouse_id:
                wh_res = await db.execute(
                    select(Warehouse).where(
                        Warehouse.tenant_id == ctx.tenant_id,
                        func.lower(Warehouse.name) == wh_str.lower(),
                    )
                )
                target_wh = wh_res.scalars().first()
                if target_wh:
                    warehouse_id = target_wh.id
                    warehouse_name = target_wh.name

        # Resolve UOM
        uom_name = "Pcs"
        if product.uom:
            uom_name = product.uom.name
        elif product.uom_id:
            u_res = await db.execute(select(UnitOfMeasure).where(UnitOfMeasure.id == product.uom_id))
            u_obj = u_res.scalars().first()
            if u_obj:
                uom_name = u_obj.name
        elif specs.get("uom") or specs.get("unit") or specs.get("sales_measuring_unit") or specs.get("purchase_measuring_unit"):
            uom_name = str(specs.get("uom") or specs.get("unit") or specs.get("sales_measuring_unit") or specs.get("purchase_measuring_unit"))

        # Quantity
        qty = int(product.initial_stock or product.on_hand_stock or 0)
        if qty < 0:
            qty = 0

        parsed_mfg = _parse_date_safe(mfg_raw)
        parsed_expiry = _parse_date_safe(expiry_raw)
        loc = specs.get("location_in_warehouse") or product.rack_location or raw_data.get("location_in_warehouse") or None
        supplier_val = product.supplier or specs.get("preferred_supplier") or specs.get("supplier") or raw_data.get("preferred_supplier") or None
        inv_no = specs.get("supplier_invoice_number") or raw_data.get("supplier_invoice_number") or None

        # Resolve company
        raw_company_id = product.company_id or ctx.active_company_id
        target_company_id = None
        if raw_company_id:
            try:
                c_uuid = uuid.UUID(str(raw_company_id))
                c_res = await db.scalar(
                    select(Company.id).where(Company.id == c_uuid, Company.tenant_id == ctx.tenant_id)
                )
                target_company_id = c_res
            except Exception:
                target_company_id = None

        # Check existing batch
        b_res = await db.execute(
            select(InventoryBatch).where(
                InventoryBatch.tenant_id == ctx.tenant_id,
                InventoryBatch.product_id == product.id,
                InventoryBatch.batch_number == batch_num,
            )
        )
        existing_batch = b_res.scalars().first()

        if not existing_batch:
            b_res2 = await db.execute(
                select(InventoryBatch).where(
                    InventoryBatch.tenant_id == ctx.tenant_id,
                    InventoryBatch.batch_number == batch_num,
                )
            )
            existing_batch = b_res2.scalars().first()

        if existing_batch:
            existing_batch.product_id = product.id
            existing_batch.product_name = product.name
            existing_batch.sku = product.sku or existing_batch.sku or ""
            existing_batch.barcode = product.barcode or existing_batch.barcode
            if warehouse_id:
                existing_batch.warehouse_id = warehouse_id
            if warehouse_name:
                existing_batch.warehouse_name = warehouse_name
            if loc:
                existing_batch.location = loc
            if supplier_val:
                existing_batch.supplier = supplier_val
            if inv_no:
                existing_batch.supplier_invoice_no = inv_no
            if parsed_mfg:
                existing_batch.manufacturing_date = parsed_mfg
            if parsed_expiry:
                existing_batch.expiry_date = parsed_expiry
            if product.purchase_price is not None:
                existing_batch.cost_price = float(product.purchase_price)
            if product.mrp is not None:
                existing_batch.mrp = float(product.mrp)
            if product.selling_price is not None:
                existing_batch.selling_price = float(product.selling_price)
            if product.tax_percent is not None:
                existing_batch.tax_percent = float(product.tax_percent)
            if uom_name:
                existing_batch.uom = uom_name
            if qty > 0 and (existing_batch.quantity == 0 or existing_batch.quantity is None):
                existing_batch.quantity = qty
                existing_batch.remaining_quantity = qty
            return existing_batch
        else:
            new_batch = InventoryBatch(
                id=uuid.uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=target_company_id,
                batch_number=batch_num,
                product_id=product.id,
                product_name=product.name,
                sku=product.sku or "",
                barcode=product.barcode,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
                location=loc,
                quantity=qty,
                remaining_quantity=qty,
                uom=uom_name,
                cost_price=float(product.purchase_price or 0.0),
                mrp=float(product.mrp or 0.0),
                selling_price=float(product.selling_price or 0.0),
                tax_percent=float(product.tax_percent or 0.0),
                manufacturing_date=parsed_mfg,
                expiry_date=parsed_expiry,
                supplier=supplier_val,
                supplier_invoice_no=inv_no,
                qc_status="Passed",
                status="Active",
                notes=f"Auto-generated batch during product catalog setup for {product.name}",
            )
            db.add(new_batch)
            await db.flush()

            # Create initial traceability event
            ev = TraceabilityEvent(
                id=uuid.uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=target_company_id,
                event_type="received",
                batch_id=new_batch.id,
                destination_location=warehouse_name or loc or "Main Warehouse",
                destination_warehouse_id=warehouse_id,
                party_type="supplier",
                party_name=supplier_val or "Opening Inventory",
                reference_document=new_batch.batch_number,
                quantity=qty,
                unit=uom_name or "Pcs",
                notes=f"Initial stock batch receipt for product {product.name}",
                event_at=datetime.utcnow(),
                actor_user_id=ctx.user.id if hasattr(ctx, "user") and ctx.user else None,
            )
            db.add(ev)
            return new_batch
    except Exception as e:
        import logging
        logging.getLogger("inventory_batches").exception(f"Failed to sync batch for product {product.id}: {e}")
        return None


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
            new_brand = Brand(id=uuid.uuid4(), tenant_id=ctx.tenant_id, company_id=ctx.active_company_id, name=b_name, status=EntityStatus.ACTIVE)
            db.add(new_brand)
            await db.flush()
            brand_id = new_brand.id
    data["brand_id"] = brand_id


    barcode = (data.get("barcode") or "").strip()
    sku = (data.get("sku") or "").strip()
    name = (data.get("name") or "").strip()
    data["image_url"] = _save_base64_image_if_present(data.get("image_url"))

    existing_prod = None
    if barcode:
        stmt = select(Product).where(Product.tenant_id == ctx.tenant_id, Product.barcode == barcode)
        if ctx.active_company_id:
            stmt = stmt.where(Product.company_id == ctx.active_company_id)
        res = await db.execute(stmt)
        existing_prod = res.scalars().first()

    if not existing_prod and sku:
        stmt = select(Product).where(Product.tenant_id == ctx.tenant_id, Product.sku == sku)
        if ctx.active_company_id:
            stmt = stmt.where(Product.company_id == ctx.active_company_id)
        res = await db.execute(stmt)
        existing_prod = res.scalars().first()

    # Extract only valid columns that exist on the Product DB model
    valid_cols = {c.name for c in Product.__table__.columns}
    product_data = {k: v for k, v in data.items() if k in valid_cols}

    user_stock = data.get("initial_stock")
    if user_stock is None or (user_stock == 0 and (data.get("stock") is not None or data.get("current_stock") is not None)):
        if data.get("stock") is not None:
            user_stock = data.get("stock")
        elif data.get("current_stock") is not None:
            user_stock = data.get("current_stock")
    try:
        clean_stock = int(user_stock) if user_stock is not None else 0
    except Exception:
        clean_stock = 0
    product_data["initial_stock"] = clean_stock
    product_data["on_hand_stock"] = clean_stock

    if existing_prod:
        added_stock = clean_stock
        existing_prod.initial_stock = (existing_prod.initial_stock or 0) + added_stock
        existing_prod.on_hand_stock = (existing_prod.on_hand_stock or 0) + added_stock
        for k, v in product_data.items():
            if k not in ("id", "tenant_id", "initial_stock", "on_hand_stock") and v is not None:
                setattr(existing_prod, k, v)
        if brand_id:
            existing_prod.brand_id = brand_id

        await db.commit()
        await db.refresh(existing_prod, ["category", "brand", "uom"])
        product = existing_prod
    else:
        if not product_data.get("sku"):
            prefix = re.sub(r'[^A-Za-z0-9]', '', name[:4].upper()) if name else "PROD"
            product_data["sku"] = f"SKU-{prefix}-{uuid.uuid4().hex[:6].upper()}"

        if not product_data.get("barcode"):
            from src.api.v1.inventory.identifiers import generate_globally_unique_barcode
            code, _ = await generate_globally_unique_barcode(db, ctx.tenant_id, barcode_format="EAN-13")
            product_data["barcode"] = code

        product = Product(
            tenant_id=ctx.tenant_id,
            company_id=ctx.active_company_id,
            **product_data
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

    await _sync_product_inventory_batch(db, product, data, ctx)
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
    res.stock = product.initial_stock
    res.current_stock = product.initial_stock
    
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
    if "image_url" in updates:
        updates["image_url"] = _save_base64_image_if_present(updates.get("image_url"))
    
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


    if "current_stock" in updates and updates["current_stock"] is not None:
        updates["initial_stock"] = updates.pop("current_stock")
        updates["on_hand_stock"] = updates["initial_stock"]
    elif "stock" in updates and updates["stock"] is not None:
        updates["initial_stock"] = updates.pop("stock")
        updates["on_hand_stock"] = updates["initial_stock"]

    if "status" in updates and updates["status"]:
        updates["status"] = _parse_status(updates["status"])
        
    valid_cols = {c.name for c in Product.__table__.columns}
    for key, value in updates.items():
        if key in valid_cols and key not in ("id", "tenant_id"):
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

    await _sync_product_inventory_batch(db, product, updates, ctx)
    await db.commit()
    try:
        await invalidate_cache_by_prefix("pos_products")
    except Exception:
        pass
    
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
    res.stock = product.initial_stock
    res.current_stock = product.initial_stock
    
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

    # Clean up dependent inventory records before deleting the product
    # to prevent Foreign Key RESTRICT / RestrictViolationError
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
    
    # Invalidate products cache
    await invalidate_cache_by_prefix("pos_products")


@router.post("/products/bulk-delete", response_model=ProductBulkDeleteResponse, status_code=status.HTTP_200_OK)
async def bulk_delete_products(
    payload: ProductBulkDeleteRequest,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not payload.product_ids:
        return ProductBulkDeleteResponse(deleted_count=0, deleted_ids=[])

    # 1. Fetch all product IDs that belong to the current tenant
    products_res = await db.execute(
        select(Product.id).where(
            Product.id.in_(payload.product_ids),
            Product.tenant_id == ctx.tenant_id
        )
    )
    target_ids = [row[0] for row in products_res.all()]
    if not target_ids:
        return ProductBulkDeleteResponse(deleted_count=0, deleted_ids=[])

    from sqlalchemy import delete as sql_delete
    from src.models.inventory import (
        StockMovement, StockAdjustment, GoodsReceiptItem, GoodsIssueItem,
        CycleCountItem, ProductBundleItem,
        InventoryBatch, InventorySerial, ProductQRCode, ProductRFID,
        InventoryTransaction, ProductVariant, ProductImage
    )
    from src.models.storefront import StorefrontWishlist

    # 2. Batch clean-up dependent records to avoid RESTRICT FK violations
    await db.execute(sql_delete(StockMovement).where(StockMovement.product_id.in_(target_ids)))
    await db.execute(sql_delete(StockAdjustment).where(StockAdjustment.product_id.in_(target_ids)))
    await db.execute(sql_delete(GoodsReceiptItem).where(GoodsReceiptItem.product_id.in_(target_ids)))
    await db.execute(sql_delete(GoodsIssueItem).where(GoodsIssueItem.product_id.in_(target_ids)))
    await db.execute(sql_delete(CycleCountItem).where(CycleCountItem.product_id.in_(target_ids)))
    await db.execute(sql_delete(ProductBundleItem).where(ProductBundleItem.product_id.in_(target_ids)))
    await db.execute(sql_delete(InventoryBatch).where(InventoryBatch.product_id.in_(target_ids)))
    await db.execute(sql_delete(InventorySerial).where(InventorySerial.product_id.in_(target_ids)))
    await db.execute(sql_delete(ProductQRCode).where(ProductQRCode.product_id.in_(target_ids)))
    await db.execute(sql_delete(ProductRFID).where(ProductRFID.product_id.in_(target_ids)))
    await db.execute(sql_delete(InventoryTransaction).where(InventoryTransaction.product_id.in_(target_ids)))
    await db.execute(sql_delete(ProductVariant).where(ProductVariant.product_id.in_(target_ids)))
    await db.execute(sql_delete(ProductImage).where(ProductImage.product_id.in_(target_ids)))
    try:
        await db.execute(sql_delete(StorefrontWishlist).where(StorefrontWishlist.product_id.in_(target_ids)))
    except Exception:
        pass

    # 3. Batch delete the products
    await db.execute(sql_delete(Product).where(Product.id.in_(target_ids), Product.tenant_id == ctx.tenant_id))
    await db.commit()

    # 4. Invalidate cache
    await invalidate_cache_by_prefix("pos_products")

    return ProductBulkDeleteResponse(deleted_count=len(target_ids), deleted_ids=target_ids)


@router.post("/products/master-import", response_model=MasterProductBulkResponse, status_code=status.HTTP_201_CREATED)
async def master_import_products(
    payload: MasterProductBulkCreate,
    request: Request,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant_id = ctx.tenant_id
    company_id = ctx.active_company_id
    
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
        brand_stmt = select(Brand).where(Brand.tenant_id == tenant_id, Brand.name.in_(brand_names))
        if company_id:
            brand_stmt = brand_stmt.where(or_(Brand.company_id == company_id, Brand.company_id == None))
        existing_brands = await db.execute(brand_stmt)
        for b in existing_brands.scalars().all():
            brand_map[b.name.lower()] = b.id
        
        for b_name in brand_names:
            if b_name.lower() not in brand_map:
                new_brand = Brand(id=uuid.uuid4(), tenant_id=tenant_id, company_id=company_id, name=b_name, status=EntityStatus.ACTIVE)
                db.add(new_brand)
                brand_map[b_name.lower()] = new_brand.id
                brands_created += 1

    # 3. Sync Categories (Auto-create missing categories so products are organized properly)
    category_map = {}
    if category_names:
        cat_stmt = select(ProductCategory).where(ProductCategory.tenant_id == tenant_id, ProductCategory.name.in_(category_names))
        if company_id:
            cat_stmt = cat_stmt.where(or_(ProductCategory.company_id == company_id, ProductCategory.company_id == None))
        existing_cats = await db.execute(cat_stmt)
        for c in existing_cats.scalars().all():
            category_map[c.name.lower()] = c.id
        for c_name in category_names:
            if c_name.lower() not in category_map:
                new_cat = ProductCategory(id=uuid.uuid4(), tenant_id=tenant_id, company_id=company_id, name=c_name, status="active")
                db.add(new_cat)
                category_map[c_name.lower()] = new_cat.id
                categories_created += 1
                
    # 4. Sync Sub Categories
    sub_category_map = {}
    if sub_category_names:
        sub_cat_names_only = {sub for (_, sub) in sub_category_names}
        sub_cat_stmt = select(ProductCategory).where(ProductCategory.tenant_id == tenant_id, ProductCategory.name.in_(sub_cat_names_only), ProductCategory.parent_id.isnot(None))
        if company_id:
            sub_cat_stmt = sub_cat_stmt.where(or_(ProductCategory.company_id == company_id, ProductCategory.company_id == None))
        existing_sub_cats = await db.execute(sub_cat_stmt)
        for sc in existing_sub_cats.scalars().all():
            sub_category_map[sc.name.lower()] = sc.id

    # Flush to get IDs for inserts
    await db.flush()

    # 4.5 Sync UOMs
    uom_map = {}
    if uom_names:
        uom_stmt = select(UnitOfMeasure).where(UnitOfMeasure.tenant_id == tenant_id, UnitOfMeasure.name.in_(uom_names))
        if company_id:
            uom_stmt = uom_stmt.where(or_(UnitOfMeasure.company_id == company_id, UnitOfMeasure.company_id == None))
        existing_uoms = await db.execute(uom_stmt)
        for u in existing_uoms.scalars().all():
            uom_map[u.name.lower()] = u.id
            
        for u_name in uom_names:
            if u_name.lower() not in uom_map:
                new_uom = UnitOfMeasure(id=uuid.uuid4(), tenant_id=tenant_id, company_id=company_id, name=u_name, abbreviation=u_name[:20], status=EntityStatus.ACTIVE)
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

    # 5. Lookup existing products by SKU for Upsert (Scoped to the active company)
    all_skus = {item.sku.strip() for item in payload.items if item.sku and str(item.sku).strip()}
    existing_products_map = {}
    if all_skus:
        sku_stmt = select(Product).where(Product.tenant_id == tenant_id, Product.sku.in_(all_skus))
        if company_id:
            sku_stmt = sku_stmt.where(Product.company_id == company_id)
        existing_res = await db.execute(sku_stmt)
        for p in existing_res.scalars().all():
            existing_products_map[p.sku.strip().lower()] = p

    # 6. Create or Update Products
    used_barcodes_batch: set[str] = set()
    for item in payload.items:
        # Guarantee product name is present
        item_name = (item.name or "").strip()
        if not item_name or item_name.lower() in ("untitled product", "nan", "null", "none"):
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

        item_barcode = (item.barcode or "").strip()
        # If barcode is missing, contains -DUP-, or is already assigned to another item in this batch, generate a clean unique barcode
        if not item_barcode or "-dup-" in item_barcode.lower() or item_barcode in used_barcodes_batch:
            from src.api.v1.inventory.identifiers import generate_globally_unique_barcode
            item_barcode, _ = await generate_globally_unique_barcode(
                db,
                tenant_id,
                barcode_format="EAN-13",
                existing_used_set=used_barcodes_batch,
            )
        used_barcodes_batch.add(item_barcode)

        # Resolve or auto-generate unique SKU
        sku_val = (item.sku or "").strip()
        if not sku_val:
            import re, secrets
            clean_prefix = re.sub(r"[^A-Za-z0-9]", "", item_name)[:6].upper() or "PROD"
            sku_val = f"SKU-{clean_prefix}-{secrets.token_hex(2).upper()}"

        # If product with this SKU already exists, update its details (Upsert)
        if sku_val.lower() in existing_products_map:
            existing_p = existing_products_map[sku_val.lower()]
            existing_p.name = item_name
            if item.purchase_price and item.purchase_price > 0: existing_p.purchase_price = item.purchase_price
            if item.mrp and item.mrp > 0: existing_p.mrp = item.mrp
            if item.selling_price and item.selling_price > 0: existing_p.selling_price = item.selling_price
            if item.wholesale_price and item.wholesale_price > 0: existing_p.wholesale_price = item.wholesale_price
            if item.b2b_price and item.b2b_price > 0: existing_p.b2b_price = item.b2b_price
            if item.initial_stock and item.initial_stock > 0: existing_p.initial_stock = item.initial_stock
            if item_barcode: existing_p.barcode = item_barcode
            if item_hsn: existing_p.hsn_code = item_hsn
            if brand_id: existing_p.brand_id = brand_id
            if category_id: existing_p.category_id = category_id
            if uom_id: existing_p.uom_id = uom_id
            products_created += 1
            continue

        new_product = Product(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            name=item_name,
            sku=sku_val,
            barcode=item_barcode,
            hsn_code=item_hsn,
            short_description=item.short_description,
            long_description=item.long_description,
            brand_id=brand_id,
            category_id=category_id,
            uom_id=uom_id,
            purchase_price=item.purchase_price or 0.0,
            mrp=item.mrp or 0.0,
            selling_price=item.selling_price or 0.0,
            wholesale_price=item.wholesale_price or 0.0,
            b2b_price=item.b2b_price or 0.0,
            min_wholesale_qty=item.min_wholesale_qty or 1,
            tax_percent=item_tax,
            is_tax_inclusive=item.is_tax_inclusive if item.is_tax_inclusive is not None else True,
            discount_limit=item.discount_limit or 0.0,
            initial_stock=item.initial_stock or 0,
            reorder_level=item.reorder_level or 0,
            safety_stock=item.safety_stock or 0,
            supplier=item.supplier,
            base_name=item.base_name,
            product_base_code=item.product_base_code,
            size_l_kg=item.size_l_kg,
            specifications=item.specifications,
            status=_parse_status(item.status) if item.status else EntityStatus.ACTIVE
        )
        db.add(new_product)
        products_created += 1
        existing_products_map[sku_val.lower()] = new_product

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

            ai_enabled = payload.enable_ai_search is not False

            if not existing_mc:
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
                    base_name=item.base_name,
                    product_base_code=item.product_base_code,
                    size_l_kg=item.size_l_kg,
                    short_description=item.short_description or "",
                    specifications="Imported from bulk Excel/CSV upload",
                    source="EXCEL_IMPORT" if not ai_enabled else "AI_WEB_SEARCH",
                    ai_search_done=not ai_enabled,
                    rag_status="pending" if ai_enabled else "skipped",
                    rag_error=None if ai_enabled else "AI background search disabled during import"
                )
                db.add(new_mc)
            elif not existing_mc.ai_search_done:
                # Already queued — leave it
                pass

            elif ai_enabled:
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
    from pathlib import Path

    # backend/
    backend_dir = Path(__file__).resolve().parents[4]
    upload_images_dir = backend_dir / "upload_images"
    images_dir = backend_dir / "images"

    upload_images_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"prod_{uuid.uuid4().hex}{ext}"

    upload_path = upload_images_dir / filename
    images_path = images_dir / filename

    content = await file.read()
    with open(upload_path, "wb") as buffer:
        buffer.write(content)
    with open(images_path, "wb") as buffer:
        buffer.write(content)

    return {"image_url": f"/upload_images/{filename}"}


@router.post("/products/{product_id}/fetch-image")
async def fetch_single_product_image(
    product_id: uuid.UUID,
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    On-demand single product image fetch.
    Allows user/admin to explicitly fetch an image for a specific product on-demand.
    """
    from src.models.inventory import Product
    from src.services.rag_enricher import _google_search_images_async
    
    stmt = select(Product).where(Product.id == product_id, Product.tenant_id == ctx.tenant_id)
    res = await db.execute(stmt)
    prod = res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    img_url = await _google_search_images_async(prod.barcode or "", prod.name or "")
    if img_url:
        prod.image_url = img_url
        await db.commit()
        return {"success": True, "image_url": img_url, "message": "Image fetched successfully"}
    return {"success": False, "image_url": prod.image_url, "message": "No suitable image found"}


@router.post("/products/enrich-pending")
async def trigger_enrich_pending_products(
    ctx: Annotated[CurrentUserContext, Depends(require_permission("manage:erp"))],
):
    """
    Trigger background RAG text & metadata enrichment for all uploaded products lacking details.
    """
    from src.services.rag_enricher import RagEnricher
    await RagEnricher.start()
    return {
        "success": True,
        "message": "Background enrichment active. Descriptions, specifications, brands, and categories are being automatically gathered and appended."
    }


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


DEFAULT_STORE_CATEGORIES = [
    {
        "name": "Fresh Fruits & Vegetables",
        "category_code": "CAT-PRODUCE",
        "description": "Farm-fresh organic fruits, green leafy vegetables & roots",
        "image_url": "/organic/images/category-thumb-1.jpg"
    },
    {
        "name": "Dairy, Eggs & Bakery",
        "category_code": "CAT-DAIRY",
        "description": "Fresh farm milk, artisan cheeses, organic eggs & stoneground breads",
        "image_url": "/organic/images/category-thumb-6.jpg"
    },
    {
        "name": "Beverages & Fresh Juices",
        "category_code": "CAT-BEVERAGE",
        "description": "Cold-pressed juices, pure coconut water, organic teas & roasted coffee",
        "image_url": "/organic/images/category-thumb-3.jpg"
    },
    {
        "name": "Organic Grains & Staples",
        "category_code": "CAT-STAPLES",
        "description": "Ancient grains, basmati rice, lentils, pulses & cold-pressed oils",
        "image_url": "/organic/images/category-thumb-2.jpg"
    },
    {
        "name": "Snacks & Packaged Foods",
        "category_code": "CAT-SNACKS",
        "description": "Wholesome nut mixes, roasted crisps, organic chocolates & breakfast granola",
        "image_url": "/organic/images/category-thumb-5.jpg"
    },
    {
        "name": "Meat, Poultry & Seafood",
        "category_code": "CAT-MEAT",
        "description": "Grass-fed cuts, free-range chicken & fresh wild-caught salmon",
        "image_url": "/organic/images/category-thumb-4.jpg"
    },
    {
        "name": "Health, Wellness & Beauty",
        "category_code": "CAT-WELLNESS",
        "description": "Botanical skincare, organic supplements, pure honey & essential oils",
        "image_url": "/organic/images/category-thumb-7.jpg"
    },
    {
        "name": "Household & Eco Living",
        "category_code": "CAT-HOME",
        "description": "Eco-friendly cleaning essentials, biodegradable kitchenware & home care",
        "image_url": "/organic/images/category-thumb-8.jpg"
    },
]


async def _resolve_public_store_tenant_id(
    db: AsyncSession,
    store: Optional[str] = None,
    x_tenant_id: Optional[str] = None
) -> Optional[uuid.UUID]:
    """Resolves trusted tenant_id from store slug, store UUID, or X-Tenant-Id header.
    If an unknown store is passed, explicitly raises 404 to prevent tenant fallback."""
    from src.models import Tenant

    if store and store.strip():
        clean_store = store.strip()
        # 1. UUID check
        try:
            val_uuid = uuid.UUID(clean_store)
            t_id = await db.scalar(select(Tenant.id).where(Tenant.id == val_uuid))
            if t_id:
                return t_id
        except (ValueError, TypeError):
            pass

        # 2. Slug check (case-insensitive)
        t_id = await db.scalar(
            select(Tenant.id).where(func.lower(Tenant.slug) == clean_store.lower())
        )
        if t_id:
            from src.models.marketplace import MarketplaceThemeSettings
            is_pub = await db.scalar(
                select(MarketplaceThemeSettings.is_published).where(
                    MarketplaceThemeSettings.tenant_id == t_id
                )
            )
            if is_pub is False:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Store '{clean_store}' is currently unpublished"
                )
            return t_id

        # Unknown store: explicitly reject with 404
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store '{clean_store}' not found"
        )

    if x_tenant_id and str(x_tenant_id).strip():
        try:
            tid = uuid.UUID(str(x_tenant_id).strip())
            t_exists = await db.scalar(select(Tenant.id).where(Tenant.id == tid))
            if t_exists:
                return tid
        except (ValueError, TypeError):
            pass

    return None


@router.get("/public/categories", response_model=PaginatedResponse[ProductCategoryResponse], tags=["Storefront Public"])
async def list_public_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    x_tenant_id: Optional[str] = Header(None),
):
    """Returns distinct active product categories with real counts and imagery, scoped by store/tenant."""
    resolved_tenant_id = await _resolve_public_store_tenant_id(db, store, x_tenant_id)

    query = select(ProductCategory).where(
        ProductCategory.status == EntityStatus.ACTIVE
    )
    if resolved_tenant_id:
        query = query.where(ProductCategory.tenant_id == resolved_tenant_id)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(
        query.order_by(ProductCategory.name.asc()).offset((page - 1) * page_size).limit(page_size)
    )
    cats = result.scalars().all()

    # Enrich categories with image fallback and real item counts scoped to resolved_tenant_id
    enriched_cats = []
    for idx, c in enumerate(cats):
        count_stmt = select(func.count()).select_from(Product).where(
            Product.category_id == c.id,
            Product.status == EntityStatus.ACTIVE
        )
        if resolved_tenant_id:
            count_stmt = count_stmt.where(Product.tenant_id == resolved_tenant_id)
        p_count = await db.scalar(count_stmt) or 0

        fallback_img = DEFAULT_STORE_CATEGORIES[idx % len(DEFAULT_STORE_CATEGORIES)]["image_url"]
        img = c.image_url or fallback_img

        c_resp = ProductCategoryResponse(
            id=c.id,
            tenant_id=c.tenant_id,
            name=c.name,
            category_code=c.category_code,
            description=c.description,
            image_url=img,
            item_count=max(p_count, 1) if p_count > 0 else 0,
            status="active",
            created_at=c.created_at,
            updated_at=c.updated_at
        )
        enriched_cats.append(c_resp)

    return paginate(enriched_cats, total or len(enriched_cats), page, page_size)


@router.get("/public/products", response_model=PaginatedResponse[PublicProductResponse], tags=["Storefront Public"])
async def list_public_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    category_id: str | None = None,
    category: str | None = None,
    search: str | None = None,
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    x_tenant_id: Optional[str] = Header(None),
):
    """Returns products scoped to the requested store organization, or all active public products."""
    from src.models import Tenant

    resolved_tenant_id = await _resolve_public_store_tenant_id(db, store, x_tenant_id)

    query = select(Product).options(
        selectinload(Product.category),
        selectinload(Product.brand),
        selectinload(Product.images),
        selectinload(Product.variants)
    ).where(
        Product.status == EntityStatus.ACTIVE
    )

    if resolved_tenant_id:
        query = query.where(Product.tenant_id == resolved_tenant_id)

    # Filter by category_id or category name/slug
    cat_filter = category_id or category
    if cat_filter and cat_filter.strip() and cat_filter.lower() != "all":
        try:
            cat_uuid = uuid.UUID(cat_filter.strip())
            query = query.where(Product.category_id == cat_uuid)
        except ValueError:
            query = query.join(Product.category).where(
                or_(
                    ProductCategory.name.ilike(f"%{cat_filter.strip()}%"),
                    ProductCategory.category_code.ilike(f"%{cat_filter.strip()}%")
                )
            )

    if search and search.strip():
        search_str = search.strip()
        query = query.where(
            or_(
                Product.name.ilike(f"%{search_str}%"),
                Product.short_description.ilike(f"%{search_str}%"),
                Product.sku.ilike(f"%{search_str}%")
            )
        )

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
        on_hand_val = p.on_hand_stock if p.on_hand_stock is not None else (p.initial_stock or 0)
        reserved_val = p.reserved_stock or 0
        avail_stock = max(0, on_hand_val - reserved_val)

        mrp_val = float(p.mrp or 0)
        sp_val = float(p.online_price or p.selling_price or 0)
        if sp_val <= 0 and mrp_val > 0:
            sp_val = mrp_val
        elif mrp_val <= 0 and sp_val > 0:
            mrp_val = sp_val
        elif sp_val <= 0 and mrp_val <= 0:
            sp_val = float(p.purchase_price or 0.0)
            mrp_val = float(p.purchase_price or 0.0)

        response_items.append(PublicProductResponse(
            id=p.id,
            name=p.name,
            sku=p.sku,
            category_name=p.category.name if p.category else None,
            brand=p.brand.name if p.brand else None,
            short_description=p.short_description or p.long_description,
            specifications=p.specifications,
            image_url=p.image_url,
            mrp=mrp_val,
            selling_price=sp_val,
            stock=int(avail_stock),
            seller_name=tenant_names.get(p.tenant_id) or "Verified Store",
            tenant_id=p.tenant_id,
            images=p.images or [],
            variants=p.variants or []
        ))

    return paginate(response_items, total or 0, page, page_size)


@router.get("/public/products/{product_id}", response_model=PublicProductResponse, tags=["Storefront Public"])
async def get_public_product_by_id(
    product_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    x_tenant_id: Optional[str] = Header(None),
):
    """Fetches a single public product by ID, strictly verifying ownership if a store context is given."""
    from src.models import Tenant
    from src.models.marketplace import MarketplaceProduct, MarketplaceVendor

    resolved_tenant_id = await _resolve_public_store_tenant_id(db, store, x_tenant_id)

    # 1. Try local ERP Product by UUID
    try:
        pid = uuid.UUID(product_id)
        p_query = select(Product).options(
            selectinload(Product.category),
            selectinload(Product.brand),
            selectinload(Product.images),
            selectinload(Product.variants)
        ).where(Product.id == pid, Product.status == EntityStatus.ACTIVE)

        if resolved_tenant_id:
            p_query = p_query.where(Product.tenant_id == resolved_tenant_id)

        res = await db.execute(p_query)
        p = res.scalar_one_or_none()
        if p:
            seller_name = None
            if p.tenant_id:
                t_res = await db.execute(select(Tenant.name).where(Tenant.id == p.tenant_id))
                seller_name = t_res.scalar_one_or_none()

            on_hand_val = p.on_hand_stock if p.on_hand_stock is not None else (p.initial_stock or 0)
            reserved_val = p.reserved_stock or 0
            avail_stock = max(0, on_hand_val - reserved_val)

            mrp_val = float(p.mrp or 0)
            sp_val = float(p.online_price or p.selling_price or 0)
            if sp_val <= 0 and mrp_val > 0:
                sp_val = mrp_val
            elif mrp_val <= 0 and sp_val > 0:
                mrp_val = sp_val
            elif sp_val <= 0 and mrp_val <= 0:
                sp_val = float(p.purchase_price or 0.0)
                mrp_val = float(p.purchase_price or 0.0)

            return PublicProductResponse(
                id=p.id,
                name=p.name,
                sku=p.sku,
                category_name=p.category.name if p.category else None,
                brand=p.brand.name if p.brand else None,
                short_description=p.short_description or p.long_description or f"High quality {p.name} delivered fresh.",
                specifications=p.specifications,
                image_url=p.image_url,
                mrp=mrp_val,
                selling_price=sp_val,
                stock=int(avail_stock),
                seller_name=seller_name or "Verified Partner Store",
                tenant_id=p.tenant_id,
                images=p.images or [],
                variants=p.variants or []
            )
    except ValueError:
        pass

    # 2. Try Master Catalog Product
    try:
        m_id = uuid.UUID(product_id)
        m_stmt = select(MasterCatalogProduct).where(MasterCatalogProduct.id == m_id)
        if resolved_tenant_id:
            m_stmt = m_stmt.where(MasterCatalogProduct.tenant_id == resolved_tenant_id)
        m_res = await db.execute(m_stmt)
        m = m_res.scalar_one_or_none()
        if m:
            mrp_val = float(m.mrp or 0)
            sp_val = float(m.sale_price or m.online_price or 0)
            if sp_val <= 0 and mrp_val > 0:
                sp_val = mrp_val
            elif mrp_val <= 0 and sp_val > 0:
                mrp_val = sp_val
            elif sp_val <= 0 and mrp_val <= 0:
                sp_val = float(m.cost_price or 0.0)
                mrp_val = float(m.cost_price or 0.0)

            return PublicProductResponse(
                id=m.id,
                name=m.name or "Catalog Product",
                sku=m.sku_code or m.barcode or f"SKU-{str(m.id)[:8].upper()}",
                category_name=getattr(m, 'category', None) or "General",
                brand=m.brand,
                short_description=getattr(m, 'specifications', None) or f"{m.name} - Premium quality verified product.",
                specifications={"brand": m.brand, "weight": m.weight, "hsn": m.hsn_code, "barcode": m.barcode},
                image_url=m.image_url,
                mrp=mrp_val,
                selling_price=sp_val,
                stock=int(m.quantity or 100),
                seller_name="Global Master Marketplace",
                tenant_id=m.tenant_id,
                images=[],
                variants=[]
            )
    except ValueError:
        pass

    # 3. Try MarketplaceProduct (by string id e.g. MP-1001)
    mp_stmt = (
        select(MarketplaceProduct)
        .outerjoin(MarketplaceVendor, MarketplaceProduct.vendor_id == MarketplaceVendor.id)
        .options(selectinload(MarketplaceProduct.vendor))
        .where(MarketplaceProduct.id == product_id)
    )
    if resolved_tenant_id:
        mp_stmt = mp_stmt.where(
            (MarketplaceProduct.tenant_id == str(resolved_tenant_id)) |
            (MarketplaceVendor.tenant_id == str(resolved_tenant_id))
        )
    mp_res = await db.execute(mp_stmt)
    mp = mp_res.scalar_one_or_none()
    if mp:
        return PublicProductResponse(
            id=mp.id,
            name=mp.name,
            sku=mp.id,
            category_name=mp.category,
            brand=mp.vendor.name if mp.vendor else None,
            short_description=f"{mp.name} listed by {mp.vendor.name if mp.vendor else 'Merchant'}",
            specifications={"rating": mp.rating, "category": mp.category},
            image_url=None,
            mrp=float((mp.price or 0) * 1.2),
            selling_price=float(mp.price or 0),
            stock=int(mp.stock or 50),
            seller_name=mp.vendor.name if mp.vendor else "Marketplace Vendor",
            tenant_id=None,
            images=[],
            variants=[]
        )

    raise HTTPException(status_code=404, detail="Product not found in storefront catalog")