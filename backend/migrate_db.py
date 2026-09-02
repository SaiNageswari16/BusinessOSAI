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
    async with engine.begin() as conn:
        # 1. Add settings column to tenants
        try:
            await conn.execute(text("ALTER TABLE tenants ADD COLUMN settings JSONB DEFAULT '{}'::jsonb"))
            logger.info("Successfully added 'settings' column to 'tenants' table.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                logger.info("'settings' column already exists in 'tenants'.")
            else:
                logger.error(f"Error adding 'settings' column to 'tenants': {e}")

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
    ]
    for col_name, alter_sql in alter_job_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(alter_sql))
                logger.info(f"Successfully widened 'job_openings.{col_name}' column.")
            except Exception as e:
                logger.info(f"'job_openings.{col_name}' alter skipped or already widened: {e}")

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

    # Add punch_method, biometric_pin, nfc_card_number to employees
    employee_cols = [
        ("punch_method", "VARCHAR(50) DEFAULT 'GPS'"),
        ("biometric_pin", "VARCHAR(50)"),
        ("nfc_card_number", "VARCHAR(50)"),
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
                logger.info(f"Successfully executed schema update: {stmt}")
            except Exception as e:
                logger.info(f"Migration note for '{stmt}': {e}")

if __name__ == "__main__":
    asyncio.run(migrate())

