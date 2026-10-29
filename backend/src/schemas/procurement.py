import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# --- Base schemas ---

class SupplierCategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    description: Optional[str] = None
    status: Optional[str] = "active"


class SupplierCategoryCreate(SupplierCategoryBase):
    pass


class SupplierCategoryResponse(SupplierCategoryBase):
    id: uuid.UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Supplier schemas ---

class SupplierBase(BaseModel):
    name: str = Field(..., max_length=150)
    code: str = Field(..., max_length=50)
    type: Optional[str] = "Manufacturer"
    products_desc: Optional[str] = None
    credit_limit: Optional[float] = 0.0
    rating: Optional[float] = 5.0
    status: Optional[str] = "Active"
    company_name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    gst_number: Optional[str] = None
    pan: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None

    class Config:
        from_attributes = True
        extra = "ignore"


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[str] = None
    products_desc: Optional[str] = None
    credit_limit: Optional[float] = None
    rating: Optional[float] = None
    status: Optional[str] = None
    company_name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    gst_number: Optional[str] = None
    pan: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class SupplierResponse(SupplierBase):
    id: uuid.UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    category_name: Optional[str] = None

    class Config:
        from_attributes = True


# --- Contacts schemas ---

class SupplierContactBase(BaseModel):
    supplier_id: uuid.UUID
    name: str = Field(..., max_length=150)
    role: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)


class SupplierContactCreate(SupplierContactBase):
    pass


class SupplierContactResponse(SupplierContactBase):
    id: uuid.UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Contracts schemas ---

class SupplierContractBase(BaseModel):
    supplier_id: uuid.UUID
    contract_number: str = Field(..., max_length=100)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    terms: Optional[str] = None
    status: Optional[str] = "Active"


class SupplierContractCreate(SupplierContractBase):
    pass


class SupplierContractResponse(SupplierContractBase):
    id: uuid.UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Performance schemas ---

class SupplierPerformanceBase(BaseModel):
    supplier_id: uuid.UUID
    delivery_rating: Optional[float] = 5.0
    quality_rating: Optional[float] = 5.0
    pricing_rating: Optional[float] = 5.0
    overall_rating: Optional[float] = 5.0
    evaluation_date: Optional[datetime] = None


class SupplierPerformanceCreate(SupplierPerformanceBase):
    pass


class SupplierPerformanceResponse(SupplierPerformanceBase):
    id: uuid.UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Blacklist schemas ---

class BlacklistedSupplierBase(BaseModel):
    supplier_id: uuid.UUID
    reason: str


class BlacklistedSupplierCreate(BlacklistedSupplierBase):
    pass


class BlacklistedSupplierResponse(BlacklistedSupplierBase):
    id: uuid.UUID
    blacklisted_at: datetime
    blacklisted_by: Optional[uuid.UUID] = None

    class Config:
        from_attributes = True


# --- Purchase Request schemas ---

class PurchaseRequestItemBase(BaseModel):
    product_id: uuid.UUID
    quantity: float
    estimated_price: Optional[float] = 0.0


class PurchaseRequestItemCreate(PurchaseRequestItemBase):
    pass


class PurchaseRequestItemResponse(PurchaseRequestItemBase):
    id: uuid.UUID
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class PurchaseRequestBase(BaseModel):
    request_number: str = Field(..., max_length=50)
    requester_id: uuid.UUID
    request_date: Optional[datetime] = None
    status: Optional[str] = "Draft"
    total_amount: Optional[float] = 0.0


class PurchaseRequestCreate(BaseModel):
    request_number: str
    requester_id: uuid.UUID
    status: Optional[str] = "Draft"
    items: List[PurchaseRequestItemCreate]


class PurchaseRequestResponse(PurchaseRequestBase):
    id: uuid.UUID
    items: List[PurchaseRequestItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Purchase Quotation schemas ---

class PurchaseQuotationItemBase(BaseModel):
    product_id: uuid.UUID
    quantity: float
    unit_price: float


class PurchaseQuotationItemCreate(PurchaseQuotationItemBase):
    pass


class PurchaseQuotationItemResponse(PurchaseQuotationItemBase):
    id: uuid.UUID
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class PurchaseQuotationBase(BaseModel):
    quotation_number: str = Field(..., max_length=100)
    purchase_request_id: Optional[uuid.UUID] = None
    supplier_id: uuid.UUID
    date_received: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    total_amount: Optional[float] = 0.0
    status: Optional[str] = "Received"


class PurchaseQuotationCreate(BaseModel):
    quotation_number: str
    purchase_request_id: Optional[uuid.UUID] = None
    supplier_id: uuid.UUID
    date_received: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    items: List[PurchaseQuotationItemCreate]


class PurchaseQuotationResponse(PurchaseQuotationBase):
    id: uuid.UUID
    items: List[PurchaseQuotationItemResponse] = []
    supplier_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Purchase Order schemas ---

class PurchaseOrderItemBase(BaseModel):
    product_id: uuid.UUID
    quantity: float
    unit_price: float
    tax_percent: Optional[float] = 0.0
    # Optional informational columns (persisted when the PO is used as a bill line)
    hsn_code: Optional[str] = None
    uom: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    discount_value: Optional[float] = None
    discount_type: Optional[str] = None
    is_free: Optional[bool] = False
    tax_amount: Optional[float] = None


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass


class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    id: uuid.UUID
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class PurchaseOrderBase(BaseModel):
    po_number: str = Field(..., max_length=100)
    supplier_id: uuid.UUID
    purchase_request_id: Optional[uuid.UUID] = None
    order_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    total_amount: Optional[float] = 0.0
    status: Optional[str] = "Draft"


class PurchaseOrderCreate(BaseModel):
    po_number: str
    supplier_id: uuid.UUID
    purchase_request_id: Optional[uuid.UUID] = None
    delivery_date: Optional[datetime] = None
    status: Optional[str] = "Draft"
    items: List[PurchaseOrderItemCreate]


class PurchaseOrderUpdate(BaseModel):
    po_number: Optional[str] = None
    supplier_id: Optional[uuid.UUID] = None
    purchase_request_id: Optional[uuid.UUID] = None
    delivery_date: Optional[datetime] = None
    total_amount: Optional[float] = None
    status: Optional[str] = None
    items: Optional[List[PurchaseOrderItemCreate]] = None


class PurchaseOrderResponse(PurchaseOrderBase):
    id: uuid.UUID
    items: List[PurchaseOrderItemResponse] = []
    supplier_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Goods Received Note schemas ---

class GoodsReceivedNoteItemBase(BaseModel):
    product_id: uuid.UUID
    quantity_ordered: float
    quantity_received: float
    quantity_accepted: float
    quantity_rejected: float
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None


class GoodsReceivedNoteItemCreate(GoodsReceivedNoteItemBase):
    pass


class GoodsReceivedNoteItemResponse(GoodsReceivedNoteItemBase):
    id: uuid.UUID
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class GoodsReceivedNoteBase(BaseModel):
    grn_number: str = Field(..., max_length=100)
    purchase_order_id: uuid.UUID
    received_date: Optional[datetime] = None
    received_by: uuid.UUID
    status: Optional[str] = "Draft"


class GoodsReceivedNoteCreate(BaseModel):
    grn_number: str
    purchase_order_id: uuid.UUID
    received_by: uuid.UUID
    items: List[GoodsReceivedNoteItemCreate]


class GoodsReceivedNoteUpdate(BaseModel):
    received_date: Optional[datetime] = None
    status: Optional[str] = None


class GoodsReceivedNoteResponse(GoodsReceivedNoteBase):
    id: uuid.UUID
    items: List[GoodsReceivedNoteItemResponse] = []
    po_number: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Purchase Return schemas ---

class PurchaseReturnItemBase(BaseModel):
    product_id: uuid.UUID
    quantity_returned: float


class PurchaseReturnItemCreate(PurchaseReturnItemBase):
    pass


class PurchaseReturnItemResponse(PurchaseReturnItemBase):
    id: uuid.UUID
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class PurchaseReturnBase(BaseModel):
    return_number: str = Field(..., max_length=100)
    purchase_order_id: Optional[uuid.UUID] = None
    supplier_id: Optional[uuid.UUID] = None
    supplier_name: Optional[str] = None
    vendor_bill_id: Optional[uuid.UUID] = None
    vendor_bill_number: Optional[str] = None
    debit_note_number: Optional[str] = None
    settlement_method: Optional[str] = "debit_note"
    total_amount: Optional[float] = 0.0
    return_date: Optional[datetime] = None
    reason: Optional[str] = None
    status: Optional[str] = "Pending"


class PurchaseReturnCreate(BaseModel):
    return_number: str
    purchase_order_id: Optional[uuid.UUID] = None
    supplier_id: Optional[uuid.UUID] = None
    supplier_name: Optional[str] = None
    vendor_bill_id: Optional[uuid.UUID] = None
    debit_note_number: Optional[str] = None
    settlement_method: Optional[str] = "debit_note"
    total_amount: Optional[float] = 0.0
    reason: Optional[str] = None
    items: List[PurchaseReturnItemCreate]


class PurchaseReturnResponse(PurchaseReturnBase):
    id: uuid.UUID
    items: List[PurchaseReturnItemResponse] = []
    po_number: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Vendor Bill schemas ---

class VendorBillBase(BaseModel):
    bill_number: str = Field(..., max_length=100)
    purchase_order_id: uuid.UUID
    grn_id: Optional[uuid.UUID] = None  # 3-way match: link to GRN that confirmed receipt
    bill_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    total_amount: Optional[float] = 0.0
    paid_amount: Optional[float] = 0.0
    status: Optional[str] = "Draft"


class VendorBillItemOverride(BaseModel):
    """Per-line overrides stored on the bill itself (MRP / sell price / UOM as recorded at billing time)."""
    product_id: Optional[uuid.UUID] = None
    product_name: Optional[str] = None
    hsn_code: Optional[str] = None
    uom: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    tax_percent: Optional[float] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    discount_value: Optional[float] = None
    discount_type: Optional[str] = None
    is_free: Optional[bool] = False
    is_tax_inclusive: Optional[bool] = False
    sku: Optional[str] = None


class VendorBillCreate(BaseModel):
    bill_number: str
    purchase_order_id: uuid.UUID
    grn_id: Optional[uuid.UUID] = None  # 3-way match: link bill to GRN
    due_date: Optional[datetime] = None
    total_amount: float
    paid_amount: Optional[float] = 0.0
    status: Optional[str] = "Unpaid"
    item_overrides: Optional[List[VendorBillItemOverride]] = None  # persist exact per-line values shown at entry


class CancelVendorBillPayload(BaseModel):
    reason: Optional[str] = None


class VendorBillResponse(VendorBillBase):
    id: uuid.UUID
    po_number: Optional[str] = None
    grn_number: Optional[str] = None       # resolved from grn_id for display
    grn_status: Optional[str] = None       # Verified / Draft — shows QC state
    supplier_id: Optional[uuid.UUID] = None
    supplier_name: Optional[str] = None
    # Full vendor party details for the PI preview (GSTIN, address, contact, etc.)
    supplier: Optional[dict] = None
    supplier_gstin: Optional[str] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    tax_rate: Optional[float] = None
    cgst: Optional[float] = 0.0
    sgst: Optional[float] = 0.0
    igst: Optional[float] = 0.0
    items: Optional[List[PurchaseOrderItemResponse]] = []
    # Exact per-line values captured at entry (MRP / sell price / UOM), keyed by product
    item_overrides: Optional[List[dict]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Vendor Payment schemas ---

class VendorPaymentBase(BaseModel):
    vendor_bill_id: Optional[uuid.UUID] = None
    supplier_name: Optional[str] = None
    payment_date: Optional[datetime] = None
    payment_method: Optional[str] = "Bank Transfer"
    amount_paid: float
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class VendorPaymentCreate(VendorPaymentBase):
    pass


class VendorPaymentResponse(VendorPaymentBase):
    id: uuid.UUID
    bill_number: Optional[str] = None
    supplier_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Notes schemas ---

class VendorCreditNoteBase(BaseModel):
    note_number: str = Field(..., max_length=100)
    supplier_id: uuid.UUID
    amount: float
    status: Optional[str] = "Unapplied"


class VendorCreditNoteCreate(VendorCreditNoteBase):
    pass


class VendorCreditNoteResponse(VendorCreditNoteBase):
    id: uuid.UUID
    supplier_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VendorDebitNoteBase(BaseModel):
    note_number: str = Field(..., max_length=100)
    supplier_id: uuid.UUID
    amount: float
    status: Optional[str] = "Draft"


class VendorDebitNoteCreate(VendorDebitNoteBase):
    pass


class VendorDebitNoteResponse(VendorDebitNoteBase):
    id: uuid.UUID
    supplier_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PurchaseInvoiceSettingsPayload(BaseModel):
    customSequenceEnabled: Optional[bool] = True
    prefix: Optional[str] = "BILL-"
    sequenceNumber: Optional[int] = 1
    suffix: Optional[str] = ""
    padding: Optional[int] = 4
    poPrefix: Optional[str] = "PO-"
    grnPrefix: Optional[str] = "GRN-"

    showPoNumber: Optional[bool] = True
    showGrnReference: Optional[bool] = True
    showEwayBill: Optional[bool] = True
    showVehicleNumber: Optional[bool] = True
    showChallanNumber: Optional[bool] = True
    showPaymentTerms: Optional[bool] = True
    invoiceCustomFields: Optional[List[Dict[str, Any]]] = []

    showHsn: Optional[bool] = True
    showUom: Optional[bool] = True
    showBatchNo: Optional[bool] = True
    showExpDate: Optional[bool] = True
    showMfgDate: Optional[bool] = False
    showMrp: Optional[bool] = False
    showSellPrice: Optional[bool] = False
    showRate: Optional[bool] = True
    showDiscount: Optional[bool] = True
    showGstTax: Optional[bool] = True
    showFreeQty: Optional[bool] = False
    itemCustomColumns: Optional[List[Dict[str, Any]]] = []

    defaultTerms: Optional[str] = None
    defaultPaymentTerms: Optional[str] = None
