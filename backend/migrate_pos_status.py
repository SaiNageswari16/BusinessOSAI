import asyncio
from sqlalchemy import text
from src.database.session import engine

async def run_migration():
    print("--- Running POS Transactions Status Migration ---")
    statements = [
        "ALTER TABLE pos_transactions ALTER COLUMN status TYPE VARCHAR(50) USING status::VARCHAR(50);",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'credit';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'CREDIT';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'partially_paid';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'completed';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'COMPLETED';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'refunded';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'REFUNDED';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'on_hold';",
        "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'ON_HOLD';",
    ]
    for stmt in statements:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
                print(f"Executed: {stmt[:60]}...")
        except Exception as e:
            print(f"Notice: {e}")
    print("--- Migration Completed Successfully ---")

if __name__ == "__main__":
    asyncio.run(run_migration())
