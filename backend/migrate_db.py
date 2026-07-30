import asyncio
import logging
from pathlib import Path

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

    # ─── Add missing timestamp columns to erp_traceability_events ────────────
    # TraceabilityEvent got TimestampMixin added after the table was first created
    trace_ts_cols = [
        ("created_at", "TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL"),
        ("updated_at", "TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL"),
    ]
    for name, col_type in trace_ts_cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"ALTER TABLE erp_traceability_events ADD COLUMN {name} {col_type}"))
                logger.info(f"Added '{name}' to 'erp_traceability_events'.")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info(f"'{name}' already exists in 'erp_traceability_events'.")
                else:
                    logger.error(f"Error adding '{name}' to traceability_events: {e}")

    # ─── Ensure new inventory tables exist ──────────────────────────────────
    # create_all handles new tables but won't alter existing ones
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Ensured all new inventory tables exist.")

    # ─── Customer 360: extend crm_customers columns ──────────────────────────
    async with engine.begin() as conn:
        customer_cols = [
            ("customer_code",           "VARCHAR(50)"),
            ("first_name",              "VARCHAR(150)"),
            ("last_name",               "VARCHAR(150)"),
            ("gender",                  "VARCHAR(20)"),
            ("date_of_birth",           "DATE"),
            ("anniversary_date",        "DATE"),
            ("alternate_phone",         "VARCHAR(30)"),
            ("whatsapp_number",         "VARCHAR(30)"),
            ("website",                 "VARCHAR(255)"),
            ("designation",             "VARCHAR(150)"),
            ("industry",                "VARCHAR(100)"),
            ("company_size",            "VARCHAR(50)"),
            ("annual_revenue",          "NUMERIC(18,2)"),
            ("customer_category",       "VARCHAR(30) DEFAULT 'B2C'"),
            ("lifecycle_stage",         "VARCHAR(30) DEFAULT 'Lead'"),
            ("source",                  "VARCHAR(100)"),
            ("referred_by",             "VARCHAR(255)"),
            ("pan_number",              "VARCHAR(20)"),
            ("gst_treatment",           "VARCHAR(50)"),
            ("billing_address",         "TEXT"),
            ("shipping_address",        "TEXT"),
            ("city",                    "VARCHAR(100)"),
            ("state",                   "VARCHAR(100)"),
            ("country",                 "VARCHAR(100)"),
            ("postal_code",             "VARCHAR(20)"),
            ("credit_limit",            "NUMERIC(18,2)"),
            ("payment_terms",           "VARCHAR(100)"),
            ("outstanding_balance",     "NUMERIC(18,2) DEFAULT 0"),
            ("lifetime_value",          "NUMERIC(18,2) DEFAULT 0"),
            ("total_orders",            "INTEGER DEFAULT 0"),
            ("total_returns",           "INTEGER DEFAULT 0"),
            ("average_order_value",     "NUMERIC(18,2) DEFAULT 0"),
            ("last_purchase_date",      "DATE"),
            ("first_purchase_date",     "DATE"),
            ("loyalty_points_balance",  "INTEGER DEFAULT 0"),
            ("loyalty_tier",            "VARCHAR(50)"),
            ("loyalty_tier_progress",   "NUMERIC(5,2) DEFAULT 0"),
            ("wallet_balance",          "NUMERIC(18,2) DEFAULT 0"),
            ("wallet_lifetime_credited", "NUMERIC(18,2) DEFAULT 0"),
            ("wallet_lifetime_debited", "NUMERIC(18,2) DEFAULT 0"),
            ("preferred_language",      "VARCHAR(20) DEFAULT 'en'"),
            ("preferred_channel",       "VARCHAR(30)"),
            ("preferred_currency",      "VARCHAR(10) DEFAULT 'INR'"),
            ("timezone",                "VARCHAR(50)"),
            ("marketing_opt_in",        "BOOLEAN DEFAULT TRUE"),
            ("sms_opt_in",              "BOOLEAN DEFAULT TRUE"),
            ("email_opt_in",            "BOOLEAN DEFAULT TRUE"),
            ("whatsapp_opt_in",         "BOOLEAN DEFAULT TRUE"),
            ("do_not_disturb",          "BOOLEAN DEFAULT FALSE"),
            ("facebook_id",             "VARCHAR(100)"),
            ("instagram_handle",        "VARCHAR(100)"),
            ("twitter_handle",          "VARCHAR(100)"),
            ("linkedin_handle",         "VARCHAR(100)"),
            ("rfm_recency_days",        "INTEGER"),
            ("rfm_frequency_score",     "INTEGER"),
            ("rfm_monetary_score",      "INTEGER"),
            ("rfm_segment",             "VARCHAR(50)"),
            ("churn_risk_score",        "NUMERIC(5,2)"),
            ("notes",                   "TEXT"),
            ("tags",                    "JSONB DEFAULT '[]'::jsonb"),
            ("custom_fields",           "JSONB DEFAULT '{}'::jsonb"),
        ]
        for name, col_type in customer_cols:
            try:
                await conn.execute(text(f"ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS {name} {col_type}"))
                logger.info(f"Added customer column: {name}")
            except Exception as e:
                if "already exists" not in str(e).lower() and "duplicate column" not in str(e).lower():
                    logger.warning(f"Error adding customer column {name}: {e}")

    # Run the full SQL migration for all new tables
    async with engine.begin() as conn:
        migration_path = Path(__file__).parent / "database" / "customer_360_migration.sql"
        if migration_path.exists():
            try:
                raw_sql = migration_path.read_text(encoding="utf-8")
                # Execute each statement separately to handle mixed DDL gracefully
                for stmt in raw_sql.split(";"):
                    stmt = stmt.strip()
                    if not stmt:
                        continue
                    try:
                        await conn.execute(text(stmt))
                    except Exception as e:
                        # Ignore "already exists" errors silently
                        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                            logger.warning(f"Migration stmt skipped: {e}")
                logger.info("Customer 360 SQL migration applied.")
            except Exception as e:
                logger.error(f"Customer 360 migration error: {e}")

    # ─── Ensure all new SQLAlchemy tables exist ──────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Ensured all new CRM module tables exist.")

if __name__ == "__main__":
    asyncio.run(migrate())
