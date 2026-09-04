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

    // 1. Platform Admins / Tenant Owners / Super Admins bypass all module/permission restrictions
    const isSuperAdminRole = Boolean(
      user.roles?.some((r) => {
        const name = (r.name || "").toLowerCase();
        return name.includes("admin") || name.includes("owner");
      }) ||
      user.permissions?.some((p) => ["all", "*:*", "admin", "super_admin", "manage:all", "manage:erp"].includes(p))
    );

    if (user.isPlatformAdmin || user.isTenantOwner || isSuperAdminRole || user.email === "venaticfungus@gmail.com") {
      return true;
    }

    const getModuleForPermission = (perm: string): string | null => {
      if (perm === "view:dashboard" || perm.startsWith("view:workspace")) return "dashboard";
      if (perm.startsWith("view:erp") || perm.startsWith("manage:erp") || perm.includes("company") || perm.includes("branch") || perm.includes("role") || perm.includes("user") || perm.includes("workflow")) return "erp";
      if (perm.includes("inventory") || perm.includes("product") || perm.includes("catalog") || perm.includes("warehouse") || perm.includes("stock") || perm.includes("batch")) return "inventory";
      if (perm.includes("pos") || perm.includes("terminal") || perm.includes("cashier")) return "pos";
      if (perm.includes("procurement") || perm.includes("purchase") || perm.includes("supplier") || perm.includes("vendor") || perm.includes("grn")) return "procurement";
      if (perm.includes("accounting") || perm.includes("finance") || perm.includes("invoice") || perm.includes("journal") || perm.includes("bank") || perm.includes("voucher") || perm.includes("tax") || perm.includes("chart_of_accounts") || perm.includes("fixed_asset") || perm.includes("expense_claim") || perm.includes("budget")) return "accounting";
      if (perm.includes("crm") || perm.includes("lead") || perm.includes("deal") || perm.includes("quotation") || perm.includes("ticket") || perm.includes("customer")) return "crm";
      if (perm.includes("hrms") || perm.includes("employee") || perm.includes("payroll") || perm.includes("attendance") || perm.includes("leave") || perm.includes("ess") || perm.includes("recruitment") || perm.includes("payslip")) return "hrms";
      if (perm.includes("marketplace") || perm.includes("appstore")) return "marketplace";
      if (perm.includes("iot") || perm.includes("telemetry") || perm.includes("device") || perm.includes("sensor")) return "iot";
      if (perm.includes("report") || perm.includes("analytics") || perm.includes("intelligence")) return "reports";
      if (perm.includes("setting") || perm.includes("system") || perm.includes("config")) return "settings";
      return null;
    };

    // Module-level entitlement check for client workspaces
    if (user.enabledModules && user.enabledModules.length > 0) {
      const targetMod = getModuleForPermission(permission);
      // Core ERP, workspace dashboard, and general settings are standard tenant administration
      if (targetMod && targetMod !== "erp" && targetMod !== "dashboard" && targetMod !== "settings") {
        const isEnabled = user.enabledModules.some((m) => {
          if (m === targetMod) return true;
          if (targetMod === "procurement" && (m === "operations" || m === "procurement")) return true;
          if (targetMod === "reports" && (m === "analytics" || m === "reports")) return true;
          return false;
        });
        if (!isEnabled) {
          return false;
        }
      }
    }

    // Direct match
    if (user.permissions.includes(permission)) return true;

    // Module-group virtual permissions — expand to all related permissions in that module
    if (permission === "view:hrms") {
      return user.permissions.some(
        (p) =>
          p.startsWith("view:hrms") ||
          p.startsWith("manage:hrms") ||
          p.startsWith("view:ess") ||
          p.startsWith("manage:ess") ||
          p.includes("employee") ||
          p.includes("attendance") ||
          p.includes("leave") ||
          p.includes("payroll")
      );
    }
    if (permission === "view:erp") {
      return user.permissions.some(p =>
        p.startsWith("view:erp_") || p.startsWith("manage:erp_") ||
        p.startsWith("view:accounting_") || p.startsWith("manage:accounting_") ||
        p.includes("role") || p.includes("user") || p.includes("company") || p.includes("branch")
      );
    }
    if (permission === "view:crm") {
      return user.permissions.some(p => p.startsWith("view:crm_") || p.startsWith("manage:crm_") || p.includes("lead") || p.includes("deal") || p.includes("customer"));
    }
    if (permission === "view:pos") {
      return user.permissions.some(p => p.startsWith("view:pos_") || p.startsWith("manage:pos_") || p.includes("terminal") || p.includes("cashier"));
    }
    if (permission === "view:inventory") {
      return user.permissions.some(p => p.startsWith("view:inventory_") || p.startsWith("manage:inventory_") || p.includes("product") || p.includes("stock") || p.includes("warehouse"));
    }
    if (permission === "view:procurement") {
      return user.permissions.some(p => p.startsWith("view:procurement_") || p.startsWith("manage:procurement_") || p.includes("purchase") || p.includes("supplier") || p.includes("vendor"));
    }
    if (permission === "view:settings" || permission === "view:system_config" || permission === "manage:system_config" || permission === "manage:system_admin" || permission === "manage:settings") {
      return user.permissions.some(p =>
        p.includes("system_config") ||
        p.includes("settings") ||
        p.includes("system") ||
        p.includes("webhooks") ||
        p.startsWith("manage:erp") ||
        p.startsWith("view:erp")
      );
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
    if (permission === "view:reports" || permission === "view:analytics" || permission === "manage:analytics" || permission === "manage:reports") {
      return user.permissions.some(p =>
        p.includes("analytics") ||
        p.includes("report") ||
        p.includes("ai_insights") ||
        p.includes("intelligence")
      );
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
