import enum
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import (
    Base,
    TenantScopedMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    db_enum,
    enum_values,
)


# ─── Vendors ─────────────────────────────────────────────────────

class VendorType(str, enum.Enum):
    INGREDIENT = "ingredient"
    BEVERAGE = "beverage"
    PACKAGING = "packaging"
    SERVICE = "service"
    EQUIPMENT = "equipment"


class Vendor(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "vendors"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_vendor_code"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    contact_person: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    vendor_type: Mapped[VendorType] = mapped_column(
        db_enum(VendorType, name="vendor_type"), default=VendorType.INGREDIENT
    )
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    credit_limit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    rating: Mapped[int] = mapped_column(Integer, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    items: Mapped[list["VendorItem"]] = relationship(
        back_populates="vendor", cascade="all, delete-orphan"
    )


class VendorItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "vendor_items"
    __table_args__ = (
        UniqueConstraint("vendor_id", "inventory_item_id", name="uq_vendor_item"),
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_item_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    min_order_qty: Mapped[float] = mapped_column(Numeric(12, 4), default=1)
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_preferred: Mapped[bool] = mapped_column(Boolean, default=False)

    vendor: Mapped["Vendor"] = relationship(back_populates="items", foreign_keys=[vendor_id])
    item: Mapped["InventoryItem"] = relationship(foreign_keys=[inventory_item_id])


# ─── Purchase requests ───────────────────────────────────────────

class PRStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONVERTED = "converted"


class PurchaseRequest(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "purchase_requests"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pr_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[PRStatus] = mapped_column(
        db_enum(PRStatus, name="pr_status"), default=PRStatus.DRAFT
    )
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    lines: Mapped[list["PurchaseRequestLine"]] = relationship(
        back_populates="purchase_request", cascade="all, delete-orphan"
    )


class PurchaseRequestLine(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "purchase_request_lines"

    purchase_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False
    )
    qty: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    required_by: Mapped[Date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    purchase_request: Mapped["PurchaseRequest"] = relationship(
        back_populates="lines", foreign_keys=[purchase_request_id]
    )
    item: Mapped["InventoryItem"] = relationship(foreign_keys=[inventory_item_id])


# ─── Purchase orders ─────────────────────────────────────────────

class POStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    CONFIRMED = "confirmed"
    PARTIAL = "partial"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class PurchaseOrder(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "purchase_orders"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    po_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[POStatus] = mapped_column(
        db_enum(POStatus, name="po_status"), default=POStatus.DRAFT
    )
    order_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expected_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    received_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    vendor: Mapped["Vendor"] = relationship(foreign_keys=[vendor_id])
    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )


class PurchaseOrderLine(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "purchase_order_lines"

    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False
    )
    qty: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    received_qty: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    purchase_order: Mapped["PurchaseOrder"] = relationship(
        back_populates="lines", foreign_keys=[purchase_order_id]
    )
    item: Mapped["InventoryItem"] = relationship(foreign_keys=[inventory_item_id])


# ─── Goods receipt notes ─────────────────────────────────────────

class GRNStatus(str, enum.Enum):
    DRAFT = "draft"
    RECEIVED = "received"
    QC_PASSED = "qc_passed"
    QC_FAILED = "qc_failed"
    CANCELLED = "cancelled"


class GoodsReceiptNote(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "goods_receipt_notes"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purchase_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True
    )
    grn_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[GRNStatus] = mapped_column(
        db_enum(GRNStatus, name="grn_status"), default=GRNStatus.DRAFT
    )
    received_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    received_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    invoice_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    qc_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    lines: Mapped[list["GoodsReceiptNoteLine"]] = relationship(
        back_populates="grn", cascade="all, delete-orphan"
    )


class GoodsReceiptNoteLine(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "goods_receipt_note_lines"

    grn_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goods_receipt_notes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purchase_order_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_order_lines.id", ondelete="SET NULL"), nullable=True
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False
    )
    ordered_qty: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    received_qty: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    accepted_qty: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    rejected_qty: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    batch_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expiry_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)

    grn: Mapped["GoodsReceiptNote"] = relationship(back_populates="lines", foreign_keys=[grn_id])
    item: Mapped["InventoryItem"] = relationship(foreign_keys=[inventory_item_id])


# ─── Vendor bills & payments ─────────────────────────────────────

class VendorBillStatus(str, enum.Enum):
    DRAFT = "draft"
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    CANCELLED = "cancelled"


class VendorBill(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "vendor_bills"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    grn_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goods_receipt_notes.id", ondelete="SET NULL"), nullable=True
    )
    bill_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[VendorBillStatus] = mapped_column(
        db_enum(VendorBillStatus, name="vendor_bill_status"), default=VendorBillStatus.UNPAID
    )
    bill_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    due_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    vendor: Mapped["Vendor"] = relationship(foreign_keys=[vendor_id])
    lines: Mapped[list["VendorBillLine"]] = relationship(
        back_populates="vendor_bill", cascade="all, delete-orphan"
    )


class VendorBillLine(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "vendor_bill_lines"

    vendor_bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendor_bills.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True
    )
    qty: Mapped[float] = mapped_column(Numeric(12, 4), default=0)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id", ondelete="SET NULL"), nullable=True
    )
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    vendor_bill: Mapped["VendorBill"] = relationship(back_populates="lines", foreign_keys=[vendor_bill_id])


class VendorPayment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "vendor_payments"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendor_bills.id", ondelete="SET NULL"), nullable=True
    )
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(30), default="bank_transfer")
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    paid_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    paid_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
