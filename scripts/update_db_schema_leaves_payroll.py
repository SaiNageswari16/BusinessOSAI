import asyncio
import sys
sys.path.append(".")
sys.path.append("backend")

from sqlalchemy import text
from src.database.session import engine

queries = [
    """CREATE TABLE IF NOT EXISTS leave_policies (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        leave_type VARCHAR(50) NOT NULL,
        entitled_days INTEGER NOT NULL,
        applicable_to VARCHAR(100) DEFAULT 'All',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );""",

    """CREATE TABLE IF NOT EXISTS pay_grades (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        name VARCHAR(100) NOT NULL,
        designation_id UUID NOT NULL REFERENCES designations(id) ON DELETE CASCADE UNIQUE,
        basic_salary NUMERIC(12, 2) NOT NULL,
        hra NUMERIC(12, 2) DEFAULT 0,
        other_allowances NUMERIC(12, 2) DEFAULT 0,
        pf_deduction NUMERIC(12, 2) DEFAULT 0,
        esi_deduction NUMERIC(12, 2) DEFAULT 0,
        tds_deduction NUMERIC(12, 2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );""",
    """CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) NOT NULL,
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        days_requested INTEGER NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );""",

    """CREATE TABLE IF NOT EXISTS leave_balances (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        leave_type VARCHAR(50) NOT NULL,
        total_days INTEGER DEFAULT 0,
        used_days INTEGER DEFAULT 0,
        balance INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (tenant_id, employee_id, leave_type)
    );""",

    """CREATE TABLE IF NOT EXISTS salary_structures (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
        basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
        hra NUMERIC(12, 2) NOT NULL DEFAULT 0,
        other_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
        pf_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
        esi_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
        tds_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
        other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
        net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );""",

    """CREATE TABLE IF NOT EXISTS payslips (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        basic_salary NUMERIC(12, 2) NOT NULL,
        hra NUMERIC(12, 2) NOT NULL DEFAULT 0,
        other_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
        pf_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
        esi_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
        tds_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0,
        other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
        gross_salary NUMERIC(12, 2) NOT NULL,
        net_salary NUMERIC(12, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'Processing',
        pdf_url VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (tenant_id, employee_id, month, year)
    );"""
]

async def main():
    async with engine.begin() as conn:
        print("Creating Leaves and Payroll database tables...")
        for q in queries:
            await conn.execute(text(q))
        print("All Leaves and Payroll tables created successfully!")

if __name__ == "__main__":
    asyncio.run(main())
