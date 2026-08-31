import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CustomerBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=100)
    company_name: str | None = Field(default=None, max_length=255)
    customer_type: str = "Retail"
    status: str = "Active"
    address: str | None = None
    billing_address: str | None = None
    shipping_address: str | None = None
    addresses: list[dict] | None = Field(default_factory=list)
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
    billing_address: str | None = None
    shipping_address: str | None = None
    addresses: list[dict] | None = None
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
    billing_address: str | None = None
    shipping_address: str | None = None
    addresses: list[dict] | None = None
    gst_number: str | None
    owner_user_id: uuid.UUID | None
    lead_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class LeadBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=100)
    status: str = "New"
    source: str | None = Field(default=None, max_length=150)
    owner_user_id: uuid.UUID | None = None
    estimated_value: float = Field(default=0, ge=0)
    next_follow_up_at: datetime | None = None
    notes: str | None = None
    lost_reason: str | None = Field(default=None, max_length=255)
    call_disposition: str | None = None
    call_duration_minutes: int | None = 0
    customer_response: str | None = None


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
    last_contact_at: datetime | None = None
    next_follow_up_at: datetime | None = None
    notes: str | None = None
    lost_reason: str | None = None
    call_disposition: str | None = None
    call_duration_minutes: int | None = None
    customer_response: str | None = None


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
    owner_name: str | None = None
    owner_email: str | None = None
    calls_count: int | None = 0
    last_call_status: str | None = None
    last_call_sentiment: str | None = None
    estimated_value: float
    last_contact_at: datetime | None
    next_follow_up_at: datetime | None
    notes: str | None
    lost_reason: str | None
    call_disposition: str | None
    call_duration_minutes: int | None
    customer_response: str | None
    created_at: datetime
    updated_at: datetime


class SalesExecutiveResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role_name: str | None = "Sales Executive"
    active_leads_count: int = 0
    total_calls_count: int = 0


class BulkAssignLeadsRequest(BaseModel):
    lead_ids: list[uuid.UUID]
    owner_user_id: uuid.UUID | None = None
    mode: str = "single"  # single | round_robin
    user_ids: list[uuid.UUID] | None = None


class BulkImportLeadItem(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    company_name: str | None = None
    email: str | None = None
    phone: str | None = None
    status: str | None = "New"
    source: str | None = "Bulk Import"
    estimated_value: float | None = 0.0
    notes: str | None = None
    assigned_email: str | None = None
    assigned_user_id: uuid.UUID | None = None


class BulkImportLeadsRequest(BaseModel):
    leads: list[BulkImportLeadItem]
    default_owner_user_id: uuid.UUID | None = None


class BulkImportCustomerItem(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    company_name: str | None = None
    email: str | None = None
    phone: str | None = None
    customer_type: str | None = "Retail"
    status: str | None = "Active"
    address: str | None = None
    gst_number: str | None = None
    assigned_email: str | None = None


class BulkImportCustomersRequest(BaseModel):
    customers: list[BulkImportCustomerItem]
    default_owner_user_id: uuid.UUID | None = None


class ConvertLeadPipelineRequest(BaseModel):
    deal_name: str | None = None
    deal_amount: float | None = None
    deal_stage: str = "Prospecting"
    customer_type: str = "Retail"
    expected_close_date: date | None = None
    notes: str | None = None


class ConvertLeadPipelineResponse(BaseModel):
    lead_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    opportunity_id: uuid.UUID
    deal_name: str
    deal_stage: str
    deal_amount: float
    owner_user_id: uuid.UUID | None = None
    message: str


class LeadActivityCreate(BaseModel):
    lead_id: uuid.UUID | None = None
    opportunity_id: uuid.UUID | None = None
    activity_type: str = Field(min_length=2, max_length=50)  # Call, Note, Meeting, Email, Follow-up
    summary: str = Field(min_length=1)
    call_disposition: str | None = None
    call_duration_minutes: int | None = 0
    customer_response: str | None = None
    occurred_at: datetime | None = None


class LeadActivityResponse(ORMModel):
    id: uuid.UUID
    lead_id: uuid.UUID | None
    opportunity_id: uuid.UUID | None
    activity_type: str
    summary: str
    call_disposition: str | None
    call_duration_minutes: int | None
    customer_response: str | None
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
    notes: str | None = None
    call_disposition: str | None = None
    call_duration_minutes: int | None = 0
    customer_response: str | None = None


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
    notes: str | None = None
    call_disposition: str | None = None
    call_duration_minutes: int | None = None
    customer_response: str | None = None
    last_contact_at: datetime | None = None


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
    owner_name: str | None = None
    owner_email: str | None = None
    customer_name: str | None = None
    calls_count: int | None = 0
    last_call_status: str | None = None
    last_call_sentiment: str | None = None
    next_step: str | None
    next_step_at: datetime | None
    forecast_category: str
    lost_reason: str | None
    notes: str | None
    call_disposition: str | None
    call_duration_minutes: int | None
    customer_response: str | None
    last_contact_at: datetime | None
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
    customer_id: uuid.UUID | None = None
    customer_name: str | None = None
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


class CreatePaidAdRequestSchema(BaseModel):
    campaign_name: str
    adset_name: str
    ad_name: str
    objective: str
    special_ad_categories: list[str] | None = None
    image_url: str
    caption: str
    headline: str
    destination_url: str
    lead_form_id: str | None = None
    cta_type: str | None = "LEARN_MORE"
    daily_budget_cents: int | None = 25000
    lifetime_budget_cents: int | None = None
    targeting: dict | None = None
    start_time: str | None = None
    end_time: str | None = None


# ─── AI Calling Schemas ──────────────────────────────────────────────────────────

class CRMCallInitiateRequest(BaseModel):
    target_type: str = "lead"  # lead | customer | opportunity | deal | quotation | order | ticket | complaint
    target_id: str | uuid.UUID | None = None
    contact_name: str
    contact_phone: str | None = None
    contact_email: str | None = None
    company_name: str | None = None
    agent_persona: str = "Alex - Senior Solutions & Sales Closer"
    custom_prompt: str | None = None
    sip_number: str | None = None  # Optional SIP DID if calling via telephony
    call_mode: str = "browser_ai"  # browser_ai | livekit_sip | webrtc


class CRMCallInitiateResponse(BaseModel):
    call_id: uuid.UUID
    status: str
    room_name: str | None = None
    agent_greeting: str
    contact_name: str
    contact_phone: str | None = None
    agent_persona: str
    battlecards: list[dict] = []
    livekit_url: str | None = None
    livekit_token: str | None = None
    plivo_call_uuid: str | None = None
    sip_trunk_id: str | None = None
    caller_id: str | None = None
    telephony_provider: str = "livekit_plivo"
    carrier_status: str = "connected"
    message: str


class CRMTelephonySettingsSchema(BaseModel):
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret_configured: bool
    sip_trunk_id: str
    plivo_auth_id: str
    plivo_auth_token_configured: bool
    plivo_source_number: str
    plivo_termination_domain: str
    has_livekit: bool
    has_plivo: bool
    status: str


class CRMTelephonySettingsUpdate(BaseModel):
    livekit_url: str | None = None
    livekit_api_key: str | None = None
    livekit_api_secret: str | None = None
    sip_trunk_id: str | None = None
    plivo_auth_id: str | None = None
    plivo_auth_token: str | None = None
    plivo_source_number: str | None = None
    plivo_termination_domain: str | None = None


class CRMCallTurnMessage(BaseModel):
    speaker: str  # AI | User
    text: str
    timestamp: str | None = None


class CRMCallTurnRequest(BaseModel):
    call_id: uuid.UUID
    user_speech: str
    conversation_history: list[CRMCallTurnMessage] = []
    agent_persona: str = "Alex - Senior Solutions & Sales Closer"
    target_type: str = "lead"
    contact_name: str = "Client"
    company_name: str | None = None
    context_notes: str | None = None


class CRMCallTurnResponse(BaseModel):
    ai_response: str
    detected_sentiment: str  # Positive | Neutral | Negative | Objection | Highly Interested
    confidence: float = 0.95
    suggested_objection_handling: str | None = None
    recommended_action: str | None = None


class CRMCallCompleteRequest(BaseModel):
    call_id: uuid.UUID
    duration_seconds: int = 0
    transcript: list[CRMCallTurnMessage] = []
    final_sentiment: str = "Positive"
    status: str = "Completed"  # Completed | No Answer | Busy | Failed
    auto_advance_stage: bool = True
    new_stage_or_status: str | None = None


class CRMCallLogResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    target_type: str
    target_id: uuid.UUID | None
    contact_name: str
    contact_phone: str | None
    contact_email: str | None
    company_name: str | None
    status: str
    direction: str
    duration_seconds: int
    agent_persona: str
    call_mode: str
    transcript: list[dict] | None = []
    ai_summary: str | None
    sentiment: str | None
    qualification_score: int | None
    action_items: list[str] | None = []
    recording_url: str | None
    created_at: datetime


class CRMCallStatsResponse(BaseModel):
    total_calls: int
    connected_calls: int
    avg_duration_seconds: int
    positive_sentiment_rate: float
    avg_qualification_score: int = 0
    leads_contacted_count: int
    opportunities_advanced: int



