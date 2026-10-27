"""Purchase service models — the full Procure-to-Pay cycle.

Owns ``restaurantos_purchase``. Cross-service columns carry NO foreign key:

  * ``outlet_id``          — organization service
  * ``user_id``/``*_by``   — auth service
  * ``inventory_item_id``  — inventory service
  * ``uom_id``             — organization service (units of measure)

``inventory_item_id`` being a bare UUID is the important one: an inventory item
is the thing being bought, and it lives in another service. A FK here would
reach across a database boundary.

Real FKs exist only between tables in this file — e.g. PO header -> PO lines.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
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

from src.services.shared.service_db import service_base

# This service's own base, not the shared ServiceBase. See service_db.
ServiceBase = service_base("purchase")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class VendorType(str, enum.Enum):
    INGREDIENT = "ingredient"
    BEVERAGE = "beverage"
    PACKAGING = "packaging"
    SERVICE = "service"
    EQUIPMENT = "equipment"


class PRStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONVERTED = "converted"


class POStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    CONFIRMED = "confirmed"
    PARTIAL = "partial"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class GRNStatus(str, enum.Enum):
    DRAFT = "draft"
    RECEIVED = "received"
    QC_PASSED = "qc_passed"
    QC_FAILED = "qc_failed"
    CANCELLED = "cancelled"


class VendorBillStatus(str, enum.Enum):
    DRAFT = "draft"
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    PAID = "paid"
    FAILED = "failed"


class PaymentMode(str, enum.Enum):
    BANK_TRANSFER = "bank_transfer"
    UPI = "upi"
    CHEQUE = "cheque"
    CASH = "cash"
    EMI = "emi"


def status_value(value: object) -> str:
    """Plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Only ``.value`` is member-specific, so calling it on a
    loaded row raises AttributeError.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    Python callables for both: a *server* default makes SQLAlchemy re-SELECT the
    row to learn the value, and that lazy read lands outside the request's async
    context, failing as MissingGreenlet during Pydantic serialisation.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


# ─── Vendors ─────────────────────────────────────────────────────────────────

class Vendor(ServiceBase, TimestampMixin):
    __tablename__ = "vendors"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_purchase_vendor_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    vendor_type: Mapped[VendorType] = mapped_column(
        String(30), default=VendorType.INGREDIENT
    )
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Net days of credit, e.g. 30. Drives when a bill is due.
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    last_price: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class VendorItem(ServiceBase, TimestampMixin):
    """A price agreed with a vendor for one inventory item.

    This is the source of truth for "what does this ingredient cost from this
    vendor", and it feeds the PO total. Held per vendor so the same item can
    cost different amounts depending on who supplies it.
    """

    __tablename__ = "vendor_items"
    __table_args__ = (
        UniqueConstraint("vendor_id", "inventory_item_id",
                         name="uq_vendor_item"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    uom_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    last_purchase_price: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    suggested_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ─── Purchase requests ───────────────────────────────────────────────────────

class PurchaseRequest(ServiceBase, TimestampMixin):
    """A request to buy something, raised before a PO is committed.

    Kept separate from the PO so that "someone noticed we're out" is
    distinguishable from "we have committed money to this vendor". The PR is
    what a stockout triggers; approving it converts it into a PO.
    """

    __tablename__ = "purchase_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    pr_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[PRStatus] = mapped_column(
        String(20), default=PRStatus.DRAFT, index=True
    )
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # No ForeignKey on purchase_request_id, so the join is named explicitly.
    lines: Mapped[list["PurchaseRequestLine"]] = relationship(
        back_populates="purchase_request",
        primaryjoin="PurchaseRequest.id == PurchaseRequestLine.purchase_request_id",
        foreign_keys="PurchaseRequestLine.purchase_request_id",
        cascade="all, delete-orphan",
    )


class PurchaseRequestLine(ServiceBase, TimestampMixin):
    __tablename__ = "purchase_request_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    purchase_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_requests.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    uom_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    required_by: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    purchase_request: Mapped["PurchaseRequest"] = relationship(
        back_populates="lines",
        primaryjoin="PurchaseRequestLine.purchase_request_id == PurchaseRequest.id",
        foreign_keys="PurchaseRequestLine.purchase_request_id",
    )


# ─── Purchase orders ─────────────────────────────────────────────────────────

class PurchaseOrder(ServiceBase, TimestampMixin):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    pr_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_requests.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    po_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[POStatus] = mapped_column(
        String(20), default=POStatus.DRAFT, index=True
    )
    order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    received_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="purchase_order",
        primaryjoin="PurchaseOrder.id == PurchaseOrderLine.purchase_order_id",
        foreign_keys="PurchaseOrderLine.purchase_order_id",
        cascade="all, delete-orphan",
    )


class PurchaseOrderLine(ServiceBase, TimestampMixin):
    __tablename__ = "purchase_order_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    uom_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    ordered_qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    received_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship(
        back_populates="lines",
        primaryjoin="PurchaseOrderLine.purchase_order_id == PurchaseOrder.id",
        foreign_keys="PurchaseOrderLine.purchase_order_id",
    )


# ─── Goods receipt notes ─────────────────────────────────────────────────────

class GoodsReceiptNote(ServiceBase, TimestampMixin):
    """The physical receipt of a PO.

    This is the gate between "we ordered" and "we have it". Posting a GRN is
    what emits ``grn.posted``, which is what tells inventory to add stock.
    Without a GRN there is no authorised entry into the store — a delivery that
    never gets received is not ours.
    """

    __tablename__ = "goods_receipt_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    po_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    grn_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[GRNStatus] = mapped_column(
        String(20), default=GRNStatus.DRAFT, index=True
    )
    received_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    received_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    lines: Mapped[list["GRNLine"]] = relationship(
        back_populates="grn",
        primaryjoin="GoodsReceiptNote.id == GRNLine.grn_id",
        foreign_keys="GRNLine.grn_id",
        cascade="all, delete-orphan",
    )


class GRNLine(ServiceBase, TimestampMixin):
    __tablename__ = "grn_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    grn_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goods_receipt_notes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    po_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_order_lines.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    uom_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    received_qty: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    accepted_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    rejected_qty: Mapped[float] = mapped_column(Numeric(14, 4), default=0)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    batch_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    grn: Mapped["GoodsReceiptNote"] = relationship(
        back_populates="lines",
        primaryjoin="GRNLine.grn_id == GoodsReceiptNote.id",
        foreign_keys="GRNLine.grn_id",
    )


# ─── Vendor bills & payments ─────────────────────────────────────────────────

class VendorBill(ServiceBase, TimestampMixin):
    """What we owe a vendor, normally raised from a GRN.

    Billed on what was *accepted*, not what was received: rejected goods are
    not ours to pay for. The link from a bill back to a GRN is what makes the
    "we paid for what we actually got" check possible at month end.
    """

    __tablename__ = "vendor_bills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    grn_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("goods_receipt_notes.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    bill_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[VendorBillStatus] = mapped_column(
        String(20), default=VendorBillStatus.DRAFT, index=True
    )
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    balance: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    payments: Mapped[list["VendorPayment"]] = relationship(
        back_populates="bill",
        primaryjoin="VendorBill.id == VendorPayment.bill_id",
        foreign_keys="VendorPayment.bill_id",
        cascade="all, delete-orphan",
    )


class VendorPayment(ServiceBase, TimestampMixin):
    __tablename__ = "vendor_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendor_bills.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    payment_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[PaymentStatus] = mapped_column(
        String(20), default=PaymentStatus.PENDING, index=True
    )
    mode: Mapped[PaymentMode] = mapped_column(
        String(30), default=PaymentMode.BANK_TRANSFER
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    paid_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    bill: Mapped["VendorBill"] = relationship(
        back_populates="payments",
        primaryjoin="VendorPayment.bill_id == VendorBill.id",
        foreign_keys="VendorPayment.bill_id",
    )


class ConsumedEvent(ServiceBase, TimestampMixin):
    """Durable idempotency ledger — one row per event this service consumed.

    Written by the bus's consumer loop via the installed dedupe ledger
    (``src.services.event_bus.dedupe``), so a redelivered event whose
    event_id is already here is skipped even after a process restart. The
    in-memory dedupe gate in ``EventBus`` alone is not restart-safe; this
    table closes that gap.

    ``event_id`` is the primary key — a redelivery with the same event_id
    is a no-op insert (``ON CONFLICT DO NOTHING``), which is exactly the
    check-then-mark primitive the dedupe helper needs.
    """

    __tablename__ = "consumed_events"

    event_id: Mapped[str] = mapped_column(
        String(64), primary_key=True
    )
    type: Mapped[str] = mapped_column(
        String(120), nullable=False, default="", index=True
    )
    consumed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox row — one per event this service would emit.

    Written in the same transaction as the domain change so the two commit
    or roll back together. A relay marks rows published or dead; pending rows
    are what the relay keeps picking up on crash-recovery. ``event_id`` is
    the bus dedupe key, so a re-delivered event is a no-op on the consumer
    side even if the relay over-publishes it.

    Status transitions: pending -> published (relay succeeded) / dead (retries
    exhausted).
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="purchase")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
