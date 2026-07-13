import os
import sys

# 1. Update backend/src/utils/security.py with HRMS permissions
security_path = os.path.join("backend", "src", "utils", "security.py")
with open(security_path, "r", encoding="utf-8") as f:
    sec_content = f.read()

line_ending = "\r\n" if "\r\n" in sec_content else "\n"

# Verify if we already have HRMS permissions to avoid duplicate append
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

    print("Backend security.py updated with HRMS permissions.")
else:
    print("Backend security.py already contains HRMS permissions.")
