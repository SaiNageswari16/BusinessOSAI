"""Accounting service models — Chart of accounts, journal entries, day-close, GST.

Owns ``restaurantos_accounting``. Zero foreign keys cross service boundaries:
  * ``outlet_id`` — organization service
  * ``shift_id``  — billing service
  * ``posted_by`` / ``closed_by`` — auth service
Only ``journal_entry_lines`` holds foreign keys, and only to tables here.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

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

ServiceBase = service_base("accounting")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    REVERSED = "reversed"


class DayCloseStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    RECONCILED = "reconciled"


class WithdrawalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PaymentMode(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    BANK = "BANK"
    UPI = "UPI"


class WithdrawalMethod(str, enum.Enum):
    CASH = "CASH"
    BANK = "BANK"
    UPI = "UPI"
    CHEQUE = "CHEQUE"


def status_value(value: object) -> str:
    return value.value if isinstance(value, enum.Enum) else str(value)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class ChartOfAccount(ServiceBase, TimestampMixin):
    __tablename__ = "chart_of_accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_accounting_tenant_coa_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(String(30), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class JournalEntry(ServiceBase, TimestampMixin):
    __tablename__ = "journal_entries"
    __table_args__ = (
        Index("ix_accounting_je_tenant_outlet", "tenant_id", "outlet_id"),
        UniqueConstraint("tenant_id", "entry_number", name="uq_accounting_tenant_entry_no"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    entry_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    narration: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[JournalEntryStatus] = mapped_column(
        String(30), default=JournalEntryStatus.DRAFT, index=True
    )
    posted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    lines: Mapped[list["JournalEntryLine"]] = relationship(
        back_populates="journal_entry",
        primaryjoin="JournalEntry.id == JournalEntryLine.journal_entry_id",
        foreign_keys="JournalEntryLine.journal_entry_id",
        cascade="all, delete-orphan",
    )


class JournalEntryLine(ServiceBase, TimestampMixin):
    __tablename__ = "journal_entry_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    journal_entry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    debit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    credit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)

    journal_entry: Mapped["JournalEntry"] = relationship(
        back_populates="lines",
        primaryjoin="JournalEntryLine.journal_entry_id == JournalEntry.id",
        foreign_keys="JournalEntryLine.journal_entry_id",
    )
    account: Mapped["ChartOfAccount"] = relationship(
        primaryjoin="JournalEntryLine.account_id == ChartOfAccount.id",
        foreign_keys="JournalEntryLine.account_id",
    )


class ConsumedEvent(ServiceBase, TimestampMixin):
    """Durable idempotency ledger — one row per event this service consumed.

    Written by the bus's consumer loop via the installed dedupe ledger
    (``src.services.event_bus.dedupe``), so a redelivered event whose
    event_id is already here is skipped even after a process restart.
    Accounting auto-posts journals on ``bill.paid`` — a redelivered payment
    must not double-post to the GL.
    """

    __tablename__ = "consumed_events"

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(120), nullable=False, default="", index=True)
    consumed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


class DayClose(ServiceBase, TimestampMixin):
    __tablename__ = "day_closes"
    __table_args__ = (
        UniqueConstraint("outlet_id", "close_date", name="uq_accounting_outlet_close_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    shift_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    close_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[DayCloseStatus] = mapped_column(
        String(30), default=DayCloseStatus.OPEN, index=True
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

    closed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class GSTReturn(ServiceBase, TimestampMixin):
    __tablename__ = "gst_returns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    return_type: Mapped[str] = mapped_column(String(20), nullable=False)  # GSTR1|GSTR3B
    period: Mapped[str] = mapped_column(String(10), nullable=False)        # "2026-10"
    status: Mapped[str] = mapped_column(String(30), default="draft")
    total_taxable_value: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_cgst: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_sgst: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_igst: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_cess: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    filed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    arn: Mapped[str | None] = mapped_column(String(50), nullable=True)


class TaxPayment(ServiceBase, TimestampMixin):
    __tablename__ = "tax_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    tax_type: Mapped[str] = mapped_column(String(30), nullable=False)      # GST|TDS|ADVANCE_TAX
    period: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    challan_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    paid_at: Mapped[str | None] = mapped_column(String(50), nullable=True)


# ─── Bank ─────────────────────────────────────────────────────────────────────


class BankAccount(ServiceBase, TimestampMixin):
    __tablename__ = "bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_number: Mapped[str] = mapped_column(String(50), nullable=False)
    ifsc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(200), nullable=True)
    balance_snapshot: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class BankReconciliation(ServiceBase, TimestampMixin):
    """Period bank reconciliation against account 1010 (Bank Account).

    ``bank_account_id`` FKs this service's own ``bank_accounts`` table — the
    only FKs in this service.
    """
    __tablename__ = "bank_reconciliations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    bank_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    matched_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    unmatched_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    status: Mapped[str] = mapped_column(String(30), default="open", nullable=False, index=True)
    reconciled_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


# ─── Fixed assets ─────────────────────────────────────────────────────────────


class FixedAssetCategory(ServiceBase, TimestampMixin):
    __tablename__ = "fixed_asset_categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_accounting_tenant_fa_category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    useful_life_years: Mapped[int] = mapped_column(Integer, default=5)


class FixedAsset(ServiceBase, TimestampMixin):
    __tablename__ = "fixed_assets"
    __table_args__ = (
        UniqueConstraint("tenant_id", "asset_code", name="uq_accounting_tenant_fa_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fixed_asset_categories.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    purchase_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    useful_life_years: Mapped[int] = mapped_column(Integer, default=5)
    salvage_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    accumulated_depreciation: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    disposal_status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, index=True  # active|disposed
    )

    category: Mapped[FixedAssetCategory | None] = relationship(
        primaryjoin="FixedAsset.category_id == FixedAssetCategory.id",
        foreign_keys="FixedAsset.category_id",
    )


# ─── Budgets ────────────────────────────────────────────────────────────────


class Budget(ServiceBase, TimestampMixin):
    """Monthly budget per outlet/department; actuals accumulate via postings."""
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "outlet_id", "department_or_module", "period_month", "period_year",
            name="uq_accounting_tenant_budget_period",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    department_or_module: Mapped[str] = mapped_column(String(100), nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    budgeted: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    actual: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))

    @property
    def variance(self) -> Decimal:
        return _m(self.budgeted) - _m(self.actual)

    @property
    def is_over_budget(self) -> bool:
        return self.actual > self.budgeted


def _m(value) -> Decimal:
    """Best-effort Decimal coercion used by Budget's properties."""
    if value is None:
        return Decimal("0.00")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


# ─── Expense claims ─────────────────────────────────────────────────────────


class ExpenseClaim(ServiceBase, TimestampMixin):
    __tablename__ = "expense_claims"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    claimed_on: Mapped[date] = mapped_column(Date, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="submitted", nullable=False, index=True
    )  # submitted|approved|rejected|reimbursed
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    lines: Mapped[list["ExpenseClaimLine"]] = relationship(
        back_populates="claim",
        primaryjoin="ExpenseClaim.id == ExpenseClaimLine.claim_id",
        foreign_keys="ExpenseClaimLine.claim_id",
        cascade="all, delete-orphan",
    )


class ExpenseClaimLine(ServiceBase, TimestampMixin):
    __tablename__ = "expense_claim_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    claim_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expense_claims.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)

    claim: Mapped["ExpenseClaim"] = relationship(
        back_populates="lines",
        primaryjoin="ExpenseClaimLine.claim_id == ExpenseClaim.id",
        foreign_keys="ExpenseClaimLine.claim_id",
    )
# ─── Operational expenses (distinct from staff expense-claims) ──────────────


class ExpenseCategory(ServiceBase, TimestampMixin):
    """An operational expense category, optionally mapped to a GL account.

    ``gl_account_code`` is a *code* into this service's own
    ``chart_of_accounts`` (no cross-service FK): when set, posting an expense
    debits that account; when unset the 5000-series default is used.
    """

    __tablename__ = "expense_categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_accounting_tenant_expense_category_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    gl_account_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Expense(ServiceBase, TimestampMixin):
    """An operational expense (a vendor bill paid out, not a staff claim).

    ``outlet_id`` — organization service (bare UUID, no FK). Posting creates a
    JournalEntry (Dr GL account / Cr cash or bank) and an ``expense.recorded``
    outbox row in the same transaction; ``posted`` tracks whether that happened.
    """

    __tablename__ = "expenses"
    __table_args__ = (
        UniqueConstraint("tenant_id", "expense_no", name="uq_accounting_tenant_expense_no"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    expense_no: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expense_categories.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    payment_mode: Mapped[PaymentMode] = mapped_column(String(10), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    paid_to: Mapped[str | None] = mapped_column(String(200), nullable=True)
    posted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    category: Mapped[ExpenseCategory | None] = relationship(
        primaryjoin="Expense.category_id == ExpenseCategory.id",
        foreign_keys="Expense.category_id",
    )


# ─── Withdrawals ─────────────────────────────────────────────────────────────


class Withdrawal(ServiceBase, TimestampMixin):
    """A cash/bank withdrawal request from an outlet.

    Money leaves on approval: a JournalEntry (Dr 1010 Bank / Cr 3000 Owner's
    Equity — an owner withdrawal) plus a ``withdrawal.recorded`` outbox row in
    the same transaction.
    """

    __tablename__ = "withdrawals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    method: Mapped[WithdrawalMethod] = mapped_column(String(10), nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[WithdrawalStatus] = mapped_column(
        String(20), default=WithdrawalStatus.PENDING, nullable=False, index=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


# ─── Currency book ───────────────────────────────────────────────────────────


class ExchangeRate(ServiceBase, TimestampMixin):
    """Tenant exchange rates for the multi-currency book.

    ``GET /exchange-rates/current`` resolves the latest row with
    ``effective_from <= today`` for the pair.
    """

    __tablename__ = "exchange_rates"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "from_currency", "to_currency", "effective_from",
            name="uq_accounting_tenant_fx_pair_effective",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    from_currency: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    to_currency: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# ─── Outbox ──────────────────────────────────────────────────────────────────
# Same shape as loyalty/billing OutboxMessage so the relay can drain it.


class OutboxMessage(ServiceBase, TimestampMixin):
    """Transactional outbox row — one per event this service publishes.

    Written in the same transaction as the domain change (expense/withdrawal
    postings) so the two commit or roll back together. A relay in main.py
    polls pending rows and pushes them to the event bus, guaranteeing the
    event is delivered even if this process crashes between commit and the
    bus publish.
    """

    __tablename__ = "outbox_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    type: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    source_service: Mapped[str] = mapped_column(String(50), default="accounting")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
