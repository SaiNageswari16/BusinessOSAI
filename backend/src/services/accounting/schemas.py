"""Accounting service schemas (Pydantic v2)."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from src.services.accounting.models import AccountType, DayCloseStatus, JournalEntryStatus


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
