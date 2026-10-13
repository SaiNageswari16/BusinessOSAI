import asyncio
from src.database.session import AsyncSessionLocal
from src.models import Company
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = (await db.scalars(select(Company))).all()
        for c in res:
            print("========================================")
            print("ID:", c.id)
            print("NAME:", c.name)
            print("LEGAL NAME:", getattr(c, "legal_name", None))
            print("GST:", getattr(c, "gst_number", None))
            print("ADDR:", getattr(c, "address", None))
            print("TERMS:", getattr(c, "terms_and_conditions", None))
            print("GSP:", getattr(c, "gsp_credentials", None))
            print("EMAIL SETTINGS:", getattr(c, "email_settings", None))

if __name__ == "__main__":
    asyncio.run(main())
