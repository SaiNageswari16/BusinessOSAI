import asyncio
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))
os.chdir(str(backend_dir))

from src.database.session import engine
from sqlalchemy import text, select
from src.models import Company

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'companies'"))
        columns = res.fetchall()
        print("Columns in companies table:")
        for col, dt in columns:
            print(f"  {col}: {dt}")
        
        print("\nTesting select(Company)...")
        try:
            r = await conn.execute(select(Company))
            rows = r.scalars().all()
            print(f"SUCCESS: Loaded {len(rows)} companies")
            for c in rows:
                print(f"  ID: {c.id}, Name: {c.name}, Status: {c.status}")
        except Exception as e:
            print(f"FAILED select(Company): {e}")

if __name__ == "__main__":
    asyncio.run(main())
