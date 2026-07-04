import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Check, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Permission Matrix</h1>
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
