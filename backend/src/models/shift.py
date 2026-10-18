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


# ─── Shifts & cash ───────────────────────────────────────────────

class ShiftStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class Shift(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "shifts"
    __table_args__ = (
        Index("ix_shifts_outlet_status", "outlet_id", "status"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    shift_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    shift_type: Mapped[str] = mapped_column(String(20), default="MORNING")  # MORNING|EVENING|NIGHT

    status: Mapped[ShiftStatus] = mapped_column(
        db_enum(ShiftStatus, name="shift_status"), default=ShiftStatus.OPEN, index=True
    )

    opening_cash: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    closing_cash_expected: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    closing_cash_actual: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    discrepancy: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    discrepancy_approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    denominations: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    discrepancy_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    opened_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    closed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    closed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    cash_movements: Mapped[list["ShiftCashMovement"]] = relationship(
        back_populates="shift", cascade="all, delete-orphan"
    )


class CashMovementType(str, enum.Enum):
    PAID_IN = "paid_in"
    PAID_OUT = "paid_out"
    DROP = "drop"
    PICKUP = "pickup"


class ShiftCashMovement(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "shift_cash_movements"

    shift_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    movement_type: Mapped[CashMovementType] = mapped_column(
        db_enum(CashMovementType, name="cash_movement_type"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    shift: Mapped["Shift"] = relationship(back_populates="cash_movements", foreign_keys=[shift_id])


# ─── Day close ───────────────────────────────────────────────────

class DayCloseStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    RECONCILED = "reconciled"


class DayClose(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "day_closes"
    __table_args__ = (
        UniqueConstraint("outlet_id", "close_date", name="uq_outlet_close_date"),
    )

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shift_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True
    )
    close_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[DayCloseStatus] = mapped_column(
        db_enum(DayCloseStatus, name="day_close_status"), default=DayCloseStatus.OPEN
    )

    total_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    cash_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    card_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    upi_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    wallet_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    credit_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    aggregator_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    online_sales: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    total_discount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_tax: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_round_off: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    total_covers: Mapped[int] = mapped_column(Integer, default=0)
    avg_ticket: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    cash_expected: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    cash_actual: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    discrepancy: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    closed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    closed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# ─── Accounting ──────────────────────────────────────────────────

class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class ChartOfAccount(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "chart_of_accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tenant_coa_code"),
    )

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(
        db_enum(AccountType, name="account_type"), nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    REVERSED = "reversed"


class JournalEntry(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "journal_entries"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    entry_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entry_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    narration: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[JournalEntryStatus] = mapped_column(
        db_enum(JournalEntryStatus, name="journal_entry_status"), default=JournalEntryStatus.DRAFT
    )
    posted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    lines: Mapped[list["JournalEntryLine"]] = relationship(
        back_populates="journal_entry", cascade="all, delete-orphan"
    )


class JournalEntryLine(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "journal_entry_lines"

    journal_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="RESTRICT"), nullable=False
    )
    debit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    credit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines", foreign_keys=[journal_entry_id])
    account: Mapped["ChartOfAccount"] = relationship(foreign_keys=[account_id])


class GSTReturn(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "gst_returns"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    return_type: Mapped[str] = mapped_column(String(20), nullable=False)  # GSTR1|GSTR3B
    period: Mapped[str] = mapped_column(String(10), nullable=False)  # "2026-10"
    status: Mapped[str] = mapped_column(String(30), default="draft")  # draft|filed|amended
    total_taxable_value: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_cgst: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_sgst: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_igst: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_cess: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    filed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    arn: Mapped[str | None] = mapped_column(String(50), nullable=True)


class TaxPayment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tax_payments"

    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True
    )
    tax_type: Mapped[str] = mapped_column(String(30), nullable=False)
    period: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    challan_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    paid_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
