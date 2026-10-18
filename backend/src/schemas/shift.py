"""Shift, cash movement, day close and accounting schemas."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from src.models.shift import (
    AccountType,
    CashMovementType,
    DayCloseStatus,
    JournalEntryStatus,
    ShiftStatus,
)


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Shifts ──────────────────────────────────────────────────────

class ShiftOpen(BaseModel):
    outlet_id: uuid.UUID
    opening_cash: float = Field(default=0, ge=0)
    shift_type: str = Field(default="morning", max_length=20)
    notes: str | None = None


class ShiftClose(BaseModel):
    closing_cash_actual: float = Field(ge=0)
    denominations: dict = Field(default_factory=dict)
    discrepancy_reason: str | None = None
    notes: str | None = None


class ShiftResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    user_id: uuid.UUID
    shift_number: str
    shift_type: str | None
    status: str
    opening_cash: float
    closing_cash_expected: float | None
    closing_cash_actual: float | None
    discrepancy: float | None
    discrepancy_approved_by: uuid.UUID | None
    denominations: dict
    notes: str | None
    discrepancy_reason: str | None
    opened_at: str | None
    closed_at: str | None
    closed_by: uuid.UUID | None
    created_at: datetime


class ShiftSummary(BaseModel):
    shift_id: uuid.UUID
    shift_number: str
    status: str
    opened_at: str | None
    closed_at: str | None
    opening_cash: float
    closing_cash_expected: float | None
    closing_cash_actual: float | None
    discrepancy: float | None
    total_bills: int = 0
    gross_sales: float = 0
    total_discount: float = 0
    total_tax: float = 0
    net_sales: float = 0
    cash_sales: float = 0
    card_sales: float = 0
    upi_sales: float = 0
    wallet_sales: float = 0
    credit_sales: float = 0
    aggregator_sales: float = 0
    online_sales: float = 0
    total_tips: float = 0
    cash_movements: list["CashMovementResponse"] = Field(default_factory=list)


# ─── Cash movements ──────────────────────────────────────────────

class CashMovementCreate(BaseModel):
    movement_type: CashMovementType
    amount: float = Field(gt=0)
    reason: str = Field(min_length=1, max_length=500)


class CashMovementResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    shift_id: uuid.UUID
    movement_type: str
    amount: float
    reason: str
    created_by: uuid.UUID | None
    created_at: datetime


# ─── Day close ───────────────────────────────────────────────────

class DayCloseCreate(BaseModel):
    outlet_id: uuid.UUID
    close_date: date
    shift_id: uuid.UUID | None = None
    notes: str | None = None


class DayCloseResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID
    shift_id: uuid.UUID | None
    close_date: date
    status: str
    total_sales: float
    cash_sales: float
    card_sales: float
    upi_sales: float
    wallet_sales: float
    credit_sales: float
    aggregator_sales: float
    online_sales: float
    total_discount: float
    total_tax: float
    total_round_off: float
    total_orders: int
    total_covers: int
    avg_ticket: float
    cash_expected: float
    cash_actual: float
    discrepancy: float
    closed_by: uuid.UUID | None
    closed_at: str | None
    notes: str | None
    created_at: datetime


# ─── Accounting ──────────────────────────────────────────────────

class ChartOfAccountCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=200)
    account_type: AccountType
    parent_id: uuid.UUID | None = None


class ChartOfAccountUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=20)
    name: str | None = Field(default=None, max_length=200)
    account_type: AccountType | None = None
    parent_id: uuid.UUID | None = None
    is_active: bool | None = None


class ChartOfAccountResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    code: str
    name: str
    account_type: str
    parent_id: uuid.UUID | None
    is_active: bool
    created_at: datetime


class JournalEntryLineIn(BaseModel):
    account_id: uuid.UUID
    debit: float = Field(default=0, ge=0)
    credit: float = Field(default=0, ge=0)
    description: str | None = Field(default=None, max_length=300)


class JournalEntryCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    entry_date: date
    narration: str | None = None
    reference_type: str | None = Field(default=None, max_length=50)
    reference_id: str | None = Field(default=None, max_length=100)
    status: JournalEntryStatus = JournalEntryStatus.DRAFT
    lines: list[JournalEntryLineIn] = Field(min_length=2)


class JournalEntryLineResponse(ORMBase):
    id: uuid.UUID
    journal_entry_id: uuid.UUID
    account_id: uuid.UUID
    debit: float
    credit: float
    description: str | None


class JournalEntryResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    entry_number: str
    entry_date: date
    reference_type: str | None
    reference_id: str | None
    narration: str | None
    status: str
    posted_by: uuid.UUID | None
    lines: list[JournalEntryLineResponse] = Field(default_factory=list)
    total_debit: float = 0
    total_credit: float = 0
    created_at: datetime


class GSTReturnResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    return_type: str
    period: str
    status: str
    total_taxable_value: float
    total_cgst: float
    total_sgst: float
    total_igst: float
    total_cess: float
    filed_at: str | None
    arn: str | None
    created_at: datetime


class GSTReturnCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    return_type: str = Field(min_length=1, max_length=20)
    period: str = Field(min_length=6, max_length=10)


class TaxPaymentCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    tax_type: str = Field(min_length=1, max_length=30)
    period: str = Field(min_length=6, max_length=10)
    amount: float = Field(gt=0)
    challan_number: str | None = Field(default=None, max_length=50)
    status: str = Field(default="pending", max_length=20)


class TaxPaymentResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    tax_type: str
    period: str
    amount: float
    challan_number: str | None
    paid_at: str | None
    status: str
    created_at: datetime


ShiftSummary.model_rebuild()


class ShiftStatusRef(BaseModel):
    shift_statuses: list[str] = [s.value for s in ShiftStatus]
    cash_movement_types: list[str] = [s.value for s in CashMovementType]
    day_close_statuses: list[str] = [s.value for s in DayCloseStatus]
