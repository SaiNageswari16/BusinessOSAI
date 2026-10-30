"""Accounting service schemas (Pydantic v2)."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from datetime import date as _date  # alias: classes with a field named "date" must reference the type via _date, or the field shadows it during annotation evaluation
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from src.services.accounting.models import (
    AccountType,
    DayCloseStatus,
    JournalEntryStatus,
    PaymentMode,
    WithdrawalMethod,
    WithdrawalStatus,
)


class ChartOfAccountBase(BaseModel):
    name: str = Field(..., max_length=200)
    code: str = Field(..., max_length=20)
    account_type: AccountType
    parent_id: uuid.UUID | None = None
    outlet_id: uuid.UUID | None = None
    is_active: bool = True


class ChartOfAccountCreate(ChartOfAccountBase):
    pass


class ChartOfAccountUpdate(BaseModel):
    name: str | None = None
    account_type: AccountType | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool | None = None


class ChartOfAccountResponse(ChartOfAccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class JournalEntryLineCreate(BaseModel):
    account_id: uuid.UUID
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: str | None = None


class JournalEntryLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    journal_entry_id: uuid.UUID
    account_id: uuid.UUID
    debit: Decimal
    credit: Decimal
    description: str | None = None


class JournalEntryCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    entry_number: str | None = None
    entry_date: date
    reference_type: str | None = None
    reference_id: str | None = None
    narration: str | None = None
    lines: list[JournalEntryLineCreate] = Field(..., min_length=2)


class JournalEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    entry_number: str
    entry_date: date
    reference_type: str | None
    reference_id: str | None
    narration: str | None
    status: JournalEntryStatus
    posted_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    lines: list[JournalEntryLineResponse] = []


class DayCloseCreate(BaseModel):
    outlet_id: uuid.UUID
    close_date: date
    shift_id: uuid.UUID | None = None
    cash_actual: Decimal = Decimal("0")
    total_sales: Decimal = Decimal("0")
    cash_sales: Decimal = Decimal("0")
    card_sales: Decimal = Decimal("0")
    upi_sales: Decimal = Decimal("0")
    wallet_sales: Decimal = Decimal("0")
    credit_sales: Decimal = Decimal("0")
    aggregator_sales: Decimal = Decimal("0")
    online_sales: Decimal = Decimal("0")
    total_discount: Decimal = Decimal("0")
    total_tax: Decimal = Decimal("0")
    total_round_off: Decimal = Decimal("0")
    total_orders: int = 0
    total_covers: int = 0


class DayCloseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    shift_id: uuid.UUID | None
    close_date: date
    status: DayCloseStatus
    total_sales: Decimal
    cash_sales: Decimal
    card_sales: Decimal
    upi_sales: Decimal
    wallet_sales: Decimal
    credit_sales: Decimal
    aggregator_sales: Decimal
    online_sales: Decimal
    total_discount: Decimal
    total_tax: Decimal
    total_round_off: Decimal
    total_orders: int
    total_covers: int
    avg_ticket: Decimal
    cash_expected: Decimal
    cash_actual: Decimal
    discrepancy: Decimal
    closed_by: uuid.UUID | None
    closed_at: datetime | None
    journal_entry_id: uuid.UUID | None


class GSTReturnCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    return_type: str
    period: str
    total_taxable_value: Decimal = Decimal("0")
    total_cgst: Decimal = Decimal("0")
    total_sgst: Decimal = Decimal("0")
    total_igst: Decimal = Decimal("0")
    total_cess: Decimal = Decimal("0")


class GSTReturnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    return_type: str
    period: str
    status: str
    total_taxable_value: Decimal
    total_cgst: Decimal
    total_sgst: Decimal
    total_igst: Decimal
    total_cess: Decimal
    filed_at: str | None
    arn: str | None


class TaxPaymentCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    tax_type: str
    period: str
    amount: Decimal
    challan_number: str | None = None
    paid_at: str | None = None


class TaxPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    tax_type: str
    period: str
    amount: Decimal
    challan_number: str | None
    paid_at: str | None


class TrialBalanceRow(BaseModel):
    account_id: uuid.UUID
    code: str
    name: str
    account_type: str
    total_debit: Decimal
    total_credit: Decimal
    net_balance: Decimal


class TrialBalanceResponse(BaseModel):
    as_of: date
    rows: list[TrialBalanceRow]
    total_debit: Decimal
    total_credit: Decimal
    is_balanced: bool


class PnlRow(BaseModel):
    category: str
    account_name: str
    amount: Decimal


class PnlResponse(BaseModel):
    date_from: date
    date_to: date
    revenue_rows: list[PnlRow]
    expense_rows: list[PnlRow]
    total_revenue: Decimal
    total_expense: Decimal
    net_profit: Decimal


# ─── General ledger / opening balances ───────────────────────────────────────


class GeneralLedgerRow(BaseModel):
    entry_id: uuid.UUID
    entry_number: str
    entry_date: date
    reference_type: str | None = None
    reference_id: str | None = None
    narration: str | None = None
    description: str | None = None
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    running_balance: Decimal


class GeneralLedgerResponse(BaseModel):
    account_id: uuid.UUID
    account_code: str
    account_name: str
    date_from: date
    date_to: date
    opening_balance: Decimal
    closing_balance: Decimal
    total_debit: Decimal
    total_credit: Decimal
    rows: list[GeneralLedgerRow] = []


class OpeningBalanceRow(BaseModel):
    account_id: uuid.UUID
    code: str
    name: str
    account_type: str
    total_debit: Decimal
    total_credit: Decimal
    net_balance: Decimal


class OpeningBalanceResponse(BaseModel):
    as_of: date
    rows: list[OpeningBalanceRow] = []


# ─── Bank ───────────────────────────────────────────────────────────────────


class BankAccountCreate(BaseModel):
    name: str = Field(..., max_length=200)
    account_number: str = Field(..., max_length=50)
    ifsc: str | None = Field(default=None, max_length=20)
    branch: str | None = Field(default=None, max_length=200)
    balance_snapshot: Decimal = Decimal("0")
    is_active: bool = True


class BankAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    account_number: str
    ifsc: str | None
    branch: str | None
    balance_snapshot: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class BankReconciliationCreate(BaseModel):
    period_start: date
    period_end: date
    matched_amount: Decimal = Decimal("0")
    unmatched_amount: Decimal = Decimal("0")
    notes: str | None = None


class BankReconciliationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    bank_account_id: uuid.UUID
    period_start: date
    period_end: date
    matched_amount: Decimal
    unmatched_amount: Decimal
    status: str
    reconciled_by: uuid.UUID | None
    notes: str | None
    journal_entry_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


# ─── Fixed assets ───────────────────────────────────────────────────────────


class FixedAssetCategoryCreate(BaseModel):
    name: str = Field(..., max_length=200)
    useful_life_years: int = 5


class FixedAssetCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    useful_life_years: int
    created_at: datetime
    updated_at: datetime


class FixedAssetCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(..., max_length=200)
    asset_code: str = Field(..., max_length=50)
    category_id: uuid.UUID | None = None
    purchase_cost: Decimal
    purchase_date: date
    useful_life_years: int = 5
    salvage_value: Decimal = Decimal("0")


class FixedAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    asset_code: str
    category_id: uuid.UUID | None
    purchase_cost: Decimal
    purchase_date: date
    useful_life_years: int
    salvage_value: Decimal
    accumulated_depreciation: Decimal
    disposal_status: str
    created_at: datetime
    updated_at: datetime


class DepreciationPeriod(BaseModel):
    period: str            # "YYYY-MM"
    opening_book_value: Decimal
    depreciation: Decimal
    closing_book_value: Decimal


class DepreciationScheduleResponse(BaseModel):
    asset_id: uuid.UUID
    asset_code: str
    name: str
    purchase_cost: Decimal
    salvage_value: Decimal
    useful_life_years: int
    monthly_depreciation: Decimal
    straight_line_base: Decimal
    periods: list[DepreciationPeriod] = []
    note: str = (
        "Straight-line monthly: (purchase_cost - salvage_value) / useful_life_years / 12. "
        "The schedule is a projection — accumulated_depreciation is only moved "
        "when a depreciation run is posted."
    )


# ─── Budgets ────────────────────────────────────────────────────────────────


class BudgetCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    department_or_module: str = Field(..., max_length=100)
    period_month: int = Field(..., ge=1, le=12)
    period_year: int = Field(..., ge=2000, le=2100)
    budgeted: Decimal
    actual: Decimal = Decimal("0")


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    department_or_module: str
    period_month: int
    period_year: int
    budgeted: Decimal
    actual: Decimal
    variance: Decimal
    created_at: datetime
    updated_at: datetime


class BudgetActualCreate(BaseModel):
    amount: Decimal
    period: str | None = None  # "YYYY-MM" — defaults to the budget's own period


class BudgetSummaryRow(BaseModel):
    department_or_module: str
    period_year: int
    period_month: int
    budgeted: Decimal
    actual: Decimal
    variance: Decimal


class BudgetSummaryResponse(BaseModel):
    rows: list[BudgetSummaryRow] = []
    total_budgeted: Decimal = Decimal("0")
    total_actual: Decimal = Decimal("0")
    total_variance: Decimal = Decimal("0")


# ─── Expense claims ────────────────────────────────────────────────────────


class ExpenseClaimLineCreate(BaseModel):
    category: str = Field(..., max_length=100)
    amount: Decimal
    description: str | None = Field(default=None, max_length=300)


class ExpenseClaimLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    claim_id: uuid.UUID
    category: str
    amount: Decimal
    description: str | None


class ExpenseClaimCreate(BaseModel):
    user_id: uuid.UUID | None = None
    claimed_on: date | None = None
    total: Decimal | None = None
    status: str = "submitted"
    notes: str | None = None
    lines: list[ExpenseClaimLineCreate] = Field(default_factory=list)


class ExpenseClaimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    claimed_on: date
    total: Decimal
    status: str
    notes: str | None
    journal_entry_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    lines: list[ExpenseClaimLineResponse] = []


class ExpenseClaimActionResponse(BaseModel):
    message: str
    claim: ExpenseClaimResponse


class ExpenseClaimSummaryRow(BaseModel):
    status: str
    count: int
    total: Decimal


class ExpenseClaimSummaryResponse(BaseModel):
    rows: list[ExpenseClaimSummaryRow] = []
    total_claims: int = 0
    total_amount: Decimal = Decimal("0")
    pending_amount: Decimal = Decimal("0")


# ─── Financial reports ──────────────────────────────────────────────────────


class ReportMeta(BaseModel):
    title: str
    from_date: date
    to_date: date
    currency: str = "INR"


class LineItem(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    net: Decimal = Decimal("0")


class BalanceSheetResponse(BaseModel):
    meta: ReportMeta
    assets: list[LineItem] = []
    total_assets: Decimal = Decimal("0")
    liabilities: list[LineItem] = []
    total_liabilities: Decimal = Decimal("0")
    equity: list[LineItem] = []
    total_equity: Decimal = Decimal("0")
    total_liabilities_and_equity: Decimal = Decimal("0")
    notes: list[str] = []


class CashFlowResponse(BaseModel):
    meta: ReportMeta
    operating: list[LineItem] = []
    net_operating: Decimal = Decimal("0")
    investing: list[LineItem] = []
    net_investing: Decimal = Decimal("0")
    financing: list[LineItem] = []
    net_financing: Decimal = Decimal("0")
    net_cash_flow: Decimal = Decimal("0")


class ARAgingResponse(BaseModel):
    meta: ReportMeta
    current: Decimal = Decimal("0")
    days_1_30: Decimal = Decimal("0")
    days_31_60: Decimal = Decimal("0")
    days_61_90: Decimal = Decimal("0")
    days_over_90: Decimal = Decimal("0")
    total_outstanding: Decimal = Decimal("0")
    buckets_available: bool = True


class GSTSummaryResponse(BaseModel):
    period: str
    returns: list[GSTReturnResponse] = []
    total_taxable_value: Decimal = Decimal("0")
    total_cgst: Decimal = Decimal("0")
    total_sgst: Decimal = Decimal("0")
    total_igst: Decimal = Decimal("0")
    total_cess: Decimal = Decimal("0")
    total_tax: Decimal = Decimal("0")
    invoices_available: bool = False
    invoice_count: int = 0
    notes: list[str] = []


# ─── Operational expenses ───────────────────────────────────────────────────


class ExpenseCategoryCreate(BaseModel):
    code: str = Field(..., max_length=20)
    name: str = Field(..., max_length=200)
    gl_account_code: str | None = Field(default=None, max_length=20)
    is_active: bool = True


class ExpenseCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    name: str
    gl_account_code: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ExpenseCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    date: _date | None = None
    description: str | None = Field(default=None, max_length=300)
    category_id: uuid.UUID
    payment_mode: PaymentMode
    amount: Decimal
    paid_to: str | None = Field(default=None, max_length=200)


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    expense_no: str
    date: _date
    description: str | None
    category_id: uuid.UUID
    payment_mode: PaymentMode
    amount: Decimal
    paid_to: str | None
    posted: bool
    journal_entry_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ExpensePostResponse(BaseModel):
    expense: ExpenseResponse
    posted: bool
    journal_entry_id: uuid.UUID | None
    message: str


# ─── Withdrawals ────────────────────────────────────────────────────────────


class WithdrawalCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    date: _date | None = None
    amount: Decimal
    method: WithdrawalMethod
    note: str | None = Field(default=None, max_length=300)


class WithdrawalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    date: _date
    amount: Decimal
    method: WithdrawalMethod
    note: str | None
    status: WithdrawalStatus
    approved_by: uuid.UUID | None
    journal_entry_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class WithdrawalActionResponse(BaseModel):
    message: str
    withdrawal: WithdrawalResponse


# ─── Currency book ──────────────────────────────────────────────────────────


class ExchangeRateCreate(BaseModel):
    from_currency: str = Field(..., max_length=10)
    to_currency: str = Field(..., max_length=10)
    rate: Decimal
    effective_from: date
    notes: str | None = None


class ExchangeRateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    from_currency: str
    to_currency: str
    rate: Decimal
    effective_from: date
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ExchangeRateCurrentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_currency: str
    to_currency: str
    rate: Decimal
    effective_from: date
    notes: str | None
    available: bool
    reason: str | None = None


# ─── Cash-flow "all wallets" summary ────────────────────────────────────────


class CashFlowWalletRow(BaseModel):
    """A day in the ``cash-flow/summary`` window.

    The payload keys are ``in``/``out`` (as the screen expects) — modelled as
    aliased fields because ``in`` is a Python keyword; ``in_amount``/
    ``out_amount`` are the in-process names, the aliases are the wire names.
    """

    date: _date
    in_amount: Decimal = Field(default=Decimal("0"), alias="in")
    out_amount: Decimal = Field(default=Decimal("0"), alias="out")

    model_config = ConfigDict(
        populate_by_name=True, from_attributes=True, serialize_by_alias=True
    )


class CashFlowWalletResponse(BaseModel):
    days: int
    inflow: Decimal = Decimal("0")
    outflow: Decimal = Decimal("0")
    net: Decimal = Decimal("0")
    balance: Decimal = Decimal("0")
    daily: list[CashFlowWalletRow] = []
    by_payment_mode: dict[str, Decimal] = {}
    notes: list[str] = []
