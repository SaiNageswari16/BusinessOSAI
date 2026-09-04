import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Check, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
}

interface RoleItem {
  id: string;
  name: string;
  is_system: boolean;
  permissions: Permission[];
}

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

export function PermissionMatrix({ tab = "permission_matrix" }: { tab?: string }) {
    const { currency, formatCurrency } = useCurrency();
  const { accessToken } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/erp/roles?page=1&page_size=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`${API_BASE_URL}/erp/permissions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      if (!rolesRes.ok) throw new Error("Failed to load roles");
      if (!permsRes.ok) throw new Error("Failed to load permissions");
      const rolesJson = await rolesRes.json();
      const permsJson = await permsRes.json();
      setRoles(rolesJson.items);
      setAllPermissions(permsJson);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold">Permission Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A cross-reference view of all roles and their granted permissions across every module.
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          className="p-2 rounded-lg border hover:bg-muted transition"
          title="Refresh"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading permission matrix…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[180px]">
                  Permission
                </th>
                {roles.map((role) => (
                  <th
                    key={role.id}
                    className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[110px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <ShieldCheck className="size-3.5 text-primary" />
                      <span>{role.name}</span>
                      {role.is_system && (
                        <span className="text-[9px] text-muted-foreground normal-case font-normal">(system)</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPermissions.map((perm, i) => (
                <motion.tr
                  key={perm.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.015 }}
                  className="border-b last:border-0 hover:bg-muted/10 transition"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-sm">{perm.name || PERMISSION_LABELS[perm.code] || perm.code}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{perm.code}</div>
                  </td>
                  {roles.map((role) => {
                    const granted = role.permissions.some((p) => p.code === perm.code);
                    return (
                      <td key={role.id} className="px-3 py-2.5 text-center">
                        <div
                          className={cn(
                            "inline-flex items-center justify-center size-6 rounded-full",
                            granted ? "bg-emerald-500/10" : "bg-muted"
                          )}
                        >
                          {granted ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <X className="size-3 text-muted-foreground/50" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-full bg-emerald-500/10 grid place-items-center">
            <Check className="size-3 text-emerald-600" />
          </div>
          Permission granted
        </div>
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-full bg-muted grid place-items-center">
            <X className="size-3 text-muted-foreground/50" />
          </div>
          Permission denied
        </div>
        <div className="ml-auto text-xs">
          {roles.length} roles · {allPermissions.length} permissions
        </div>
      </div>
    </div>
  );
}
