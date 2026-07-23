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

if __name__ == "__main__":
    asyncio.run(migrate())
