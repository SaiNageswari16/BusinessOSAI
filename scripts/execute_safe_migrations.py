import asyncio
import os
import sys
from pathlib import Path

# Ensure backend directory is in sys.path regardless of where script is called from
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent
backend_dir = project_root / "backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Change current working directory to backend so .env is loaded
os.chdir(str(backend_dir))

from sqlalchemy import text
from src.database.session import engine

async def main():
    statements = [
        # employees table
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS punch_method VARCHAR(50) DEFAULT 'GPS';",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS sales_points NUMERIC(12, 2) DEFAULT 0.0;",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS biometric_pin VARCHAR(50);",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS nfc_card_number VARCHAR(50);",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(12, 2);",
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;",
        
        # attendance_records table
        "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);",
        "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_in_selfie_url TEXT;",
        "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_out_selfie_url TEXT;",
        "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_face_verified BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_geofence_verified BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_wfh BOOLEAN DEFAULT FALSE;",
        
        # crm_leads table
        "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS notes TEXT;",
        "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;",
        "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;",
        "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS call_disposition VARCHAR(100);",
        "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS call_duration_minutes INTEGER DEFAULT 0;",
        "ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS customer_response TEXT;",

        # crm_opportunities table
        "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS notes TEXT;",
        "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;",
        "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS call_disposition VARCHAR(100);",
        "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS call_duration_minutes INTEGER DEFAULT 0;",
        "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS customer_response TEXT;",

        # companies table
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_initials VARCHAR(10);",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150);",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(30);",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100);",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS upi_qr_url TEXT;",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS signature_url TEXT;",

        # crm_customers table
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS addresses JSONB DEFAULT '[]'::jsonb;",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(100);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(100);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'Retail';",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS billing_address TEXT;",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS shipping_address TEXT;",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS city VARCHAR(100);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS state VARCHAR(100);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(50);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS date_of_birth DATE;",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS anniversary_date DATE;",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS gender VARCHAR(50);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50) DEFAULT 'English';",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14, 2) DEFAULT 0.0;",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS source VARCHAR(150);",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;",
        "ALTER TABLE crm_customers ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL;",
    ]

    for stmt in statements:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
            print(f"SUCCESS: {stmt}")
        except Exception as e:
            print(f"FAILED: {stmt} -> {e}")

    print("\n--- Testing Employee Query ---")
    async with engine.connect() as conn:
        from src.models import Employee
        from sqlalchemy import select, func
        q = select(func.count()).select_from(select(Employee).subquery())
        count = await conn.scalar(q)
        print(f"SUCCESS! Employee count: {count}")

if __name__ == "__main__":
    asyncio.run(main())
