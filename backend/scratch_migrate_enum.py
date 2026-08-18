import asyncio
from sqlalchemy import text
from src.database.session import engine

async def migrate_enum():
    async with engine.begin() as conn:
        for val in ['partially_paid', 'credit', 'pending', 'voided']:
            try:
                await conn.execute(text(f"ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS '{val}';"))
                print(f"Successfully ensured enum value: {val}")
            except Exception as e:
                print(f"Enum note for {val}: {e}")

if __name__ == "__main__":
    asyncio.run(migrate_enum())
