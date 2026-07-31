import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CustomerBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    company_name: str | None = Field(default=None, max_length=255)
    customer_type: str = "Retail"
    status: str = "Active"
    address: str | None = None
    gst_number: str | None = Field(default=None, max_length=50)
    owner_user_id: uuid.UUID | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = None
    company_name: str | None = None
    customer_type: str | None = None
    status: str | None = None
    address: str | None = None
    gst_number: str | None = None
    owner_user_id: uuid.UUID | None = None


class CustomerResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    company_name: str | None
    customer_type: str
    status: str
    address: str | None
    gst_number: str | None
    owner_user_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class LeadBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    status: str = "New"
    source: str | None = Field(default=None, max_length=100)
    owner_user_id: uuid.UUID | None = None
    estimated_value: float = Field(default=0, ge=0)
    next_follow_up_at: datetime | None = None
    notes: str | None = None
    lost_reason: str | None = Field(default=None, max_length=255)


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    company_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    status: str | None = None
    source: str | None = None
    owner_user_id: uuid.UUID | None = None
    estimated_value: float | None = Field(default=None, ge=0)
    next_follow_up_at: datetime | None = None
    notes: str | None = None
    lost_reason: str | None = None


class LeadResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    company_name: str | None
    email: str | None
    phone: str | None
    status: str
    source: str | None
    owner_user_id: uuid.UUID | None
    estimated_value: float
    last_contact_at: datetime | None
    next_follow_up_at: datetime | None
    notes: str | None
    lost_reason: str | None
    created_at: datetime
    updated_at: datetime


class LeadActivityCreate(BaseModel):
    activity_type: str = Field(min_length=2, max_length=50)
    summary: str = Field(min_length=2, max_length=500)
    occurred_at: datetime | None = None


class LeadActivityResponse(ORMModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    activity_type: str
    summary: str
    occurred_at: datetime
    created_by_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class OpportunityBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    customer_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    stage: str = "Prospecting"
    amount: float = Field(default=0, ge=0)
    probability: int = Field(default=10, ge=0, le=100)
    expected_close_date: date | None = None
    owner_user_id: uuid.UUID | None = None
    next_step: str | None = Field(default=None, max_length=500)
    next_step_at: datetime | None = None
    forecast_category: str = "Pipeline"
    lost_reason: str | None = Field(default=None, max_length=255)


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    customer_id: uuid.UUID | None = None
    lead_id: uuid.UUID | None = None
    stage: str | None = None
    amount: float | None = Field(default=None, ge=0)
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = None
    owner_user_id: uuid.UUID | None = None
    next_step: str | None = Field(default=None, max_length=500)
    next_step_at: datetime | None = None
    forecast_category: str | None = None
    lost_reason: str | None = Field(default=None, max_length=255)


class OpportunityResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    customer_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    name: str
    stage: str
    amount: float
    probability: int
    expected_close_date: date | None
    owner_user_id: uuid.UUID | None
    next_step: str | None
    next_step_at: datetime | None
    forecast_category: str
    lost_reason: str | None
    created_at: datetime
    updated_at: datetime
