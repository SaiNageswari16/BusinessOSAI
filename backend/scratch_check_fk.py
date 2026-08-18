import asyncio, uuid
from sqlalchemy import text
from src.database.session import AsyncSessionLocal

async def check():
    async with AsyncSessionLocal() as db:
        sql = """
            SELECT
                tc.table_name,
                kcu.column_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' 
              AND ccu.table_name = 'tenants';
        """
        res = await db.execute(text(sql))
        rows = res.fetchall()
        t_id = uuid.UUID('ededd4d0-4b8b-40ac-b97f-5b65ccfaa975')
        for tbl, col in rows:
            try:
                cnt = await db.scalar(text(f"SELECT count(*) FROM {tbl} WHERE {col} = '{t_id}'"))
                if cnt and cnt > 0:
                    print(f"Table {tbl}.{col} has {cnt} rows!")
            except Exception as e:
                pass

if __name__ == "__main__":
    asyncio.run(check())
