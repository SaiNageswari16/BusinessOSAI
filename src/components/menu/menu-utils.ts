import { getItemsForPosCategory } from "@/components/pos/pos-config";
import { ADDONS } from "@/lib/seed";
import type { Addon, Ingredient, MenuItem, Station } from "@/lib/types";

export interface MenuCategorySidebarItem {
  id: string;
  label: string;
  displayCount: number;
  iconBg: string;
  iconColor: string;
  emoji: string;
}

export const MENU_SIDEBAR_CATEGORIES: MenuCategorySidebarItem[] = [
  {
    id: "Bestsellers",
    label: "Bestsellers",
    displayCount: 8,
    iconBg: "bg-[#FFEAD5]",
    iconColor: "text-[#EA580C]",
    emoji: "🔥",
  },
  {
    id: "Starters",
    label: "Starters",
    displayCount: 12,
    iconBg: "bg-[#FEF0C7]",
    iconColor: "text-[#D97706]",
    emoji: "👑",
  },
  {
    id: "Soups",
    label: "Soups",
    displayCount: 6,
    iconBg: "bg-[#FEF0C7]",
    iconColor: "text-[#D97706]",
    emoji: "🍲",
  },
  {
    id: "Main Course",
    label: "Main Course",
    displayCount: 20,
    iconBg: "bg-[#FFEAD5]",
    iconColor: "text-[#EA580C]",
    emoji: "🍛",
  },
  {
    id: "Biryani & Rice",
    label: "Biryani & Rice",
    displayCount: 8,
    iconBg: "bg-[#FEF0C7]",
    iconColor: "text-[#D97706]",
    emoji: "🥘",
  },
  {
    id: "Indian Breads",
    label: "Indian Breads",
    displayCount: 10,
    iconBg: "bg-[#FEF0C7]",
    iconColor: "text-[#B45309]",
    emoji: "🫓",
  },
  {
    id: "Chinese",
    label: "Chinese",
    displayCount: 14,
    iconBg: "bg-[#FFE4E6]",
    iconColor: "text-[#E11D48]",
    emoji: "🥢",
  },
  {
    id: "Continental",
    label: "Continental",
    displayCount: 6,
    iconBg: "bg-[#FFEAD5]",
    iconColor: "text-[#D97706]",
    emoji: "🍝",
  },
  {
    id: "Tandoor",
    label: "Tandoor",
    displayCount: 8,
    iconBg: "bg-[#FFE4E6]",
    iconColor: "text-[#E11D48]",
    emoji: "🍢",
  },
  {
    id: "Beverages",
    label: "Beverages",
    displayCount: 18,
    iconBg: "bg-[#FEF0C7]",
    iconColor: "text-[#D97706]",
    emoji: "🥤",
  },
  {
    id: "Desserts",
    label: "Desserts",
    displayCount: 6,
    iconBg: "bg-[#FFEAD5]",
    iconColor: "text-[#EA580C]",
    emoji: "🍨",
  },
  {
    id: "Combos",
    label: "Combos",
    displayCount: 8,
    iconBg: "bg-[#FEF0C7]",
    iconColor: "text-[#D97706]",
    emoji: "🍱",
  },
];

// First 12 items displayed in the 4x3 grid of the reference image
export const MENU_GRID_SHOWCASE_IDS = [
  "M22", // Chicken Biryani (₹320)
  "M1", // Paneer Tikka (₹280)
  "M14", // Butter Chicken (₹340)
  "M16", // Dal Makhani (₹220)
  "M29", // Garlic Naan (₹60)
  "M32", // Masala Dosa (₹180)
  "M19", // Chicken Curry (₹300)
  "M18", // Kadai Paneer (₹280)
  "M17", // Mutton Rogan Josh (₹380)
  "M2", // Chilli Chicken (₹280)
  "M4", // Veg Manchurian (₹220)
  "M33", // Gulab Jamun (₹120)
];

export type MenuAvailabilityFilter = "all" | "available" | "unavailable";
export type MenuDietaryFilter = "all" | "veg" | "non-veg";
export type MenuSortOption =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "bestsellers";

export interface MenuFilterState {
  sidebarCategory: string; // "all" | categoryId | "custom"
  dropdownCategory: string; // "all" | category
  availability: MenuAvailabilityFilter;
  dietary: MenuDietaryFilter;
  searchQuery: string;
  sortBy: MenuSortOption;
}

export function getMenuDisplayName(item: MenuItem): string {
  if (item.id === "M22" && item.name === "Hyderabadi Chicken Biryani") {
    return "Chicken Biryani";
  }
  return item.name;
}

export function getMenuCategoryDisplay(item: MenuItem): string {
  switch (item.category) {
    case "Biryani":
      return "Biryani & Rice";
    case "Curries":
      return "Main Course";
    case "Breads":
      return "Indian Breads";
    default:
      return item.category;
  }
}

export function getMenuItemTypeDisplay(item: MenuItem): string {
  if (item.itemType) return item.itemType;
  switch (item.category) {
    case "Biryani":
    case "Biryani & Rice":
    case "Curries":
    case "Main Course":
      return "Main Course";
    case "Starters":
    case "Tandoor":
    case "Chinese":
      return "Starter / Appetizer";
    case "Breads":
    case "Indian Breads":
      return "Indian Bread";
    case "Desserts":
      return "Dessert";
    case "Beverages":
      return "Beverage";
    case "Soups":
      return "Soup";
    default:
      return "Main Course";
  }
}

export function getMenuPrepTimeMins(item: MenuItem): number {
  if (item.prepTimeMins && item.prepTimeMins > 0) return item.prepTimeMins;
  switch (item.category) {
    case "Biryani":
    case "Biryani & Rice":
      return 20;
    case "Curries":
    case "Main Course":
      return 18;
    case "Tandoor":
    case "Starters":
      return 15;
    case "Breads":
    case "Indian Breads":
      return 10;
    case "Desserts":
      return 8;
    case "Beverages":
      return 5;
    default:
      return 15;
  }
}

export function getMenuServingSize(item: MenuItem): string {
  if (item.servingSize) return item.servingSize;
  switch (item.category) {
    case "Biryani":
    case "Biryani & Rice":
      return "1 plate";
    case "Curries":
    case "Main Course":
      return "1 bowl (350g)";
    case "Starters":
    case "Tandoor":
      return "6 pieces";
    case "Breads":
    case "Indian Breads":
      return "1 piece";
    case "Desserts":
      return "2 pieces";
    case "Beverages":
      return "250 ml";
    default:
      return "1 plate";
  }
}

export function getMenuShortSubtitle(item: MenuItem): string {
  if (item.id === "M22") {
    return "Authentic dum biryani with tender chicken and aromatic spices.";
  }
  return item.description;
}

export function getMenuFullDescription(item: MenuItem): string {
  if (item.id === "M22") {
    return "Traditional Hyderabadi chicken biryani cooked with basmati rice, tender chicken, and a blend of aromatic spices, served with raita and salan.";
  }
  if (item.description.length > 65) return item.description;
  return `${item.description}. Prepared fresh to order at the ${item.station} station using authentic Sunrise Restaurant spices and chef-curated ingredients.`;
}

export function getMenuTags(item: MenuItem): string[] {
  if (item.tags && item.tags.length > 0) return item.tags;
  if (item.id === "M22") {
    return ["Biryani", "Spicy", "Bestseller", "Non-Veg", "Indian"];
  }
  const tags: string[] = [item.category];
  if (item.station === "Tandoor" || item.category === "Biryani" || item.category === "Curries") {
    tags.push("Spicy");
  }
  if (item.bestseller) {
    tags.push("Bestseller");
  }
  tags.push(item.veg ? "Veg" : "Non-Veg");
  tags.push("Indian");
  return tags;
}

export function getTagBadgeStyle(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower === "bestseller" || lower === "non-veg") {
    return "bg-[#FFE4E6] text-[#E11D48] border-[#FECDD3]";
  }
  if (lower === "spicy" || lower === "chef's pick") {
    return "bg-[#FFEDD5] text-[#EA580C] border-[#FED7AA]";
  }
  if (lower === "veg" || lower === "jain" || lower === "gluten-free") {
    return "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]";
  }
  return "bg-[#EBF3FF] text-[#0866F5] border-[#BFDBFE]";
}

export function getMenuModifiers(item: MenuItem): string[] {
  if (item.modifiers && item.modifiers.length > 0) return item.modifiers;
  if (item.category === "Beverages" || item.category === "Desserts") {
    return ["Less Sugar", "Chilled", "Room Temp"];
  }
  return ["Medium Spicy", "Less spicy", "No Onion"];
}

export function getMenuAddons(item: MenuItem): Addon[] {
  if (item.addons && item.addons.length > 0) return item.addons;
  return ADDONS;
}

export function calculateRecipeCost(
  item: MenuItem,
  ingredients: Ingredient[],
): { cost: number; marginPct: number } {
  const cost = Math.round(
    item.recipe.reduce((sum, r) => {
      const ing = ingredients.find((i) => i.id === r.ingredientId);
      return sum + (ing ? ing.cost * r.qty : 0);
    }, 0),
  );
  const marginPct =
    item.price > 0 ? Math.max(0, Math.round(((item.price - cost) / item.price) * 100)) : 0;
  return { cost, marginPct };
}

export function filterAndSortMenuItems(
  menu: MenuItem[],
  state: MenuFilterState,
  customCategoryNames: string[] = [],
): MenuItem[] {
  // 1. Sidebar category selection
  let pool: MenuItem[];
  if (state.sidebarCategory === "all") {
    const byId = new Map(menu.map((m) => [m.id, m]));
    const showcase = MENU_GRID_SHOWCASE_IDS.map((id) => byId.get(id)).filter(
      (m): m is MenuItem => Boolean(m),
    );
    const showcaseSet = new Set(MENU_GRID_SHOWCASE_IDS);
    // Newly created items (ID > M43) appear right at the front or right after showcase
    const newItems = menu.filter(
      (m) => !showcaseSet.has(m.id) && (Number(m.id.replace(/\D/g, "")) || 0) > 43,
    );
    const rest = menu.filter(
      (m) => !showcaseSet.has(m.id) && (Number(m.id.replace(/\D/g, "")) || 0) <= 43,
    );
    pool = [...newItems, ...showcase, ...rest];
  } else if (state.sidebarCategory === "Custom Categories") {
    const customSet = new Set(customCategoryNames.map((c) => c.toLowerCase()));
    const matches = menu.filter((m) => customSet.has(m.category.toLowerCase()));
    pool = matches.length > 0 ? matches : menu.filter((m) => m.bestseller).slice(0, 6);
  } else if (state.sidebarCategory === "Combos") {
    pool = menu.filter((m) => m.bestseller);
  } else {
    pool = getItemsForPosCategory(state.sidebarCategory, menu);
  }

  // 2. Dropdown category filter
  if (state.dropdownCategory !== "all") {
    pool = pool.filter(
      (m) =>
        m.category.toLowerCase() === state.dropdownCategory.toLowerCase() ||
        getMenuCategoryDisplay(m).toLowerCase() === state.dropdownCategory.toLowerCase(),
    );
  }

  // 3. Availability filter
  if (state.availability === "available") {
    pool = pool.filter((m) => m.available);
  } else if (state.availability === "unavailable") {
    pool = pool.filter((m) => !m.available);
  }

  // 4. Dietary type filter
  if (state.dietary === "veg") {
    pool = pool.filter((m) => m.veg);
  } else if (state.dietary === "non-veg") {
    pool = pool.filter((m) => !m.veg);
  }

  // 5. Search query
  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    pool = pool.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        getMenuDisplayName(m).toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        getMenuCategoryDisplay(m).toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.station.toLowerCase().includes(q) ||
        getMenuTags(m).some((t) => t.toLowerCase().includes(q)),
    );
  }

  // 6. Sorting
  if (state.sortBy === "name-asc") {
    // When on "All Items" with no filters/search, keep the visual showcase order so the 12 hero cards match the reference
    const isDefaultShowcase =
      state.sidebarCategory === "all" &&
      state.dropdownCategory === "all" &&
      state.availability === "all" &&
      state.dietary === "all" &&
      !q;
    if (isDefaultShowcase) {
      return pool;
    }
    return [...pool].sort((a, b) =>
      getMenuDisplayName(a).localeCompare(getMenuDisplayName(b)),
    );
  }
  if (state.sortBy === "name-desc") {
    return [...pool].sort((a, b) =>
      getMenuDisplayName(b).localeCompare(getMenuDisplayName(a)),
    );
  }
  if (state.sortBy === "price-asc") {
    return [...pool].sort((a, b) => a.price - b.price);
  }
  if (state.sortBy === "price-desc") {
    return [...pool].sort((a, b) => b.price - a.price);
  }
  if (state.sortBy === "bestsellers") {
    return [...pool].sort((a, b) => Number(b.bestseller) - Number(a.bestseller));
  }

  return pool;
}

export interface MenuItemFormInput {
  id?: string | undefined;
  name: string;
  category: string;
  itemType: string;
  price: number;
  prepTimeMins: number;
  servingSize: string;
  veg: boolean;
  bestseller: boolean;
  available: boolean;
  station: Station;
  description: string;
  tags: string[];
  recipe: { ingredientId: string; qty: number }[];
}

export function validateMenuItemForm(input: {
  name: string;
  category: string;
  price: number;
  prepTimeMins: number;
  servingSize: string;
}): { ok: boolean; error?: string } {
  if (!input.name.trim()) {
    return { ok: false, error: "Item name is required." };
  }
  if (!input.category.trim()) {
    return { ok: false, error: "Category is required." };
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    return { ok: false, error: "Price must be greater than ₹0." };
  }
  if (!Number.isFinite(input.prepTimeMins) || input.prepTimeMins <= 0) {
    return { ok: false, error: "Preparation time must be at least 1 minute." };
  }
  if (!input.servingSize.trim()) {
    return { ok: false, error: "Serving size is required (e.g., 1 plate)." };
  }
  return { ok: true };
}

export function exportMenuToCsv(menu: MenuItem[]): string {
  const header = [
    "Item ID",
    "Name",
    "Category",
    "Type",
    "Price (INR)",
    "Station",
    "Prep Time (mins)",
    "Serving Size",
    "Bestseller",
    "Availability",
    "Description",
  ].join(",");

  const rows = menu.map((item) => {
    const safeName = `"${item.name.replace(/"/g, '""')}"`;
    const safeDesc = `"${item.description.replace(/"/g, '""')}"`;
    return [
      item.id,
      safeName,
      getMenuCategoryDisplay(item),
      item.veg ? "Veg" : "Non-Veg",
      item.price,
      item.station,
      getMenuPrepTimeMins(item),
      `"${getMenuServingSize(item)}"`,
      item.bestseller ? "Yes" : "No",
      item.available ? "Available" : "Sold Out",
      safeDesc,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
