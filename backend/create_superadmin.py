#!/usr/bin/env python3
"""
Create / Seed Super Admin CLI Utility
-------------------------------------
Run this script at any time to create or upgrade a platform Super Admin user.

Usage:
  python create_superadmin.py
  python create_superadmin.py --email admin@platform.com --password mysecretpassword --name "System Super Admin"
"""
import argparse
import asyncio
import getpass
import logging
import os
import sys
import uuid

# Ensure backend root is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

# Load environment variables if .env exists
try:
    from dotenv import load_dotenv
    env_path = os.path.join(SCRIPT_DIR, ".env")
    if os.path.isfile(env_path):
        load_dotenv(env_path)
except ImportError:
    pass

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
logger = logging.getLogger("create_superadmin")


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


async def create_or_update_superadmin(email: str, password: str, full_name: str) -> None:
    """Create or upgrade a user to 100% God Mode Platform Super Admin."""
    # Ensure database schema is initialized
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 1. Ensure system root tenant exists
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

        print("\n" + "=" * 68)
        print("[SUPER ADMIN] PLATFORM SUPER ADMIN CREATED & READY!")
        print("=" * 68)
        print(f"  * Email:         {user.email}")
        print(f"  * Name:          {user.full_name}")
        print(f"  * Role:          Super Admin (Platform God Mode)")
        print(f"  * Organisation:  {tenant.name} (slug: {tenant.slug})")
        print(f"  * Status:        ACTIVE")
        print(f"  * Login URL:     http://localhost:5173/login")
        print(f"  * Super Admin:   http://localhost:5173/portfolio")
        print("=" * 68)
        print(">> You can now sign in with these credentials at the login page.")
        print("   You will be redirected automatically to your Business Owner Portfolio.\n")


def parse_args():
    parser = argparse.ArgumentParser(description="Create or update a Platform Super Admin user.")
    parser.add_argument("--email", "-e", help="Super Admin login email", default=None)
    parser.add_argument("--password", "-p", help="Super Admin login password", default=None)
    parser.add_argument("--name", "-n", help="Full Name", default="Platform Super Admin")
    return parser.parse_args()


def main():
    args = parse_args()

    email = args.email
    password = args.password
    name = args.name

    # Interactive input if flags not provided
    if not email:
        print("\n=============================================")
        print("   [+] Create Platform Super Admin User")
        print("=============================================")
        email = input("Enter Super Admin Email (e.g. admin@company.com): ").strip()
        while not email or "@" not in email or "." not in email.split("@")[-1]:
            email = input("Please enter a valid email address with domain (e.g. admin@company.com): ").strip()

    if not password:
        try:
            password = getpass.getpass("Enter Super Admin Password (min 8 chars): ").strip()
        except Exception:
            password = input("Enter Super Admin Password (min 8 chars): ").strip()
        while not password or len(password) < 6:
            try:
                password = getpass.getpass("Password must be at least 6 characters. Enter Password: ").strip()
            except Exception:
                password = input("Password must be at least 6 characters. Enter Password: ").strip()

    asyncio.run(create_or_update_superadmin(email=email, password=password, full_name=name))


if __name__ == "__main__":
    main()
