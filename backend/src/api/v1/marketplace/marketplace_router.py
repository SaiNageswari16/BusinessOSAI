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
from src.models.inventory import Product, InventoryTransaction
from src.models.erp import Invoice, InvoiceLine
from src.schemas.marketplace import (
    VendorCreate, VendorUpdate, ProductCreate, ProductUpdate,
    OrderCreate, PayoutCreate, PromotionCreate
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

# ── VENDOR ENDPOINTS (SQLAlchemy DB-Backed) ──
@router.get("/stats")
async def get_marketplace_stats(db: AsyncSession = Depends(get_db)):
    await ensure_seeded_data(db)
    total_vendors = await db.scalar(select(func.count(MarketplaceVendor.id))) or 0
    active_vendors = await db.scalar(select(func.count(MarketplaceVendor.id)).where(MarketplaceVendor.status == "Active")) or 0
    pending_approvals = await db.scalar(select(func.count(MarketplaceVendor.id)).where(MarketplaceVendor.kyc_status == "Pending")) or 0
    total_products = await db.scalar(select(func.count(Product.id))) or 0
    monthly_orders = await db.scalar(select(func.count(MarketplaceOrder.id))) or 0
    monthly_gmv = await db.scalar(select(func.sum(MarketplaceOrder.total_amount))) or 0.0
    total_revenue = await db.scalar(select(func.sum(MarketplaceOrder.total_amount))) or 0.0
    total_payouts = await db.scalar(select(func.sum(MarketplacePayout.amount))) or 0.0
    return {
        "totalVendors": total_vendors,
        "activeVendors": active_vendors,
        "pendingApprovals": pending_approvals,
        "totalProducts": total_products,
        "monthlyGMV": float(monthly_gmv),
        "monthlyOrders": monthly_orders,
        "totalRevenue": float(total_revenue),
        "totalPayouts": float(total_payouts),
    }

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
async def update_vendor_kyc(vendor_id: str, kyc_status: str = Query(..., pattern="^(Approved|Rejected|Pending)$"), db: AsyncSession = Depends(get_db)):
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

# ── PRODUCT ENDPOINTS (Omnichannel Central erp_products + Marketplace) ──
@router.get("/products")
async def get_products(
    vendor_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)
    
    # 1. Fetch physical store products from central erp_products
    erp_stmt = (
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.brand))
        .order_by(Product.created_at.desc())
    )
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
            "cost_price": float(p.purchase_price or 0.0),
            "stock": avail,
            "on_hand_stock": on_hand,
            "reserved_stock": reserved,
            "available_stock": avail,
            "rack_location": p.rack_location or "Main Shelf / Floor",
            "status": "Approved" if str(p.status).lower() in ["active", "entitystatus.active"] else "Pending",
            "rating": 5.0,
            "is_featured": True,
            "channel": "Omnichannel Store",
            "image_url": p.image_url,
        })

    # 2. Fetch any external vendor marketplace listings
    mp_query = select(MarketplaceProduct).options(selectinload(MarketplaceProduct.vendor))
    if vendor_id:
        mp_query = mp_query.where(MarketplaceProduct.vendor_id == vendor_id)
    if status:
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
            "cost_price": mp.cost_price,
            "stock": mp.stock,
            "on_hand_stock": mp.stock,
            "reserved_stock": 0,
            "available_stock": mp.stock,
            "rack_location": "Vendor Warehouse",
            "status": mp.status,
            "rating": mp.rating,
            "is_featured": mp.is_featured,
            "channel": "Marketplace Vendor",
            "image_url": None,
        })
    
    if status and status != "All":
        unified_list = [p for p in unified_list if p["status"].lower() == status.lower()]
    if vendor_id:
        unified_list = [p for p in unified_list if p["vendorId"] == vendor_id]

    return unified_list

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
async def update_product_status(product_id: str, product_status: str = Query(..., pattern="^(Approved|Rejected|Pending)$"), db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceProduct).where(MarketplaceProduct.id == product_id)
    p = await db.scalar(stmt)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
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
    db: AsyncSession = Depends(get_db)
):
    await ensure_seeded_data(db)
    query = select(MarketplaceOrder).options(selectinload(MarketplaceOrder.items))
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
            "date": o.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if o.created_at else datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
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
async def get_order_by_id(order_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceOrder).options(selectinload(MarketplaceOrder.items)).where(MarketplaceOrder.id == order_id)
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
        "date": o.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if o.created_at else datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
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
async def deliver_order(order_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceOrder).where(MarketplaceOrder.id == order_id)
    o = await db.scalar(stmt)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    o.order_status = "Delivered"
    o.fulfillment_status = "Delivered"
    await db.commit()
    return {"message": f"Order {order_id} marked as Delivered"}

@router.post("/orders")
async def create_order(payload: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Transactional Omnichannel Order Creation:
    1. Validates available stock with atomic row-level locking (SELECT FOR UPDATE)
    2. Atomically reserves physical stock on erp_products
    3. Records immutable InventoryTransaction ('ONLINE_RESERVATION')
    4. Auto-generates single official Tax Invoice in ar_invoices (Zero duplicate billing)
    """
    items_data = payload.get("items", [])
    if not items_data:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    raw_tenant_id = payload.get("tenant_id")
    tenant_uuid = None
    if raw_tenant_id:
        try:
            tenant_uuid = uuid.UUID(str(raw_tenant_id))
        except ValueError:
            pass

    # 1. Row-lock products and validate stock
    processed_items = []
    total_calc = 0.0
    for it in items_data:
        pid_raw = it.get("product_id")
        qty = int(it.get("quantity") or 1)
        price = float(it.get("price") or 0.0)
        p_name = it.get("name") or "Product"
        p_sku = "SKU-MAIN"
        p_rack = "Rack 1 / Shelf A"

        if pid_raw:
            try:
                p_uuid = uuid.UUID(str(pid_raw))
                prod_stmt = select(Product).where(Product.id == p_uuid).with_for_update()
                prod_res = await db.execute(prod_stmt)
                product = prod_res.scalar_one_or_none()
                if product:
                    p_name = product.name
                    p_sku = product.sku
                    p_rack = product.rack_location or "Central Floor"
                    
                    on_hand = product.on_hand_stock if product.on_hand_stock is not None else (product.initial_stock or 0)
                    reserved = product.reserved_stock or 0
                    available = on_hand - reserved

                    if available < qty:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Insufficient available stock for '{product.name}'. Available: {max(0, available)}, Requested: {qty}"
                        )
                    
                    # Atomically reserve stock
                    product.on_hand_stock = on_hand
                    product.reserved_stock = reserved + qty
                    
                    # Log reservation transaction
                    inv_tx = InventoryTransaction(
                        tenant_id=product.tenant_id,
                        product_id=product.id,
                        transaction_type="ONLINE_RESERVATION",
                        quantity=qty,
                        before_on_hand=on_hand,
                        after_on_hand=on_hand,
                        before_reserved=reserved,
                        after_reserved=reserved + qty,
                        reference_type="ORDER",
                        reference_id=order_id,
                        notes=f"Stock reserved for web order {order_id}"
                    )
                    db.add(inv_tx)
            except HTTPException:
                raise
            except Exception as e:
                pass

        total_calc += price * qty
        processed_items.append({
            "product_id": str(pid_raw),
            "name": p_name,
            "sku": p_sku,
            "rack_location": p_rack,
            "unit_price": price,
            "quantity": qty
        })

    # Resolve valid tenant_uuid
    if not tenant_uuid:
        for it in items_data:
            pid_raw = it.get("product_id")
            if pid_raw:
                try:
                    p_uuid = uuid.UUID(str(pid_raw))
                    p_tenant = await db.scalar(select(Product.tenant_id).where(Product.id == p_uuid))
                    if p_tenant:
                        tenant_uuid = p_tenant
                        break
                except Exception:
                    pass
    if not tenant_uuid:
        from src.models import Tenant
        tenant_uuid = await db.scalar(select(Tenant.id).limit(1))

    # 2. Create Single Official Online Sales Tax Invoice in ar_invoices
    inv_num = f"INV-{order_id}"
    customer_name = payload.get("customer_name") or "Online Customer"
    total_amt = float(payload.get("total_amount") or total_calc)
    subtotal_val = total_amt * 0.82
    tax_val = total_amt * 0.18

    online_invoice = Invoice(
        tenant_id=tenant_uuid,
        customer_name=customer_name,
        customer_phone=payload.get("customer_phone"),
        customer_email=payload.get("customer_email"),
        shipping_address=payload.get("shipping_address"),
        invoice_number=inv_num,
        invoice_type="tax_invoice",
        order_number=order_id,
        status="paid" if payload.get("payment_method") != "cod" else "pending",
        invoice_date=datetime.utcnow().date(),
        due_date=datetime.utcnow().date(),
        payment_terms=payload.get("payment_method") or "Online Card/UPI",
        subtotal=subtotal_val,
        cgst_amount=tax_val / 2,
        sgst_amount=tax_val / 2,
        total_amount=total_amt,
        amount_paid=total_amt if payload.get("payment_method") != "cod" else 0.0,
        balance_due=0.0 if payload.get("payment_method") != "cod" else total_amt,
        notes=f"E-Commerce Online Order {order_id}. Do not re-bill at physical POS counter."
    )
    db.add(online_invoice)
    await db.flush()

    for idx, pit in enumerate(processed_items):
        line_pid = None
        try:
            line_pid = uuid.UUID(str(pit["product_id"]))
        except Exception:
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

    # 3. Create Marketplace Order & Order Items
    exp_delivery = payload.get("expected_delivery") or "Expected in 2-3 Business Days"
    order = MarketplaceOrder(
        id=order_id,
        tenant_id=str(tenant_uuid) if tenant_uuid else None,
        customer_id=payload.get("customer_id") or f"CUST-{uuid.uuid4().hex[:4].upper()}",
        customer_name=customer_name,
        customer_email=payload.get("customer_email"),
        customer_phone=payload.get("customer_phone"),
        delivery_address=payload.get("shipping_address"),
        subtotal=subtotal_val,
        shipping_fee=float(payload.get("shipping_fee") or 0.0),
        total_amount=total_amt,
        payment_method=payload.get("payment_method") or "Prepaid",
        payment_status="Paid" if payload.get("payment_method") != "cod" else "Pending",
        order_status="Processing",
        fulfillment_status="Pending Pick",
        delivery_partner=payload.get("delivery_partner") or "Express Delivery",
        expected_delivery=exp_delivery,
        invoice_number=inv_num,
        invoice_id=str(online_invoice.id),
        channel=payload.get("channel") or "Online Storefront",
        notes=payload.get("notes")
    )
    db.add(order)
    await db.flush()

    for pit in processed_items:
        order_item = MarketplaceOrderItem(
            order_id=order.id,
            vendor_id=pit.get("vendor_id") or "STORE-MAIN",
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
        "fulfillment_status": order.fulfillment_status,
        "expected_delivery": order.expected_delivery,
        "total": order.total_amount
    }

@router.put("/orders/{order_id}/pack")
async def pack_order(order_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceOrder).where(MarketplaceOrder.id == order_id)
    o = await db.scalar(stmt)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    o.fulfillment_status = "Ready to Ship"
    await db.commit()
    return {"message": f"Order {order_id} marked as packed & ready to ship"}

@router.put("/orders/{order_id}/dispatch")
async def dispatch_order(
    order_id: str,
    payload: Dict[str, Any] = None,
    db: AsyncSession = Depends(get_db)
):
    """Store Employee Dispatch:
    1. Releases reserved stock and deducts physical on-hand inventory
    2. Logs immutable InventoryTransaction ('ONLINE_DISPATCH')
    3. Records courier, tracking number, and updated expected delivery
    """
    courier = (payload or {}).get("courier") or "Express Delivery"
    tracking = (payload or {}).get("tracking_number") or f"TRK-{uuid.uuid4().hex[:8].upper()}"
    exp_delivery = (payload or {}).get("expected_delivery") or (payload or {}).get("eta") or "Estimated Delivery Tomorrow by 6:00 PM"

    stmt = select(MarketplaceOrder).options(selectinload(MarketplaceOrder.items)).where(MarketplaceOrder.id == order_id)
    res = await db.execute(stmt)
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

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
            except Exception as err:
                pass

    o.order_status = "Shipped"
    o.fulfillment_status = "Shipped"
    o.delivery_partner = courier
    o.tracking_number = tracking
    o.expected_delivery = exp_delivery
    await db.commit()
    return {
        "message": f"Order {order_id} dispatched via {courier}",
        "tracking_number": tracking,
        "expected_delivery": exp_delivery
    }

@router.put("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, db: AsyncSession = Depends(get_db)):
    """Pre-dispatch cancellation: releases reserved stock back to available inventory."""
    stmt = select(MarketplaceOrder).options(selectinload(MarketplaceOrder.items)).where(MarketplaceOrder.id == order_id)
    res = await db.execute(stmt)
    o = res.scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    if o.order_status != "Shipped" and o.order_status != "Delivered":
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
                except Exception:
                    pass

    o.order_status = "Cancelled"
    o.fulfillment_status = "Cancelled"
    await db.commit()
    return {"message": f"Order {order_id} cancelled and stock reservation released"}

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
async def get_vendor_categories(db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceVendor.category, func.count(MarketplaceVendor.id)).group_by(MarketplaceVendor.category)
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
async def get_vendor_contracts(db: AsyncSession = Depends(get_db)):
    stmt = select(MarketplaceVendor).where(MarketplaceVendor.status == "Active")
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

# ── OVERVIEW STATS (Aggregated from DB) ──
@router.get("/stats")
async def get_marketplace_stats(db: AsyncSession = Depends(get_db)):
    await ensure_seeded_data(db)
    vendors_count = await db.scalar(select(func.count(MarketplaceVendor.id))) or 0
    active_vendors = await db.scalar(select(func.count(MarketplaceVendor.id)).where(MarketplaceVendor.status == "Active")) or 0
    pending_kyc = await db.scalar(select(func.count(MarketplaceVendor.id)).where(MarketplaceVendor.kyc_status == "Pending")) or 0
    
    mp_products_count = await db.scalar(select(func.count(MarketplaceProduct.id))) or 0
    erp_products_count = await db.scalar(select(func.count(Product.id))) or 0
    total_products = mp_products_count + erp_products_count

    orders_count = await db.scalar(select(func.count(MarketplaceOrder.id))) or 0
    total_gmv = float(await db.scalar(select(func.sum(MarketplaceOrder.total_amount))) or 0.0)
    total_payouts = float(await db.scalar(select(func.sum(MarketplacePayout.amount))) or 0.0)
    
    avg_commission = 10.0
    platform_revenue = total_gmv * (avg_commission / 100.0)

    return {
        "totalVendors": vendors_count,
        "activeVendors": active_vendors,
        "pendingApprovals": pending_kyc,
        "totalProducts": total_products,
        "monthlyGMV": total_gmv,
        "monthlyOrders": orders_count,
        "averageCommission": avg_commission,
        "totalRevenue": platform_revenue,
        "totalPayouts": total_payouts,
    }

