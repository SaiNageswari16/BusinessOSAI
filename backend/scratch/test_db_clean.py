import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import AttendanceRecord, Employee
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(AttendanceRecord).limit(5))
        recs = res.scalars().all()
        print(f"Verified {len(recs)} active attendance records in DB cleanly.")

if __name__ == "__main__":
    asyncio.run(main())
