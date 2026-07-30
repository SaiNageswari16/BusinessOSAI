-- IOTRONCS Retail — Core ERP Multi-Tenant Schema
-- Import in pgAdmin: Tools → Query Tool → Open File → Execute
-- Connection: use POSTGRES_* values from backend/.env

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enum types ─────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE entity_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE fiscal_year_status AS ENUM ('open', 'locked', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Tenancy & auth ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'starter',
    status tenant_status NOT NULL DEFAULT 'trial',
    subscription_expires_at TIMESTAMPTZ,
    max_users INTEGER NOT NULL DEFAULT 50,
    max_branches INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    company_type VARCHAR(100),
    gst_number VARCHAR(50),
    pan_number VARCHAR(20),
    registration_number VARCHAR(100),
    industry VARCHAR(100),
    country VARCHAR(100),
    state VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    phone VARCHAR(30),
    email VARCHAR(255),
    website VARCHAR(255),
    default_currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    language VARCHAR(20) NOT NULL DEFAULT 'en',
    financial_year_start_month INTEGER NOT NULL DEFAULT 4,
    tax_config_label VARCHAR(100),
    plan VARCHAR(50),
    logo_initials VARCHAR(5),
    established_date DATE,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_companies_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_roles_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permissions UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50),
    phone VARCHAR(30),
    avatar_initials VARCHAR(5),
    status user_status NOT NULL DEFAULT 'active',
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_tenant_owner BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) NOT NULL,
    country VARCHAR(100),
    manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_regions_company_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_zones_region_name UNIQUE (region_id, name)
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(255),
    has_warehouse BOOLEAN NOT NULL DEFAULT FALSE,
    working_hours VARCHAR(100),
    opening_date DATE,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branches_company_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_roles_scope UNIQUE (user_id, role_id, company_id, branch_id)
);

CREATE TABLE IF NOT EXISTS user_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_branches UNIQUE (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Organization ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    head_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_units_company_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) NOT NULL,
    head_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_departments_company_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    level VARCHAR(20),
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_designations_company_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    lead_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_teams_department_name UNIQUE (department_id, name)
);

-- ─── Financial foundation ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    budget_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    expense_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cost_centers_department_code UNIQUE (department_id, code)
);

CREATE TABLE IF NOT EXISTS fiscal_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status fiscal_year_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fiscal_years_company_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
    decimal_places INTEGER NOT NULL DEFAULT 2,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_currencies_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    tax_type VARCHAR(50) NOT NULL,
    rate_percent NUMERIC(8,4) NOT NULL,
    components TEXT,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tax_configurations_company_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS payment_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    days INTEGER NOT NULL DEFAULT 0,
    credit_limit NUMERIC(18,2),
    late_fee_percent NUMERIC(8,4),
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_terms_tenant_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS number_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    module_name VARCHAR(100) NOT NULL,
    prefix VARCHAR(50) NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    padding INTEGER NOT NULL DEFAULT 5,
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_number_series_company_module UNIQUE (company_id, module_name)
);

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    theme VARCHAR(20) NOT NULL DEFAULT 'light',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    status entity_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspaces_tenant_name UNIQUE (tenant_id, name)
);

-- ─── Audit & activity ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    device VARCHAR(100),
    location VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    module VARCHAR(50),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Meta Paid Ads (local mirrors of Meta Marketing API objects) ────────────
CREATE TABLE IF NOT EXISTS fb_ad_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    meta_campaign_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    objective VARCHAR(50) NOT NULL DEFAULT 'OUTCOME_LEADS',
    status VARCHAR(30) NOT NULL DEFAULT 'PAUSED',
    special_ad_categories JSONB DEFAULT '[]'::jsonb,
    start_time TIMESTAMPTZ,
    stop_time TIMESTAMPTZ,
    daily_budget_cents INTEGER,
    lifetime_budget_cents INTEGER,
    meta_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fb_ad_campaigns_tenant_meta UNIQUE (tenant_id, meta_campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_fb_ad_campaigns_tenant ON fb_ad_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fb_ad_campaigns_tenant_status ON fb_ad_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fb_ad_campaigns_meta_id ON fb_ad_campaigns(meta_campaign_id);

CREATE TABLE IF NOT EXISTS fb_ad_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES fb_ad_campaigns(id) ON DELETE CASCADE,
    meta_adset_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    optimization_goal VARCHAR(50) NOT NULL DEFAULT 'LEAD_GENERATION',
    billing_event VARCHAR(30) NOT NULL DEFAULT 'IMPRESSIONS',
    bid_amount_cents INTEGER,
    targeting JSONB DEFAULT '{}'::jsonb,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'PAUSED',
    meta_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fb_ad_sets_tenant_meta UNIQUE (tenant_id, meta_adset_id)
);
CREATE INDEX IF NOT EXISTS idx_fb_ad_sets_tenant ON fb_ad_sets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fb_ad_sets_tenant_campaign ON fb_ad_sets(tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_fb_ad_sets_meta_id ON fb_ad_sets(meta_adset_id);

CREATE TABLE IF NOT EXISTS fb_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    adset_id UUID NOT NULL REFERENCES fb_ad_sets(id) ON DELETE CASCADE,
    meta_ad_id VARCHAR(50) NOT NULL,
    meta_creative_id VARCHAR(50),
    meta_image_hash VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    lead_form_id VARCHAR(50),
    destination_url TEXT,
    headline VARCHAR(255),
    body TEXT,
    cta_type VARCHAR(30),
    status VARCHAR(30) NOT NULL DEFAULT 'PAUSED',
    meta_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fb_ads_tenant_meta UNIQUE (tenant_id, meta_ad_id)
);
CREATE INDEX IF NOT EXISTS idx_fb_ads_tenant ON fb_ads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fb_ads_tenant_adset ON fb_ads(tenant_id, adset_id);
CREATE INDEX IF NOT EXISTS idx_fb_ads_meta_id ON fb_ads(meta_ad_id);

-- ─── Asset Library: AI-generated marketing assets approved for reuse ───
CREATE TABLE IF NOT EXISTS asset_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,                       -- e.g. poster_abc123.jpg
    file_path TEXT NOT NULL,                       -- full path on disk
    public_url TEXT NOT NULL,                      -- /images/poster_abc123.jpg
    thumbnail_url TEXT,
    aspect_ratio VARCHAR(10) NOT NULL DEFAULT '1:1',  -- 1:1, 9:16
    width INTEGER,
    height INTEGER,
    file_size_bytes INTEGER,
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    -- Source / generation metadata
    source VARCHAR(50) NOT NULL DEFAULT 'claude',  -- claude | gemini | openai | upload
    provider_model VARCHAR(100),                    -- claude-3-5-sonnet, imagen-3, etc.
    original_prompt TEXT,
    enhanced_prompt TEXT,
    style VARCHAR(100),
    -- Approval workflow
    approval_status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | approved | rejected
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    -- Usage tracking
    used_in_organic_post BOOLEAN NOT NULL DEFAULT FALSE,
    used_in_paid_campaign BOOLEAN NOT NULL DEFAULT FALSE,
    organic_post_id VARCHAR(100),                  -- FB post_id if posted
    paid_campaign_id UUID REFERENCES fb_ad_campaigns(id) ON DELETE SET NULL,
    -- Categorization
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_library_tenant ON asset_library(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_library_tenant_status ON asset_library(tenant_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_asset_library_tenant_created ON asset_library(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_library_used_organic ON asset_library(tenant_id, used_in_organic_post) WHERE used_in_organic_post = TRUE;
CREATE INDEX IF NOT EXISTS idx_asset_library_used_paid ON asset_library(tenant_id, used_in_paid_campaign) WHERE used_in_paid_campaign = TRUE;

-- ─── Indexes (tenant isolation & lookups) ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
