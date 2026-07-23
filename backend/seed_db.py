import asyncio
import logging
from src.database.session import get_db
from src.database.init_db import bootstrap_defaults

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

async def seed():
    logger.info("Initializing manual database seed...")
    async for db in get_db():
        await bootstrap_defaults(db)
        logger.info("Seed script completed successfully.")
        break

if __name__ == "__main__":
    asyncio.run(seed())
