import logging
import re
import uuid

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.database.base import Base
from src.database.session import engine
from src.models import (
    ActivityLog,
    ApiKey,
    AuditLog,
    Branch,
    BusinessUnit,
    Company,
    CostCenter,
    Currency,
    Department,
    Designation,
    FiscalYear,
    MfaPolicy,
    NumberSeries,
    PaymentTerm,
    Permission,
    Region,
    Role,
    RolePermission,
    TaxConfiguration,
    Team,
    Tenant,
    User,
    UserBranch,
    UserRole,
    Workspace,
    Zone,
)
from src.utils.security import create_super_admin_role, seed_permissions

logger = logging.getLogger(__name__)
settings = get_settings()


async def init_database() -> None:
    if settings.auto_create_tables:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Ensure new columns on existing PostgreSQL tables always runs
    async with engine.begin() as conn:
        migration_statements = [
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
            "ALTER TABLE pos_transactions ALTER COLUMN status TYPE VARCHAR(50) USING status::VARCHAR(50);",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'COMPLETED';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'REFUNDED';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'ON_HOLD';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'CREDIT';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'PENDING';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'VOIDED';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'completed';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'refunded';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'on_hold';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'partially_paid';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'credit';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'pending';",
            "ALTER TYPE pos_transaction_status ADD VALUE IF NOT EXISTS 'voided';",
            "UPDATE users SET is_platform_admin = TRUE WHERE lower(email) = 'venaticfungus@gmail.com';",
            """
            UPDATE erp_inventory_batches b
            SET cost_price = CASE WHEN b.cost_price IS NULL OR b.cost_price = 0 THEN COALESCE(p.cost_price, 65.00) ELSE b.cost_price END,
                selling_price = CASE WHEN b.selling_price IS NULL OR b.selling_price = 0 THEN COALESCE(p.selling_price, 95.00) ELSE b.selling_price END,
                mrp = CASE WHEN b.mrp IS NULL OR b.mrp = 0 THEN COALESCE(p.mrp, p.selling_price, 120.00) ELSE b.mrp END
            FROM erp_products p
            WHERE (b.product_id = p.id OR lower(b.product_name) = lower(p.name));
            """,
            """
            UPDATE erp_inventory_batches
            SET cost_price = 65.00, selling_price = 95.00, mrp = 120.00
            WHERE (cost_price IS NULL OR cost_price = 0) AND (mrp IS NULL OR mrp = 0);
            """
        ]

        for stmt in migration_statements:
            try:
                await conn.execute(text(stmt))
            except Exception as single_err:
                logger.debug(f"Migration note for statement: {single_err}")
    logger.info("Database tables & schema columns ensured via SQLAlchemy.")




async def seed_hsn_codes(db: AsyncSession) -> None:
    try:
        from src.models.inventory import HSNMaster
        count = await db.scalar(select(func.count()).select_from(HSNMaster))
        if count == 0:
            json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "hsn_codes_gst.json")
            if os.path.exists(json_path):
                import json
                with open(json_path, "r", encoding="utf-8") as f:
                    entries = json.load(f)
                for item in entries:
                    code = item["hsn_code"].strip()
                    desc = item["description"].strip()
                    rate = float(item["gst_rate"])
                    hsn_obj = HSNMaster(
                        id=uuid.uuid4(),
                        hsn_code=code,
                        description=desc,
                        gst_rate=rate,
                        cgst_rate=rate / 2.0,
                        sgst_rate=rate / 2.0,
                        igst_rate=rate,
                        cess_rate=0.0
                    )
                    db.add(hsn_obj)
                await db.flush()
                logger.info(f"Seeded {len(entries)} HSN Master codes into database.")
    except Exception as e:
        logger.warning(f"Failed to auto-seed HSN codes: {e}")


async def bootstrap_defaults(db: AsyncSession) -> None:
    if not settings.seed_default_permissions:
        return

    await seed_permissions(db)
    await seed_hsn_codes(db)

    tenant_count = await db.scalar(select(func.count()).select_from(Tenant))
    if tenant_count == 0:
        demo_tenant = Tenant(
            slug="nimbus-retail",
            name="Nimbus Retail Group",
            plan="enterprise",
        )
        db.add(demo_tenant)
        await db.flush()

        super_role = await create_super_admin_role(db, demo_tenant.id)

        from src.utils.security import hash_password

        admin = User(
            tenant_id=demo_tenant.id,
            email="admin@businessos.ai",
            password_hash=hash_password("Admin@123456"),
            full_name="Platform Administrator",
            employee_id="EMP-1000",
            avatar_initials="PA",
            is_tenant_owner=True,
        )
        db.add(admin)
        await db.flush()
        db.add(UserRole(user_id=admin.id, role_id=super_role.id, is_default=True))

        company = Company(
            tenant_id=demo_tenant.id,
            name="Nimbus Retail Group",
            legal_name="Nimbus Retail Pvt Ltd",
            company_type="Private Limited",
            gst_number="27AADCN1234A1Z5",
            pan_number="AADCN1234A",
            registration_number="CIN1234567890",
            industry="Retail",
            country="India",
            state="Maharashtra",
            city="Mumbai",
            address="123 Nimbus Tower, BKC",
            phone="+91 9876543210",
            email="contact@nimbus.com",
            website="www.nimbus.com",
            default_currency_code="INR",
            tax_config_label="GST Standard",
            plan="Enterprise",
            logo_initials="NR",
        )
        db.add(company)
        await db.flush()

        branch = Branch(
            tenant_id=demo_tenant.id,
            company_id=company.id,
            code="BR-100",
            name="Mumbai HQ",
            city="Mumbai",
            state="Maharashtra",
            country="India",
            has_warehouse=True,
            working_hours="09:00 - 18:00",
        )
        db.add(branch)
        await db.flush()

        db.add(
            Currency(
                tenant_id=demo_tenant.id,
                code="INR",
                symbol="₹",
                exchange_rate=1,
                is_default=True,
            )
        )
        logger.info("Seeded demo tenant: admin@businessos.ai / Admin@123456")

    await seed_hrms_features(db)
    await seed_crm_features(db)
    await seed_accounting_features(db)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:100] or f"tenant-{uuid.uuid4().hex[:8]}"


async def write_audit_log(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID | None,
    module: str,
    action: str,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    old_values: dict | None = None,
    new_values: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    db.add(
        AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            module=module,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )


async def seed_hrms_features(db: AsyncSession) -> None:
    from datetime import date, timedelta
    from src.models import (
        Tenant, Employee, JobOpening, Applicant, Interview, OfferLetter, OnboardingRecord,
        PerformanceGoal, PerformanceKpi, PerformanceAppraisal, PerformanceIncentive,
        LearningCourse, LearningCertificate, LearningAssessment,
        ExitResignation, ExitClearanceTask, ExitFinalSettlement, ExitExperienceLetter
    )

    # Get the default tenant
    tenant_id = await db.scalar(select(Tenant.id))
    if not tenant_id:
        return

    # 0. Seed Employees if none exist
    emp_count = await db.scalar(select(func.count()).select_from(Employee).where(Employee.tenant_id == tenant_id))
    if emp_count == 0:
        from src.models import Company, Branch
        comp_id = await db.scalar(select(Company.id).where(Company.tenant_id == tenant_id))
        br_id = await db.scalar(select(Branch.id).where(Branch.tenant_id == tenant_id))
        
        employees_to_seed = [
            Employee(
                tenant_id=tenant_id,
                company_id=comp_id,
                branch_id=br_id,
                employee_code="EMP-1001",
                full_name="Alex Rivera",
                email="alex@nimbus.com",
                employment_type="Full-Time",
                status="Active",
                date_of_joining=date.today() - timedelta(days=365)
            ),
            Employee(
                tenant_id=tenant_id,
                company_id=comp_id,
                branch_id=br_id,
                employee_code="EMP-1002",
                full_name="James Thompson",
                email="james@nimbus.com",
                employment_type="Full-Time",
                status="Active",
                date_of_joining=date.today() - timedelta(days=300)
            ),
            Employee(
                tenant_id=tenant_id,
                company_id=comp_id,
                branch_id=br_id,
                employee_code="EMP-1003",
                full_name="Sarah Mitchell",
                email="sarah@nimbus.com",
                employment_type="Full-Time",
                status="Active",
                date_of_joining=date.today() - timedelta(days=200)
            ),
            Employee(
                tenant_id=tenant_id,
                company_id=comp_id,
                branch_id=br_id,
                employee_code="EMP-1004",
                full_name="Aisha Patel",
                email="aisha@nimbus.com",
                employment_type="Full-Time",
                status="Active",
                date_of_joining=date.today() - timedelta(days=150)
            )
        ]
        for emp in employees_to_seed:
            db.add(emp)
        await db.commit()
        logger.info("HRMS Employee seeds created successfully.")

    # 1. Seed Recruitment
    job_count = await db.scalar(select(func.count()).select_from(JobOpening).where(JobOpening.tenant_id == tenant_id))
    if job_count == 0:
        jobs_to_seed = [
            JobOpening(
                tenant_id=tenant_id,
                title="Senior Backend Engineer",
                department="Engineering",
                location="Remote",
                type="Full-Time",
                experience="4-6 years",
                openings=2,
                applicants_count=2,
                posted_date=date.today() - timedelta(days=30),
                status="Open",
                threshold_score=75,
                portals=["Careers Page", "LinkedIn", "Naukri.com", "Zoho Careers"],
                criteria="Python, FastAPI, PostgreSQL, AWS, Docker, Microservices",
                description="We are looking for a Senior Backend Engineer to build scalable APIs and design microservices in a Python/FastAPI backend framework. You will work on optimizing database queries in PostgreSQL, deploying serverless workloads on AWS, and setting up CI/CD workflows."
            ),
            JobOpening(
                tenant_id=tenant_id,
                title="Sales Account Executive",
                department="Sales",
                location="San Francisco, CA",
                type="Full-Time",
                experience="2-4 years",
                openings=3,
                applicants_count=2,
                posted_date=date.today() - timedelta(days=25),
                status="Open",
                threshold_score=70,
                portals=["Careers Page", "LinkedIn", "Indeed"],
                criteria="SaaS Sales, CRM, Lead Generation, Presentation, Communication",
                description="Identify and close sales opportunities in mid-market accounts. Deliver exceptional product demonstrations, handle pricing discussions, and coordinate closely with customer success to drive user adoption."
            ),
            JobOpening(
                tenant_id=tenant_id,
                title="UX / Product Designer",
                department="Engineering",
                location="Remote",
                type="Full-Time",
                experience="3-5 years",
                openings=1,
                applicants_count=1,
                posted_date=date.today() - timedelta(days=15),
                status="Open",
                threshold_score=80,
                portals=["Careers Page", "Glassdoor"],
                criteria="Figma, User Research, Wireframes, Prototyping, Design System",
                description="Design intuitive user flows and pixel-perfect UI screens for our core platform modules. Conduct user interviews, create low and high fidelity wireframes in Figma, and manage our brand design system."
            )
        ]
        for j in jobs_to_seed:
            db.add(j)
        await db.flush()

        app1 = Applicant(
            tenant_id=tenant_id,
            name="Nikhil Mehta",
            email="nikhil@mail.com",
            job_id=jobs_to_seed[0].id,
            job_title=jobs_to_seed[0].title,
            applied_date=date.today() - timedelta(days=28),
            experience="5 years",
            rating=4,
            stage="Interview",
            source="LinkedIn",
            match_score=85,
            expected_salary=95000.0,
            proposed_salary=90000.0,
            notes_json=[
                {"author": "Priya Sharma", "date": (date.today() - timedelta(days=5)).isoformat() + "T10:00:00", "text": "Called Nikhil. He was positive about our Tech Stack and remote working setup. Scheduled technical screening round."},
                {"author": "Alex Rivera", "date": (date.today() - timedelta(days=3)).isoformat() + "T11:00:00", "text": "Technical interview completed. Strong knowledge of databases and FastAPI. Suggested target CTC offer of $90,000."}
            ],
            resume_text="Experienced backend engineer with 5 years building REST APIs using Python, FastAPI, and Flask. Strong knowledge of PostgreSQL databases, query optimizations, Docker containers, and deploying microservices on AWS EC2/ECS."
        )
        app2 = Applicant(
            tenant_id=tenant_id,
            name="Claire Dubois",
            email="claire@mail.com",
            job_id=jobs_to_seed[0].id,
            job_title=jobs_to_seed[0].title,
            applied_date=date.today() - timedelta(days=27),
            experience="4 years",
            rating=3,
            stage="Screening",
            source="Naukri.com",
            match_score=72,
            resume_text="4 years of software engineering experience. Experienced with Django and MySQL. Familiar with git, unit testing, and Docker. Looking to transition into FastAPI and AWS architecture."
        )
        app3 = Applicant(
            tenant_id=tenant_id,
            name="Tom Wilson",
            email="tom@mail.com",
            job_id=jobs_to_seed[1].id,
            job_title=jobs_to_seed[1].title,
            applied_date=date.today() - timedelta(days=22),
            experience="3 years",
            rating=5,
            stage="Offer",
            source="Indeed",
            match_score=92,
            resume_text="Account Executive with 3 years SaaS sales experience. Exceeded quota by 120% in consecutive quarters. Expert in lead generation, HubSpot CRM, sales calls, online product demos, and contract negotiations."
        )
        app4 = Applicant(
            tenant_id=tenant_id,
            name="Jason Bourne",
            email="jason@mail.com",
            job_id=jobs_to_seed[1].id,
            job_title=jobs_to_seed[1].title,
            applied_date=date.today() - timedelta(days=20),
            experience="2 years",
            rating=3,
            stage="Applied",
            source="LinkedIn",
            match_score=68,
            resume_text="Sales associate focused on enterprise communications. Experience in outbound calling, lead qualification, Salesforce entries, and client relations."
        )
        app5 = Applicant(
            tenant_id=tenant_id,
            name="Anjali Singh",
            email="anjali@mail.com",
            job_id=jobs_to_seed[2].id,
            job_title=jobs_to_seed[2].title,
            applied_date=date.today() - timedelta(days=12),
            experience="4 years",
            rating=5,
            stage="Hired",
            source="Careers Page",
            match_score=88,
            resume_text="Product designer with 4 years creating responsive websites and mobile interfaces. Figma power user. Deep understanding of design systems, responsive typography, user testing, wireframing, and interactive developer handoffs."
        )
        db.add_all([app1, app2, app3, app4, app5])
        await db.flush()

        # Seed Interview
        int1 = Interview(
            tenant_id=tenant_id,
            applicant_id=app1.id,
            candidate=app1.name,
            job_title=app1.job_title,
            interviewer_name="Alex Rivera",
            date=(date.today() + timedelta(days=2)).isoformat(),
            time="10:00",
            duration=60,
            type="Technical",
            mode="Video Call",
            meeting_link="https://meet.google.com/abc-defg-hij",
            status="Scheduled"
        )
        db.add(int1)

        # Seed Offer
        ofr1 = OfferLetter(
            tenant_id=tenant_id,
            applicant_id=app3.id,
            candidate=app3.name,
            role=app3.job_title,
            ctc=85000.0,
            offer_date=date.today() - timedelta(days=2),
            expiry_date=date.today() + timedelta(days=5),
            joining_date=date.today() + timedelta(days=20),
            signer_name="Priya Sharma",
            status="Awaiting Acceptance",
            email_sent=True
        )
        db.add(ofr1)

        # Seed Onboarding
        onb1 = OnboardingRecord(
            tenant_id=tenant_id,
            applicant_id=app5.id,
            new_hire=app5.name,
            role=app5.job_title,
            start_date=date.today() + timedelta(days=10),
            progress=67,
            tasks_json=[
                {"task": "Email & System Access Created", "assignedTo": "IT", "status": "Done"},
                {"task": "Offer Letter Signed", "assignedTo": "HR", "status": "Done"},
                {"task": "Background Verification", "assignedTo": "HR", "status": "Done"},
                {"task": "Workstation Setup", "assignedTo": "IT", "status": "In Progress"},
                {"task": "Department Orientation", "assignedTo": "Manager", "status": "Pending"},
                {"task": "Policy Training", "assignedTo": "HR", "status": "Pending"}
            ]
        )
        db.add(onb1)
        await db.commit()
        logger.info("HRMS Recruitment seeds created successfully.")

    # 2. Seed Performance
    goal_count = await db.scalar(select(func.count()).select_from(PerformanceGoal).where(PerformanceGoal.tenant_id == tenant_id))
    if goal_count == 0:
        emp_list = await db.execute(select(Employee).where(Employee.tenant_id == tenant_id).limit(3))
        employees = emp_list.scalars().all()
        emp_id = employees[0].id if employees else None
        emp_name = employees[0].full_name if employees else "John Doe"

        goals_to_seed = [
            PerformanceGoal(
                tenant_id=tenant_id,
                employee_id=emp_id,
                employee_name=emp_name,
                title="Optimize Platform Core API Latencies",
                description="Reduce average latency for critical read/write endpoints from 250ms to less than 100ms using caching and indexing.",
                target_date=date.today() + timedelta(days=75),
                status="On Track",
                weight=30,
                progress=65
            ),
            PerformanceGoal(
                tenant_id=tenant_id,
                employee_id=emp_id,
                employee_name=emp_name,
                title="Launch CRM V2 Dashboard UI",
                description="Draft wireframes, complete user research, code client views in React, and deploy the new CRM customer panel.",
                target_date=date.today() + timedelta(days=45),
                status="Completed",
                weight=40,
                progress=100
            ),
            PerformanceGoal(
                tenant_id=tenant_id,
                employee_id=emp_id,
                employee_name=emp_name,
                title="Increase B2B Sales Conversion Rate",
                description="Improve target conversion rate from 8.5% to 12.0% through active demo follow-ups and custom onboarding templates.",
                target_date=date.today() + timedelta(days=90),
                status="At Risk",
                weight=30,
                progress=25
            )
        ]
        for g in goals_to_seed:
            db.add(g)

        kpis_to_seed = [
            PerformanceKpi(tenant_id=tenant_id, metric="Monthly Revenue per Sales Rep", target="$110K", current="$98K", unit="Sales", achievement=89),
            PerformanceKpi(tenant_id=tenant_id, metric="Customer Satisfaction (CSAT)", target="4.5 / 5", current="4.3 / 5", unit="CX", achievement=96),
            PerformanceKpi(tenant_id=tenant_id, metric="Ticket Resolution Rate", target="95%", current="92%", unit="Support", achievement=97),
            PerformanceKpi(tenant_id=tenant_id, metric="Sprint Velocity", target="48 pts", current="51 pts", unit="Engineering", achievement=106),
            PerformanceKpi(tenant_id=tenant_id, metric="Lead Conversion Rate", target="12%", current="9.8%", unit="Sales", achievement=82),
            PerformanceKpi(tenant_id=tenant_id, metric="Warehouse Dispatch Accuracy", target="99%", current="98.5%", unit="Operations", achievement=99),
        ]
        for k in kpis_to_seed:
            db.add(k)

        appraisals_to_seed = [
            PerformanceAppraisal(
                tenant_id=tenant_id,
                employee_id=emp_id or uuid.uuid4(),
                employee_name=emp_name,
                department="Engineering",
                period="H1 2026",
                self_score=85,
                manager_score=90,
                final_score=88,
                rating="Exceeds Expectations",
                reviewer="Alex Rivera",
                status="Completed"
            ),
            PerformanceAppraisal(
                tenant_id=tenant_id,
                employee_id=employees[1].id if len(employees) > 1 else uuid.uuid4(),
                employee_name=employees[1].full_name if len(employees) > 1 else "Sarah Jenkins",
                department="Sales",
                period="H1 2026",
                self_score=75,
                manager_score=80,
                final_score=78,
                rating="Meets Expectations",
                reviewer="James Thompson",
                status="Completed"
            ),
            PerformanceAppraisal(
                tenant_id=tenant_id,
                employee_id=employees[2].id if len(employees) > 2 else uuid.uuid4(),
                employee_name=employees[2].full_name if len(employees) > 2 else "David Miller",
                department="Support",
                period="H1 2026",
                self_score=90,
                manager_score=95,
                final_score=93,
                rating="Outstanding",
                reviewer="Priya Sharma",
                status="Completed"
            )
        ]
        for a in appraisals_to_seed:
            db.add(a)

        incentives_to_seed = [
            PerformanceIncentive(tenant_id=tenant_id, employee_name="James Thompson", department="Sales", type="Q2 Incentive", basis="120% of quota achieved", amount=18000.0, status="Approved"),
            PerformanceIncentive(tenant_id=tenant_id, employee_name="Daniel Roberts", department="Operations", type="Excellence Award", basis="Cycle time reduced by 20%", amount=5000.0, status="Paid"),
            PerformanceIncentive(tenant_id=tenant_id, employee_name="Sarah Mitchell", department="Marketing", type="Campaign Bonus", basis="3 campaigns launched on time", amount=12000.0, status="Pending"),
        ]
        for inc in incentives_to_seed:
            db.add(inc)

        await db.commit()
        logger.info("HRMS Performance seeds created successfully.")

    # 3. Seed Learning
    course_count = await db.scalar(select(func.count()).select_from(LearningCourse).where(LearningCourse.tenant_id == tenant_id))
    if course_count == 0:
        courses_to_seed = [
            LearningCourse(tenant_id=tenant_id, title="Leadership Essentials", category="Soft Skills", instructor="External – Coursera", duration="8 hrs", enrolled=32, completion=75, status="Active"),
            LearningCourse(tenant_id=tenant_id, title="AWS Cloud Practitioner", category="Technical", instructor="AWS Training", duration="12 hrs", enrolled=10, completion=60, status="Active"),
            LearningCourse(tenant_id=tenant_id, title="Data Privacy & GDPR", category="Compliance", instructor="Internal – Legal", duration="2 hrs", enrolled=124, completion=92, status="Mandatory"),
            LearningCourse(tenant_id=tenant_id, title="Advanced Excel for Finance", category="Technical", instructor="Internal – Finance", duration="5 hrs", enrolled=18, completion=44, status="Active"),
        ]
        for c in courses_to_seed:
            db.add(c)

        certs_to_seed = [
            LearningCertificate(tenant_id=tenant_id, employee_name="Kevin Park", cert_name="AWS Certified Developer", issuer="Amazon Web Services", issued_date="2026-05-20", expiry_date="2029-05-20", status="Valid"),
            LearningCertificate(tenant_id=tenant_id, employee_name="Priya Sharma", cert_name="SHRM-CP", issuer="SHRM", issued_date="2025-08-10", expiry_date="2028-08-10", status="Valid"),
            LearningCertificate(tenant_id=tenant_id, employee_name="Aisha Patel", cert_name="Google UX Design", issuer="Google / Coursera", issued_date="2024-03-15", expiry_date="N/A", status="Valid"),
            LearningCertificate(tenant_id=tenant_id, employee_name="Marcus Johnson", cert_name="CPA Exam Part 1", issuer="AICPA", issued_date="2023-11-01", expiry_date="N/A", status="Valid"),
        ]
        for cert in certs_to_seed:
            db.add(cert)

        assessments_to_seed = [
            LearningAssessment(tenant_id=tenant_id, title="Q2 Compliance Quiz", course_name="Data Privacy & GDPR", due_date="2026-07-15", participants=124, avg_score=88, status="Active"),
            LearningAssessment(tenant_id=tenant_id, title="Leadership Self Assessment", course_name="Leadership Essentials", due_date="2026-07-30", participants=32, avg_score=0, status="Not Started"),
            LearningAssessment(tenant_id=tenant_id, title="Cloud Basics Assessment", course_name="AWS Cloud Practitioner", due_date="2026-06-30", participants=10, avg_score=79, status="Closed"),
        ]
        for ass in assessments_to_seed:
            db.add(ass)

        await db.commit()
        logger.info("HRMS Learning seeds created successfully.")

    # 4. Seed Exit Management
    exit_count = await db.scalar(select(func.count()).select_from(ExitResignation).where(ExitResignation.tenant_id == tenant_id))
    if exit_count == 0:
        import uuid
        emp_list = await db.execute(select(Employee).where(Employee.tenant_id == tenant_id))
        employees = emp_list.scalars().all()
        
        if not employees:
            logger.info("No employees found. Skipping Exit Management seed.")
            return
            
        # Resignations
        res_list = [
            ExitResignation(
                tenant_id=tenant_id,
                employee_id=employees[3].id if len(employees) > 3 else employees[0].id,
                employee_name="Aisha Patel",
                department="Engineering",
                designation="UX Designer",
                last_working_day=date.today() + timedelta(days=15),
                reason="Personal relocation to another country",
                status="Accepted"
            ),
            ExitResignation(
                tenant_id=tenant_id,
                employee_id=employees[2].id if len(employees) > 2 else employees[0].id,
                employee_name="Sarah Mitchell",
                department="Marketing",
                designation="Marketing Director",
                last_working_day=date.today() - timedelta(days=5),
                reason="Higher learning opportunities and MBA",
                status="Completed"
            )
        ]
        for r in res_list:
            db.add(r)
            
        # Clearance Tasks
        clearances = [
            ExitClearanceTask(
                tenant_id=tenant_id,
                employee_id=employees[3].id if len(employees) > 3 else employees[0].id,
                employee_name="Aisha Patel",
                department="IT",
                task="Laptop & Access Card returned",
                status="Pending",
                assigned_to="IT Team"
            ),
            ExitClearanceTask(
                tenant_id=tenant_id,
                employee_id=employees[3].id if len(employees) > 3 else employees[0].id,
                employee_name="Aisha Patel",
                department="Finance",
                task="Expense settlements cleared",
                status="Done",
                assigned_to="Finance"
            ),
            ExitClearanceTask(
                tenant_id=tenant_id,
                employee_id=employees[3].id if len(employees) > 3 else employees[0].id,
                employee_name="Aisha Patel",
                department="HR",
                task="Exit interview completed",
                status="Done",
                assigned_to="Priya Sharma"
            ),
            ExitClearanceTask(
                tenant_id=tenant_id,
                employee_id=employees[3].id if len(employees) > 3 else employees[0].id,
                employee_name="Aisha Patel",
                department="Manager",
                task="KT (Knowledge Transfer) signed off",
                status="In Progress",
                assigned_to="Alex Rivera"
            )
        ]
        for c in clearances:
            db.add(c)
            
        # Settlements
        settlements = [
            ExitFinalSettlement(
                tenant_id=tenant_id,
                employee_id=employees[2].id if len(employees) > 2 else employees[0].id,
                employee_name="Sarah Mitchell",
                last_working_day=date.today() - timedelta(days=5),
                components_json=[
                    {"item": "Salary for June (30 days)", "amount": 3500},
                    {"item": "Leave Encashment (3 days unused)", "amount": 485},
                    {"item": "Gratuity", "amount": 2800},
                    {"item": "Bonus (pro-rated)", "amount": 1500},
                    {"item": "PF Settlement", "amount": 8400},
                    {"item": "TDS Deduction (Final)", "amount": -1200}
                ]
            )
        ]
        for s in settlements:
            db.add(s)
            
        # Experience Letters
        letters = [
            ExitExperienceLetter(
                tenant_id=tenant_id,
                employee_id=employees[2].id if len(employees) > 2 else employees[0].id,
                employee_name="Sarah Mitchell",
                designation="Marketing Director",
                from_date=date.today() - timedelta(days=730),
                to_date=date.today() - timedelta(days=5),
                issued_on=str(date.today() - timedelta(days=4)),
                status="Issued"
            ),
            ExitExperienceLetter(
                tenant_id=tenant_id,
                employee_id=employees[3].id if len(employees) > 3 else employees[0].id,
                employee_name="Aisha Patel",
                designation="UX Designer",
                from_date=date.today() - timedelta(days=365),
                to_date=date.today() + timedelta(days=15),
                issued_on="—",
                status="Pending"
            )
        ]
        for l in letters:
            db.add(l)
            
        await db.commit()
        logger.info("HRMS Exit Management seeds created successfully.")


async def seed_crm_features(db: AsyncSession) -> None:
    from datetime import date
    tenants = (await db.execute(select(Tenant))).scalars().all()
    for tenant in tenants:
        tenant_id = tenant.id

        from src.models import Customer, Lead, CRMSupportTicket, CRMQuotation, CRMSalesOrder

        # 1. Seed Leads
        lead_count = await db.scalar(select(func.count()).select_from(Lead).where(Lead.tenant_id == tenant_id))
        if lead_count > 0:
            logger.info(f"CRM & Sales features already seeded for tenant {tenant.slug}. Skipping.")
            continue

        logger.info(f"Seeding CRM Leads for tenant {tenant.slug}...")
        leads = [
            Lead(
                tenant_id=tenant_id,
                name="David Chen",
                company_name="Chen Technologies",
                email="david@chentech.com",
                phone="+91 9123456780",
                status="New",
                source="Social Media",
                estimated_value=15000.0,
                notes="Inquired about corporate licenses. Seems highly interested.",
                ai_score=85,
                ai_sentiment="Positive"
            ),
            Lead(
                tenant_id=tenant_id,
                name="Sarah Jenkins",
                company_name="Jenkins Logistics",
                email="sarah@jenkinslog.com",
                phone="+91 9123456781",
                status="Contacted",
                source="Website Inquiry",
                estimated_value=8500.0,
                notes="Needs a custom shipping integration demo asap.",
                ai_score=92,
                ai_sentiment="Urgent"
            ),
            Lead(
                tenant_id=tenant_id,
                name="Robert Johnson",
                company_name="Johnson & Co",
                email="robert@johnsonco.com",
                phone="+91 9123456782",
                status="Qualified",
                source="Referral",
                estimated_value=25000.0,
                notes="Decision maker is warm. Wants to schedule a pilot run next month.",
                ai_score=78,
                ai_sentiment="Neutral"
            )
        ]
        for l in leads:
            db.add(l)
        await db.flush()

        # 2. Seed Customers
        logger.info(f"Seeding CRM Customers for tenant {tenant.slug}...")
        customers = [
            Customer(
                tenant_id=tenant_id,
                name="Acme Corporation",
                email="billing@acme.com",
                phone="+1 555-0199",
                status="Active",
                customer_type="Corporate",
                address="456 Acme Industrial Boulevard, Mumbai"
            ),
            Customer(
                tenant_id=tenant_id,
                name="Globex Biotech",
                email="procurement@globex.org",
                phone="+1 555-0144",
                status="Active",
                customer_type="Corporate",
                address="789 Trade Tower, BKC, Mumbai"
            )
        ]
        for c in customers:
            db.add(c)
        await db.flush()

        # 3. Seed Support Tickets
        logger.info(f"Seeding CRM Support Tickets for tenant {tenant.slug}...")
        tickets = [
            CRMSupportTicket(
                tenant_id=tenant_id,
                customer_id=customers[0].id,
                subject="API webhook payload delay",
                description="Webhooks for POS checkouts are arriving 4-5 seconds late. Please check broker latency.",
                priority="High",
                status="Open"
            ),
            CRMSupportTicket(
                tenant_id=tenant_id,
                customer_id=customers[1].id,
                subject="Missing billing invoice copy",
                description="We did not receive the automated PDF invoice for June 2026 renewal. Please send manually.",
                priority="Medium",
                status="Resolved"
            )
        ]
        for t in tickets:
            db.add(t)
            
        # 4. Seed Quotations
        logger.info(f"Seeding CRM Quotations for tenant {tenant.slug}...")
        quotations = [
            CRMQuotation(
                tenant_id=tenant_id,
                customer_id=customers[0].id,
                quote_number=f"QT-2026-{tenant.slug.upper()}-001",
                items={"items": [{"name": "Enterprise POS Subscription", "qty": 10, "price": 1200}]},
                subtotal=12000.0,
                tax=2160.0,
                total=14160.0,
                status="Sent"
            ),
            CRMQuotation(
                tenant_id=tenant_id,
                customer_id=customers[1].id,
                quote_number=f"QT-2026-{tenant.slug.upper()}-002",
                items={"items": [{"name": "Hardware Terminal Pro", "qty": 5, "price": 450}]},
                subtotal=2250.0,
                tax=405.0,
                total=2655.0,
                status="Draft"
            )
        ]
        for q in quotations:
            db.add(q)
        await db.flush()

        # 5. Seed Sales Orders
        logger.info(f"Seeding CRM Sales Orders for tenant {tenant.slug}...")
        orders = [
            CRMSalesOrder(
                tenant_id=tenant_id,
                customer_id=customers[0].id,
                order_number=f"SO-2026-{tenant.slug.upper()}-001",
                items={"items": [{"name": "Enterprise Subscription", "qty": 1, "price": 8500}]},
                total=8500.0,
                status="Processing",
                payment_status="Paid"
            )
        ]
        for o in orders:
            db.add(o)
            
        # 6. Seed Opportunities
        logger.info(f"Seeding CRM Opportunities for tenant {tenant.slug}...")
        from src.models import CRMOpportunity
        opportunities = [
            CRMOpportunity(
                tenant_id=tenant_id,
                customer_id=customers[0].id,
                name="Nimbus Retail POS Expansion",
                stage="Value Proposition",
                amount=45000.0,
                probability=70,
                expected_close_date=date(2026, 9, 30)
            ),
            CRMOpportunity(
                tenant_id=tenant_id,
                lead_id=leads[2].id,
                name="Johnson & Co Q3 Enterprise Rollout",
                stage="Needs Analysis",
                amount=85000.0,
                probability=40,
                expected_close_date=date(2026, 11, 15)
            )
        ]
        for opp in opportunities:
            db.add(opp)
            
    await db.commit()
    logger.info("CRM & Sales seeds created successfully.")


async def seed_accounting_features(db: AsyncSession) -> None:
    tenants = (await db.execute(select(Tenant))).scalars().all()
    for tenant in tenants:
        tenant_id = tenant.id

        from src.models import Company, Branch
        from src.models.erp import (
            ChartOfAccount, BankAccount, BankTransaction, JournalEntry, JournalEntryLine,
            AccountType, AccountSubType, BankAccountStatus, EntryStatus, EntryType
        )

        # Check if we already have accounts for this tenant
        acc_count = await db.scalar(select(func.count()).select_from(ChartOfAccount).where(ChartOfAccount.tenant_id == tenant_id))
        if acc_count > 0:
            logger.info(f"Accounting features already seeded for tenant {tenant.slug}. Skipping.")
            continue

        logger.info(f"Seeding Chart of Accounts for tenant {tenant.slug}...")
        
        # Get or create company for tenant
        comp_id = await db.scalar(select(Company.id).where(Company.tenant_id == tenant_id))
        if not comp_id:
            company = Company(
                tenant_id=tenant_id,
                name=f"{tenant.name or 'Demo'} Company",
                legal_name=f"{tenant.name or 'Demo'} Pvt Ltd",
                company_type="Private Limited",
                industry="Retail",
                country="India",
                state="Maharashtra",
                city="Mumbai",
                default_currency_code="INR"
            )
            db.add(company)
            await db.flush()
            comp_id = company.id

        # Get or create branch for tenant
        branch_id = await db.scalar(select(Branch.id).where(Branch.tenant_id == tenant_id))
        if not branch_id:
            branch = Branch(
                tenant_id=tenant_id,
                company_id=comp_id,
                code="BR-100",
                name="Main Branch",
                city="Mumbai",
                country="India",
                has_warehouse=True
            )
            db.add(branch)
            await db.flush()

        # 1. Create Chart of Accounts
        accounts_to_seed = [
            # ASSETS
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="1000", name="Cash in Bank",
                description="Main operational bank checking account balance",
                account_type=AccountType.ASSET, account_sub_type=AccountSubType.BANK,
                is_control_account=False, is_active=True, opening_balance=1250000.50,
                allow_posting=True, sort_order=10, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="1100", name="Petty Cash",
                description="On-hand cash for office petty expenses",
                account_type=AccountType.ASSET, account_sub_type=AccountSubType.CASH,
                is_control_account=False, is_active=True, opening_balance=15000.00,
                allow_posting=True, sort_order=20, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="1200", name="Accounts Receivable",
                description="Control account for outstanding customer invoices",
                account_type=AccountType.ASSET, account_sub_type=AccountSubType.RECEIVABLE,
                is_control_account=True, is_active=True, opening_balance=450000.00,
                allow_posting=True, sort_order=30, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="1300", name="Prepaid Expenses",
                description="Paid expenses that are not yet incurred",
                account_type=AccountType.ASSET, account_sub_type=AccountSubType.CURRENT_ASSET,
                is_control_account=False, is_active=True, opening_balance=28000.00,
                allow_posting=True, sort_order=40, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="1500", name="Inventory",
                description="Control account for raw materials and finished goods inventory",
                account_type=AccountType.ASSET, account_sub_type=AccountSubType.INVENTORY,
                is_control_account=True, is_active=True, opening_balance=850000.00,
                allow_posting=True, sort_order=50, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="1600", name="Fixed Assets (Net)",
                description="Office machinery, computers and property fixed assets assets balance",
                account_type=AccountType.ASSET, account_sub_type=AccountSubType.FIXED_ASSET,
                is_control_account=False, is_active=True, opening_balance=2100000.00,
                allow_posting=True, sort_order=60, currency_code="INR"
            ),

            # LIABILITIES
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="2000", name="Accounts Payable",
                description="Control account for outstanding vendor bills",
                account_type=AccountType.LIABILITY, account_sub_type=AccountSubType.PAYABLE,
                is_control_account=True, is_active=True, opening_balance=21000.00,
                allow_posting=True, sort_order=70, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="2100", name="GST Payable",
                description="Tax collected from sales and due to government authority",
                account_type=AccountType.LIABILITY, account_sub_type=AccountSubType.TAX,
                is_control_account=False, is_active=True, opening_balance=48000.00,
                allow_posting=True, sort_order=80, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="2200", name="Salaries Payable",
                description="Accrued employee salaries and payroll liabilities",
                account_type=AccountType.LIABILITY, account_sub_type=AccountSubType.CURRENT_LIABILITY,
                is_control_account=False, is_active=True, opening_balance=85000.00,
                allow_posting=True, sort_order=90, currency_code="INR"
            ),

            # EQUITY
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="3000", name="Retained Earnings",
                description="Accumulated net profits retained in the business",
                account_type=AccountType.EQUITY, account_sub_type=AccountSubType.RETAINED_EARNINGS,
                is_control_account=False, is_active=True, opening_balance=1800000.00,
                allow_posting=True, sort_order=100, currency_code="INR"
            ),

            # INCOME
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="4000", name="Sales Revenue",
                description="Revenue from product sales and retail transactions",
                account_type=AccountType.INCOME, account_sub_type=AccountSubType.SALES,
                is_control_account=False, is_active=True, opening_balance=0.0,
                allow_posting=True, sort_order=110, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="4100", name="Other Income",
                description="Interest and miscellaneous income",
                account_type=AccountType.INCOME, account_sub_type=AccountSubType.OTHER_INCOME,
                is_control_account=False, is_active=True, opening_balance=0.0,
                allow_posting=True, sort_order=120, currency_code="INR"
            ),

            # EXPENSES
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="5000", name="Cost of Goods Sold",
                description="Direct cost of merchandise sold to customers",
                account_type=AccountType.EXPENSE, account_sub_type=AccountSubType.COGS,
                is_control_account=False, is_active=True, opening_balance=0.0,
                allow_posting=True, sort_order=130, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="5100", name="Salaries & Wages",
                description="Employee salaries and benefit costs",
                account_type=AccountType.EXPENSE, account_sub_type=AccountSubType.OPERATING_EXPENSE,
                is_control_account=False, is_active=True, opening_balance=0.0,
                allow_posting=True, sort_order=140, currency_code="INR"
            ),
            ChartOfAccount(
                tenant_id=tenant_id, company_id=comp_id, code="5200", name="Office Rent",
                description="Rental costs for offices and showrooms",
                account_type=AccountType.EXPENSE, account_sub_type=AccountSubType.OPERATING_EXPENSE,
                is_control_account=False, is_active=True, opening_balance=0.0,
                allow_posting=True, sort_order=150, currency_code="INR"
            ),
        ]

        for acc in accounts_to_seed:
            db.add(acc)
        await db.flush()

        # Find the newly created cash in bank account
        cash_in_bank = [a for a in accounts_to_seed if a.code == "1000"][0]

        # 2. Seed Bank Accounts
        logger.info(f"Seeding Bank Accounts for tenant {tenant.slug}...")
        bank_acc = BankAccount(
            tenant_id=tenant_id,
            company_id=comp_id,
            chart_of_account_id=cash_in_bank.id,
            name="HDFC Premium Checking",
            account_number="5010020304050",
            ifsc_code="HDFC0000104",
            bank_name="HDFC Bank Ltd",
            branch_name="Bandra East Branch",
            account_type="checking",
            currency_code="INR",
            opening_balance=1250000.50,
            current_balance=1250000.50,
            status=BankAccountStatus.ACTIVE,
            is_default=True
        )
        db.add(bank_acc)
        await db.flush()

        # 3. Seed Bank Transactions
        from datetime import date
        txs = [
            BankTransaction(
                tenant_id=tenant_id, bank_account_id=bank_acc.id, transaction_date=date(2026, 7, 10),
                description="Opening Balance Funding", transaction_type="deposit", amount=1250000.50,
                running_balance=1250000.50, is_reconciled=True, is_manual=False
            ),
            BankTransaction(
                tenant_id=tenant_id, bank_account_id=bank_acc.id, transaction_date=date(2026, 7, 15),
                description="Nexon Vendor Payment PO-402", transaction_type="withdrawal", amount=45000.00,
                running_balance=1205000.50, is_reconciled=False, is_manual=True
            ),
            BankTransaction(
                tenant_id=tenant_id, bank_account_id=bank_acc.id, transaction_date=date(2026, 7, 20),
                description="Retail Cash Counter Receipt", transaction_type="deposit", amount=28500.00,
                running_balance=1233500.50, is_reconciled=False, is_manual=False
            ),
            BankTransaction(
                tenant_id=tenant_id, bank_account_id=bank_acc.id, transaction_date=date(2026, 7, 25),
                description="Bandra Office Rent Posting", transaction_type="withdrawal", amount=12000.00,
                running_balance=1221500.50, is_reconciled=True, is_manual=False
            ),
        ]
        for tx in txs:
            db.add(tx)
        await db.flush()

        # 4. Seed Journal Entries
        logger.info(f"Seeding Journal Entries for tenant {tenant.slug}...")
        je = JournalEntry(
            tenant_id=tenant_id, company_id=comp_id, entry_number="JE-2026-0001",
            entry_type=EntryType.JOURNAL, status=EntryStatus.POSTED, entry_date=date(2026, 7, 1),
            reference="OPENING_2026", description="Initial ledger balances opening entry",
            total_debit=150000.0, total_credit=150000.0, currency_code="INR"
        )
        db.add(je)
        await db.flush()

        # Get accounts references for lines
        salaries_payable = [a for a in accounts_to_seed if a.code == "2200"][0]
        salaries_expense = [a for a in accounts_to_seed if a.code == "5100"][0]

        lines = [
            JournalEntryLine(
                entry_id=je.id, account_id=salaries_expense.id,
                debit=150000.0, credit=0.0, description="Salary expense seeding"
            ),
            JournalEntryLine(
                entry_id=je.id, account_id=salaries_payable.id,
                debit=0.0, credit=150000.0, description="Salary liability seeding"
            )
        ]
        for line in lines:
            db.add(line)

    await db.commit()
    logger.info("Seeded default accounting data successfully.")

