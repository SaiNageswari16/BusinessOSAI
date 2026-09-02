import uuid
from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from src.database.base import Base, EntityStatus, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin

# ─── Supplier Management ───────────────────────────────────────────

class SupplierCategory(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_supplier_categories"
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[EntityStatus] = mapped_column(
        Enum(EntityStatus, name="entity_status", create_type=False),
        default=EntityStatus.ACTIVE,
    )
    
    suppliers: Mapped[list["Supplier"]] = relationship(back_populates="category")


class Supplier(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_suppliers"
    
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(100), default="Manufacturer") # Manufacturer, Distributor, Service Provider
    products_desc: Mapped[str | None] = mapped_column(Text)
    credit_limit: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5.0)
    status: Mapped[str] = mapped_column(String(50), default="Active") # Active, Inactive
    company_name: Mapped[str | None] = mapped_column(String(150))
    
    category_id = mapped_column(ForeignKey("erp_supplier_categories.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[SupplierCategory | None] = relationship(back_populates="suppliers")
    
    contacts: Mapped[list["SupplierContact"]] = relationship(back_populates="supplier", cascade="all, delete-orphan")
    contracts: Mapped[list["SupplierContract"]] = relationship(back_populates="supplier", cascade="all, delete-orphan")
    performance_records: Mapped[list["SupplierPerformance"]] = relationship(back_populates="supplier", cascade="all, delete-orphan")
    blacklist_records: Mapped[list["BlacklistedSupplier"]] = relationship(back_populates="supplier", cascade="all, delete-orphan")


class SupplierContact(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_supplier_contacts"
    
    supplier_id = mapped_column(ForeignKey("erp_suppliers.id", ondelete="CASCADE"), nullable=False)
    supplier: Mapped[Supplier] = relationship(back_populates="contacts")
    
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))


class SupplierContract(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_supplier_contracts"
    
    supplier_id = mapped_column(ForeignKey("erp_suppliers.id", ondelete="CASCADE"), nullable=False)
    supplier: Mapped[Supplier] = relationship(back_populates="contracts")
    
    contract_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    start_date: Mapped[datetime | None] = mapped_column(DateTime)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    terms: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Active") # Active, Expired, Terminated


class SupplierPerformance(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_supplier_performance"
    
    supplier_id = mapped_column(ForeignKey("erp_suppliers.id", ondelete="CASCADE"), nullable=False)
    supplier: Mapped[Supplier] = relationship(back_populates="performance_records")
    
    delivery_rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5.0)
    quality_rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5.0)
    pricing_rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5.0)
    overall_rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5.0)
    evaluation_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BlacklistedSupplier(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_blacklisted_suppliers"
    
    supplier_id = mapped_column(ForeignKey("erp_suppliers.id", ondelete="CASCADE"), nullable=False)
    supplier: Mapped[Supplier] = relationship(back_populates="blacklist_records")
    
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    blacklisted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    blacklisted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))


# ─── Procurement ───────────────────────────────────────────────────

class PurchaseRequest(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_purchase_requests"
    
    request_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    requester_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    request_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(50), default="Draft") # Draft, Pending Approval, Approved, Rejected
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    
    items: Mapped[list["PurchaseRequestItem"]] = relationship(back_populates="purchase_request", cascade="all, delete-orphan")


class PurchaseRequestItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "erp_purchase_request_items"
    
    purchase_request_id = mapped_column(ForeignKey("erp_purchase_requests.id", ondelete="CASCADE"), nullable=False)
    purchase_request: Mapped[PurchaseRequest] = relationship(back_populates="items")
    
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(15, 4), default=1.0)
    estimated_price: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)


class PurchaseQuotation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_purchase_quotations"
    
    quotation_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    purchase_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    supplier_id = mapped_column(ForeignKey("erp_suppliers.id", ondelete="CASCADE"), nullable=False)
    
    date_received: Mapped[datetime | None] = mapped_column(DateTime)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime)
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="Received") # Received, Under Review, Accepted, Rejected
    
    items: Mapped[list["PurchaseQuotationItem"]] = relationship(back_populates="purchase_quotation", cascade="all, delete-orphan")


class PurchaseQuotationItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "erp_purchase_quotation_items"
    
    purchase_quotation_id = mapped_column(ForeignKey("erp_purchase_quotations.id", ondelete="CASCADE"), nullable=False)
    purchase_quotation: Mapped[PurchaseQuotation] = relationship(back_populates="items")
    
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(15, 4), default=1.0)
    unit_price: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)


class PurchaseOrder(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_purchase_orders"
    
    po_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    supplier_id = mapped_column(ForeignKey("erp_suppliers.id", ondelete="RESTRICT"), nullable=False)
    supplier: Mapped[Supplier] = relationship()
    
    purchase_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    order_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    delivery_date: Mapped[datetime | None] = mapped_column(DateTime)
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="Draft") # Draft, Sent, Partially Received, Fully Received, Billed, Cancelled
    
    items: Mapped[list["PurchaseOrderItem"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")


class PurchaseOrderItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "erp_purchase_order_items"
    
    purchase_order_id = mapped_column(ForeignKey("erp_purchase_orders.id", ondelete="CASCADE"), nullable=False)
    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="items")
    
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(15, 4), default=1.0)
    unit_price: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    tax_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)


class GoodsReceivedNote(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_goods_received_notes"
    
    grn_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    purchase_order_id = mapped_column(ForeignKey("erp_purchase_orders.id", ondelete="RESTRICT"), nullable=False)
    purchase_order: Mapped[PurchaseOrder] = relationship()
    
    received_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    received_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Draft") # Draft, Verified, Returned
    
    items: Mapped[list["GoodsReceivedNoteItem"]] = relationship(back_populates="grn", cascade="all, delete-orphan")


class GoodsReceivedNoteItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "erp_goods_received_note_items"
    
    grn_id = mapped_column(ForeignKey("erp_goods_received_notes.id", ondelete="CASCADE"), nullable=False)
    grn: Mapped[GoodsReceivedNote] = relationship(back_populates="items")
    
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    quantity_ordered: Mapped[float] = mapped_column(Numeric(15, 4), default=0.0)
    quantity_received: Mapped[float] = mapped_column(Numeric(15, 4), default=0.0)
    quantity_accepted: Mapped[float] = mapped_column(Numeric(15, 4), default=0.0)
    quantity_rejected: Mapped[float] = mapped_column(Numeric(15, 4), default=0.0)


class PurchaseReturn(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_purchase_returns"
    
    return_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    purchase_order_id = mapped_column(ForeignKey("erp_purchase_orders.id", ondelete="RESTRICT"), nullable=False)
    purchase_order: Mapped[PurchaseOrder] = relationship()
    
    return_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="Pending") # Pending, Sent, Refunded
    
    items: Mapped[list["PurchaseReturnItem"]] = relationship(back_populates="purchase_return", cascade="all, delete-orphan")


class PurchaseReturnItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "erp_purchase_return_items"
    
    purchase_return_id = mapped_column(ForeignKey("erp_purchase_returns.id", ondelete="CASCADE"), nullable=False)
    purchase_return: Mapped[PurchaseReturn] = relationship(back_populates="items")
    
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    quantity_returned: Mapped[float] = mapped_column(Numeric(15, 4), default=0.0)


# ─── Vendor Payments ───────────────────────────────────────────────

class VendorBill(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_vendor_bills"
    
    bill_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    purchase_order_id = mapped_column(ForeignKey("erp_purchase_orders.id", ondelete="RESTRICT"), nullable=False)
    purchase_order: Mapped[PurchaseOrder] = relationship()
    
    # 3-Way Match: GRN → Bill link. Optional so legacy bills without GRN are not broken.
    # Best practice: always link a bill to the GRN that confirmed goods were received.
    grn_id = mapped_column(ForeignKey("erp_goods_received_notes.id", ondelete="SET NULL"), nullable=True)
    grn: Mapped["GoodsReceivedNote | None"] = relationship()
    
    bill_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[datetime | None] = mapped_column(DateTime)
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    paid_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="Draft") # Draft, Unpaid, Partially Paid, Paid, Overdue
    
    payments: Mapped[list["VendorPayment"]] = relationship(back_populates="vendor_bill", cascade="all, delete-orphan")


class VendorPayment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_vendor_payments"
    
    vendor_bill_id = mapped_column(ForeignKey("erp_vendor_bills.id", ondelete="CASCADE"), nullable=False)
    vendor_bill: Mapped[VendorBill] = relationship(back_populates="payments")
    
    payment_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    payment_method: Mapped[str] = mapped_column(String(100), default="Bank Transfer") # Cash, Bank Transfer, Card, UPI
    amount_paid: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    reference_number: Mapped[str | None] = mapped_column(String(100))


class VendorCreditNote(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_vendor_credit_notes"
    
    note_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    supplier_id = mapped_column(ForeignKey("erp_suppliers.id", ondelete="RESTRICT"), nullable=False)
    supplier: Mapped[Supplier] = relationship()
    
    amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="Unapplied") # Unapplied, Applied, Refunded


class VendorDebitNote(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_vendor_debit_notes"
    
    note_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    supplier_id = mapped_column(ForeignKey("erp_suppliers.id", ondelete="RESTRICT"), nullable=False)
    supplier: Mapped[Supplier] = relationship()
    
    amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="Draft") # Draft, Sent, Settled


class ProcurementAISuggestion(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "erp_procurement_ai_suggestions"
    
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    impact_saving: Mapped[str] = mapped_column(String(150), nullable=False)
    priority: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending") # Pending, Executed
