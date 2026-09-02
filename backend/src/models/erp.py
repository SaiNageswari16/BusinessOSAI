"""All ERP module models — Accounting, AR, Bank, Fixed Assets, Expenses, Vouchers, Tax."""
import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models import Company

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.base import Base, EntityStatus, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


# ═══════════════════════════════════════════════════════════════════
#  ENUMS
# ═══════════════════════════════════════════════════════════════════

class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    INCOME = "income"
    EXPENSE = "expense"


class AccountSubType(str, enum.Enum):
    CURRENT_ASSET = "current_asset"
    FIXED_ASSET = "fixed_asset"
    INVENTORY = "inventory"
    BANK = "bank"
    CASH = "cash"
    RECEIVABLE = "receivable"
    CURRENT_LIABILITY = "current_liability"
    PAYABLE = "payable"
    RETAINED_EARNINGS = "retained_earnings"
    SALES = "sales"
    OTHER_INCOME = "other_income"
    COGS = "cogs"
    OPERATING_EXPENSE = "operating_expense"
    OTHER_EXPENSE = "other_expense"
    TAX = "tax"


class EntryStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    VOIDED = "voided"
    REVERSED = "reversed"


class EntryType(str, enum.Enum):
    JOURNAL = "journal"
    RECEIPT = "receipt"
    PAYMENT = "payment"
    CONTRA = "contra"
    PURCHASE = "purchase"
    SALES = "sales"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    VOIDED = "voided"
    CANCELLED = "cancelled"


class InvoiceType(str, enum.Enum):
    TAX_INVOICE = "tax_invoice"
    PROFORMA = "proforma"
    ESTIMATE = "estimate"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"


class BankAccountStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    CLOSED = "closed"


class AssetStatus(str, enum.Enum):
    ACTIVE = "active"
    DISPOSED = "disposed"
    SOLD = "sold"
    SCRAPPED = "scrapped"
    UNDER_MAINTENANCE = "under_maintenance"


class DepreciationMethod(str, enum.Enum):
    STRAIGHT_LINE = "straight_line"
    DECLININING_BALANCE = "declining_balance"
    UNITS_OF_PRODUCTION = "units_of_production"
    NONE = "none"


class VoucherStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    POSTED = "posted"
    VOIDED = "voided"


class VoucherType(str, enum.Enum):
    RECEIPT = "receipt"
    PAYMENT = "payment"
    CONTRA = "contra"
    JOURNAL = "journal"


class ExpenseStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"
    CANCELLED = "cancelled"


# ═══════════════════════════════════════════════════════════════════
#  CHART OF ACCOUNTS
# ═══════════════════════════════════════════════════════════════════

class ChartOfAccount(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "chart_of_accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_coa_tenant_code"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType, name="account_type", create_constraint=False), nullable=False)
    account_sub_type: Mapped[AccountSubType | None] = mapped_column(Enum(AccountSubType, name="account_sub_type", create_constraint=False))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"))
    is_control_account: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    opening_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    opening_balance_date: Mapped[date | None] = mapped_column(Date)
    currency_code: Mapped[str | None] = mapped_column(String(10))
    allow_posting: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    parent: Mapped["ChartOfAccount | None"] = relationship(remote_side="ChartOfAccount.id", back_populates="children")
    children: Mapped[list["ChartOfAccount"]] = relationship(back_populates="parent")
    journal_lines: Mapped[list["JournalEntryLine"]] = relationship(back_populates="account")
    company: Mapped["Company | None"] = relationship()


# ═══════════════════════════════════════════════════════════════════
#  JOURNAL ENTRIES
# ═══════════════════════════════════════════════════════════════════

class JournalEntry(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "entry_number", name="uq_journal_entry_number"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    entry_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entry_type: Mapped[EntryType] = mapped_column(Enum(EntryType, name="entry_type", create_constraint=False), default=EntryType.JOURNAL)
    status: Mapped[EntryStatus] = mapped_column(Enum(EntryStatus, name="entry_status", create_constraint=False), default=EntryStatus.DRAFT)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    total_debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    currency_code: Mapped[str] = mapped_column(String(10), default="INR")
    exchange_rate: Mapped[float] = mapped_column(Numeric(12, 6), default=1)
    source_module: Mapped[str | None] = mapped_column(String(50))
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    posted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    reversed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reversed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    reverse_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))
    attachments: Mapped[list | None] = mapped_column(JSONB, default=list)

    lines: Mapped[list["JournalEntryLine"]] = relationship(back_populates="entry", cascade="all, delete-orphan")


class JournalEntryLine(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "journal_entry_lines"

    entry_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="RESTRICT"), nullable=False)
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id", ondelete="SET NULL"))
    description: Mapped[str | None] = mapped_column(Text)
    debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    currency_code: Mapped[str] = mapped_column(String(10), default="INR")
    exchange_rate: Mapped[float] = mapped_column(Numeric(12, 6), default=1)
    base_currency_debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    base_currency_credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    line_number: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    entry: Mapped["JournalEntry"] = relationship(back_populates="lines")
    account: Mapped["ChartOfAccount"] = relationship(back_populates="journal_lines")


class AccountBalance(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "account_balances"
    __table_args__ = (
        UniqueConstraint("tenant_id", "account_id", "period_start", name="uq_account_balance_period"),
    )

    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="CASCADE"), nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    fiscal_year_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fiscal_years.id", ondelete="SET NULL"))
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    opening_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    closing_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    currency_code: Mapped[str] = mapped_column(String(10), default="INR")

    account: Mapped["ChartOfAccount"] = relationship()


# ═══════════════════════════════════════════════════════════════════
#  ACCOUNTS RECEIVABLE — INVOICES
# ═══════════════════════════════════════════════════════════════════

class Invoice(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "ar_invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", name="uq_ar_invoice_number"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="SET NULL"))
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_email: Mapped[str | None] = mapped_column(String(255))
    customer_phone: Mapped[str | None] = mapped_column(String(30))
    customer_gstin: Mapped[str | None] = mapped_column(String(30))
    billing_address: Mapped[str | None] = mapped_column(Text)
    shipping_address: Mapped[str | None] = mapped_column(Text)

    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    invoice_type: Mapped[str] = mapped_column(String(50), default="tax_invoice")
    reference_number: Mapped[str | None] = mapped_column(String(100))
    order_number: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50), default="draft")

    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    service_from: Mapped[date | None] = mapped_column(Date)
    service_to: Mapped[date | None] = mapped_column(Date)

    payment_terms: Mapped[str | None] = mapped_column(String(100))
    currency_code: Mapped[str] = mapped_column(String(10), default="INR")
    exchange_rate: Mapped[float] = mapped_column(Numeric(12, 6), default=1)

    subtotal: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    discount_type: Mapped[str | None] = mapped_column(String(20))
    discount_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    cgst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    igst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    tds_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    round_off: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    balance_due: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    notes: Mapped[str | None] = mapped_column(Text)
    terms: Mapped[str | None] = mapped_column(Text)
    footer: Mapped[str | None] = mapped_column(Text)

    is_reverse_charge: Mapped[bool] = mapped_column(Boolean, default=False)
    irn_number: Mapped[str | None] = mapped_column(String(50))
    ack_number: Mapped[str | None] = mapped_column(String(50))
    ack_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    e_invoice_qr: Mapped[str | None] = mapped_column(Text)

    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))

    company: Mapped["Company | None"] = relationship()
    lines: Mapped[list["InvoiceLine"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["InvoicePayment"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    returns: Mapped[list["InvoiceReturn"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLine(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ar_invoice_lines"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, default=0)
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_sku: Mapped[str | None] = mapped_column(String(100))
    hsn_code: Mapped[str | None] = mapped_column(String(20))
    batch_number: Mapped[str | None] = mapped_column(String(100))
    expiry_date: Mapped[date | None] = mapped_column(Date)
    mfg_date: Mapped[date | None] = mapped_column(Date)
    mrp: Mapped[float | None] = mapped_column(Numeric(18, 2))
    description: Mapped[str | None] = mapped_column(Text)
    uom: Mapped[str | None] = mapped_column(String(30))
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    discount_type: Mapped[str | None] = mapped_column(String(20))
    discount_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    taxable_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    cgst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    igst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id", ondelete="SET NULL"))

    invoice: Mapped["Invoice"] = relationship(back_populates="lines")


class InvoicePayment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "ar_invoice_payments"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(100))
    bank_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    notes: Mapped[str | None] = mapped_column(Text)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class InvoiceReturn(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "ar_invoice_returns"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoices.id", ondelete="CASCADE"), nullable=False)
    return_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    status: Mapped[str] = mapped_column(String(30), default="processed")

    invoice: Mapped["Invoice"] = relationship(back_populates="returns")
    lines: Mapped[list["InvoiceReturnLine"]] = relationship(back_populates="invoice_return", cascade="all, delete-orphan")


class InvoiceReturnLine(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ar_invoice_return_lines"

    invoice_return_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ar_invoice_returns.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    unit_price: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    invoice_return: Mapped["InvoiceReturn"] = relationship(back_populates="lines")


# ═══════════════════════════════════════════════════════════════════
#  DELIVERY CHALLAN
# ═══════════════════════════════════════════════════════════════════

class DeliveryChallan(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "delivery_challans"

    invoice_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recipient_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    challan_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    challan_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft") # draft, dispatched, delivered, returned
    
    transporter_name: Mapped[str | None] = mapped_column(String(150))
    vehicle_number: Mapped[str | None] = mapped_column(String(50))
    waybill_number: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["DeliveryChallanItem"]] = relationship(back_populates="challan", cascade="all, delete-orphan")


class DeliveryChallanItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "delivery_challan_items"

    challan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("delivery_challans.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), default=0)
    uom: Mapped[str | None] = mapped_column(String(50))

    challan: Mapped["DeliveryChallan"] = relationship(back_populates="items")

# ═══════════════════════════════════════════════════════════════════
#  BANK MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

class BankAccount(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "bank_accounts"

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    chart_of_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    account_number: Mapped[str | None] = mapped_column(String(50))
    ifsc_code: Mapped[str | None] = mapped_column(String(20))
    bank_name: Mapped[str | None] = mapped_column(String(150))
    branch_name: Mapped[str | None] = mapped_column(String(150))
    account_type: Mapped[str] = mapped_column(String(30), default="checking")
    currency_code: Mapped[str] = mapped_column(String(10), default="INR")
    opening_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    opening_balance_date: Mapped[date | None] = mapped_column(Date)
    current_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    status: Mapped[BankAccountStatus] = mapped_column(Enum(BankAccountStatus, name="bank_account_status", create_constraint=False), default=BankAccountStatus.ACTIVE)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    transactions: Mapped[list["BankTransaction"]] = relationship(back_populates="bank_account", cascade="all, delete-orphan")
    reconciliations: Mapped[list["BankReconciliation"]] = relationship(back_populates="bank_account", cascade="all, delete-orphan")


class BankTransaction(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "bank_transactions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "bank_account_id", "transaction_date", "amount", "description", name="uq_bank_txn"),
    )

    bank_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    value_date: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(100))
    counterparty: Mapped[str | None] = mapped_column(String(255))
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    running_balance: Mapped[float | None] = mapped_column(Numeric(18, 2))
    is_reconciled: Mapped[bool] = mapped_column(Boolean, default=False)
    reconciled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reconciled_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    notes: Mapped[str | None] = mapped_column(Text)

    bank_account: Mapped["BankAccount"] = relationship(back_populates="transactions")


class BankReconciliation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "bank_reconciliations"

    bank_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    reconciliation_date: Mapped[date] = mapped_column(Date, nullable=False)
    statement_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    book_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    difference: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    status: Mapped[str] = mapped_column(String(30), default="in_progress")
    notes: Mapped[str | None] = mapped_column(Text)
    completed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    bank_account: Mapped["BankAccount"] = relationship(back_populates="reconciliations")
    items: Mapped[list["BankReconciliationItem"]] = relationship(back_populates="reconciliation", cascade="all, delete-orphan")


class BankReconciliationItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "bank_reconciliation_items"

    reconciliation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_reconciliations.id", ondelete="CASCADE"), nullable=False)
    bank_transaction_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_transactions.id", ondelete="SET NULL"))
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))
    is_matched: Mapped[bool] = mapped_column(Boolean, default=False)
    is_cleared: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)

    reconciliation: Mapped["BankReconciliation"] = relationship(back_populates="items")


# ═══════════════════════════════════════════════════════════════════
#  FIXED ASSETS
# ═══════════════════════════════════════════════════════════════════

class FixedAssetCategory(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "fa_categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_fa_category_name"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    asset_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"))
    depreciation_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"))
    expense_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"))
    useful_life_years: Mapped[int] = mapped_column(Integer, default=5)
    depreciation_method: Mapped[DepreciationMethod] = mapped_column(Enum(DepreciationMethod, name="depreciation_method", create_constraint=False), default=DepreciationMethod.STRAIGHT_LINE)
    salvage_value_percent: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    status: Mapped[EntityStatus] = mapped_column(Enum(EntityStatus, name="entity_status", create_constraint=False), default=EntityStatus.ACTIVE)


class FixedAsset(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "fa_assets"
    __table_args__ = (
        UniqueConstraint("tenant_id", "asset_number", name="uq_fa_asset_number"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fa_categories.id", ondelete="SET NULL"))
    asset_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    asset_type: Mapped[str] = mapped_column(String(50), default="other")
    location: Mapped[str | None] = mapped_column(String(200))
    custodian_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"))

    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    purchase_cost: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    accumulated_depreciation: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    net_book_value: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    salvage_value: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    useful_life_months: Mapped[int] = mapped_column(Integer, default=60)
    depreciation_method: Mapped[DepreciationMethod] = mapped_column(Enum(DepreciationMethod, name="depreciation_method", create_constraint=False), default=DepreciationMethod.STRAIGHT_LINE)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus, name="asset_status", create_constraint=False), default=AssetStatus.ACTIVE)

    purchase_journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))
    disposal_journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))
    chart_of_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"))

    depreciation_runs: Mapped[list["FixedAssetDepreciation"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


class FixedAssetDepreciation(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "fa_depreciations"

    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fa_assets.id", ondelete="CASCADE"), nullable=False)
    depreciation_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    depreciation_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    accumulated_after: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    net_book_value_after: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))
    posted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)

    asset: Mapped["FixedAsset"] = relationship(back_populates="depreciation_runs")


# ═══════════════════════════════════════════════════════════════════
#  PAYMENT VOUCHERS
# ═══════════════════════════════════════════════════════════════════

class PaymentVoucher(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "payment_vouchers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "voucher_number", name="uq_payment_voucher_number"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    voucher_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    voucher_type: Mapped[VoucherType] = mapped_column(Enum(VoucherType, name="voucher_type", create_constraint=False), default=VoucherType.PAYMENT)
    status: Mapped[VoucherStatus] = mapped_column(Enum(VoucherStatus, name="voucher_status", create_constraint=False), default=VoucherStatus.DRAFT)
    voucher_date: Mapped[date] = mapped_column(Date, nullable=False)
    payee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    payee_type: Mapped[str] = mapped_column(String(30))
    bank_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"))
    payment_method: Mapped[str | None] = mapped_column(String(50))
    reference_number: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    currency_code: Mapped[str] = mapped_column(String(10), default="INR")
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))

    lines: Mapped[list["PaymentVoucherLine"]] = relationship(back_populates="voucher", cascade="all, delete-orphan")


class PaymentVoucherLine(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "payment_voucher_lines"

    voucher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payment_vouchers.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="RESTRICT"), nullable=False)
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id", ondelete="SET NULL"))
    description: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    line_type: Mapped[str] = mapped_column(String(20), nullable=False)

    voucher: Mapped["PaymentVoucher"] = relationship(back_populates="lines")


# ═══════════════════════════════════════════════════════════════════
#  EXPENSE CLAIMS & BUDGETS
# ═══════════════════════════════════════════════════════════════════

class ExpenseClaim(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "expense_claims"
    __table_args__ = (
        UniqueConstraint("tenant_id", "claim_number", name="uq_expense_claim_number"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"))
    claim_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    claim_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    status: Mapped[ExpenseStatus] = mapped_column(Enum(ExpenseStatus, name="expense_status", create_constraint=False), default=ExpenseStatus.DRAFT)
    description: Mapped[str | None] = mapped_column(Text)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payment_journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    lines: Mapped[list["ExpenseClaimLine"]] = relationship(back_populates="claim", cascade="all, delete-orphan")


class ExpenseClaimLine(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "expense_claim_lines"

    claim_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("expense_claims.id", ondelete="CASCADE"), nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    receipt_url: Mapped[str | None] = mapped_column(String(500))
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id", ondelete="SET NULL"))

    claim: Mapped["ExpenseClaim"] = relationship(back_populates="lines")


class Budget(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("tenant_id", "company_id", "department_id", "cost_center_id", "fiscal_year_id", name="uq_budget_unique"),
    )

    company_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"))
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"))
    cost_center_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_centers.id", ondelete="SET NULL"))
    fiscal_year_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fiscal_years.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    budgeted_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    actual_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    variance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    variance_percent: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    status: Mapped[EntityStatus] = mapped_column(Enum(EntityStatus, name="entity_status", create_constraint=False), default=EntityStatus.ACTIVE)
    notes: Mapped[str | None] = mapped_column(Text)


# ═══════════════════════════════════════════════════════════════════
#  TAX MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

class TaxCode(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tax_codes"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_tax_code_tenant_code"),
    )

    code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    tax_type: Mapped[str] = mapped_column(String(50), nullable=False)
    rate_percent: Mapped[float] = mapped_column(Numeric(8, 4), default=0)
    is_reverse_charge: Mapped[bool] = mapped_column(Boolean, default=False)
    is_inclusive: Mapped[bool] = mapped_column(Boolean, default=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id", ondelete="SET NULL"))
    status: Mapped[EntityStatus] = mapped_column(Enum(EntityStatus, name="entity_status", create_constraint=False), default=EntityStatus.ACTIVE)


class TaxReturn(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tax_returns"

    return_type: Mapped[str] = mapped_column(String(50), nullable=False)
    period: Mapped[str] = mapped_column(String(20), nullable=False)
    period_start: Mapped[date | None] = mapped_column(Date)
    period_end: Mapped[date | None] = mapped_column(Date)
    total_taxable_value: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_tax_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    igst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    cgst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    tds_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    filed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    filed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    acknowledgment_number: Mapped[str | None] = mapped_column(String(50))
    reference_file_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)


class TaxPayment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "tax_payments"

    tax_return_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tax_returns.id", ondelete="SET NULL"))
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    tax_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), default="online")
    reference_number: Mapped[str | None] = mapped_column(String(100))
    challan_number: Mapped[str | None] = mapped_column(String(100))
    bank_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"))
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("journal_entries.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
