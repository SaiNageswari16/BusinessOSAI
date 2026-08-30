import asyncio
import sys

sys.path.append("backend")

from sqlalchemy import text
from src.database.session import engine

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'employees'"))
        cols = [r[0] for r in res.fetchall()]
        print("Employee table columns count:", len(cols))
        print("Employees columns:", sorted(cols))
        print("punch_method present:", "punch_method" in cols)
        print("biometric_pin present:", "biometric_pin" in cols)
        print("sales_points present:", "sales_points" in cols)
        print("basic_salary present:", "basic_salary" in cols)
        
        # Also test executing the exact query that failed
        from src.models import Employee
        from sqlalchemy import select, func
        
        q = select(func.count()).select_from(select(Employee).subquery())
        count = await conn.scalar(q)
        print("Successfully queried Employee count from DB:", count)

if __name__ == "__main__":
    asyncio.run(main())
