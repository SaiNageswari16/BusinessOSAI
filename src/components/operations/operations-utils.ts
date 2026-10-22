import type { Area, DiningTable, TableStatus } from "@/lib/types";

export type CapacityFilter = "all" | "2" | "4" | "6+";

export interface StatusVisualConfig {
  key: TableStatus;
  label: string;
  // KPI Card & Filter colors
  accentHex: string;
  kpiCardBg: string;
  kpiIconBg: string;
  kpiText: string;
  toggleActiveBg: string;
  // Floor-plan table marker colors
  markerSurface: string;
  markerBorder: string;
  markerGlow: string;
  chairFill: string;
  chairBorder: string;
  pillBg: string;
  pillText: string;
  dotColor: string;
  // Details panel badge
  badgeClasses: string;
}

export const TABLE_STATUS_CONFIG: Record<TableStatus, StatusVisualConfig> = {
  available: {
    key: "available",
    label: "Available",
    accentHex: "#10B981",
    kpiCardBg:
      "bg-gradient-to-br from-[#F2FDF9] to-[#E6FAF2] border-[#C6F6E2] dark:from-emerald-950/35 dark:to-emerald-900/20 dark:border-emerald-800/50",
    kpiIconBg: "bg-[#D1FAE5] text-[#059669] dark:bg-emerald-500/20 dark:text-emerald-300",
    kpiText: "text-[#059669] dark:text-emerald-400",
    toggleActiveBg: "bg-[#10B981]",
    markerSurface:
      "bg-gradient-to-b from-[#FFFFFF]/96 via-[#EEFCF6]/95 to-[#D1FAE5]/95 text-[#0F172A]",
    markerBorder: "border-[#34D399]",
    markerGlow: "shadow-[0_8px_24px_rgba(16,185,129,0.35),inset_0_2px_6px_rgba(255,255,255,0.95)]",
    chairFill: "bg-gradient-to-b from-[#A7F3D0] to-[#6EE7B7]",
    chairBorder: "border-[#059669]",
    pillBg: "bg-[#A7F3D0]/55 border border-[#34D399]/50",
    pillText: "text-[#047857]",
    dotColor: "bg-[#10B981]",
    badgeClasses:
      "bg-[#D1FAE5]/85 text-[#047857] border-[#6EE7B7] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40",
  },
  occupied: {
    key: "occupied",
    label: "Occupied",
    accentHex: "#2563EB",
    kpiCardBg:
      "bg-gradient-to-br from-[#F2F7FF] to-[#E6F0FF] border-[#C7DFFF] dark:from-blue-950/40 dark:to-blue-900/20 dark:border-blue-800/50",
    kpiIconBg: "bg-[#DBEAFE] text-[#2563EB] dark:bg-blue-500/20 dark:text-blue-300",
    kpiText: "text-[#2563EB] dark:text-blue-400",
    toggleActiveBg: "bg-[#2563EB]",
    markerSurface:
      "bg-gradient-to-b from-[#FFFFFF]/96 via-[#EEF6FF]/95 to-[#DBEAFE]/95 text-[#0F172A]",
    markerBorder: "border-[#60A5FA]",
    markerGlow: "shadow-[0_8px_24px_rgba(37,99,235,0.35),inset_0_2px_6px_rgba(255,255,255,0.95)]",
    chairFill: "bg-gradient-to-b from-[#93C5FD] to-[#60A5FA]",
    chairBorder: "border-[#1D4ED8]",
    pillBg: "bg-[#BFDBFE]/65 border border-[#60A5FA]/50",
    pillText: "text-[#1D4ED8]",
    dotColor: "bg-[#2563EB]",
    badgeClasses:
      "bg-[#DBEAFE]/90 text-[#1D4ED8] border-[#93C5FD] dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40",
  },
  reserved: {
    key: "reserved",
    label: "Reserved",
    accentHex: "#7C3AED",
    kpiCardBg:
      "bg-gradient-to-br from-[#F7F4FF] to-[#EFE9FF] border-[#DDD6FE] dark:from-violet-950/40 dark:to-violet-900/20 dark:border-violet-800/50",
    kpiIconBg: "bg-[#EDE9FE] text-[#7C3AED] dark:bg-violet-500/20 dark:text-violet-300",
    kpiText: "text-[#7C3AED] dark:text-violet-400",
    toggleActiveBg: "bg-[#7C3AED]",
    markerSurface:
      "bg-gradient-to-b from-[#FFFFFF]/96 via-[#F5F0FF]/95 to-[#E4DAFF]/95 text-[#0F172A]",
    markerBorder: "border-[#A78BFA]",
    markerGlow: "shadow-[0_8px_24px_rgba(124,58,237,0.35),inset_0_2px_6px_rgba(255,255,255,0.95)]",
    chairFill: "bg-gradient-to-b from-[#C4B5FD] to-[#A78BFA]",
    chairBorder: "border-[#6D28D9]",
    pillBg: "bg-[#DDD6FE]/75 border border-[#A78BFA]/60",
    pillText: "text-[#6D28D9]",
    dotColor: "bg-[#7C3AED]",
    badgeClasses:
      "bg-[#EDE9FE]/90 text-[#6D28D9] border-[#C4B5FD] dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/40",
  },
  billing: {
    key: "billing",
    label: "Billing",
    accentHex: "#F59E0B",
    kpiCardBg:
      "bg-gradient-to-br from-[#FFFDF5] to-[#FEF4D6] border-[#FDE68A] dark:from-amber-950/40 dark:to-amber-900/20 dark:border-amber-800/50",
    kpiIconBg: "bg-[#FEF3C7] text-[#D97706] dark:bg-amber-500/20 dark:text-amber-300",
    kpiText: "text-[#D97706] dark:text-amber-400",
    toggleActiveBg: "bg-[#F59E0B]",
    markerSurface:
      "bg-gradient-to-b from-[#FFFDF7]/97 via-[#FEF6DC]/95 to-[#FDE293]/95 text-[#0F172A]",
    markerBorder: "border-[#F59E0B]",
    markerGlow: "shadow-[0_10px_28px_rgba(245,158,11,0.45),inset_0_2px_6px_rgba(255,255,255,0.95)]",
    chairFill: "bg-gradient-to-b from-[#FCD34D] to-[#F59E0B]",
    chairBorder: "border-[#B45309]",
    pillBg: "bg-[#FDE68A]/75 border border-[#F59E0B]/50",
    pillText: "text-[#B45309]",
    dotColor: "bg-[#F59E0B]",
    badgeClasses:
      "bg-[#FEF3C7]/95 text-[#B45309] border-[#FCD34D] dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40",
  },
  cleaning: {
    key: "cleaning",
    label: "Cleaning",
    accentHex: "#64748B",
    kpiCardBg:
      "bg-gradient-to-br from-[#F9FAFC] to-[#EEF2F6] border-[#E2E8F0] dark:from-slate-900/50 dark:to-slate-800/30 dark:border-slate-700/60",
    kpiIconBg: "bg-[#E2E8F0] text-[#475569] dark:bg-slate-700/50 dark:text-slate-300",
    kpiText: "text-[#475569] dark:text-slate-300",
    toggleActiveBg: "bg-[#64748B]",
    markerSurface:
      "bg-gradient-to-b from-[#FFFFFF]/96 via-[#F1F5F9]/95 to-[#E2E8F0]/95 text-[#0F172A]",
    markerBorder: "border-[#94A3B8]",
    markerGlow: "shadow-[0_8px_20px_rgba(71,85,105,0.28),inset_0_2px_6px_rgba(255,255,255,0.95)]",
    chairFill: "bg-gradient-to-b from-[#CBD5E1] to-[#94A3B8]",
    chairBorder: "border-[#475569]",
    pillBg: "bg-[#E2E8F0]/80 border border-[#94A3B8]/50",
    pillText: "text-[#334155]",
    dotColor: "bg-[#64748B]",
    badgeClasses:
      "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  },
};

/**
 * Default normalized interior floor-plan coordinates for the seeded tables.
 */
export const DEFAULT_CANVAS_POSITIONS: Record<string, { x: number; y: number }> = {
  // Main Hall (T1–T12)
  T1: { x: 0.19, y: 0.27 },
  T2: { x: 0.39, y: 0.27 },
  T3: { x: 0.57, y: 0.27 },
  T4: { x: 0.74, y: 0.27 },
  T5: { x: 0.19, y: 0.52 },
  T6: { x: 0.39, y: 0.52 },
  T7: { x: 0.57, y: 0.52 },
  T8: { x: 0.74, y: 0.52 },
  T9: { x: 0.19, y: 0.76 },
  T10: { x: 0.39, y: 0.76 },
  T11: { x: 0.57, y: 0.76 },
  T12: { x: 0.74, y: 0.76 },

  // Terrace (R1–R2)
  R1: { x: 0.34, y: 0.48 },
  R2: { x: 0.66, y: 0.48 },

  // Private Room (P1–P2)
  P1: { x: 0.34, y: 0.5 },
  P2: { x: 0.66, y: 0.5 },
};

export const DEFAULT_TABLE_SHAPES: Record<string, "round" | "rect"> = {
  T1: "round",
  T2: "rect",
  T3: "round",
  T4: "rect",
  T5: "rect",
  T6: "rect",
  T7: "round",
  T8: "rect",
  T9: "round",
  T10: "rect",
  T11: "round",
  T12: "rect",
  R1: "round",
  R2: "rect",
  P1: "rect",
  P2: "rect",
};

export function isRawSeedCoordinate(table: DiningTable, allTables: DiningTable[]): boolean {
  const areaTables = allTables.filter((t) => t.area === table.area);
  return areaTables.some((t) => t.x === 0 || t.y === 0);
}

export function resolveTableCanvasPosition(
  table: DiningTable,
  allTables: DiningTable[],
): { x: number; y: number } {
  if (isRawSeedCoordinate(table, allTables)) {
    const fallback = DEFAULT_CANVAS_POSITIONS[table.id];
    if (fallback) return fallback;
    return {
      x: Math.max(0.15, Math.min(0.82, 0.19 + table.x * 0.72)),
      y: Math.max(0.22, Math.min(0.8, 0.27 + table.y * 0.68)),
    };
  }
  return {
    x: Math.max(0.06, Math.min(0.94, table.x)),
    y: Math.max(0.08, Math.min(0.92, table.y)),
  };
}

export function resolveTableShape(table: DiningTable, allTables: DiningTable[]): "round" | "rect" {
  if (isRawSeedCoordinate(table, allTables) && DEFAULT_TABLE_SHAPES[table.id]) {
    return DEFAULT_TABLE_SHAPES[table.id]!;
  }
  return table.shape;
}

export function materializeCanvasTables(tables: DiningTable[]): DiningTable[] {
  return tables.map((t) => {
    const pos = resolveTableCanvasPosition(t, tables);
    const shape = resolveTableShape(t, tables);
    return {
      ...t,
      x: pos.x,
      y: pos.y,
      shape,
      scale: t.scale ?? 1,
      rotation: t.rotation ?? 0,
    };
  });
}

// Custom uploaded floor-plan background storage (kept strictly separate from table positions)
const FLOOR_BG_STORAGE_KEY = "restaurantos_floor_backgrounds_v1";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export type FloorBackgroundMap = Partial<Record<Area, string>>;

export function loadCustomFloorBackgrounds(): FloorBackgroundMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FLOOR_BG_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FloorBackgroundMap;
  } catch {
    return {};
  }
}

export function saveCustomFloorBackground(area: Area, dataUrl: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = loadCustomFloorBackgrounds();
    const updated: FloorBackgroundMap = { ...current, [area]: dataUrl };
    window.localStorage.setItem(FLOOR_BG_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export function clearCustomFloorBackground(area: Area): FloorBackgroundMap {
  if (typeof window === "undefined") return {};
  try {
    const current = loadCustomFloorBackgrounds();
    delete current[area];
    window.localStorage.setItem(FLOOR_BG_STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch {
    return {};
  }
}

export function validateFloorPlanFile(file: File): { ok: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Unsupported file format. Please upload a PNG, JPG, WEBP, or SVG floor-plan image.",
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: "Floor-plan image exceeds the 4 MB size limit. Please choose a smaller image.",
    };
  }
  return { ok: true };
}
