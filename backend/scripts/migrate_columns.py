import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from sqlalchemy import text
from src.database.session import engine

async def run_migrations():
    statements = [
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS uom VARCHAR(50) DEFAULT 'Pcs';",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15, 2) DEFAULT 0.0;",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS mrp NUMERIC(15, 2) DEFAULT 0.0;",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS selling_price NUMERIC(15, 2) DEFAULT 0.0;",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5, 2) DEFAULT 0.0;",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS location VARCHAR(150);",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(100);",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50) DEFAULT 'Passed';",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);",
        "ALTER TABLE erp_products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(10, 2) DEFAULT 0;",
        "ALTER TABLE erp_products ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE erp_products ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb;",
        "ALTER TABLE erp_master_catalog ADD COLUMN IF NOT EXISTS specifications TEXT;",
        "UPDATE users SET is_platform_admin = TRUE WHERE lower(email) = 'venaticfungus@gmail.com';",
    ]

    for stmt in statements:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(stmt))
                print(f"[OK] {stmt[:60]}...")
            except Exception as e:
                print(f"[ERR] {stmt[:60]}: {e}")

if __name__ == "__main__":
    asyncio.run(run_migrations())
