import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import Customer
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Customer).limit(3))
        customers = res.scalars().all()
        print(f"Verified {len(customers)} customers in DB.")
        for c in customers:
            print(f"Customer: {c.name}, phone: {c.phone}, alt: {c.alternate_phone}, email: {c.email}")

if __name__ == "__main__":
    asyncio.run(main())
