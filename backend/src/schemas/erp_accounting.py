"""ERP Schemas — Accounting, AR, Bank, Fixed Assets, Expenses, Vouchers, Tax."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════
#  CHART OF ACCOUNTS
# ═══════════════════════════════════════════════════════════════════

class ChartOfAccountCreate(BaseModel):
    company_id: uuid.UUID | None = None
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    account_type: str = Field(min_length=1, max_length=30)
    account_sub_type: str | None = Field(default=None, max_length=50)
    parent_id: uuid.UUID | None = None
    is_control_account: bool = False
    is_active: bool = True
    opening_balance: float = 0
    opening_balance_date: date | None = None
    currency_code: str | None = Field(default=None, max_length=10)
    allow_posting: bool = True
    sort_order: int = 0


class ChartOfAccountUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=30)
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    account_type: str | None = Field(default=None, max_length=30)
    account_sub_type: str | None = Field(default=None, max_length=50)
    parent_id: uuid.UUID | None = None
    is_control_account: bool | None = None
    is_active: bool | None = None
    opening_balance: float | None = None
    opening_balance_date: date | None = None
    currency_code: str | None = Field(default=None, max_length=10)
    allow_posting: bool | None = None
    sort_order: int | None = None


class ChartOfAccountResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    code: str
    name: str
    description: str | None
    account_type: str
    account_sub_type: str | None
    parent_id: uuid.UUID | None
    is_control_account: bool
    is_active: bool
    opening_balance: float
    opening_balance_date: date | None
    currency_code: str | None
    allow_posting: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════════════════
#  JOURNAL ENTRIES
# ═══════════════════════════════════════════════════════════════════

class JournalEntryLineCreate(BaseModel):
    account_id: uuid.UUID
    cost_center_id: uuid.UUID | None = None
    description: str | None = None
    debit: float = 0
    credit: float = 0
    currency_code: str = "INR"
    exchange_rate: float = 1


class JournalEntryLineResponse(ORMModel):
    id: uuid.UUID
    entry_id: uuid.UUID
    account_id: uuid.UUID
    cost_center_id: uuid.UUID | None
    description: str | None
    debit: float
    credit: float
    currency_code: str
    exchange_rate: float
    base_currency_debit: float
    base_currency_credit: float
    line_number: int
    sort_order: int


class JournalEntryCreate(BaseModel):
    company_id: uuid.UUID | None = None
    entry_type: str = "journal"
    entry_date: date
    reference: str | None = None
    description: str | None = None
    currency_code: str = "INR"
    exchange_rate: float = 1
    source_module: str | None = None
    lines: list[JournalEntryLineCreate] = Field(min_length=2)
    attachments: list | None = None


class JournalEntryUpdate(BaseModel):
    entry_date: date | None = None
    reference: str | None = None
    description: str | None = None
    status: str | None = None
    lines: list[JournalEntryLineCreate] | None = None


class JournalEntryResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    entry_number: str
    entry_type: str
    status: str
    entry_date: date
    reference: str | None
    description: str | None
    total_debit: float
    total_credit: float
    currency_code: str
    exchange_rate: float
    source_module: str | None
    source_id: uuid.UUID | None
    created_by_user_id: uuid.UUID | None
    posted_at: datetime | None
    posted_by_user_id: uuid.UUID | None
    reversed_at: datetime | None
    reversed_by_user_id: uuid.UUID | None
    reverse_entry_id: uuid.UUID | None
    attachments: list | None
    lines: list[JournalEntryLineResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════════════════
#  INVOICES (AR)
# ═══════════════════════════════════════════════════════════════════

class InvoiceLineCreate(BaseModel):
    product_id: uuid.UUID | None = None
    product_name: str = Field(min_length=1, max_length=255)
    product_sku: str | None = None
    hsn_code: str | None = Field(default=None, max_length=20)
    batch_number: str | None = Field(default=None, max_length=100)
    expiry_date: date | None = None
    mfg_date: date | None = None
    mrp: float | None = Field(default=None, ge=0)
    description: str | None = None
    uom: str | None = Field(default=None, max_length=30)
    quantity: float = Field(gt=0, default=1)
    unit_price: float = Field(ge=0, default=0)
    discount_type: str | None = Field(default=None, max_length=20)
    discount_value: float = Field(default=0)
    tax_rate: float = Field(default=0, ge=0, le=100)
    cost_center_id: uuid.UUID | None = None


class InvoiceLineResponse(ORMModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    line_number: int
    product_id: uuid.UUID | None
    product_name: str
    product_sku: str | None
    hsn_code: str | None
    batch_number: str | None
    expiry_date: date | None
    mfg_date: date | None
    mrp: float | None
    description: str | None
    uom: str | None
    quantity: float
    unit_price: float
    discount_type: str | None
    discount_value: float
    discount_amount: float
    taxable_amount: float
    tax_rate: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    line_total: float
    cost_center_id: uuid.UUID | None


class InvoicePaymentCreate(BaseModel):
    payment_date: date
    payment_method: str = Field(min_length=1, max_length=50)
    amount: float = Field(gt=0)
    reference_number: str | None = None
    bank_account_id: uuid.UUID | None = None
    notes: str | None = None


class InvoicePaymentResponse(ORMModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    payment_date: date
    payment_method: str
    amount: float
    reference_number: str | None
    bank_account_id: uuid.UUID | None
    notes: str | None
    journal_entry_id: uuid.UUID | None


class InvoiceCreate(BaseModel):
    company_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str = Field(min_length=1, max_length=255)
    customer_email: str | None = None
    customer_phone: str | None = Field(default=None, max_length=30)
    customer_gstin: str | None = Field(default=None, max_length=30)
    billing_address: str | None = None
    shipping_address: str | None = None
    invoice_number: str | None = None
    invoice_type: str = "tax_invoice"
    reference_number: str | None = None
    order_number: str | None = None
    invoice_date: date
    due_date: date
    service_from: date | None = None
    service_to: date | None = None
    payment_terms: str | None = None
    currency_code: str = "INR"
    exchange_rate: float = 1
    discount_type: str | None = None
    discount_value: float = 0
    notes: str | None = None
    terms: str | None = None
    footer: str | None = None
    is_reverse_charge: bool = False
    payment_status: str | None = None
    payment_method: str | None = None
    amount_paid: float | None = None
    amount_received: float | None = None
    split_payments: dict[str, float] | None = None
    lines: list[InvoiceLineCreate] = Field(min_length=1)


class InvoiceUpdate(BaseModel):
    customer_id: uuid.UUID | None = None
    customer_name: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    customer_gstin: str | None = None
    billing_address: str | None = None
    shipping_address: str | None = None
    reference_number: str | None = None
    order_number: str | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    service_from: date | None = None
    service_to: date | None = None
    payment_terms: str | None = None
    currency_code: str | None = None
    discount_type: str | None = None
    discount_value: float | None = None
    notes: str | None = None
    terms: str | None = None
    footer: str | None = None
    is_reverse_charge: bool | None = None
    lines: list[InvoiceLineCreate] | None = None


class InvoiceResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    customer_id: uuid.UUID | None
    customer_name: str
    customer_email: str | None
    customer_phone: str | None
    customer_gstin: str | None
    billing_address: str | None
    shipping_address: str | None
    invoice_number: str
    invoice_type: str
    reference_number: str | None
    order_number: str | None
    status: str
    invoice_date: date
    due_date: date
    service_from: date | None
    service_to: date | None
    payment_terms: str | None
    currency_code: str
    exchange_rate: float
    subtotal: float
    discount_type: str | None
    discount_value: float
    discount_amount: float
    cgst_amount: float
    sgst_amount: float
    igst_amount: float
    tds_amount: float
    round_off: float
    total_amount: float
    amount_paid: float
    balance_due: float
    notes: str | None
    terms: str | None
    footer: str | None
    is_reverse_charge: bool
    irn_number: str | None
    ack_number: str | None
    ack_date: datetime | None
    e_invoice_qr: str | None
    is_approved: bool
    approved_by_user_id: uuid.UUID | None
    approved_at: datetime | None
    journal_entry_id: uuid.UUID | None
    lines: list[InvoiceLineResponse] = Field(default_factory=list)
    payments: list[InvoicePaymentResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class InvoiceReturnLineCreate(BaseModel):
    product_id: uuid.UUID | None = None
    product_name: str
    quantity: float
    unit_price: float
    line_total: float | None = None
    tax_amount: float = 0.0


class InvoiceReturnCreate(BaseModel):
    invoice_id: uuid.UUID | None = None
    invoice_number: str | None = None
    reason: str = "Defective / Wrong Size"
    refund_method: str = "Cash Refund"
    lines: list[InvoiceReturnLineCreate]


class InvoiceReturnLineResponse(ORMModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    product_name: str
    quantity: float
    unit_price: float
    line_total: float
    tax_amount: float


class InvoiceReturnResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    invoice_id: uuid.UUID
    return_number: str
    return_date: date
    reason: str | None
    total_amount: float
    status: str
    lines: list[InvoiceReturnLineResponse] = Field(default_factory=list)
    created_at: datetime



# ═══════════════════════════════════════════════════════════════════
#  BANK
# ═══════════════════════════════════════════════════════════════════

class BankAccountCreate(BaseModel):
    company_id: uuid.UUID | None = None
    chart_of_account_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=150)
    account_number: str | None = Field(default=None, max_length=50)
    ifsc_code: str | None = Field(default=None, max_length=20)
    bank_name: str | None = Field(default=None, max_length=150)
    branch_name: str | None = Field(default=None, max_length=150)
    account_type: str = "checking"
    currency_code: str = "INR"
    opening_balance: float = 0
    opening_balance_date: date | None = None
    current_balance: float = 0
    is_default: bool = False


class BankAccountUpdate(BaseModel):
    name: str | None = None
    account_number: str | None = None
    ifsc_code: str | None = None
    bank_name: str | None = None
    branch_name: str | None = None
    account_type: str | None = None
    opening_balance: float | None = None
    opening_balance_date: date | None = None
    current_balance: float | None = None
    status: str | None = None
    is_default: bool | None = None


class BankAccountResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    chart_of_account_id: uuid.UUID | None
    name: str
    account_number: str | None
    ifsc_code: str | None
    bank_name: str | None
    branch_name: str | None
    account_type: str
    currency_code: str
    opening_balance: float
    opening_balance_date: date | None
    current_balance: float
    status: str
    is_default: bool
    created_at: datetime
    updated_at: datetime


class BankTransactionCreate(BaseModel):
    bank_account_id: uuid.UUID
    transaction_date: date
    value_date: date | None = None
    description: str = Field(min_length=1, max_length=500)
    reference_number: str | None = None
    counterparty: str | None = Field(default=None, max_length=255)
    transaction_type: str = Field(min_length=1, max_length=30)
    amount: float
    is_manual: bool = False
    tags: list | None = None
    notes: str | None = None


class BankTransactionResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    bank_account_id: uuid.UUID
    transaction_date: date
    value_date: date | None
    description: str
    reference_number: str | None
    counterparty: str | None
    transaction_type: str
    amount: float
    running_balance: float | None
    is_reconciled: bool
    reconciled_at: datetime | None
    reconciled_by_user_id: uuid.UUID | None
    journal_entry_id: uuid.UUID | None
    is_manual: bool
    tags: list | None
    notes: str | None


class BankReconciliationItemCreate(BaseModel):
    bank_transaction_id: uuid.UUID | None = None
    journal_entry_id: uuid.UUID | None = None
    is_matched: bool = False
    is_cleared: bool = False
    notes: str | None = None


class BankReconciliationCreate(BaseModel):
    bank_account_id: uuid.UUID
    reconciliation_date: date
    statement_balance: float = 0
    notes: str | None = None
    items: list[BankReconciliationItemCreate] = Field(default_factory=list)


class BankReconciliationItemResponse(ORMModel):
    id: uuid.UUID
    reconciliation_id: uuid.UUID
    bank_transaction_id: uuid.UUID | None
    journal_entry_id: uuid.UUID | None
    is_matched: bool
    is_cleared: bool
    notes: str | None


class BankReconciliationResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    bank_account_id: uuid.UUID
    reconciliation_date: date
    statement_balance: float
    book_balance: float
    difference: float
    status: str
    notes: str | None
    completed_by_user_id: uuid.UUID | None
    completed_at: datetime | None
    items: list[BankReconciliationItemResponse] = Field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════
#  FIXED ASSETS
# ═══════════════════════════════════════════════════════════════════

class FixedAssetCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    asset_account_id: uuid.UUID | None = None
    depreciation_account_id: uuid.UUID | None = None
    expense_account_id: uuid.UUID | None = None
    useful_life_years: int = Field(default=5, ge=1, le=100)
    depreciation_method: str = "straight_line"
    salvage_value_percent: float = Field(default=0, ge=0, le=100)


class FixedAssetCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    asset_account_id: uuid.UUID | None = None
    depreciation_account_id: uuid.UUID | None = None
    expense_account_id: uuid.UUID | None = None
    useful_life_years: int | None = Field(default=None, ge=1, le=100)
    depreciation_method: str | None = None
    salvage_value_percent: float | None = Field(default=None, ge=0, le=100)
    status: str | None = None


class FixedAssetCategoryResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    asset_account_id: uuid.UUID | None
    depreciation_account_id: uuid.UUID | None
    expense_account_id: uuid.UUID | None
    useful_life_years: int
    depreciation_method: str
    salvage_value_percent: float
    status: str
    created_at: datetime
    updated_at: datetime


class FixedAssetCreate(BaseModel):
    company_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    asset_number: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    asset_type: str = "other"
    location: str | None = Field(default=None, max_length=200)
    custodian_id: uuid.UUID | None = None
    purchase_date: date
    purchase_cost: float = Field(gt=0)
    salvage_value: float = Field(default=0, ge=0)
    useful_life_months: int = Field(default=60, ge=1)
    depreciation_method: str = "straight_line"
    chart_of_account_id: uuid.UUID | None = None


class FixedAssetUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = None
    description: str | None = None
    asset_type: str | None = None
    location: str | None = None
    custodian_id: uuid.UUID | None = None
    salvage_value: float | None = Field(default=None, ge=0)
    useful_life_months: int | None = Field(default=None, ge=1)
    depreciation_method: str | None = None
    status: str | None = None
    chart_of_account_id: uuid.UUID | None = None


class FixedAssetResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    category_id: uuid.UUID | None
    asset_number: str
    name: str
    description: str | None
    asset_type: str
    location: str | None
    custodian_id: uuid.UUID | None
    purchase_date: date
    purchase_cost: float
    accumulated_depreciation: float
    net_book_value: float
    salvage_value: float
    useful_life_months: int
    depreciation_method: str
    status: str
    purchase_journal_entry_id: uuid.UUID | None
    disposal_journal_entry_id: uuid.UUID | None
    chart_of_account_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class FixedAssetDepreciationResponse(ORMModel):
    id: uuid.UUID
    asset_id: uuid.UUID
    depreciation_date: date
    period_start: date
    period_end: date
    depreciation_amount: float
    accumulated_after: float
    net_book_value_after: float
    journal_entry_id: uuid.UUID | None
    posted_by_user_id: uuid.UUID | None
    notes: str | None


# ═══════════════════════════════════════════════════════════════════
#  EXPENSE CLAIMS & BUDGETS
# ═══════════════════════════════════════════════════════════════════

class ExpenseClaimLineCreate(BaseModel):
    expense_date: date
    category: str = Field(min_length=1, max_length=100)
    description: str | None = None
    amount: float = Field(gt=0)
    receipt_url: str | None = Field(default=None, max_length=500)
    cost_center_id: uuid.UUID | None = None


class ExpenseClaimLineResponse(ORMModel):
    id: uuid.UUID
    claim_id: uuid.UUID
    expense_date: date
    category: str
    description: str | None
    amount: float
    receipt_url: str | None
    cost_center_id: uuid.UUID | None


class ExpenseClaimCreate(BaseModel):
    company_id: uuid.UUID | None = None
    employee_id: uuid.UUID | None = None
    claim_date: date
    description: str | None = None
    lines: list[ExpenseClaimLineCreate] = Field(min_length=1)


class ExpenseClaimUpdate(BaseModel):
    claim_date: date | None = None
    description: str | None = None
    status: str | None = None
    rejection_reason: str | None = None
    lines: list[ExpenseClaimLineCreate] | None = None


class ExpenseClaimResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    employee_id: uuid.UUID | None
    claim_number: str
    claim_date: date
    total_amount: float
    status: str
    description: str | None
    approved_by_user_id: uuid.UUID | None
    approved_at: datetime | None
    payment_journal_entry_id: uuid.UUID | None
    rejection_reason: str | None
    lines: list[ExpenseClaimLineResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class BudgetCreate(BaseModel):
    company_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    cost_center_id: uuid.UUID | None = None
    fiscal_year_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    budgeted_amount: float = 0
    notes: str | None = None


class BudgetUpdate(BaseModel):
    name: str | None = None
    budgeted_amount: float | None = Field(default=None, ge=0)
    actual_amount: float | None = None
    variance: float | None = None
    variance_percent: float | None = None
    status: str | None = None
    notes: str | None = None


class BudgetResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    department_id: uuid.UUID | None
    cost_center_id: uuid.UUID | None
    fiscal_year_id: uuid.UUID | None
    name: str
    category: str
    budgeted_amount: float
    actual_amount: float
    variance: float
    variance_percent: float
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════════════════
#  PAYMENT VOUCHERS
# ═══════════════════════════════════════════════════════════════════

class PaymentVoucherLineCreate(BaseModel):
    account_id: uuid.UUID
    cost_center_id: uuid.UUID | None = None
    description: str | None = None
    amount: float = Field(gt=0)
    line_type: str = Field(min_length=1, max_length=20)


class PaymentVoucherLineResponse(ORMModel):
    id: uuid.UUID
    voucher_id: uuid.UUID
    account_id: uuid.UUID
    cost_center_id: uuid.UUID | None
    description: str | None
    amount: float
    line_type: str


class PaymentVoucherCreate(BaseModel):
    company_id: uuid.UUID | None = None
    voucher_type: str = "payment"
    voucher_date: date
    payee_name: str = Field(min_length=1, max_length=255)
    payee_type: str = Field(min_length=1, max_length=30)
    bank_account_id: uuid.UUID | None = None
    payment_method: str | None = None
    reference_number: str | None = None
    description: str | None = None
    currency_code: str = "INR"
    lines: list[PaymentVoucherLineCreate] = Field(min_length=1)


class PaymentVoucherUpdate(BaseModel):
    voucher_date: date | None = None
    payee_name: str | None = None
    payee_type: str | None = None
    bank_account_id: uuid.UUID | None = None
    payment_method: str | None = None
    reference_number: str | None = None
    description: str | None = None
    status: str | None = None
    lines: list[PaymentVoucherLineCreate] | None = None


class PaymentVoucherResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID | None
    voucher_number: str
    voucher_type: str
    status: str
    voucher_date: date
    payee_name: str
    payee_type: str
    bank_account_id: uuid.UUID | None
    payment_method: str | None
    reference_number: str | None
    description: str | None
    total_amount: float
    currency_code: str
    approved_by_user_id: uuid.UUID | None
    approved_at: datetime | None
    posted_at: datetime | None
    journal_entry_id: uuid.UUID | None
    lines: list[PaymentVoucherLineResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════════════════
#  TAX MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

class TaxCodeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=150)
    tax_type: str = Field(min_length=1, max_length=50)
    rate_percent: float = Field(default=0, ge=0, le=100)
    is_reverse_charge: bool = False
    is_inclusive: bool = True
    account_id: uuid.UUID | None = None


class TaxCodeUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=20)
    name: str | None = Field(default=None, max_length=150)
    tax_type: str | None = Field(default=None, max_length=50)
    rate_percent: float | None = Field(default=None, ge=0, le=100)
    is_reverse_charge: bool | None = None
    is_inclusive: bool | None = None
    account_id: uuid.UUID | None = None
    status: str | None = None


class TaxCodeResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    name: str
    tax_type: str
    rate_percent: float
    is_reverse_charge: bool
    is_inclusive: bool
    account_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class TaxReturnCreate(BaseModel):
    return_type: str = Field(min_length=1, max_length=50)
    period: str = Field(min_length=1, max_length=20)
    period_start: date | None = None
    period_end: date | None = None
    notes: str | None = None


class TaxReturnUpdate(BaseModel):
    return_type: str | None = None
    period: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    total_taxable_value: float | None = None
    total_tax_amount: float | None = None
    igst_amount: float | None = None
    cgst_amount: float | None = None
    sgst_amount: float | None = None
    tds_amount: float | None = None
    status: str | None = None
    acknowledgment_number: str | None = None
    reference_file_url: str | None = None
    notes: str | None = None


class TaxReturnResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    return_type: str
    period: str
    period_start: date | None
    period_end: date | None
    total_taxable_value: float
    total_tax_amount: float
    igst_amount: float
    cgst_amount: float
    sgst_amount: float
    tds_amount: float
    status: str
    filed_at: datetime | None
    filed_by_user_id: uuid.UUID | None
    acknowledgment_number: str | None
    reference_file_url: str | None
    notes: str | None


class TaxPaymentCreate(BaseModel):
    tax_return_id: uuid.UUID | None = None
    payment_date: date
    tax_type: str = Field(min_length=1, max_length=50)
    amount: float = Field(gt=0)
    payment_method: str = "online"
    reference_number: str | None = None
    challan_number: str | None = None
    bank_account_id: uuid.UUID | None = None
    notes: str | None = None


class TaxPaymentResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tax_return_id: uuid.UUID | None
    payment_date: date
    tax_type: str
    amount: float
    payment_method: str
    reference_number: str | None
    challan_number: str | None
    bank_account_id: uuid.UUID | None
    journal_entry_id: uuid.UUID | None
    notes: str | None
