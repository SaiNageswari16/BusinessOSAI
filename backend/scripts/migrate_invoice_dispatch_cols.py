import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.database.session import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'ar_invoices';"))
        cols = [r[0] for r in res.fetchall()]
        print("Existing ar_invoices columns:", cols)

        alter_statements = [
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS po_date DATE;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS driver_name VARCHAR(150);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(50);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS eway_bill_number VARCHAR(100);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS eway_bill_date TIMESTAMPTZ;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS transporter_name VARCHAR(150);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS transporter_id VARCHAR(100);",
        ]
        for stmt in alter_statements:
            try:
                await conn.execute(text(stmt))
                print("Executed:", stmt)
            except Exception as e:
                print("Error executing:", stmt, e)

    print("Migration completed successfully.")

if __name__ == '__main__':
    asyncio.run(main())
