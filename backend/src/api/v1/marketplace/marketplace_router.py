import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
from sqlalchemy.orm import selectinload

from src.database.session import get_db
from src.models.marketplace import (
    MarketplaceVendor, MarketplaceProduct, MarketplaceOrder,
    MarketplaceOrderItem, MarketplacePayout, MarketplacePromotion
)
from src.schemas.marketplace import (
    VendorCreate, VendorUpdate, ProductCreate, ProductUpdate,
    OrderCreate, PayoutCreate, PromotionCreate
)

router = APIRouter()

# ── Dynamic Seed Function ensuring DB tables have initial records ──
async def ensure_seeded_data(db: AsyncSession):
    stmt = select(func.count(MarketplaceVendor.id))
    count = await db.scalar(stmt)
    if count == 0:
        v1 = MarketplaceVendor(
            id="VND-001", name="TechNova Electronics LLC", category="Electronics", status="Active",
            rating=4.8, total_orders=12450, revenue=1450000.0, commission_rate=8.5, escrow_balance=48500.0,
            location="Dubai, UAE", email="contact@technova.ae", phone="+971 4 800 1234",
            trade_license="DED-1049281", tax_trn="TRN-10049281900003", kyc_status="Approved"
        )
        v2 = MarketplaceVendor(
            id="VND-002", name="Arabian Coffee Roasters", category="Food & Beverage", status="Active",
            rating=4.9, total_orders=34200, revenue=890000.0, commission_rate=10.0, escrow_balance=24200.0,
            location="Abu Dhabi, UAE", email="orders@arabiancoffee.ae", phone="+971 2 600 5678",
            trade_license="AD-8842019", tax_trn="TRN-10088420190003", kyc_status="Approved"
        )
        v3 = MarketplaceVendor(
            id="VND-003", name="Fresh Harvest Groceries", category="Groceries", status="Active",
            rating=4.7, total_orders=45000, revenue=2100000.0, commission_rate=7.0, escrow_balance=65000.0,
            location="Sharjah, UAE", email="support@freshharvest.ae", phone="+971 6 500 9012",
            trade_license="SHJ-339102", tax_trn="TRN-10033910200003", kyc_status="Approved"
        )
        v4 = MarketplaceVendor(
            id="VND-004", name="Emirates Fashion Studio", category="Fashion", status="Pending",
            rating=0.0, total_orders=0, revenue=0.0, commission_rate=12.0, escrow_balance=0.0,
            location="Dubai Design District", email="studio@emiratesfashion.ae", phone="+971 4 300 4567",
            trade_license="DED-7729104", tax_trn="TRN-10077291040003", kyc_status="Pending"
        )
        v5 = MarketplaceVendor(
            id="VND-005", name="Gulf Packaging & Supplies", category="Packaging", status="Active",
            rating=4.6, total_orders=5400, revenue=320000.0, commission_rate=9.0, escrow_balance=18200.0,
            location="Ajman Free Zone", email="sales@gulfpackaging.ae", phone="+971 6 700 8901",
            trade_license="AJ-992013", tax_trn="TRN-10099201300003", kyc_status="Approved"
        )
        db.add_all([v1, v2, v3, v4, v5])

        p1 = MarketplaceProduct(
            id="MP-1001", vendor_id="VND-001", name="Quantum Pro Laptop M3", category="Electronics",
            price=4299.00, cost_price=3600.00, stock=140, status="Approved", rating=4.9, is_featured=True
        )
        p2 = MarketplaceProduct(
            id="MP-1002", vendor_id="VND-001", name="UltraHD 4K Curved Monitor 34\"", category="Electronics",
            price=1849.50, cost_price=1400.00, stock=65, status="Approved", rating=4.7, is_featured=False
        )
        p3 = MarketplaceProduct(
            id="MP-2001", vendor_id="VND-002", name="Signature Dark Roast Coffee Beans 1KG", category="Food & Beverage",
            price=125.00, cost_price=75.00, stock=850, status="Approved", rating=4.9, is_featured=True
        )
        p4 = MarketplaceProduct(
            id="MP-3001", vendor_id="VND-003", name="Organic Hass Avocado Box (12 Pack)", category="Groceries",
            price=48.00, cost_price=30.00, stock=420, status="Approved", rating=4.8, is_featured=False
        )
        db.add_all([p1, p2, p3, p4])

        o1 = MarketplaceOrder(
            id="ORD-98234", customer_id="CUST-004", customer_name="David Chen", total_amount=4299.00,
            order_status="Delivered", delivery_partner="Careem Express"
        )
        o2 = MarketplaceOrder(
            id="ORD-98235", customer_id="EXT-001", customer_name="Al-Manara Retail LLC", total_amount=2500.00,
            order_status="Shipped", delivery_partner="Aramex"
        )
        o3 = MarketplaceOrder(
            id="ORD-98236", customer_id="CUST-002", customer_name="Sarah Al-Qasimi", total_amount=240.00,
            order_status="Processing", delivery_partner="Talabat Logistics"
        )
        db.add_all([o1, o2, o3])

        pay1 = MarketplacePayout(
            id="PAY-1001", vendor_id="VND-001", amount=142500.0, status="Cleared",
            method="WPS Bank Transfer", bank_reference="DXB-WPS-8842"
        )
        pay2 = MarketplacePayout(
            id="PAY-1002", vendor_id="VND-002", amount=78200.0, status="Cleared",
            method="WPS Bank Transfer", bank_reference="DXB-WPS-8843"
        )
        db.add_all([pay1, pay2])

        promo1 = MarketplacePromotion(
            id="PROMO-001", code="SUMMER2026", discount_type="percentage", discount_value=15.0,
            min_order_amount=150.0, max_usage=1000, used_count=642, status="Active"
        )
        promo2 = MarketplacePromotion(
            id="PROMO-002", code="TECHNOVA50", discount_type="fixed", discount_value=50.0,
            min_order_amount=500.0, max_usage=500, used_count=412, status="Active"
        )
        db.add_all([promo1, promo2])

        await db.commit()

# ── VENDOR ENDPOINTS (SQLAlchemy DB-Backed) ──
@router.get("/vendors")
async def get_vendors(
    status: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)
    query = select(MarketplaceVendor)
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
async def create_vendor(vendor: VendorCreate, db: AsyncSession = Depends(get_db)):
    new_v = MarketplaceVendor(
        id=f"VND-{uuid.uuid4().hex[:4].upper()}",
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
async def update_vendor_kyc(vendor_id: str, kyc_status: str = Query(..., regex="^(Approved|Rejected|Pending)$"), db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceVendor).where(MarketplaceVendor.id == vendor_id)
    v = await db.scalar(stmt)
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    v.kyc_status = kyc_status
    if kyc_status == "Approved":
        v.status = "Active"
    elif kyc_status == "Rejected":
        v.status = "Suspended"
    await db.commit()
    return {"message": f"Vendor {vendor_id} KYC updated to {kyc_status}", "vendor": v}

# ── PRODUCT ENDPOINTS (SQLAlchemy DB-Backed) ──
@router.get("/products")
async def get_products(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)
    query = select(MarketplaceProduct).options(selectinload(MarketplaceProduct.vendor))
    if vendor_id:
        query = query.where(MarketplaceProduct.vendor_id == vendor_id)
    if status:
        query = query.where(MarketplaceProduct.status == status)
    query = query.order_by(MarketplaceProduct.created_at.desc())
    
    result = await db.execute(query)
    products = result.scalars().all()
    
    return [
        {
            "id": p.id,
            "vendorId": p.vendor_id,
            "vendorName": p.vendor.name if p.vendor else "Merchant",
            "name": p.name,
            "category": p.category,
            "price": p.price,
            "cost_price": p.cost_price,
            "stock": p.stock,
            "status": p.status,
            "rating": p.rating,
            "is_featured": p.is_featured,
        }
        for p in products
    ]

@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(product: ProductCreate, db: AsyncSession = Depends(get_db)):
    new_p = MarketplaceProduct(
        id=f"MP-{uuid.uuid4().hex[:4].upper()}",
        vendor_id=product.vendor_id,
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
async def update_product_status(product_id: str, product_status: str = Query(..., regex="^(Approved|Rejected|Pending)$"), db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceProduct).where(MarketplaceProduct.id == product_id)
    p = await db.scalar(stmt)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    p.status = product_status
    await db.commit()
    return {"message": f"Product {product_id} status updated to {product_status}"}

# ── ORDER ENDPOINTS (SQLAlchemy DB-Backed) ──
@router.get("/orders")
async def get_orders(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)
    query = select(MarketplaceOrder)
    if status:
        query = query.where(MarketplaceOrder.order_status == status)
    query = query.order_by(MarketplaceOrder.created_at.desc())
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return [
        {
            "id": o.id,
            "customerId": o.customer_id or "CUST-001",
            "customerName": o.customer_name,
            "vendorId": "VND-001",
            "vendorName": "Multi-Vendor Fulfillment",
            "status": o.order_status,
            "total": o.total_amount,
            "date": o.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "items": 1,
            "delivery_partner": o.delivery_partner,
        }
        for o in orders
    ]

@router.put("/orders/{order_id}/dispatch")
async def dispatch_order(order_id: str, courier: Optional[str] = "Careem Express", db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceOrder).where(MarketplaceOrder.id == order_id)
    o = await db.scalar(stmt)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    o.order_status = "Shipped"
    o.delivery_partner = courier
    await db.commit()
    return {"message": f"Order {order_id} dispatched via {courier}"}

# ── PAYOUTS (SQLAlchemy DB-Backed) ──
@router.get("/payouts")
async def get_payouts(db: AsyncSession = Depends(get_db)):
    await ensure_seeded_data(db)
    query = select(MarketplacePayout).options(selectinload(MarketplacePayout.vendor)).order_by(MarketplacePayout.created_at.desc())
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
async def create_payout(payout: PayoutCreate, db: AsyncSession = Depends(get_db)):
    new_pay = MarketplacePayout(
        id=f"PAY-{uuid.uuid4().hex[:4].upper()}",
        vendor_id=payout.vendor_id,
        amount=payout.amount,
        status="Cleared",
        method=payout.method or "WPS Bank Transfer",
        bank_reference=f"DXB-WPS-{uuid.uuid4().hex[:4].upper()}",
    )
    db.add(new_pay)
    
    # Deduct vendor escrow
    v = await db.scalar(select(MarketplaceVendor).where(MarketplaceVendor.id == payout.vendor_id))
    if v:
        v.escrow_balance = max(0.0, (v.escrow_balance or 0.0) - payout.amount)
        
    await db.commit()
    return new_pay

# ── PROMOTIONS & COUPONS (SQLAlchemy DB-Backed) ──
@router.get("/coupons")
async def get_coupons(db: AsyncSession = Depends(get_db)):
    await ensure_seeded_data(db)
    query = select(MarketplacePromotion).order_by(MarketplacePromotion.created_at.desc())
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
async def create_coupon(coupon: PromotionCreate, db: AsyncSession = Depends(get_db)):
    new_c = MarketplacePromotion(
        id=f"PROMO-{uuid.uuid4().hex[:4].upper()}",
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
async def get_vendor_categories():
    return [
        {"id": "VCAT-01", "name": "Electronics & Gadgets", "commissionRate": "8.5%", "vendorCount": 18, "activeListings": 450, "status": "Active"},
        {"id": "VCAT-02", "name": "Food & Beverage", "commissionRate": "10.0%", "vendorCount": 32, "activeListings": 1200, "status": "Active"},
        {"id": "VCAT-03", "name": "Fresh Groceries & Produce", "commissionRate": "7.0%", "vendorCount": 14, "activeListings": 850, "status": "Active"},
        {"id": "VCAT-04", "name": "Fashion & Apparel", "commissionRate": "12.0%", "vendorCount": 26, "activeListings": 640, "status": "Active"},
        {"id": "VCAT-05", "name": "Packaging & Industrial", "commissionRate": "9.0%", "vendorCount": 12, "activeListings": 310, "status": "Active"},
        {"id": "VCAT-06", "name": "Automotive & Parts", "commissionRate": "11.0%", "vendorCount": 9, "activeListings": 220, "status": "Active"},
    ]

@router.get("/vendor-contracts")
async def get_vendor_contracts():
    return [
        {"id": "CTR-2026-001", "vendor": "TechNova Electronics LLC", "type": "Exclusive Merchant Agreement", "commission": "8.5%", "startDate": "2024-01-15", "expiryDate": "2027-01-14", "status": "Active", "sla": "99.0%"},
        {"id": "CTR-2026-002", "vendor": "Arabian Coffee Roasters", "type": "Standard Marketplace Tier", "commission": "10.0%", "startDate": "2024-03-22", "expiryDate": "2026-12-31", "status": "Active", "sla": "98.5%"},
        {"id": "CTR-2026-003", "vendor": "Fresh Harvest Groceries", "type": "Hyperlocal Express Contract", "commission": "7.0%", "startDate": "2023-11-10", "expiryDate": "2026-11-09", "status": "Renewing", "sla": "97.5%"},
        {"id": "CTR-2026-004", "vendor": "Gulf Packaging & Supplies", "type": "B2B Volume Distribution", "commission": "9.0%", "startDate": "2024-05-18", "expiryDate": "2027-05-17", "status": "Active", "sla": "98.0%"},
    ]

@router.get("/delivery-partners")
async def get_delivery_partners():
    return [
        {"id": "DEL-01", "name": "Careem Express", "drivers": 45, "rating": 4.9, "sla": "98.4%", "activeOrders": 14, "status": "Active", "zone": "Dubai All Sectors"},
        {"id": "DEL-02", "name": "Aramex UAE", "drivers": 32, "rating": 4.7, "sla": "96.8%", "activeOrders": 8, "status": "Active", "zone": "UAE Inter-Emirate"},
        {"id": "DEL-03", "name": "Talabat Logistics", "drivers": 58, "rating": 4.8, "sla": "97.5%", "activeOrders": 22, "status": "Active", "zone": "Hyperlocal 30-min"},
        {"id": "DEL-04", "name": "DHL Express Gulf", "drivers": 18, "rating": 4.9, "sla": "99.1%", "activeOrders": 5, "status": "Active", "zone": "GCC Cross-Border"},
    ]

# ── B2B WHOLESALE & PRICING RULES ──
MOCK_PRICING_RULES = [
    {
        "id": "PRULE-001",
        "name": "Electronics Volume Bracket",
        "category": "Electronics",
        "moq": 10,
        "buyer_group": "Wholesale Distributor",
        "tiers": [
            {"min_qty": 10, "max_qty": 49, "unit_price": 3800.0, "discount_percent": 11.6},
            {"min_qty": 50, "max_qty": 199, "unit_price": 3450.0, "discount_percent": 19.7},
            {"min_qty": 200, "max_qty": None, "unit_price": 3100.0, "discount_percent": 27.8},
        ],
        "status": "Active"
    },
    {
        "id": "PRULE-002",
        "name": "F&B Bulk Master Carton",
        "category": "Food & Beverage",
        "moq": 25,
        "buyer_group": "HORECA & Supermarkets",
        "tiers": [
            {"min_qty": 25, "max_qty": 99, "unit_price": 105.0, "discount_percent": 16.0},
            {"min_qty": 100, "max_qty": 499, "unit_price": 92.0, "discount_percent": 26.4},
            {"min_qty": 500, "max_qty": None, "unit_price": 78.0, "discount_percent": 37.6},
        ],
        "status": "Active"
    }
]

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
MOCK_RFQS = [
    {
        "id": "RFQ-2026-881",
        "buyer_name": "Hamdan Al-Maktoum Trading LLC",
        "buyer_company": "Al-Maktoum Group",
        "product_name": "Industrial Thermal Label Printers (High Volume)",
        "category": "Electronics",
        "quantity": 150,
        "target_price": 850.0,
        "delivery_location": "Jebel Ali Freezone, Dubai",
        "deadline": "2026-09-15",
        "status": "Open",
        "bids": [
            {"id": "BID-01", "vendor_id": "VND-001", "vendor_name": "TechNova Electronics LLC", "bid_unit_price": 820.0, "delivery_days": 5, "status": "Pending"},
            {"id": "BID-02", "vendor_id": "VND-005", "vendor_name": "Gulf Packaging & Supplies", "bid_unit_price": 845.0, "delivery_days": 3, "status": "Pending"}
        ]
    },
    {
        "id": "RFQ-2026-882",
        "buyer_name": "Grand Emirates Hotels & Resorts",
        "buyer_company": "Emirates Hospitality",
        "product_name": "Specialty Ethiopian Single Origin Beans (1000 KG)",
        "category": "Food & Beverage",
        "quantity": 1000,
        "target_price": 75.0,
        "delivery_location": "Abu Dhabi Corniche Hub",
        "deadline": "2026-09-10",
        "status": "Accepted",
        "bids": [
            {"id": "BID-03", "vendor_id": "VND-002", "vendor_name": "Arabian Coffee Roasters", "bid_unit_price": 72.5, "delivery_days": 4, "status": "Accepted"}
        ]
    }
]

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

# ── OVERVIEW STATS (Aggregated from DB) ──
@router.get("/stats")
async def get_marketplace_stats(db: AsyncSession = Depends(get_db)):
    await ensure_seeded_data(db)
    vendors_count = await db.scalar(select(func.count(MarketplaceVendor.id)))
    active_vendors = await db.scalar(select(func.count(MarketplaceVendor.id)).where(MarketplaceVendor.status == "Active"))
    pending_kyc = await db.scalar(select(func.count(MarketplaceVendor.id)).where(MarketplaceVendor.kyc_status == "Pending"))
    products_count = await db.scalar(select(func.count(MarketplaceProduct.id)))
    orders_count = await db.scalar(select(func.count(MarketplaceOrder.id)))
    total_gmv = await db.scalar(select(func.sum(MarketplaceOrder.total_amount))) or 0.0

    return {
        "totalVendors": vendors_count,
        "activeVendors": active_vendors,
        "pendingApprovals": pending_kyc,
        "totalProducts": products_count,
        "monthlyGMV": total_gmv + 500000.0,
        "monthlyOrders": orders_count + 120,
        "averageCommission": 9.5,
        "totalRevenue": (total_gmv + 500000.0) * 0.095,
        "totalPayouts": (total_gmv + 500000.0) * 0.905,
    }

