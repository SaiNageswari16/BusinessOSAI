import asyncio
import sys
import os

sys.path.append("backend")

from sqlalchemy import text, inspect
from src.database.session import engine
from src.models import Base

async def main():
    print("Creating any missing tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    print("Checking missing columns for all existing tables...")
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

        # live_notifications table
        "ALTER TABLE live_notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;",

        # hrms_sales_commissions table
        "ALTER TABLE hrms_sales_commissions ADD COLUMN IF NOT EXISTS slab_tier VARCHAR(50);",
        "ALTER TABLE hrms_sales_commissions ADD COLUMN IF NOT EXISTS calculation_mode VARCHAR(30) DEFAULT 'progressive';",
        "ALTER TABLE hrms_sales_commissions ADD COLUMN IF NOT EXISTS slab_breakdown JSONB;",

        # branches table
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 500;",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS enforce_geofence BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS district VARCHAR(150);",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS district_code VARCHAR(50);",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS region_name VARCHAR(100);",
        "ALTER TABLE branches ADD COLUMN IF NOT EXISTS zone_name VARCHAR(100);",
    ]
    
    for stmt in alter_statements:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
                print(f"Executed: {stmt}")
        except Exception as e:
            print(f"Error executing {stmt}: {e}")
            
    print("Database sync complete!")

if __name__ == "__main__":
    asyncio.run(main())
