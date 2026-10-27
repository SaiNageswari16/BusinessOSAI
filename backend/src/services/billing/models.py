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

import asyncio
import contextlib
import enum
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

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

if TYPE_CHECKING:
    from src.services.shared.service_db import ServiceDatabase

logger = logging.getLogger("billing.outbox")

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


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox for bill events.

    Every event this service would have published is instead written to this
    table *inside the same transaction* as the bill change. A background
    relay (``billing/reelay.py``) polls for unpublished rows and pushes them
    to the event bus. This is what makes the event delivery atomic with the
    write: no commit without the message, no lost events on crash.

    Status transitions:
      pending -> published (relay succeeded)
      pending -> dead (retry count exceeded max)
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid
    )
    event_id: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="billing")
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
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


# ─── Invoice & receipt subsystem ───────────────────────────────────────────
#
# AR-side of money: a Bill is what the kitchen cooked and the POS charged; an
# Invoice is the document that leaves the building. ``bill_id`` links the two.
# Both tables live in this service's own database, so a real FK is allowed
# (same rule as bill_items: FKs only to tables owned here, never across
# service databases).

class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SETTLED = "settled"
    VOID = "void"
    REFUNDED = "refunded"
    PARTIAL = "partial"


class Invoice(ServiceBase, TimestampMixin):
    """An issued document (tax invoice, receipt, or credit note).

    All money is Decimal, settled paise-accurate; the API serialises to
    float. ``status`` is a String, not an Enum — a value just written in
    Python is an enum member, the same field loaded back is a bare str.
    """

    __tablename__ = "ar_invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", name="uq_billing_invoice_number"),
        Index("ix_billing_invoices_outlet_status", "outlet_id", "status"),
        Index("ix_billing_invoices_customer", "customer_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    invoice_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="tax_invoice"
    )
    # Same-database link to the POS bill that produced this document.
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    exchange_from_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )

    # Customer fields live in the crm service: bare UUID, no FK.
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    customer_gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)

    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    taxable_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cgst_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sgst_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    igst_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cess_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tds: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    round_off: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    status: Mapped[InvoiceStatus] = mapped_column(
        String(20), default=InvoiceStatus.DRAFT, index=True
    )

    is_reverse_charge: Mapped[bool] = mapped_column(Boolean, default=False)
    is_tax_inclusive: Mapped[bool] = mapped_column(Boolean, default=False)

    # e-invoice ready: IRN / ACK fill in when the e-invoicing call lands.
    irn_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ack_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    e_invoice_qr: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Journal entry in the accounting service: bare UUID, no FK.
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    print_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    dated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )

    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice",
        primaryjoin="Invoice.id == InvoiceLine.invoice_id",
        foreign_keys="InvoiceLine.invoice_id",
        cascade="all, delete-orphan",
    )
    payments: Mapped[list["InvoicePayment"]] = relationship(
        back_populates="invoice",
        primaryjoin="Invoice.id == InvoicePayment.invoice_id",
        foreign_keys="InvoicePayment.invoice_id",
        cascade="all, delete-orphan",
    )


class InvoiceLine(ServiceBase, TimestampMixin):
    """A snapshotted line on an invoice — survives menu and tax edits."""

    __tablename__ = "ar_invoice_lines"
    __table_args__ = (
        Index("ix_billing_invoice_lines_invoice", "invoice_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, default=1)
    # Menu items live in the menu service: bare UUID, no FK.
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    qty: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=1)
    unit: Mapped[str] = mapped_column(String(20), default="Nos")
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    cgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    igst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cess: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    invoice: Mapped["Invoice"] = relationship(
        back_populates="lines",
        primaryjoin="InvoiceLine.invoice_id == Invoice.id",
        foreign_keys="InvoiceLine.invoice_id",
    )


class InvoicePayment(ServiceBase, TimestampMixin):
    """One payment leg recorded against an invoice."""

    __tablename__ = "ar_invoice_payments"
    __table_args__ = (
        Index("ix_billing_invoice_payments_invoice", "invoice_id", "method"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    method: Mapped[str] = mapped_column(String(30), default="cash")
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    invoice: Mapped["Invoice"] = relationship(
        back_populates="payments",
        primaryjoin="InvoicePayment.invoice_id == Invoice.id",
        foreign_keys="InvoicePayment.invoice_id",
    )


class InvoiceReturnStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InvoiceReturn(ServiceBase, TimestampMixin):
    """A return (or exchange) against a settled invoice.

    Restaurant-side of a return is a refund, not an inventory restock — the
    food was served. Lines here are a snapshot of what came back.
    """

    __tablename__ = "ar_invoice_returns"
    __table_args__ = (
        Index("ix_billing_invoice_returns_invoice", "invoice_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    return_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    return_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    settlement_method: Mapped[str] = mapped_column(String(30), default="refund")
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[InvoiceReturnStatus] = mapped_column(
        String(20), default=InvoiceReturnStatus.COMPLETED, index=True
    )
    exchange_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    lines: Mapped[list["InvoiceReturnLine"]] = relationship(
        back_populates="return_doc",
        primaryjoin="InvoiceReturn.id == InvoiceReturnLine.return_id",
        foreign_keys="InvoiceReturnLine.return_id",
        cascade="all, delete-orphan",
    )


class InvoiceReturnLine(ServiceBase, TimestampMixin):
    """A snapshot of one returned item on a sales return."""

    __tablename__ = "ar_invoice_return_lines"
    __table_args__ = (
        Index("ix_billing_return_lines_return", "return_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    return_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ar_invoice_returns.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    invoice_line_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    qty: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=1)
    unit: Mapped[str] = mapped_column(String(20), default="Nos")
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    disposition: Mapped[str | None] = mapped_column(String(50), nullable=True)

    return_doc: Mapped["InvoiceReturn"] = relationship(
        back_populates="lines",
        primaryjoin="InvoiceReturnLine.return_id == InvoiceReturn.id",
        foreign_keys="InvoiceReturnLine.return_id",
    )


class PrintTemplate(ServiceBase, TimestampMixin):
    """Named receipt / invoice / barcode layout, per outlet.

    ``outlet_id`` NULL means tenant-wide default. ``active`` marks the
    template used for the outlet's category; POST /print-template/active
    deactivates the siblings and flips the target.
    """

    __tablename__ = "print_templates"
    __table_args__ = (
        Index("ix_billing_print_templates_outlet_active", "outlet_id", "active", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(
        String(30), default="thermal", index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    paper_size: Mapped[str] = mapped_column(String(5), default="80mm")
    fields: Mapped[dict] = mapped_column(JSONB, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=False)


class ReminderPolicy(ServiceBase, TimestampMixin):
    """Payment-reminder cadence, one row per outlet (NULL = tenant default).

    The send-now / evaluate-batch endpoints are stubs until the notifications
    service lands; this row lets the frontend read/write the policy now so the
    later service picks up working settings.
    """

    __tablename__ = "reminder_policies"
    __table_args__ = (
        UniqueConstraint("tenant_id", "outlet_id", name="uq_billing_reminder_policy_outlet"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    policy: Mapped[dict] = mapped_column(
        JSONB, default=lambda: {"enabled": False, "channels": ["whatsapp"],
                                 "days_before_due": 3, "reminder_frequency_days": 1}
    )


class GatewayConfig(ServiceBase, TimestampMixin):
    """Payment gateway credentials, one row per (tenant, gateway, outlet).

    ``outlet_id`` NULL is the tenant-wide row; a row with an outlet wins when
    both exist. ``enabled`` reports whether usable key material is present —
    a stored key without a secret means the gateway cannot verify, and the
    verify endpoints return 501 GATEWAY_NOT_CONFIGURED rather than faking
    success.
    """

    __tablename__ = "gateway_configs"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "gateway", "outlet_id",
            name="uq_billing_gateway_config",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    gateway: Mapped[str] = mapped_column(String(30), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_test_mode: Mapped[bool] = mapped_column(Boolean, default=False)


class PaymentGatewayOrder(ServiceBase, TimestampMixin):
    """A gateway order created by /payments/razorpay/create-order.

    The order id is ours (rzp_<uuid>): without live gateway keys we cannot
    mint a real one, so the verify endpoint checks the signature against the
    stored row, which is also what makes a retried verify honest — a
    payment can only be "verified" for an order this service created.
    """

    __tablename__ = "payment_gateway_orders"
    __table_args__ = (
        UniqueConstraint("tenant_id", "order_id", name="uq_billing_gw_order"),
        Index("ix_billing_gw_orders_tenant_gateway", "tenant_id", "gateway"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    gateway: Mapped[str] = mapped_column(String(30), nullable=False, default="razorpay")
    order_id: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    status: Mapped[str] = mapped_column(String(20), default="created", index=True)
    payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[dict] = mapped_column(JSONB, default=dict)
