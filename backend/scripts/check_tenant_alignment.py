import asyncio
import asyncpg

async def main():
    conn_auth = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_auth")
    cols = await conn_auth.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
    print("Users cols:", [c["column_name"] for c in cols])
    user = await conn_auth.fetchrow("SELECT id, email, tenant_id FROM users WHERE email = 'venaticfungus@gmail.com'")
    print("Auth user:", dict(user) if user else "Not found")
    await conn_auth.close()

    conn_org = await asyncpg.connect("postgresql://postgres:0111@127.0.0.1:5432/restaurantos_organization")
    if user:
        tenant_id = user["tenant_id"]
        t = await conn_org.fetchrow("SELECT id, name, slug FROM tenants WHERE id = $1", tenant_id)
        print("Tenant in org:", dict(t) if t else "Missing in org!")
        outlets = await conn_org.fetch("SELECT id, name, code FROM outlets WHERE tenant_id = $1", tenant_id)
        print("Outlets for tenant:", [dict(o) for o in outlets])
    await conn_org.close()

if __name__ == "__main__":
    asyncio.run(main())
