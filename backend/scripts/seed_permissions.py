import asyncio
import os
import sys

# Ensure backend root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database.session import AsyncSessionLocal
from src.utils.security import seed_permissions
from sqlalchemy import select, text
from src.models import User, Role, RolePermission, Permission, UserRole

async def main():
    print("🚀 Starting full permission sync and admin grant...")
    async with AsyncSessionLocal() as db:
        # 1. Seed all default permissions & assign to Super Admin roles
        await seed_permissions(db)
        await db.commit()
        print("✅ All default permissions seeded & assigned to 'Super Admin' roles.")

        # 2. Ensure all Workspace Owners and Platform Admins have the 'Super Admin' role assigned
        super_admin_roles = (await db.execute(select(Role).where(Role.name == "Super Admin"))).scalars().all()
        role_by_tenant = {r.tenant_id: r for r in super_admin_roles if r.tenant_id}

        users_res = await db.execute(select(User))
        users = users_res.scalars().all()

        added_assignments = 0
        for user in users:
            if (user.is_tenant_owner or user.is_platform_admin) and user.tenant_id in role_by_tenant:
                target_role = role_by_tenant[user.tenant_id]
                existing_ur = await db.scalar(
                    select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == target_role.id)
                )
                if not existing_ur:
                    db.add(UserRole(user_id=user.id, role_id=target_role.id, is_default=True))
                    added_assignments += 1

        await db.commit()
        print(f"✅ Assigned Super Admin role to {added_assignments} admin users who were missing it.")
        print("🎉 Full permission sync completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
