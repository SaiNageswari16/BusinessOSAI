import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float, DateTime,
    ForeignKey, Enum, JSON, Numeric
)
from sqlalchemy.orm import relationship
from src.database.base import Base

class MarketplaceVendor(Base):
    __tablename__ = "marketplace_vendors"

    id = Column(String(50), primary_key=True, default=lambda: f"VND-{uuid.uuid4().hex[:6].upper()}")
    tenant_id = Column(String(50), nullable=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False, default="General Merchandise")
    status = Column(String(50), nullable=False, default="Active")  # Active, Pending, Suspended
    rating = Column(Float, default=5.0)
    total_orders = Column(Integer, default=0)
    revenue = Column(Float, default=0.0)
    commission_rate = Column(Float, default=10.0)  # percentage (e.g. 10.0%)
    escrow_balance = Column(Float, default=0.0)
    location = Column(String(200), default="Dubai, UAE")
    email = Column(String(150), nullable=True)
    phone = Column(String(50), nullable=True)
    trade_license = Column(String(100), nullable=True)
    tax_trn = Column(String(100), nullable=True)
    kyc_status = Column(String(50), default="Approved")  # Approved, Pending, Rejected
    join_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    products = relationship("MarketplaceProduct", back_populates="vendor", cascade="all, delete-orphan")
    orders = relationship("MarketplaceOrderItem", back_populates="vendor")
    payouts = relationship("MarketplacePayout", back_populates="vendor")

class MarketplaceProduct(Base):
    __tablename__ = "marketplace_products"

    id = Column(String(50), primary_key=True, default=lambda: f"MP-{uuid.uuid4().hex[:6].upper()}")
    vendor_id = Column(String(50), ForeignKey("marketplace_vendors.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    price = Column(Float, nullable=False)
    cost_price = Column(Float, default=0.0)
    stock = Column(Integer, default=100)
    status = Column(String(50), default="Approved")  # Approved, Pending, Rejected
    rating = Column(Float, default=5.0)
    sku = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vendor = relationship("MarketplaceVendor", back_populates="products")

class MarketplaceOrder(Base):
    __tablename__ = "marketplace_orders"

    id = Column(String(50), primary_key=True, default=lambda: f"ORD-{uuid.uuid4().hex[:8].upper()}")
    customer_id = Column(String(50), nullable=True)
    customer_name = Column(String(150), nullable=False)
    customer_email = Column(String(150), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    delivery_address = Column(Text, nullable=True)
    subtotal = Column(Float, default=0.0)
    platform_commission = Column(Float, default=0.0)
    shipping_fee = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    payment_method = Column(String(50), default="Credit Card")
    payment_status = Column(String(50), default="Paid")  # Paid, Pending, Refunded
    order_status = Column(String(50), default="Processing")  # Pending, Processing, Shipped, Delivered, Cancelled
    delivery_partner = Column(String(100), default="Careem Express")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("MarketplaceOrderItem", back_populates="order", cascade="all, delete-orphan")

class MarketplaceOrderItem(Base):
    __tablename__ = "marketplace_order_items"

    id = Column(String(50), primary_key=True, default=lambda: f"ITEM-{uuid.uuid4().hex[:8].upper()}")
    order_id = Column(String(50), ForeignKey("marketplace_orders.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(String(50), ForeignKey("marketplace_vendors.id"), nullable=False)
    product_id = Column(String(50), nullable=False)
    product_name = Column(String(255), nullable=False)
    unit_price = Column(Float, nullable=False)
    quantity = Column(Integer, default=1)
    vendor_payout = Column(Float, default=0.0)
    commission_deducted = Column(Float, default=0.0)
    fulfillment_status = Column(String(50), default="Processing")  # Pending, Packed, Shipped, Delivered, Returned
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("MarketplaceOrder", back_populates="items")
    vendor = relationship("MarketplaceVendor", back_populates="orders")

class MarketplacePayout(Base):
    __tablename__ = "marketplace_payouts"

    id = Column(String(50), primary_key=True, default=lambda: f"PAY-{uuid.uuid4().hex[:6].upper()}")
    vendor_id = Column(String(50), ForeignKey("marketplace_vendors.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(50), default="Cleared")  # Cleared, Processing, Failed
    method = Column(String(100), default="WPS Bank Transfer")
    bank_reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("MarketplaceVendor", back_populates="payouts")

class MarketplacePromotion(Base):
    __tablename__ = "marketplace_promotions"

    id = Column(String(50), primary_key=True, default=lambda: f"PROMO-{uuid.uuid4().hex[:6].upper()}")
    code = Column(String(50), unique=True, nullable=False)
    discount_type = Column(String(50), default="percentage")  # percentage, fixed, free_shipping
    discount_value = Column(Float, nullable=False)
    min_order_amount = Column(Float, default=0.0)
    max_usage = Column(Integer, default=1000)
    used_count = Column(Integer, default=0)
    vendor_id = Column(String(50), nullable=True)  # Null = Platform wide
    status = Column(String(50), default="Active")
    expiry_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
