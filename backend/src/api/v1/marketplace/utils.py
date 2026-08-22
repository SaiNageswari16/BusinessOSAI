import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models import Tenant

async def get_or_create_tenant_id(db: AsyncSession) -> uuid.UUID:
    """Retrieve the primary active tenant ID or create a default one for marketplace operations."""
    res = await db.execute(select(Tenant.id).limit(1))
    tid = res.scalar()
    if not tid:
        t = Tenant(name="Main Organization", slug="main-org", plan="enterprise")
        db.add(t)
        await db.flush()
        return t.id
    return tid
