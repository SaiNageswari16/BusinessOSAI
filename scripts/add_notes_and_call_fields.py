import asyncio
import sys

sys.path.append("backend")

from sqlalchemy import text
from src.database.session import engine

async def main():
    async with engine.begin() as conn:
        print("Adding notes, call disposition, and response tracking columns...")
        
        # crm_leads
        await conn.execute(text("ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS notes TEXT;"))
        await conn.execute(text("ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS call_disposition VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS call_duration_minutes INTEGER DEFAULT 0;"))
        await conn.execute(text("ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS customer_response TEXT;"))
        await conn.execute(text("ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;"))
        await conn.execute(text("ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;"))

        # crm_opportunities
        await conn.execute(text("ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS notes TEXT;"))
        await conn.execute(text("ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS call_disposition VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS call_duration_minutes INTEGER DEFAULT 0;"))
        await conn.execute(text("ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS customer_response TEXT;"))
        await conn.execute(text("ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;"))

        # crm_lead_activities (for rich activity & notes history)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS crm_lead_activities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
                opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE CASCADE,
                activity_type VARCHAR(50) NOT NULL,
                summary TEXT NOT NULL,
                call_disposition VARCHAR(100),
                call_duration_minutes INTEGER DEFAULT 0,
                customer_response TEXT,
                occurred_at TIMESTAMPTZ DEFAULT NOW(),
                created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        
        # In case crm_lead_activities already existed without some columns:
        await conn.execute(text("ALTER TABLE crm_lead_activities ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE CASCADE;"))
        await conn.execute(text("ALTER TABLE crm_lead_activities ADD COLUMN IF NOT EXISTS call_disposition VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE crm_lead_activities ADD COLUMN IF NOT EXISTS call_duration_minutes INTEGER DEFAULT 0;"))
        await conn.execute(text("ALTER TABLE crm_lead_activities ADD COLUMN IF NOT EXISTS customer_response TEXT;"))

        print("Columns and tables successfully updated!")

if __name__ == "__main__":
    asyncio.run(main())
