import type { ComboItem } from "@/lib/store";
import type { MenuItem, Station } from "@/lib/types";

export interface PosCategoryDef {
  id: string;
  label: string;
  badgeCount: number;
  iconBg: string;
  iconColor: string;
  emoji: string;
}

export const POS_CATEGORIES: PosCategoryDef[] = [
  {
    id: "Bestsellers",
    label: "Bestsellers",
    badgeCount: 8,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    emoji: "🔥",
  },
  {
    id: "Starters",
    label: "Starters",
    badgeCount: 12,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    emoji: "👑",
  },
  {
    id: "Soups",
    label: "Soups",
    badgeCount: 6,
    iconBg: "bg-yellow-100",
    iconColor: "text-yellow-700",
    emoji: "🍲",
  },
  {
    id: "Main Course",
    label: "Main Course",
    badgeCount: 20,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    emoji: "🍛",
  },
  {
    id: "Biryani & Rice",
    label: "Biryani & Rice",
    badgeCount: 8,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    emoji: "🥘",
  },
  {
    id: "Indian Breads",
    label: "Indian Breads",
    badgeCount: 10,
    iconBg: "bg-yellow-100",
    iconColor: "text-amber-700",
    emoji: "🫓",
  },
  {
    id: "Chinese",
    label: "Chinese",
    badgeCount: 14,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    emoji: "🥡",
  },
  {
    id: "Continental",
    label: "Continental",
    badgeCount: 6,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    emoji: "🍝",
  },
  {
    id: "Tandoor",
    label: "Tandoor",
    badgeCount: 8,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    emoji: "🍢",
  },
  {
    id: "Beverages",
    label: "Beverages",
    badgeCount: 18,
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    emoji: "🥤",
  },
  {
    id: "Desserts",
    label: "Desserts",
    badgeCount: 6,
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
    emoji: "🍨",
  },
  {
    id: "Combos",
    label: "Combos",
    badgeCount: 8,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    emoji: "🍱",
  },
];

export interface FeaturedSpecial {
  itemId: string;
  tag: string;
  badge: string;
  title: string;
  subtitle: string;
  price: number;
}

export const FEATURED_SPECIALS: FeaturedSpecial[] = [
  {
    itemId: "M22",
    tag: "Today's Special",
    badge: "Bestseller",
    title: "Hyderabadi Chicken Biryani",
    subtitle: "Authentic dum biryani with rich flavours",
    price: 320,
  },
  {
    itemId: "M1",
    tag: "Today's Special",
    badge: "Chef's Pick",
    title: "Paneer Tikka",
    subtitle: "Char-grilled cottage cheese with mint chutney",
    price: 280,
  },
  {
    itemId: "M14",
    tag: "Today's Special",
    badge: "Bestseller",
    title: "Butter Chicken",
    subtitle: "Velvety tomato-butter gravy with smoked chicken",
    price: 340,
  },
  {
    itemId: "M17",
    tag: "Today's Special",
    badge: "Royal Special",
    title: "Mutton Rogan Josh",
    subtitle: "Slow-braised Kashmiri aromatic mutton curry",
    price: 420,
  },
];

// Exact ordered IDs for the 3 primary showcase rows in the reference image
export const BESTSELLER_SHOWCASE_IDS = ["M22", "M1", "M14", "M16", "M29", "M32"];
export const STARTERS_SHOWCASE_IDS = ["M8", "M5", "M7", "M3", "M4", "M2"];
export const MAIN_COURSE_SHOWCASE_IDS = ["M19", "M18", "M15", "M17", "M20", "M21"];

export interface PosDietaryFilters {
  dietary: "all" | "veg" | "non-veg";
  jainOnly: boolean;
  glutenFreeOnly: boolean;
  availableOnly: boolean;
  stationFilter: "all" | Station;
}

export function matchesPosFilters(
  item: MenuItem,
  searchQuery: string,
  filters: PosDietaryFilters,
): boolean {
  if (filters.availableOnly && !item.available) return false;
  if (filters.dietary === "veg" && !item.veg) return false;
  if (filters.dietary === "non-veg" && item.veg) return false;
  if (filters.jainOnly && !item.jain) return false;
  if (filters.glutenFreeOnly && !item.glutenFree) return false;
  if (filters.stationFilter !== "all" && item.station !== filters.stationFilter) return false;

  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  return (
    item.name.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q) ||
    item.station.toLowerCase().includes(q)
  );
}

export function getItemsForPosCategory(categoryId: string, menu: MenuItem[]): MenuItem[] {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const pickByIds = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((x): x is MenuItem => Boolean(x));

  switch (categoryId) {
    case "Bestsellers": {
      const topSix = pickByIds(BESTSELLER_SHOWCASE_IDS);
      const rest = menu.filter((m) => m.bestseller && !BESTSELLER_SHOWCASE_IDS.includes(m.id));
      return [...topSix, ...rest];
    }
    case "Starters": {
      const topSix = pickByIds(STARTERS_SHOWCASE_IDS);
      const rest = menu.filter(
        (m) => m.category === "Starters" && !STARTERS_SHOWCASE_IDS.includes(m.id),
      );
      return [...topSix, ...rest];
    }
    case "Main Course": {
      const topSix = pickByIds(MAIN_COURSE_SHOWCASE_IDS);
      const rest = menu.filter(
        (m) => m.category === "Curries" && !MAIN_COURSE_SHOWCASE_IDS.includes(m.id),
      );
      return [...topSix, ...rest];
    }
    case "Soups":
      return menu
        .filter(
          (m) =>
            m.name.toLowerCase().includes("dal") ||
            m.name.toLowerCase().includes("salan") ||
            m.category === "Starters",
        )
        .slice(0, 6);
    case "Biryani & Rice":
      return menu.filter((m) => m.category === "Biryani");
    case "Indian Breads":
      return menu.filter((m) => m.category === "Breads");
    case "Chinese":
      return menu.filter(
        (m) =>
          m.name.toLowerCase().includes("manchurian") ||
          m.name.toLowerCase().includes("chilli") ||
          m.name.toLowerCase().includes("65") ||
          m.category === "Starters",
      );
    case "Continental":
      return menu.filter(
        (m) =>
          m.name.toLowerCase().includes("dosa") ||
          m.name.toLowerCase().includes("fish") ||
          m.name.toLowerCase().includes("malai") ||
          m.category === "Breads",
      );
    case "Tandoor":
      return menu.filter((m) => m.category === "Tandoor" || m.station === "Tandoor");
    case "Beverages":
      return menu.filter((m) => m.category === "Beverages");
    case "Desserts":
      return menu.filter((m) => m.category === "Desserts");
    default:
      return menu.filter((m) => m.category === categoryId);
  }
}

export function filterCombosForPos(
  combos: ComboItem[],
  searchQuery: string,
  filters: PosDietaryFilters,
): ComboItem[] {
  return combos.filter((c) => {
    if (filters.availableOnly && !c.available) return false;
    if (filters.dietary === "veg" && !c.veg) return false;
    if (filters.dietary === "non-veg" && c.veg) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });
}
