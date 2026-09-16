import asyncio
from sqlalchemy import select
from src.database.session import AsyncSessionLocal
from src.models import (
    Supplier, SupplierCategory, SupplierContact, SupplierContract,
    SupplierPerformance, BlacklistedSupplier,
    PurchaseRequest, PurchaseRequestItem,
    PurchaseQuotation, PurchaseQuotationItem,
    PurchaseOrder, PurchaseOrderItem,
    GoodsReceivedNote, GoodsReceivedNoteItem,
    PurchaseReturn, PurchaseReturnItem,
    VendorBill, VendorPayment,
    VendorCreditNote, VendorDebitNote,
    Product
)

async def test_procurement_tables():
    async with AsyncSessionLocal() as db:
        for model in [
            Supplier, SupplierCategory, SupplierContact, SupplierContract,
            SupplierPerformance, BlacklistedSupplier,
            PurchaseRequest, PurchaseRequestItem,
            PurchaseQuotation, PurchaseQuotationItem,
            PurchaseOrder, PurchaseOrderItem,
            GoodsReceivedNote, GoodsReceivedNoteItem,
            PurchaseReturn, PurchaseReturnItem,
            VendorBill, VendorPayment,
            VendorCreditNote, VendorDebitNote
        ]:
            try:
                res = await db.execute(select(model).limit(5))
                rows = res.scalars().all()
                print(f"OK: {model.__name__} (rows: {len(rows)})")
            except Exception as e:
                print(f"ERROR querying {model.__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_procurement_tables())
