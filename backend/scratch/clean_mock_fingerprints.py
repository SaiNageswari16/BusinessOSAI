import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("backend"))

from src.database.session import AsyncSessionLocal
from src.models import UserFingerprint, UserPasskey
from sqlalchemy import select, delete

async def main():
    async with AsyncSessionLocal() as db:
        fps = (await db.execute(select(UserFingerprint))).scalars().all()
        pks = (await db.execute(select(UserPasskey))).scalars().all()
        print(f"Found {len(fps)} registered fingerprints, {len(pks)} registered passkeys.")
        for fp in fps:
            print(f"Fingerprint: {fp.id}, user: {fp.user_id}, finger: {fp.finger_name}, device: {fp.device_brand}")
        
        # Delete dummy/mock fingerprints
        await db.execute(delete(UserFingerprint))
        await db.commit()
        print("Cleaned all dummy/mock fingerprints.")

if __name__ == "__main__":
    asyncio.run(main())
