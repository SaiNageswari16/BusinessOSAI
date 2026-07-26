import asyncio
import logging
from src.database.session import AsyncSessionLocal
from src.database.init_db import seed_accounting_features

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_accounting_scratch")

async def run():
    logger.info("Starting accounting & finance manual seed...")
    async with AsyncSessionLocal() as db:
        await seed_accounting_features(db)
    logger.info("Done!")

if __name__ == "__main__":
    asyncio.run(run())
