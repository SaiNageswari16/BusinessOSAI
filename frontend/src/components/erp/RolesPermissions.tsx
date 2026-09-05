import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, ShieldCheck, Users, Edit2, Trash2, Save, X,
  Check, Lock, Unlock, ChevronRight, AlertTriangle,
} from "lucide-react";
import { useAuth, canAssignSuperAdmin } from "@/contexts/auth-context";
import { useRbac } from "@/contexts/rbac-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

// ─── Types ────────────────────────────────────────────────────────

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

interface Role {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  status: string;
  permissions: Permission[];
}

interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  status: string;
  avatar_initials: string | null;
  roles: { id: string; name: string; is_default: boolean }[];
}

interface RoleFormPayload {
  name: string;
  description: string | null;
  permission_codes: string[];
}

// ─── Permission groups for display ────────────────────────────────

const PERMISSION_LABELS: Record<string, string> = {
  "view:dashboard": "View Dashboard",
  "view:copilot": "View AI Copilot",
  "view:workspaces": "View Workspaces",
  "manage:workspaces": "Manage Workspaces",
  "view:subscription": "View Subscription & License",
  "manage:subscription": "Manage Subscription & License",
  "view:api_keys": "View API Keys",
  "manage:api_keys": "Manage API Keys",
  "view:mfa_policies": "View MFA Policies",
  "manage:mfa_policies": "Manage MFA Policies",
  "view:users": "View Users",
  "manage:users": "Manage Users",
  "view:roles": "View Roles",
  "manage:roles": "Manage Roles",
  "view:permission_matrix": "View Permission Matrix",
  "view:access_control": "View Access Control",
  "manage:access_control": "Manage Access Control",
  "view:system_config": "View System Configuration",
  "manage:system_config": "Manage System Configuration",
  "manage:system_admin": "Manage System Admin",
  "view:settings": "View Settings",
  "manage:settings": "Manage Settings",
  "view:backup": "View Backup & Restore",
  "manage:backup": "Manage Backup & Restore",
  "view:system_health": "View System Health",
  "view:activity_logs": "View Activity Logs",
  "view:error_logs": "View Error Logs",
  "view:audit": "View Audit Logs",
  "manage:audit": "Manage Audit Logs",
  "view:audit_logs": "View System Audit Logs",
  "view:webhooks": "View Webhooks",
  "manage:webhooks": "Manage Webhooks",
  "view:companies": "View Companies",
  "manage:companies": "Manage Companies",
  "view:company": "View Company Profile",
  "manage:company": "Manage Company Profile",
  "view:branches": "View Branches",
  "manage:branches": "Manage Branches",
  "view:departments": "View Departments",
  "manage:departments": "Manage Departments",
  "view:designations": "View Designations",
  "manage:designations": "Manage Designations",
  "view:teams": "View Teams",
  "manage:teams": "Manage Teams",
  "view:erp": "View Core ERP",
  "manage:erp": "Manage Core ERP",
  "edit:erp": "Edit Core ERP",
  "view:financials": "View Financials Setup",
  "manage:financials": "Manage Financials Setup",
  "view:currencies": "View Currencies",
  "manage:currencies": "Manage Currencies",
  "view:fiscal_years": "View Fiscal Years",
  "manage:fiscal_years": "Manage Fiscal Years",
  "view:taxes": "View Tax Configurations",
  "manage:taxes": "Manage Tax Configurations",
  "view:payment_terms": "View Payment Terms",
  "manage:payment_terms": "Manage Payment Terms",
  "view:cost_centers": "View Cost Centers",
  "manage:cost_centers": "Manage Cost Centers",
  "view:number_series": "View Number Series",
  "manage:number_series": "Manage Number Series",
  "view:workflows": "View Workflows",
  "manage:workflows": "Manage Workflows",
  "view:geography": "View Geography",
  "manage:geography": "Manage Geography",
  "view:locations": "View Locations",
  "manage:locations": "Manage Locations",
  "view:tags": "View Tags & Labels",
  "manage:tags": "Manage Tags & Labels",
  "view:document_templates": "View Document Templates",
  "manage:document_templates": "Manage Document Templates",
  "view:notification_templates": "View Notification Templates",
  "manage:notification_templates": "Manage Notification Templates",
  "view:inventory": "View Inventory",
  "manage:inventory": "Manage Inventory",
  "create:inventory": "Create Inventory Items",
  "view:product_categories": "View Product Categories",
  "manage:product_categories": "Manage Product Categories",
  "view:brands": "View Brands",
  "manage:brands": "Manage Brands",
  "view:stock_adjustments": "View Stock Adjustments",
  "manage:stock_adjustments": "Manage Stock Adjustments",
  "view:stock_transfers": "View Stock Transfers",
  "manage:stock_transfers": "Manage Stock Transfers",
  "view:barcodes": "View Barcode Management",
  "manage:barcodes": "Manage Barcodes",
  "view:warehouse": "View Warehouse",
  "manage:warehouse": "Manage Warehouse",
  "view:procurement": "View Procurement",
  "manage:procurement": "Manage Procurement",
  "view:purchase_orders": "View Purchase Orders",
  "manage:purchase_orders": "Manage Purchase Orders",
  "approve:purchase_orders": "Approve Purchase Orders",
  "view:grn": "View Goods Received Notes (GRN)",
  "manage:grn": "Manage Goods Received Notes (GRN)",
  "view:suppliers": "View Suppliers / Vendors",
  "manage:suppliers": "Manage Suppliers / Vendors",
  "view:rfq": "View RFQ & Vendor Quotes",
  "manage:rfq": "Manage RFQ & Vendor Quotes",
  "view:dispatch": "View Dispatch & Logistics",
  "manage:dispatch": "Manage Dispatch & Logistics",
  "view:pos": "View POS",
  "manage:pos": "Manage POS",
  "manage:pos_terminal": "Operate POS Terminal",
  "discount:pos_billing": "Apply POS Discounts",
  "void:pos_receipt": "Void POS Transactions",
  "view:pos_register": "View Cash Register Shifts",
  "manage:pos_register": "Manage Cash Register Shifts",
  "view:pos_history": "View POS History",
  "refund:pos_history": "Process POS Refunds",
  "view:accounting": "View Accounting",
  "manage:accounting": "Manage Accounting",
  "view:chart_of_accounts": "View Chart of Accounts",
  "manage:chart_of_accounts": "Manage Chart of Accounts",
  "view:journal_entries": "View Journal Entries",
  "manage:journal_entries": "Manage Journal Entries",
  "post:journal_entries": "Post Journal Entries",
  "view:journal": "View Journal",
  "view:account_balances": "View Account Balances",
  "view:invoices": "View Invoices",
  "manage:invoices": "Manage Invoices",
  "create:invoices": "Create Invoices",
  "approve:invoices": "Approve Invoices",
  "manage:invoice_payments": "Manage Invoice Payments",
  "view:bank_accounts": "View Bank Accounts",
  "manage:bank_accounts": "Manage Bank Accounts",
  "view:bank_transactions": "View Bank Transactions",
  "manage:bank_transactions": "Manage Bank Transactions",
  "view:bank_reconciliations": "View Bank Reconciliations",
  "manage:bank_reconciliations": "Manage Bank Reconciliations",
  "view:bank": "View Bank Module",
  "view:fixed_assets": "View Fixed Assets",
  "manage:fixed_assets": "Manage Fixed Assets",
  "view:payment_vouchers": "View Payment Vouchers",
  "manage:payment_vouchers": "Manage Payment Vouchers",
  "approve:payment_vouchers": "Approve Payment Vouchers",
  "view:expense_claims": "View Expense Claims",
  "manage:expense_claims": "Manage Expense Claims",
  "approve:expense_claims": "Approve Expense Claims",
  "view:budgets": "View Budgets",
  "manage:budgets": "Manage Budgets",
  "view:tax": "View Tax & Returns",
  "manage:tax": "Manage Tax & Returns",
  "file:tax": "File Tax Returns",
  "view:accounts_receivable": "View Accounts Receivable",
  "manage:accounts_receivable": "Manage Accounts Receivable",
  "view:accounts_payable": "View Accounts Payable",
  "manage:accounts_payable": "Manage Accounts Payable",
  "view:crm": "View CRM",
  "manage:crm": "Manage CRM",
  "view:crm_leads": "View CRM Leads",
  "manage:crm_leads": "Manage CRM Leads",
  "view:crm_all_leads": "View All CRM Leads",
  "manage:crm_all_leads": "Manage All CRM Leads",
  "convert:crm_leads": "Convert CRM Leads",
  "view:crm_customers": "View CRM Customers",
  "manage:crm_customers": "Manage CRM Customers",
  "view:crm_quotations": "View Quotations & Proposals",
  "manage:crm_quotations": "Manage Quotations & Proposals",
  "approve:crm_quotations": "Approve Sales Quotations",
  "view:crm_sales_orders": "View Sales Orders",
  "manage:crm_sales_orders": "Manage Sales Orders",
  "view:crm_support": "View Support Tickets",
  "manage:crm_support": "Manage Support Tickets",
  "view:crm_campaigns": "View Marketing Campaigns",
  "manage:crm_campaigns": "Manage Marketing Campaigns",
  "view:crm_discounts": "View CRM Discounts & Coupons",
  "manage:crm_discounts": "Manage CRM Discounts & Coupons",
  "view:crm_groups": "View Customer Groups",
  "manage:crm_groups": "Manage Customer Groups",
  "view:crm_loyalty": "View Loyalty Programs",
  "manage:crm_loyalty": "Manage Loyalty Programs",
  "view:crm_memberships": "View Customer Memberships",
  "manage:crm_memberships": "Manage Customer Memberships",
  "view:crm_segments": "View Customer Segments",
  "manage:crm_segments": "Manage Customer Segments",
  "view:crm_wallet": "View Customer Wallets",
  "manage:crm_wallet": "Manage Customer Wallets",
  "view:hrms": "View HRMS",
  "manage:hrms": "Manage HRMS",
  "edit:hrms": "Edit HRMS Records",
  "delete:hrms": "Delete HRMS Records",
  "view:hrms_employees": "View HRMS Employees",
  "manage:hrms_employees": "Manage HRMS Employees",
  "view:hrms_departments": "View HRMS Departments",
  "manage:hrms_departments": "Manage HRMS Departments",
  "view:hrms_designations": "View HRMS Designations",
  "manage:hrms_designations": "Manage HRMS Designations",
  "view:hrms_teams": "View HRMS Teams",
  "manage:hrms_teams": "Manage HRMS Teams",
  "view:hrms_documents": "View HRMS Documents",
  "manage:hrms_documents": "Manage HRMS Documents",
  "view:hrms_profiles": "View HRMS Profiles",
  "view:hrms_attendance": "View Attendance Records",
  "manage:hrms_attendance": "Manage Attendance Records",
  "view:hrms_biometric": "View Biometric Integrations",
  "view:hrms_face": "View Face Recognition Logins",
  "view:hrms_gps": "View GPS Trackings",
  "view:hrms_shifts": "View Shifts Configuration",
  "view:hrms_corrections": "View Attendance Corrections",
  "manage:hrms_corrections": "Manage Attendance Corrections",
  "view:hrms_leaves": "View Leave Management",
  "manage:hrms_leaves": "Manage Leave Requests",
  "view:hrms_leave_calendar": "View Leave Calendar",
  "view:hrms_leave_balance": "View Leave Balances",
  "view:hrms_leave_policies": "View Leave Policies",
  "manage:hrms_leave_policies": "Manage Leave Policies",
  "view:hrms_leave_approvals": "View Leave Approvals",
  "manage:hrms_leave_approvals": "Manage Leave Approvals",
  "view:payroll": "View Payroll",
  "view:hrms_salary_structure": "View Salary Structures",
  "manage:hrms_salary_structure": "Manage Salary Structures",
  "view:hrms_pay_grades": "View Pay Grades",
  "manage:hrms_pay_grades": "Manage Pay Grades",
  "view:hrms_payroll_processing": "Process Monthly Payroll",
  "view:hrms_pf_esi": "View PF & ESI Settings",
  "view:hrms_tds": "View TDS Configurations",
  "view:hrms_payslips": "View & Send Payslips",
  "view:hrms_loans_advances": "View Loans & Advances",
  "manage:hrms_loans_advances": "Manage Loans & Advances",
  "view:hrms_bonuses_commissions": "Manage Bonuses & Commissions",
  "view:hrms_recruitment": "View Recruitment",
  "manage:hrms_recruitment": "Manage Recruitment",
  "view:hrms_onboarding": "Manage Onboarding",
  "view:hrms_performance": "View Performance Ratings",
  "manage:hrms_performance": "Manage Appraisals",
  "view:hrms_learning": "View Learning & Training",
  "manage:hrms_learning": "Manage Learning Programs",
  "view:hrms_exit": "View Exit Management",
  "manage:hrms_exit": "Manage Exit Management",
  "view:hrms_intelligence": "Access HR Intelligence AI",
  "view:ess": "View Employee Portal (ESS)",
  "manage:ess": "Manage Employee Portal (ESS)",
  "view:ess_dashboard": "View ESS Dashboard",
  "view:ess_attendance": "View Own Attendance",
  "view:ess_leaves": "View Own Leaves",
  "view:ess_payroll": "View Own Payslips",
  "view:ess_documents": "View Own Documents",
  "view:ess_tasks_announcements": "View Notices & Tasks",
  "view:marketplace": "View Marketplace",
  "manage:marketplace": "Manage Marketplace",
  "view:marketplace_vendors": "View Marketplace Vendors",
  "manage:marketplace_vendors": "Manage Marketplace Vendors",
  "view:marketplace_catalog": "View Marketplace Catalog",
  "manage:marketplace_catalog": "Manage Marketplace Catalog",
  "view:marketplace_orders": "View Marketplace Orders",
  "manage:marketplace_orders": "Manage Marketplace Orders",
  "view:iot": "View IoT Module",
  "manage:iot": "Manage IoT Settings",
  "view:iot_devices": "View IoT Devices",
  "manage:iot_devices": "Manage IoT Devices",
  "view:iot_telemetry": "View IoT Telemetry Logs",
  "manage:iot_telemetry": "Manage IoT Alerts & Triggers",
  "view:analytics": "View Analytics & BI",
  "manage:analytics": "Manage Analytics Dashboards",
  "view:reports": "View Reports",
  "manage:reports": "Manage & Create Reports",
  "view:ai_insights": "View AI Predictive Insights",
  "manage:ai_insights": "Manage AI Models & Forecasts",
};

const PERMISSION_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Workspace & Copilot",
    keys: [
      "view:dashboard", "view:copilot",
      "view:workspaces", "manage:workspaces",
      "view:subscription", "manage:subscription",
      "view:api_keys", "manage:api_keys",
      "view:mfa_policies", "manage:mfa_policies",
    ],
  },
  {
    label: "Access Control & Security",
    keys: [
      "view:users", "manage:users",
      "view:roles", "manage:roles",
      "view:permission_matrix", "view:access_control",
      "manage:access_control",
    ],
  },
  {
    label: "System Admin, Logs & Audit",
    keys: [
      "view:system_config", "manage:system_config",
      "manage:system_admin", "view:settings",
      "manage:settings", "view:backup",
      "manage:backup", "view:system_health",
      "view:activity_logs", "view:error_logs",
      "view:audit", "manage:audit",
      "view:audit_logs", "view:webhooks",
      "manage:webhooks",
    ],
  },
  {
    label: "Organization Structure",
    keys: [
      "view:companies", "manage:companies",
      "view:company", "manage:company",
      "view:branches", "manage:branches",
      "view:departments", "manage:departments",
      "view:designations", "manage:designations",
      "view:teams", "manage:teams",
    ],
  },
  {
    label: "Core ERP Setup & Master Data",
    keys: [
      "view:erp", "manage:erp",
      "edit:erp", "view:financials",
      "manage:financials", "view:currencies",
      "manage:currencies", "view:fiscal_years",
      "manage:fiscal_years", "view:taxes",
      "manage:taxes", "view:payment_terms",
      "manage:payment_terms", "view:cost_centers",
      "manage:cost_centers", "view:number_series",
      "manage:number_series", "view:workflows",
      "manage:workflows", "view:geography",
      "manage:geography", "view:locations",
      "manage:locations", "view:tags",
      "manage:tags", "view:document_templates",
      "manage:document_templates", "view:notification_templates",
      "manage:notification_templates",
    ],
  },
  {
    label: "Inventory & Warehouse",
    keys: [
      "view:inventory", "manage:inventory",
      "create:inventory", "view:product_categories",
      "manage:product_categories", "view:brands",
      "manage:brands", "view:stock_adjustments",
      "manage:stock_adjustments", "view:stock_transfers",
      "manage:stock_transfers", "view:barcodes",
      "manage:barcodes", "view:warehouse",
      "manage:warehouse",
    ],
  },
  {
    label: "Procurement & Operations",
    keys: [
      "view:procurement", "manage:procurement",
      "view:purchase_orders", "manage:purchase_orders",
      "approve:purchase_orders", "view:grn",
      "manage:grn", "view:suppliers",
      "manage:suppliers", "view:rfq",
      "manage:rfq", "view:dispatch",
      "manage:dispatch",
    ],
  },
  {
    label: "POS (Point of Sale)",
    keys: [
      "view:pos", "manage:pos",
      "manage:pos_terminal", "discount:pos_billing",
      "void:pos_receipt", "view:pos_register",
      "manage:pos_register", "view:pos_history",
      "refund:pos_history",
    ],
  },
  {
    label: "Accounting - General Ledger & Invoicing",
    keys: [
      "view:accounting", "manage:accounting",
      "view:chart_of_accounts", "manage:chart_of_accounts",
      "view:journal_entries", "manage:journal_entries",
      "post:journal_entries", "view:journal",
      "view:account_balances", "view:invoices",
      "manage:invoices", "create:invoices",
      "approve:invoices", "manage:invoice_payments",
      "view:accounts_receivable", "manage:accounts_receivable",
      "view:accounts_payable", "manage:accounts_payable",
    ],
  },
  {
    label: "Accounting - Banking, Assets & Expenses",
    keys: [
      "view:bank_accounts", "manage:bank_accounts",
      "view:bank_transactions", "manage:bank_transactions",
      "view:bank_reconciliations", "manage:bank_reconciliations",
      "view:bank", "view:fixed_assets",
      "manage:fixed_assets", "view:payment_vouchers",
      "manage:payment_vouchers", "approve:payment_vouchers",
      "view:expense_claims", "manage:expense_claims",
      "approve:expense_claims", "view:budgets",
      "manage:budgets", "view:tax",
      "manage:tax", "file:tax",
    ],
  },
  {
    label: "Sales & CRM - Core & Leads",
    keys: [
      "view:crm", "manage:crm",
      "view:crm_leads", "manage:crm_leads",
      "view:crm_all_leads", "manage:crm_all_leads",
      "convert:crm_leads", "view:crm_customers",
      "manage:crm_customers", "view:crm_quotations",
      "manage:crm_quotations", "approve:crm_quotations",
      "view:crm_sales_orders", "manage:crm_sales_orders",
      "view:crm_support", "manage:crm_support",
      "view:crm_campaigns", "manage:crm_campaigns",
    ],
  },
  {
    label: "Sales & CRM - Loyalty, Wallet & Segmentation",
    keys: [
      "view:crm_discounts", "manage:crm_discounts",
      "view:crm_groups", "manage:crm_groups",
      "view:crm_loyalty", "manage:crm_loyalty",
      "view:crm_memberships", "manage:crm_memberships",
      "view:crm_segments", "manage:crm_segments",
      "view:crm_wallet", "manage:crm_wallet",
    ],
  },
  {
    label: "HRMS - Employees & Structure",
    keys: [
      "view:hrms", "manage:hrms",
      "edit:hrms", "delete:hrms",
      "view:hrms_employees", "manage:hrms_employees",
      "view:hrms_departments", "manage:hrms_departments",
      "view:hrms_designations", "manage:hrms_designations",
      "view:hrms_teams", "manage:hrms_teams",
      "view:hrms_documents", "manage:hrms_documents",
      "view:hrms_profiles",
    ],
  },
  {
    label: "HRMS - Attendance & Shifts",
    keys: [
      "view:hrms_attendance", "manage:hrms_attendance",
      "view:hrms_biometric", "view:hrms_face",
      "view:hrms_gps", "view:hrms_shifts",
      "view:hrms_corrections", "manage:hrms_corrections",
    ],
  },
  {
    label: "HRMS - Leaves & Time Off",
    keys: [
      "view:hrms_leaves", "manage:hrms_leaves",
      "view:hrms_leave_calendar", "view:hrms_leave_balance",
      "view:hrms_leave_policies", "manage:hrms_leave_policies",
      "view:hrms_leave_approvals", "manage:hrms_leave_approvals",
    ],
  },
  {
    label: "HRMS - Payroll & Compensation",
    keys: [
      "view:payroll", "view:hrms_salary_structure",
      "manage:hrms_salary_structure", "view:hrms_pay_grades",
      "manage:hrms_pay_grades", "view:hrms_payroll_processing",
      "view:hrms_pf_esi", "view:hrms_tds",
      "view:hrms_payslips", "view:hrms_loans_advances",
      "manage:hrms_loans_advances", "view:hrms_bonuses_commissions",
    ],
  },
  {
    label: "HRMS - Talent, Performance & Exit",
    keys: [
      "view:hrms_recruitment", "manage:hrms_recruitment",
      "view:hrms_onboarding", "view:hrms_performance",
      "manage:hrms_performance", "view:hrms_learning",
      "manage:hrms_learning", "view:hrms_exit",
      "manage:hrms_exit", "view:hrms_intelligence",
    ],
  },
  {
    label: "HRMS - Employee Self-Service (ESS)",
    keys: [
      "view:ess", "manage:ess",
      "view:ess_dashboard", "view:ess_attendance",
      "view:ess_leaves", "view:ess_payroll",
      "view:ess_documents", "view:ess_tasks_announcements",
    ],
  },
  {
    label: "Marketplace & Omnichannel",
    keys: [
      "view:marketplace", "manage:marketplace",
      "view:marketplace_vendors", "manage:marketplace_vendors",
      "view:marketplace_catalog", "manage:marketplace_catalog",
      "view:marketplace_orders", "manage:marketplace_orders",
    ],
  },
  {
    label: "IoT (Internet of Things)",
    keys: [
      "view:iot", "manage:iot",
      "view:iot_devices", "manage:iot_devices",
      "view:iot_telemetry", "manage:iot_telemetry",
    ],
  },
  {
    label: "Analytics & Intelligence",
    keys: [
      "view:analytics", "manage:analytics",
      "view:reports", "manage:reports",
      "view:ai_insights", "manage:ai_insights",
    ],
  },
];

// ─── Role Form Modal ──────────────────────────────────────────────

interface RoleFormModalProps {
  role?: Role;
  availablePermissions: Permission[];
  canManageSuperAdmin: boolean;
  onClose: () => void;
  onSave: (payload: RoleFormPayload) => Promise<void>;
}

function RoleFormModal({ role, availablePermissions, canManageSuperAdmin, onClose, onSave }: RoleFormModalProps) {
  const isSystem = Boolean(role?.is_system);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  // selectedPerms stores permission CODES
  const [selectedPerms, setSelectedPerms] = useState<string[]>(
    role?.permissions.map((p) => p.code) ?? []
  );
  const [saving, setSaving] = useState(false);

  // All permission codes available from the API
  const allCodes = availablePermissions.map((p) => p.code);

  useEffect(() => {
    if (role) {
      setSelectedPerms(role.permissions.map((p) => p.code));
    }
  }, [role]);

  const toggle = (code: string) =>
    setSelectedPerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );

  const toggleGroup = (keys: string[]) => {
    const allSelected = keys.every((k) => selectedPerms.includes(k));
    if (allSelected) {
      setSelectedPerms((prev) => prev.filter((p) => !keys.includes(p)));
    } else {
      setSelectedPerms((prev) => [...new Set([...prev, ...keys])]);
    }
  };

  const canSubmit = name.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        permission_codes: selectedPerms,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Determine which groups to show — only show groups whose permissions exist in the API list
  const visibleGroups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    keys: group.keys.filter((k) => allCodes.includes(k) || PERMISSION_LABELS[k]),
  })).filter((g) => g.keys.length > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
      >
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold">{role ? "Edit Role" : "Create New Role"}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define permissions granted to this role across all portals
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* System role warning */}
          {isSystem && (
            <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-800 text-sm">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>This is a system role. Its name and permissions cannot be changed.</span>
            </div>
          )}

          {/* Name & Description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Role Name</label>
              <input
                className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Branch Supervisor"
                disabled={isSystem}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <input
                className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
              />
            </div>
          </div>

          {/* Permissions */}
          {!isSystem && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" /> Module Permissions
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPerms([...allCodes])}
                    className="text-xs text-primary hover:underline"
                  >
                    Grant All
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPerms([])}
                    className="text-xs text-destructive hover:underline"
                  >
                    Revoke All
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {visibleGroups.map((group) => {
                  const allSelected = group.keys.every((k) => selectedPerms.includes(k));
                  const someSelected = group.keys.some((k) => selectedPerms.includes(k));
                  return (
                    <div key={group.label} className="border rounded-xl overflow-hidden">
                      <div
                        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition"
                        onClick={() => toggleGroup(group.keys)}
                      >
                        <span className="text-sm font-semibold">{group.label}</span>
                        <div
                          className={cn(
                            "size-5 rounded border-2 flex items-center justify-center transition",
                            allSelected
                              ? "bg-primary border-primary"
                              : someSelected
                              ? "border-primary"
                              : "border-border"
                          )}
                        >
                          {allSelected && <Check className="size-3 text-white" />}
                          {someSelected && !allSelected && <div className="size-2 rounded-sm bg-primary" />}
                        </div>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        {group.keys.map((code) => (
                          <label
                            key={code}
                            className="flex items-center gap-2 cursor-pointer select-none"
                            onClick={() => toggle(code)}
                          >
                            <div
                              className={cn(
                                "size-4 rounded border-2 flex items-center justify-center transition shrink-0",
                                selectedPerms.includes(code)
                                  ? "bg-primary border-primary"
                                  : "border-border hover:border-primary"
                              )}
                            >
                              {selectedPerms.includes(code) && <Check className="size-2.5 text-white" />}
                            </div>
                            <span className="text-sm flex-1">{PERMISSION_LABELS[code] ?? code}</span>
                            {selectedPerms.includes(code) ? (
                              <Unlock className="size-3 text-emerald-500 ml-auto shrink-0" />
                            ) : (
                              <Lock className="size-3 text-muted-foreground ml-auto shrink-0" />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm text-primary">
                <strong>{selectedPerms.length}</strong> of{" "}
                <strong>{allCodes.length}</strong> permissions granted to this role.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border hover:bg-muted text-sm"
          >
            Cancel
          </button>
          {!isSystem && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSubmit}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2",
                canSubmit
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Save className="size-4" />
              {saving ? "Saving…" : role ? "Save Role" : "Create Role"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function RolesPermissions() {
    const { currency, formatCurrency } = useCurrency();
  const { accessToken, user: currentUser } = useAuth();
  const { hasPermission } = useRbac();
  const canManageSuperAdmin = canAssignSuperAdmin(currentUser);
  const canManageRoles = hasPermission("manage:roles");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState<Role | undefined>(undefined);
  const [roles, setRoles] = useState<Role[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = accessToken
    ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    : undefined;

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const usersForRole = (roleId: string) =>
    users.filter((u) => u.roles.some((r) => r.id === roleId));

  const loadData = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const [rolesRes, permissionsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/erp/roles?page=1&page_size=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${API_BASE_URL}/erp/permissions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${API_BASE_URL}/erp/users?page=1&page_size=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),

      ]);

      if (!rolesRes.ok) throw new Error("Failed to load roles");
      if (!permissionsRes.ok) throw new Error("Failed to load permissions");
      if (!usersRes.ok) throw new Error("Failed to load users");

      const rolesJson = await rolesRes.json();
      const permissionsJson = await permissionsRes.json();
      const usersJson = await usersRes.json();

      const loadedRoles: Role[] = rolesJson.items;
      setRoles(loadedRoles);
      setAvailablePermissions(permissionsJson);
      setUsers(usersJson.items);

      // Keep selected role in sync after reload
      setSelectedRole((prev) => {
        if (prev) {
          return loadedRoles.find((r) => r.id === prev.id) ?? loadedRoles[0] ?? null;
        }
        return loadedRoles[0] ?? null;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load role management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const saveRole = async (payload: RoleFormPayload) => {
    if (!accessToken) return;
    setSaving(true);
    try {
      const url = editRole
        ? `${API_BASE_URL}/erp/roles/${editRole.id}`
        : `${API_BASE_URL}/erp/roles`;
      const response = await fetch(url, {
        method: editRole ? "PATCH" : "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let message = "Failed to save role";
        try {
          const json = await response.json();
          message = typeof json.detail === "string" ? json.detail : message;
        } catch {
          message = await response.text() || message;
        }
        throw new Error(message);
      }
      await loadData();
      toast.success(editRole ? "Role updated" : "Role created");
      setShowModal(false);
      setEditRole(undefined);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unable to save role");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: Role) => {
    if (!accessToken) return;
    if (role.is_system) {
      toast.error("System roles cannot be deleted");
      return;
    }
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/erp/roles/${role.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.detail ?? "Failed to delete role");
      }
      toast.success("Role deleted");
      if (selectedRole?.id === role.id) setSelectedRole(null);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unable to delete role");
    }
  };

  // Permissions for the detail view — mapped from codes on the role
  const rolePermissionCodes = selectedRole?.permissions.map((p) => p.code) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold">Roles &amp; Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure role-based access control. Each role controls which portals and modules a user can access.
          </p>
        </div>
        {canManageRoles && (
          <button
            onClick={() => {
              setEditRole(undefined);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
          >
            <Plus className="size-4" /> New Role
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading roles…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Roles List ─── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 h-10 px-3 rounded-xl border bg-background">
              <Search className="size-4 text-muted-foreground" />
              <input
                className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {filteredRoles.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No roles found.</div>
              ) : (
                filteredRoles.map((role, i) => {
                  const assignedCount = usersForRole(role.id).length;
                  const isSelected = selectedRole?.id === role.id;
                  return (
                    <motion.div
                      key={role.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition cursor-pointer group",
                        isSelected ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-muted/30"
                      )}
                      onClick={() => setSelectedRole(role)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck
                            className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")}
                          />
                          <span className={cn("font-semibold text-sm", isSelected && "text-primary")}>
                            {role.name}
                          </span>
                          {role.is_system && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              System
                            </span>
                          )}
                        </div>
                        {canManageRoles && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditRole(role);
                                setShowModal(true);
                              }}
                              className="p-1 rounded hover:bg-muted"
                              title="Edit role"
                            >
                              <Edit2 className="size-3.5 text-muted-foreground" />
                            </button>
                            {!role.is_system && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void deleteRole(role);
                                }}
                                className="p-1 rounded hover:bg-destructive/10"
                                title="Delete role"
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </button>
                            )}
                          </div>
                        )}
                        {isSelected && <ChevronRight className="size-4 text-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{role.description}</p>
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                        <Users className="size-3" />
                        {assignedCount} user{assignedCount !== 1 ? "s" : ""} assigned
                        <span className="mx-1">·</span>
                        {role.permissions.length} permissions
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* ─── Role Detail Panel ─── */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedRole ? (
              <div className="py-20 text-center text-sm text-muted-foreground border rounded-xl bg-muted/10">
                Select a role to view details
              </div>
            ) : (
              <>
                {/* Role header */}
                <div className="bg-card border rounded-xl p-5 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">{selectedRole.name}</h2>
                      {selectedRole.is_system && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          System Role
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{selectedRole.description}</p>
                  </div>
                  {canManageRoles && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditRole(selectedRole);
                          setShowModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted transition"
                      >
                        <Edit2 className="size-3.5" /> Edit
                      </button>
                      {!selectedRole.is_system && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete role "${selectedRole.name}"? This cannot be undone.`)) {
                              void deleteRole(selectedRole);
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Users with this role */}
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Users with this Role</h3>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {usersForRole(selectedRole.id).length}
                    </span>
                  </div>
                  <div className="divide-y max-h-52 overflow-y-auto">
                    {usersForRole(selectedRole.id).length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No users assigned to this role yet.
                      </div>
                    ) : (
                      usersForRole(selectedRole.id).map((u) => (
                        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="size-8 rounded-full gradient-brand text-white text-xs font-bold grid place-items-center shrink-0">
                            {u.avatar_initials ||
                              u.full_name
                                .split(" ")
                                .map((p) => p[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{u.full_name}</div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                              u.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-red-500/10 text-red-600"
                            )}
                          >
                            {u.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Permissions granted */}
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Permissions Granted</h3>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {rolePermissionCodes.length} / {availablePermissions.length}
                    </span>
                  </div>
                  <div className="p-4 space-y-4">
                    {PERMISSION_GROUPS.map((group) => {
                      const grantedInGroup = group.keys.filter((k) => rolePermissionCodes.includes(k));
                      if (grantedInGroup.length === 0 && !selectedRole.is_system) return null;
                      return (
                        <div key={group.label}>
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            {group.label}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {group.keys.map((code) => {
                              const granted = rolePermissionCodes.includes(code);
                              return (
                                <span
                                  key={code}
                                  className={cn(
                                    "text-xs px-2 py-0.5 rounded-full font-medium border inline-flex items-center gap-1",
                                    granted
                                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                      : "bg-muted text-muted-foreground line-through opacity-40"
                                  )}
                                >
                                  {granted && <Check className="size-2.5" />}
                                  {PERMISSION_LABELS[code] ?? code}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <RoleFormModal
            role={editRole}
            availablePermissions={availablePermissions}
            canManageSuperAdmin={canManageSuperAdmin}
            onClose={() => {
              setShowModal(false);
              setEditRole(undefined);
            }}
            onSave={saveRole}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
