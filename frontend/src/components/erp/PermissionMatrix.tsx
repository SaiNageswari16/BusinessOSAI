import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Check, X } from "lucide-react";
import { mockRoles, ALL_PERMISSIONS } from "@/data/mockRbacData";
import { cn } from "@/lib/utils";

const PERMISSION_LABELS: Record<string, string> = {
  "view:dashboard": "Dashboard",
  "view:copilot": "AI Copilot",
  "view:erp": "ERP Core",
  "view:inventory": "Inventory",
  "view:warehouse": "Warehouse",
  "view:procurement": "Procurement",
  "view:pos": "POS",
  "view:accounting": "Accounting",
  "view:crm": "CRM",
  "view:hrms": "HRMS",
  "view:payroll": "Payroll",
  "view:reports": "Reports",
  "view:settings": "Settings",
  "manage:users": "User Mgmt",
  "manage:roles": "Role Mgmt",
};

export function PermissionMatrix({ tab = "permission_matrix" }: { tab?: string }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Permission Matrix</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A cross-reference view of all roles and their granted permissions across every module.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[180px]">
                Permission
              </th>
              {mockRoles.map(role => (
                <th key={role.id} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground min-w-[110px]">
                  <div className="flex flex-col items-center gap-1">
                    <ShieldCheck className="size-3.5 text-primary" />
                    <span>{role.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((perm, i) => (
              <motion.tr
                key={perm}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="border-b last:border-0 hover:bg-muted/10 transition"
              >
                <td className="px-4 py-2.5">
                  <div className="font-medium text-sm">{PERMISSION_LABELS[perm] || perm}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{perm}</div>
                </td>
                {mockRoles.map(role => {
                  const granted = role.permissions.includes(perm);
                  return (
                    <td key={role.id} className="px-3 py-2.5 text-center">
                      <div className={cn(
                        "inline-flex items-center justify-center size-6 rounded-full",
                        granted ? "bg-emerald-500/10" : "bg-muted"
                      )}>
                        {granted
                          ? <Check className="size-3.5 text-emerald-600" />
                          : <X className="size-3 text-muted-foreground/50" />
                        }
                      </div>
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

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
      </div>
    </div>
  );
}
