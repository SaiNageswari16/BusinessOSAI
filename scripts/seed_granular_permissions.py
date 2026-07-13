import asyncio
import os
import sys

# Ensure backend source is in search path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

# Load .env file manually into os.environ if it exists
def load_env():
    # Try different possible .env locations
    locations = [
        os.path.join("backend", ".env"),
        ".env",
        os.path.join("..", "backend", ".env"),
        os.path.join("backend", "src", ".env")
    ]
    for loc in locations:
        if os.path.exists(loc):
            print(f"Loading environment from {loc}")
            with open(loc, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        os.environ[k] = v
            break

load_env()

# 1. Update backend/src/utils/security.py with granular permissions
security_path = os.path.join("backend", "src", "utils", "security.py")
with open(security_path, "r", encoding="utf-8") as f:
    sec_content = f.read()

line_ending = "\r\n" if "\r\n" in sec_content else "\n"

# Verify if we already have the new permissions to avoid duplicate append
if "view:users" not in sec_content:
    old_perms_list_end = """    # Audit log permissions — used by audit-log endpoints
    ("view:audit_logs", "View Audit Logs", "erp", "Access the system-wide audit trail"),
]"""

    new_perms_list_end = """    # Audit log permissions — used by audit-log endpoints
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
]"""

    sec_content = sec_content.replace(old_perms_list_end.replace("\n", line_ending), new_perms_list_end.replace("\n", line_ending))
    with open(security_path, "w", encoding="utf-8", newline=line_ending) as f:
        f.write(sec_content)
    print("Backend security.py updated with granular permissions list.")
else:
    print("Backend security.py already contains granular permissions list.")

# Re-read file to verify/insert HRMS permissions
with open(security_path, "r", encoding="utf-8") as f:
    sec_content = f.read()

if "view:hrms_employees" not in sec_content:
    old_perms_list_end = """    ("view:error_logs", "View Error Logs", "system", "Access system debug error traceback logs"),
]"""

    new_perms_list_end = """    ("view:error_logs", "View Error Logs", "system", "Access system debug error traceback logs"),
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
]"""

    sec_content = sec_content.replace(old_perms_list_end.replace("\n", line_ending), new_perms_list_end.replace("\n", line_ending))
    with open(security_path, "w", encoding="utf-8", newline=line_ending) as f:
        f.write(sec_content)
    print("Backend security.py updated with HRMS granular permissions list.")
else:
    print("Backend security.py already contains HRMS granular permissions list.")

# 2. Run db seed permissions logic
async def run_seeder():
    from src.database.session import AsyncSessionLocal
    from src.utils.security import seed_permissions
    from src.models import Role, Permission, RolePermission
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as db:
        # Seed permissions
        await seed_permissions(db)
        await db.commit()
        
        # Seed Employee role permissions for all tenants
        ess_perm_codes = [
            "view:dashboard", "view:hrms", 
            "view:ess_attendance", "view:ess_leaves", 
            "view:ess_payroll", "view:ess_documents", 
            "view:ess_tasks_announcements"
        ]
        
        # Fetch permissions
        perm_res = await db.execute(select(Permission).where(Permission.code.in_(ess_perm_codes)))
        ess_perms = perm_res.scalars().all()
        
        # Fetch all roles named 'Employee'
        roles_res = await db.execute(select(Role).where(Role.name == "Employee"))
        employee_roles = roles_res.scalars().all()
        
        for r in employee_roles:
            existing_rp_res = await db.execute(
                select(RolePermission.permission_id).where(RolePermission.role_id == r.id)
            )
            existing_pids = {pid for pid in existing_rp_res.scalars().all()}
            
            for p in ess_perms:
                if p.id not in existing_pids:
                    db.add(RolePermission(role_id=r.id, permission_id=p.id))
                    
        await db.commit()
        
    print("Database successfully seeded with new granular permissions, and Super Admin and Employee roles updated!")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_seeder())
