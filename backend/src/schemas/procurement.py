import uuid
from typing import Optional, List
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
    items: List[PurchaseOrderItemCreate]


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
    purchase_order_id: uuid.UUID
    return_date: Optional[datetime] = None
    reason: Optional[str] = None
    status: Optional[str] = "Pending"


class PurchaseReturnCreate(BaseModel):
    return_number: str
    purchase_order_id: uuid.UUID
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
    bill_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    total_amount: Optional[float] = 0.0
    paid_amount: Optional[float] = 0.0
    status: Optional[str] = "Draft"


class VendorBillCreate(BaseModel):
    bill_number: str
    purchase_order_id: uuid.UUID
    due_date: Optional[datetime] = None
    total_amount: float


class VendorBillResponse(VendorBillBase):
    id: uuid.UUID
    po_number: Optional[str] = None
    supplier_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Vendor Payment schemas ---

class VendorPaymentBase(BaseModel):
    vendor_bill_id: uuid.UUID
    payment_date: Optional[datetime] = None
    payment_method: Optional[str] = "Bank Transfer"
    amount_paid: float
    reference_number: Optional[str] = Field(None, max_length=100)


class VendorPaymentCreate(VendorPaymentBase):
    pass


class VendorPaymentResponse(VendorPaymentBase):
    id: uuid.UUID
    bill_number: Optional[str] = None
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
