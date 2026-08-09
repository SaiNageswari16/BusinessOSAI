import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio, uuid, datetime
from src.database.session import AsyncSessionLocal
from src.models.erp import Invoice

async def main():
    async with AsyncSessionLocal() as db:
        inv = Invoice(
            tenant_id=uuid.UUID('0bf81ab8-d6b6-4a8e-a81a-e9bf738bf4df'),
            customer_name='Test Verification Party',
            invoice_number=f'VERIFY-{uuid.uuid4().hex[:6]}',
            invoice_type='tax_invoice',
            status='paid',
            invoice_date=datetime.date.today(),
            due_date=datetime.date.today(),
            subtotal=500.0,
            total_amount=500.0,
            balance_due=0.0,
        )
        db.add(inv)
        await db.commit()
        print(f"✅ Successfully inserted invoice ID: {inv.id} into PostgreSQL!")

if __name__ == "__main__":
    asyncio.run(main())
