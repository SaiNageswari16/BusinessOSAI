"""Billing, payments, discounts and coupons schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.billing import (
    BillStatus,
    DiscountType,
    PaymentMethod,
    PaymentStatus,
)


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Tax codes ───────────────────────────────────────────────────

class TaxCodeCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=30)
    hsn_code: str | None = Field(default=None, max_length=20)
    tax_type: str = Field(default="gst", max_length=20)
    cgst_pct: float = Field(default=0, ge=0, le=100)
    sgst_pct: float = Field(default=0, ge=0, le=100)
    igst_pct: float = Field(default=0, ge=0, le=100)
    cess_pct: float = Field(default=0, ge=0, le=100)


class TaxCodeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    hsn_code: str | None = Field(default=None, max_length=20)
    tax_type: str | None = Field(default=None, max_length=20)
    cgst_pct: float | None = Field(default=None, ge=0, le=100)
    sgst_pct: float | None = Field(default=None, ge=0, le=100)
    igst_pct: float | None = Field(default=None, ge=0, le=100)
    cess_pct: float | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class TaxCodeResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    hsn_code: str | None
    tax_type: str
    cgst_pct: float
    sgst_pct: float
    igst_pct: float
    cess_pct: float
    is_active: bool
    created_at: datetime


# ─── Bills ───────────────────────────────────────────────────────

class BillItemResponse(ORMBase):
    id: uuid.UUID
    bill_id: uuid.UUID
    order_item_id: uuid.UUID | None
    menu_item_id: uuid.UUID | None
    name: str
    variant_name: str | None
    qty: int
    unit_price: float
    discount_pct: float | None
    discount_amount: float
    tax_code_id: uuid.UUID | None
    hsn_code: str | None
    tax_pct: float | None
    cgst: float
    sgst: float
    igst: float
    cess: float
    line_total: float


class BillPaymentResponse(ORMBase):
    id: uuid.UUID
    bill_id: uuid.UUID
    shift_id: uuid.UUID | None
    method: str
    amount: float
    reference: str | None
    gateway: str | None
    gateway_txn_id: str | None
    status: str
    card_last4: str | None
    card_type: str | None
    upi_vpa: str | None
    refunded_amount: float
    refunded_at: str | None
    created_at: datetime


class BillResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    order_id: uuid.UUID
    bill_number: str
    shift_id: uuid.UUID | None
    cashier_id: uuid.UUID | None
    waiter_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    customer_name: str | None
    customer_phone: str | None
    customer_gstin: str | None
    covers: int
    status: str
    subtotal: float
    discount_total: float
    taxable_amount: float
    tax_total: float
    cgst_total: float
    sgst_total: float
    igst_total: float
    cess_total: float
    service_charge: float
    service_charge_pct: float | None
    packaging_charge: float
    tip: float
    round_off: float
    grand_total: float
    paid_amount: float
    change_amount: float
    is_credit_sale: bool
    gst_invoice_number: str | None
    irn: str | None
    irn_status: str | None
    settled_at: str | None
    void_reason: str | None
    items: list[BillItemResponse] = Field(default_factory=list)
    payments: list[BillPaymentResponse] = Field(default_factory=list)
    created_at: datetime


class BillCreate(BaseModel):
    order_id: uuid.UUID
    customer_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    customer_gstin: str | None = Field(default=None, max_length=20)
    discount_code: str | None = None
    discount_id: uuid.UUID | None = None
    tip: float = Field(default=0, ge=0)
    service_charge_pct: float | None = Field(default=None, ge=0, le=100)
    packaging_charge: float = Field(default=0, ge=0)
    apply_service_charge: bool = True
    apply_round_off: bool = True


class PaymentIn(BaseModel):
    method: PaymentMethod
    amount: float = Field(gt=0)
    reference: str | None = Field(default=None, max_length=200)
    gateway: str | None = Field(default=None, max_length=50)
    gateway_txn_id: str | None = Field(default=None, max_length=200)
    card_last4: str | None = Field(default=None, max_length=4)
    card_type: str | None = Field(default=None, max_length=20)
    upi_vpa: str | None = Field(default=None, max_length=100)
    idempotency_key: str | None = Field(default=None, max_length=100)


class BillPayRequest(BaseModel):
    """Split tender is supported by sending several payments in one call."""
    payments: list[PaymentIn] = Field(min_length=1)


class BillVoidRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class BillRefundRequest(BaseModel):
    payment_id: uuid.UUID | None = None
    amount: float | None = Field(default=None, gt=0)
    reason: str = Field(min_length=1, max_length=500)


# ─── Discounts ───────────────────────────────────────────────────

class DiscountCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    description: str | None = None
    discount_type: DiscountType = DiscountType.PERCENT
    value: float = Field(default=0, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    applies_to: str = Field(default="cart", pattern="^(cart|item|category)$")
    scope: list[str] = Field(default_factory=list)
    min_order_value: float = Field(default=0, ge=0)
    max_uses: int | None = Field(default=None, ge=1)
    per_customer_limit: int | None = Field(default=None, ge=1)
    valid_from: str | None = Field(default=None, max_length=50)
    valid_to: str | None = Field(default=None, max_length=50)
    days_of_week: list[int] = Field(default_factory=list)
    time_from: str | None = Field(default=None, max_length=5)
    time_to: str | None = Field(default=None, max_length=5)
    requires_approval_above: float | None = Field(default=None, ge=0)


class DiscountUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    code: str | None = Field(default=None, max_length=50)
    description: str | None = None
    discount_type: DiscountType | None = None
    value: float | None = Field(default=None, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    applies_to: str | None = Field(default=None, pattern="^(cart|item|category)$")
    scope: list[str] | None = None
    min_order_value: float | None = Field(default=None, ge=0)
    max_uses: int | None = Field(default=None, ge=1)
    per_customer_limit: int | None = Field(default=None, ge=1)
    valid_from: str | None = Field(default=None, max_length=50)
    valid_to: str | None = Field(default=None, max_length=50)
    days_of_week: list[int] | None = None
    time_from: str | None = Field(default=None, max_length=5)
    time_to: str | None = Field(default=None, max_length=5)
    requires_approval_above: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


class DiscountResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str | None
    description: str | None
    discount_type: str
    value: float
    max_discount_amount: float | None
    applies_to: str
    scope: list
    min_order_value: float
    max_uses: int | None
    uses_count: int
    per_customer_limit: int | None
    valid_from: str | None
    valid_to: str | None
    days_of_week: list
    time_from: str | None
    time_to: str | None
    requires_approval_above: float | None
    is_active: bool
    created_at: datetime


class CouponCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    code: str = Field(min_length=1, max_length=50)
    description: str | None = None
    discount_type: DiscountType = DiscountType.PERCENT
    value: float = Field(default=0, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    min_order_value: float = Field(default=0, ge=0)
    valid_from: str | None = Field(default=None, max_length=50)
    valid_to: str | None = Field(default=None, max_length=50)
    usage_limit: int | None = Field(default=None, ge=1)
    per_user_limit: int | None = Field(default=None, ge=1)
    is_single_use: bool = False


class CouponUpdate(BaseModel):
    description: str | None = None
    value: float | None = Field(default=None, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    min_order_value: float | None = Field(default=None, ge=0)
    valid_from: str | None = Field(default=None, max_length=50)
    valid_to: str | None = Field(default=None, max_length=50)
    usage_limit: int | None = Field(default=None, ge=1)
    per_user_limit: int | None = Field(default=None, ge=1)
    is_single_use: bool | None = None
    is_active: bool | None = None


class CouponResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    code: str
    description: str | None
    discount_type: str
    value: float
    max_discount_amount: float | None
    min_order_value: float
    valid_from: str | None
    valid_to: str | None
    usage_limit: int | None
    per_user_limit: int | None
    uses_count: int
    is_single_use: bool
    is_active: bool
    created_at: datetime


class DiscountValidateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    order_id: uuid.UUID | None = None
    cart_total: float | None = Field(default=None, ge=0)
    customer_id: uuid.UUID | None = None


class DiscountValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_id: uuid.UUID | None = None
    discount_type: str | None = None
    value: float | None = None
    computed_discount: float = 0
    requires_approval: bool = False
    reason: str | None = None


class ServiceChargeConfigUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    pct: float = Field(ge=0, le=100)
    applies_to: str = Field(default="subtotal_after_discount", max_length=30)
    is_active: bool = True


class ServiceChargeConfigResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    pct: float
    applies_to: str
    is_active: bool


class TipConfigUpdate(BaseModel):
    suggested_pcts: list[float] = Field(default_factory=list)
    is_enabled: bool = True


class TipConfigResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    suggested_pcts: list
    is_enabled: bool
