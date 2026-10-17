import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import Company, Tenant
from src.models.erp import Invoice
from sqlalchemy import select, func

async def main():
    async with AsyncSessionLocal() as db:
        print("--- TENANTS ---")
        for t in (await db.execute(select(Tenant))).scalars().all():
            print(f"Tenant: id={t.id}, name={t.name}")

        print("\n--- COMPANIES ---")
        for c in (await db.execute(select(Company))).scalars().all():
            print(f"Company: id={c.id}, tenant_id={c.tenant_id}, name={c.name}")

        print("\n--- INVOICES GROUPED BY COMPANY & TENANT ---")
        res = await db.execute(select(Invoice.tenant_id, Invoice.company_id, func.count(Invoice.id)).group_by(Invoice.tenant_id, Invoice.company_id))
        for row in res.all():
            print(f"tenant={row[0]}, company={row[1]}, count={row[2]}")

if __name__ == "__main__":
    asyncio.run(main())
