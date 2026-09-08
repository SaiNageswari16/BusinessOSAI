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

        # erp tables
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS uom VARCHAR(50) DEFAULT 'Pcs';",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS cost_price NUMERIC(15, 2) DEFAULT 0.0;",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS mrp NUMERIC(15, 2) DEFAULT 0.0;",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS selling_price NUMERIC(15, 2) DEFAULT 0.0;",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5, 2) DEFAULT 0.0;",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS location VARCHAR(150);",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(100);",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50) DEFAULT 'Passed';",
        "ALTER TABLE erp_inventory_batches ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);",
        "ALTER TABLE erp_products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(10, 2) DEFAULT 0;",
        "ALTER TABLE erp_products ADD COLUMN IF NOT EXISTS b2b_price NUMERIC(10, 2) DEFAULT 0;",
        "ALTER TABLE erp_products ADD COLUMN IF NOT EXISTS is_tax_inclusive BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE erp_products ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb;",
        "ALTER TABLE erp_master_catalog ADD COLUMN IF NOT EXISTS specifications TEXT;",
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
