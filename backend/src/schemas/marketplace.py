from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class VendorCreate(BaseModel):
    name: str
    category: str
    location: Optional[str] = "Dubai, UAE"
    email: Optional[str] = None
    phone: Optional[str] = None
    commission_rate: Optional[float] = 10.0
    trade_license: Optional[str] = None
    tax_trn: Optional[str] = None

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    commission_rate: Optional[float] = None
    kyc_status: Optional[str] = None
    location: Optional[str] = None

class ProductCreate(BaseModel):
    vendor_id: str
    name: str
    category: str
    price: float
    cost_price: Optional[float] = 0.0
    stock: Optional[int] = 100
    sku: Optional[str] = None
    description: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    status: Optional[str] = None
    is_featured: Optional[bool] = None

class OrderItemCreate(BaseModel):
    product_id: str
    product_name: str
    vendor_id: str
    unit_price: float
    quantity: int = 1

class OrderCreate(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_partner: Optional[str] = "Careem Express"
    items: List[OrderItemCreate]

class PayoutCreate(BaseModel):
    vendor_id: str
    amount: float
    method: Optional[str] = "WPS Bank Transfer"

class PromotionCreate(BaseModel):
    code: str
    discount_type: str = "percentage"
    discount_value: float
    min_order_amount: Optional[float] = 0.0
    max_usage: Optional[int] = 1000
    expiry_date: Optional[datetime] = None

class PricingTier(BaseModel):
    min_qty: int
    max_qty: Optional[int] = None
    unit_price: float
    discount_percent: float

class PricingRuleCreate(BaseModel):
    name: str
    category: str
    moq: int = 10
    tiers: List[PricingTier]
    buyer_group: Optional[str] = "Wholesaler"

class RFQCreate(BaseModel):
    buyer_name: str
    buyer_company: str
    product_name: str
    category: str
    quantity: int
    target_price: float
    delivery_location: str
    deadline: Optional[str] = None
    specifications: Optional[str] = None

class RFQBidCreate(BaseModel):
    vendor_id: str
    vendor_name: str
    bid_unit_price: float
    delivery_days: int
    notes: Optional[str] = None

class TradeCreditUpdate(BaseModel):
    buyer_id: str
    credit_limit: float
    payment_terms: str  # "Net 30", "Net 60", "Net 90", "PDC 45"
    status: str = "Active"

