import uuid
import os
import json
import re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete, or_
from sqlalchemy.orm import selectinload

from src.database.session import get_db
from src.utils.clock import clock
from src.api.deps import CurrentUserContext, get_current_user_context, get_optional_user_context
from src.models import Tenant, EntityStatus
from src.models.marketplace import (
    MarketplaceVendor, MarketplaceProduct, MarketplaceOrder,
    MarketplaceOrderItem, MarketplacePayout, MarketplacePromotion,
    MarketplaceThemeSettings
)
from src.models.inventory import Product, InventoryTransaction
from src.models.erp import Invoice, InvoiceLine
from src.schemas.marketplace import (
    VendorCreate, VendorUpdate, ProductCreate, ProductUpdate,
    OrderCreate, PayoutCreate, PromotionCreate,
    StoreThemeUpdate, StoreThemeResponse,
    OrderPaymentConfirmRequest, OrderPaymentFailRequest
)

router = APIRouter()

# ── Dynamic Purge Function ensuring mock records are removed ──
async def ensure_seeded_data(db: AsyncSession):
    mock_vendor_ids = ["STORE-MAIN", "VND-001", "VND-002", "VND-003", "VND-004", "VND-005"]
    try:
        await db.execute(delete(MarketplaceProduct).where(MarketplaceProduct.vendor_id.in_(mock_vendor_ids)))
        await db.execute(delete(MarketplacePayout).where(MarketplacePayout.vendor_id.in_(mock_vendor_ids)))
        await db.execute(delete(MarketplaceOrder).where(MarketplaceOrder.id.in_(["ORD-98234", "ORD-98235", "ORD-98236"])))
        await db.execute(delete(MarketplacePromotion).where(MarketplacePromotion.id.in_(["PROMO-001", "PROMO-002"])))
        await db.execute(delete(MarketplaceVendor).where(MarketplaceVendor.id.in_(mock_vendor_ids)))
        await db.commit()
    except Exception:
        pass

# ── STORE RESOLUTION HELPER ──
async def resolve_store_tenant(db: AsyncSession, store_val: str, check_published: bool = False) -> Optional[Tenant]:
    """Resolves trusted Tenant record from store slug, UUID string, or store name."""
    if not store_val or not str(store_val).strip():
        return None
    clean = str(store_val).strip()

    tenant = None
    # 1. UUID check
    try:
        val_uuid = uuid.UUID(clean)
        tenant = await db.scalar(select(Tenant).where(Tenant.id == val_uuid))
    except (ValueError, TypeError):
        pass

    # 2. Slug check (case-insensitive)
    if not tenant:
        tenant = await db.scalar(
            select(Tenant).where(func.lower(Tenant.slug) == clean.lower())
        )

    # 3. Name check (case-insensitive)
    if not tenant:
        tenant = await db.scalar(
            select(Tenant).where(func.lower(Tenant.name) == clean.lower())
        )

    if tenant and check_published:
        is_pub = await db.scalar(
            select(MarketplaceThemeSettings.is_published).where(
                MarketplaceThemeSettings.tenant_id == tenant.id
            )
        )
        if is_pub is False:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Store '{clean}' is currently unpublished"
            )

    return tenant


async def get_or_create_store_vendor(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Ensures a valid tenant-scoped vendor record exists for central store order items."""
    vendor_id = f"VND-{str(tenant_id)[:8].upper()}"
    existing = await db.scalar(select(MarketplaceVendor).where(MarketplaceVendor.id == vendor_id))
    if not existing:
        store_vendor = MarketplaceVendor(
            id=vendor_id,
            tenant_id=str(tenant_id),
            name="Store Fulfillment",
            category="Central Inventory",
            status="Active",
            kyc_status="Approved",
            commission_rate=0.0,
            escrow_balance=0.0
        )
        db.add(store_vendor)
        await db.flush()
    return vendor_id


# ── VENDOR ENDPOINTS (SQLAlchemy DB-Backed) ──
@router.get("/stats")
async def get_marketplace_stats(
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)

    target_tenant_id: Optional[uuid.UUID] = None
    if ctx and ctx.tenant_id:
        target_tenant_id = ctx.tenant_id
    elif store and store.strip():
        tenant_record = await resolve_store_tenant(db, store)
        if not tenant_record:
            raise HTTPException(status_code=404, detail=f"Store '{store}' not found")
        target_tenant_id = tenant_record.id
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication or store identifier required"
        )

    total_vendors = await db.scalar(
        select(func.count(MarketplaceVendor.id)).where(MarketplaceVendor.tenant_id == str(target_tenant_id))
    ) or 0
    active_vendors = await db.scalar(
        select(func.count(MarketplaceVendor.id)).where(
            MarketplaceVendor.tenant_id == str(target_tenant_id),
            MarketplaceVendor.status == "Active"
        )
    ) or 0
    pending_approvals = await db.scalar(
        select(func.count(MarketplaceVendor.id)).where(
            MarketplaceVendor.tenant_id == str(target_tenant_id),
            MarketplaceVendor.kyc_status == "Pending"
        )
    ) or 0
    erp_products_count = await db.scalar(
        select(func.count(Product.id)).where(Product.tenant_id == target_tenant_id)
    ) or 0
    mp_products_count = await db.scalar(
        select(func.count(MarketplaceProduct.id)).where(
            (MarketplaceProduct.tenant_id == str(target_tenant_id)) |
            (MarketplaceProduct.vendor_id.in_(
                select(MarketplaceVendor.id).where(MarketplaceVendor.tenant_id == str(target_tenant_id))
            ))
        )
    ) or 0
    total_products = erp_products_count + mp_products_count
    monthly_orders = await db.scalar(
        select(func.count(MarketplaceOrder.id)).where(MarketplaceOrder.tenant_id == str(target_tenant_id))
    ) or 0
    monthly_gmv = await db.scalar(
        select(func.sum(MarketplaceOrder.total_amount)).where(MarketplaceOrder.tenant_id == str(target_tenant_id))
    ) or 0.0
    total_revenue = await db.scalar(
        select(func.sum(MarketplaceOrder.total_amount)).where(MarketplaceOrder.tenant_id == str(target_tenant_id))
    ) or 0.0
    total_payouts = await db.scalar(
        select(func.sum(MarketplacePayout.amount))
        .join(MarketplaceVendor, MarketplacePayout.vendor_id == MarketplaceVendor.id)
        .where(MarketplaceVendor.tenant_id == str(target_tenant_id))
    ) or 0.0
    avg_commission = 10.0

    return {
        "totalVendors": total_vendors,
        "activeVendors": active_vendors,
        "pendingApprovals": pending_approvals,
        "totalProducts": total_products,
        "monthlyGMV": float(monthly_gmv),
        "monthlyOrders": monthly_orders,
        "averageCommission": avg_commission,
        "totalRevenue": float(total_revenue),
        "totalPayouts": float(total_payouts),
    }

@router.get("/vendors")
async def get_vendors(
    status: Optional[str] = None,
    category: Optional[str] = None,
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)

    target_tenant_id: Optional[uuid.UUID] = None
    if ctx and ctx.tenant_id:
        target_tenant_id = ctx.tenant_id
    elif store and store.strip():
        tenant_record = await resolve_store_tenant(db, store)
        if not tenant_record:
            raise HTTPException(status_code=404, detail=f"Store '{store}' not found")
        target_tenant_id = tenant_record.id
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication or store identifier required"
        )

    query = select(MarketplaceVendor).where(MarketplaceVendor.tenant_id == str(target_tenant_id))
    if status:
        query = query.where(MarketplaceVendor.status == status)
    if category:
        query = query.where(MarketplaceVendor.category == category)
    query = query.order_by(MarketplaceVendor.created_at.desc())
    
    result = await db.execute(query)
    vendors = result.scalars().all()
    
    return [
        {
            "id": v.id,
            "name": v.name,
            "category": v.category,
            "status": v.status,
            "rating": v.rating,
            "totalOrders": v.total_orders,
            "revenue": v.revenue,
            "joinDate": v.join_date.strftime("%Y-%m-%d") if v.join_date else "2026-01-01",
            "location": v.location,
            "email": v.email,
            "phone": v.phone,
            "commission_rate": v.commission_rate,
            "trade_license": v.trade_license,
            "tax_trn": v.tax_trn,
            "kyc_status": v.kyc_status,
            "escrow_balance": v.escrow_balance,
        }
        for v in vendors
    ]

@router.post("/vendors", status_code=status.HTTP_201_CREATED)
async def create_vendor(
    vendor: VendorCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    new_v = MarketplaceVendor(
        id=f"VND-{uuid.uuid4().hex[:4].upper()}",
        tenant_id=str(ctx.tenant_id),
        name=vendor.name,
        category=vendor.category,
        status="Active",
        rating=5.0,
        total_orders=0,
        revenue=0.0,
        commission_rate=vendor.commission_rate or 10.0,
        location=vendor.location or "Dubai, UAE",
        email=vendor.email,
        phone=vendor.phone,
        trade_license=vendor.trade_license,
        tax_trn=vendor.tax_trn,
        kyc_status="Approved" if vendor.trade_license else "Pending",
        escrow_balance=0.0,
    )
    db.add(new_v)
    await db.commit()
    await db.refresh(new_v)
    return new_v

@router.put("/vendors/{vendor_id}/kyc")
async def update_vendor_kyc(
    vendor_id: str,
    kyc_status: str = Query(..., pattern="^(Approved|Rejected|Pending)$"),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(MarketplaceVendor).where(
        MarketplaceVendor.id == vendor_id,
        MarketplaceVendor.tenant_id == str(ctx.tenant_id)
    )
    v = await db.scalar(stmt)
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found or access denied")
    v.kyc_status = kyc_status
    if kyc_status == "Approved":
        v.status = "Active"
    elif kyc_status == "Rejected":
        v.status = "Suspended"
    await db.commit()
    return {"message": f"Vendor {vendor_id} KYC updated to {kyc_status}", "vendor": v}

# ── PRODUCT ENDPOINTS (Omnichannel Central erp_products + Marketplace) ──
@router.get("/products")
async def get_products(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)

    target_tenant_id: Optional[uuid.UUID] = None
    is_authenticated = bool(ctx and ctx.tenant_id)

    if is_authenticated:
        target_tenant_id = ctx.tenant_id
    elif store and store.strip():
        tenant_record = await resolve_store_tenant(db, store)
        if not tenant_record:
            raise HTTPException(status_code=404, detail=f"Store '{store}' not found")
        target_tenant_id = tenant_record.id
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication or store identifier required"
        )

    # 1. Fetch physical store products from central erp_products scoped to tenant
    erp_stmt = (
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand))
        .where(Product.tenant_id == target_tenant_id)
    )
    if not is_authenticated:
        # Public storefront only displays active products
        erp_stmt = erp_stmt.where(Product.status == EntityStatus.ACTIVE)

    erp_stmt = erp_stmt.order_by(Product.created_at.desc())
    erp_res = await db.execute(erp_stmt)
    erp_products = erp_res.scalars().all()

    unified_list = []

    for p in erp_products:
        on_hand = p.on_hand_stock if p.on_hand_stock is not None else (p.initial_stock or 0)
        reserved = p.reserved_stock or 0
        avail = max(0, on_hand - reserved)

        unified_list.append({
            "id": str(p.id),
            "sku": p.sku,
            "vendorId": "STORE-MAIN",
            "vendorName": "Store Master Inventory",
            "name": p.name,
            "category": p.category.name if p.category else "General",
            "brand": p.brand.name if p.brand else None,
            "price": float(p.online_price or p.selling_price or p.mrp or 0.0),
            "store_price": float(p.store_price or p.selling_price or 0.0),
            "online_price": float(p.online_price or p.selling_price or 0.0),
            "cost_price": float(p.purchase_price or 0.0) if is_authenticated else 0.0,
            "stock": avail,
            "on_hand_stock": on_hand if is_authenticated else avail,
            "reserved_stock": reserved if is_authenticated else 0,
            "available_stock": avail,
            "rack_location": (p.rack_location or "Main Shelf / Floor") if is_authenticated else "Store Inventory",
            "status": "Approved" if str(p.status).lower() in ["active", "entitystatus.active"] else "Pending",
            "rating": 5.0,
            "is_featured": True,
            "channel": "Omnichannel Store",
            "image_url": p.image_url,
        })

    # 2. Fetch external vendor marketplace listings scoped to tenant
    vendor_ids_subquery = select(MarketplaceVendor.id).where(MarketplaceVendor.tenant_id == str(target_tenant_id))
    mp_query = (
        select(MarketplaceProduct)
        .options(selectinload(MarketplaceProduct.vendor))
        .where(
            (MarketplaceProduct.tenant_id == str(target_tenant_id)) |
            (MarketplaceProduct.vendor_id.in_(vendor_ids_subquery))
        )
    )
    if vendor_id:
        mp_query = mp_query.where(MarketplaceProduct.vendor_id == vendor_id)
    if not is_authenticated:
        mp_query = mp_query.where(MarketplaceProduct.status == "Approved")
    elif status and status != "All":
        mp_query = mp_query.where(MarketplaceProduct.status == status)

    mp_query = mp_query.order_by(MarketplaceProduct.created_at.desc())

    mp_result = await db.execute(mp_query)
    mp_products = mp_result.scalars().all()

    for mp in mp_products:
        unified_list.append({
            "id": mp.id,
            "sku": f"SKU-{mp.id}",
            "vendorId": mp.vendor_id,
            "vendorName": mp.vendor.name if mp.vendor else "Merchant",
            "name": mp.name,
            "category": mp.category,
            "price": mp.price,
            "store_price": mp.price,
            "online_price": mp.price,
            "cost_price": mp.cost_price if is_authenticated else 0.0,
            "stock": mp.stock,
            "on_hand_stock": mp.stock,
            "reserved_stock": 0,
            "available_stock": mp.stock,
            "rack_location": "Vendor Warehouse" if is_authenticated else "Store Warehouse",
            "status": mp.status,
            "rating": mp.rating,
            "is_featured": mp.is_featured,
            "channel": "Marketplace Vendor",
            "image_url": mp.image_url,
        })

    if status and status != "All":
        unified_list = [p for p in unified_list if p["status"].lower() == status.lower()]
    if vendor_id:
        unified_list = [p for p in unified_list if p["vendorId"] == vendor_id]

    return unified_list

@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(
    product: ProductCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    if product.vendor_id and product.vendor_id != "STORE-MAIN":
        vendor_check = await db.scalar(
            select(MarketplaceVendor).where(
                MarketplaceVendor.id == product.vendor_id,
                MarketplaceVendor.tenant_id == str(ctx.tenant_id)
            )
        )
        if not vendor_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vendor '{product.vendor_id}' not found in your organization"
            )

    new_p = MarketplaceProduct(
        id=f"MP-{uuid.uuid4().hex[:4].upper()}",
        tenant_id=str(ctx.tenant_id),
        vendor_id=product.vendor_id or "STORE-MAIN",
        name=product.name,
        category=product.category,
        price=product.price,
        cost_price=product.cost_price or 0.0,
        stock=product.stock or 100,
        status="Approved",
        rating=5.0,
        is_featured=False,
    )
    db.add(new_p)
    await db.commit()
    await db.refresh(new_p)
    return new_p

@router.put("/products/{product_id}/status")
async def update_product_status(
    product_id: str,
    product_status: str = Query(..., pattern="^(Approved|Rejected|Pending)$"),
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(MarketplaceProduct).where(
        MarketplaceProduct.id == product_id,
        (MarketplaceProduct.tenant_id == str(ctx.tenant_id)) |
        (MarketplaceProduct.vendor_id.in_(
            select(MarketplaceVendor.id).where(MarketplaceVendor.tenant_id == str(ctx.tenant_id))
        ))
    )
    p = await db.scalar(stmt)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found or access denied")
    p.status = product_status
    await db.commit()
    return {"message": f"Product {product_id} status updated to {product_status}"}

# ── ORDER & FULFILLMENT ENDPOINTS (Omnichannel Unified Stock Engine) ──
@router.get("/orders")
async def get_orders(
    vendor_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    customer_email: Optional[str] = None,
    status: Optional[str] = None,
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)

    target_tenant_id: Optional[uuid.UUID] = None
    if ctx and ctx.tenant_id:
        target_tenant_id = ctx.tenant_id
    elif store and store.strip():
        tenant_rec = await resolve_store_tenant(db, store)
        if not tenant_rec:
            raise HTTPException(status_code=404, detail=f"Store '{store}' not found")
        target_tenant_id = tenant_rec.id
    elif not customer_email and not customer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication, customer identifier, or store identifier required"
        )

    query = select(MarketplaceOrder).options(selectinload(MarketplaceOrder.items))
    if target_tenant_id:
        query = query.where(MarketplaceOrder.tenant_id == str(target_tenant_id))
    if customer_id:
        query = query.where(MarketplaceOrder.customer_id == customer_id)
    if customer_email:
        query = query.where(MarketplaceOrder.customer_email.ilike(f"%{customer_email.strip()}%"))
    if status and status != "All":
        query = query.where(
            (MarketplaceOrder.order_status == status) | (MarketplaceOrder.fulfillment_status == status)
        )
    query = query.order_by(MarketplaceOrder.created_at.desc())
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return [
        {
            "id": o.id,
            "customerId": o.customer_id or "CUST-001",
            "customerName": o.customer_name,
            "customerEmail": o.customer_email,
            "customerPhone": o.customer_phone,
            "deliveryAddress": o.delivery_address,
            "vendorId": "STORE-MAIN",
            "vendorName": "Central Store Fulfillment",
            "status": o.order_status,
            "fulfillment_status": o.fulfillment_status or "Pending Pick",
            "total": o.total_amount,
            "subtotal": o.subtotal,
            "shipping_fee": o.shipping_fee,
            "payment_method": o.payment_method,
            "payment_status": o.payment_status,
            "channel": o.channel or "Online Storefront",
            "invoice_number": o.invoice_number,
            "invoice_id": o.invoice_id,
            "tracking_number": o.tracking_number,
            "expected_delivery": o.expected_delivery or (f"Expected in 2-3 Days" if o.order_status != "Delivered" else "Delivered"),
            "date": o.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if o.created_at else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "items_count": len(o.items) if o.items else 1,
            "delivery_partner": o.delivery_partner or "Express Courier",
            "notes": o.notes,
            "items": [
                {
                    "id": it.id,
                    "product_id": it.product_id,
                    "name": it.product_name,
                    "sku": it.sku or "SKU-MAIN",
                    "rack_location": it.rack_location or "Main Shelf",
                    "unit_price": it.unit_price,
                    "quantity": it.quantity,
                    "fulfillment_status": it.fulfillment_status or "Pending Pick"
                }
                for it in o.items
            ] if o.items else []
        }
        for o in orders
    ]


@router.get("/orders/{order_id}")
async def get_order_by_id(
    order_id: str,
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    customer_email: Optional[str] = Query(None, description="Customer email for public order lookup"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(MarketplaceOrder).options(selectinload(MarketplaceOrder.items)).where(MarketplaceOrder.id == order_id)
    if ctx and ctx.tenant_id:
        stmt = stmt.where(MarketplaceOrder.tenant_id == str(ctx.tenant_id))
    elif store and store.strip():
        tenant_rec = await resolve_store_tenant(db, store)
        if not tenant_rec:
            raise HTTPException(status_code=404, detail=f"Store '{store}' not found")
        stmt = stmt.where(MarketplaceOrder.tenant_id == str(tenant_rec.id))
        if customer_email:
            stmt = stmt.where(MarketplaceOrder.customer_email.ilike(f"%{customer_email.strip()}%"))
    elif customer_email:
        stmt = stmt.where(MarketplaceOrder.customer_email.ilike(f"%{customer_email.strip()}%"))
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication, customer email, or store identifier required"
        )

    res = await db.execute(stmt)
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {
        "id": o.id,
        "customerId": o.customer_id or "CUST-001",
        "customerName": o.customer_name,
        "customerEmail": o.customer_email,
        "customerPhone": o.customer_phone,
        "deliveryAddress": o.delivery_address,
        "vendorId": "STORE-MAIN",
        "vendorName": "Central Store Fulfillment",
        "status": o.order_status,
        "fulfillment_status": o.fulfillment_status or "Pending Pick",
        "total": o.total_amount,
        "subtotal": o.subtotal,
        "shipping_fee": o.shipping_fee,
        "payment_method": o.payment_method,
        "payment_status": o.payment_status,
        "channel": o.channel or "Online Storefront",
        "invoice_number": o.invoice_number,
        "invoice_id": o.invoice_id,
        "tracking_number": o.tracking_number,
        "expected_delivery": o.expected_delivery or (f"Expected in 2-3 Days" if o.order_status != "Delivered" else "Delivered"),
        "date": o.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if o.created_at else datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "delivery_partner": o.delivery_partner or "Express Courier",
        "notes": o.notes,
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "name": it.product_name,
                "sku": it.sku or "SKU-MAIN",
                "rack_location": it.rack_location or "Main Shelf",
                "unit_price": it.unit_price,
                "quantity": it.quantity,
                "fulfillment_status": it.fulfillment_status or "Pending Pick"
            }
            for it in o.items
        ] if o.items else []
    }


@router.put("/orders/{order_id}/deliver")
async def deliver_order(
    order_id: str,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(MarketplaceOrder)
        .where(
            MarketplaceOrder.id == order_id,
            MarketplaceOrder.tenant_id == str(ctx.tenant_id)
        )
        .with_for_update()
    )
    o = await db.scalar(stmt)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found or access denied")
    if o.order_status == "Cancelled":
        raise HTTPException(status_code=400, detail=f"Cannot mark cancelled order {order_id} as delivered")
    if o.order_status == "Delivered":
        return {"message": f"Order {order_id} is already marked as Delivered", "already_delivered": True}

    o.order_status = "Delivered"
    o.fulfillment_status = "Delivered"
    await db.commit()
    return {"message": f"Order {order_id} marked as Delivered"}


@router.post("/orders")
async def create_order(
    payload: Dict[str, Any],
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Transactional Omnichannel Order Creation:
    1. Resolves store organization without any fallback to random tenants.
    2. Checks idempotency_key to prevent duplicate orders or reservations on retry.
    3. Validates that requested quantities are strictly positive integers.
    4. Enforces strict tenant ownership for every item (rejects cross-tenant purchases).
    5. Locks product rows in deterministic sorted order to prevent concurrency deadlocks.
    6. Validates available stock before committing any mutation.
    7. Atomically reserves physical stock and logs immutable InventoryTransaction ('ONLINE_RESERVATION').
    8. Preserves pending-payment state for unverified online checkouts.
    9. Auto-generates single official Tax Invoice in ar_invoices.
    """
    items_data = payload.get("items", [])
    if not items_data:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    # 1. Resolve target tenant
    target_tenant_id: Optional[uuid.UUID] = None
    if ctx and ctx.tenant_id:
        target_tenant_id = ctx.tenant_id
    else:
        store_val = store or payload.get("store")
        raw_tenant_id = payload.get("tenant_id")
        if store_val and str(store_val).strip():
            tenant_record = await resolve_store_tenant(db, str(store_val).strip())
            if not tenant_record:
                raise HTTPException(status_code=404, detail=f"Store '{store_val}' not found")
            target_tenant_id = tenant_record.id
        elif raw_tenant_id:
            try:
                candidate_uuid = uuid.UUID(str(raw_tenant_id))
                t_exists = await db.scalar(select(Tenant.id).where(Tenant.id == candidate_uuid))
                if not t_exists:
                    raise HTTPException(status_code=404, detail="Store organization not found")
                target_tenant_id = t_exists
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid tenant_id format")

    if not target_tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Store identifier or tenant_id is required to place an order"
        )

    # 2. Idempotency Check: Prevent duplicate orders or double reservations on network retry
    idempotency_key = (
        payload.get("idempotency_key")
        or payload.get("client_order_id")
        or payload.get("client_reference_id")
    )
    if idempotency_key and str(idempotency_key).strip():
        clean_key = str(idempotency_key).strip()
        existing_order = await db.scalar(
            select(MarketplaceOrder)
            .options(selectinload(MarketplaceOrder.items))
            .where(
                MarketplaceOrder.tenant_id == str(target_tenant_id),
                MarketplaceOrder.idempotency_key == clean_key
            )
        )
        if existing_order:
            return {
                "id": existing_order.id,
                "invoice_number": existing_order.invoice_number,
                "invoice_id": existing_order.invoice_id,
                "status": existing_order.order_status,
                "payment_status": existing_order.payment_status,
                "fulfillment_status": existing_order.fulfillment_status,
                "expected_delivery": existing_order.expected_delivery,
                "total": existing_order.total_amount,
                "already_created": True
            }

    # 3. Validate quantities and aggregate multiple lines for the same product
    item_requests = []
    product_totals: Dict[str, int] = {}
    for it in items_data:
        pid_raw = it.get("product_id")
        if not pid_raw:
            raise HTTPException(status_code=400, detail="Each item must specify a valid product_id")
        try:
            qty = int(it.get("quantity"))
        except (TypeError, ValueError):
            qty = 1
        if qty < 1:
            raise HTTPException(
                status_code=400,
                detail=f"Requested quantity for item '{pid_raw}' must be a positive integer greater than zero (received {qty})"
            )
        pid_str = str(pid_raw).strip()
        product_totals[pid_str] = product_totals.get(pid_str, 0) + qty
        item_requests.append({
            "product_id": pid_str,
            "quantity": qty,
            "price": float(it.get("price") or 0.0),
            "name": it.get("name"),
            "vendor_id": it.get("vendor_id"),
        })

    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"

    # 4. Acquire row-level locks in deterministic sorted order (Deadlock Prevention)
    sorted_pids = sorted(product_totals.keys())
    locked_products: Dict[str, Any] = {}

    try:
        for pid_str in sorted_pids:
            erp_product = None
            try:
                p_uuid = uuid.UUID(pid_str)
                prod_stmt = select(Product).where(Product.id == p_uuid).with_for_update()
                prod_res = await db.execute(prod_stmt)
                erp_product = prod_res.scalar_one_or_none()
            except ValueError:
                erp_product = None

            if erp_product:
                if erp_product.tenant_id != target_tenant_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cross-tenant order rejected: Product '{erp_product.name}' (ID: {erp_product.id}) does not belong to this store."
                    )
                on_hand = erp_product.on_hand_stock if erp_product.on_hand_stock is not None else (erp_product.initial_stock or 0)
                reserved = erp_product.reserved_stock or 0
                available = on_hand - reserved
                needed = product_totals[pid_str]
                if available < needed:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient available stock for '{erp_product.name}'. Available: {max(0, available)}, Requested: {needed}"
                    )
                locked_products[pid_str] = ("erp", erp_product)
            else:
                mp_stmt = select(MarketplaceProduct).where(MarketplaceProduct.id == pid_str).with_for_update()
                mp_res = await db.execute(mp_stmt)
                mp_prod = mp_res.scalar_one_or_none()
                if mp_prod:
                    mp_tenant = mp_prod.tenant_id
                    if not mp_tenant and mp_prod.vendor_id:
                        v_tenant = await db.scalar(
                            select(MarketplaceVendor.tenant_id).where(MarketplaceVendor.id == mp_prod.vendor_id)
                        )
                        mp_tenant = v_tenant
                    if mp_tenant and str(mp_tenant) != str(target_tenant_id):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Cross-tenant order rejected: Marketplace product '{mp_prod.name}' does not belong to this store."
                        )
                    needed = product_totals[pid_str]
                    if (mp_prod.stock or 0) < needed:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Insufficient stock for '{mp_prod.name}'. Available: {mp_prod.stock}, Requested: {needed}"
                        )
                    locked_products[pid_str] = ("marketplace", mp_prod)
                else:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Product with ID '{pid_str}' not found"
                    )

        # 5. Apply stock reservations and record audit transactions
        processed_items = []
        total_calc = 0.0

        for req in item_requests:
            pid_str = req["product_id"]
            qty = req["quantity"]
            p_type, prod_obj = locked_products[pid_str]

            if p_type == "erp":
                price = req["price"] if req["price"] > 0 else float(prod_obj.online_price or prod_obj.selling_price or prod_obj.mrp or 0.0)
                p_name = req["name"] or prod_obj.name
                p_sku = prod_obj.sku or "SKU-MAIN"
                p_rack = prod_obj.rack_location or "Central Floor"
                item_vendor_id = req["vendor_id"] or "STORE-MAIN"

                on_hand = prod_obj.on_hand_stock if prod_obj.on_hand_stock is not None else (prod_obj.initial_stock or 0)
                curr_res = prod_obj.reserved_stock or 0
                prod_obj.on_hand_stock = on_hand
                prod_obj.reserved_stock = curr_res + qty

                inv_tx = InventoryTransaction(
                    tenant_id=prod_obj.tenant_id,
                    product_id=prod_obj.id,
                    transaction_type="ONLINE_RESERVATION",
                    quantity=qty,
                    before_on_hand=on_hand,
                    after_on_hand=on_hand,
                    before_reserved=curr_res,
                    after_reserved=curr_res + qty,
                    reference_type="ORDER",
                    reference_id=order_id,
                    notes=f"Stock reserved for web order {order_id}"
                )
                db.add(inv_tx)
            else:
                price = req["price"] if req["price"] > 0 else float(prod_obj.price or 0.0)
                p_name = req["name"] or prod_obj.name
                p_sku = prod_obj.sku or f"SKU-{prod_obj.id}"
                p_rack = "Vendor Warehouse"
                item_vendor_id = prod_obj.vendor_id

                prod_obj.stock = max(0, (prod_obj.stock or 0) - qty)

            total_calc += price * qty
            processed_items.append({
                "product_id": pid_str,
                "vendor_id": item_vendor_id,
                "name": p_name,
                "sku": p_sku,
                "rack_location": p_rack,
                "unit_price": price,
                "quantity": qty
            })

        # 6. Determine Payment & Order Status Safely
        payment_method = str(payload.get("payment_method") or "Prepaid").strip().lower()
        is_cod = payment_method in ("cod", "cash on delivery", "offline")
        payment_verif = payload.get("payment_verification") or {}
        has_verified_payment = bool(
            payload.get("is_paid") is True
            or payment_verif.get("verified") is True
            or (payload.get("payment_id") and payload.get("gateway_signature"))
        )

        total_amt = float(payload.get("total_amount") or total_calc)
        subtotal_val = total_amt * 0.82
        tax_val = total_amt * 0.18
        inv_num = f"INV-{order_id}"
        customer_name = payload.get("customer_name") or "Online Customer"

        if is_cod:
            order_payment_status = "Pending"
            order_status = "Processing"
            inv_status = "pending"
            inv_paid = 0.0
            inv_due = total_amt
        elif has_verified_payment:
            order_payment_status = "Paid"
            order_status = "Processing"
            inv_status = "paid"
            inv_paid = total_amt
            inv_due = 0.0
        else:
            order_payment_status = "Pending Payment"
            order_status = "Pending Payment"
            inv_status = "unpaid"
            inv_paid = 0.0
            inv_due = total_amt

        # 7. Create Tax Invoice in ar_invoices
        online_invoice = Invoice(
            tenant_id=target_tenant_id,
            customer_name=customer_name,
            customer_phone=payload.get("customer_phone"),
            customer_email=payload.get("customer_email"),
            shipping_address=payload.get("shipping_address"),
            invoice_number=inv_num,
            invoice_type="tax_invoice",
            order_number=order_id,
            status=inv_status,
            invoice_date=clock.today(),
            due_date=clock.today(),
            payment_terms=payload.get("payment_method") or "Online Card/UPI",
            subtotal=subtotal_val,
            cgst_amount=tax_val / 2,
            sgst_amount=tax_val / 2,
            total_amount=total_amt,
            amount_paid=inv_paid,
            balance_due=inv_due,
            notes=f"E-Commerce Online Order {order_id}. Do not re-bill at physical POS counter."
        )
        db.add(online_invoice)
        await db.flush()

        for idx, pit in enumerate(processed_items):
            line_pid = None
            try:
                line_pid = uuid.UUID(str(pit["product_id"]))
            except ValueError:
                line_pid = None

            inv_line = InvoiceLine(
                invoice_id=online_invoice.id,
                line_number=idx + 1,
                product_id=line_pid,
                product_name=pit["name"],
                product_sku=pit["sku"],
                quantity=pit["quantity"],
                unit_price=pit["unit_price"],
                taxable_amount=pit["unit_price"] * pit["quantity"] * 0.82,
                tax_rate=18.0,
                cgst_amount=(pit["unit_price"] * pit["quantity"] * 0.18) / 2,
                sgst_amount=(pit["unit_price"] * pit["quantity"] * 0.18) / 2,
                line_total=pit["unit_price"] * pit["quantity"]
            )
            db.add(inv_line)

        # 8. Create Marketplace Order & Order Items
        exp_delivery = payload.get("expected_delivery") or "Expected in 2-3 Business Days"
        order = MarketplaceOrder(
            id=order_id,
            tenant_id=str(target_tenant_id),
            customer_id=payload.get("customer_id") or f"CUST-{uuid.uuid4().hex[:4].upper()}",
            customer_name=customer_name,
            customer_email=payload.get("customer_email"),
            customer_phone=payload.get("customer_phone"),
            delivery_address=payload.get("shipping_address"),
            subtotal=subtotal_val,
            shipping_fee=float(payload.get("shipping_fee") or 0.0),
            total_amount=total_amt,
            payment_method=payload.get("payment_method") or ("Cash on Delivery" if is_cod else "Prepaid"),
            payment_status=order_payment_status,
            order_status=order_status,
            fulfillment_status="Pending Pick",
            delivery_partner=payload.get("delivery_partner") or "Express Delivery",
            expected_delivery=exp_delivery,
            invoice_number=inv_num,
            invoice_id=str(online_invoice.id),
            channel=payload.get("channel") or "Online Storefront",
            notes=payload.get("notes"),
            idempotency_key=str(idempotency_key).strip() if idempotency_key else None,
            gateway_order_id=payload.get("gateway_order_id") or payload.get("razorpay_order_id"),
            gateway_payment_id=payload.get("payment_id") or payload.get("razorpay_payment_id"),
        )
        db.add(order)
        await db.flush()

        store_vendor_id = await get_or_create_store_vendor(db, target_tenant_id)
        for pit in processed_items:
            v_id = pit.get("vendor_id")
            if not v_id or v_id == "STORE-MAIN":
                v_id = store_vendor_id
            order_item = MarketplaceOrderItem(
                order_id=order.id,
                vendor_id=v_id,
                product_id=pit["product_id"],
                product_name=pit["name"],
                sku=pit["sku"],
                rack_location=pit["rack_location"],
                unit_price=pit["unit_price"],
                quantity=pit["quantity"],
                fulfillment_status="Pending Pick"
            )
            db.add(order_item)

        await db.commit()
        return {
            "id": order.id,
            "invoice_number": inv_num,
            "invoice_id": str(online_invoice.id),
            "status": order.order_status,
            "order_status": order.order_status,
            "payment_status": order.payment_status,
            "fulfillment_status": order.fulfillment_status,
            "expected_delivery": order.expected_delivery,
            "total": order.total_amount
        }
    except Exception:
        await db.rollback()
        raise


@router.post("/orders/{order_id}/confirm-payment")
async def confirm_order_payment(
    order_id: str,
    payload: Optional[Dict[str, Any]] = None,
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Idempotently confirms payment for an order upon gateway callback or checkout verification.
    Handles duplicate payment callbacks idempotently.
    Defines safe behavior if payment arrives after cancellation.
    """
    payload = payload or {}
    payment_id = payload.get("payment_id") or payload.get("razorpay_payment_id") or f"PAY-{uuid.uuid4().hex[:8].upper()}"

    stmt = (
        select(MarketplaceOrder)
        .options(selectinload(MarketplaceOrder.items))
        .where(MarketplaceOrder.id == order_id)
        .with_for_update()
    )
    if ctx and ctx.tenant_id:
        stmt = stmt.where(MarketplaceOrder.tenant_id == str(ctx.tenant_id))

    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or access denied")

    # Idempotent: already paid
    if order.payment_status == "Paid":
        return {
            "message": f"Payment for order {order_id} is already confirmed",
            "order_id": order_id,
            "status": order.order_status,
            "payment_status": order.payment_status,
            "already_processed": True
        }

    # Safe handling: payment arriving AFTER cancellation
    if order.order_status == "Cancelled":
        order.payment_status = "Refund Pending"
        order.gateway_payment_id = str(payment_id)
        order.notes = f"{order.notes or ''}\n[WARNING] Payment {payment_id} received after order was cancelled. Stock was NOT re-reserved; refund is required."
        await db.commit()
        return {
            "message": f"Order {order_id} was already cancelled; payment recorded and marked for refund",
            "order_id": order_id,
            "payment_status": "Refund Pending",
            "refund_required": True,
            "stock_altered": False
        }

    # Normal confirmation pre-dispatch
    order.payment_status = "Paid"
    order.gateway_payment_id = str(payment_id)
    if order.order_status == "Pending Payment":
        order.order_status = "Processing"

    # Update corresponding invoice
    if order.invoice_number or order.invoice_id:
        inv_stmt = select(Invoice).where(
            or_(
                Invoice.order_number == order_id,
                Invoice.invoice_number == order.invoice_number
            )
        )
        inv = await db.scalar(inv_stmt)
        if inv:
            inv.status = "paid"
            inv.amount_paid = order.total_amount
            inv.balance_due = 0.0

    await db.commit()
    return {
        "message": f"Payment for order {order_id} confirmed successfully",
        "order_id": order_id,
        "payment_status": "Paid",
        "order_status": order.order_status
    }


@router.post("/orders/{order_id}/fail-payment")
async def fail_order_payment(
    order_id: str,
    payload: Optional[Dict[str, Any]] = None,
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Handles payment failure callback without duplicating reservations.
    Optionally releases stock reservation if auto_cancel is requested."""
    payload = payload or {}
    stmt = (
        select(MarketplaceOrder)
        .options(selectinload(MarketplaceOrder.items))
        .where(MarketplaceOrder.id == order_id)
        .with_for_update()
    )
    if ctx and ctx.tenant_id:
        stmt = stmt.where(MarketplaceOrder.tenant_id == str(ctx.tenant_id))

    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or access denied")

    if order.payment_status == "Paid":
        raise HTTPException(status_code=400, detail="Cannot fail payment: order is already marked as Paid")
    if order.order_status in ["Shipped", "Delivered"]:
        raise HTTPException(status_code=400, detail=f"Cannot fail payment: order has already been {order.order_status.lower()}")

    reason = payload.get("reason") or "Payment authorization declined by gateway"
    auto_cancel = payload.get("auto_cancel", True)

    order.payment_status = "Failed"
    order.notes = f"{order.notes or ''}\n[PAYMENT_FAILURE] {reason}"

    if auto_cancel and order.order_status != "Cancelled":
        for it in order.items:
            if it.product_id:
                try:
                    p_uuid = uuid.UUID(str(it.product_id))
                    prod_stmt = select(Product).where(Product.id == p_uuid).with_for_update()
                    product = await db.scalar(prod_stmt)
                    if product:
                        curr_on_hand = product.on_hand_stock if product.on_hand_stock is not None else (product.initial_stock or 0)
                        curr_res = product.reserved_stock or 0
                        new_res = max(0, curr_res - it.quantity)
                        product.reserved_stock = new_res

                        inv_tx = InventoryTransaction(
                            tenant_id=product.tenant_id,
                            product_id=product.id,
                            transaction_type="ONLINE_RESERVATION_RELEASE",
                            quantity=it.quantity,
                            before_on_hand=curr_on_hand,
                            after_on_hand=curr_on_hand,
                            before_reserved=curr_res,
                            after_reserved=new_res,
                            reference_type="PAYMENT_FAILED",
                            reference_id=order_id,
                            notes=f"Stock reservation released due to payment failure on order {order_id}"
                        )
                        db.add(inv_tx)
                except ValueError:
                    mp_stmt = select(MarketplaceProduct).where(MarketplaceProduct.id == str(it.product_id)).with_for_update()
                    mp_prod = await db.scalar(mp_stmt)
                    if mp_prod:
                        mp_prod.stock = (mp_prod.stock or 0) + it.quantity

        order.order_status = "Cancelled"
        order.fulfillment_status = "Cancelled"

    await db.commit()
    return {
        "message": f"Payment failure processed for order {order_id}",
        "order_id": order_id,
        "payment_status": "Failed",
        "order_status": order.order_status,
        "reservation_released": auto_cancel
    }


@router.put("/orders/{order_id}/pack")
async def pack_order(
    order_id: str,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(MarketplaceOrder).where(
        MarketplaceOrder.id == order_id,
        MarketplaceOrder.tenant_id == str(ctx.tenant_id)
    ).with_for_update()
    o = await db.scalar(stmt)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found or access denied")
    if o.order_status == "Cancelled":
        raise HTTPException(status_code=400, detail=f"Cannot pack cancelled order {order_id}")
    if o.order_status in ["Shipped", "Delivered"]:
        raise HTTPException(status_code=400, detail=f"Order {order_id} has already been {o.order_status.lower()}")

    o.fulfillment_status = "Ready to Ship"
    await db.commit()
    return {"message": f"Order {order_id} marked as packed & ready to ship"}


@router.put("/orders/{order_id}/dispatch")
async def dispatch_order(
    order_id: str,
    payload: Optional[Dict[str, Any]] = None,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Store Employee Dispatch:
    1. Verifies order belongs to authenticated tenant (with row-level lock).
    2. Rejects dispatch if order is cancelled.
    3. Idempotently returns if already shipped or delivered.
    4. Releases reserved stock and deducts physical on-hand inventory.
    5. Logs immutable InventoryTransaction ('ONLINE_DISPATCH').
    6. Records courier, tracking number, and updated expected delivery.
    """
    courier = (payload or {}).get("courier") or "Express Delivery"
    tracking = (payload or {}).get("tracking_number") or f"TRK-{uuid.uuid4().hex[:8].upper()}"
    exp_delivery = (payload or {}).get("expected_delivery") or (payload or {}).get("eta") or "Estimated Delivery Tomorrow by 6:00 PM"

    stmt = (
        select(MarketplaceOrder)
        .options(selectinload(MarketplaceOrder.items))
        .where(
            MarketplaceOrder.id == order_id,
            MarketplaceOrder.tenant_id == str(ctx.tenant_id)
        )
        .with_for_update()
    )
    res = await db.execute(stmt)
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found or access denied")

    # State validation: cannot dispatch a cancelled order
    if o.order_status == "Cancelled":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot dispatch order {order_id}: order has been cancelled"
        )

    # Idempotent guard: already shipped or delivered
    if o.fulfillment_status == "Shipped" or o.order_status == "Shipped":
        return {
            "message": f"Order {order_id} has already been dispatched",
            "already_dispatched": True,
            "tracking_number": o.tracking_number,
            "expected_delivery": o.expected_delivery
        }
    if o.order_status == "Delivered":
        return {
            "message": f"Order {order_id} has already been delivered",
            "already_dispatched": True
        }

    try:
        # Deduct physical stock & release reservation
        for it in o.items:
            if it.product_id:
                try:
                    p_uuid = uuid.UUID(str(it.product_id))
                    prod_stmt = select(Product).where(Product.id == p_uuid).with_for_update()
                    prod_res = await db.execute(prod_stmt)
                    product = prod_res.scalar_one_or_none()
                    if product:
                        curr_on_hand = product.on_hand_stock if product.on_hand_stock is not None else (product.initial_stock or 0)
                        curr_res = product.reserved_stock or 0
                        
                        new_on_hand = max(0, curr_on_hand - it.quantity)
                        new_res = max(0, curr_res - it.quantity)
                        
                        product.on_hand_stock = new_on_hand
                        product.initial_stock = new_on_hand
                        product.reserved_stock = new_res

                        inv_tx = InventoryTransaction(
                            tenant_id=product.tenant_id,
                            product_id=product.id,
                            transaction_type="ONLINE_DISPATCH",
                            quantity=it.quantity,
                            before_on_hand=curr_on_hand,
                            after_on_hand=new_on_hand,
                            before_reserved=curr_res,
                            after_reserved=new_res,
                            reference_type="SHIPMENT",
                            reference_id=order_id,
                            notes=f"Physical stock dispatched via {courier} (Tracking: {tracking})"
                        )
                        db.add(inv_tx)
                except ValueError:
                    pass

        o.order_status = "Shipped"
        o.fulfillment_status = "Shipped"
        o.delivery_partner = courier
        o.tracking_number = tracking
        o.expected_delivery = exp_delivery
        await db.commit()
        return {
            "message": f"Order {order_id} dispatched via {courier}",
            "order_status": "Shipped",
            "fulfillment_status": "Shipped",
            "tracking_number": tracking,
            "expected_delivery": exp_delivery
        }
    except Exception:
        await db.rollback()
        raise


@router.put("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    """Pre-dispatch cancellation: releases reserved stock back to available inventory.
    1. Row-level locks order row to prevent racing with dispatch or duplicate requests.
    2. Idempotently returns if already cancelled.
    3. Strictly rejects cancellation if already Shipped or Delivered.
    4. Releases reservations for both ERP and Marketplace products.
    5. Updates order status and reflects refund status if previously paid.
    6. Cancels linked tax invoice in ar_invoices.
    """
    stmt = (
        select(MarketplaceOrder)
        .options(selectinload(MarketplaceOrder.items))
        .where(
            MarketplaceOrder.id == order_id,
            MarketplaceOrder.tenant_id == str(ctx.tenant_id)
        )
        .with_for_update()
    )
    res = await db.execute(stmt)
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found or access denied")

    # Idempotent check
    if o.order_status == "Cancelled":
        return {
            "message": f"Order {order_id} is already cancelled",
            "status": "Cancelled",
            "order_status": "Cancelled",
            "already_cancelled": True
        }

    # State validation: Cannot cancel dispatched or delivered orders
    if o.order_status in ["Shipped", "Delivered"] or o.fulfillment_status in ["Shipped", "Delivered"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order {order_id}: order has already been {o.order_status.lower()}. Please initiate a return request instead."
        )

    try:
        # Release reservations exactly once
        for it in o.items:
            if it.product_id:
                try:
                    p_uuid = uuid.UUID(str(it.product_id))
                    prod_stmt = select(Product).where(Product.id == p_uuid).with_for_update()
                    prod_res = await db.execute(prod_stmt)
                    product = prod_res.scalar_one_or_none()
                    if product:
                        curr_on_hand = product.on_hand_stock if product.on_hand_stock is not None else (product.initial_stock or 0)
                        curr_res = product.reserved_stock or 0
                        new_res = max(0, curr_res - it.quantity)
                        product.reserved_stock = new_res

                        inv_tx = InventoryTransaction(
                            tenant_id=product.tenant_id,
                            product_id=product.id,
                            transaction_type="ONLINE_RESERVATION_RELEASE",
                            quantity=it.quantity,
                            before_on_hand=curr_on_hand,
                            after_on_hand=curr_on_hand,
                            before_reserved=curr_res,
                            after_reserved=new_res,
                            reference_type="CANCEL",
                            reference_id=order_id,
                            notes=f"Stock reservation released for cancelled order {order_id}"
                        )
                        db.add(inv_tx)
                except ValueError:
                    mp_stmt = select(MarketplaceProduct).where(MarketplaceProduct.id == str(it.product_id)).with_for_update()
                    mp_prod = await db.scalar(mp_stmt)
                    if mp_prod:
                        mp_prod.stock = (mp_prod.stock or 0) + it.quantity

        o.order_status = "Cancelled"
        o.fulfillment_status = "Cancelled"
        if o.payment_status == "Paid":
            o.payment_status = "Refund Pending"
        else:
            o.payment_status = "Cancelled"

        # Cancel linked invoice
        if o.invoice_number or o.invoice_id:
            inv_stmt = select(Invoice).where(
                or_(
                    Invoice.order_number == order_id,
                    Invoice.invoice_number == o.invoice_number
                )
            )
            inv = await db.scalar(inv_stmt)
            if inv:
                inv.status = "cancelled"

        await db.commit()
        return {
            "message": f"Order {order_id} cancelled and stock reservation released",
            "status": "Cancelled",
            "order_status": "Cancelled",
            "payment_status": o.payment_status
        }
    except Exception:
        await db.rollback()
        raise

# ── PAYOUTS (SQLAlchemy DB-Backed) ──
@router.get("/payouts")
async def get_payouts(
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)
    query = (
        select(MarketplacePayout)
        .join(MarketplaceVendor, MarketplacePayout.vendor_id == MarketplaceVendor.id)
        .options(selectinload(MarketplacePayout.vendor))
        .where(MarketplaceVendor.tenant_id == str(ctx.tenant_id))
        .order_by(MarketplacePayout.created_at.desc())
    )
    result = await db.execute(query)
    payouts = result.scalars().all()
    return [
        {
            "id": p.id,
            "vendorId": p.vendor_id,
            "vendorName": p.vendor.name if p.vendor else "Merchant",
            "amount": p.amount,
            "status": p.status,
            "date": p.created_at.strftime("%Y-%m-%d"),
            "method": p.method,
            "bankRef": p.bank_reference,
        }
        for p in payouts
    ]


@router.post("/payouts", status_code=status.HTTP_201_CREATED)
async def create_payout(
    payout: PayoutCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    v = await db.scalar(
        select(MarketplaceVendor).where(
            MarketplaceVendor.id == payout.vendor_id,
            MarketplaceVendor.tenant_id == str(ctx.tenant_id)
        )
    )
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found or access denied")

    new_pay = MarketplacePayout(
        id=f"PAY-{uuid.uuid4().hex[:4].upper()}",
        tenant_id=str(ctx.tenant_id),
        vendor_id=payout.vendor_id,
        amount=payout.amount,
        status="Cleared",
        method=payout.method or "WPS Bank Transfer",
        bank_reference=f"DXB-WPS-{uuid.uuid4().hex[:4].upper()}",
    )
    db.add(new_pay)
    
    # Deduct vendor escrow
    v.escrow_balance = max(0.0, (v.escrow_balance or 0.0) - payout.amount)
        
    await db.commit()
    return new_pay


# ── PROMOTIONS & COUPONS (SQLAlchemy DB-Backed) ──
@router.get("/coupons")
async def get_coupons(
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)

    target_tenant_id: Optional[uuid.UUID] = None
    if ctx and ctx.tenant_id:
        target_tenant_id = ctx.tenant_id
    elif store and store.strip():
        tenant_rec = await resolve_store_tenant(db, store)
        if not tenant_rec:
            raise HTTPException(status_code=404, detail=f"Store '{store}' not found")
        target_tenant_id = tenant_rec.id

    query = select(MarketplacePromotion)
    if target_tenant_id:
        query = query.where(
            (MarketplacePromotion.tenant_id == str(target_tenant_id)) | (MarketplacePromotion.tenant_id.is_(None))
        )
    query = query.order_by(MarketplacePromotion.created_at.desc())
    result = await db.execute(query)
    promos = result.scalars().all()
    return [
        {
            "code": p.code,
            "discount": f"{p.discount_value}% OFF" if p.discount_type == "percentage" else f"₹{p.discount_value} FLAT",
            "discount_type": p.discount_type,
            "discount_value": p.discount_value,
            "minOrder": f"₹{p.min_order_amount}",
            "maxUsage": p.max_usage,
            "usedCount": p.used_count,
            "expiry": p.expiry_date.strftime("%Y-%m-%d") if p.expiry_date else "2026-12-31",
            "status": p.status,
        }
        for p in promos
    ]


@router.post("/coupons", status_code=status.HTTP_201_CREATED)
async def create_coupon(
    coupon: PromotionCreate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db)
):
    new_c = MarketplacePromotion(
        id=f"PROMO-{uuid.uuid4().hex[:4].upper()}",
        tenant_id=str(ctx.tenant_id),
        code=coupon.code.upper(),
        discount_type=coupon.discount_type,
        discount_value=coupon.discount_value,
        min_order_amount=coupon.min_order_amount or 0.0,
        max_usage=coupon.max_usage or 1000,
        used_count=0,
        status="Active",
    )
    db.add(new_c)
    await db.commit()
    return new_c


# ── TAXONOMIES & PARTNERS ──
@router.get("/vendor-categories")
async def get_vendor_categories(
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    target_tenant_id: Optional[uuid.UUID] = None
    if ctx and ctx.tenant_id:
        target_tenant_id = ctx.tenant_id
    elif store and store.strip():
        tenant_rec = await resolve_store_tenant(db, store)
        if tenant_rec:
            target_tenant_id = tenant_rec.id

    stmt = select(MarketplaceVendor.category, func.count(MarketplaceVendor.id))
    if target_tenant_id:
        stmt = stmt.where(MarketplaceVendor.tenant_id == str(target_tenant_id))
    stmt = stmt.group_by(MarketplaceVendor.category)
    res = await db.execute(stmt)
    rows = res.all()
    if not rows:
        return []
    return [
        {
            "id": f"VCAT-{i+1:02d}",
            "name": cat or "General",
            "commissionRate": "10.0%",
            "vendorCount": count,
            "activeListings": 0,
            "status": "Active"
        }
        for i, (cat, count) in enumerate(rows)
    ]


@router.get("/vendor-contracts")
async def get_vendor_contracts(
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db)
):
    target_tenant_id: Optional[uuid.UUID] = None
    if ctx and ctx.tenant_id:
        target_tenant_id = ctx.tenant_id
    elif store and store.strip():
        tenant_rec = await resolve_store_tenant(db, store)
        if tenant_rec:
            target_tenant_id = tenant_rec.id

    stmt = select(MarketplaceVendor).where(MarketplaceVendor.status == "Active")
    if target_tenant_id:
        stmt = stmt.where(MarketplaceVendor.tenant_id == str(target_tenant_id))
    res = await db.execute(stmt)
    vendors = res.scalars().all()
    if not vendors:
        return []
    return [
        {
            "id": f"CTR-{v.id}",
            "vendor": v.name,
            "type": "Standard Marketplace Tier",
            "commission": f"{v.commission_rate or 10.0}%",
            "startDate": v.join_date.strftime("%Y-%m-%d") if v.join_date else "2026-01-01",
            "expiryDate": "2027-12-31",
            "status": v.status,
            "sla": "98.5%"
        }
        for v in vendors
    ]

@router.get("/delivery-partners")
async def get_delivery_partners():
    return []

# ── B2B WHOLESALE & PRICING RULES ──
MOCK_PRICING_RULES: List[Dict[str, Any]] = []

@router.get("/pricing-rules")
async def get_pricing_rules():
    return MOCK_PRICING_RULES

@router.post("/pricing-rules", status_code=status.HTTP_201_CREATED)
async def create_pricing_rule(rule: dict):
    new_r = {
        "id": f"PRULE-{uuid.uuid4().hex[:4].upper()}",
        "name": rule.get("name"),
        "category": rule.get("category"),
        "moq": rule.get("moq", 10),
        "buyer_group": rule.get("buyer_group", "Wholesalers"),
        "tiers": rule.get("tiers", []),
        "status": "Active"
    }
    MOCK_PRICING_RULES.insert(0, new_r)
    return new_r

# ── B2B RFQ (REQUEST FOR QUOTATION) & BIDDING DESK ──
MOCK_RFQS: List[Dict[str, Any]] = []

@router.get("/rfqs")
async def get_rfqs():
    return MOCK_RFQS

@router.post("/rfqs", status_code=status.HTTP_201_CREATED)
async def create_rfq(rfq: dict):
    new_rfq = {
        "id": f"RFQ-2026-{uuid.uuid4().hex[:3].upper()}",
        "buyer_name": rfq.get("buyer_name", "Enterprise Buyer"),
        "buyer_company": rfq.get("buyer_company", "Procurement Corp"),
        "product_name": rfq.get("product_name"),
        "category": rfq.get("category", "General"),
        "quantity": rfq.get("quantity", 100),
        "target_price": rfq.get("target_price", 0.0),
        "delivery_location": rfq.get("delivery_location", "Dubai, UAE"),
        "deadline": rfq.get("deadline", "2026-12-31"),
        "status": "Open",
        "bids": []
    }
    MOCK_RFQS.insert(0, new_rfq)
    return new_rfq

@router.post("/rfqs/{rfq_id}/bid")
async def submit_rfq_bid(rfq_id: str, bid: dict):
    for r in MOCK_RFQS:
        if r["id"] == rfq_id:
            new_bid = {
                "id": f"BID-{uuid.uuid4().hex[:3].upper()}",
                "vendor_id": bid.get("vendor_id", "VND-001"),
                "vendor_name": bid.get("vendor_name", "Verified Supplier"),
                "bid_unit_price": bid.get("bid_unit_price", 0.0),
                "delivery_days": bid.get("delivery_days", 7),
                "status": "Pending"
            }
            r["bids"].append(new_bid)
            return {"message": "Bid submitted successfully", "bid": new_bid}
    raise HTTPException(status_code=404, detail="RFQ not found")

@router.put("/rfqs/{rfq_id}/accept-bid")
async def accept_rfq_bid(rfq_id: str, bid_id: str = Query(...)):
    for r in MOCK_RFQS:
        if r["id"] == rfq_id:
            for b in r["bids"]:
                if b["id"] == bid_id:
                    b["status"] = "Accepted"
                    r["status"] = "Accepted"
                    return {"message": f"Bid {bid_id} accepted for RFQ {rfq_id}", "rfq": r}
    raise HTTPException(status_code=404, detail="RFQ or Bid not found")

# ── B2B TRADE CREDIT & NET TERMS ──
MOCK_TRADE_CREDIT = [
    {"buyer_id": "BCUST-101", "buyer_name": "Al-Manara Retail Hypermarkets LLC", "credit_limit": 250000.0, "used_credit": 142500.0, "available_credit": 107500.0, "payment_terms": "Net 60", "overdue": 0.0, "status": "Active"},
    {"buyer_id": "BCUST-102", "buyer_name": "Emirates Luxury Suites Hotel", "credit_limit": 150000.0, "used_credit": 98000.0, "available_credit": 52000.0, "payment_terms": "Net 30", "overdue": 0.0, "status": "Active"},
    {"buyer_id": "BCUST-103", "buyer_name": "Gulf Coast Distribution Co", "credit_limit": 500000.0, "used_credit": 485000.0, "available_credit": 15000.0, "payment_terms": "Net 90 (PDC)", "overdue": 12500.0, "status": "Warning"},
    {"buyer_id": "BCUST-104", "buyer_name": "Sharjah City Mart Superstores", "credit_limit": 80000.0, "used_credit": 12000.0, "available_credit": 68000.0, "payment_terms": "Net 30", "overdue": 0.0, "status": "Active"},
]

@router.get("/trade-credit")
async def get_trade_credits():
    return MOCK_TRADE_CREDIT



# ── STOREFRONT THEME & TEMPLATE SETTINGS (Organization Scoped DB Persistence) ──
DEFAULT_STOREFRONT_THEME = {
    "theme_id": "speed_mart",
    "store_name": "ExpressMart",
    "tagline": "10-Minute Hyperlocal Quick Commerce",
    "sector": "Quick Commerce",
    "announcement_text": "⚡ 10-Minute Hyperlocal Quick Commerce • Free Transit Health Guarantee • Same-Day Dispatch",
    "support_phone": "+91 98450 12345",
    "support_email": "support@businessos.store",
    "primary_color": "#7C3AED",
    "accent_color": "#F59E0B",
    "bg_tone": "#FDF4FF",
}

def _format_theme_response(
    record: Optional[MarketplaceThemeSettings],
    store_slug: Optional[str] = None,
    is_published: bool = True,
    default_name: Optional[str] = None,
) -> Dict[str, Any]:
    if not record:
        return {
            "theme_id": DEFAULT_STOREFRONT_THEME["theme_id"],
            "store_name": DEFAULT_STOREFRONT_THEME["store_name"],
            "tagline": DEFAULT_STOREFRONT_THEME["tagline"],
            "sector": DEFAULT_STOREFRONT_THEME["sector"],
            "announcement_text": DEFAULT_STOREFRONT_THEME["announcement_text"],
            "support_phone": DEFAULT_STOREFRONT_THEME["support_phone"],
            "support_email": DEFAULT_STOREFRONT_THEME["support_email"],
            "primary_color": DEFAULT_STOREFRONT_THEME["primary_color"],
            "accent_color": DEFAULT_STOREFRONT_THEME["accent_color"],
            "bg_tone": DEFAULT_STOREFRONT_THEME["bg_tone"],
            "store_slug": store_slug,
            "is_published": is_published,
            "updated_at": None,
        }
    return {
        "theme_id": record.theme_id,
        "store_name": record.store_name,
        "tagline": record.tagline,
        "sector": record.sector,
        "announcement_text": record.announcement_text,
        "support_phone": record.support_phone,
        "support_email": record.support_email,
        "primary_color": record.primary_color,
        "accent_color": record.accent_color,
        "bg_tone": record.bg_tone,
        "store_slug": store_slug,
        "is_published": getattr(record, "is_published", True) if getattr(record, "is_published", None) is not None else True,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }

@router.get("/theme")
async def get_marketplace_theme(
    store: Optional[str] = Query(None, description="Public store slug or tenant ID"),
    ctx: Optional[CurrentUserContext] = Depends(get_optional_user_context),
    db: AsyncSession = Depends(get_db),
):
    # Case 1: Public store resolution via query param 'store'
    if store and store.strip():
        store_val = store.strip()
        tenant_record = None

        # Check if store_val is a UUID (tenant_id)
        try:
            val_uuid = uuid.UUID(store_val)
            tenant_record = await db.scalar(select(Tenant).where(Tenant.id == val_uuid))
        except (ValueError, TypeError):
            pass

        # If not matched by UUID, match by slug (case-insensitive)
        if not tenant_record:
            tenant_record = await db.scalar(
                select(Tenant).where(func.lower(Tenant.slug) == store_val.lower())
            )

        # If not matched by slug, check by name
        if not tenant_record:
            tenant_record = await db.scalar(
                select(Tenant).where(func.lower(Tenant.name) == store_val.lower())
            )

        if not tenant_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Store '{store_val}' not found"
            )

        stmt = select(MarketplaceThemeSettings).where(
            MarketplaceThemeSettings.tenant_id == tenant_record.id
        )
        record = await db.scalar(stmt)
        if record and record.is_published is False:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Store '{store_val}' is currently unpublished"
            )

        return _format_theme_response(
            record,
            store_slug=tenant_record.slug,
            is_published=record.is_published if record else True,
            default_name=tenant_record.name,
        )

    # Case 2: Authenticated user context
    if ctx and ctx.tenant_id:
        stmt = select(MarketplaceThemeSettings).where(
            MarketplaceThemeSettings.tenant_id == ctx.tenant_id
        )
        record = await db.scalar(stmt)
        tenant_rec = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
        slug = tenant_rec.slug if tenant_rec else None
        return _format_theme_response(
            record,
            store_slug=slug,
            is_published=record.is_published if record else True,
            default_name=tenant_rec.name if tenant_rec else None,
        )

    # Case 3: Neither store param nor authenticated context
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Organization context or store slug required"
    )

@router.put("/theme")
async def update_marketplace_theme(
    payload: StoreThemeUpdate,
    ctx: CurrentUserContext = Depends(get_current_user_context),
    db: AsyncSession = Depends(get_db),
):
    if not ctx or not ctx.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Organization context required"
        )

    tenant_rec = await db.scalar(select(Tenant).where(Tenant.id == ctx.tenant_id))
    if not tenant_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant organization record not found"
        )

    data = payload.model_dump(exclude_unset=True)

    # Validate and update store_slug if provided
    if "store_slug" in data and data["store_slug"] is not None:
        clean_slug = data["store_slug"].strip().lower()
        if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", clean_slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Store slug may only contain lowercase alphanumeric characters and hyphens, and cannot start or end with a hyphen."
            )
        if len(clean_slug) < 3 or len(clean_slug) > 60:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Store slug must be between 3 and 60 characters long."
            )
        RESERVED_SLUGS = {
            "admin", "api", "auth", "login", "register", "logout",
            "store", "shop", "cart", "checkout", "orders", "account",
            "marketplace", "dashboard", "settings", "inventory", "pos",
            "crm", "hrms", "erp", "procurement", "reports", "public"
        }
        if clean_slug in RESERVED_SLUGS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Store slug '{clean_slug}' is a reserved system path and cannot be used."
            )
        existing_tenant = await db.scalar(
            select(Tenant).where(
                func.lower(Tenant.slug) == clean_slug,
                Tenant.id != ctx.tenant_id
            )
        )
        if existing_tenant:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Store slug '{clean_slug}' is already taken by another organization."
            )
        tenant_rec.slug = clean_slug

    stmt = select(MarketplaceThemeSettings).where(
        MarketplaceThemeSettings.tenant_id == ctx.tenant_id
    )
    record = await db.scalar(stmt)

    if not record:
        record = MarketplaceThemeSettings(
            tenant_id=ctx.tenant_id,
            theme_id=data.get("theme_id") or DEFAULT_STOREFRONT_THEME["theme_id"],
            store_name=data.get("store_name") or (tenant_rec.name if tenant_rec else DEFAULT_STOREFRONT_THEME["store_name"]),
            tagline=data.get("tagline", DEFAULT_STOREFRONT_THEME["tagline"]),
            sector=data.get("sector", DEFAULT_STOREFRONT_THEME["sector"]),
            announcement_text=data.get("announcement_text", DEFAULT_STOREFRONT_THEME["announcement_text"]),
            support_phone=data.get("support_phone", DEFAULT_STOREFRONT_THEME["support_phone"]),
            support_email=data.get("support_email", DEFAULT_STOREFRONT_THEME["support_email"]),
            primary_color=data.get("primary_color") or DEFAULT_STOREFRONT_THEME["primary_color"],
            accent_color=data.get("accent_color") or DEFAULT_STOREFRONT_THEME["accent_color"],
            bg_tone=data.get("bg_tone") or DEFAULT_STOREFRONT_THEME["bg_tone"],
            is_published=data.get("is_published", True),
        )
        db.add(record)
    else:
        if "theme_id" in data and data["theme_id"] is not None:
            record.theme_id = data["theme_id"]
        if "store_name" in data and data["store_name"] is not None:
            record.store_name = data["store_name"]
        if "tagline" in data:
            record.tagline = data["tagline"]
        if "sector" in data:
            record.sector = data["sector"]
        if "announcement_text" in data:
            record.announcement_text = data["announcement_text"]
        if "support_phone" in data:
            record.support_phone = data["support_phone"]
        if "support_email" in data:
            record.support_email = data["support_email"]
        if "primary_color" in data and data["primary_color"] is not None:
            record.primary_color = data["primary_color"]
        if "accent_color" in data and data["accent_color"] is not None:
            record.accent_color = data["accent_color"]
        if "bg_tone" in data and data["bg_tone"] is not None:
            record.bg_tone = data["bg_tone"]
        if "is_published" in data and data["is_published"] is not None:
            record.is_published = data["is_published"]

    await db.commit()
    await db.refresh(record)
    await db.refresh(tenant_rec)

    return {
        "message": "Storefront theme settings updated successfully",
        "theme": _format_theme_response(
            record,
            store_slug=tenant_rec.slug,
            is_published=record.is_published,
            default_name=tenant_rec.name,
        ),
    }



