import sys
sys.path.append(".")
sys.path.append("backend")

import asyncio
from sqlalchemy import select
from src.database.session import AsyncSessionLocal
from src.models import AttendanceRecord, Employee, User

async def main():
    async with AsyncSessionLocal() as db:
        # Get users
        res_users = await db.execute(select(User))
        users = res_users.scalars().all()
        print("--- USERS ---")
        for u in users:
            print(f"ID: {u.id}, Email: {u.email}, EmployeeID: {u.employee_id}")

        # Get employees
        res_emps = await db.execute(select(Employee))
        emps = res_emps.scalars().all()
        print("\n--- EMPLOYEES ---")
        for e in emps:
            print(f"ID: {e.id}, Code: {e.employee_code}, Name: {e.full_name}, UserID: {e.user_id}")

        # Get attendance records
        res_att = await db.execute(select(AttendanceRecord))
        atts = res_att.scalars().all()
        print("\n--- ATTENDANCE ---")
        for a in atts:
            print(f"ID: {a.id}, EmpID: {a.employee_id}, Date: {a.date}, In: {a.check_in}, Out: {a.check_out}")

if __name__ == "__main__":
    asyncio.run(main())
