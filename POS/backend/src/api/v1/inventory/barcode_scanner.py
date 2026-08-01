import uuid
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from src.database.session import get_db
from src.models.inventory import Product, ProductCategory, Brand, MasterCatalogProduct

logger = logging.getLogger(__name__)


async def resolve_or_create_category(
    db: AsyncSession,
    category_name: str,
    tenant_id: Optional[str] = None
) -> Optional[str]:
    if not category_name or not category_name.strip():
        return None
    stmt = select(ProductCategory).where(ProductCategory.name.ilike(category_name.strip()))
    res = await db.execute(stmt)
    cat = res.scalars().first()
    if cat:
        return str(cat.id)
    try:
        new_cat = ProductCategory(
            name=category_name.strip(),
            category_code=f"CAT-{uuid.uuid4().hex[:6].upper()}"
        )
        db.add(new_cat)
        await db.flush()
        return str(new_cat.id)
    except Exception as e:
        logger.warning(f"Could not auto-create category {category_name}: {e}")
        return None

async def resolve_or_create_brand(
    db: AsyncSession,
    brand_name: str,
    tenant_id: Optional[str] = None
) -> Optional[str]:
    if not brand_name or not brand_name.strip():
        return None
    stmt = select(Brand).where(Brand.name.ilike(brand_name.strip()))
    res = await db.execute(stmt)
    b = res.scalars().first()
    if b:
        return str(b.id)
    try:
        new_brand = Brand(name=brand_name.strip())
        db.add(new_brand)
        await db.flush()
        return str(new_brand.id)
    except Exception as e:
        logger.warning(f"Could not auto-create brand {brand_name}: {e}")
        return None

router = APIRouter(prefix="", tags=["Products & Barcode Scanner"])

# Pydantic Schemas
class ProductBarcodeLookupResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    product: Optional[Dict[str, Any]] = None

class CreateProductSchema(BaseModel):
    barcode: str
    name: str
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    mrp: float = 0.0
    selling_price: float = 0.0
    gst: float = 0.0
    initial_stock: int = 0
    package_size: Optional[str] = None
    image_url: Optional[str] = None

class AddStockSchema(BaseModel):
    product_id: str
    quantity: int
    purchase_price: float = 0.0
    supplier_id: Optional[str] = None

# 1. Barcode Lookup Endpoint - Strictly 100% PostgreSQL Database Only
@router.get("/products/barcode/{raw_barcode}", response_model=ProductBarcodeLookupResponse)
async def lookup_product_by_barcode(
    raw_barcode: str,
    db: AsyncSession = Depends(get_db)
):
    clean_barcode = raw_barcode.strip()
    unpadded = clean_barcode.lstrip('0')
    variants = list(dict.fromkeys([
        code for code in [
            clean_barcode,
            unpadded,
            '0' + unpadded if unpadded else '',
            '00' + unpadded if unpadded else '',
            '000' + unpadded if unpadded else '',
        ] if code
    ]))

    # Tier 1: Local Tenant Products Table (Case-insensitive & leading-zero tolerant)
    prod = None
    for code in variants:
        stmt = select(Product).where(
            or_(
                Product.barcode == code,
                Product.sku == code,
                func.lower(Product.barcode) == code.lower(),
                func.lower(Product.sku) == code.lower(),
                func.lstrip(Product.barcode, '0') == unpadded,
            )
        )
        res = await db.execute(stmt)
        prod = res.scalars().first()
        if prod:
            break

    if prod:
        brand_name = ""
        category_name = ""

        if prod.brand_id:
            b_res = await db.execute(select(Brand.name).where(Brand.id == prod.brand_id))
            brand_name = b_res.scalar() or ""

        if prod.category_id:
            c_res = await db.execute(select(ProductCategory.name).where(ProductCategory.id == prod.category_id))
            category_name = c_res.scalar() or ""

        return ProductBarcodeLookupResponse(
            success=True,
            product={
                "id": str(prod.id),
                "barcode": prod.barcode,
                "name": prod.name,
                "brand": brand_name,
                "category": category_name,
                "package_size": prod.short_description or "",
                "mrp": float(prod.mrp or 0.0),
                "selling_price": float(prod.selling_price or 0.0),
                "gst": float(prod.tax_percent or 0.0),
                "stock": prod.initial_stock or 0,
                "image": prod.image_url or "/static/uploads/products/default_product.jpg",
                "source": "DATABASE"
            }
        )

    # Tier 2: Global Master Catalog Table (erp_master_catalog - 1.2M Dataset)
    for code in variants:
        master_stmt = select(MasterCatalogProduct).where(
            or_(
                MasterCatalogProduct.barcode == code,
                MasterCatalogProduct.sku_code == code,
                MasterCatalogProduct.product_code == code,
                MasterCatalogProduct.hsn_code == code,
                MasterCatalogProduct.plu_no == code,
                func.lstrip(MasterCatalogProduct.barcode, '0') == unpadded,
                func.lstrip(MasterCatalogProduct.sku_code, '0') == unpadded,
                func.lstrip(MasterCatalogProduct.product_code, '0') == unpadded,
                func.lstrip(MasterCatalogProduct.plu_no, '0') == unpadded,
            )
        )
        m_res = await db.execute(master_stmt)
        m_prod = m_res.scalars().first()
        if m_prod:
            return ProductBarcodeLookupResponse(
                success=True,
                product={
                    "id": str(m_prod.id),
                    "barcode": m_prod.barcode or code,
                    "name": m_prod.name,
                    "brand": m_prod.brand or "",
                    "category": m_prod.category or "",
                    "package_size": m_prod.weight or "",
                    "mrp": float(m_prod.mrp or 0.0),
                    "selling_price": float(m_prod.sale_price or m_prod.mrp or 0.0),
                    "gst": float(m_prod.tax or 0.0),
                    "stock": 0,
                    "image": m_prod.image_url or "/static/uploads/products/default_product.jpg",
                    "source": "MASTER_CATALOG"
                }
            )

    return ProductBarcodeLookupResponse(
        success=False,
        message="Barcode not found in database",
        product=None
    )

# 2. Database Product Recognition Endpoint
@router.post("/products/recognize")
async def recognize_product_with_db(
    barcode: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    if not barcode and not file:
        return {
            "success": False,
            "message": "No barcode or image provided for database product lookup"
        }

    search_barcode = barcode.strip() if barcode else ""

    if search_barcode:
        lookup_res = await lookup_product_by_barcode(search_barcode, db)
        if lookup_res.success and lookup_res.product:
            p = lookup_res.product
            return {
                "success": True,
                "confidence": 1.0,
                "suggested_product": {
                    "barcode": p["barcode"],
                    "product_name": p["name"],
                    "brand": p["brand"],
                    "category": p["category"],
                    "package_size": p["package_size"],
                    "mrp": p["mrp"],
                    "selling_price": p["selling_price"]
                }
            }

    return {
        "success": False,
        "message": "Product barcode not found in local PostgreSQL database",
        "suggested_product": None
    }

# 3. Create Product Endpoint (Stage 2 - Confirmed by Merchant)
@router.post("/products")
async def create_product(
    payload: CreateProductSchema,
    db: AsyncSession = Depends(get_db)
):
    # Resolve category and brand
    cat_id = None
    if payload.category_name:
        cat_id = await resolve_or_create_category(db, payload.category_name)
        
    brand_id = None
    if payload.brand_name:
        brand_id = await resolve_or_create_brand(db, payload.brand_name)

    # Check if product with this barcode or name already exists -> Update dynamically
    clean_barcode = payload.barcode.strip()[:100]
    clean_name = payload.name.strip()
    existing_prod = None

    if clean_barcode:
        existing_stmt = select(Product).where(Product.barcode == clean_barcode)
        existing_res = await db.execute(existing_stmt)
        existing_prod = existing_res.scalars().first()

    if not existing_prod and clean_name:
        existing_stmt = select(Product).where(func.lower(Product.name) == clean_name.lower())
        existing_res = await db.execute(existing_stmt)
        existing_prod = existing_res.scalars().first()

    if existing_prod:
        existing_prod.name = payload.name.strip()
        existing_prod.mrp = payload.mrp
        existing_prod.selling_price = payload.selling_price
        existing_prod.tax_percent = payload.gst
        existing_prod.initial_stock = (existing_prod.initial_stock or 0) + payload.initial_stock
        if cat_id:
            existing_prod.category_id = uuid.UUID(cat_id)
        if brand_id:
            existing_prod.brand_id = uuid.UUID(brand_id)
        if payload.package_size:
            existing_prod.short_description = payload.package_size.strip()
        if payload.image_url:
            existing_prod.image_url = payload.image_url

        await db.commit()
        await db.refresh(existing_prod)
        return {
            "success": True,
            "product_id": str(existing_prod.id),
            "message": "Product updated successfully"
        }

    # Resolve default tenant
    from src.models import Tenant
    tenant_res = await db.execute(select(Tenant).limit(1))
    tenant = tenant_res.scalars().first()
    tenant_id = tenant.id if tenant else None

    new_product_kwargs = dict(
        name=payload.name.strip(),
        sku=f"SKU-{clean_barcode}",
        barcode=clean_barcode,
        category_id=uuid.UUID(cat_id) if cat_id else None,
        brand_id=uuid.UUID(brand_id) if brand_id else None,
        mrp=payload.mrp,
        selling_price=payload.selling_price,
        tax_percent=payload.gst,
        initial_stock=payload.initial_stock,
        short_description=payload.package_size,
        image_url=payload.image_url or "/static/uploads/products/default_product.jpg"
    )
    if tenant_id:
        new_product_kwargs["tenant_id"] = tenant_id

    new_product = Product(**new_product_kwargs)

    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)

    return {
        "success": True,
        "product_id": str(new_product.id),
        "message": "Product created successfully in PostgreSQL database"
    }

# 4. Add Inventory Stock Endpoint
@router.post("/inventory/stock")
async def add_inventory_stock(
    payload: AddStockSchema,
    db: AsyncSession = Depends(get_db)
):
    try:
        prod_uuid = uuid.UUID(payload.product_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid product ID format")

    stmt = select(Product).where(Product.id == prod_uuid)
    res = await db.execute(stmt)
    prod = res.scalars().first()

    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    prod.initial_stock = (prod.initial_stock or 0) + payload.quantity
    await db.commit()

    return {
        "success": True,
        "new_stock": prod.initial_stock,
        "message": f"Added {payload.quantity} units to stock"
    }

# 5. Dynamic Categories & Brands Lists
@router.get("/inventory/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    stmt = select(ProductCategory).limit(100)
    res = await db.execute(stmt)
    categories = res.scalars().all()
    return [{"id": str(c.id), "name": c.name} for c in categories]

@router.get("/inventory/brands")
async def get_brands(db: AsyncSession = Depends(get_db)):
    stmt = select(Brand).limit(100)
    res = await db.execute(stmt)
    brands = res.scalars().all()
    return [{"id": str(b.id), "name": b.name} for b in brands]

# 6. Public Product Catalog Endpoint for POS UI
@router.get("/products/all")
async def get_all_products(db: AsyncSession = Depends(get_db)):
    stmt = select(Product).limit(500)
    res = await db.execute(stmt)
    products = res.scalars().all()

    consolidated = {}
    for p in products:
        key = p.name.strip().lower() if p.name else (p.barcode.strip().lower() if p.barcode else str(p.id))

        b_name = ""
        c_name = ""
        if p.brand_id:
            b_res = await db.execute(select(Brand.name).where(Brand.id == p.brand_id))
            b_name = b_res.scalar() or ""
        if p.category_id:
            c_res = await db.execute(select(ProductCategory.name).where(ProductCategory.id == p.category_id))
            c_name = c_res.scalar() or ""

        stock_val = p.initial_stock or 0

        if key in consolidated:
            existing = consolidated[key]
            existing["stock"] += stock_val
            if not existing["barcode"] and p.barcode:
                existing["barcode"] = p.barcode
            if not existing["sku"] and p.sku:
                existing["sku"] = p.sku
            if existing["mrp"] == 0.0 and p.mrp:
                existing["mrp"] = float(p.mrp)
            if existing["selling_price"] == 0.0 and p.selling_price:
                existing["selling_price"] = float(p.selling_price)
        else:
            consolidated[key] = {
                "id": str(p.id),
                "name": p.name,
                "sku": p.sku or f"SKU-{p.barcode}",
                "barcode": p.barcode or "",
                "category_id": str(p.category_id) if p.category_id else "all",
                "category_name": c_name,
                "brand": b_name,
                "mrp": float(p.mrp or 0.0),
                "selling_price": float(p.selling_price or 0.0),
                "gst": float(p.tax_percent or 0.0),
                "stock": stock_val,
                "image_url": p.image_url or "/static/uploads/products/default_product.jpg",
                "description": p.short_description or ""
            }

    return list(consolidated.values())

class ExcelImportItemSchema(BaseModel):
    name: str
    barcode: str
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    package_size: Optional[str] = None
    mrp: float = 0.0
    selling_price: float = 0.0
    gst: float = 0.0
    initial_stock: int = 0

class ExcelImportPayloadSchema(BaseModel):
    items: List[ExcelImportItemSchema]

# 7. Dynamic Excel Import Bulk Endpoint
@router.post("/products/import-excel")
async def import_products_from_excel(
    payload: ExcelImportPayloadSchema,
    db: AsyncSession = Depends(get_db)
):
    from src.models import Tenant
    tenant_res = await db.execute(select(Tenant).limit(1))
    tenant = tenant_res.scalars().first()
    tenant_id = tenant.id if tenant else None

    created_count = 0
    updated_count = 0

    for item in payload.items:
        clean_barcode = item.barcode.strip()[:100]
        if not clean_barcode or not item.name.strip():
            continue

        cat_id = None
        if item.category_name and item.category_name.strip():
            cat_id = await resolve_or_create_category(
                db, item.category_name.strip(), tenant_id=str(tenant_id) if tenant_id else None
            )

        brand_id = None
        if item.brand_name and item.brand_name.strip():
            brand_id = await resolve_or_create_brand(
                db, item.brand_name.strip(), tenant_id=str(tenant_id) if tenant_id else None
            )

        existing_stmt = select(Product).where(Product.barcode == clean_barcode)
        existing_res = await db.execute(existing_stmt)
        existing_prod = existing_res.scalars().first()

        if existing_prod:
            existing_prod.name = item.name.strip()
            existing_prod.mrp = item.mrp
            existing_prod.selling_price = item.selling_price
            existing_prod.tax_percent = item.gst
            existing_prod.initial_stock = (existing_prod.initial_stock or 0) + item.initial_stock
            if cat_id:
                existing_prod.category_id = uuid.UUID(cat_id)
            if brand_id:
                existing_prod.brand_id = uuid.UUID(brand_id)
            if item.package_size:
                existing_prod.short_description = item.package_size.strip()
            updated_count += 1
        else:
            new_kwargs = dict(
                name=item.name.strip(),
                sku=f"SKU-{clean_barcode}",
                barcode=clean_barcode,
                category_id=uuid.UUID(cat_id) if cat_id else None,
                brand_id=uuid.UUID(brand_id) if brand_id else None,
                mrp=item.mrp,
                selling_price=item.selling_price,
                tax_percent=item.gst,
                initial_stock=item.initial_stock,
                short_description=item.package_size.strip() if item.package_size else None,
                image_url="/static/uploads/products/default_product.jpg"
            )
            if tenant_id:
                new_kwargs["tenant_id"] = tenant_id

            new_prod = Product(**new_kwargs)
            db.add(new_prod)
            created_count += 1

    await db.commit()

    return {
        "success": True,
        "created_count": created_count,
        "updated_count": updated_count,
        "message": f"Successfully imported {created_count} new products and updated {updated_count} existing products from Excel"
    }

import io
import csv
import openpyxl

def parse_excel_or_csv_bytes(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    fname_lower = filename.lower()
    if fname_lower.endswith('.xlsx') or fname_lower.endswith('.xls'):
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        all_cells = list(sheet.iter_rows(values_only=True))
        if not all_cells:
            return []
        headers = [str(c).strip().lower() if c is not None else "" for c in all_cells[0]]
        data_rows = all_cells[1:]
    else:
        content = file_bytes.decode('utf-8', errors='ignore')
        csv_lines = list(csv.reader(io.StringIO(content)))
        if not csv_lines:
            return []
        headers = [str(c).strip().lower() for c in csv_lines[0]]
        data_rows = csv_lines[1:]

    def find_col_idx(possible_names: List[str]) -> Optional[int]:
        for idx, h in enumerate(headers):
            for name in possible_names:
                if name in h:
                    return idx
        return None

    name_idx = find_col_idx(["product name", "item name", "name", "title", "product"])
    barcode_idx = find_col_idx(["barcode", "bar_code", "upc", "ean", "sku", "product id", "id", "code"])
    brand_idx = find_col_idx(["brand", "manufacturer"])
    cat_idx = find_col_idx(["category", "subcategory", "dept"])
    pkg_idx = find_col_idx(["package", "quantity", "weight", "size", "unit"])
    mrp_idx = find_col_idx(["mrp", "retail_price", "list_price"])
    sp_idx = find_col_idx(["selling_price", "selling price", "price", "sale_price", "our_price"])
    stock_idx = find_col_idx(["stock", "initial_stock", "qty", "inventory"])
    gst_idx = find_col_idx(["gst", "tax"])

    parsed = []
    for row in data_rows:
        if not row or all(c is None or str(c).strip() == "" for c in row):
            continue

        def get_val(idx):
            if idx is not None and idx < len(row) and row[idx] is not None:
                return str(row[idx]).strip()
            return ""

        name = get_val(name_idx)
        barcode = get_val(barcode_idx)

        if not name and len(row) > 1:
            name = get_val(1) or get_val(0)
        if not barcode and len(row) > 0:
            barcode = get_val(0)

        if not barcode or not name:
            continue

        mrp_val = 0.0
        try:
            mrp_val = float(get_val(mrp_idx).replace('₹', '').replace(',', ''))
        except Exception:
            pass

        sp_val = mrp_val
        try:
            sp_val = float(get_val(sp_idx).replace('₹', '').replace(',', ''))
        except Exception:
            pass

        stock_val = 0
        try:
            stock_val = int(float(get_val(stock_idx)))
        except Exception:
            pass

        gst_val = 0.0
        try:
            gst_val = float(get_val(gst_idx).replace('%', ''))
        except Exception:
            pass

        parsed.append({
            "name": name,
            "barcode": barcode,
            "brand_name": get_val(brand_idx),
            "category_name": get_val(cat_idx),
            "package_size": get_val(pkg_idx),
            "mrp": mrp_val,
            "selling_price": sp_val if sp_val > 0 else mrp_val,
            "initial_stock": stock_val,
            "gst": gst_val
        })
    return parsed

# 8. Binary Excel / CSV Upload Endpoint
@router.post("/products/upload-file")
async def upload_excel_or_csv_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    items = parse_excel_or_csv_bytes(file_bytes, file.filename or "import.csv")
    if not items:
        raise HTTPException(status_code=400, detail="Could not parse any valid product rows from Excel/CSV file")

    from src.models import Tenant
    tenant_res = await db.execute(select(Tenant).limit(1))
    tenant = tenant_res.scalars().first()
    tenant_id = tenant.id if tenant else None

    created_count = 0
    updated_count = 0

    for item in items:
        clean_barcode = item["barcode"].strip()[:100]
        if not clean_barcode or not item["name"].strip():
            continue

        cat_id = None
        if item["category_name"] and item["category_name"].strip():
            cat_id = await resolve_or_create_category(
                db, item["category_name"].strip(), tenant_id=str(tenant_id) if tenant_id else None
            )

        brand_id = None
        if item["brand_name"] and item["brand_name"].strip():
            brand_id = await resolve_or_create_brand(
                db, item["brand_name"].strip(), tenant_id=str(tenant_id) if tenant_id else None
            )

        existing_stmt = select(Product).where(Product.barcode == clean_barcode)
        existing_res = await db.execute(existing_stmt)
        existing_prod = existing_res.scalars().first()

        if existing_prod:
            existing_prod.name = item["name"].strip()
            existing_prod.mrp = item["mrp"]
            existing_prod.selling_price = item["selling_price"]
            existing_prod.tax_percent = item["gst"]
            existing_prod.initial_stock = (existing_prod.initial_stock or 0) + item["initial_stock"]
            if cat_id:
                existing_prod.category_id = uuid.UUID(cat_id)
            if brand_id:
                existing_prod.brand_id = uuid.UUID(brand_id)
            if item["package_size"]:
                existing_prod.short_description = item["package_size"].strip()
            updated_count += 1
        else:
            new_kwargs = dict(
                name=item["name"].strip(),
                sku=f"SKU-{clean_barcode}",
                barcode=clean_barcode,
                category_id=uuid.UUID(cat_id) if cat_id else None,
                brand_id=uuid.UUID(brand_id) if brand_id else None,
                mrp=item["mrp"],
                selling_price=item["selling_price"],
                tax_percent=item["gst"],
                initial_stock=item["initial_stock"],
                short_description=item["package_size"].strip() if item["package_size"] else None,
                image_url="/static/uploads/products/default_product.jpg"
            )
            if tenant_id:
                new_kwargs["tenant_id"] = tenant_id

            new_prod = Product(**new_kwargs)
            db.add(new_prod)
            created_count += 1

    await db.commit()

    return {
        "success": True,
        "created_count": created_count,
        "updated_count": updated_count,
        "total_parsed": len(items),
        "items": items,
        "message": f"Successfully parsed and saved {len(items)} products ({created_count} new, {updated_count} updated) to PostgreSQL database"
    }

# 9. Dynamic Merchant Store Settings Endpoint
@router.get("/system/store-info")
async def get_merchant_store_info(db: AsyncSession = Depends(get_db)):
    from src.models import Company
    from sqlalchemy import desc
    stmt = select(Company).order_by(desc(Company.updated_at)).limit(1)
    res = await db.execute(stmt)
    comp = res.scalars().first()
    if comp:
        return {
            "success": True,
            "store_name": comp.name or "LazyMonkeyai Store",
            "gstin": comp.gst_number or "",
            "address": comp.address or "",
            "phone": comp.phone or "",
            "email": comp.email or "",
            "website": comp.website or "",
            "footer_message": comp.tax_config_label or "Thank You! Visit Again"
        }
    return {
        "success": True,
        "store_name": "LazyMonkeyai Store",
        "gstin": "",
        "address": "",
        "phone": "",
        "email": "",
        "website": "",
        "footer_message": "Thank You! Visit Again"
    }




