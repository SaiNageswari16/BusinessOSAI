"""Billing service models — bills, payments, tax, discounts, coupons, tips.

Owns ``restaurantos_billing``. Cross-service columns carry NO foreign key:

  * ``outlet_id``  — organization service
  * ``order_id``   — pos service
  * ``order_item_id`` — pos service
  * ``menu_item_id``  — menu service
  * ``customer_id``   — crm service
  * ``shift_id``      — organization service
  * ``cashier_id`` / ``waiter_id`` / ``user_id`` — auth service

Only ``bill_items``, ``bill_payments`` and ``discount_usages`` hold real
foreign keys, and only to tables that live here. That is the whole reason the
kitchen service exists as a separate database rather than sharing pos's: a
foreign key between two services is a hard runtime coupling, not a reference.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
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
ServiceBase = service_base("billing")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BillStatus(str, enum.Enum):
    DRAFT = "draft"
    SETTLED = "settled"
    VOID = "void"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    WALLET = "wallet"
    CREDIT = "credit"
    GIFT_CARD = "gift_card"
    AGGREGATOR_PAID = "aggregator_paid"
    ONLINE = "online"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"


class DiscountType(str, enum.Enum):
    PERCENT = "percent"
    FLAT = "flat"
    BOGO = "bogo"
    FREE_ITEM = "free_item"


def status_value(value: object) -> str:
    """Plain string for a status field, however it was obtained.

    Status columns are ``String``, not ``Enum``: a value just assigned in
    Python is the enum member, but the same field loaded back from Postgres is
    a plain ``str``. Members subclass ``str``, so equality works either way —
    ``bill.status != BillStatus.CANCELLED`` is correct for both. Only
    ``.value`` is member-specific, and calling it on a loaded row raises
    AttributeError. This accessor is the one that always works.
    """
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    """Timestamps set application-side, not by the DB.

    A server_default/onupdate function makes SQLAlchemy re-SELECT the row to
    learn the value. That lazy load lands outside the request's async context
    and fails as MissingGreenlet when Pydantic serialises the response, so the
    values are generated in Python instead.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class TaxCode(ServiceBase, TimestampMixin):
    """Tax rate definitions.

    Kept in billing rather than organization because the rates exist to
    compute a bill. The POS stores only a ``tax_code_id`` reference on each
    line and the amount it was charged, so a rate change later does not rewrite
    what was actually billed.
    """

    __tablename__ = "tax_codes"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_billing_tax_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tax_type: Mapped[str] = mapped_column(String(20), default="GST")
    cgst_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    sgst_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    igst_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    cess_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Bill(ServiceBase, TimestampMixin):
    __tablename__ = "bills"
    __table_args__ = (
        Index("ix_billing_bills_outlet_settled", "outlet_id", "settled_at"),
        UniqueConstraint("tenant_id", "bill_number", name="uq_billing_tenant_bill_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    order_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bill_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    cashier_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    waiter_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(
        String(30), nullable=True, index=True
    )
    customer_gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)

    covers: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[BillStatus] = mapped_column(
        String(20), default=BillStatus.DRAFT, index=True
    )

    # Money. Decimal arithmetic in the service layer, always.
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    taxable_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cgst_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sgst_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    igst_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cess_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    service_charge: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    service_charge_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    packaging_charge: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tip: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    round_off: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    change_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    is_credit_sale: Mapped[bool] = mapped_column(Boolean, default=False)

    # e-Invoice
    gst_invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    irn: Mapped[str | None] = mapped_column(String(100), nullable=True)
    irn_status: Mapped[str | None] = mapped_column(String(30), nullable=True)

    settled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    void_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # No ForeignKey on bill_id, so joins must be named explicitly.
    items: Mapped[list["BillItem"]] = relationship(
        back_populates="bill",
        primaryjoin="Bill.id == BillItem.bill_id",
        foreign_keys="BillItem.bill_id",
        cascade="all, delete-orphan",
    )
    payments: Mapped[list["BillPayment"]] = relationship(
        back_populates="bill",
        primaryjoin="Bill.id == BillPayment.bill_id",
        foreign_keys="BillPayment.bill_id",
        cascade="all, delete-orphan",
    )


class BillItem(ServiceBase, TimestampMixin):
    __tablename__ = "bill_items"
    __table_args__ = (
        Index("ix_billing_bill_items_bill", "bill_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Snapshots so the bill survives order and menu edits.
    order_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    variant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    discount_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    tax_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    cgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    igst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cess: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    bill: Mapped["Bill"] = relationship(
        back_populates="items",
        primaryjoin="BillItem.bill_id == Bill.id",
        foreign_keys="BillItem.bill_id",
    )


class BillPayment(ServiceBase, TimestampMixin):
    __tablename__ = "bill_payments"
    __table_args__ = (
        Index("ix_billing_bill_payments_bill", "bill_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    method: Mapped[PaymentMethod] = mapped_column(
        String(30), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gateway: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gateway_txn_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(
        String(20), default=PaymentStatus.SUCCESS, index=True
    )
    card_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    card_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    upi_vpa: Mapped[str | None] = mapped_column(String(100), nullable=True)
    refunded_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    refunded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Guards against double-processing when a gateway callback is retried.
    idempotency_key: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )

    bill: Mapped["Bill"] = relationship(
        back_populates="payments",
        primaryjoin="BillPayment.bill_id == Bill.id",
        foreign_keys="BillPayment.bill_id",
    )


class Discount(ServiceBase, TimestampMixin):
    __tablename__ = "discounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_billing_discount_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[DiscountType] = mapped_column(
        String(20), default=DiscountType.PERCENT
    )
    value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    max_discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    applies_to: Mapped[str] = mapped_column(String(20), default="CART")
    scope: Mapped[list] = mapped_column(JSONB, default=list)

    min_order_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uses_count: Mapped[int] = mapped_column(Integer, default=0)
    per_customer_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    valid_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    days_of_week: Mapped[list] = mapped_column(JSONB, default=list)
    time_from: Mapped[str | None] = mapped_column(String(5), nullable=True)
    time_to: Mapped[str | None] = mapped_column(String(5), nullable=True)

    requires_approval_above: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class DiscountUsage(ServiceBase, TimestampMixin):
    """Audit record of one discount application, for per-customer limits."""

    __tablename__ = "discount_usages"
    __table_args__ = (
        Index("ix_billing_discount_usages_discount", "discount_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    discount_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    amount_discounted: Mapped[float] = mapped_column(Numeric(12, 2), default=0)


class Coupon(ServiceBase, TimestampMixin):
    __tablename__ = "coupons"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_billing_coupon_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[DiscountType] = mapped_column(
        String(20), default=DiscountType.PERCENT
    )
    value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    max_discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    min_order_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    valid_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uses_count: Mapped[int] = mapped_column(Integer, default=0)
    is_single_use: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ServiceChargeConfig(ServiceBase, TimestampMixin):
    __tablename__ = "service_charge_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    pct: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    applies_to: Mapped[str] = mapped_column(
        String(30), default="subtotal_after_discount"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class TipConfig(ServiceBase, TimestampMixin):
    __tablename__ = "tip_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    suggested_pcts: Mapped[list] = mapped_column(
        JSONB, default=lambda: [5, 10, 15]
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class ShiftStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class CashMovementType(str, enum.Enum):
    PAID_IN = "paid_in"
    PAID_OUT = "paid_out"
    DROP = "drop"
    PICKUP = "pickup"


class Shift(ServiceBase, TimestampMixin):
    """A cashier's working session with a register float.

    Lives in billing rather than staff because the float is money the
    register holds, not a roster. Staff owns who worked; billing owns what the
    drawer contained and whether it reconciled.

    ``denominations`` is a JSONB count of notes and coins (e.g.
    {"500": 2, "100": 5, "20": 3}). Counting denominations at close is what
    turns "the drawer says 4,200" into "the cash physically present is 4,180" —
    without the count, a shortage cannot be distinguished from a counting slip.
    """

    __tablename__ = "shifts"
    __table_args__ = (
        Index("ix_billing_shifts_outlet_status", "outlet_id", "status"),
        UniqueConstraint("tenant_id", "shift_number", name="uq_billing_shift_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # Outlets and users live in other services: bare UUIDs.
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    shift_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    shift_type: Mapped[str] = mapped_column(String(20), default="MORNING")
    status: Mapped[ShiftStatus] = mapped_column(
        String(20), default=ShiftStatus.OPEN, index=True
    )

    opening_cash: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    closing_cash_expected: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    closing_cash_actual: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    discrepancy: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    discrepancy_approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    denominations: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    discrepancy_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # No ForeignKey on shift_id, so the join is named explicitly.
    cash_movements: Mapped[list["ShiftCashMovement"]] = relationship(
        back_populates="shift",
        primaryjoin="Shift.id == ShiftCashMovement.shift_id",
        foreign_keys="ShiftCashMovement.shift_id",
        cascade="all, delete-orphan",
    )


class ShiftCashMovement(ServiceBase, TimestampMixin):
    """Cash in or out of the drawer during a shift.

    Drops and pickups change the drawer without changing the business: a drop is
    moving excess cash into safe custody, a pickup replenishes the float. Those
    are recorded here so the closing reconciliation can explain a cash balance
    that is correct but not where it started.
    """

    __tablename__ = "shift_cash_movements"
    __table_args__ = (
        Index("ix_billing_shift_cash_movements_shift", "shift_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    shift_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    movement_type: Mapped[CashMovementType] = mapped_column(
        String(20), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    shift: Mapped["Shift"] = relationship(
        back_populates="cash_movements",
        primaryjoin="ShiftCashMovement.shift_id == Shift.id",
        foreign_keys="ShiftCashMovement.shift_id",
    )


class NumberCounter(ServiceBase, TimestampMixin):
    """Per-outlet bill number counter.

    Same shape as pos and kitchen: this service owns its bill sequence and
    cannot read the organization service's series table.
    """

    __tablename__ = "billing_number_counters"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_billing_counter_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    # e.g. "bill:<outlet_id>:2026-10"
    key: Mapped[str] = mapped_column(String(160), nullable=False)
    prefix: Mapped[str] = mapped_column(String(40), nullable=False)
    next_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
