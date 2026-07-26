import asyncio
from src.database.session import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        print("--- Table Counts ---")
        for table in ["erp_products", "erp_product_categories", "pos_products", "pos_categories", "tenants"]:
            try:
                res = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                print(f"{table}: {res.scalar()}")
            except Exception as e:
                print(f"{table}: error: {e}")
                await db.rollback()

        print("\n--- Tenants in DB ---")
        try:
            res = await db.execute(text("SELECT id, name, slug FROM tenants"))
            for r in res.all():
                print(f"Tenant ID: {r[0]}, Name: {r[1]}, Slug: {r[2]}")
        except Exception as e:
            print(f"Error listing tenants: {e}")
            await db.rollback()

        print("\n--- Sample erp_products ---")
        try:
            res = await db.execute(text("SELECT id, name, tenant_id, selling_price, mrp, initial_stock, status FROM erp_products LIMIT 5"))
            for r in res.all():
                print(f"ID: {r[0]}, Name: {r[1]}, Tenant ID: {r[2]}, Price: {r[3]}, MRP: {r[4]}, Stock: {r[5]}, Status: {r[6]}")
        except Exception as e:
            print(f"Error listing erp_products: {e}")
            await db.rollback()

        print("\n--- Sample pos_products ---")
        try:
            res = await db.execute(text("SELECT id, name, tenant_id, price FROM pos_products LIMIT 5"))
            for r in res.all():
                print(f"ID: {r[0]}, Name: {r[1]}, Tenant ID: {r[2]}, Price: {r[3]}")
        except Exception as e:
            print(f"Error listing pos_products: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(main())
