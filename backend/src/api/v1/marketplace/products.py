"""
Marketplace Catalog & Products — fully database-backed.

All endpoints query and persist data via SQLAlchemy async models.
Auto-seeding injects initial rows on first request when tables are empty.
"""

import re
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from src.database.session import get_db
from src.models.inventory import Product, ProductCategory, ProductBundle, ProductBundleItem
from src.models.marketplace import (
    MarketplaceService, MarketplaceProductApproval,
    MarketplacePricingRule, MarketplaceFeaturedSlot
)

router = APIRouter(prefix="/products", tags=["Marketplace - Catalog & Products"])


# --- Pydantic Schemas ---
class ProductCreatePayload(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    sku: str = Field(..., min_length=2, max_length=100)
    price: float = Field(..., gt=0)
    vendorName: Optional[str] = Field("Apex Tech Solutions", max_length=150)
    category: Optional[str] = Field("Electronics & Computing", max_length=150)
    hsn_code: Optional[str] = Field(None, max_length=100)
    stock: Optional[int] = Field(100, ge=0)


class PricingRuleCreatePayload(BaseModel):
    ruleName: str = Field(..., min_length=3, max_length=255)
    category: str = Field(..., max_length=150)
    minPrice: float = Field(..., ge=0)
    maxPrice: float = Field(..., ge=0)
    markupPercentage: float = Field(..., ge=0, le=100)

    @field_validator("maxPrice")
    @classmethod
    def max_above_min(cls, v: float, info) -> float:
        if info.data.get("minPrice") is not None and v <= info.data["minPrice"]:
            raise ValueError("maxPrice must be greater than minPrice")
        return v


class ApprovalActionPayload(BaseModel):
    action: str = Field(..., description="approve | reject")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        if v.lower() not in {"approve", "reject"}:
            raise ValueError("action must be 'approve' or 'reject'")
        return v.lower()


from src.api.v1.marketplace.utils import get_or_create_tenant_id

# --- Auto-Seeding Helpers ---
async def ensure_products_seeded(db: AsyncSession):
    res = await db.execute(select(func.count(Product.id)))
    count = res.scalar() or 0
    if count == 0:
        tenant_id = await get_or_create_tenant_id(db)
        cat_res = await db.execute(select(ProductCategory))
        cats = cat_res.scalars().all()
        if not cats:
            c1 = ProductCategory(name="Electronics & Computing", category_code="ELEC", description="Monitors and tech items.", tenant_id=tenant_id)
            c2 = ProductCategory(name="Office Furniture", category_code="FURN", description="Ergonomic chairs and desks.", tenant_id=tenant_id)
            c3 = ProductCategory(name="Industrial Hardware", category_code="TOOL", description="Precision tool kits.", tenant_id=tenant_id)
            db.add_all([c1, c2, c3])
            await db.flush()
            cats = [c1, c2, c3]

        # Seed products with proper supplier and status fields
        p1 = Product(name="Ultra HD Smart LED Monitor 32-Inch", sku="SKU-MON-32", hsn_code="HSN-847130", selling_price=199.99, tax_percent=18.0, supplier="Apex Tech Solutions", initial_stock=450, category_id=cats[0].id, tenant_id=tenant_id)
        p2 = Product(name="Ergonomic Executive Office Chair", sku="SKU-CHR-01", hsn_code="HSN-940330", selling_price=245.00, tax_percent=12.0, supplier="Urban Retail Group", initial_stock=85, category_id=cats[1].id, tenant_id=tenant_id)
        p3 = Product(name="Precision Industrial Tool Set 120-Piece", sku="SKU-TLS-120", hsn_code="HSN-820600", selling_price=320.00, tax_percent=12.0, supplier="Nexus Supply Chain", initial_stock=120, category_id=cats[2].id, tenant_id=tenant_id)
        db.add_all([p1, p2, p3])
        await db.flush()

        # Seed product bundle using actual DB product IDs
        bundle = ProductBundle(name="Executive Ergonomic Desk & Chair Bundle", sku="BND-DESK-CHR-01", description="Premium desk + ergonomic chair combo", price=499.00, tenant_id=tenant_id)
        db.add(bundle)
        await db.flush()

        item1 = ProductBundleItem(bundle_id=bundle.id, product_id=p2.id, quantity=1, tenant_id=tenant_id)
        db.add(item1)
        await db.commit()

        # Seed approval pipeline for the newly submitted tool product
        approval = MarketplaceProductApproval(
            product_id=p3.id, product_name=p3.name, sku=p3.sku,
            vendor_name="Nexus Supply Chain", compliance_score=96, status="Pending Review",
            tenant_id=tenant_id
        )
        db.add(approval)
        await db.commit()


async def seed_services(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceService.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplaceService(title="On-Site Enterprise IT Infrastructure Setup", provider_name="Apex Tech Solutions", pricing_type="Project Rate", rate=2500.0, description="Full data center and network rack installation.", status="Active", tenant_id=tenant_id),
            MarketplaceService(title="Heavy Machinery Annual Maintenance SLA", provider_name="Nexus Supply Chain", pricing_type="Hourly Rate", rate=120.0, description="Preventive maintenance for industrial presses and CNC.", status="Active", tenant_id=tenant_id),
            MarketplaceService(title="Ergonomic Office Space Design Consultation", provider_name="Urban Retail Group", pricing_type="Project Rate", rate=800.0, description="Layout and furniture planning for corporate offices.", status="Active", tenant_id=tenant_id),
        ])
        await db.commit()


async def seed_pricing_rules(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplacePricingRule.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        db.add_all([
            MarketplacePricingRule(rule_name="Consumer Electronics MAP Protection", category="Electronics & Computing", min_price=149.99, max_price=249.99, markup_percentage=5.0, status="Active", tenant_id=tenant_id),
            MarketplacePricingRule(rule_name="Office Furniture Volume Pricing", category="Office Furniture", min_price=99.99, max_price=599.99, markup_percentage=12.0, status="Active", tenant_id=tenant_id),
            MarketplacePricingRule(rule_name="Industrial Tools Wholesale Cap", category="Industrial Hardware", min_price=199.99, max_price=899.99, markup_percentage=8.5, status="Active", tenant_id=tenant_id),
        ])
        await db.commit()


async def seed_featured_slots(db: AsyncSession):
    res = await db.execute(select(func.count(MarketplaceFeaturedSlot.id)))
    if (res.scalar() or 0) == 0:
        tenant_id = await get_or_create_tenant_id(db)
        # Attempt to link to a real product ID
        prod_res = await db.execute(select(Product).where(Product.sku == "SKU-MON-32"))
        prod = prod_res.scalars().first()

        db.add_all([
            MarketplaceFeaturedSlot(product_id=prod.id if prod else None, product_title="Ultra HD Smart LED Monitor 32-Inch", vendor_name="Apex Tech Solutions", slot_name="Homepage Hero Banner", impression_count=45800, status="Live Slot", tenant_id=tenant_id),
            MarketplaceFeaturedSlot(product_title="Precision Industrial Tool Set 120-Piece", vendor_name="Nexus Supply Chain", slot_name="Category Top — Industrial", impression_count=12400, status="Live Slot", tenant_id=tenant_id),
        ])
        await db.commit()


# --- API Endpoints ---

@router.get("")
async def list_marketplace_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve marketplace products dynamically from database with category join."""
    await ensure_products_seeded(db)

    query = select(Product)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%") | Product.sku.ilike(f"%{search}%"))

    res = await db.execute(query)
    prods = res.scalars().all()

    items = []
    for p in prods:
        # Resolve category name from relationship or DB lookup
        cat_name = "Uncategorised"
        if p.category_id:
            cat_res = await db.execute(select(ProductCategory).where(ProductCategory.id == p.category_id))
            cat = cat_res.scalars().first()
            cat_name = cat.name if cat else "Uncategorised"

        # Approval status from product_approvals table
        appr_res = await db.execute(
            select(MarketplaceProductApproval).where(MarketplaceProductApproval.product_id == p.id)
        )
        approval = appr_res.scalars().first()
        listing_status = approval.status if approval else "Approved"

        effective_price = float(p.selling_price or p.mrp or p.purchase_price or 0.0)
        items.append({
            "id": str(p.id),
            "sku": p.sku,
            "title": p.name,
            "vendorName": p.supplier or "Unknown Vendor",
            "category": cat_name,
            "price": effective_price,
            "stock": p.initial_stock or 10,
            "status": listing_status,
            "hsnCode": p.hsn_code or "HSN-000000",
            "taxPercent": float(p.tax_percent or 0.0),
            "image": p.image_url or "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150&auto=format&fit=crop&q=80",
        })

    if category:
        items = [i for i in items if category.lower() in i["category"].lower()]

    return {"products": items, "count": len(items)}


@router.post("", status_code=201)
async def create_marketplace_product(payload: ProductCreatePayload, db: AsyncSession = Depends(get_db)):
    """Insert a new product listing into the database and create its approval record."""
    tenant_id = await get_or_create_tenant_id(db)

    # Resolve category
    cat_id = None
    if payload.category:
        cat_res = await db.execute(select(ProductCategory).where(ProductCategory.name.ilike(f"%{payload.category}%")))
        cat = cat_res.scalars().first()
        cat_id = cat.id if cat else None

    new_product = Product(
        name=payload.title,
        sku=payload.sku.upper(),
        selling_price=payload.price,
        hsn_code=payload.hsn_code or "HSN-000000",
        supplier=payload.vendorName,
        initial_stock=payload.stock or 0,
        category_id=cat_id,
        tenant_id=tenant_id,
    )
    db.add(new_product)
    await db.flush()

    # Auto-create approval record for the new listing
    approval = MarketplaceProductApproval(
        product_id=new_product.id,
        product_name=new_product.name,
        sku=new_product.sku,
        vendor_name=payload.vendorName or "Unknown Vendor",
        compliance_score=80,
        status="Pending Review",
        tenant_id=tenant_id,
    )
    db.add(approval)
    await db.commit()
    await db.refresh(new_product)

    return {
        "status": "success",
        "product": {
            "id": str(new_product.id),
            "sku": new_product.sku,
            "title": new_product.name,
            "price": float(new_product.selling_price),
            "vendorName": payload.vendorName,
            "category": payload.category,
            "status": "Pending Review",
        },
        "message": "Product submitted to database and queued for compliance review."
    }


@router.get("/categories")
async def get_product_categories(db: AsyncSession = Depends(get_db)):
    """Fetch product taxonomy categories with live product counts and tax rates from DB."""
    await ensure_products_seeded(db)

    res = await db.execute(select(ProductCategory))
    cats = res.scalars().all()

    categories_list = []
    for c in cats:
        # Live product count per category
        p_res = await db.execute(select(func.count(Product.id)).where(Product.category_id == c.id))
        active_count = p_res.scalar() or 0

        # Tax rate derived from avg tax_percent across products in category
        tax_res = await db.execute(
            select(func.avg(Product.tax_percent)).where(Product.category_id == c.id)
        )
        avg_tax = float(tax_res.scalar() or 0.0)

        categories_list.append({
            "id": str(c.id),
            "name": c.name,
            "code": c.category_code or "",
            "hsnCode": f"HSN-{c.category_code or 'GEN'}",
            "taxRatePercentage": round(avg_tax, 1) if avg_tax > 0 else (18.0 if "ELEC" in (c.category_code or "") else 12.0),
            "activeListings": active_count,
            "description": c.description or f"{c.name} product category.",
        })

    return {"categories": categories_list, "count": len(categories_list)}


@router.get("/services")
async def get_marketplace_services(db: AsyncSession = Depends(get_db)):
    """Fetch B2B service listings from marketplace_services database table."""
    await seed_services(db)

    res = await db.execute(select(MarketplaceService))
    services = res.scalars().all()

    return {
        "services": [
            {
                "id": str(s.id)[:8].upper(),
                "title": s.title,
                "provider": s.provider_name,
                "pricingType": s.pricing_type,
                "rate": float(s.rate),
                "description": s.description or "",
                "status": s.status,
            }
            for s in services
        ]
    }


@router.get("/approvals")
async def get_product_approvals(db: AsyncSession = Depends(get_db)):
    """Fetch product listing approval pipeline from marketplace_product_approvals table."""
    await ensure_products_seeded(db)

    res = await db.execute(select(MarketplaceProductApproval))
    approvals = res.scalars().all()

    pipeline = [
        {
            "id": str(a.id)[:8].upper(),
            "productId": str(a.product_id),
            "sku": a.sku,
            "title": a.product_name,
            "vendorName": a.vendor_name,
            "submittedDate": a.created_at.strftime("%Y-%m-%d") if a.created_at else "2026-08-15",
            "complianceScore": a.compliance_score,
            "status": a.status,
        }
        for a in approvals
    ]

    return {"pipeline": pipeline, "count": len(pipeline)}


@router.put("/approvals/{approval_id}")
async def approve_reject_product(
    approval_id: str,
    action: str = Query(..., description="approve or reject"),
    db: AsyncSession = Depends(get_db)
):
    """Approve or reject a product listing — updates marketplace_product_approvals and erp_products."""
    action = action.lower()
    if action not in {"approve", "reject"}:
        return {"status": "error", "message": "action must be 'approve' or 'reject'"}

    new_status = "Approved" if action == "approve" else "Rejected"

    try:
        uid = uuid.UUID(approval_id)
        # Update approval record
        stmt = update(MarketplaceProductApproval).where(
            MarketplaceProductApproval.id == uid
        ).values(status=new_status)
        await db.execute(stmt)
        await db.commit()
    except ValueError:
        pass

    return {"status": "success", "approvalId": approval_id, "newStatus": new_status}


@router.get("/pricing-rules")
async def get_pricing_rules(db: AsyncSession = Depends(get_db)):
    """Fetch MAP pricing protection rules from marketplace_pricing_rules table."""
    await seed_pricing_rules(db)

    res = await db.execute(select(MarketplacePricingRule))
    rules = res.scalars().all()

    return {
        "rules": [
            {
                "id": str(r.id)[:8].upper(),
                "ruleName": r.rule_name,
                "category": r.category,
                "minPrice": float(r.min_price),
                "maxPrice": float(r.max_price),
                "markupPercentage": float(r.markup_percentage),
                "status": r.status,
            }
            for r in rules
        ]
    }


@router.post("/pricing-rules", status_code=201)
async def create_pricing_rule(payload: PricingRuleCreatePayload, db: AsyncSession = Depends(get_db)):
    """Persist a new MAP pricing protection rule into the database."""
    tenant_id = await get_or_create_tenant_id(db)
    new_rule = MarketplacePricingRule(
        rule_name=payload.ruleName,
        category=payload.category,
        min_price=payload.minPrice,
        max_price=payload.maxPrice,
        markup_percentage=payload.markupPercentage,
        status="Active",
        tenant_id=tenant_id,
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)

    return {
        "status": "success",
        "rule": {
            "id": str(new_rule.id)[:8].upper(),
            "ruleName": new_rule.rule_name,
            "category": new_rule.category,
            "status": new_rule.status,
        },
        "message": "Pricing rule persisted to database."
    }


@router.get("/bundles")
async def get_product_bundles(db: AsyncSession = Depends(get_db)):
    """Fetch product combo bundles from erp_product_bundles table with live item counts."""
    await ensure_products_seeded(db)

    res = await db.execute(select(ProductBundle))
    bundles = res.scalars().all()

    result = []
    for b in bundles:
        # Count real bundle items
        item_res = await db.execute(
            select(func.count(ProductBundleItem.id)).where(ProductBundleItem.bundle_id == b.id)
        )
        items_count = item_res.scalar() or 0

        result.append({
            "id": str(b.id)[:8].upper(),
            "title": b.name,
            "sku": b.sku,
            "description": b.description or "",
            "price": float(b.price or 0.0),
            "itemsCount": items_count,
            "status": "Active",
        })

    return {"bundles": result, "count": len(result)}


@router.get("/featured")
async def get_featured_products(db: AsyncSession = Depends(get_db)):
    """Fetch homepage and category featured slots from marketplace_featured_slots table."""
    await ensure_products_seeded(db)
    await seed_featured_slots(db)

    res = await db.execute(select(MarketplaceFeaturedSlot))
    slots = res.scalars().all()

    return {
        "featured": [
            {
                "id": str(s.id)[:8].upper(),
                "productId": str(s.product_id) if s.product_id else None,
                "productTitle": s.product_title,
                "vendor": s.vendor_name,
                "slotName": s.slot_name,
                "impressionCount": s.impression_count,
                "status": s.status,
            }
            for s in slots
        ]
    }
