import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import get_settings
from src.models import Permission, Role, RolePermission

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEFAULT_PERMISSIONS: list[tuple[str, str, str, str]] = [
    ("view:dashboard", "View Dashboard", "core", "Access main dashboard"),
    ("view:copilot", "View AI Copilot", "core", "Access AI assistant"),
    ("view:erp", "View Core ERP", "erp", "Access ERP module"),
    ("manage:erp", "Manage Core ERP", "erp", "Full management of ERP settings and components"),
    ("view:inventory", "View Inventory", "inventory", "Access inventory module"),
    ("manage:inventory", "Manage Inventory", "inventory", "Manage inventory items and configurations"),
    ("view:warehouse", "View Warehouse", "warehouse", "Access warehouse module"),
    ("manage:warehouse", "Manage Warehouse", "warehouse", "Manage warehouse settings and zones"),
    ("view:procurement", "View Procurement", "procurement", "Access procurement module"),
    ("manage:procurement", "Manage Procurement", "procurement", "Manage purchase cycles and suppliers"),
    ("view:pos", "View POS", "pos", "Access point of sale"),
    ("view:accounting", "View Accounting", "accounting", "Access accounting module"),
    ("view:crm", "View CRM", "crm", "Access CRM module"),
    ("manage:crm", "Manage CRM", "crm", "Create and update CRM records"),
    ("view:crm_leads", "View CRM Leads", "crm", "View sales leads and activities"),
    ("manage:crm_leads", "Manage CRM Leads", "crm", "Create, assign and convert sales leads"),
    ("view:crm_customers", "View CRM Customers", "crm", "View customer records"),
    ("manage:crm_customers", "Manage CRM Customers", "crm", "Create and maintain customer records"),
    ("view:hrms", "View HRMS", "hrms", "Access HRMS module"),
    ("view:payroll", "View Payroll", "payroll", "Access payroll module"),
    ("view:reports", "View Reports", "reports", "Access reports"),
    ("view:settings", "View Settings", "settings", "Access system settings"),
    ("manage:users", "Manage Users", "erp", "Create and manage users"),
    ("manage:roles", "Manage Roles", "erp", "Create and manage roles"),
    ("manage:companies", "Manage Companies", "erp", "Create and manage companies"),
    ("manage:branches", "Manage Branches", "erp", "Create and manage branches"),
    ("manage:accounting", "Manage Accounting", "accounting", "Create and manage accounting entries"),
    ("manage:audit", "Manage Audit", "system", "Manage and view audit logs"),
    ("view:audit", "View Audit", "system", "View audit logs"),
    # Financial ERP permissions — used by fiscal-years, currencies, taxes, payment-terms, cost-centers, number-series
    ("view:financials", "View Financials", "erp", "Access fiscal years, currencies, tax configs, payment terms"),
    ("manage:financials", "Manage Financials", "erp", "Create/edit fiscal years, currencies, tax configs, payment terms"),
    # Access control permissions — used by roles/permissions management endpoints
    ("view:access_control", "View Access Control", "erp", "View roles, permissions, and user role assignments"),
    ("manage:access_control", "Manage Access Control", "erp", "Create and manage roles and permissions"),
    # Audit log permissions — used by audit-log endpoints
    ("view:audit_logs", "View Audit Logs", "erp", "Access the system-wide audit trail"),
    # Granular Access & Security permissions
    ("view:users", "View Users", "erp", "View list of user accounts"),
    ("view:roles", "View Roles", "erp", "View system roles and descriptions"),
    ("view:permission_matrix", "View Permission Matrix", "erp", "Access the matrix overview of permissions"),
    ("view:workspaces", "View Workspaces", "erp", "View workspaces configuration"),
    ("manage:workspaces", "Manage Workspaces", "erp", "Create and edit workspaces"),
    ("view:subscription", "View Subscription & License", "erp", "View plan, usage, and billing info"),
    ("manage:subscription", "Manage Subscription & License", "erp", "Modify plan and billing details"),
    ("view:api_keys", "View API Keys", "erp", "View developer integration API keys"),
    ("manage:api_keys", "Manage API Keys", "erp", "Generate and delete API keys"),
    ("view:mfa_policies", "View MFA Policies", "erp", "View Multi-Factor Authentication settings"),
    ("manage:mfa_policies", "Manage MFA Policies", "erp", "Configure Multi-Factor Authentication settings"),

    # Granular Organization structure permissions
    ("view:branches", "View Branches", "erp", "View branch locations list"),
    ("manage:branches", "Manage Branches", "erp", "Create and edit branch details"),
    ("view:departments", "View Departments", "erp", "View departments structure"),
    ("manage:departments", "Manage Departments", "erp", "Create and edit departments"),
    ("view:designations", "View Designations", "erp", "View job designations"),
    ("manage:designations", "Manage Designations", "erp", "Create and edit designations"),
    ("view:teams", "View Teams", "erp", "View company teams"),
    ("manage:teams", "Manage Teams", "erp", "Create and manage teams"),

    # Granular Master Data permissions
    ("view:currencies", "View Currencies", "erp", "View currencies and exchange rates"),
    ("manage:currencies", "Manage Currencies", "erp", "Modify currencies and exchange rates"),
    ("view:fiscal_years", "View Fiscal Years", "erp", "View company fiscal cycles"),
    ("manage:fiscal_years", "Manage Fiscal Years", "erp", "Configure fiscal years"),
    ("view:taxes", "View Tax Configurations", "erp", "View tax slabs and rates"),
    ("manage:taxes", "Manage Tax Configurations", "erp", "Configure taxes and GST rates"),
    ("view:payment_terms", "View Payment Terms", "erp", "View transaction payment terms"),
    ("manage:payment_terms", "Manage Payment Terms", "erp", "Configure transaction payment terms"),
    ("view:cost_centers", "View Cost Centers", "erp", "View cost center mapping"),
    ("manage:cost_centers", "Manage Cost Centers", "erp", "Configure cost centers"),
    ("view:number_series", "View Number Series", "erp", "View auto-increment serial configs"),
    ("manage:number_series", "Manage Number Series", "erp", "Configure auto-increment serial configs"),
    ("view:workflows", "View Workflows", "erp", "View workflow automation definitions"),
    ("manage:workflows", "Manage Workflows", "erp", "Configure workflow automation definitions"),
    ("view:geography", "View Geography", "erp", "View geographical regions, zones, locations"),
    ("manage:geography", "Manage Geography", "erp", "Modify geographical regions, zones, locations"),
    ("view:locations", "View Locations", "erp", "View warehouse and inventory locations"),
    ("manage:locations", "Manage Locations", "erp", "Modify warehouse and inventory locations"),
    ("view:tags", "View Tags & Labels", "erp", "View system classification tags"),
    ("manage:tags", "Manage Tags & Labels", "erp", "Configure system classification tags"),
    ("view:document_templates", "View Document Templates", "erp", "View print and PDF templates"),
    ("manage:document_templates", "Manage Document Templates", "erp", "Modify print and PDF templates"),
    ("view:notification_templates", "View Notification Templates", "erp", "View email and SMS notification templates"),
    ("manage:notification_templates", "Manage Notification Templates", "erp", "Modify email and SMS templates"),

    # Granular System Admin permissions
    ("view:backup", "View Backup & Restore", "system", "View data backup configurations"),
    ("manage:backup", "Manage Backup & Restore", "system", "Run backups and restore data"),
    ("view:system_health", "View System Health", "system", "Access application performance monitors"),
    ("view:activity_logs", "View Activity Logs", "system", "Access system user activity history"),
    ("view:error_logs", "View Error Logs", "system", "Access system debug error traceback logs"),
    # Granular HRMS - Employee Management
    ("view:hrms_employees", "View HRMS Employees", "hrms", "View company employees list"),
    ("manage:hrms_employees", "Manage HRMS Employees", "hrms", "Create, edit and delete employee records"),
    ("view:hrms_departments", "View HRMS Departments", "hrms", "View departments structure"),
    ("manage:hrms_departments", "Manage HRMS Departments", "hrms", "Modify departments list"),
    ("view:hrms_designations", "View HRMS Designations", "hrms", "View job designations"),
    ("manage:hrms_designations", "Manage HRMS Designations", "hrms", "Modify designations list"),
    ("view:hrms_teams", "View HRMS Teams", "hrms", "View teams list"),
    ("manage:hrms_teams", "Manage HRMS Teams", "hrms", "Modify teams list"),
    ("view:hrms_documents", "View HRMS Documents", "hrms", "Access employee file documents"),
    ("manage:hrms_documents", "Manage HRMS Documents", "hrms", "Approve/Reject or upload employee documents"),
    ("view:hrms_profiles", "View HRMS Profiles", "hrms", "Access profiles details"),

    # Granular HRMS - Attendance
    ("view:hrms_attendance", "View HRMS Attendance", "hrms", "Access attendance records list"),
    ("manage:hrms_attendance", "Manage HRMS Attendance", "hrms", "Add manual logs and edit clock-ins"),
    ("view:hrms_biometric", "View Biometric Integrations", "hrms", "Configure biometric scanners sync"),
    ("view:hrms_face", "View Face Recognition Logins", "hrms", "Access face ID records"),
    ("view:hrms_gps", "View GPS Trackings", "hrms", "Access live check-in coordinate maps"),
    ("view:hrms_shifts", "View Shifts Configuration", "hrms", "Access calendar templates and rosters"),
    ("view:hrms_corrections", "View Attendance Corrections", "hrms", "View pending corrections requests"),
    ("manage:hrms_corrections", "Manage Attendance Corrections", "hrms", "Approve/Reject employee clock correction requests"),

    # Granular HRMS - Leave
    ("view:hrms_leaves", "View Leave Management", "hrms", "Access leave policies and list of requests"),
    ("manage:hrms_leaves", "Manage Leave Requests", "hrms", "Apply leaves on behalf of employees"),
    ("view:hrms_leave_calendar", "View Leave Calendar", "hrms", "Access team holiday schedule"),
    ("view:hrms_leave_balance", "View Leave Balance Matrix", "hrms", "View balances for all employees"),
    ("view:hrms_leave_policies", "View Leave Policies", "hrms", "Access system schemes"),
    ("manage:hrms_leave_policies", "Manage Leave Policies", "hrms", "Configure leave policies and limits"),
    ("view:hrms_leave_approvals", "View Leave Approvals", "hrms", "Access pending approvals checklist"),
    ("manage:hrms_leave_approvals", "Manage Leave Approvals", "hrms", "Approve/Reject leave applications"),

    # Granular HRMS - Payroll
    ("view:hrms_salary_structure", "View Salary Structures", "hrms", "View components details"),
    ("manage:hrms_salary_structure", "Manage Salary Structures", "hrms", "Configure formula mappings"),
    ("view:hrms_pay_grades", "View Pay Grades", "hrms", "View grade structures"),
    ("manage:hrms_pay_grades", "Manage Pay Grades", "hrms", "Configure salaries grade caps"),
    ("view:hrms_payroll_processing", "Process Monthly Payroll", "hrms", "Run payment cycles and sign off disbursements"),
    ("view:hrms_pf_esi", "View PF & ESI Settings", "hrms", "View statutory deduction rates"),
    ("view:hrms_tds", "View TDS Configurations", "hrms", "Access tax withholding summaries"),
    ("view:hrms_payslips", "View & Send Payslips", "hrms", "View payslips and dispatch to email"),
    ("view:hrms_loans_advances", "View Loans & Advances", "hrms", "Access financial loans data"),
    ("manage:hrms_loans_advances", "Manage Loans & Advances", "hrms", "Configure and approve loans"),
    ("view:hrms_bonuses_commissions", "Manage Bonuses & Commissions", "hrms", "Award variables"),

    # Granular HRMS - Recruitment
    ("view:hrms_recruitment", "View Recruitment", "hrms", "Access jobs and candidate profiles"),
    ("manage:hrms_recruitment", "Manage Recruitment", "hrms", "Create job posts and schedule interviews"),
    ("view:hrms_onboarding", "Manage Onboarding", "hrms", "Verify offer letters and checklist tasks"),

    # Granular HRMS - Performance
    ("view:hrms_performance", "View Performance Ratings", "hrms", "Access performance goals, KPIs and reviews"),
    ("manage:hrms_performance", "Manage Appraisals", "hrms", "Conduct employee appraisals"),

    # Granular HRMS - Learning
    ("view:hrms_learning", "View Learning Courses", "hrms", "Access training courses and certification details"),
    ("manage:hrms_learning", "Manage Learning Programs", "hrms", "Create courses, tests and certificate definitions"),

    # Granular HRMS - Exit Management
    ("view:hrms_exit", "View Exit Processings", "hrms", "View resignations lists and clearances"),
    ("manage:hrms_exit", "Manage Exit Processings", "hrms", "Configure final settlements and print letters"),

    # Granular HRMS - HR Intelligence
    ("view:hrms_intelligence", "Access HR Intelligence AI", "hrms", "Access AI attrition risk and productivity scores"),

    # Granular HRMS - ESS (Employee Self Service)
    ("view:ess_dashboard", "Access ESS Portal", "hrms", "Access self service module"),
    ("view:ess_attendance", "View Own Attendance", "hrms", "Clock in/out and view own card"),
    ("view:ess_leaves", "View Own Leaves", "hrms", "Apply for leaves and view own balance"),
    ("view:ess_payroll", "View Own Payroll info", "hrms", "View and download personal payslips"),
    ("view:ess_documents", "View Own Documents", "hrms", "Upload and view personal documents"),
    ("view:ess_tasks_announcements", "View Task Updates", "hrms", "Access tasks list and announcements"),
]


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(*, subject: str, tenant_id: str, permissions: list[str], active_role_id: str | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": subject,
        "tenant_id": tenant_id,
        "permissions": permissions,
        "type": "access",
        "exp": expire,
    }
    if active_role_id:
        payload["active_role_id"] = active_role_id
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token_value() -> str:
    return secrets.token_urlsafe(64)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
    if payload.get("type") != "access":
        raise ValueError("Invalid token type")
    return payload


async def seed_permissions(db: AsyncSession) -> None:
    # 1. Seed all default permissions
    result = await db.execute(select(Permission))
    all_perms = {p.code: p for p in result.scalars().all()}
    
    new_perms_added = False
    for code, name, module, description in DEFAULT_PERMISSIONS:
        if code not in all_perms:
            perm = Permission(code=code, name=name, module=module, description=description)
            db.add(perm)
            all_perms[code] = perm
            new_perms_added = True
            
    if new_perms_added:
        await db.flush()

    # 2. Grant all current database permissions to all existing Super Admin roles
    result = await db.execute(select(Permission))
    db_perms = result.scalars().all()
    
    super_roles_res = await db.execute(select(Role).where(Role.name == "Super Admin"))
    super_roles = super_roles_res.scalars().all()
    
    for r in super_roles:
        existing_rp_res = await db.execute(select(RolePermission.permission_id).where(RolePermission.role_id == r.id))
        existing_pids = {pid for pid in existing_rp_res.scalars().all()}
        
        for p in db_perms:
            if p.id not in existing_pids:
                db.add(RolePermission(role_id=r.id, permission_id=p.id))
    await db.flush()


async def create_super_admin_role(db: AsyncSession, tenant_id) -> Role:
    role = Role(
        tenant_id=tenant_id,
        name="Super Admin",
        description="Full access to all modules and system settings",
        is_system=True,
    )
    db.add(role)
    await db.flush()

    permissions = await db.execute(select(Permission))
    for permission in permissions.scalars().all():
        db.add(RolePermission(role_id=role.id, permission_id=permission.id))
    await db.flush()
    return role
