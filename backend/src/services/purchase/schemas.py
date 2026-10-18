"""Purchase service schemas — the Procure-to-Pay cycle.

Flow: PurchaseRequest -> PurchaseOrder -> GoodsReceiptNote -> VendorBill
      -> VendorPayment.

Each stage is a separate document because each is a separate commitment: a PR
is a wish, a PO is a promise to pay, a GRN is proof of receipt, a bill is the
debt, and a payment is the settlement. Collapsing them would lose the audit
trail that says *why* we bought what we did.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.services.purchase.models import (
    GRNStatus,
    PaymentMode,
    PaymentStatus,
    POStatus,
    PRStatus,
    VendorBillStatus,
    VendorType,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Vendors ────────────────────────────────────────────────────────────────

class VendorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=30)
    vendor_type: VendorType = VendorType.INGREDIENT
    contact_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    gstin: str | None = Field(default=None, max_length=20)
    address: str | None = None
    bank_account: str | None = Field(default=None, max_length=100)
    payment_terms_days: int = Field(ge=0, default=30)
    outlet_id: uuid.UUID | None = None


class VendorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    contact_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    bank_account: str | None = Field(default=None, max_length=100)
    payment_terms_days: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class VendorResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    vendor_type: VendorType
    contact_name: str | None
    phone: str | None
    email: str | None
    gstin: str | None
    bank_account: str | None
    payment_terms_days: int
    is_active: bool
    created_at: datetime


# ─── Purchase requests ──────────────────────────────────────────────────────

class PRLineIn(BaseModel):
    """One requested item. ``inventory_item_id`` points at the inventory service."""

    inventory_item_id: uuid.UUID
    qty: float = Field(gt=0)
    uom_id: uuid.UUID | None = None
    required_by: date | None = None
    notes: str | None = Field(default=None, max_length=500)


class PurchaseRequestCreate(BaseModel):
    outlet_id: uuid.UUID
    lines: list[PRLineIn] = Field(min_length=1)
    notes: str | None = None


class PRDecision(BaseModel):
    """Approve or reject a submitted PR."""

    approve: bool
    notes: str | None = None


class PurchaseRequestResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    pr_number: str
    status: PRStatus
    requested_by: uuid.UUID | None
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    notes: str | None
    created_at: datetime
    lines: list[PRLineIn] = Field(default_factory=list)


# ─── Purchase orders ────────────────────────────────────────────────────────

class POLineIn(BaseModel):
    inventory_item_id: uuid.UUID
    ordered_qty: float | None = None
    qty: float | None = None
    unit_price: float = Field(ge=0, default=0.0)
    uom_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _validate_qty(self) -> "POLineIn":
        if self.ordered_qty is None and self.qty is not None:
            self.ordered_qty = self.qty
        if self.ordered_qty is None or self.ordered_qty <= 0:
            raise ValueError("ordered_qty or qty > 0 is required")
        return self


class PurchaseOrderCreate(BaseModel):
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    pr_id: uuid.UUID | None = None
    lines: list[POLineIn] = Field(default_factory=list)
    items: list[POLineIn] | None = None
    expected_date: date | None = None
    expected_delivery_date: date | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _coerce_fields(self) -> "PurchaseOrderCreate":
        if not self.lines and self.items:
            self.lines = self.items
        if not self.lines:
            raise ValueError("At least one line item is required")
        if self.expected_date is None and self.expected_delivery_date is not None:
            self.expected_date = self.expected_delivery_date
        return self


class PurchaseOrderResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    pr_id: uuid.UUID | None
    po_number: str
    status: POStatus
    order_date: date | None
    expected_date: date | None
    received_date: date | None
    subtotal: float
    tax_total: float
    grand_total: float
    notes: str | None
    created_by: uuid.UUID | None
    created_at: datetime
    lines: list[POLineIn] = Field(default_factory=list)


# ─── Goods receipt notes ────────────────────────────────────────────────────

class GRNLineIn(BaseModel):
    po_line_id: uuid.UUID | None = None
    inventory_item_id: uuid.UUID
    received_qty: float = Field(ge=0)
    accepted_qty: float = Field(ge=0)
    rejected_qty: float = Field(ge=0, default=0)
    unit_price: float = Field(ge=0)
    batch_number: str | None = Field(default=None, max_length=50)
    expiry_date: date | None = None

    @model_validator(mode="after")
    def _check_counts(self) -> "GRNLineIn":
        # Accepted + rejected must not exceed what was physically received, or
        # we would be billed for or receive stock that was never delivered.
        total = float(self.accepted_qty) + float(self.rejected_qty)
        if total > float(self.received_qty) + 1e-6:
            raise ValueError(
                "accepted_qty + rejected_qty cannot exceed received_qty"
            )
        return self


class GRNCreate(BaseModel):
    po_id: uuid.UUID
    lines: list[GRNLineIn] = Field(min_length=1)
    received_date: date | None = None
    notes: str | None = None


class GRNResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    po_id: uuid.UUID
    vendor_id: uuid.UUID
    grn_number: str
    status: GRNStatus
    received_date: date | None
    received_by: uuid.UUID | None
    notes: str | None
    created_at: datetime
    lines: list[GRNLineIn] = Field(default_factory=list)


class QCDecision(BaseModel):
    """Pass or fail quality control on a received GRN.

    Only QC-passed goods enter the store; failed goods stay rejected and are
    never billed.
    """

    pass_: bool
    notes: str | None = None


# ─── Vendor bills & payments ────────────────────────────────────────────────

class VendorBillResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    grn_id: uuid.UUID | None
    bill_number: str
    status: VendorBillStatus
    invoice_number: str | None
    invoice_date: date | None
    due_date: date | None
    subtotal: float
    tax_total: float
    grand_total: float
    paid_amount: float
    balance: float
    notes: str | None
    created_at: datetime


class VendorBillCreate(BaseModel):
    """Raise a bill, normally from a QC-passed GRN.

    Sourcing the bill from a GRN keeps "what we paid for" tied to "what we
    accepted", so rejected goods can never appear on an invoice.
    """

    outlet_id: uuid.UUID
    vendor_id: uuid.UUID
    grn_id: uuid.UUID | None = None
    invoice_number: str | None = Field(default=None, max_length=50)
    invoice_date: date | None = None
    tax_total: float = Field(ge=0, default=0)
    notes: str | None = None


class VendorPaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    mode: PaymentMode = PaymentMode.BANK_TRANSFER
    paid_date: date | None = None
    reference: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class VendorPaymentResponse(OrmModel):
    id: uuid.UUID
    bill_id: uuid.UUID
    vendor_id: uuid.UUID
    payment_number: str
    status: PaymentStatus
    mode: PaymentMode
    amount: float
    paid_date: date | None
    reference: str | None
    approved_by: uuid.UUID | None
    notes: str | None
    created_at: datetime
