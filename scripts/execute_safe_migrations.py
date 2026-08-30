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
