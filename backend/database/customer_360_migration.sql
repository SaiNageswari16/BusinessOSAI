-- Customer 360 Migration
-- Adds comprehensive customer fields + Customer Groups + Customer Segments +
-- Membership Plans + Customer Wallets + Loyalty Programs + Discounts.
-- Idempotent — safe to run multiple times.

-- ════════════════════════════════════════════════════════════════════════
-- 1. EXTEND crm_customers with Customer 360 fields
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS first_name VARCHAR(150);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS last_name VARCHAR(150);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS anniversary_date DATE;

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(30);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS website VARCHAR(255);

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS designation VARCHAR(150);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(18,2);

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS customer_category VARCHAR(30) DEFAULT 'B2C';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(30) DEFAULT 'Lead';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS source VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS referred_by VARCHAR(255);

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(50);

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(18,2);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(18,2) DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC(18,2) DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS total_returns INTEGER DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS average_order_value NUMERIC(18,2) DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS last_purchase_date DATE;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS first_purchase_date DATE;

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS loyalty_points_balance INTEGER DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(50);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS loyalty_tier_progress NUMERIC(5,2) DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(18,2) DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS wallet_lifetime_credited NUMERIC(18,2) DEFAULT 0;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS wallet_lifetime_debited NUMERIC(18,2) DEFAULT 0;

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT 'en';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS preferred_channel VARCHAR(30);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT TRUE;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT TRUE;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT TRUE;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT TRUE;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS do_not_disturb BOOLEAN DEFAULT FALSE;

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS linkedin_handle VARCHAR(100);

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS rfm_recency_days INTEGER;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS rfm_frequency_score INTEGER;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS rfm_monetary_score INTEGER;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS rfm_segment VARCHAR(50);
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS churn_risk_score NUMERIC(5,2);

ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_crm_customers_code ON crm_customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_crm_customers_lifecycle ON crm_customers(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_crm_customers_category ON crm_customers(customer_category);

-- ════════════════════════════════════════════════════════════════════════
-- 2. CUSTOMER GROUPS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_customer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    group_code VARCHAR(50),
    color VARCHAR(20) DEFAULT '#6366f1',
    default_discount_percent NUMERIC(5,2),
    default_credit_limit NUMERIC(18,2),
    default_payment_terms VARCHAR(100),
    criteria JSONB DEFAULT '{}'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(30) DEFAULT 'Active',
    member_count INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_crm_groups_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_crm_groups_tenant ON crm_customer_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_groups_code ON crm_customer_groups(group_code);

CREATE TABLE IF NOT EXISTS crm_customer_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES crm_customer_groups(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_group_customer UNIQUE (group_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_customer ON crm_customer_group_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON crm_customer_group_members(group_id);

-- ════════════════════════════════════════════════════════════════════════
-- 3. CUSTOMER SEGMENTS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#6366f1',
    mode VARCHAR(30) DEFAULT 'rules',
    is_auto_computed BOOLEAN DEFAULT TRUE,
    rules JSONB DEFAULT '{}'::jsonb,
    manual_customer_ids JSONB DEFAULT '[]'::jsonb,
    member_count INTEGER DEFAULT 0,
    total_revenue NUMERIC(18,2) DEFAULT 0,
    avg_ltv NUMERIC(18,2) DEFAULT 0,
    compute_schedule VARCHAR(50),
    last_computed_at TIMESTAMPTZ,
    last_computed_count INTEGER,
    status VARCHAR(30) DEFAULT 'Active',
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_crm_segments_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_crm_segments_tenant ON crm_customer_segments(tenant_id);

-- ════════════════════════════════════════════════════════════════════════
-- 4. MEMBERSHIP PLANS + CUSTOMER MEMBERSHIPS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    plan_code VARCHAR(50),
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    cycle VARCHAR(30) DEFAULT 'Monthly',
    points_multiplier NUMERIC(4,2) DEFAULT 1.0,
    discount_percent NUMERIC(5,2),
    free_shipping BOOLEAN DEFAULT FALSE,
    priority_support BOOLEAN DEFAULT FALSE,
    early_access BOOLEAN DEFAULT FALSE,
    tiers JSONB DEFAULT '[]'::jsonb,
    min_qualifying_amount NUMERIC(12,2),
    max_active_members INTEGER,
    max_duration_months INTEGER,
    status VARCHAR(30) DEFAULT 'Active',
    is_visible BOOLEAN DEFAULT TRUE,
    subscriber_count INTEGER DEFAULT 0,
    terms_conditions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_membership_plans_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_code ON crm_membership_plans(plan_code);
CREATE INDEX IF NOT EXISTS idx_membership_plans_tenant ON crm_membership_plans(tenant_id);

CREATE TABLE IF NOT EXISTS crm_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES crm_membership_plans(id) ON DELETE RESTRICT,
    status VARCHAR(30) DEFAULT 'Active',
    enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
    expires_at DATE,
    tier VARCHAR(50),
    tier_progress NUMERIC(5,2) DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    total_spend_with_plan NUMERIC(18,2) DEFAULT 0,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_memberships_tenant_customer UNIQUE (tenant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_customer ON crm_memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_plan ON crm_memberships(plan_id);

-- ════════════════════════════════════════════════════════════════════════
-- 5. CUSTOMER WALLET
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    balance NUMERIC(18,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'INR',
    lifetime_credited NUMERIC(18,2) DEFAULT 0,
    lifetime_debited NUMERIC(18,2) DEFAULT 0,
    credit_count INTEGER DEFAULT 0,
    debit_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wallets_tenant_customer UNIQUE (tenant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_wallets_customer ON crm_wallets(customer_id);

CREATE TABLE IF NOT EXISTS crm_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES crm_wallets(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    balance_before NUMERIC(18,2) NOT NULL,
    balance_after NUMERIC(18,2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description VARCHAR(500),
    meta JSONB DEFAULT '{}'::jsonb,
    initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_wallet_tx_customer ON crm_wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_tx_wallet ON crm_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_tx_type ON crm_wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_crm_wallet_tx_created ON crm_wallet_transactions(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════
-- 6. LOYALTY PROGRAM + LOYALTY TRANSACTIONS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    starts_at DATE,
    ends_at DATE,
    points_per_currency_unit NUMERIC(8,4) DEFAULT 1,
    points_per_referral INTEGER DEFAULT 0,
    bonus_points_on_birthday INTEGER DEFAULT 0,
    bonus_points_on_anniversary INTEGER DEFAULT 0,
    redemption_rate NUMERIC(8,4) DEFAULT 0.01,
    min_redemption_points INTEGER DEFAULT 100,
    max_redemption_per_order_percent NUMERIC(5,2),
    tier_definitions JSONB DEFAULT '[]'::jsonb,
    max_points_expiry_months INTEGER,
    earn_on_payment_methods JSONB DEFAULT '[]'::jsonb,
    exclude_product_categories JSONB DEFAULT '[]'::jsonb,
    terms_conditions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_loyalty_programs_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_programs_active ON crm_loyalty_programs(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS crm_loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
    transaction_type VARCHAR(30) NOT NULL,
    points INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    tier_at_time VARCHAR(50),
    multiplier_applied NUMERIC(4,2) DEFAULT 1,
    reference_type VARCHAR(50),
    reference_id UUID,
    program_id UUID REFERENCES crm_loyalty_programs(id) ON DELETE SET NULL,
    description VARCHAR(500),
    meta JSONB DEFAULT '{}'::jsonb,
    initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON crm_loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_type ON crm_loyalty_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created ON crm_loyalty_transactions(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════
-- 7. DISCOUNTS
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(30) NOT NULL,
    value NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_discount_amount NUMERIC(12,2),
    min_order_amount NUMERIC(12,2),
    applies_to VARCHAR(30) DEFAULT 'all_customers',
    target_customer_ids JSONB DEFAULT '[]'::jsonb,
    target_group_ids JSONB DEFAULT '[]'::jsonb,
    target_segment_ids JSONB DEFAULT '[]'::jsonb,
    target_membership_ids JSONB DEFAULT '[]'::jsonb,
    target_product_ids JSONB DEFAULT '[]'::jsonb,
    target_categories JSONB DEFAULT '[]'::jsonb,
    applicable_channels JSONB DEFAULT '[]'::jsonb,
    valid_from DATE,
    valid_until DATE,
    valid_days_of_week JSONB DEFAULT '[]'::jsonb,
    valid_time_ranges JSONB DEFAULT '[]'::jsonb,
    usage_limit_per_customer INTEGER,
    usage_limit_total INTEGER,
    used_count INTEGER DEFAULT 0,
    used_customer_ids JSONB DEFAULT '[]'::jsonb,
    is_stackable BOOLEAN DEFAULT FALSE,
    stack_priority INTEGER DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Active',
    priority INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE,
    auto_apply BOOLEAN DEFAULT FALSE,
    requires_coupon_code BOOLEAN DEFAULT TRUE,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_crm_discounts_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_crm_discounts_code ON crm_discounts(code);
CREATE INDEX IF NOT EXISTS idx_crm_discounts_status ON crm_discounts(status);
CREATE INDEX IF NOT EXISTS idx_crm_discounts_validity ON crm_discounts(valid_from, valid_until);

-- ════════════════════════════════════════════════════════════════════════
-- 8. NEW PERMISSIONS (seeded for RBAC)
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO permissions (code, name, module, description, created_at, updated_at)
SELECT v.code, v.name, v.module, v.description, NOW(), NOW()
FROM (VALUES
    ('view:crm_groups',        'View Customer Groups',        'crm', 'Can view customer groups'),
    ('manage:crm_groups',      'Manage Customer Groups',      'crm', 'Can create/edit/delete customer groups'),
    ('view:crm_segments',      'View Customer Segments',      'crm', 'Can view customer segments'),
    ('manage:crm_segments',    'Manage Customer Segments',    'crm', 'Can create/edit/delete customer segments'),
    ('view:crm_memberships',   'View Membership Plans',       'crm', 'Can view membership plans'),
    ('manage:crm_memberships', 'Manage Membership Plans',     'crm', 'Can create/edit membership plans'),
    ('view:crm_wallet',        'View Customer Wallet',        'crm', 'Can view customer wallet'),
    ('manage:crm_wallet',      'Manage Customer Wallet',      'crm', 'Can credit/debit wallet'),
    ('view:crm_loyalty',       'View Loyalty Program',        'crm', 'Can view loyalty program'),
    ('manage:crm_loyalty',     'Manage Loyalty Program',      'crm', 'Can configure loyalty program'),
    ('view:crm_discounts',     'View Discounts',              'crm', 'Can view discounts'),
    ('manage:crm_discounts',   'Manage Discounts',            'crm', 'Can create/edit discounts')
) AS v(code, name, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.code = v.code);
