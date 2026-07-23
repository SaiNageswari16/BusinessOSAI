import asyncio
from src.database.session import async_session_maker
from sqlalchemy import text
async def q():
    async with async_session_maker() as s:
        print("Checking DB records...")
        r = await s.execute(text("SELECT id, name FROM pos_categories"))
        cats = r.fetchall()
        print(f"Categories in DB: {cats}")
        r = await s.execute(text("SELECT id, name, category_id, tenant_id FROM pos_products"))
        prods = r.fetchall()
        print(f"Products in DB: {prods}")
asyncio.run(q())
