import asyncio
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from src.database.session import AsyncSessionLocal, engine
from src.database.base import Base
from src.models.inventory import HSNMaster

async def seed_hsn():
    json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data", "hsn_codes_gst.json")
    if not os.path.exists(json_path):
        print("JSON data file not found:", json_path)
        return

    with open(json_path, "r", encoding="utf-8") as f:
        entries = json.load(f)

    print(f"Loaded {len(entries)} HSN entries from JSON.")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        created = 0
        updated = 0
        for item in entries:
            code = item["hsn_code"].strip()
            desc = item["description"].strip()
            rate = float(item["gst_rate"])

            stmt = select(HSNMaster).where(HSNMaster.hsn_code == code)
            res = await session.execute(stmt)
            existing = res.scalars().first()

            if existing:
                existing.description = desc
                existing.gst_rate = rate
                existing.cgst_rate = rate / 2.0
                existing.sgst_rate = rate / 2.0
                existing.igst_rate = rate
                updated += 1
            else:
                new_entry = HSNMaster(
                    id=uuid.uuid4(),
                    hsn_code=code,
                    description=desc,
                    gst_rate=rate,
                    cgst_rate=rate / 2.0,
                    sgst_rate=rate / 2.0,
                    igst_rate=rate,
                    cess_rate=0.0
                )
                session.add(new_entry)
                created += 1

        await session.commit()
        print(f"HSN Database Seeded Successfully: {created} created, {updated} updated.")

if __name__ == "__main__":
    asyncio.run(seed_hsn())
