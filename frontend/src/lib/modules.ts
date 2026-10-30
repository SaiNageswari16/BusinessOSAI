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
  { to: "/delivery", label: "Delivery", moduleKey: "delivery" },
  { to: "/production", label: "Production", moduleKey: "production" },
  { to: "/marketing", label: "Marketing", moduleKey: "marketing" },

  // ── Shared Add-ons / Verticals ────────────────────────────────────────────
  { to: "/inventory", label: "Inventory", moduleKey: "inventory", requiredPermission: "inventory:stock:view" },
  { to: "/crm", label: "CRM", moduleKey: "crm", requiredPermission: "customers:profiles:view" },
  { to: "/staff", label: "Staff", moduleKey: "staff", requiredPermission: "staff:employees:view" },
  { to: "/reports", label: "Reports", moduleKey: "reports", requiredPermission: "reports:sales:view" },
  { to: "/ai", label: "AI", moduleKey: "ai" },
  { to: "/settings", label: "Settings", moduleKey: "core", requiredPermission: "org:settings:view" },
];

/**
 * Ribbon moduleKey → the platform registry module keys that gate the tabs
 * carrying that key.
 *
 * The platform service's module state (TenantModuleState.plugin_id, surfaced
 * by GET /platform/tenants/me/modules) is keyed on the registry's
 * module_key. Most ribbon moduleKeys match a module_key verbatim ("staff",
 * "pos", "inventory", "reports", "restaurant"). Two diverge: the ribbon's
 * "crm" tab is gated by the registry's "customers" key. A ribbon item hides
 * when *any* of its mapped keys is suspended — so a suspended "customers"
 * module hides the CRM tab, and a suspended "staff" module hides the Staff
 * tab, exactly matching the gateway's per-tenant module gate.
 */
const RIBBON_GATE_KEYS: Record<string, string[]> = {
  crm: ["crm", "customers"],
};

/** The platform module keys that gate a ribbon item (mapped, else itself). */
export function ribbonGateKeys(moduleKey: string): string[] {
  return (RIBBON_GATE_KEYS[moduleKey] ?? [moduleKey]).map((k) => k.toLowerCase());
}

export function resolveTenantNavigation(
  enabledModules: string[] = [
    "restaurant",
    "pos",
    "inventory",
    "crm",
    "staff",
    "reports",
    "delivery",
    "production",
    "marketing",
  ],
  hasPermission: (perm: string) => boolean = () => true,
  // Module keys the caller's tenant has suspended/archived in the platform
  // service (from GET /platform/tenants/me/modules, "active" entries excluded).
  suspendedModules: string[] = []
): NavItemDef[] {
  const enabledSet = new Set(enabledModules.map((m) => m.toLowerCase()));

  // Always enable core
  enabledSet.add("core");
  enabledSet.add("ai");

  // A tenant-suspended module must vanish from the ribbon even when the
  // user's role still carries its permission — the gate hides the page, the
  // ribbon is what hides the tab.
  const suspendedSet = new Set(suspendedModules.map((m) => m.toLowerCase()));

  return ALL_NAV_ITEMS.filter((item) => {
    // 1. Module gating
    if (!enabledSet.has(item.moduleKey.toLowerCase())) {
      return false;
    }

    // 2. Per-tenant module-state gating (platform suspension)
    if (ribbonGateKeys(item.moduleKey).some((k) => suspendedSet.has(k))) {
      return false;
    }

    // 3. Permission gating
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
      return false;
    }

    return true;
  });
}
