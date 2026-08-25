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
  "view:dashboard": "Dashboard",
  "view:copilot": "AI Copilot",
  "view:erp": "ERP Core",
  "view:inventory": "Inventory",
  "manage:inventory": "Manage Inventory",
  "view:warehouse": "Warehouse",
  "manage:warehouse": "Manage Warehouse",
  "view:procurement": "Procurement",
  "manage:procurement": "Manage Procurement",
  "view:pos": "POS",
  "view:accounting": "Accounting",
  "view:crm": "CRM",
  "view:hrms": "HRMS",
  "view:payroll": "Payroll",
  "view:reports": "Reports",
  "view:settings": "Settings",
  "manage:users": "User Mgmt",
  "manage:roles": "Role Mgmt",

  // Granular Access & Security
  "view:users": "View Users",
  "view:roles": "View Roles",
  "view:permission_matrix": "Perm Matrix",
  "view:workspaces": "View Workspaces",
  "manage:workspaces": "Manage Workspaces",
  "view:subscription": "View Plan",
  "manage:subscription": "Manage Plan",
  "view:api_keys": "View API Keys",
  "manage:api_keys": "Manage API Keys",
  "view:mfa_policies": "View MFA",
  "manage:mfa_policies": "Manage MFA",

  // Granular Organization
  "view:branches": "View Branches",
  "manage:branches": "Manage Branches",
  "view:departments": "View Depts",
  "manage:departments": "Manage Depts",
  "view:designations": "View Job Desig",
  "manage:designations": "Manage Job Desig",
  "view:teams": "View Teams",
  "manage:teams": "Manage Teams",

  // Setup & Master Data
  "view:currencies": "View Currencies",
  "manage:currencies": "Manage Currencies",
  "view:fiscal_years": "View Fiscal Yrs",
  "manage:fiscal_years": "Manage Fiscal Yrs",
  "view:taxes": "View Taxes",
  "manage:taxes": "Manage Taxes",
  "view:payment_terms": "View Pay Terms",
  "manage:payment_terms": "Manage Pay Terms",
  "view:cost_centers": "View Cost Ctrs",
  "manage:cost_centers": "Manage Cost Ctrs",
  "view:number_series": "View Num Series",
  "manage:number_series": "Manage Num Series",
  "view:workflows": "View Workflows",
  "manage:workflows": "Manage Workflows",
  "view:geography": "View Geography",
  "manage:geography": "Manage Geography",
  "view:locations": "View Locations",
  "manage:locations": "Manage Locations",
  "view:tags": "View Tags",
  "manage:tags": "Manage Tags",
  "view:document_templates": "View Doc Templates",
  "manage:document_templates": "Manage Doc Templates",
  "view:notification_templates": "View Alert Templates",
  "manage:notification_templates": "Manage Alert Templates",

  // System Administration
  "view:backup": "View Backup",
  "manage:backup": "Manage Backup",
  "view:system_health": "Sys Health",
  "view:activity_logs": "Activity Logs",
  "view:error_logs": "Error Logs",

  // Granular HRMS - Employees & Org
  "view:hrms_employees": "HRMS: View Emps",
  "manage:hrms_employees": "HRMS: Manage Emps",
  "view:hrms_departments": "HRMS: View Depts",
  "manage:hrms_departments": "HRMS: Manage Depts",
  "view:hrms_designations": "HRMS: View Desig",
  "manage:hrms_designations": "HRMS: Manage Desig",
  "view:hrms_teams": "HRMS: View Teams",
  "manage:hrms_teams": "HRMS: Manage Teams",
  "view:hrms_documents": "HRMS: View Docs",
  "manage:hrms_documents": "HRMS: Manage Docs",
  "view:hrms_profiles": "HRMS: View Profile",

  // Granular HRMS - Attendance
  "view:hrms_attendance": "HRMS: View Attend",
  "manage:hrms_attendance": "HRMS: Manage Attend",
  "view:hrms_biometric": "HRMS: Biometric Config",
  "view:hrms_face": "HRMS: Face ID Logs",
  "view:hrms_gps": "HRMS: GPS Track",
  "view:hrms_shifts": "HRMS: Shift Config",
  "view:hrms_corrections": "HRMS: View Corrs",
  "manage:hrms_corrections": "HRMS: Manage Corrs",

  // Granular HRMS - Leave
  "view:hrms_leaves": "HRMS: View Leaves",
  "manage:hrms_leaves": "HRMS: Apply Leaves",
  "view:hrms_leave_calendar": "HRMS: Leave Calendar",
  "view:hrms_leave_balance": "HRMS: Leave Balance",
  "view:hrms_leave_policies": "HRMS: Leave Policies",
  "manage:hrms_leave_policies": "HRMS: Manage Policies",
  "view:hrms_leave_approvals": "HRMS: View Approvals",
  "manage:hrms_leave_approvals": "HRMS: Manage Approvals",

  // Granular HRMS - Payroll
  "view:hrms_salary_structure": "HRMS: View Salary Struct",
  "manage:hrms_salary_structure": "HRMS: Manage Salary Struct",
  "view:hrms_pay_grades": "HRMS: View Grades",
  "manage:hrms_pay_grades": "HRMS: Manage Grades",
  "view:hrms_payroll_processing": "HRMS: Process Payroll",
  "view:hrms_pf_esi": "HRMS: View PF/ESI",
  "view:hrms_tds": "HRMS: View TDS",
  "view:hrms_payslips": "HRMS: View Payslips",
  "view:hrms_loans_advances": "HRMS: View Loans",
  "manage:hrms_loans_advances": "HRMS: Manage Loans",
  "view:hrms_bonuses_commissions": "HRMS: Bonus & Comm",

  // Granular HRMS - Recruitment, Perf & Exit
  "view:hrms_recruitment": "HRMS: View Recruit",
  "manage:hrms_recruitment": "HRMS: Manage Recruit",
  "view:hrms_onboarding": "HRMS: Onboarding",
  "view:hrms_performance": "HRMS: View Perf",
  "manage:hrms_performance": "HRMS: Manage Appraisals",
  "view:hrms_learning": "HRMS: View Learning",
  "manage:hrms_learning": "HRMS: Manage Learning",
  "view:hrms_exit": "HRMS: View Exit",
  "manage:hrms_exit": "HRMS: Manage Exit",
  "view:hrms_intelligence": "HRMS: AI Analytics",

  // Granular HRMS - ESS
  "view:ess_dashboard": "ESS: Dashboard",
  "view:ess_attendance": "ESS: Attendance",
  "view:ess_leaves": "ESS: Leaves",
  "view:ess_payroll": "ESS: Payroll",
  "view:ess_documents": "ESS: Documents",
  "view:ess_tasks_announcements": "ESS: Tasks & Notices",
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
            <thead>
              <tr className="border-b bg-muted/30">
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
