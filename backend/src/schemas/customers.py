"""Customer schemas."""
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CustomerCreate(BaseModel):
    outlet_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=5, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    address: str | None = None
    gstin: str | None = Field(default=None, max_length=20)
    birthday: date | None = None
    anniversary: date | None = None
    notes: str | None = None
    tags: list[str] = Field(default_factory=list)


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = Field(default=None, max_length=200)
    address: str | None = None
    gstin: str | None = Field(default=None, max_length=20)
    birthday: date | None = None
    anniversary: date | None = None
    notes: str | None = None
    tags: list[str] | None = None


class CustomerResponse(ORMBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    outlet_id: uuid.UUID | None
    name: str
    phone: str
    email: str | None
    address: str | None
    gstin: str | None
    birthday: date | None
    anniversary: date | None
    notes: str | None
    tags: list
    total_visits: int
    total_spent: float
    created_at: datetime
    updated_at: datetime


class CustomerHistoryRow(BaseModel):
    bill_id: uuid.UUID
    bill_number: str
    created_at: datetime
    grand_total: float
    status: str
    order_type: str | None = None
    covers: int | None = None


class CustomerHistory(BaseModel):
    customer: CustomerResponse
    bills: list[CustomerHistoryRow] = Field(default_factory=list)
    total_bills: int = 0
    total_spent: float = 0
    avg_ticket: float = 0
    last_visit: datetime | None = None
