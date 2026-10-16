import asyncio
from src.database.session import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        await db.execute(text("ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;"))
        await db.execute(text("ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS challan_number VARCHAR(100);"))
        await db.execute(text("ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS delivery_challan_number VARCHAR(100);"))
        await db.commit()
        print("Successfully added custom_fields, challan_number, delivery_challan_number to ar_invoices!")

if __name__ == "__main__":
    asyncio.run(main())
