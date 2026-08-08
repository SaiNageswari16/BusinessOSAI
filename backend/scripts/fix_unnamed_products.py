import asyncio
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, or_
from src.database.session import AsyncSessionLocal
from src.models.inventory import Product, MasterCatalogProduct

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fix_unnamed")

async def main():
    async with AsyncSessionLocal() as session:
        # Find local products that are "Unnamed Product" or similar generic names
        stmt = select(Product).where(
            or_(
                Product.name.ilike("unnamed product"),
                Product.name.ilike("unnamed"),
                Product.name == None,
                Product.name == "",
                Product.name.like("SKU-%")
            )
        )
        res = await session.execute(stmt)
        unnamed = res.scalars().all()
        logger.info(f"Found {len(unnamed)} generic/unnamed products in erp_products")

        fixed = 0
        for p in unnamed:
            if not p.barcode or len(p.barcode.strip()) < 5:
                continue
            
            # Check if Master Catalog has a real name for this barcode
            mc_res = await session.execute(
                select(MasterCatalogProduct).where(
                    MasterCatalogProduct.barcode == p.barcode.strip(),
                    MasterCatalogProduct.name.isnot(None),
                    ~MasterCatalogProduct.name.ilike("unnamed%"),
                    ~MasterCatalogProduct.name.like("SKU-%")
                )
            )
            mc_prod = mc_res.scalars().first()
            if mc_prod and mc_prod.name:
                p.name = mc_prod.name
                if mc_prod.image_url and not p.image_url:
                    p.image_url = mc_prod.image_url
                if mc_prod.short_description and not p.short_description:
                    p.short_description = mc_prod.short_description
                fixed += 1
                logger.info(f"Fixed product {p.id} ({p.barcode}): '{p.name}'")

        await session.commit()
        logger.info(f"Retroactively fixed {fixed} unnamed products from Master Catalog matches.")

if __name__ == "__main__":
    asyncio.run(main())
