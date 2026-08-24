import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./auth-context";
import type { AuthRole } from "./auth-context";

interface RbacContextType {
  activeRole: AuthRole | null;
  setActiveRole: (role: AuthRole) => void;
  hasPermission: (permission: string) => boolean;
  availableRoles: AuthRole[];
}

const RbacContext = createContext<RbacContextType | undefined>(undefined);

export function RbacProvider({ children }: { children: React.ReactNode }) {
  const { user, selectRole } = useAuth();
  const [activeRole, setActiveRoleState] = useState<AuthRole | null>(null);

  // All available roles come directly from the authenticated user's real roles
  const availableRoles: AuthRole[] = React.useMemo(() => {
    return user?.roles ?? [];
  }, [user]);

  useEffect(() => {
    if (user && availableRoles.length > 0) {
      const storedRoleId = localStorage.getItem("bos-active-role");
      let initialRole = availableRoles.find((r) => r.id === storedRoleId);

      if (!initialRole) {
        // Fall back to the default role, then the first one
        initialRole =
          availableRoles.find((r) => r.is_default) ??
          availableRoles.find((r) => r.id === user.defaultRole) ??
          availableRoles[0];
      }

      setActiveRoleState(initialRole ?? null);
    } else {
      setActiveRoleState(null);
    }
  }, [user, availableRoles]);

  const setActiveRole = async (role: AuthRole) => {
    try {
      await selectRole(role.id);
    } catch (err) {
      console.error("Failed to switch role active session", err);
      setActiveRoleState(role);
      localStorage.setItem("bos-active-role", role.id);
    }
  };

  // hasPermission uses the flat permissions list on the user (aggregated across all roles by /auth/me)
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    // System Administration permission is strictly reserved for God Mode (Platform Admins)
    if (permission === "manage:system_admin") {
      return Boolean(user.isPlatformAdmin || user.email === "venaticfungus@gmail.com");
    }

    // Module-level entitlement check for client workspaces (Platform Admin bypasses this)
    if (!user.isPlatformAdmin && user.enabledModules && user.enabledModules.length > 0) {
      const isPermInModule = (mod: string, perm: string): boolean => {
        if (mod === "inventory") return perm.includes("inventory") || perm.includes("product") || perm.includes("catalog") || perm.includes("warehouse");
        if (mod === "pos") return perm.includes("pos") || perm.includes("terminal") || perm.includes("cashier");
        if (mod === "accounting") return perm.includes("accounting") || perm.includes("finance") || perm.includes("invoice") || perm.includes("journal") || perm.includes("bank") || perm.includes("voucher") || perm.includes("tax");
        if (mod === "crm") return perm.includes("crm") || perm.includes("lead") || perm.includes("deal") || perm.includes("quotation") || perm.includes("ticket");
        if (mod === "procurement") return perm.includes("procurement") || perm.includes("purchase") || perm.includes("vendor") || perm.includes("grn");
        if (mod === "hrms") return perm.includes("hrms") || perm.includes("employee") || perm.includes("payroll") || perm.includes("attendance") || perm.includes("leave");
        if (mod === "iot") return perm.includes("iot") || perm.includes("telemetry") || perm.includes("device");
        if (mod === "marketplace") return perm.includes("marketplace") || perm.includes("appstore");
        if (mod === "core" || mod === "erp") return perm.includes("erp") || perm.includes("company") || perm.includes("branch") || perm.includes("role") || perm.includes("user");
        return true;
      };

      // If checking a known module root permission, ensure module is enabled
      const moduleMap: Record<string, string> = {
        "view:hrms": "hrms",
        "view:crm": "crm",
        "view:pos": "pos",
        "view:inventory": "inventory",
        "view:procurement": "procurement",
        "view:accounting": "accounting",
        "view:iot": "iot",
        "view:marketplace": "marketplace",
      };

      const requiredMod = moduleMap[permission];
      if (requiredMod && !user.enabledModules.includes(requiredMod)) {
        return false;
      }
    }

    // Tenant owners see everything permitted in their own subscribed workspace modules
    if (user.isTenantOwner) return true;
    // Direct match
    if (user.permissions.includes(permission)) return true;


    // Module-group virtual permissions — only expand to the specific module's permissions
    if (permission === "view:hrms") {
      return user.permissions.some(p => p.startsWith("view:hrms_") || p.startsWith("manage:hrms_"));
    }
    if (permission === "view:erp") {
      return user.permissions.some(p =>
        p.startsWith("view:erp_") || p.startsWith("manage:erp_") ||
        p.startsWith("view:accounting_") || p.startsWith("manage:accounting_")
      );
    }
    if (permission === "view:crm") {
      return user.permissions.some(p => p.startsWith("view:crm_") || p.startsWith("manage:crm_"));
    }
    if (permission === "view:pos") {
      return user.permissions.some(p => p.startsWith("view:pos_") || p.startsWith("manage:pos_"));
    }
    if (permission === "view:inventory") {
      return user.permissions.some(p => p.startsWith("view:inventory_") || p.startsWith("manage:inventory_"));
    }
    if (permission === "view:procurement") {
      return user.permissions.some(p => p.startsWith("view:procurement_") || p.startsWith("manage:procurement_"));
    }
    if (permission === "view:settings") {
      return user.permissions.some(p => p.startsWith("view:settings_") || p.startsWith("manage:settings_"));
    }
    if (permission === "view:marketplace") {
      return user.permissions.some(p => p.startsWith("view:marketplace") || p.startsWith("manage:marketplace"));
    }
    if (permission === "view:accounting") {
      return user.permissions.some(p => p.startsWith("view:accounting") || p.startsWith("manage:accounting") ||
        p.startsWith("view:chart_of_accounts") || p.startsWith("view:journal") || p.startsWith("view:bank") ||
        p.startsWith("view:fixed_assets") || p.startsWith("view:expense_claims") || p.startsWith("view:budgets") || p.startsWith("view:tax"));
    }
    if (permission === "view:iot") {
      return user.permissions.some(p => p.startsWith("view:iot") || p.startsWith("manage:iot"));
    }
    if (permission === "view:reports") {
      return user.permissions.some(p => p.startsWith("view:reports") || p.startsWith("manage:reports"));
    }
    return false;
  };

  return (
    <RbacContext.Provider value={{ activeRole, setActiveRole, hasPermission, availableRoles }}>
      {children}
    </RbacContext.Provider>
  );
}

export function useRbac() {
  const context = useContext(RbacContext);
  if (context === undefined) {
    throw new Error("useRbac must be used within an RbacProvider");
  }
  return context;
}
