import {
  BarChart3,
  CalendarClock,
  ChefHat,
  ClipboardList,
  Home,
  LayoutGrid,
  Package,
  Settings as SettingsIcon,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCheck,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/profiles";

export type NavAccentCategory = "primary" | "operations" | "kitchen" | "alert" | "ai" | "neutral";

export type NavBadgeTone = "blue" | "amber" | "crimson" | "emerald" | "violet";

export interface NavSubItem {
  label: string;
  to: string;
  desc: string;
}

export interface NavItemConfig {
  key: ModuleKey;
  label: string;
  to: string;
  icon: LucideIcon;
  category: NavAccentCategory;
  iconColorClass: string;
  badgeTone?: NavBadgeTone;
  priority: "primary" | "secondary";
  children?: NavSubItem[];
}

export interface NavBadgeCounts {
  orders: number;
  kitchen: number;
  inventory: number;
  delivery: number;
}

export const NAV_ITEMS_CONFIG: NavItemConfig[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    to: "/",
    icon: Home,
    category: "primary",
    iconColorClass: "text-[#38BDF8]",
    priority: "primary",
  },
  {
    key: "operations",
    label: "Operations",
    to: "/operations",
    icon: LayoutGrid,
    category: "primary",
    iconColorClass: "text-[#22D3EE]",
    priority: "primary",
  },
  {
    key: "pos",
    label: "POS",
    to: "/pos",
    icon: ShoppingCart,
    category: "primary",
    iconColorClass: "text-[#38BDF8]",
    priority: "primary",
  },
  {
    key: "orders",
    label: "Orders",
    to: "/orders",
    icon: ClipboardList,
    category: "primary",
    iconColorClass: "text-[#22D3EE]",
    badgeTone: "blue",
    priority: "primary",
    children: [
      { label: "All Orders", to: "/orders", desc: "Live & historical order register" },
      { label: "Delivery Dispatch", to: "/delivery", desc: "Packing, riders & aggregator orders" },
    ],
  },
  {
    key: "menu",
    label: "Menu",
    to: "/menu",
    icon: Utensils,
    category: "operations",
    iconColorClass: "text-[#10B981]",
    priority: "primary",
  },
  {
    key: "kitchen",
    label: "Kitchen",
    to: "/kot",
    icon: ChefHat,
    category: "kitchen",
    iconColorClass: "text-[#F59E0B]",
    badgeTone: "amber",
    priority: "primary",
    children: [
      { label: "KOT Ticket Board", to: "/kot", desc: "Station tickets & status transitions" },
      { label: "KDS Full-Screen", to: "/kds", desc: "Kitchen display system with timers" },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    to: "/inventory",
    icon: Package,
    category: "alert",
    iconColorClass: "text-[#F472B6]",
    badgeTone: "crimson",
    priority: "primary",
  },
  {
    key: "crm",
    label: "CRM",
    to: "/crm",
    icon: Users,
    category: "ai",
    iconColorClass: "text-[#A78BFA]",
    priority: "secondary",
  },
  {
    key: "reservations",
    label: "Reservations",
    to: "/reservations",
    icon: CalendarClock,
    category: "ai",
    iconColorClass: "text-[#C084FC]",
    priority: "secondary",
  },
  {
    key: "staff",
    label: "Staff",
    to: "/staff",
    icon: UserCheck,
    category: "primary",
    iconColorClass: "text-[#38BDF8]",
    priority: "secondary",
  },
  {
    key: "delivery",
    label: "Delivery",
    to: "/delivery",
    icon: Truck,
    category: "operations",
    iconColorClass: "text-[#14B8A6]",
    badgeTone: "emerald",
    priority: "secondary",
  },
  {
    key: "reports",
    label: "Reports",
    to: "/reports",
    icon: BarChart3,
    category: "operations",
    iconColorClass: "text-[#2DD4BF]",
    priority: "secondary",
  },
  {
    key: "ai",
    label: "AI",
    to: "/ai",
    icon: Sparkles,
    category: "ai",
    iconColorClass: "text-[#A855F7]",
    badgeTone: "violet",
    priority: "secondary",
  },
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    icon: SettingsIcon,
    category: "neutral",
    iconColorClass: "text-[#94A3B8]",
    priority: "secondary",
  },
];

export function getNavBadgeValue(key: ModuleKey, counts: NavBadgeCounts): number | undefined {
  switch (key) {
    case "orders":
      return counts.orders > 0 ? counts.orders : undefined;
    case "kitchen":
      return counts.kitchen > 0 ? counts.kitchen : undefined;
    case "inventory":
      return counts.inventory > 0 ? counts.inventory : undefined;
    case "delivery":
      return counts.delivery > 0 ? counts.delivery : undefined;
    default:
      return undefined;
  }
}

export function getBadgeClasses(tone: NavBadgeTone | undefined, isActive: boolean): string {
  switch (tone) {
    case "blue":
      return "bg-[#1769E8] text-white shadow-[0_0_8px_rgba(23,105,232,0.5)]";
    case "amber":
      return "bg-[#F59E0B] text-slate-950 font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.45)]";
    case "crimson":
      return "bg-[#E11D48] text-white shadow-[0_0_8px_rgba(225,29,72,0.45)]";
    case "emerald":
      return "bg-[#10B981] text-white shadow-[0_0_8px_rgba(16,185,129,0.45)]";
    case "violet":
      return "bg-[#8B5CF6] text-white";
    default:
      return isActive ? "bg-white/25 text-white" : "bg-white/15 text-white/90";
  }
}

export function isNavItemActive(item: NavItemConfig, pathname: string): boolean {
  if (item.to === "/") {
    return pathname === "/" || pathname === "/dashboard";
  }
  if (item.key === "kitchen") {
    return (
      pathname.startsWith("/kot") || pathname.startsWith("/kds") || pathname.startsWith("/kitchen")
    );
  }
  return pathname.startsWith(item.to);
}
