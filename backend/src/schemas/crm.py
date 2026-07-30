import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ─── Customer 360 — comprehensive fields ──────────────────────────

CUSTOMER_TYPE_OPTIONS = ["Retail", "Corporate", "Wholesale", "VIP", "Distributor", "Dealer", "Government", "Reseller"]
LIFECYCLE_STAGE_OPTIONS = ["Lead", "Prospect", "Trial", "Active", "At-Risk", "Dormant", "Lost", "Champion"]
CUSTOMER_CATEGORY_OPTIONS = ["B2C", "B2B"]
GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"]
SOURCE_OPTIONS = ["Website", "Referral", "Walk-in", "Social Media", "Email", "WhatsApp", "Campaign", "Cold Call", "Marketplace", "Import", "Other"]
PREFERRED_CHANNEL_OPTIONS = ["Email", "SMS", "WhatsApp", "Phone", "In-App", "Push Notification"]
PAYMENT_TERM_OPTIONS = ["Net 15", "Net 30", "Net 45", "Net 60", "COD", "Advance", "Immediate"]


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

    # Identity
    customer_code: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    anniversary_date: date | None = None

    # Contact
    alternate_phone: str | None = None
    whatsapp_number: str | None = None
    website: str | None = None

    # Company / B2B
    designation: str | None = None
    industry: str | None = None
    company_size: str | None = None
    annual_revenue: float | None = None

    # Classification
    customer_category: str = "B2C"
    lifecycle_stage: str = "Lead"
    source: str | None = None
    referred_by: str | None = None

    # Tax
    pan_number: str | None = None
    gst_treatment: str | None = None

    # Addresses
    billing_address: str | None = None
    shipping_address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None

    # Financial
    credit_limit: float | None = None
    payment_terms: str | None = None

    # Engagement
    preferred_language: str | None = "en"
    preferred_channel: str | None = None
    preferred_currency: str | None = "INR"
    timezone: str | None = None
    marketing_opt_in: bool = True
    sms_opt_in: bool = True
    email_opt_in: bool = True
    whatsapp_opt_in: bool = True
    do_not_disturb: bool = False

    # Social handles
    facebook_id: str | None = None
    instagram_handle: str | None = None
    twitter_handle: str | None = None
    linkedin_handle: str | None = None

    # Misc
    notes: str | None = None
    tags: list[str] | None = None
    custom_fields: dict | None = None


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
    customer_code: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    anniversary_date: date | None = None
    alternate_phone: str | None = None
    whatsapp_number: str | None = None
    website: str | None = None
    designation: str | None = None
    industry: str | None = None
    company_size: str | None = None
    annual_revenue: float | None = None
    customer_category: str | None = None
    lifecycle_stage: str | None = None
    source: str | None = None
    referred_by: str | None = None
    pan_number: str | None = None
    gst_treatment: str | None = None
    billing_address: str | None = None
    shipping_address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    credit_limit: float | None = None
    payment_terms: str | None = None
    preferred_language: str | None = None
    preferred_channel: str | None = None
    preferred_currency: str | None = None
    timezone: str | None = None
    marketing_opt_in: bool | None = None
    sms_opt_in: bool | None = None
    email_opt_in: bool | None = None
    whatsapp_opt_in: bool | None = None
    do_not_disturb: bool | None = None
    facebook_id: str | None = None
    instagram_handle: str | None = None
    twitter_handle: str | None = None
    linkedin_handle: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    custom_fields: dict | None = None


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

    customer_code: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    date_of_birth: date | None = None
    anniversary_date: date | None = None

    alternate_phone: str | None = None
    whatsapp_number: str | None = None
    website: str | None = None

    designation: str | None = None
    industry: str | None = None
    company_size: str | None = None
    annual_revenue: float | None = None

    customer_category: str = "B2C"
    lifecycle_stage: str = "Lead"
    source: str | None = None
    referred_by: str | None = None

    pan_number: str | None = None
    gst_treatment: str | None = None

    billing_address: str | None = None
    shipping_address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None

    credit_limit: float | None = None
    payment_terms: str | None = None
    outstanding_balance: float = 0
    lifetime_value: float = 0
    total_orders: int = 0
    total_returns: int = 0
    average_order_value: float = 0
    last_purchase_date: date | None = None
    first_purchase_date: date | None = None

    loyalty_points_balance: int = 0
    loyalty_tier: str | None = None
    loyalty_tier_progress: float = 0
    wallet_balance: float = 0
    wallet_lifetime_credited: float = 0
    wallet_lifetime_debited: float = 0

    preferred_language: str | None = "en"
    preferred_channel: str | None = None
    preferred_currency: str | None = "INR"
    timezone: str | None = None
    marketing_opt_in: bool = True
    sms_opt_in: bool = True
    email_opt_in: bool = True
    whatsapp_opt_in: bool = True
    do_not_disturb: bool = False

    facebook_id: str | None = None
    instagram_handle: str | None = None
    twitter_handle: str | None = None
    linkedin_handle: str | None = None

    rfm_recency_days: int | None = None
    rfm_frequency_score: int | None = None
    rfm_monetary_score: int | None = None
    rfm_segment: str | None = None
    churn_risk_score: float | None = None

    notes: str | None = None
    tags: list | None = None
    custom_fields: dict | None = None
    created_at: datetime
    updated_at: datetime


class CustomerStatsResponse(BaseModel):
    total_customers: int
    active_customers: int
    new_this_month: int
    vip_customers: int
    avg_lifetime_value: float
    total_outstanding: float


# ─── Customer Groups ────────────────────────────────────────────────

class CustomerGroupBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    group_code: str | None = None
    color: str = "#6366f1"
    default_discount_percent: float | None = None
    default_credit_limit: float | None = None
    default_payment_terms: str | None = None
    criteria: dict | None = None
    tags: list[str] | None = None
    status: str = "Active"


class CustomerGroupCreate(CustomerGroupBase):
    pass


class CustomerGroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    group_code: str | None = None
    color: str | None = None
    default_discount_percent: float | None = None
    default_credit_limit: float | None = None
    default_payment_terms: str | None = None
    criteria: dict | None = None
    tags: list[str] | None = None
    status: str | None = None


class CustomerGroupResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    group_code: str | None
    color: str
    default_discount_percent: float | None
    default_credit_limit: float | None
    default_payment_terms: str | None
    criteria: dict | None
    tags: list | None
    status: str
    member_count: int
    is_system: bool
    created_at: datetime
    updated_at: datetime


class GroupMemberAdd(BaseModel):
    customer_ids: list[uuid.UUID]
    reason: str | None = None


class GroupMemberRemove(BaseModel):
    customer_ids: list[uuid.UUID]


# ─── Customer Segments ───────────────────────────────────────────────

class SegmentRules(BaseModel):
    """Rule definition for a dynamic segment."""
    operator: Literal["AND", "OR"] = "AND"
    conditions: list[dict] = []  # [{field, comparator, value}]


class CustomerSegmentBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    color: str = "#6366f1"
    mode: str = "rules"  # rules|manual
    rules: dict | None = None
    manual_customer_ids: list[uuid.UUID] | None = None
    compute_schedule: str | None = None
    tags: list[str] | None = None
    status: str = "Active"


class CustomerSegmentCreate(CustomerSegmentBase):
    pass


class CustomerSegmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    mode: str | None = None
    rules: dict | None = None
    manual_customer_ids: list[uuid.UUID] | None = None
    compute_schedule: str | None = None
    tags: list[str] | None = None
    status: str | None = None


class CustomerSegmentResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    color: str
    mode: str
    is_auto_computed: bool
    rules: dict | None
    manual_customer_ids: list | None
    member_count: int
    total_revenue: float
    avg_ltv: float
    compute_schedule: str | None
    last_computed_at: datetime | None
    last_computed_count: int | None
    status: str
    tags: list | None
    created_at: datetime
    updated_at: datetime


# ─── Membership Plans ────────────────────────────────────────────────

class MembershipTier(BaseModel):
    name: str
    min_points: int = 0
    max_points: int | None = None
    multiplier: float = 1.0
    color: str = "#6366f1"
    benefits: list[str] | None = None


class MembershipPlanBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    plan_code: str | None = None
    price: float = 0
    currency: str = "INR"
    cycle: str = "Monthly"
    points_multiplier: float = 1.0
    discount_percent: float | None = None
    free_shipping: bool = False
    priority_support: bool = False
    early_access: bool = False
    tiers: list[dict] | None = None
    min_qualifying_amount: float | None = None
    max_active_members: int | None = None
    max_duration_months: int | None = None
    status: str = "Active"
    is_visible: bool = True
    terms_conditions: str | None = None


class MembershipPlanCreate(MembershipPlanBase):
    pass


class MembershipPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    plan_code: str | None = None
    price: float | None = None
    currency: str | None = None
    cycle: str | None = None
    points_multiplier: float | None = None
    discount_percent: float | None = None
    free_shipping: bool | None = None
    priority_support: bool | None = None
    early_access: bool | None = None
    tiers: list[dict] | None = None
    min_qualifying_amount: float | None = None
    max_active_members: int | None = None
    max_duration_months: int | None = None
    status: str | None = None
    is_visible: bool | None = None
    terms_conditions: str | None = None


class MembershipPlanResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    plan_code: str | None
    price: float
    currency: str
    cycle: str
    points_multiplier: float
    discount_percent: float | None
    free_shipping: bool
    priority_support: bool
    early_access: bool
    tiers: list | None
    min_qualifying_amount: float | None
    max_active_members: int | None
    max_duration_months: int | None
    status: str
    is_visible: bool
    subscriber_count: int
    terms_conditions: str | None
    created_at: datetime
    updated_at: datetime


class MembershipEnrollRequest(BaseModel):
    customer_id: uuid.UUID
    expires_at: date | None = None


class CustomerMembershipResponse(ORMModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    plan_id: uuid.UUID
    status: str
    enrolled_at: date
    expires_at: date | None
    tier: str | None
    tier_progress: float
    points_earned: int
    points_redeemed: int
    total_spend_with_plan: float
    cancelled_at: datetime | None
    cancellation_reason: str | None
    created_at: datetime
    updated_at: datetime


# ─── Customer Wallet ─────────────────────────────────────────────────

class CustomerWalletResponse(ORMModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    balance: float
    currency: str
    lifetime_credited: float
    lifetime_debited: float
    credit_count: int
    debit_count: int
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class WalletTransactionCreate(BaseModel):
    customer_id: uuid.UUID
    transaction_type: str  # topup|refund|cashback|payment|loyalty_redemption|adjustment|promotion|transfer
    amount: float = Field(gt=0)
    description: str | None = None
    reference_type: str | None = None
    reference_id: uuid.UUID | None = None
    meta: dict | None = None


class WalletTransactionResponse(ORMModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    wallet_id: uuid.UUID
    transaction_type: str
    amount: float
    balance_before: float
    balance_after: float
    reference_type: str | None
    reference_id: uuid.UUID | None
    description: str | None
    meta: dict | None
    initiated_by: uuid.UUID | None
    created_at: datetime


# ─── Loyalty Program ─────────────────────────────────────────────────

TIER_DEFINITIONS = [
    {"name": "Bronze",   "min_points": 0,      "max_points": 999,      "multiplier": 1.0,  "color": "#92400e", "icon": "🥉"},
    {"name": "Silver",   "min_points": 1000,   "max_points": 4999,     "multiplier": 1.5,  "color": "#94a3b8", "icon": "🥈"},
    {"name": "Gold",     "min_points": 5000,   "max_points": 19999,    "multiplier": 2.0,  "color": "#d4a017", "icon": "🥇"},
    {"name": "Platinum", "min_points": 20000,  "max_points": 49999,    "multiplier": 2.5,  "color": "#a5b4fc", "icon": "💎"},
    {"name": "Diamond",  "min_points": 50000,  "max_points": None,     "multiplier": 3.0,  "color": "#06b6d4", "icon": "👑"},
]


class LoyaltyProgramBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = None
    is_active: bool = True
    starts_at: date | None = None
    ends_at: date | None = None
    points_per_currency_unit: float = 1.0
    points_per_referral: int = 0
    bonus_points_on_birthday: int = 0
    bonus_points_on_anniversary: int = 0
    redemption_rate: float = 0.01
    min_redemption_points: int = 100
    max_redemption_per_order_percent: float | None = None
    tier_definitions: list[dict] | None = None
    max_points_expiry_months: int | None = None
    earn_on_payment_methods: list[str] | None = None
    exclude_product_categories: list[str] | None = None
    terms_conditions: str | None = None


class LoyaltyProgramCreate(LoyaltyProgramBase):
    pass


class LoyaltyProgramUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    starts_at: date | None = None
    ends_at: date | None = None
    points_per_currency_unit: float | None = None
    points_per_referral: int | None = None
    bonus_points_on_birthday: int | None = None
    bonus_points_on_anniversary: int | None = None
    redemption_rate: float | None = None
    min_redemption_points: int | None = None
    max_redemption_per_order_percent: float | None = None
    tier_definitions: list[dict] | None = None
    max_points_expiry_months: int | None = None
    earn_on_payment_methods: list[str] | None = None
    exclude_product_categories: list[str] | None = None
    terms_conditions: str | None = None


class LoyaltyProgramResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str | None
    is_active: bool
    starts_at: date | None
    ends_at: date | None
    points_per_currency_unit: float
    points_per_referral: int
    bonus_points_on_birthday: int
    bonus_points_on_anniversary: int
    redemption_rate: float
    min_redemption_points: int
    max_redemption_per_order_percent: float | None
    tier_definitions: list | None
    max_points_expiry_months: int | None
    earn_on_payment_methods: list | None
    exclude_product_categories: list | None
    terms_conditions: str | None
    created_at: datetime
    updated_at: datetime


class LoyaltyTransactionCreate(BaseModel):
    customer_id: uuid.UUID
    transaction_type: str  # earn|redeem|bonus|manual_credit|manual_debit|transfer
    points: int  # positive or negative
    description: str | None = None
    reference_type: str | None = None
    reference_id: uuid.UUID | None = None
    expires_at: date | None = None


class LoyaltyTransactionResponse(ORMModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    transaction_type: str
    points: int
    balance_after: int
    tier_at_time: str | None
    multiplier_applied: float
    reference_type: str | None
    reference_id: uuid.UUID | None
    program_id: uuid.UUID | None
    description: str | None
    meta: dict | None
    initiated_by: uuid.UUID | None
    expires_at: date | None
    created_at: datetime


class CustomerLoyaltySummary(BaseModel):
    customer_id: uuid.UUID
    customer_name: str
    points_balance: int
    tier: str | None
    tier_progress: float
    next_tier: str | None
    points_to_next_tier: int | None
    lifetime_earned: int
    lifetime_redeemed: int
    last_accrued_at: datetime | None
    recent_transactions: list[LoyaltyTransactionResponse]


# ─── Discounts ───────────────────────────────────────────────────────

class DiscountBase(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: str = Field(min_length=2, max_length=100)
    description: str | None = None
    discount_type: str = "percentage"  # percentage|fixed_amount|bogof|free_shipping
    value: float = Field(ge=0)
    max_discount_amount: float | None = None
    min_order_amount: float | None = None
    applies_to: str = "all_customers"
    target_customer_ids: list[uuid.UUID] | None = None
    target_group_ids: list[uuid.UUID] | None = None
    target_segment_ids: list[uuid.UUID] | None = None
    target_membership_ids: list[uuid.UUID] | None = None
    target_product_ids: list[uuid.UUID] | None = None
    target_categories: list[str] | None = None
    applicable_channels: list[str] | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    valid_days_of_week: list[str] | None = None
    valid_time_ranges: list[dict] | None = None
    usage_limit_per_customer: int | None = None
    usage_limit_total: int | None = None
    is_stackable: bool = False
    stack_priority: int = 0
    status: str = "Active"
    priority: int = 0
    is_visible: bool = True
    auto_apply: bool = False
    requires_coupon_code: bool = True
    tags: list[str] | None = None


class DiscountCreate(DiscountBase):
    pass


class DiscountUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    value: float | None = None
    max_discount_amount: float | None = None
    min_order_amount: float | None = None
    applies_to: str | None = None
    target_customer_ids: list[uuid.UUID] | None = None
    target_group_ids: list[uuid.UUID] | None = None
    target_segment_ids: list[uuid.UUID] | None = None
    target_membership_ids: list[uuid.UUID] | None = None
    target_product_ids: list[uuid.UUID] | None = None
    target_categories: list[str] | None = None
    applicable_channels: list[str] | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    valid_days_of_week: list[str] | None = None
    valid_time_ranges: list[dict] | None = None
    usage_limit_per_customer: int | None = None
    usage_limit_total: int | None = None
    is_stackable: bool | None = None
    stack_priority: int | None = None
    status: str | None = None
    priority: int | None = None
    is_visible: bool | None = None
    auto_apply: bool | None = None
    requires_coupon_code: bool | None = None
    tags: list[str] | None = None


class DiscountResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    description: str | None
    discount_type: str
    value: float
    max_discount_amount: float | None
    min_order_amount: float | None
    applies_to: str
    target_customer_ids: list | None
    target_group_ids: list | None
    target_segment_ids: list | None
    target_membership_ids: list | None
    target_product_ids: list | None
    target_categories: list | None
    applicable_channels: list | None
    valid_from: date | None
    valid_until: date | None
    valid_days_of_week: list | None
    valid_time_ranges: list | None
    usage_limit_per_customer: int | None
    usage_limit_total: int | None
    used_count: int
    is_stackable: bool
    stack_priority: int
    status: str
    priority: int
    is_visible: bool
    auto_apply: bool
    requires_coupon_code: bool
    tags: list | None
    created_at: datetime
    updated_at: datetime


class DiscountValidateRequest(BaseModel):
    code: str
    customer_id: uuid.UUID | None = None
    order_amount: float = 0
    product_ids: list[uuid.UUID] | None = None
    categories: list[str] | None = None
    channel: str | None = None


class DiscountValidateResponse(BaseModel):
    valid: bool
    reason: str | None = None
    discount: DiscountResponse | None = None
    discount_amount: float = 0
    final_amount: float


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
    external_id: str | None = None
    external_source: str | None = None
    meta: dict | None = None
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


# ─── Paid Meta Ad schemas ─────────────────────────────────────────────

class CreatePaidAdRequest(BaseModel):
    """Full paid-ad creation payload sent by the frontend wizard."""

    # ── Creative ─────────────────────────────────────────
    image_url: str = Field(min_length=5, max_length=2000)
    caption: str = Field(min_length=1, max_length=5000)
    headline: str | None = Field(default=None, max_length=255)
    cta_type: str = Field(default="LEARN_MORE", max_length=30)

    # ── Destination ──────────────────────────────────────
    lead_form_id: str | None = Field(default=None, max_length=50)
    destination_url: str | None = Field(default=None, max_length=2000)

    # ── Campaign ─────────────────────────────────────────
    campaign_name: str = Field(min_length=1, max_length=255)
    objective: str = Field(default="OUTCOME_LEADS", max_length=50)
    special_ad_categories: list[str] | None = Field(default=None, max_length=10)

    # ── Ad Set ───────────────────────────────────────────
    adset_name: str = Field(min_length=1, max_length=255)
    daily_budget_cents: int = Field(ge=100, le=9_999_999_999)
    lifetime_budget_cents: int | None = Field(default=None, ge=100)
    start_time: str | None = Field(default=None, max_length=30)
    end_time: str | None = Field(default=None, max_length=30)
    targeting: dict | None = Field(default=None)

    # ── Ad ───────────────────────────────────────────────
    ad_name: str = Field(min_length=1, max_length=255)


class ActivateAdRequest(BaseModel):
    status: Literal["ACTIVE", "PAUSED"]


class MetaAdCampaignResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    meta_campaign_id: str
    name: str
    objective: str
    status: str
    special_ad_categories: list[str] | None
    start_time: datetime | None
    stop_time: datetime | None
    daily_budget_cents: int | None
    lifetime_budget_cents: int | None
    meta_payload: dict | None
    created_at: datetime
    updated_at: datetime


class MetaAdSetResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    campaign_id: uuid.UUID
    meta_adset_id: str
    name: str
    optimization_goal: str
    billing_event: str
    bid_amount_cents: int | None
    targeting: dict | None
    start_time: datetime | None
    end_time: datetime | None
    status: str
    meta_payload: dict | None
    created_at: datetime
    updated_at: datetime


class MetaAdResponse(ORMModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    adset_id: uuid.UUID
    meta_ad_id: str
    meta_creative_id: str | None
    meta_image_hash: str | None
    name: str
    lead_form_id: str | None
    destination_url: str | None
    headline: str | None
    body: str | None
    cta_type: str | None
    status: str
    meta_payload: dict | None
    created_at: datetime
    updated_at: datetime


class MetaAdInsights(BaseModel):
    spend: str
    impressions: str
    clicks: str
    ctr: str
    reach: str
    frequency: str
    cpc: str | None = None
    cpm: str | None = None


class PaidCampaignListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[MetaAdCampaignResponse]


class LeadFormInfo(BaseModel):
    id: str
    name: str
    status: str
    leads_count: int = 0
