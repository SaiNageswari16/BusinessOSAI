import asyncio
import logging
from sqlalchemy import text
from src.database.session import engine
from src.database.base import Base
import src.models  # Register all models with Base.metadata

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("recreate_master_catalog")

async def main():
    logger.info("Dropping table erp_master_catalog if it exists...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS erp_master_catalog CASCADE"))
        logger.info("Recreating erp_master_catalog table...")
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Successfully recreated erp_master_catalog with new CSV aligned columns.")

if __name__ == "__main__":
    asyncio.run(main())
