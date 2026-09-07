import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import AttendanceRecord
from sqlalchemy import select, delete

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.check_in == None,
                AttendanceRecord.check_out == None,
                AttendanceRecord.notes == None
            )
        )
        mock_records = res.scalars().all()
        print(f"Found {len(mock_records)} placeholder mock attendance records without actual punch timestamps")
        await db.execute(
            delete(AttendanceRecord).where(
                AttendanceRecord.check_in == None,
                AttendanceRecord.check_out == None,
                AttendanceRecord.notes == None
            )
        )
        await db.commit()
        print(f"Cleaned up {len(mock_records)} mock placeholder records. Now only real punches will be displayed!")

if __name__ == "__main__":
    asyncio.run(main())
