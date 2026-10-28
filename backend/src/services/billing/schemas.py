"""Billing service schemas."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.services.billing.models import (
    BillStatus,
    CashMovementType,
    DiscountType,
    PaymentMethod,
    PaymentStatus,
)


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Tax codes ───────────────────────────────────────────────────────────────

class TaxCodeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=30)
    hsn_code: str | None = Field(default=None, max_length=20)
    tax_type: str = "GST"
    cgst_pct: float = Field(ge=0, le=100, default=0)
    sgst_pct: float = Field(ge=0, le=100, default=0)
    igst_pct: float = Field(ge=0, le=100, default=0)
    cess_pct: float = Field(ge=0, le=100, default=0)
    outlet_id: uuid.UUID | None = None


class TaxCodeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    tax_type: str | None = None
    cgst_pct: float | None = Field(default=None, ge=0, le=100)
    sgst_pct: float | None = Field(default=None, ge=0, le=100)
    igst_pct: float | None = Field(default=None, ge=0, le=100)
    cess_pct: float | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class TaxCodeResponse(OrmModel):
    id: uuid.UUID
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


# ─── Discounts ───────────────────────────────────────────────────────────────

class DiscountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=50)
    description: str | None = None
    discount_type: DiscountType = DiscountType.PERCENT
    value: float = Field(ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    applies_to: str = "CART"
    scope: list = Field(default_factory=list)
    min_order_value: float = Field(ge=0, default=0)
    max_uses: int | None = Field(default=None, ge=1)
    per_customer_limit: int | None = Field(default=None, ge=1)
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    days_of_week: list = Field(default_factory=list)
    time_from: str | None = Field(default=None, max_length=5)
    time_to: str | None = Field(default=None, max_length=5)
    requires_approval_above: float | None = Field(default=None, ge=0)
    outlet_id: uuid.UUID | None = None


class DiscountResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    code: str
    description: str | None
    discount_type: DiscountType
    value: float
    max_discount_amount: float | None
    applies_to: str
    scope: list
    min_order_value: float
    max_uses: int | None
    uses_count: int
    per_customer_limit: int | None
    valid_from: datetime | None
    valid_to: datetime | None
    is_active: bool
    created_at: datetime


# ─── Bill items ──────────────────────────────────────────────────────────────

class BillItemCreate(BaseModel):
    """A line to bill, snapshotted from the order."""

    name: str = Field(min_length=1, max_length=200)
    variant_name: str | None = Field(default=None, max_length=100)
    qty: int = Field(ge=1, default=1)
    unit_price: float = Field(ge=0, default=0)
    order_item_id: uuid.UUID | None = None
    menu_item_id: uuid.UUID | None = None
    tax_code_id: uuid.UUID | None = None
    hsn_code: str | None = Field(default=None, max_length=20)
    discount_pct: float | None = Field(default=None, ge=0, le=100)


class BillItemResponse(OrmModel):
    id: uuid.UUID
    name: str
    variant_name: str | None
    qty: int
    unit_price: float
    order_item_id: uuid.UUID | None
    menu_item_id: uuid.UUID | None
    tax_code_id: uuid.UUID | None
    hsn_code: str | None
    discount_pct: float | None
    discount_amount: float
    tax_pct: float
    cgst: float
    sgst: float
    igst: float
    cess: float
    line_total: float


# ─── Bills ───────────────────────────────────────────────────────────────────

class BillCreate(BaseModel):
    outlet_id: uuid.UUID
    order_id: uuid.UUID | None = None
    order_number: str | None = Field(default=None, max_length=50)
    shift_id: uuid.UUID | None = None
    cashier_id: uuid.UUID | None = None
    waiter_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    customer_gstin: str | None = Field(default=None, max_length=20)
    covers: int = Field(ge=1, default=1)
    is_credit_sale: bool = False
    items: list[BillItemCreate] = Field(default_factory=list)
    service_charge_pct: float | None = Field(default=None, ge=0, le=100)
    packaging_charge: float = Field(ge=0, default=0)
    tip: float = Field(ge=0, default=0)


class BillUpdate(BaseModel):
    status: BillStatus | None = None
    service_charge_pct: float | None = Field(default=None, ge=0, le=100)
    packaging_charge: float | None = Field(default=None, ge=0)
    tip: float | None = Field(default=None, ge=0)
    void_reason: str | None = None


class BillResponse(OrmModel):
    """Full bill. ``item_count`` is derived, not read off the row — the Bill
    model has no such column, so from_attributes would AttributeError."""

    id: uuid.UUID
    outlet_id: uuid.UUID
    order_id: uuid.UUID | None
    order_number: str | None
    bill_number: str
    shift_id: uuid.UUID | None
    cashier_id: uuid.UUID | None
    waiter_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    customer_name: str | None
    customer_phone: str | None
    covers: int
    status: BillStatus

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

    settled_at: datetime | None
    void_reason: str | None

    items: list[BillItemResponse] = Field(default_factory=list)
    created_at: datetime
    item_count: int = 0

    @model_validator(mode="after")
    def _fill_item_count(self) -> "BillResponse":
        self.item_count = len(self.items)
        return self


class BillListResponse(OrmModel):
    """Bill register. Columns only — a per-bill item count would be an N+1 or a
    lazy load during serialisation (MissingGreenlet)."""

    id: uuid.UUID
    outlet_id: uuid.UUID
    order_number: str | None
    bill_number: str
    customer_name: str | None
    covers: int
    status: BillStatus
    subtotal: float
    discount_total: float
    tax_total: float
    service_charge: float
    tip: float
    grand_total: float
    paid_amount: float
    change_amount: float
    cashier_id: uuid.UUID | None
    settled_at: datetime | None
    created_at: datetime


# ─── Payments ────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    """Settle a bill. ``paid_amount`` derives from the sum of these lines."""

    method: PaymentMethod
    amount: float = Field(gt=0)
    reference: str | None = Field(default=None, max_length=200)
    gateway: str | None = Field(default=None, max_length=50)
    gateway_txn_id: str | None = Field(default=None, max_length=200)
    card_last4: str | None = Field(default=None, max_length=4)
    card_type: str | None = Field(default=None, max_length=20)
    upi_vpa: str | None = Field(default=None, max_length=100)
    idempotency_key: str | None = Field(default=None, max_length=100)


class PaymentResponse(OrmModel):
    id: uuid.UUID
    bill_id: uuid.UUID
    method: PaymentMethod
    amount: float
    reference: str | None
    gateway: str | None
    gateway_txn_id: str | None
    status: PaymentStatus
    card_last4: str | None
    card_type: str | None
    upi_vpa: str | None
    refunded_amount: float
    refunded_at: datetime | None
    idempotency_key: str | None
    created_at: datetime


class PaymentRequest(BaseModel):
    """A single payment leg for splitting a bill."""

    method: PaymentMethod
    amount: float = Field(gt=0)
    reference: str | None = Field(default=None, max_length=200)
    gateway: str | None = Field(default=None, max_length=50)
    gateway_txn_id: str | None = Field(default=None, max_length=200)
    card_last4: str | None = Field(default=None, max_length=4)
    upi_vpa: str | None = Field(default=None, max_length=100)
    idempotency_key: str | None = Field(default=None, max_length=100)


class SettleRequest(BaseModel):
    """Split settlement: several methods adding up to the bill total."""

    payments: list[PaymentRequest] = Field(default_factory=list)
    payment_method: PaymentMethod | None = None
    method: PaymentMethod | None = None
    amount_received: float | None = None
    amount: float | None = None
    reference: str | None = None

    @model_validator(mode="after")
    def _coerce_payments(self) -> "SettleRequest":
        if not self.payments:
            m = self.payment_method or self.method
            a = self.amount_received or self.amount
            if m and a:
                self.payments = [PaymentRequest(method=m, amount=a, reference=self.reference)]
        if not self.payments:
            raise ValueError("At least one payment is required")
        return self


class RefundRequest(BaseModel):
    payment_id: uuid.UUID
    amount: float | None = Field(default=None, gt=0)
    reason: str | None = Field(default=None, max_length=300)


class VoidRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=300)


# ─── Service charge & tip config ────────────────────────────────────────────

class ServiceChargeConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    pct: float = Field(ge=0, le=100)
    applies_to: str = "subtotal_after_discount"
    outlet_id: uuid.UUID | None = None


class ServiceChargeConfigResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    pct: float
    applies_to: str
    is_active: bool
    created_at: datetime


class TipConfigCreate(BaseModel):
    suggested_pcts: list[int] = Field(default_factory=lambda: [5, 10, 15])
    is_enabled: bool = True
    outlet_id: uuid.UUID | None = None


class TipConfigResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    suggested_pcts: list
    is_enabled: bool
    created_at: datetime


# ─── Coupons ────────────────────────────────────────────────────────────────

class CouponCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    description: str | None = None
    discount_type: DiscountType = DiscountType.PERCENT
    value: float = Field(ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    min_order_value: float = Field(ge=0, default=0)
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    usage_limit: int | None = Field(default=None, ge=1)
    per_user_limit: int | None = Field(default=None, ge=1)
    is_single_use: bool = False
    outlet_id: uuid.UUID | None = None


class CouponResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID | None
    code: str
    description: str | None
    discount_type: DiscountType
    value: float
    max_discount_amount: float | None
    min_order_value: float
    valid_from: datetime | None
    valid_to: datetime | None
    usage_limit: int | None
    per_user_limit: int | None
    uses_count: int
    is_single_use: bool
    is_active: bool
    created_at: datetime


class DiscountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    value: float | None = Field(default=None, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    min_order_value: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


# ─── Shifts ─────────────────────────────────────────────────────────────────

class ShiftOpen(BaseModel):
    """Open a cashier shift with a register float."""

    outlet_id: uuid.UUID
    user_id: uuid.UUID | None = None
    opening_cash: float = Field(ge=0, default=0)
    shift_type: str = "MORNING"
    denominations: dict = Field(default_factory=dict)
    notes: str | None = Field(default=None, max_length=500)


class CashMovementIn(BaseModel):
    """Cash in or out of the drawer."""

    movement_type: CashMovementType
    amount: float = Field(gt=0)
    reason: str | None = Field(default=None, max_length=500)


class CashMovementResponse(OrmModel):
    id: uuid.UUID
    shift_id: uuid.UUID
    movement_type: str
    amount: float
    reason: str | None
    created_by: uuid.UUID | None
    created_at: datetime


class ShiftClose(BaseModel):
    """Close a shift, counted cash vs expected.

    ``denominations`` is the physical note count, e.g. ``{"500": 2, "20": 3}``.
    Counting denominations is what separates a genuine shortage from a counting
    error — without the count, the two are indistinguishable.
    """

    closing_cash_actual: float = Field(ge=0)
    denominations: dict = Field(default_factory=dict)
    discrepancy_reason: str | None = Field(default=None, max_length=300)
    approved_by: uuid.UUID | None = None


class ShiftResponse(OrmModel):
    id: uuid.UUID
    outlet_id: uuid.UUID
    user_id: uuid.UUID
    shift_number: str
    shift_type: str
    status: str
    opening_cash: float
    closing_cash_expected: float | None
    closing_cash_actual: float | None
    discrepancy: float | None
    discrepancy_approved_by: uuid.UUID | None
    denominations: dict
    notes: str | None
    discrepancy_reason: str | None
    opened_at: datetime | None
    closed_at: datetime | None
    closed_by: uuid.UUID | None
    created_at: datetime
    cash_movements: list[CashMovementResponse] = Field(default_factory=list)


class CouponUpdate(BaseModel):
    value: float | None = Field(default=None, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    min_order_value: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


# ─── Invoices & receipts ────────────────────────────────────────────────────
#
# Request shapes mirror the retail frontend's invoicesApi / salesReturnsApi /
# paymentsApi payloads (frontend/src/lib/api-client.ts). Response models ride
# the OrmModel base so they serialise straight off ORM rows.

class InvoiceLineCreate(BaseModel):
    """One line. Prices are snapshotted; tax_rate comes from a billing tax
    code when the caller passes tax_code_id, otherwise it is used as-is."""

    menu_item_id: uuid.UUID | None = None
    description: str = Field(min_length=1, max_length=200)
    hsn_code: str | None = Field(default=None, max_length=20)
    qty: float = Field(gt=0, default=1)
    unit: str | None = Field(default=None, max_length=20)
    unit_price: float = Field(ge=0, default=0)
    discount_amount: float = Field(ge=0, default=0)
    tax_code_id: uuid.UUID | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    name: str | None = None  # frontend alias of description

    @model_validator(mode="after")
    def _fill_description(self) -> "InvoiceLineCreate":
        if not self.description and self.name:
            self.description = self.name
        return self


class InvoiceCreate(BaseModel):
    """Create an invoice. With ``bill_id`` the document is built from that
    bill's lines and totals (the POS path); otherwise from manual lines."""

    outlet_id: uuid.UUID | None = None
    bill_id: uuid.UUID | None = None
    invoice_type: str = "tax_invoice"
    invoice_number: str | None = Field(default=None, max_length=50)
    customer_id: uuid.UUID | None = None
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    customer_gstin: str | None = Field(default=None, max_length=20)
    discount_amount: float = Field(ge=0, default=0)  # whole-invoice discount
    tds: float = Field(ge=0, default=0)
    is_reverse_charge: bool = False
    is_tax_inclusive: bool = False
    dated: datetime | None = None
    notes: str | None = None
    paid_amount: float | None = Field(default=None, ge=0)
    payment_method: str | None = Field(default=None, max_length=30)
    lines: list[InvoiceLineCreate] = Field(default_factory=list)
    # Frontend also sends these spellings; tolerate both.
    items: list[InvoiceLineCreate] | None = None
    total_amount: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _fill(self) -> "InvoiceCreate":
        if self.items and not self.lines:
            self.lines = self.items
        return self


class InvoiceUpdate(BaseModel):
    customer_name: str | None = Field(default=None, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    customer_gstin: str | None = Field(default=None, max_length=20)
    notes: str | None = None
    status: str | None = None
    is_reverse_charge: bool | None = None
    is_tax_inclusive: bool | None = None
    irn_number: str | None = Field(default=None, max_length=100)
    ack_number: str | None = Field(default=None, max_length=100)
    e_invoice_qr: str | None = None
    print_template_id: uuid.UUID | None = None
    journal_entry_id: uuid.UUID | None = None


class InvoiceLineResponse(OrmModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    line_number: int
    menu_item_id: uuid.UUID | None
    description: str
    hsn_code: str | None
    qty: float
    unit: str
    unit_price: float
    discount_amount: float
    tax_code_id: uuid.UUID | None
    tax_rate: float
    cgst: float
    sgst: float
    igst: float
    cess: float
    line_total: float


class InvoicePaymentResponse(OrmModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    method: str
    amount: float
    reference: str | None
    paid_at: datetime | None
    created_at: datetime


class InvoiceResponse(OrmModel):
    """Frontend Invoice shape plus the billing details the receipts and the
    settlement UI need. ``amount_paid`` / ``balance_due`` / ``invoice_date``
    / ``currency_code`` are derived so the retail UI's Invoice interface
    resolves without a second fetch."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    invoice_number: str
    invoice_type: str
    bill_id: uuid.UUID | None
    exchange_from_invoice_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    customer_name: str | None
    customer_phone: str | None
    customer_gstin: str | None

    subtotal: float
    discount_total: float
    taxable_amount: float
    tax_total: float
    cgst_total: float
    sgst_total: float
    igst_total: float
    cess_total: float
    tds: float
    round_off: float
    grand_total: float
    paid_amount: float
    status: str

    is_reverse_charge: bool
    is_tax_inclusive: bool
    irn_number: str | None
    ack_number: str | None
    e_invoice_qr: str | None
    journal_entry_id: uuid.UUID | None
    print_template_id: uuid.UUID | None

    dated: datetime
    created_at: datetime
    updated_at: datetime

    lines: list[InvoiceLineResponse] = Field(default_factory=list)
    payments: list[InvoicePaymentResponse] = Field(default_factory=list)

    amount_paid: float = 0.0
    balance_due: float = 0.0
    invoice_date: str = ""
    currency_code: str = "INR"

    @model_validator(mode="after")
    def _derived(self) -> "InvoiceResponse":
        self.amount_paid = float(self.paid_amount or 0)
        self.balance_due = max(0.0, float(self.grand_total or 0) - float(self.paid_amount or 0))
        if not self.invoice_date:
            d = self.dated or self.created_at
            self.invoice_date = d.date().isoformat() if d else ""
        return self


class InvoiceListResponse(OrmModel):
    """Register-row shape for GET /invoices. Columns only — the list handler
    builds these with ``_shallow`` (no relationships) so serialising can
    never fire a lazy load; the derived ``balance_due`` keeps the UI's
    open-balance column cheap to compute."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    invoice_number: str
    invoice_type: str
    customer_name: str | None = None
    customer_phone: str | None = None
    grand_total: float
    paid_amount: float
    status: str
    dated: datetime
    created_at: datetime
    balance_due: float = 0.0

    @model_validator(mode="after")
    def _derived(self) -> "InvoiceListResponse":
        self.balance_due = max(0.0, float(self.grand_total or 0) - float(self.paid_amount or 0))
        return self


class InvoiceItemCreate(BaseModel):
    """Frontend sales-returns item shape (product-centric naming)."""

    product_id: uuid.UUID | None = None
    product_name: str = ""
    menu_item_id: uuid.UUID | None = None
    sku: str | None = Field(default=None, max_length=100)
    hsn_code: str | None = Field(default=None, max_length=20)
    batch_number: str | None = Field(default=None, max_length=100)
    quantity: float = Field(ge=0, default=1)
    qty: float | None = None
    unit_price: float = Field(ge=0, default=0)
    price: float | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    tax_amount: float | None = Field(default=None, ge=0)
    discount_amount: float | None = Field(default=None, ge=0)
    line_total: float | None = Field(default=None, ge=0)
    reason: str | None = None
    disposition: str | None = None

    @model_validator(mode="after")
    def _fill(self) -> "InvoiceItemCreate":
        if self.quantity <= 0 and (self.qty or 0) > 0:
            self.quantity = self.qty
        if not self.unit_price and (self.price or 0) > 0:
            self.unit_price = self.price
        return self


class SalesReturnCreate(BaseModel):
    original_invoice_id: uuid.UUID | None = None
    original_invoice_number: str | None = None
    outlet_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    return_date: datetime | None = None
    settlement_method: str | None = None
    reason: str | None = None
    notes: str | None = None
    items: list[InvoiceItemCreate] = Field(default_factory=list)


class SalesReturnExchangeCreate(SalesReturnCreate):
    exchange_items: list[InvoiceItemCreate] = Field(default_factory=list)


class SalesReturnResponse(BaseModel):
    """Columns plus the caller's items, so POST echoes and GET stay one
    query deep."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    invoice_id: uuid.UUID | None
    invoice_number: str | None
    return_number: str
    customer_id: uuid.UUID | None
    customer_name: str | None
    customer_phone: str | None
    return_date: datetime
    settlement_method: str | None
    reason: str | None
    notes: str | None
    total_amount: float
    status: str
    exchange_invoice_id: uuid.UUID | None
    created_at: datetime
    items: list[dict] = Field(default_factory=list)
    items_count: int = 0

    @model_validator(mode="after")
    def _count(self) -> "SalesReturnResponse":
        self.items_count = len(self.items or [])
        return self


class PrintTemplateCreate(BaseModel):
    """POST /print-templates arrives as ``{"template": {...}, "set_as_default":
    bool}`` from the frontend saveTemplate. The template body is free-form:
    the frontend's ReceiptTemplate JSON (themeName, paperSize, fields,
    elements, ...) is stored wholesale in ``fields`` so nothing is lost on
    round-trip."""

    template: dict | None = None
    outlet_id: uuid.UUID | None = None
    category: str = "thermal"
    name: str | None = None
    set_as_default: bool = False


class PrintTemplateResponse(OrmModel):
    """The stored row. A template's full JSON (everything except id/tenant)
    is round-tripped in ``fields``; ``name`` and ``paper_size`` are top
    level so list responses match the frontend's expectations."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    category: str
    name: str
    paper_size: str
    fields: dict
    active: bool
    created_at: datetime
    updated_at: datetime


class SetActivePrintTemplate(BaseModel):
    template_id: uuid.UUID
    category: str = "thermal"


class InvoiceRecordPaymentIn(BaseModel):
    """One payment leg recorded against a single invoice (retail
    recordPayment shape). The amount is clamped to the outstanding balance;
    a full payment settles the invoice."""

    amount: float = Field(gt=0)
    payment_date: datetime | None = None
    payment_method: str = "cash"
    reference_number: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=500)


class InvoiceSettlementCreate(BaseModel):
    """Settle one invoice (or a FIFO batch of a customer's invoices). The
    retail settleInvoices payload also carries customer-level fields; they
    are accepted and the allocations are applied oldest-first."""

    customer_id: uuid.UUID | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    payment_amount: float = Field(gt=0)
    payment_date: datetime | None = None
    payment_method: str = "cash"
    reference_number: str | None = Field(default=None, max_length=200)
    notes: str | None = None
    allocations: list[dict] | None = None  # [{"invoice_id","amount_allocated"}]
    invoice_id: uuid.UUID | None = None


class InvoiceVoid(BaseModel):
    reason: str | None = Field(default=None, max_length=300)


class ReminderPolicyIn(BaseModel):
    outlet_id: uuid.UUID | None = None
    enabled: bool = False
    channels: list[str] = Field(default_factory=lambda: ["whatsapp"])
    days_before_due: int = 3
    reminder_frequency_days: int = 1
    notes: str | None = None


class GatewayConfigIn(BaseModel):
    gateway: str
    outlet_id: uuid.UUID | None = None
    is_enabled: bool = True
    is_test_mode: bool = False
    credentials: dict = Field(default_factory=dict)
    settings: dict | None = None


class GatewayConfigResponse(OrmModel):
    """Frontend PaymentGatewayConfigDTO shape, derived from the row."""

    id: uuid.UUID
    gateway: str
    outlet_id: uuid.UUID | None
    is_enabled: bool
    is_test_mode: bool
    config: dict
    name: str = ""
    category: str = "domestic"
    description: str = ""
    credentials: dict = Field(default_factory=dict)
    supported_methods: list[str] = Field(default_factory=list)
    currencies: list[str] = Field(default_factory=lambda: ["INR"])

    @model_validator(mode="after")
    def _fill(self) -> "GatewayConfigResponse":
        self.name = {"razorpay": "Razorpay", "pinelabs": "PineLabs POS Terminal"}.get(
            self.gateway, self.gateway)
        self.category = "pos_terminal" if self.gateway == "pinelabs" else "domestic"
        self.credentials = {k: v for k, v in (self.config or {}).items()
                            if k in ("key_id", "terminal_id", "merchant_id", "region")}
        return self


class RazorpayOrderCreate(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "INR"
    receipt: str | None = None
    outlet_id: uuid.UUID | None = None
    company_id: str | None = None  # retail frontends send a company id; scope by outlet
    notes: dict | None = None


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str = ""
    order_id: str | None = None
    razorpay_payment_id: str = ""
    payment_id: str | None = None
    razorpay_signature: str = ""
    signature: str | None = None
    outlet_id: uuid.UUID | None = None
    company_id: str | None = None

    @model_validator(mode="after")
    def _fill(self) -> "RazorpayVerifyRequest":
        if not self.order_id:
            self.order_id = self.razorpay_order_id
        if not self.payment_id:
            self.payment_id = self.razorpay_payment_id
        if not self.signature:
            self.signature = self.razorpay_signature
        return self


class PineLabsChargeRequest(BaseModel):
    amount: float = Field(gt=0)
    bill_number: str = ""
    outlet_id: uuid.UUID | None = None
    customer_mobile: str | None = None
    payment_mode: str | None = "CARD"
    terminal_id: str | None = None
    company_id: str | None = None

