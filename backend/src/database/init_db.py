import logging
import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.database.base import Base
from src.database.session import engine
from src.models import (
    ActivityLog,
    AuditLog,
    Branch,
    BusinessUnit,
    Company,
    CostCenter,
    Currency,
    Department,
    Designation,
    FiscalYear,
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
    if not settings.auto_create_tables:
        logger.info("AUTO_CREATE_TABLES=false; skipping table creation")
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ensured via SQLAlchemy metadata.create_all()")


async def bootstrap_defaults(db: AsyncSession) -> None:
    if not settings.seed_default_permissions:
        return

    await seed_permissions(db)

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
