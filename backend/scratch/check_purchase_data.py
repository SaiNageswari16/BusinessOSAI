import asyncio
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from src.database.session import AsyncSessionLocal
from src.models.procurement import VendorBill, PurchaseOrder, Supplier

async def main():
    async with AsyncSessionLocal() as db:
        vbs = (await db.execute(select(VendorBill))).scalars().all()
        print(f"Total Vendor Bills: {len(vbs)}")
        for b in vbs:
            print(f"  Bill {b.bill_number}: PO={b.purchase_order_id}, Total={b.total_amount}, Paid={b.paid_amount}, Status={b.status}, Company={b.company_id}")
        
        pos = (await db.execute(select(PurchaseOrder))).scalars().all()
        print(f"\nTotal Purchase Orders: {len(pos)}")
        for p in pos:
            print(f"  PO {p.po_number}: SupplierID={p.supplier_id}, Total={p.total_amount}, Status={getattr(p, 'status', 'N/A')}")
            
        sups = (await db.execute(select(Supplier))).scalars().all()
        print(f"\nTotal Suppliers: {len(sups)}")
        for s in sups:
            print(f"  Supplier {s.name} (id={s.id}): phone={s.phone}, gstin={s.gst_number}")

if __name__ == "__main__":
    asyncio.run(main())
