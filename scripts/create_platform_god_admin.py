"""
Script: create_platform_god_admin.py
Purpose: Create or elevate any user account to permanent Platform Super Admin (God Mode)
with complete cross-tenant power, unrestricted access, and full platform oversight.

Usage:
  python scripts/create_platform_god_admin.py --email admin@domain.com --password YourPassword --name "God Admin"
  python scripts/create_platform_god_admin.py --email venaticfungus@gmail.com
"""

import sys
import os
import argparse
import asyncio
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from src.database.session import AsyncSessionLocal
from src.models import User, Tenant, Role, UserRole, Permission, RolePermission, UserStatus, TenantStatus
from src.utils.security import hash_password, seed_permissions, create_super_admin_role


async def create_or_elevate_god_admin(email: str, password: str | None = None, full_name: str | None = None, tenant_slug: str = "system"):
    email = email.lower().strip()
    print(f"\n========================================================")
    print(f"  ⚡ PROVISIONING PLATFORM SUPER ADMIN (GOD MODE) ⚡  ")
    print(f"========================================================")
    print(f"Target Email : {email}")
    print(f"Target Tenant: {tenant_slug}")

    async with AsyncSessionLocal() as db:
        # 1. Ensure permissions are seeded
        print("[1/5] Ensuring all system permissions are seeded...")
        await seed_permissions(db)

        # 2. Get or create target Tenant
        print(f"[2/5] Locating tenant '{tenant_slug}'...")
        tenant = await db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
        if not tenant:
            # Try finding any active tenant or create system tenant
            tenant = await db.scalar(select(Tenant).order_by(Tenant.created_at.asc()))
            if not tenant:
                print(f"Creating root 'system' tenant...")
                tenant = Tenant(
                    slug="system",
                    name="System Platform",
                    plan="enterprise",
                    status=TenantStatus.ACTIVE,
                    settings={"enabled_modules": ["*"]},
                )
                db.add(tenant)
                await db.flush()
            print(f"Using tenant: {tenant.name} ({tenant.slug}) [ID: {tenant.id}]")
        else:
            print(f"Found tenant: {tenant.name} ({tenant.slug}) [ID: {tenant.id}]")

        # 3. Locate or create Super Admin Role for tenant
        print("[3/5] Locating Super Admin role...")
        super_role = await db.scalar(
            select(Role).where(Role.tenant_id == tenant.id, Role.name == "Super Admin")
        )
        if not super_role:
            print(f"Creating Super Admin role for tenant {tenant.name}...")
            super_role = await create_super_admin_role(db, tenant.id)
        else:
            # Ensure super role has all permissions
            perms = (await db.execute(select(Permission))).scalars().all()
            existing_pids = set((await db.execute(
                select(RolePermission.permission_id).where(RolePermission.role_id == super_role.id)
            )).scalars().all())
            for p in perms:
                if p.id not in existing_pids:
                    db.add(RolePermission(role_id=super_role.id, permission_id=p.id))
            await db.flush()

        # 4. Find or Create User
        print(f"[4/5] Checking user existence for {email}...")
        user = await db.scalar(select(User).where(User.email == email))

        if user:
            print(f"  -> Existing user found: '{user.full_name}' [ID: {user.id}]")
            user.is_platform_admin = True
            user.is_tenant_owner = True
            user.status = UserStatus.ACTIVE
            if full_name:
                user.full_name = full_name
            if password:
                user.password_hash = hash_password(password)
                user.must_change_password = False
            print(f"  -> Granted is_platform_admin=True and is_tenant_owner=True")
        else:
            print(f"  -> Creating NEW Platform God Admin user account...")
            if not password:
                password = "Admin@" + os.urandom(4).hex()
                print(f"  -> Generated secure temporary password: {password}")
            name = full_name or email.split("@")[0].title()
            user = User(
                tenant_id=tenant.id,
                email=email,
                password_hash=hash_password(password),
                full_name=name,
                avatar_initials="".join(p[0].upper() for p in name.split()[:2] if p),
                status=UserStatus.ACTIVE,
                is_tenant_owner=True,
                is_platform_admin=True,
                must_change_password=False,
            )
            db.add(user)
            await db.flush()
            print(f"  -> Created user ID: {user.id}")

        # 5. Link User to Super Admin Role
        print("[5/5] Ensuring user role assignment...")
        ur = await db.scalar(
            select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == super_role.id)
        )
        if not ur:
            db.add(UserRole(user_id=user.id, role_id=super_role.id, is_default=True))
            await db.flush()

        await db.commit()

    print("\n========================================================")
    print("  ✅ SUCCESS! PLATFORM SUPER ADMIN (GOD MODE) READY  ")
    print("========================================================")
    print(f"Email          : {user.email}")
    print(f"Full Name      : {user.full_name}")
    print(f"Platform Admin : {user.is_platform_admin} (Full God Mode Access)")
    print(f"Tenant Owner   : {user.is_tenant_owner}")
    print(f"Status         : {user.status.value}")
    if password:
        print(f"Password       : {password}")
    print("========================================================\n")


def main():
    parser = argparse.ArgumentParser(description="Create or Elevate a Platform Super Admin (God Mode) User")
    parser.add_argument("--email", "-e", required=True, help="User email address")
    parser.add_argument("--password", "-p", default=None, help="Password (optional, auto-generated if user is new)")
    parser.add_argument("--name", "-n", default=None, help="User Full Name (optional)")
    parser.add_argument("--tenant", "-t", default="system", help="Tenant Slug (default: 'system')")

    args = parser.parse_args()
    asyncio.run(create_or_elevate_god_admin(
        email=args.email,
        password=args.password,
        full_name=args.name,
        tenant_slug=args.tenant,
    ))


if __name__ == "__main__":
    main()
