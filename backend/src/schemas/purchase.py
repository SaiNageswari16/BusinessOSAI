"""Purchase, vendor and procure-to-pay schemas."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.purchase import (
    GRNStatus,
    POStatus,
    PRStatus,
    VendorBillStatus,
    VendorType,
)


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Vendors ─────────────────────────────────────────────────────

class VendorCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    contact_person: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    gstin: str | None = Field(default=None, max_length=20)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=10)
    vendor_type: VendorType = VendorType.INGREDIENT
    payment_terms_days: int = Field(default=0, ge=0)
    credit_limit: float = Field(default=0, ge=0)
    rating: int | None = Field(default=None, ge=1, le=5)


class VendorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    contact_person: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    gstin: str | None = Field(default=None, max_length=20)
    address: str | None = None
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=10)
    vendor_type: VendorType | None = None
    payment_terms_days: int | None = Field(default=None, ge=0)
    credit_limit: float | None = Field(default=None, ge=0)
    rating: int | None = Field(default=None, ge=1, le=5)
    is_active: bool | None = None


class VendorResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    contact_person: str | None
    phone: str | None
    email: str | None
    gstin: str | None
    address: str | None
    city: str | None
    state: str | None
    pincode: str | None
    vendor_type: str
    payment_terms_days: int
    credit_limit: float
    rating: int | None
    is_active: bool
    created_at: datetime


class VendorItemCreate(BaseModel):
    inventory_item_id: uuid.UUID
    vendor_item_code: str | None = Field(default=None, max_length=50)
    price: float = Field(ge=0)
    uom_id: uuid.UUID | None = None
    min_order_qty: float = Field(default=1, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    is_preferred: bool = False


class VendorItemUpdate(BaseModel):
    vendor_item_code: str | None = Field(default=None, max_length=50)
    price: float | None = Field(default=None, ge=0)
    uom_id: uuid.UUID | None = None
    min_order_qty: float | None = Field(default=None, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    is_preferred: bool | None = None


class VendorItemResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    vendor_id: uuid.UUID
    inventory_item_id: uuid.UUID
    vendor_item_code: str | None
    price: float
    uom_id: uuid.UUID | None
    min_order_qty: float
    lead_time_days: int | None
    is_preferred: bool


# ─── Purchase requests ───────────────────────────────────────────

class PRLineIn(BaseModel):
    inventory_item_id: uuid.UUID
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    required_by: date | None = None
    notes: str | None = Field(default=None, max_length=500)


class PRLineResponse(ORMBase):
    id: uuid.UUID
    purchase_request_id: uuid.UUID
    inventory_item_id: uuid.UUID
    qty: float
    uom_id: uuid.UUID | None
    required_by: date | None
    notes: str | None


class PurchaseRequestCreate(BaseModel):
    outlet_id: uuid.UUID
    notes: str | None = None
    lines: list[PRLineIn] = Field(min_length=1)


class PurchaseRequestResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    pr_number: str
    status: str
    requested_by: uuid.UUID | None
    approved_by: uuid.UUID | None
    notes: str | None
    lines: list[PRLineResponse] = Field(default_factory=list)
    created_at: datetime


# ─── Purchase orders ─────────────────────────────────────────────

class POLineIn(BaseModel):
    inventory_item_id: uuid.UUID
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    unit_price: float = Field(default=0, ge=0)
    tax_pct: float = Field(default=0, ge=0, le=100)


class POLineResponse(ORMBase):
    id: uuid.UUID
    purchase_order_id: uuid.UUID
    inventory_item_id: uuid.UUID
    qty: float
    uom_id: uuid.UUID | None
    unit_price: float
    tax_pct: float | None
    tax_amount: float
    received_qty: float
    line_total: float


class PurchaseOrderCreate(BaseModel):
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    expected_date: date | None = None
    notes: str | None = None
    lines: list[POLineIn] = Field(min_length=1)


class PurchaseOrderResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    po_number: str
    status: str
    order_date: str | None
    expected_date: date | None
    received_date: str | None
    subtotal: float
    tax_total: float
    grand_total: float
    notes: str | None
    created_by: uuid.UUID | None
    lines: list[POLineResponse] = Field(default_factory=list)
    created_at: datetime


# ─── GRN ─────────────────────────────────────────────────────────

class GRNLineIn(BaseModel):
    purchase_order_line_id: uuid.UUID | None = None
    inventory_item_id: uuid.UUID
    ordered_qty: float = Field(default=0, ge=0)
    received_qty: float = Field(ge=0)
    accepted_qty: float = Field(default=0, ge=0)
    rejected_qty: float = Field(default=0, ge=0)
    uom_id: uuid.UUID | None = None
    unit_price: float = Field(default=0, ge=0)
    batch_number: str | None = Field(default=None, max_length=50)
    expiry_date: date | None = None
    rejection_reason: str | None = Field(default=None, max_length=300)


class GRNLineResponse(ORMBase):
    id: uuid.UUID
    grn_id: uuid.UUID
    purchase_order_line_id: uuid.UUID | None
    inventory_item_id: uuid.UUID
    ordered_qty: float
    received_qty: float
    accepted_qty: float
    rejected_qty: float
    uom_id: uuid.UUID | None
    unit_price: float
    batch_number: str | None
    expiry_date: date | None
    rejection_reason: str | None


class GRNCreate(BaseModel):
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    purchase_order_id: uuid.UUID | None = None
    received_date: str | None = Field(default=None, max_length=50)
    invoice_number: str | None = Field(default=None, max_length=50)
    invoice_date: str | None = Field(default=None, max_length=50)
    qc_notes: str | None = None
    notes: str | None = None
    lines: list[GRNLineIn] = Field(min_length=1)


class GRNResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    purchase_order_id: uuid.UUID | None
    vendor_id: uuid.UUID
    grn_number: str
    status: str
    received_date: str | None
    received_by: uuid.UUID | None
    invoice_number: str | None
    invoice_date: str | None
    qc_notes: str | None
    notes: str | None
    lines: list[GRNLineResponse] = Field(default_factory=list)
    created_at: datetime


class GRNQCUpdate(BaseModel):
    status: GRNStatus = Field(pattern="^(qc_passed|qc_failed)$")
    qc_notes: str | None = None


# ─── Vendor bills ────────────────────────────────────────────────

class VendorBillLineIn(BaseModel):
    inventory_item_id: uuid.UUID
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    unit_price: float = Field(default=0, ge=0)
    tax_pct: float = Field(default=0, ge=0, le=100)


class VendorBillLineResponse(ORMBase):
    id: uuid.UUID
    vendor_bill_id: uuid.UUID
    inventory_item_id: uuid.UUID
    qty: float
    uom_id: uuid.UUID | None
    unit_price: float
    tax_pct: float | None
    line_total: float


class VendorBillCreate(BaseModel):
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    grn_id: uuid.UUID | None = None
    bill_number: str | None = Field(default=None, max_length=50)
    bill_date: str | None = Field(default=None, max_length=50)
    due_date: date | None = None
    notes: str | None = None
    lines: list[VendorBillLineIn] = Field(min_length=1)


class VendorBillResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    grn_id: uuid.UUID | None
    bill_number: str
    status: str
    bill_date: str | None
    due_date: date | None
    subtotal: float
    tax_total: float
    grand_total: float
    paid_amount: float
    notes: str | None
    lines: list[VendorBillLineResponse] = Field(default_factory=list)
    created_at: datetime


class VendorPaymentCreate(BaseModel):
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    vendor_bill_id: uuid.UUID | None = None
    amount: float = Field(gt=0)
    method: str = Field(default="cash", max_length=30)
    reference: str | None = Field(default=None, max_length=200)
    paid_at: str | None = Field(default=None, max_length=50)


class VendorPaymentResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    vendor_bill_id: uuid.UUID | None
    vendor_id: uuid.UUID
    amount: float
    method: str
    reference: str | None
    paid_at: str | None
    paid_by: uuid.UUID | None
    created_at: datetime


class PRStatusRef(BaseModel):
    pr_statuses: list[str] = [s.value for s in PRStatus]
    po_statuses: list[str] = [s.value for s in POStatus]
    vendor_bill_statuses: list[str] = [s.value for s in VendorBillStatus]
