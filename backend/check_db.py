import asyncio
from src.database import async_session_maker
from sqlalchemy import text
async def q():
    async with async_session_maker() as s:
        res = await s.execute(text("SELECT COUNT(*) FROM pos_products WHERE tenant_id='ca80a537-8837-472d-a66f-506a1fb11a10'"))
        print(f"DB Products: {res.scalar()}")
        res = await s.execute(text("SELECT COUNT(*) FROM pos_products"))
        print(f"Total DB Products (All Tenants): {res.scalar()}")
asyncio.run(q())
