import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def insert_data():
    engine = create_async_engine("postgresql+asyncpg://postgres:0111@localhost:5432/businessos_core_erp")
    async with engine.begin() as conn:
        print("Inserting real POS data for tenant ca80a537-8837-472d-a66f-506a1fb11a10...")
        
        # Insert category
        await conn.execute(text("""
        INSERT INTO pos_categories (id, tenant_id, name, description, color, icon, is_active, created_at, updated_at)
        VALUES (
            'f24a0d9e-108a-4d7a-b9c1-52ea4c9ebcf3',
            'ca80a537-8837-472d-a66f-506a1fb11a10',
            'Electronics', 
            'Gadgets and tech', 
            'bg-blue-100 text-blue-700', 
            'Monitor', 
            true, NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
        """))
        
        # Insert product
        await conn.execute(text("""
        INSERT INTO pos_products (
            id, tenant_id, category_id, name, selling_price, stock, is_active, 
            sku, barcode, purchase_price, mrp, tax_percent, discount, reorder_level, created_at, updated_at
        )
        VALUES (
            '1b74a004-94e8-4667-8e6c-cc31df75e114',
            'ca80a537-8837-472d-a66f-506a1fb11a10',
            'f24a0d9e-108a-4d7a-b9c1-52ea4c9ebcf3',
            'Wireless Mouse', 
            29.99, 50, true, 
            'WM-001', '890123456789',
            15.00, 35.00, 5.00, 0.00, 10, NOW(), NOW()
        ) ON CONFLICT DO NOTHING;
        """))
        
        print("Data inserted successfully!")

asyncio.run(insert_data())
