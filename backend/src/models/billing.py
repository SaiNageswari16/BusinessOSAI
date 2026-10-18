import enum
import uuid

from sqlalchemy import (
    Boolean,
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


# ─── Tax codes ───────────────────────────────────────────────────

class TaxCode(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tax_codes"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_tax_code"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tax_type: Mapped[str] = mapped_column(String(20), default="GST")  # GST|VAT|NONE
    cgst_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    sgst_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    igst_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    cess_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ─── Bills ───────────────────────────────────────────────────────

class BillStatus(str, enum.Enum):
    DRAFT = "draft"
    SETTLED = "settled"
    VOID = "void"
    REFUNDED = "refunded"


class Bill(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "bills"
    __table_args__ = (
        Index("ix_bills_outlet_settled", "outlet_id", "settled_at"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    bill_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    cashier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    waiter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    customer_gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)

    covers: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[BillStatus] = mapped_column(
        db_enum(BillStatus, name="bill_status"), default=BillStatus.DRAFT, index=True
    )

    # Money — Numeric(12,2), Decimal arithmetic in the service layer
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

    settled_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    void_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    outlet: Mapped["Outlet"] = relationship(foreign_keys=[outlet_id])
    order: Mapped["Order | None"] = relationship(foreign_keys=[order_id])
    items: Mapped[list["BillItem"]] = relationship(
        back_populates="bill", cascade="all, delete-orphan"
    )
    payments: Mapped[list["BillPayment"]] = relationship(
        back_populates="bill", cascade="all, delete-orphan"
    )


class BillItem(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "bill_items"

    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="SET NULL"), nullable=True
    )
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    variant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    discount_pct: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    tax_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tax_codes.id", ondelete="SET NULL"), nullable=True
    )
    hsn_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tax_pct: Mapped[float] = mapped_column(Numeric(6, 2), default=0)
    cgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    sgst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    igst: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    cess: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    bill: Mapped["Bill"] = relationship(back_populates="items", foreign_keys=[bill_id])


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


class BillPayment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "bill_payments"
    __table_args__ = (
        Index("ix_bill_payments_bill", "bill_id", "status"),
    )

    bill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True
    )
    method: Mapped[PaymentMethod] = mapped_column(
        db_enum(PaymentMethod, name="payment_method"), nullable=False, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gateway: Mapped[str | None] = mapped_column(String(50), nullable=True)
    gateway_txn_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(
        db_enum(PaymentStatus, name="payment_status"), default=PaymentStatus.SUCCESS
    )
    card_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    card_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    upi_vpa: Mapped[str | None] = mapped_column(String(100), nullable=True)
    refunded_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    refunded_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Guards against double-processing on retry
    idempotency_key: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)

    bill: Mapped["Bill"] = relationship(back_populates="payments", foreign_keys=[bill_id])


# ─── Discounts & promotions ──────────────────────────────────────

class DiscountType(str, enum.Enum):
    PERCENT = "percent"
    FLAT = "flat"
    BOGO = "bogo"
    FREE_ITEM = "free_item"


class Discount(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "discounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_discount_code"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[DiscountType] = mapped_column(
        db_enum(DiscountType, name="discount_type"), default=DiscountType.PERCENT
    )
    value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    max_discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    applies_to: Mapped[str] = mapped_column(String(20), default="CART")  # CART|ITEM|CATEGORY
    scope: Mapped[list] = mapped_column(JSONB, default=list)  # item / category ids

    min_order_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uses_count: Mapped[int] = mapped_column(Integer, default=0)
    per_customer_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)

    valid_from: Mapped[str | None] = mapped_column(String(50), nullable=True)
    valid_to: Mapped[str | None] = mapped_column(String(50), nullable=True)
    days_of_week: Mapped[list] = mapped_column(JSONB, default=list)
    time_from: Mapped[str | None] = mapped_column(String(5), nullable=True)
    time_to: Mapped[str | None] = mapped_column(String(5), nullable=True)

    requires_approval_above: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class DiscountUsage(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "discount_usages"

    discount_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("discounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bills.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    amount_discounted: Mapped[float] = mapped_column(Numeric(12, 2), default=0)


class Coupon(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "coupons"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_coupon_code"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[DiscountType] = mapped_column(
        db_enum(DiscountType, name="coupon_discount_type"), default=DiscountType.PERCENT
    )
    value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    max_discount_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    min_order_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    valid_from: Mapped[str | None] = mapped_column(String(50), nullable=True)
    valid_to: Mapped[str | None] = mapped_column(String(50), nullable=True)
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uses_count: Mapped[int] = mapped_column(Integer, default=0)
    is_single_use: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ServiceChargeConfig(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "service_charge_configs"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    pct: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    applies_to: Mapped[str] = mapped_column(String(30), default="subtotal_after_discount")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class TipConfig(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tip_configs"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    suggested_pcts: Mapped[list] = mapped_column(JSONB, default=lambda: [5, 10, 15])
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
