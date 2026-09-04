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
    # ─── Workspace & AI ───
    ("view:dashboard", "View Dashboard", "core", "Access main dashboard overview"),
    ("view:copilot", "View AI Copilot", "core", "Access AI assistant copilot"),
    ("view:workspaces", "View Workspaces", "core", "View workspaces configuration"),
    ("manage:workspaces", "Manage Workspaces", "core", "Create and configure workspaces"),
    ("view:subscription", "View Subscription & License", "core", "View subscription plan, usage, and billing info"),
    ("manage:subscription", "Manage Subscription & License", "core", "Modify subscription tier, add-ons, and billing"),
    ("view:api_keys", "View API Keys", "core", "View developer integration API keys"),
    ("manage:api_keys", "Manage API Keys", "core", "Generate and revoke developer API keys"),
    ("view:mfa_policies", "View MFA Policies", "core", "View Multi-Factor Authentication settings"),
    ("manage:mfa_policies", "Manage MFA Policies", "core", "Configure tenant-wide MFA security policies"),

    # ─── Access Control & Security ───
    ("view:users", "View Users", "erp", "View list of user accounts"),
    ("manage:users", "Manage Users", "erp", "Create, edit, suspend and delete user accounts"),
    ("view:roles", "View Roles", "erp", "View system roles and permission sets"),
    ("manage:roles", "Manage Roles", "erp", "Create and customize system roles and permissions"),
    ("view:permission_matrix", "View Permission Matrix", "erp", "Access the matrix overview of role permissions"),
    ("view:access_control", "View Access Control", "erp", "View access control lists and role assignments"),
    ("manage:access_control", "Manage Access Control", "erp", "Administer access control lists and role assignments"),

    # ─── System Admin & Logs ───
    ("view:system_config", "View System Configuration", "system_config", "Access environment and global system settings"),
    ("manage:system_config", "Manage System Configuration", "system_config", "Modify environment variables and system flags"),
    ("manage:system_admin", "Manage System Admin", "system_config", "Full system administration and settings access"),
    ("view:settings", "View Settings", "system_config", "Access system settings tabs and panels"),
    ("manage:settings", "Manage Settings", "system_config", "Modify global system settings and configurations"),
    ("view:backup", "View Backup & Restore", "system", "View data backup schedules and archives"),
    ("manage:backup", "Manage Backup & Restore", "system", "Run on-demand backups and restore data"),
    ("view:system_health", "View System Health", "system", "Access application performance monitors and server metrics"),
    ("view:activity_logs", "View Activity Logs", "system", "Access user activity logs"),
    ("view:error_logs", "View Error Logs", "system", "Access debug error traceback logs"),
    ("view:audit", "View Audit Logs", "system", "View audit trail entries"),
    ("manage:audit", "Manage Audit Logs", "system", "Manage and export system audit trail"),
    ("view:audit_logs", "View System Audit Logs", "system", "Access comprehensive system audit records"),
    ("view:webhooks", "View Webhooks", "system_config", "View active webhooks and payload logs"),
    ("manage:webhooks", "Manage Webhooks", "system_config", "Create, test, and manage webhook endpoints"),

    # ─── Organization Structure ───
    ("view:companies", "View Companies", "erp", "View company entities"),
    ("manage:companies", "Manage Companies", "erp", "Create and configure company entities"),
    ("view:company", "View Company Profile", "erp", "View current company details"),
    ("manage:company", "Manage Company Profile", "erp", "Edit current company settings and GST registrations"),
    ("view:branches", "View Branches", "erp", "View branch locations list"),
    ("manage:branches", "Manage Branches", "erp", "Create, edit, and deactivate branches"),
    ("view:departments", "View Departments", "erp", "View departments structure"),
    ("manage:departments", "Manage Departments", "erp", "Create and edit departments"),
    ("view:designations", "View Designations", "erp", "View job designations"),
    ("manage:designations", "Manage Designations", "erp", "Create and edit designations"),
    ("view:teams", "View Teams", "erp", "View company teams"),
    ("manage:teams", "Manage Teams", "erp", "Create and manage organizational teams"),

    # ─── Master Data & Core Setup ───
    ("view:erp", "View Core ERP", "erp", "Access core ERP back office"),
    ("manage:erp", "Manage Core ERP", "erp", "Full management of core ERP settings and master data"),
    ("edit:erp", "Edit Core ERP", "erp", "Edit master catalog and ERP records"),
    ("view:financials", "View Financials Setup", "erp", "View financial master data and configurations"),
    ("manage:financials", "Manage Financials Setup", "erp", "Configure financial master data, fiscal years, and taxes"),
    ("view:currencies", "View Currencies", "erp", "View currencies and exchange rates"),
    ("manage:currencies", "Manage Currencies", "erp", "Configure currencies and update exchange rates"),
    ("view:fiscal_years", "View Fiscal Years", "erp", "View company fiscal cycles"),
    ("manage:fiscal_years", "Manage Fiscal Years", "erp", "Configure fiscal years and closing periods"),
    ("view:taxes", "View Tax Configurations", "erp", "View tax slabs, GST rates, and cess configurations"),
    ("manage:taxes", "Manage Tax Configurations", "erp", "Configure tax slabs, GST rates, and rules"),
    ("view:payment_terms", "View Payment Terms", "erp", "View transaction payment terms"),
    ("manage:payment_terms", "Manage Payment Terms", "erp", "Configure credit terms and schedules"),
    ("view:cost_centers", "View Cost Centers", "erp", "View cost center mapping and budget codes"),
    ("manage:cost_centers", "Manage Cost Centers", "erp", "Create and manage cost centers"),
    ("view:number_series", "View Number Series", "erp", "View auto-increment serial prefixes"),
    ("manage:number_series", "Manage Number Series", "erp", "Configure auto-numbering sequences for vouchers and invoices"),
    ("view:workflows", "View Workflows", "erp", "View workflow automation and approval rules"),
    ("manage:workflows", "Manage Workflows", "erp", "Configure automated workflow routing and approvals"),
    ("view:geography", "View Geography", "erp", "View countries, states, and city master data"),
    ("manage:geography", "Manage Geography", "erp", "Configure countries, states, and shipping zones"),
    ("view:locations", "View Locations", "erp", "View warehouse bins, aisles, and storage locations"),
    ("manage:locations", "Manage Locations", "erp", "Configure warehouse bins, racks, and storage zones"),
    ("view:tags", "View Tags & Labels", "erp", "View classification tags"),
    ("manage:tags", "Manage Tags & Labels", "erp", "Create and assign classification tags"),
    ("view:document_templates", "View Document Templates", "erp", "View print and PDF document layouts"),
    ("manage:document_templates", "Manage Document Templates", "erp", "Customize invoice and voucher print templates"),
    ("view:notification_templates", "View Notification Templates", "erp", "View email, SMS, and WhatsApp notification templates"),
    ("manage:notification_templates", "Manage Notification Templates", "erp", "Edit email, SMS, and WhatsApp notification templates"),

    # ─── Inventory & Warehouse ───
    ("view:inventory", "View Inventory", "inventory", "Access inventory items, stock levels, and batches"),
    ("manage:inventory", "Manage Inventory", "inventory", "Create, edit, and adjust inventory items"),
    ("create:inventory", "Create Inventory Items", "inventory", "Add new products and inventory batches"),
    ("view:product_categories", "View Product Categories", "inventory", "View category hierarchy"),
    ("manage:product_categories", "Manage Product Categories", "inventory", "Create and edit product categories"),
    ("view:brands", "View Brands", "inventory", "View brand directory"),
    ("manage:brands", "Manage Brands", "inventory", "Create and edit brands"),
    ("view:stock_adjustments", "View Stock Adjustments", "inventory", "View stock adjustments history"),
    ("manage:stock_adjustments", "Manage Stock Adjustments", "inventory", "Perform stock reconciliations and quantity write-offs"),
    ("view:stock_transfers", "View Stock Transfers", "inventory", "View inter-warehouse transfer records"),
    ("manage:stock_transfers", "Manage Stock Transfers", "inventory", "Create and execute stock transfers"),
    ("view:barcodes", "View Barcode Management", "inventory", "View barcode templates and assignments"),
    ("manage:barcodes", "Manage Barcodes", "inventory", "Generate and print barcode/QR labels"),
    ("view:warehouse", "View Warehouse", "warehouse", "Access warehouse overview and stock distribution"),
    ("manage:warehouse", "Manage Warehouse", "warehouse", "Configure warehouses, aisles, and storage sections"),

    # ─── Procurement & Operations ───
    ("view:procurement", "View Procurement", "procurement", "Access purchase orders, vendors, and RFQs"),
    ("manage:procurement", "Manage Procurement", "procurement", "Create and manage procurement cycles"),
    ("view:purchase_orders", "View Purchase Orders", "procurement", "View purchase orders list"),
    ("manage:purchase_orders", "Manage Purchase Orders", "procurement", "Create and edit purchase orders"),
    ("approve:purchase_orders", "Approve Purchase Orders", "procurement", "Authorize and approve purchase orders"),
    ("view:grn", "View Goods Received Notes (GRN)", "procurement", "View received shipment notes"),
    ("manage:grn", "Manage Goods Received Notes (GRN)", "procurement", "Inspect shipments and record GRN receipts"),
    ("view:suppliers", "View Suppliers / Vendors", "procurement", "View vendor directory and payment terms"),
    ("manage:suppliers", "Manage Suppliers / Vendors", "procurement", "Onboard and maintain vendor profiles"),
    ("view:rfq", "View RFQ & Vendor Quotes", "procurement", "View request for quotations"),
    ("manage:rfq", "Manage RFQ & Vendor Quotes", "procurement", "Create RFQs and evaluate supplier quotations"),
    ("view:dispatch", "View Dispatch & Logistics", "procurement", "View shipping dispatches and delivery challans"),
    ("manage:dispatch", "Manage Dispatch & Logistics", "procurement", "Create dispatch orders and manage carrier tracking"),

    # ─── POS (Point of Sale) ───
    ("view:pos", "View POS", "pos", "Access point of sale terminal"),
    ("manage:pos", "Manage POS", "pos", "Full management of POS configurations and promotional rules"),
    ("manage:pos_terminal", "Operate POS Terminal", "pos", "Run checkout, scan items, and collect payments"),
    ("discount:pos_billing", "Apply POS Discounts", "pos", "Apply custom discounts and price overrides at checkout"),
    ("void:pos_receipt", "Void POS Transactions", "pos", "Void or cancel active/completed POS receipts"),
    ("view:pos_register", "View Cash Register Shifts", "pos", "View cash drawer balances and shift summaries"),
    ("manage:pos_register", "Manage Cash Register Shifts", "pos", "Open, reconcile cash float, and close register shifts"),
    ("view:pos_history", "View POS History", "pos", "Access past POS transaction receipts"),
    ("refund:pos_history", "Process POS Refunds", "pos", "Issue customer returns, refunds, and credit notes"),

    # ─── Accounting & Financials ───
    ("view:accounting", "View Accounting", "accounting", "Access general ledger, trial balance, and financial reports"),
    ("manage:accounting", "Manage Accounting", "accounting", "Full accounting management and ledger closing"),
    ("view:chart_of_accounts", "View Chart of Accounts", "accounting", "View chart of accounts structure and ledger balances"),
    ("manage:chart_of_accounts", "Manage Chart of Accounts", "accounting", "Create, edit, and archive general ledger accounts"),
    ("view:journal_entries", "View Journal Entries", "accounting", "View journal entries and audit trails"),
    ("manage:journal_entries", "Manage Journal Entries", "accounting", "Create and edit journal entries"),
    ("post:journal_entries", "Post Journal Entries", "accounting", "Post, lock, and reverse journal entries"),
    ("view:journal", "View Journal", "accounting", "Quick access to general journal"),
    ("view:account_balances", "View Account Balances", "accounting", "View real-time account balances and trial balance"),
    ("view:invoices", "View Invoices", "accounting", "View sales invoices, e-Way bills, and credit notes"),
    ("manage:invoices", "Manage Invoices", "accounting", "Create, edit, and send customer invoices"),
    ("create:invoices", "Create Invoices", "accounting", "Generate invoices, e-Way bills, and e-Invoices"),
    ("approve:invoices", "Approve Invoices", "accounting", "Approve high-value invoices and void bills"),
    ("manage:invoice_payments", "Manage Invoice Payments", "accounting", "Record customer payments and issue receipts"),
    ("view:bank_accounts", "View Bank Accounts", "accounting", "View registered bank accounts and balances"),
    ("manage:bank_accounts", "Manage Bank Accounts", "accounting", "Add, edit, and link company bank accounts"),
    ("view:bank_transactions", "View Bank Transactions", "accounting", "View bank statements and transaction feeds"),
    ("manage:bank_transactions", "Manage Bank Transactions", "accounting", "Categorize and record bank deposits/withdrawals"),
    ("view:bank_reconciliations", "View Bank Reconciliations", "accounting", "View bank reconciliation statements"),
    ("manage:bank_reconciliations", "Manage Bank Reconciliations", "accounting", "Perform and sign off bank reconciliations"),
    ("view:bank", "View Bank Module", "accounting", "Access bank overview"),
    ("view:fixed_assets", "View Fixed Assets", "accounting", "View fixed asset register and net book values"),
    ("manage:fixed_assets", "Manage Fixed Assets", "accounting", "Acquire, revalue, dispose assets and run depreciation"),
    ("view:payment_vouchers", "View Payment Vouchers", "accounting", "View payment vouchers and receipts"),
    ("manage:payment_vouchers", "Manage Payment Vouchers", "accounting", "Create and edit payment vouchers"),
    ("approve:payment_vouchers", "Approve Payment Vouchers", "accounting", "Approve and authorize disbursement vouchers"),
    ("view:expense_claims", "View Expense Claims", "accounting", "View employee expense reimbursement requests"),
    ("manage:expense_claims", "Manage Expense Claims", "accounting", "Submit and edit expense claims"),
    ("approve:expense_claims", "Approve Expense Claims", "accounting", "Approve or reject employee expense claims"),
    ("view:budgets", "View Budgets", "accounting", "View annual and monthly departmental budget plans"),
    ("manage:budgets", "Manage Budgets", "accounting", "Create, edit, and allocate budget lines"),
    ("view:tax", "View Tax & Returns", "accounting", "View GST returns, TDS schedules, and tax ledgers"),
    ("manage:tax", "Manage Tax & Returns", "accounting", "Configure tax settings and prepare filings"),
    ("file:tax", "File Tax Returns", "accounting", "Generate and submit GST / VAT returns"),
    ("view:accounts_receivable", "View Accounts Receivable", "accounting", "View aged receivables and customer ledgers"),
    ("manage:accounts_receivable", "Manage Accounts Receivable", "accounting", "Manage AR aging, credit limits, and collections"),
    ("view:accounts_payable", "View Accounts Payable", "accounting", "View aged payables and vendor bills"),
    ("manage:accounts_payable", "Manage Accounts Payable", "accounting", "Manage AP schedules, payment batches, and vendor terms"),

    # ─── Sales & CRM ───
    ("view:crm", "View CRM", "crm", "Access CRM pipeline, contacts, and opportunities"),
    ("manage:crm", "Manage CRM", "crm", "Create, reassign, and manage customer leads and deals"),
    ("view:crm_leads", "View CRM Leads", "crm", "View sales leads and assigned activities"),
    ("manage:crm_leads", "Manage CRM Leads", "crm", "Create, edit, and assign sales leads"),
    ("view:crm_all_leads", "View All CRM Leads", "crm", "View leads across all branches and agents"),
    ("manage:crm_all_leads", "Manage All CRM Leads", "crm", "Full management and reassignment of all company leads"),
    ("convert:crm_leads", "Convert CRM Leads", "crm", "Convert qualified leads into customers and deals"),
    ("view:crm_customers", "View CRM Customers", "crm", "View customer directory and order history"),
    ("manage:crm_customers", "Manage CRM Customers", "crm", "Create, edit, and update customer profiles"),
    ("view:crm_quotations", "View Quotations & Proposals", "crm", "View customer sales quotes"),
    ("manage:crm_quotations", "Manage Quotations & Proposals", "crm", "Draft and send sales quotes and estimates"),
    ("approve:crm_quotations", "Approve Sales Quotations", "crm", "Approve high-value discount quotes"),
    ("view:crm_sales_orders", "View Sales Orders", "crm", "View customer sales orders"),
    ("manage:crm_sales_orders", "Manage Sales Orders", "crm", "Create, confirm, and process customer sales orders"),
    ("view:crm_support", "View Support Tickets", "crm", "View customer support tickets and SLA status"),
    ("manage:crm_support", "Manage Support Tickets", "crm", "Respond to, reassign, and resolve support cases"),
    ("view:crm_campaigns", "View Marketing Campaigns", "crm", "View marketing ad campaigns and poster templates"),
    ("manage:crm_campaigns", "Manage Marketing Campaigns", "crm", "Generate AI posters and launch marketing campaigns"),
    ("view:crm_discounts", "View CRM Discounts & Coupons", "crm", "View promotional discount schemes"),
    ("manage:crm_discounts", "Manage CRM Discounts & Coupons", "crm", "Create and manage customer discount vouchers"),
    ("view:crm_groups", "View Customer Groups", "crm", "View customer categories and tier classifications"),
    ("manage:crm_groups", "Manage Customer Groups", "crm", "Create and manage customer group definitions"),
    ("view:crm_loyalty", "View Loyalty Programs", "crm", "View customer loyalty points and reward schemes"),
    ("manage:crm_loyalty", "Manage Loyalty Programs", "crm", "Configure loyalty rules and point redemption"),
    ("view:crm_memberships", "View Customer Memberships", "crm", "View VIP customer subscription plans"),
    ("manage:crm_memberships", "Manage Customer Memberships", "crm", "Enroll and manage customer memberships"),
    ("view:crm_segments", "View Customer Segments", "crm", "View customer audience segments"),
    ("manage:crm_segments", "Manage Customer Segments", "crm", "Create dynamic rule-based audience segments"),
    ("view:crm_wallet", "View Customer Wallets", "crm", "View customer prepaid wallet balances"),
    ("manage:crm_wallet", "Manage Customer Wallets", "crm", "Credit, debit, and reconcile customer store wallets"),

    # ─── HRMS (Human Resources) ───
    ("view:hrms", "View HRMS", "hrms", "Access HRMS dashboard and human capital metrics"),
    ("manage:hrms", "Manage HRMS", "hrms", "Full administration of HRMS operations"),
    ("edit:hrms", "Edit HRMS Records", "hrms", "Update employee and HRMS operational records"),
    ("delete:hrms", "Delete HRMS Records", "hrms", "Remove employee and HRMS historical records"),
    ("view:hrms_employees", "View HRMS Employees", "hrms", "View employee master list and directory"),
    ("manage:hrms_employees", "Manage HRMS Employees", "hrms", "Create, edit, and archive employee master profiles"),
    ("view:hrms_departments", "View HRMS Departments", "hrms", "View HRMS departmental assignments"),
    ("manage:hrms_departments", "Manage HRMS Departments", "hrms", "Configure HRMS departments"),
    ("view:hrms_designations", "View HRMS Designations", "hrms", "View job titles and hierarchy"),
    ("manage:hrms_designations", "Manage HRMS Designations", "hrms", "Configure job titles and levels"),
    ("view:hrms_teams", "View HRMS Teams", "hrms", "View internal project and functional teams"),
    ("manage:hrms_teams", "Manage HRMS Teams", "hrms", "Create and manage employee teams"),
    ("view:hrms_documents", "View HRMS Documents", "hrms", "View employee IDs, contracts, and certificates"),
    ("manage:hrms_documents", "Manage HRMS Documents", "hrms", "Upload, verify, and manage employee documents"),
    ("view:hrms_profiles", "View HRMS Profiles", "hrms", "Access full employee personal and job profile dossiers"),
    ("view:hrms_attendance", "View Attendance Records", "hrms", "View employee clock-ins, punches, and timesheets"),
    ("manage:hrms_attendance", "Manage Attendance Records", "hrms", "Manually adjust clock-ins and mark attendance"),
    ("view:hrms_biometric", "View Biometric Integrations", "hrms", "View biometric device sync logs"),
    ("view:hrms_face", "View Face Recognition Logins", "hrms", "View facial recognition verification logs"),
    ("view:hrms_gps", "View GPS Trackings", "hrms", "View mobile field staff GPS check-in locations"),
    ("view:hrms_shifts", "View Shifts Configuration", "hrms", "View shift rosters, calendars, and schedules"),
    ("view:hrms_corrections", "View Attendance Corrections", "hrms", "View employee clock correction requests"),
    ("manage:hrms_corrections", "Manage Attendance Corrections", "hrms", "Approve or reject attendance regularizations"),
    ("view:hrms_leaves", "View Leave Management", "hrms", "View employee leave applications and status"),
    ("manage:hrms_leaves", "Manage Leave Requests", "hrms", "Apply and record leaves on behalf of staff"),
    ("view:hrms_leave_calendar", "View Leave Calendar", "hrms", "View holiday calendars and team availability"),
    ("view:hrms_leave_balance", "View Leave Balances", "hrms", "View employee earned and casual leave balances"),
    ("view:hrms_leave_policies", "View Leave Policies", "hrms", "View leave accrual policies and rules"),
    ("manage:hrms_leave_policies", "Manage Leave Policies", "hrms", "Configure leave types, quotas, and rollover rules"),
    ("view:hrms_leave_approvals", "View Leave Approvals", "hrms", "View pending leave approval requests"),
    ("manage:hrms_leave_approvals", "Manage Leave Approvals", "hrms", "Approve or reject leave applications"),
    ("view:payroll", "View Payroll", "payroll", "Access payroll dashboard and wage summaries"),
    ("view:hrms_salary_structure", "View Salary Structures", "hrms", "View CTC breakdowns, basic, HRA, and allowances"),
    ("manage:hrms_salary_structure", "Manage Salary Structures", "hrms", "Configure salary components and deduction formulas"),
    ("view:hrms_pay_grades", "View Pay Grades", "hrms", "View salary bands and grade structures"),
    ("manage:hrms_pay_grades", "Manage Pay Grades", "hrms", "Configure compensation bands and pay grades"),
    ("view:hrms_payroll_processing", "Process Monthly Payroll", "hrms", "Calculate, execute, and sign off monthly salary batches"),
    ("view:hrms_pf_esi", "View PF & ESI Settings", "hrms", "View statutory Provident Fund and ESI contributions"),
    ("view:hrms_tds", "View TDS Configurations", "hrms", "View employee income tax withholding and 16A summaries"),
    ("view:hrms_payslips", "View & Send Payslips", "hrms", "Generate and email monthly payslips to employees"),
    ("view:hrms_loans_advances", "View Loans & Advances", "hrms", "View employee salary advances and active loans"),
    ("manage:hrms_loans_advances", "Manage Loans & Advances", "hrms", "Disburse loans, salary advances, and configure EMI deductions"),
    ("view:hrms_bonuses_commissions", "Manage Bonuses & Commissions", "hrms", "Award performance bonuses and sales commissions"),
    ("view:hrms_recruitment", "View Recruitment", "hrms", "View open job requisitions, candidates, and pipelines"),
    ("manage:hrms_recruitment", "Manage Recruitment", "hrms", "Post job openings, schedule interviews, and evaluate applicants"),
    ("view:hrms_onboarding", "Manage Onboarding", "hrms", "Generate offer letters and manage new hire checklists"),
    ("view:hrms_performance", "View Performance Ratings", "hrms", "View employee OKRs, KPIs, and review ratings"),
    ("manage:hrms_performance", "Manage Appraisals", "hrms", "Conduct appraisal cycles and finalize performance scores"),
    ("view:hrms_learning", "View Learning & Training", "hrms", "View training catalogs and employee certificates"),
    ("manage:hrms_learning", "Manage Learning Programs", "hrms", "Create courses, upload materials, and assign certifications"),
    ("view:hrms_exit", "View Exit Management", "hrms", "View resignations, clearances, and handover tasks"),
    ("manage:hrms_exit", "Manage Exit Management", "hrms", "Approve resignations, compute final settlements, and issue experience letters"),
    ("view:hrms_intelligence", "Access HR Intelligence AI", "hrms", "Access AI attrition forecasts and workforce productivity analytics"),

    # ─── ESS (Employee Self-Service) ───
    ("view:ess", "View Employee Portal (ESS)", "hrms", "Access employee self-service portal"),
    ("manage:ess", "Manage Employee Portal (ESS)", "hrms", "Configure employee self-service permissions"),
    ("view:ess_dashboard", "View ESS Dashboard", "hrms", "View own employee self-service home"),
    ("view:ess_attendance", "View Own Attendance", "hrms", "Clock in/out and view own monthly punch card"),
    ("view:ess_leaves", "View Own Leaves", "hrms", "Apply for leaves and check personal leave balances"),
    ("view:ess_payroll", "View Own Payslips", "hrms", "View and download personal monthly payslips"),
    ("view:ess_documents", "View Own Documents", "hrms", "Upload KYC and download personal letters"),
    ("view:ess_tasks_announcements", "View Notices & Tasks", "hrms", "Access company announcements and assigned tasks"),

    # ─── Marketplace ───
    ("view:marketplace", "View Marketplace", "marketplace", "Access omnichannel marketplace integrations"),
    ("manage:marketplace", "Manage Marketplace", "marketplace", "Configure marketplace stores and multi-vendor rules"),
    ("view:marketplace_vendors", "View Marketplace Vendors", "marketplace", "View connected third-party vendor accounts"),
    ("manage:marketplace_vendors", "Manage Marketplace Vendors", "marketplace", "Onboard and configure third-party vendors"),
    ("view:marketplace_catalog", "View Marketplace Catalog", "marketplace", "View synced marketplace product listings"),
    ("manage:marketplace_catalog", "Manage Marketplace Catalog", "marketplace", "Map categories and publish listings to channels"),
    ("view:marketplace_orders", "View Marketplace Orders", "marketplace", "View orders originating from marketplace channels"),
    ("manage:marketplace_orders", "Manage Marketplace Orders", "marketplace", "Acknowledge, pack, and fulfill marketplace orders"),

    # ─── IoT (Internet of Things) ───
    ("view:iot", "View IoT Module", "iot", "Access IoT dashboard and gateway status"),
    ("manage:iot", "Manage IoT Settings", "iot", "Configure IoT system settings and gateway hardware"),
    ("view:iot_devices", "View IoT Devices", "iot", "View connected sensors, RFID gates, and POS scales"),
    ("manage:iot_devices", "Manage IoT Devices", "iot", "Pair, calibrate, and diagnose IoT hardware devices"),
    ("view:iot_telemetry", "View IoT Telemetry Logs", "iot", "Access real-time sensor streams and telemetry graphs"),
    ("manage:iot_telemetry", "Manage IoT Alerts & Triggers", "iot", "Set telemetry threshold alarms and automated actions"),

    # ─── Analytics & Reports ───
    ("view:analytics", "View Analytics & BI", "analytics", "Access executive business analytics and KPI dashboards"),
    ("manage:analytics", "Manage Analytics Dashboards", "analytics", "Customize KPI widgets and executive scorecards"),
    ("view:reports", "View Reports", "reports", "View standard financial, inventory, and sales reports"),
    ("manage:reports", "Manage & Create Reports", "reports", "Build custom reports, configure scheduled export jobs"),
    ("view:ai_insights", "View AI Predictive Insights", "analytics", "Access AI demand forecasts and business anomaly alerts"),
    ("manage:ai_insights", "Manage AI Models & Forecasts", "analytics", "Tune AI forecasting models and replenishment parameters"),
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
