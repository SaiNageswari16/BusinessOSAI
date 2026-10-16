import asyncio
from src.database.session import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ar_invoices' ORDER BY ordinal_position;"))
        cols = res.fetchall()
        for c in cols:
            print(f"{c[0]}: {c[1]}")

if __name__ == "__main__":
    asyncio.run(main())
