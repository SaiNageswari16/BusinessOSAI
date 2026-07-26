import asyncio
from src.database.session import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("SELECT id, name, status FROM erp_product_categories"))
        for r in res.all():
            print(f"ID: {r[0]}, Name: {r[1]}, Status: {r[2]}")

if __name__ == "__main__":
    asyncio.run(main())
