import asyncio
from src.database.session import AsyncSessionLocal
from sqlalchemy import select, func
from src.models import Tenant, User, Company, Branch, Customer, Lead
from src.models.erp import ChartOfAccount, BankAccount, BankTransaction, JournalEntry
from src.models.inventory import Product, InventoryBatch

async def inspect():
    async with AsyncSessionLocal() as db:
        tenants = (await db.execute(select(Tenant))).scalars().all()
        for t in tenants:
            print(f"\n================ TENANT: {t.slug} ({t.id}) ================")
            
            # Check company
            company = await db.scalar(select(Company).where(Company.tenant_id == t.id))
            print(f"Company: {company.name if company else 'None'}")
            
            # Check branch
            branch = await db.scalar(select(Branch).where(Branch.tenant_id == t.id))
            print(f"Branch: {branch.name if branch else 'None'}")
            
            # Count accounts
            accs = await db.scalar(select(func.count(ChartOfAccount.id)).where(ChartOfAccount.tenant_id == t.id))
            print(f"GL Accounts: {accs}")
            
            # Count bank accounts
            banks = await db.scalar(select(func.count(BankAccount.id)).where(BankAccount.tenant_id == t.id))
            print(f"Bank Accounts: {banks}")

            # Count journal entries
            jes = await db.scalar(select(func.count(JournalEntry.id)).where(JournalEntry.tenant_id == t.id))
            print(f"Journal Entries: {jes}")

            # Count CRM leads
            leads = await db.scalar(select(func.count(Lead.id)).where(Lead.tenant_id == t.id))
            print(f"CRM Leads: {leads}")

            # Count Inventory Products
            prods = await db.scalar(select(func.count(Product.id)).where(Product.tenant_id == t.id))
            print(f"Inventory Products: {prods}")

            # Count Inventory Batches
            batches = await db.scalar(select(func.count(InventoryBatch.id)).where(InventoryBatch.tenant_id == t.id))
            print(f"Inventory Batches: {batches}")

if __name__ == "__main__":
    asyncio.run(inspect())

