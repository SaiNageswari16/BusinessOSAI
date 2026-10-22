import type { ProfileId, OrderType } from "./types";

export type ModuleKey =
  | "dashboard"
  | "operations"
  | "pos"
  | "orders"
  | "menu"
  | "kitchen"
  | "inventory"
  | "crm"
  | "reservations"
  | "staff"
  | "delivery"
  | "reports"
  | "ai"
  | "settings";

export interface Profile {
  id: ProfileId;
  label: string;
  blurb: string;
  services: OrderType[];
  modules: ModuleKey[];
  accentHue: number;
  focus: string;
}

const all: ModuleKey[] = [
  "dashboard",
  "operations",
  "pos",
  "orders",
  "menu",
  "kitchen",
  "inventory",
  "crm",
  "reservations",
  "staff",
  "delivery",
  "reports",
  "ai",
  "settings",
];
const without = (...m: ModuleKey[]) => all.filter((x) => !m.includes(x));

export const PROFILES: Record<ProfileId, Profile> = {
  "fine-dining": {
    id: "fine-dining",
    label: "Fine dining",
    blurb: "Reservations, floor plan and guest service first.",
    services: ["dine-in", "takeaway"],
    modules: without("delivery"),
    accentHue: 259,
    focus: "Guest experience & table turns",
  },
  casual: {
    id: "casual",
    label: "Casual dining",
    blurb: "Balanced dine-in, takeaway and delivery.",
    services: ["dine-in", "takeaway", "delivery"],
    modules: all,
    accentHue: 259,
    focus: "Covers & average order value",
  },
  qsr: {
    id: "qsr",
    label: "Quick service",
    blurb: "Fast counter orders, pickup numbers, kitchen throughput.",
    services: ["takeaway", "delivery", "dine-in"],
    modules: without("reservations", "operations"),
    accentHue: 25,
    focus: "Speed of service & queue length",
  },
  cafe: {
    id: "cafe",
    label: "Cafe & bakery",
    blurb: "Counter orders, beverages, compact tables.",
    services: ["takeaway", "dine-in"],
    modules: without("reservations", "delivery"),
    accentHue: 163,
    focus: "Beverage mix & repeat guests",
  },
  "cloud-kitchen": {
    id: "cloud-kitchen",
    label: "Cloud kitchen",
    blurb: "KOT, KDS, packing and dispatch. No floor plan.",
    services: ["delivery", "takeaway"],
    modules: without("operations", "reservations"),
    accentHue: 285,
    focus: "Dispatch time & kitchen load",
  },
};
