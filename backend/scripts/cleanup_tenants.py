"""
Standalone Server Script: Cleanup & Purge Orphaned Tenants
---------------------------------------------------------
Keeps ONLY the active verified workspaces and users:
  1. venatic / venaticfungus@gmail.com (0bf81ab8-d6b6-4a8e-a81a-e9bf738bf4df)
  2. yash / ravichander2623@gmail.com (050e326b-ef46-482d-aad8-490a504944f3)
  3. test / vpkumar.k@kisaanparivar.com (d10beebf-6647-41cb-80ed-c31cb5035b91)

Completely purges all other tenants (Lazymonkeyai, Nimbus Retail, demo, baig-enterprises, etc.)
and all their associated products, invoices, journal entries, inventory, and activities.
"""
import sys
import os
import asyncio
import uuid

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, func
from src.database.session import AsyncSessionLocal
from src.models import Tenant, User
from src.database.purge import purge_tenant_data


KEEP_TENANT_IDS = {
    uuid.UUID("0bf81ab8-d6b6-4a8e-a81a-e9bf738bf4df"),  # venatic (system)
    uuid.UUID("050e326b-ef46-482d-aad8-490a504944f3"),  # yash
    uuid.UUID("d10beebf-6647-41cb-80ed-c31cb5035b91"),  # test
}

KEEP_USER_EMAILS = {
    "venaticfungus@gmail.com",
    "ravichander2623@gmail.com",
    "vpkumar.k@kisaanparivar.com",
}


async def run_cleanup():
    print("=" * 70)
    print(" BusinessOS AI: Database Multi-Tenant Clean Up & Purge")
    print("=" * 70)

    async with AsyncSessionLocal() as db:
        # 1. Inspect existing tenants
        tenants_res = await db.execute(select(Tenant))
        all_tenants = tenants_res.scalars().all()
        print(f"\n[+] Total Tenants in Database: {len(all_tenants)}")

        to_keep = []
        to_purge = []

        for t in all_tenants:
            # Always keep system tenant or the specified active tenants
            if t.id in KEEP_TENANT_IDS or t.slug == "system":
                to_keep.append(t)
            else:
                to_purge.append(t)

        print("\n[+] Retaining Verified Workspaces:")
        for t in to_keep:
            user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == t.id))
            print(f"    ✓ {t.name:<25} (slug: {t.slug:<15} id: {t.id} users: {user_count})")

        print(f"\n[!] Target Workspaces to Purge ({len(to_purge)} found):")
        for t in to_purge:
            user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == t.id))
            print(f"    ✗ {t.name:<25} (slug: {t.slug:<15} id: {t.id} users: {user_count})")

        if not to_purge:
            print("\n[✓] Database is already 100% clean! No extraneous tenants to purge.")
            return

        print("\n" + "-" * 70)
        print("Starting deep cascade purge of all target workspaces...")
        print("-" * 70)

        for t in to_purge:
            print(f"\n[*] Purging workspace '{t.name}' (ID: {t.id})...")
            try:
                counts = await purge_tenant_data(db, t.id)
                print(f"    [OK] Successfully purged '{t.name}' data:")
                for table, cnt in counts.items():
                    if cnt > 0:
                        print(f"         - {table}: {cnt} rows deleted")
            except Exception as e:
                print(f"    [ERROR] Failed to purge '{t.name}': {e}")

        # 2. Final Verification
        print("\n" + "=" * 70)
        print(" Final Database Verification:")
        print("=" * 70)

        final_tenants = (await db.execute(select(Tenant))).scalars().all()
        print(f"\n[+] Remaining Tenants ({len(final_tenants)}):")
        for t in final_tenants:
            print(f"    - {t.name:<25} (slug: {t.slug:<15} id: {t.id})")

        final_users = (await db.execute(select(User))).scalars().all()
        print(f"\n[+] Remaining Users ({len(final_users)}):")
        for u in final_users:
            print(f"    - {u.email:<32} (name: {u.full_name:<15} tenant_id: {u.tenant_id})")

        print("\n[✓] Cleanup completed successfully!\n")


if __name__ == "__main__":
    asyncio.run(run_cleanup())
