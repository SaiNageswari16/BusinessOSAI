import asyncio
import csv
import logging
import os
import sys
import uuid
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.database.session import AsyncSessionLocal
from src.models.inventory import MasterCatalogProduct

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("import_csv")

DEFAULT_CSV_FILE = "660486934-Inventory-Report-NSCIN7148-ACTIVE-NSCIN7148-62beb2dabb8d7e07c85812a0-97235333.csv"

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

async def main(csv_file_path: str):
    logger.info(f"Opening CSV file: {csv_file_path}...")
    if not os.path.exists(csv_file_path):
        logger.error(f"File '{csv_file_path}' not found. Please provide a valid file path.")
        return

    async with AsyncSessionLocal() as session:
        batch_size = 2000
        count = 0
        
        try:
            with open(csv_file_path, mode="r", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                
                # Stream line-by-line (DO NOT load entire 12GB file into memory!)
                for row in reader:
                    name = to_str(row.get("NAME") or row.get("product_name") or row.get("name"))
                    if not name:
                        continue
                        
                    # Create a MasterCatalogProduct instance
                    product = MasterCatalogProduct(
                        id=uuid.uuid4(),
                        tenant_id=None,  # Global shared catalog record
                        name=name,
                        brand=to_str(row.get("BRAND") or row.get("brands")),
                        barcode=to_str(row.get("BARCODE") or row.get("code")),
                        sku_code=to_str(row.get("SKU CODE") or row.get("sku")),
                        product_code=to_str(row.get("PRODUCT CODE")),
                        hsn_code=to_str(row.get("HSN CODE")),
                        plu_no=to_str(row.get("PLU NO")),
                        
                        cost_price=to_float(row.get("COST PRICE")),
                        mrp=to_float(row.get("MRP")),
                        sale_price=to_float(row.get("SALE PRICE")),
                        wholesale_price=to_float(row.get("WHOLESALE PRICE")),
                        special_price=to_float(row.get("SPECIAL PRICE")),
                        online_price=to_float(row.get("ONLINE PRICE")),
                        
                        weight=to_str(row.get("WEIGHT") or row.get("quantity")),
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
                        category=to_str(row.get("CATEGORY") or row.get("categories")),
                        sub_category=to_str(row.get("SUB CATEGORY")),
                        instock_value=to_float(row.get("INSTOCK VALUE")),
                        source="EXCEL_IMPORT"
                    )
                    session.add(product)
                    count += 1
                    
                    if count % batch_size == 0:
                        await session.commit()
                        logger.info(f"Imported and committed {count:,} products...")
                        
                # Commit remaining batch
                await session.commit()
                logger.info(f"Successfully finished importing! Total master catalog products imported: {count:,}")
        except Exception as e:
            logger.error(f"Error during import: {e}", exc_info=True)

if __name__ == "__main__":
    file_path = sys.argv[1] if len(sys.argv) > 1 else os.getenv("CSV_FILE_PATH", DEFAULT_CSV_FILE)
    asyncio.run(main(file_path))
