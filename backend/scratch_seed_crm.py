import asyncio
import logging
from src.database.session import AsyncSessionLocal
from src.database.init_db import seed_crm_features

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_crm_scratch")

async def run():
    logger.info("Starting CRM & Sales manual seed...")
    async with AsyncSessionLocal() as db:
        await seed_crm_features(db)
    logger.info("Done!")

if __name__ == "__main__":
    asyncio.run(run())
