import asyncio
import os
import sys
from datetime import date

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import AttendanceRecord
from sqlalchemy import select, delete

async def main():
    today = date.today()
    print(f"Today's date is: {today}")
    async with AsyncSessionLocal() as db:
        # Check future records
        res = await db.execute(select(AttendanceRecord).where(AttendanceRecord.date > today))
        future_records = res.scalars().all()
        print(f"Found {len(future_records)} future attendance records > {today}")
        
        # Delete future records so only real punches remain
        await db.execute(delete(AttendanceRecord).where(AttendanceRecord.date > today))
        await db.commit()
        print(f"Cleaned up {len(future_records)} future/mock attendance records.")

if __name__ == "__main__":
    asyncio.run(main())
