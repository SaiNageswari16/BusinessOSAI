import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import Company, Tenant
from src.models.erp import Invoice
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Invoice).order_by(Invoice.created_at.desc()).limit(20))
        invoices = res.scalars().all()
        for inv in invoices:
            print(f"INV: num={inv.invoice_number}, type={inv.invoice_type}, tenant={inv.tenant_id}, company={inv.company_id}, cust={inv.customer_name}")

if __name__ == "__main__":
    asyncio.run(main())
