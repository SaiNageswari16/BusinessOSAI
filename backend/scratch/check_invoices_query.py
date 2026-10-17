import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import Company, Tenant, Customer, POSTransaction
from src.models.erp import Invoice
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        print("=== TENANTS ===")
        res = await db.execute(select(Tenant))
        tenants = res.scalars().all()
        for t in tenants:
            print(f"Tenant: id={t.id}, name={getattr(t, 'name', '')}, slug={getattr(t, 'slug', '')}")

        print("\n=== COMPANIES ===")
        res = await db.execute(select(Company))
        companies = res.scalars().all()
        for c in companies:
            print(f"Company: id={c.id}, tenant_id={c.tenant_id}, name={c.name}")

        print("\n=== ALL INVOICES in ar_invoices ===")
        res = await db.execute(select(Invoice).order_by(Invoice.created_at.desc()))
        invoices = res.scalars().all()
        print(f"Total invoices in DB: {len(invoices)}")
        for inv in invoices:
            print(f"Invoice: id={inv.id}, num={inv.invoice_number}, type={inv.invoice_type}, status={inv.status}, total={inv.total_amount}, tenant_id={inv.tenant_id}, company_id={inv.company_id}, customer_name={inv.customer_name}, customer_id={inv.customer_id}")

        print("\n=== POS TRANSACTIONS ===")
        res = await db.execute(select(POSTransaction).order_by(POSTransaction.created_at.desc()).limit(10))
        txs = res.scalars().all()
        print(f"Recent POS txs in DB: {len(txs)}")
        for tx in txs:
            print(f"POSTransaction: id={tx.id}, receipt={tx.receipt_number}, total={tx.total_amount}, tenant_id={tx.tenant_id}, company_id={tx.company_id}")

if __name__ == "__main__":
    asyncio.run(main())
