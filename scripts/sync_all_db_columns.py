import asyncio
import sys
import os

sys.path.append("backend")

from sqlalchemy import text, inspect
from src.database.session import engine
from src.models import Base

async def main():
    async with engine.begin() as conn:
        print("Creating any missing tables...")
        await conn.run_sync(Base.metadata.create_all)
        
        print("Checking missing columns for all existing tables...")
        # Inspect columns for key tables that were expanded
        alter_statements = [
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
            
            # leads table
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_disposition VARCHAR(100);",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_duration_minutes INTEGER DEFAULT 0;",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;",
            "ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_response TEXT;",

            # crm_opportunities table (deals)
            "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS notes TEXT;",
            "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;",
            "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS call_disposition VARCHAR(100);",
            "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS call_duration_minutes INTEGER DEFAULT 0;",
            "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;",
            "ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS customer_response TEXT;",
        ]
        
        for stmt in alter_statements:
            try:
                await conn.execute(text(stmt))
                print(f"Executed: {stmt}")
            except Exception as e:
                print(f"Error executing {stmt}: {e}")
                
    print("Database sync complete!")

if __name__ == "__main__":
    asyncio.run(main())
