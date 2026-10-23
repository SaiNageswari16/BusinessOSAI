/**
 * Enterprise Multi-Vertical Module Registry.
 *
 * Maps business verticals (Restaurant, Salon, Gym, Retail, Clinic, Carwash)
 * and capability add-ons to navigation routes and required permissions.
 */

export interface NavItemDef {
  to: string;
  label: string;
  moduleKey: string;
  requiredPermission?: string;
}

export const ALL_NAV_ITEMS: NavItemDef[] = [
  // ── Core Dashboard ────────────────────────────────────────────────────────
  { to: "/dashboard", label: "Dashboard", moduleKey: "core" },

  // ── Restaurant Vertical ───────────────────────────────────────────────────
  { to: "/pos", label: "POS", moduleKey: "pos", requiredPermission: "pos:orders:create" },
  { to: "/operations", label: "Operations", moduleKey: "restaurant", requiredPermission: "pos:tables:manage" },
  { to: "/orders", label: "Orders", moduleKey: "pos", requiredPermission: "pos:orders:view" },
  { to: "/kitchen", label: "Kitchen", moduleKey: "restaurant", requiredPermission: "kitchen:kds:view" },
  { to: "/menu", label: "Menu", moduleKey: "restaurant", requiredPermission: "menu:items:view" },
  { to: "/recipes", label: "Recipes", moduleKey: "restaurant", requiredPermission: "menu:items:view" },
  { to: "/reservations", label: "Reservations", moduleKey: "restaurant", requiredPermission: "pos:tables:manage" },

  // ── Shared Add-ons / Verticals ────────────────────────────────────────────
  { to: "/inventory", label: "Inventory", moduleKey: "inventory", requiredPermission: "inventory:stock:view" },
  { to: "/crm", label: "CRM", moduleKey: "crm", requiredPermission: "customers:profiles:view" },
  { to: "/staff", label: "Staff", moduleKey: "staff", requiredPermission: "staff:employees:view" },
  { to: "/reports", label: "Reports", moduleKey: "reports", requiredPermission: "reports:sales:view" },
  { to: "/ai", label: "AI", moduleKey: "ai" },
  { to: "/settings", label: "Settings", moduleKey: "core", requiredPermission: "org:settings:view" },
];

export function resolveTenantNavigation(
  enabledModules: string[] = ["restaurant", "pos", "inventory", "crm", "staff", "reports"],
  hasPermission: (perm: string) => boolean = () => true
): NavItemDef[] {
  const enabledSet = new Set(enabledModules.map((m) => m.toLowerCase()));

  // Always enable core
  enabledSet.add("core");
  enabledSet.add("ai");

  return ALL_NAV_ITEMS.filter((item) => {
    // 1. Module gating
    if (!enabledSet.has(item.moduleKey.toLowerCase())) {
      return false;
    }

    // 2. Permission gating
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
      return false;
    }

    return true;
  });
}
