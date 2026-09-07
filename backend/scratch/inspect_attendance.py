import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import AttendanceRecord, Employee
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(AttendanceRecord, Employee).join(Employee, AttendanceRecord.employee_id == Employee.id).order_by(AttendanceRecord.date.desc()).limit(20))
        rows = res.all()
        print(f"Total found: {len(rows)}")
        for att, emp in rows:
            print(f"ID: {att.id}, Emp: {emp.full_name} ({emp.employee_code}), Date: {att.date}, Status: {att.status}, Method: {att.method}, CheckIn: {att.check_in}, CheckOut: {att.check_out}")

if __name__ == "__main__":
    asyncio.run(main())
