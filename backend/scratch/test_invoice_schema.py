import os
import sys
from datetime import date, datetime
import uuid
from typing import Any
from pydantic import BaseModel, ConfigDict, Field

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class InvoicePaymentResponse(ORMModel):
    id: uuid.UUID | None = None
    invoice_id: uuid.UUID | None = None
    payment_date: date | None = None
    payment_method: str | None = "Cash"
    amount: float | None = 0.0
    reference_number: str | None = None
    bank_account_id: uuid.UUID | None = None
    notes: str | None = None

class InvoiceLineResponse(ORMModel):
    id: uuid.UUID | None = None
    invoice_id: uuid.UUID | None = None
    line_number: int | None = 1
    product_id: uuid.UUID | None = None
    product_name: str | None = "Item"
    product_sku: str | None = None
    hsn_code: str | None = None
    batch_number: str | None = None
    expiry_date: date | None = None
    mfg_date: date | None = None
    mrp: float | None = None
    description: str | None = None
    uom: str | None = None
    quantity: float | None = 1.0
    unit_price: float | None = 0.0
    discount_type: str | None = None
    discount_value: float | None = 0.0
    discount_amount: float | None = 0.0
    taxable_amount: float | None = 0.0
    tax_rate: float | None = 0.0
    is_tax_inclusive: bool | None = False
    cgst_amount: float | None = 0.0
    sgst_amount: float | None = 0.0
    igst_amount: float | None = 0.0
    line_total: float | None = 0.0
    cost_center_id: uuid.UUID | None = None

class InvoiceResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str | None = "Customer"
    customer_email: str | None = None
    customer_phone: str | None = None
    customer_gstin: str | None = None
    billing_address: str | None = None
    shipping_address: str | None = None
    invoice_number: str
    invoice_type: str | None = "tax_invoice"
    reference_number: str | None = None
    order_number: str | None = None
    po_number: str | None = None
    po_date: date | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    transporter_name: str | None = None
    transporter_id: str | None = None
    eway_bill_number: str | None = None
    eway_bill_date: datetime | None = None
    challan_number: str | None = None
    delivery_challan_number: str | None = None
    custom_fields: dict[str, Any] | list[Any] | None = None
    template_id: str | None = None
    print_template_id: str | None = None
    sales_rep_id: uuid.UUID | None = None
    sales_rep_name: str | None = None
    salesperson_name: str | None = None
    sales_points_earned: float | None = 0.0
    status: str | None = "draft"
    invoice_date: date | None = None
    due_date: date | None = None
    service_from: date | None = None
    service_to: date | None = None
    payment_terms: str | None = None
    currency_code: str | None = "INR"
    exchange_rate: float | None = 1.0
    subtotal: float | None = 0.0
    taxable_value: float | None = 0.0
    tax_amount: float | None = 0.0
    discount_type: str | None = None
    discount_value: float | None = 0.0
    discount_amount: float | None = 0.0
    cgst_amount: float | None = 0.0
    sgst_amount: float | None = 0.0
    igst_amount: float | None = 0.0
    tds_amount: float | None = 0.0
    round_off: float | None = 0.0
    total_amount: float | None = 0.0
    grand_total: float | None = 0.0
    amount_paid: float | None = 0.0
    balance_due: float | None = 0.0
    notes: str | None = None
    terms: str | None = None
    footer: str | None = None
    is_reverse_charge: bool | None = False
    is_tax_inclusive: bool | None = False
    is_interstate: bool | None = False
    gst_type: str | None = None
    payment_status: str | None = None
    payment_method: str | None = None
    irn_number: str | None = None
    ack_number: str | None = None
    ack_date: datetime | None = None
    e_invoice_qr: str | None = None
    is_approved: bool | None = False
    approved_by_user_id: uuid.UUID | None = None
    approved_at: datetime | None = None
    journal_entry_id: uuid.UUID | None = None
    lines: list[InvoiceLineResponse] = Field(default_factory=list)
    payments: list[InvoicePaymentResponse] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None

data = {
    "id": "00000000-0000-0000-0000-000000000001",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "invoice_number": "INV-001",
}
inv = InvoiceResponse.model_validate(data)
print("SUCCESS VALIDATION! Total amount:", inv.total_amount, "Status:", inv.status)
