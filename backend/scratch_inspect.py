import asyncio
from sqlalchemy import select
from src.database.session import AsyncSessionLocal
from src.models import Tenant, User, Role, UserRole

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Tenant))
        tenants = res.scalars().all()
        print("=== TENANTS ===")
        for t in tenants:
            print(f"Tenant: id={t.id}, slug={t.slug}, name={t.name}, settings={t.settings}")
            
        res = await db.execute(select(User))
        users = res.scalars().all()
        print("\n=== USERS ===")
        for u in users:
            print(f"User: id={u.id}, email={u.email}, tenant_id={u.tenant_id}, is_tenant_owner={u.is_tenant_owner}, is_platform_admin={u.is_platform_admin}")

asyncio.run(main())
