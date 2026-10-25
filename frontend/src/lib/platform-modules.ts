/**
 * Platform control-plane module catalogue.
 *
 * The canonical set of switchable modules — the six seeded verticals plus the
 * eleven core services the gateway's per-tenant module gate actually keys on.
 * Used by the admin UI so the onboarding wizard and the per-tenant lifecycle
 * view present the same, complete list (the plugin endpoint only reports
 * what is seeded in the platform DB, not the full registry).
 */

export interface PlatformModuleDef {
  key: string;
  label: string;
  icon: string;
  group: "vertical" | "core";
  /**
   * Whether the gateway enforces this module's per-tenant state.
   * Core services that have no gateway descriptor yet report false — a
   * kill-switch row exists but nothing gates on it, and the UI must say so.
   */
  gated: boolean;
}

export const PLATFORM_MODULES: PlatformModuleDef[] = [
  // ── Seeded verticals (the "industry" plugins) ────────────────────────────
  { key: "restaurant", label: "Restaurant & Dining OS", icon: "🍽️", group: "vertical", gated: false },
  { key: "salon", label: "Salon & Spa Care", icon: "✂️", group: "vertical", gated: false },
  { key: "gym", label: "Fitness & Gym Club", icon: "🏋️", group: "vertical", gated: false },
  { key: "retail", label: "Retail Store & Boutique", icon: "🛍️", group: "vertical", gated: false },
  { key: "clinic", label: "Healthcare & Clinic Care", icon: "🩺", group: "vertical", gated: false },
  { key: "carwash", label: "Auto Care & Car Wash", icon: "🚗", group: "vertical", gated: false },

  // ── Core services (gateway module-gated where flagged) ───────────────────
  { key: "pos", label: "POS & Orders", icon: "🧾", group: "core", gated: true },
  { key: "kitchen", label: "Kitchen KDS", icon: "👨‍🍳", group: "core", gated: true },
  { key: "menu", label: "Menu & Recipes", icon: "📋", group: "core", gated: true },
  { key: "billing", label: "Billing & Payments", icon: "💳", group: "core", gated: true },
  { key: "inventory", label: "Inventory & Stock", icon: "📦", group: "core", gated: true },
  { key: "purchase", label: "Purchasing & Vendors", icon: "🚚", group: "core", gated: true },
  { key: "staff", label: "Staff & Rostering", icon: "👥", group: "core", gated: true },
  { key: "customers", label: "Customers & CRM", icon: "🪪", group: "core", gated: true },
  { key: "loyalty", label: "Loyalty & Rewards", icon: "⭐", group: "core", gated: true },
  { key: "accounting", label: "Accounting & GST", icon: "🧮", group: "core", gated: true },
  { key: "reports", label: "Reports & Analytics", icon: "📈", group: "core", gated: true },
];

/** The modules a fresh restaurant tenant should start with. */
export const RESTAURANT_DEFAULT_MODULES = [
  "restaurant",
  "pos",
  "kitchen",
  "menu",
  "billing",
  "inventory",
  "purchase",
  "staff",
];

/** Every switchable module key — the canonical on/off list per tenant. */
export const ALL_MODULE_KEYS: string[] = PLATFORM_MODULES.map((m) => m.key);

const MODULE_BY_KEY: Record<string, PlatformModuleDef> = Object.fromEntries(
  PLATFORM_MODULES.map((m) => [m.key, m])
);

export function moduleLabel(key: string): string {
  return MODULE_BY_KEY[key]?.label ?? key;
}
