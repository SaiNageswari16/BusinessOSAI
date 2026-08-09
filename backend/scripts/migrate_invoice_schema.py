import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
from sqlalchemy import text
from src.database.session import AsyncSessionLocal

async def migrate():
    async with AsyncSessionLocal() as session:
        print("Migrating ar_invoice_lines table schema...")
        alter_statements = [
            # ar_invoice_lines columns
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100);",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS expiry_date DATE;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS mfg_date DATE;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS mrp NUMERIC(18, 2);",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS description TEXT;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS uom VARCHAR(30);",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20);",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(8, 4) DEFAULT 0;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS line_total NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoice_lines ADD COLUMN IF NOT EXISTS cost_center_id UUID;",
            
            # ar_invoices columns
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS company_id UUID;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(30);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS billing_address TEXT;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS shipping_address TEXT;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS order_number VARCHAR(100);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS service_from DATE;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS service_to DATE;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) DEFAULT 'INR';",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 6) DEFAULT 1;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(18, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS round_off NUMERIC(10, 2) DEFAULT 0;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS notes TEXT;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS terms TEXT;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS footer TEXT;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS is_reverse_charge BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS irn_number VARCHAR(50);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS ack_number VARCHAR(50);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS ack_date TIMESTAMPTZ;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS e_invoice_qr TEXT;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS approved_by_user_id UUID;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS journal_entry_id UUID;",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);",
            "ALTER TABLE ar_invoices ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);",
            "ALTER TABLE ar_invoices ALTER COLUMN status TYPE VARCHAR(50) USING status::text;",
            "ALTER TABLE ar_invoices ALTER COLUMN invoice_type TYPE VARCHAR(50) USING invoice_type::text;",
            "UPDATE ar_invoices SET status = 'paid', balance_due = 0.0, amount_paid = total_amount WHERE (payment_method IS NULL OR LOWER(payment_method) != 'credit');",
        ]

        for stmt in alter_statements:
            try:
                await session.execute(text(stmt))
                print(f"Executed: {stmt[:60]}...")
            except Exception as e:
                print(f"Error executing {stmt}: {e}")

        await session.commit()
        print("✅ Schema migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
