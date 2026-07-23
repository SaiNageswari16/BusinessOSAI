import asyncio
import csv
import logging
import uuid
from src.database.session import AsyncSessionLocal
from src.models.inventory import MasterCatalogProduct

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("import_csv")

CSV_FILE = "660486934-Inventory-Report-NSCIN7148-ACTIVE-NSCIN7148-62beb2dabb8d7e07c85812a0-97235333.csv"

def to_float(val):
    if not val or val.strip() == "":
        return 0.0
    try:
        return float(val.strip())
    except ValueError:
        return 0.0

def to_str(val):
    if not val or val.strip() == "":
        return None
    return val.strip()

async def main():
    logger.info(f"Opening CSV file: {CSV_FILE}...")
    try:
        with open(CSV_FILE, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except FileNotFoundError:
        logger.error(f"File {CSV_FILE} not found. Please make sure the path is correct.")
        return

    logger.info(f"Found {len(rows)} rows to import.")
    
    async with AsyncSessionLocal() as session:
        batch_size = 1000
        count = 0
        
        for i, row in enumerate(rows):
            name = to_str(row.get("NAME"))
            if not name:
                continue
                
            # Create a MasterCatalogProduct instance
            product = MasterCatalogProduct(
                id=uuid.uuid4(),
                tenant_id=None,  # Global shared catalog record
                name=name,
                brand=to_str(row.get("BRAND")),
                barcode=to_str(row.get("BARCODE")),
                sku_code=to_str(row.get("SKU CODE")),
                product_code=to_str(row.get("PRODUCT CODE")),
                hsn_code=to_str(row.get("HSN CODE")),
                plu_no=to_str(row.get("PLU NO")),
                
                cost_price=to_float(row.get("COST PRICE")),
                mrp=to_float(row.get("MRP")),
                sale_price=to_float(row.get("SALE PRICE")),
                wholesale_price=to_float(row.get("WHOLESALE PRICE")),
                special_price=to_float(row.get("SPECIAL PRICE")),
                online_price=to_float(row.get("ONLINE PRICE")),
                
                weight=to_str(row.get("WEIGHT")),
                quantity=to_float(row.get("QUANTITY")),
                expired_quantity=to_float(row.get("EXPIRED QUANTITY")),
                near_expiry_quantity=to_float(row.get("NEAR EXPIRY QUANTITY")),
                
                tax=to_float(row.get("TAX")),
                type=to_str(row.get("TYPE")),
                cess=to_float(row.get("CESS")),
                cess_on=to_float(row.get("CESS ON")),
                cess_type=to_str(row.get("CESS TYPE")),
                tax_amount=to_float(row.get("TAX AMOUNT")),
                taxable_value=to_float(row.get("TAXABLE VALUE")),
                cess_tax_amount=to_float(row.get("CESS TAX AMOUNT")),
                additional_cess_tax_amount=to_float(row.get("ADDITIONAL CESS TAX AMOUNT")),
                
                supplier=to_str(row.get("SUPPLIER")),
                discount_rs=to_float(row.get("DISCOUNT(₹)") or row.get("DISCOUNT(\u20b9)") or row.get("DISCOUNT")),
                discount_percent=to_float(row.get("DISCOUNT(%)")),
                actual_margin_rs=to_float(row.get("ACTUAL MARGIN (₹)") or row.get("ACTUAL MARGIN (\u20b9)") or row.get("ACTUAL MARGIN")),
                margin_on_cp=to_float(row.get("MARGIN ON CP (%)")),
                margin_on_sp=to_float(row.get("MARGIN ON SP (%)")),
                category=to_str(row.get("CATEGORY")),
                sub_category=to_str(row.get("SUB CATEGORY")),
                instock_value=to_float(row.get("INSTOCK VALUE")),
                source="EXCEL_IMPORT"
            )
            session.add(product)
            count += 1
            
            if count % batch_size == 0:
                await session.commit()
                logger.info(f"Committed {count} / {len(rows)} products...")
                
        # Commit any remaining rows
        await session.commit()
        logger.info(f"Successfully finished importing. Total products imported: {count}")

if __name__ == "__main__":
    asyncio.run(main())
