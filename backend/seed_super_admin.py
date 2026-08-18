#!/usr/bin/env python3
"""
Seed Super Admin / God Mode Platform Admin Script
-------------------------------------------------
Run this script to create or update god-mode Platform Super Admins at any time,
especially after resetting or wiping the database.

Usage:
  python seed_super_admin.py
  python seed_super_admin.py --email admin@example.com --password mysecretpassword --name "Super Admin"
"""
import argparse
import asyncio
import getpass
import logging
import os
import sys
import uuid

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import AsyncSessionLocal, engine
from src.database.base import Base
from src.models import (
    Tenant,
    TenantStatus,
    User,
    UserStatus,
    Role,
    UserRole,
)
from src.utils.security import (
    hash_password,
    seed_permissions,
    create_super_admin_role,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("seed_super_admin")


async def ensure_system_tenant(db: AsyncSession) -> Tenant:
    """Ensure the root system tenant exists."""
    system_tenant = await db.scalar(
        select(Tenant).where((Tenant.slug == "system") | (Tenant.slug == "default"))
    )
    if not system_tenant:
        system_tenant = Tenant(
            id=uuid.uuid4(),
            name="BusinessOS System Platform",
            slug="system",
            status=TenantStatus.ACTIVE,
            settings={
                "enabled_modules": [
                    "core", "erp", "inventory", "warehouse", "procurement",
                    "pos", "accounting", "crm", "hrms", "reports", "settings",
                    "marketplace", "copilot", "iot", "analytics", "system_config"
                ],
                "company_name": "BusinessOS Global Platform",
            }
        )
        db.add(system_tenant)
        await db.flush()
        logger.info("Created root system platform tenant: %s (%s)", system_tenant.name, system_tenant.id)
    return system_tenant


async def seed_super_admin(email: str, password: str, full_name: str) -> None:
    """Create or upgrade a user to 100% God Mode Platform Super Admin."""
    # Ensure all tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 1. Ensure system tenant
        tenant = await ensure_system_tenant(db)

        # 2. Seed all permissions and Super Admin role
        await seed_permissions(db)
        super_role = await create_super_admin_role(db, tenant.id)

        # 3. Check for existing user by email
        existing_user = await db.scalar(
            select(User).where(User.email.ilike(email.strip()))
        )

        pw_hash = hash_password(password.strip())

        if existing_user:
            existing_user.full_name = full_name.strip() or existing_user.full_name
            existing_user.password_hash = pw_hash
            existing_user.status = UserStatus.ACTIVE
            existing_user.is_platform_admin = True
            existing_user.is_tenant_owner = True
            existing_user.must_change_password = False
            existing_user.failed_login_attempts = 0
            existing_user.locked_until = None
            user = existing_user
            logger.info("Updated existing user to Platform Super Admin: %s", email)
        else:
            user = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                email=email.strip().lower(),
                password_hash=pw_hash,
                full_name=full_name.strip() or "Platform Super Admin",
                status=UserStatus.ACTIVE,
                is_platform_admin=True,
                is_tenant_owner=True,
                must_change_password=False,
            )
            db.add(user)
            await db.flush()
            logger.info("Created new Platform Super Admin user: %s", email)

        # 4. Assign Super Admin role if not already assigned
        if super_role:
            has_role = await db.scalar(
                select(UserRole).where(
                    UserRole.user_id == user.id,
                    UserRole.role_id == super_role.id
                )
            )
            if not has_role:
                db.add(UserRole(
                    user_id=user.id,
                    role_id=super_role.id,
                    is_default=True
                ))

        await db.commit()

        print("\n" + "=" * 65)
        print("👑  GOD MODE PLATFORM SUPER ADMIN READY!")
        print("=" * 65)
        print(f"  • Email:         {user.email}")
        print(f"  • Name:          {user.full_name}")
        print(f"  • Workspace:     {tenant.name} (slug: {tenant.slug})")
        print(f"  • God Mode:      ACTIVE (100% unrestricted platform privileges)")
        print(f"  • Status:        ACTIVE")
        print("=" * 65 + "\n")


def parse_args():
    parser = argparse.ArgumentParser(description="Seed or update a God Mode Platform Super Admin user.")
    parser.add_argument("--email", "-e", help="Super Admin login email", default=None)
    parser.add_argument("--password", "-p", help="Super Admin login password", default=None)
    parser.add_argument("--name", "-n", help="Full Name", default="Platform Super Admin")
    return parser.parse_args()


def main():
    args = parse_args()

    email = args.email
    password = args.password
    name = args.name

    # Interactive prompt if flags not provided
    if not email:
        print("\n--- Seed God Mode Platform Super Admin ---")
        email = input("Enter Super Admin Email: ").strip()
        while not email:
            email = input("Email cannot be empty. Enter Email: ").strip()

    if not password:
        password = getpass.getpass("Enter Super Admin Password: ").strip()
        while not password:
            password = getpass.getpass("Password cannot be empty. Enter Password: ").strip()

    asyncio.run(seed_super_admin(email=email, password=password, full_name=name))


if __name__ == "__main__":
    main()
