import asyncio
from sqlalchemy import text
from src.database.session import engine

async def migrate():
    async with engine.begin() as conn:
        print("Dropping rigid foreign key constraints on delivery_challans...")
        await conn.execute(text("ALTER TABLE delivery_challans DROP CONSTRAINT IF EXISTS delivery_challans_invoice_id_fkey;"))
        await conn.execute(text("ALTER TABLE delivery_challans DROP CONSTRAINT IF EXISTS delivery_challans_customer_id_fkey;"))
        
        # Add reference columns if not existing
        await conn.execute(text("ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);"))
        
        print("Successfully updated delivery_challans constraints and columns!")

if __name__ == "__main__":
    asyncio.run(migrate())
