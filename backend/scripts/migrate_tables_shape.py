import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_organization")
    cols = await conn.fetch("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'restaurant_tables'")
    print("Columns:", [c["column_name"] for c in cols])
    await conn.execute("ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS shape VARCHAR(30) DEFAULT 'round'")
    print("Shape column successfully added or verified!")
    tables = await conn.fetch("SELECT id, name, code, seats, status, shape FROM restaurant_tables")
    print("Existing tables count:", len(tables))
    for t in tables[:5]:
        print(dict(t))
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
