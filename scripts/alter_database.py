import asyncio
import sys
sys.path.append(".")
sys.path.append("backend")

from sqlalchemy import text
from src.database.session import engine

async def main():
    async with engine.begin() as conn:
        print("Running SQL ALTER TABLE to add ip_address column if not exists...")
        await conn.execute(text("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50)"))
        print("Database schema successfully updated!")

if __name__ == "__main__":
    asyncio.run(main())
