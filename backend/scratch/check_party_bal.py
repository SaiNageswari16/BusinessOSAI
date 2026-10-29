import dotenv
dotenv.load_dotenv("backend/.env")
import asyncio
import sys
sys.path.insert(0, "backend")
from src.database.session import AsyncSessionLocal
from src.models import Customer
from src.models.erp import Invoice
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Customer))
        custs = res.scalars().all()
        print(f"Total customers: {len(custs)}")
        for c in custs:
            if (c.opening_balance or 0) > 0 or (c.outstanding_balance or 0) > 0:
                print(f"Cust with bal: {c.name}, phone: {c.phone}, open_bal: {c.opening_balance}, out_bal: {c.outstanding_balance}")
        inv_res = await db.execute(select(Invoice).where(Invoice.balance_due > 0))
        invs = inv_res.scalars().all()
        print(f"Total invoices with balance_due > 0: {len(invs)}")
        for inv in invs:
            print(f"Inv: {inv.invoice_number}, cust_name: {inv.customer_name}, tot: {inv.total_amount}, paid: {inv.amount_paid}, due: {inv.balance_due}, status: {inv.status}, cust_id: {inv.customer_id}")

asyncio.run(main())

