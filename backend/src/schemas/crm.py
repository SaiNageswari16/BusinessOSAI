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


# ─── CRM Extensions Schemas ──────────────────────────────────────────

class CustomerGroupBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str | None = None
    group_type: str = "static"
    status: str = "active"

class CustomerGroupCreate(CustomerGroupBase):
    pass

class CustomerGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    group_type: str | None = None
    status: str | None = None

class CustomerGroupResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    group_type: str
    status: str
    members_count: int
    created_at: datetime
    updated_at: datetime

class GroupMemberAdd(BaseModel):
    customer_ids: list[uuid.UUID]

class GroupMemberRemove(BaseModel):
    customer_ids: list[uuid.UUID]


class SegmentRules(BaseModel):
    conditions: list[dict] = Field(default_factory=list)

class CustomerSegmentBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str | None = None
    rules: dict | None = Field(default_factory=dict)
    match_type: str = "all"
    status: str = "active"

class CustomerSegmentCreate(CustomerSegmentBase):
    pass

class CustomerSegmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    rules: dict | None = None
    match_type: str | None = None
    status: str | None = None

class CustomerSegmentResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    rules: dict | None
    match_type: str
    status: str
    customer_count: int
    created_at: datetime
    updated_at: datetime


class MembershipPlanBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    tier_level: int = Field(default=1, ge=1)
    description: str | None = None
    price: float = Field(default=0.0, ge=0)
    validity_days: int | None = None
    perks: dict | None = Field(default_factory=dict)
    status: str = "active"

class MembershipPlanCreate(MembershipPlanBase):
    pass

class MembershipPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    tier_level: int | None = Field(default=None, ge=1)
    description: str | None = None
    price: float | None = Field(default=None, ge=0)
    validity_days: int | None = None
    perks: dict | None = None
    status: str | None = None

class MembershipPlanResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    tier_level: int
    description: str | None
    price: float
    validity_days: int | None
    perks: dict | None
    status: str
    created_at: datetime
    updated_at: datetime

class MembershipEnrollRequest(BaseModel):
    customer_id: uuid.UUID
    plan_id: uuid.UUID
    validity_days: int | None = None

class CustomerMembershipResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    customer_id: uuid.UUID
    plan_id: uuid.UUID
    status: str
    starts_at: datetime
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WalletTransactionCreate(BaseModel):
    customer_id: uuid.UUID
    transaction_type: str
    amount: float = Field(gt=0)
    description: str | None = None
    reference_type: str | None = None
    reference_id: str | None = None

class WalletTransactionResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    wallet_id: uuid.UUID
    transaction_type: str
    amount: float
    balance_after: float
    reference_type: str | None
    reference_id: str | None
    description: str | None
    created_at: datetime


class LoyaltyProgramBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    points_per_amount: float = Field(default=1.0, ge=0)
    amount_per_point_redemption: float = Field(default=0.1, ge=0)
    min_points_to_redeem: int = Field(default=100, ge=0)
    status: str = "active"

class LoyaltyProgramCreate(LoyaltyProgramBase):
    pass

class LoyaltyProgramUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    points_per_amount: float | None = Field(default=None, ge=0)
    amount_per_point_redemption: float | None = Field(default=None, ge=0)
    min_points_to_redeem: int | None = Field(default=None, ge=0)
    status: str | None = None

class LoyaltyProgramResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    points_per_amount: float
    amount_per_point_redemption: float
    min_points_to_redeem: int
    status: str
    created_at: datetime
    updated_at: datetime

class LoyaltyTransactionCreate(BaseModel):
    customer_id: uuid.UUID
    transaction_type: str
    points: int
    description: str | None = None
    reference_id: str | None = None

class LoyaltyTransactionResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    customer_id: uuid.UUID
    transaction_type: str
    points: int
    points_balance_after: int
    reference_id: str | None
    description: str | None
    created_at: datetime

class CustomerLoyaltySummary(BaseModel):
    customer_id: uuid.UUID
    total_points: int
    lifetime_points_earned: int
    lifetime_points_redeemed: int


class DiscountBase(BaseModel):
    code: str = Field(min_length=2, max_length=100)
    discount_type: str = "percentage"
    value: float = Field(gt=0)
    min_order_amount: float = Field(default=0.0, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    usage_limit: int | None = Field(default=None, ge=1)
    status: str = "active"

class DiscountCreate(DiscountBase):
    pass

class DiscountUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=100)
    discount_type: str | None = None
    value: float | None = Field(default=None, gt=0)
    min_order_amount: float | None = Field(default=None, ge=0)
    max_discount_amount: float | None = Field(default=None, ge=0)
    starts_at: datetime | None = None
    expires_at: datetime | None = None
    usage_limit: int | None = Field(default=None, ge=1)
    status: str | None = None

class DiscountResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    code: str
    discount_type: str
    value: float
    min_order_amount: float
    max_discount_amount: float | None
    starts_at: datetime | None
    expires_at: datetime | None
    usage_limit: int | None
    usage_count: int
    status: str
    created_at: datetime
    updated_at: datetime

class DiscountValidateRequest(BaseModel):
    code: str
    order_amount: float = Field(ge=0)
    customer_id: uuid.UUID | None = None

class DiscountValidateResponse(BaseModel):
    is_valid: bool
    discount_amount: float
    message: str | None = None

