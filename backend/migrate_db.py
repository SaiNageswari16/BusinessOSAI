import asyncio
import logging
from sqlalchemy import text
from src.database.session import engine
from src.database.base import Base
import src.models  # Crucial to register all model classes with Base.metadata

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration")

async def migrate():
    logger.info("Initializing schema check and migration...")
    async with engine.begin() as conn:
        # Create all tables first (handles new tables crm_support_tickets, crm_quotations, crm_sales_orders)
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Ensured all new tables exist in schema metadata.")

    # Run ALTER statements in separate transactions to avoid transaction abort locks
    # 1. Add settings column to tenants
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb"))
            logger.info("Successfully added 'settings' column to 'tenants' table.")
        except Exception as e:
            logger.info(f"Tenant settings note: {e}")

    # 2. Add columns to companies (Google Reviews, GSP Credentials, GST Registrations, Logos)
    company_cols = [
        ("google_review_url", "VARCHAR(500)"),
        ("google_place_id", "VARCHAR(150)"),
        ("google_review_enabled", "BOOLEAN DEFAULT FALSE"),
        ("gsp_credentials", "JSONB DEFAULT '{}'::jsonb"),
        ("gst_registrations", "JSONB DEFAULT '[]'::jsonb"),
        ("established_date", "DATE"),
        ("tax_config_label", "VARCHAR(50)"),
        ("logo_url", "TEXT"),
        ("logo_initials", "VARCHAR(10)"),
        ("email_settings", "JSONB DEFAULT '{}'::jsonb"),
        ("bank_name", "VARCHAR(150)"),
    ]
    for name, col_type in company_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE companies ADD COLUMN IF NOT EXISTS {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'companies' table.")
            except Exception as e:
                logger.info(f"Company column {name} note: {e}")

    # 3. Delivery Challans constraints and columns
    challan_stmts = [
        "ALTER TABLE delivery_challans DROP CONSTRAINT IF EXISTS delivery_challans_invoice_id_fkey;",
        "ALTER TABLE delivery_challans DROP CONSTRAINT IF EXISTS delivery_challans_customer_id_fkey;",
        "ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);",
        "ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);",
    ]
    for stmt in challan_stmts:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                logger.info("Successfully executed delivery challan schema update.")
            except Exception as e:
                logger.info(f"Challan schema note: {e}")

    # 4. POS Transactions status types
    pos_stmts = [
        "ALTER TABLE pos_transactions ALTER COLUMN status TYPE VARCHAR(50) USING status::VARCHAR(50);",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'credit';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'partially_paid';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'completed';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'refunded';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'on_hold';",
    ]
    for stmt in pos_stmts:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                logger.info("Successfully executed pos transaction schema update.")
            except Exception as e:
                logger.info(f"POS schema note: {e}")

    # Add columns to crm_leads one by one in separate blocks
    columns_to_add = [
        ("external_id", "VARCHAR(100)"),
        ("external_source", "VARCHAR(50)"),
        ("meta", "JSONB DEFAULT '{}'::jsonb"),
        ("ai_score", "INTEGER"),
        ("ai_sentiment", "VARCHAR(50)")
    ]
    
    for name, col_type in columns_to_add:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE crm_leads ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'crm_leads' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'crm_leads'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'crm_leads': {e}")

    # Add address columns to crm_customers
    customer_columns_to_add = [
        ("billing_address", "TEXT"),
        ("shipping_address", "TEXT"),
    ]
    
    for name, col_type in customer_columns_to_add:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE crm_customers ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'crm_customers' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'crm_customers'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'crm_customers': {e}")

    # Add columns to ar_invoice_lines for POS Sales
    invoice_lines_columns = [
        ("batch_number", "VARCHAR(100)"),
        ("expiry_date", "DATE"),
        ("mfg_date", "DATE"),
        ("mrp", "NUMERIC(18, 2)")
    ]

    for name, col_type in invoice_lines_columns:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE ar_invoice_lines ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'ar_invoice_lines' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'ar_invoice_lines'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'ar_invoice_lines': {e}")

    # Add RAG tracking columns to erp_master_catalog
    catalog_cols = [
        ("ai_search_done", "BOOLEAN DEFAULT FALSE NOT NULL"),
        ("rag_status", "VARCHAR(50) DEFAULT 'pending'"),
        ("rag_enriched_at", "TIMESTAMP"),
        ("rag_error", "TEXT")
    ]
    for name, col_type in catalog_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE erp_master_catalog ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'erp_master_catalog' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'erp_master_catalog'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'erp_master_catalog': {e}")

    # Add sync tracking columns to job_openings
    job_cols = [
        ("provider", "VARCHAR(50)"),
        ("provider_job_id", "VARCHAR(100)"),
        ("sync_status", "VARCHAR(50)"),
        ("last_synced", "TIMESTAMP WITH TIME ZONE")
    ]
    for name, col_type in job_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE job_openings ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'job_openings' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'job_openings'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'job_openings': {e}")

    # Add sync tracking columns to recruitment_applicants
    applicant_cols = [
        ("provider_candidate_id", "VARCHAR(100)"),
        ("sync_status", "VARCHAR(50)")
    ]
    for name, col_type in applicant_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE recruitment_applicants ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'recruitment_applicants' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'recruitment_applicants'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'recruitment_applicants': {e}")

    # Add sync tracking columns to recruitment_interviews
    interview_cols = [
        ("provider_interview_id", "VARCHAR(100)"),
        ("sync_status", "VARCHAR(50)")
    ]
    for name, col_type in interview_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE recruitment_interviews ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'recruitment_interviews' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'recruitment_interviews'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'recruitment_interviews': {e}")

    # ─── Widen job_openings columns for AI-generated JDs ──────────────────
    # criteria was VARCHAR(255) — Claude generates long skill lists that exceed this
    # department was VARCHAR(100) — needs room for "Data Science & Analytics" etc.
    alter_job_cols = [
        ("criteria",   "ALTER TABLE job_openings ALTER COLUMN criteria TYPE TEXT"),
        ("department", "ALTER TABLE job_openings ALTER COLUMN department TYPE VARCHAR(200)"),
        ("erp_products.image_url", "ALTER TABLE erp_products ALTER COLUMN image_url TYPE TEXT"),
        ("erp_master_catalog.image_url", "ALTER TABLE erp_master_catalog ALTER COLUMN image_url TYPE TEXT"),
        ("erp_brands.image_url", "ALTER TABLE erp_brands ALTER COLUMN image_url TYPE TEXT"),
    ]
    for col_name, alter_sql in alter_job_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(alter_sql))
                logger.info(f"Successfully executed schema alteration for '{col_name}'.")
            except Exception as e:
                logger.info(f"'{col_name}' alter note: {e}")

    # Add is_tax_inclusive column to erp_products and erp_master_catalog
    tax_mode_cols = [
        ("erp_products", "is_tax_inclusive", "BOOLEAN DEFAULT TRUE"),
        ("erp_master_catalog", "is_tax_inclusive", "BOOLEAN DEFAULT TRUE")
    ]
    for table_name, name, col_type in tax_mode_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to '{table_name}' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in '{table_name}'.")
                else:
                    logger.error(f"Error adding '{name}' column to '{table_name}': {e}")

    # Add specifications column to erp_products and erp_master_catalog
    spec_cols = [
        ("erp_products", "specifications", "JSONB DEFAULT '{}'::jsonb"),
        ("erp_master_catalog", "specifications", "TEXT"),
        ("erp_brands", "image_url", "VARCHAR(1024)"),
        ("erp_brands", "category", "VARCHAR(100)"),
        ("erp_uoms", "unit_type", "VARCHAR(50)"),
        ("erp_uoms", "base_unit", "BOOLEAN DEFAULT FALSE"),
        ("erp_uoms", "conversion_rate", "FLOAT DEFAULT 1.0"),
        ("erp_uoms", "unit_symbol", "VARCHAR(20)")
    ]
    for table_name, name, col_type in spec_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to '{table_name}' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in '{table_name}'.")
                else:
                    logger.error(f"Error adding '{name}' column to '{table_name}': {e}")

    # Add punch_method, biometric_pin, nfc_card_number, user_id, basic_salary, sales_points to employees
    employee_cols = [
        ("punch_method", "VARCHAR(50) DEFAULT 'GPS'"),
        ("biometric_pin", "VARCHAR(50)"),
        ("nfc_card_number", "VARCHAR(50)"),
        ("basic_salary", "NUMERIC(12, 2)"),
        ("sales_points", "NUMERIC(12, 2) DEFAULT 0.0"),
        ("user_id", "UUID REFERENCES users(id) ON DELETE SET NULL"),
    ]
    for name, col_type in employee_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE employees ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'employees' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'employees'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'employees': {e}")

    # Add columns to attendance_records
    attendance_cols = [
        ("ip_address", "VARCHAR(50)"),
        ("check_in_selfie_url", "TEXT"),
        ("check_out_selfie_url", "TEXT"),
        ("is_face_verified", "BOOLEAN DEFAULT FALSE"),
        ("is_geofence_verified", "BOOLEAN DEFAULT FALSE"),
        ("is_wfh", "BOOLEAN DEFAULT FALSE"),
    ]
    for name, col_type in attendance_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE attendance_records ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to 'attendance_records' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in 'attendance_records'.")
                else:
                    logger.error(f"Error adding '{name}' column to 'attendance_records': {e}")

    # Add columns to crm_leads and crm_opportunities
    crm_cols = [
        ("crm_leads", "notes", "TEXT"),
        ("crm_leads", "last_contacted_at", "TIMESTAMPTZ"),
        ("crm_leads", "call_disposition", "VARCHAR(100)"),
        ("crm_leads", "call_duration_minutes", "INTEGER DEFAULT 0"),
        ("crm_leads", "next_followup_date", "TIMESTAMPTZ"),
        ("crm_leads", "customer_response", "TEXT"),
        ("crm_opportunities", "notes", "TEXT"),
        ("crm_opportunities", "last_contacted_at", "TIMESTAMPTZ"),
        ("crm_opportunities", "call_disposition", "VARCHAR(100)"),
        ("crm_opportunities", "call_duration_minutes", "INTEGER DEFAULT 0"),
        ("crm_opportunities", "next_followup_date", "TIMESTAMPTZ"),
        ("crm_opportunities", "customer_response", "TEXT"),
    ]
    for table_name, name, col_type in crm_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {col_type}"))
                logger.info(f"Successfully added '{name}' column to '{table_name}' table.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.info(f"'{name}' column already exists in '{table_name}'.")
                else:
                    logger.error(f"Error adding '{name}' column to '{table_name}': {e}")

    # ── 3-Way Match: Add grn_id FK to erp_vendor_bills ──────────────────────
    async with engine.begin() as conn:
        try:
            await conn.execute(text(
                "ALTER TABLE erp_vendor_bills ADD COLUMN grn_id UUID REFERENCES erp_goods_received_notes(id) ON DELETE SET NULL"
            ))
            logger.info("Successfully added 'grn_id' FK column to 'erp_vendor_bills' for 3-way match.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                logger.info("'grn_id' column already exists in 'erp_vendor_bills'.")
            else:
                logger.error(f"Error adding 'grn_id' to 'erp_vendor_bills': {e}")

    # ── HRMS: Offer Letters & Manual Applicants Schema Updates ──────────────
    recruitment_statements = [
        "ALTER TABLE recruitment_offer_letters ALTER COLUMN applicant_id DROP NOT NULL",
        "ALTER TABLE recruitment_offer_letters ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE CASCADE",
        "ALTER TABLE recruitment_offer_letters ADD COLUMN IF NOT EXISTS candidate_email VARCHAR(150)",
        "ALTER TABLE recruitment_applicants ALTER COLUMN job_id DROP NOT NULL",
        "ALTER TABLE recruitment_applicants ADD COLUMN IF NOT EXISTS phone VARCHAR(30)",
        "ALTER TABLE recruitment_applicants ADD COLUMN IF NOT EXISTS notice_period_days INTEGER DEFAULT 30",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}'::jsonb"
    ]

    for stmt in recruitment_statements:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                logger.info("Successfully executed recruitment schema update.")
            except Exception as e:
                logger.info(f"Migration note for recruitment update: {e}")

    # ── HRMS: Payslip Templates Schema Updates ──────────────────────────
    payslip_template_statements = [
        """
        CREATE TABLE IF NOT EXISTS hrms_payslip_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255),
            template_type VARCHAR(50) DEFAULT 'custom',
            is_default BOOLEAN DEFAULT FALSE,
            theme_config JSONB DEFAULT '{}'::jsonb,
            header_config JSONB DEFAULT '{}'::jsonb,
            fields_config JSONB DEFAULT '{}'::jsonb,
            notes_config JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_hrms_payslip_templates_tenant_id ON hrms_payslip_templates(tenant_id)",
        "ALTER TABLE payslips ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES hrms_payslip_templates(id) ON DELETE SET NULL",
    ]

    for stmt in payslip_template_statements:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                logger.info("Successfully executed payslip template schema update.")
            except Exception as e:
                logger.info(f"Migration note for payslip template update: {e}")

    # ── HRMS: Loans, Advances, Bonuses, Commissions Tables ───────────────
    payroll_addon_statements = [
        """
        CREATE TABLE IF NOT EXISTS hrms_employee_loans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            loan_type VARCHAR(50) DEFAULT 'Personal',
            principal_amount NUMERIC(12, 2) NOT NULL,
            interest_rate NUMERIC(5, 2) DEFAULT 0.0,
            tenure_months INTEGER NOT NULL DEFAULT 12,
            monthly_emi NUMERIC(12, 2) NOT NULL,
            total_repayable NUMERIC(12, 2) NOT NULL,
            amount_repaid NUMERIC(12, 2) DEFAULT 0.0,
            remaining_balance NUMERIC(12, 2) NOT NULL,
            start_month INTEGER DEFAULT 7,
            start_year INTEGER DEFAULT 2026,
            status VARCHAR(30) DEFAULT 'Approved',
            reason VARCHAR(255),
            approved_by VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_hrms_employee_loans_tenant ON hrms_employee_loans(tenant_id)",
        """
        CREATE TABLE IF NOT EXISTS hrms_salary_advances (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            amount NUMERIC(12, 2) NOT NULL,
            reason VARCHAR(255) NOT NULL,
            request_date DATE DEFAULT CURRENT_DATE,
            recovery_month INTEGER DEFAULT 7,
            recovery_year INTEGER DEFAULT 2026,
            status VARCHAR(30) DEFAULT 'Approved',
            approved_by VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_hrms_salary_advances_tenant ON hrms_salary_advances(tenant_id)",
        """
        CREATE TABLE IF NOT EXISTS hrms_employee_bonuses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
            bonus_title VARCHAR(100) NOT NULL,
            bonus_type VARCHAR(50) DEFAULT 'Festive',
            amount NUMERIC(12, 2) NOT NULL,
            distribution_month INTEGER DEFAULT 7,
            distribution_year INTEGER DEFAULT 2026,
            status VARCHAR(30) DEFAULT 'Disbursed',
            remarks VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_hrms_employee_bonuses_tenant ON hrms_employee_bonuses(tenant_id)",
        """
        CREATE TABLE IF NOT EXISTS hrms_sales_commissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            period_month INTEGER DEFAULT 7,
            period_year INTEGER DEFAULT 2026,
            target_amount NUMERIC(14, 2) DEFAULT 0.0,
            achieved_amount NUMERIC(14, 2) DEFAULT 0.0,
            commission_rate NUMERIC(5, 2) DEFAULT 5.0,
            commission_amount NUMERIC(12, 2) NOT NULL,
            status VARCHAR(30) DEFAULT 'Approved',
            notes VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_hrms_sales_commissions_tenant ON hrms_sales_commissions(tenant_id)",
    ]

    for stmt in payroll_addon_statements:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                logger.info("Successfully executed payroll addon schema update.")
            except Exception as e:
                logger.info(f"Migration note for payroll addon update: {e}")

    push_notification_statements = [
        """
        CREATE TABLE IF NOT EXISTS push_notification_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            category VARCHAR(50) DEFAULT 'hrms',
            title_template VARCHAR(255) NOT NULL,
            body_template TEXT NOT NULL,
            action_url VARCHAR(500),
            priority VARCHAR(30) DEFAULT 'normal',
            icon_type VARCHAR(50) DEFAULT 'bell',
            is_system BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_push_notification_templates_tenant ON push_notification_templates(tenant_id)",
        """
        CREATE TABLE IF NOT EXISTS notification_broadcasts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
            template_id UUID REFERENCES push_notification_templates(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            category VARCHAR(50) DEFAULT 'system',
            target_type VARCHAR(50) DEFAULT 'all_org',
            target_filter JSONB DEFAULT '[]'::jsonb,
            action_url VARCHAR(500),
            recipients_count INTEGER DEFAULT 0,
            status VARCHAR(50) DEFAULT 'sent',
            scheduled_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_notification_broadcasts_tenant ON notification_broadcasts(tenant_id)",
        """
        CREATE TABLE IF NOT EXISTS user_device_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            device_token TEXT NOT NULL,
            platform VARCHAR(30) DEFAULT 'web',
            device_name VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            last_used_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT uq_user_device_token UNIQUE (user_id, device_token)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_device_tokens_user ON user_device_tokens(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_device_tokens_tenant ON user_device_tokens(tenant_id)",
    ]

    for stmt in push_notification_statements:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                logger.info("Successfully executed push notification schema update.")
            except Exception as e:
                logger.info(f"Migration note for push notification update: {e}")

    passkey_statements = [
        """
        CREATE TABLE IF NOT EXISTS user_passkeys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            credential_id VARCHAR(500) NOT NULL UNIQUE,
            public_key TEXT NOT NULL,
            sign_count INTEGER DEFAULT 0,
            device_name VARCHAR(150) DEFAULT 'Biometric Authenticator',
            aaguid VARCHAR(100),
            transports JSONB DEFAULT '[]'::jsonb,
            is_active BOOLEAN DEFAULT TRUE,
            last_used_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_passkeys_user ON user_passkeys(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_passkeys_tenant ON user_passkeys(tenant_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_passkeys_cred ON user_passkeys(credential_id)",
    ]

    for stmt in passkey_statements:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                logger.info("Successfully executed passkey biometric schema update.")
            except Exception as e:
                logger.info(f"Migration note for passkey update: {e}")

    fingerprint_statements = [
        """
        CREATE TABLE IF NOT EXISTS user_fingerprints (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            finger_name VARCHAR(50) DEFAULT 'Right Thumb',
            device_brand VARCHAR(80) DEFAULT 'Mantra MFS100',
            template_iso TEXT NOT NULL,
            minutiae_hash VARCHAR(128),
            quality_score INTEGER DEFAULT 80,
            is_active BOOLEAN DEFAULT TRUE,
            last_used_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_user_fingerprints_user ON user_fingerprints(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_fingerprints_tenant ON user_fingerprints(tenant_id)",
        "CREATE INDEX IF NOT EXISTS ix_user_fingerprints_hash ON user_fingerprints(minutiae_hash)",
    ]

    for stmt in fingerprint_statements:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                logger.info("Successfully executed optical fingerprint schema update.")
            except Exception as e:
                logger.info(f"Migration note for optical fingerprint update: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())

