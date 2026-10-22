import { Building2, LayoutGrid, Lock, RotateCcw, Umbrella } from "lucide-react";
import type { Area, DiningTable, TableStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type CapacityFilter, TABLE_STATUS_CONFIG } from "./operations-utils";

interface FloorFilterSidebarProps {
  tables: DiningTable[];
  selectedArea: "All" | Area;
  onSelectArea: (area: "All" | Area) => void;
  activeStatuses: Record<TableStatus, boolean>;
  onToggleStatus: (status: TableStatus) => void;
  capacityFilter: CapacityFilter;
  onSelectCapacity: (capacity: CapacityFilter) => void;
  onResetFilters: () => void;
}

const AREA_ITEMS: {
  value: "All" | Area;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "All", label: "All Areas", shortLabel: "All Areas", icon: LayoutGrid },
  { value: "Main Hall", label: "Main Hall", shortLabel: "Main Hall", icon: Building2 },
  { value: "Terrace", label: "Terrace", shortLabel: "Terrace", icon: Umbrella },
  { value: "Private Room", label: "Private Room", shortLabel: "Private Room", icon: Lock },
];

const STATUS_KEYS: TableStatus[] = ["available", "occupied", "reserved", "billing", "cleaning"];

const CAPACITY_OPTIONS: { value: CapacityFilter; label: string; title: string }[] = [
  { value: "all", label: "All", title: "All capacities" },
  { value: "2", label: "2", title: "2 seats" },
  { value: "4", label: "4", title: "4 seats" },
  { value: "6+", label: "6+", title: "6+ seats" },
];

export function FloorFilterSidebar({
  tables,
  selectedArea,
  onSelectArea,
  activeStatuses,
  onToggleStatus,
  capacityFilter,
  onSelectCapacity,
  onResetFilters,
}: FloorFilterSidebarProps) {
  const getAreaCount = (area: "All" | Area) =>
    area === "All" ? tables.length : tables.filter((t) => t.area === area).length;

  const areaFilteredTables =
    selectedArea === "All" ? tables : tables.filter((t) => t.area === selectedArea);

  const hasCustomFilter =
    selectedArea !== "All" ||
    capacityFilter !== "all" ||
    Object.values(activeStatuses).some((v) => !v);

  return (
    <aside className="flex flex-col gap-4 w-full lg:w-[220px] xl:w-[230px] shrink-0">
      {/* Dining Areas Card */}
      <div className="surface p-4">
        <h2 className="text-sm font-bold tracking-tight text-foreground mb-3">Dining Areas</h2>
        <div className="space-y-1.5" role="listbox" aria-label="Dining Areas">
          {AREA_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedArea === item.value;
            const count = getAreaCount(item.value);
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectArea(item.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-[#EBF3FF] text-[#1769E8] border-[#BFDBFE] font-semibold shadow-[0_1px_4px_rgba(23,105,232,0.1)] dark:bg-primary/20 dark:text-primary dark:border-primary/40"
                    : "border-transparent bg-muted/35 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isSelected ? "text-[#1769E8] dark:text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="truncate">{item.shortLabel}</span>
                </span>
                <span
                  className={cn(
                    "ml-2 text-xs font-bold tabular",
                    isSelected ? "text-[#1769E8] dark:text-primary" : "text-foreground/80",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Filters & Table Capacity Card */}
      <div className="surface p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold tracking-tight text-foreground">Quick Filters</h2>
            {hasCustomFilter && (
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {STATUS_KEYS.map((status) => {
              const cfg = TABLE_STATUS_CONFIG[status];
              const enabled = activeStatuses[status];
              const statusCount = areaFilteredTables.filter((t) => t.status === status).length;

              return (
                <button
                  key={status}
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => onToggleStatus(status)}
                  className="group flex w-full items-center justify-between py-0.5 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    {/* Colored Toggle Pill */}
                    <span
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200",
                        enabled ? cfg.toggleActiveBg : "bg-slate-200 dark:bg-slate-700",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-200",
                          enabled ? "translate-x-4" : "translate-x-0",
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium transition-colors",
                        enabled
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground line-through decoration-muted-foreground/50",
                      )}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground tabular">
                    {statusCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table Capacity Filter */}
        <div className="mt-6 pt-4 border-t border-border/70">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-bold tracking-tight text-foreground">Table Capacity</h2>
            <span className="text-[10px] text-muted-foreground font-medium">Seats</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Table Capacity">
            {CAPACITY_OPTIONS.map((opt) => {
              const active = capacityFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.title}
                  aria-label={opt.title}
                  aria-pressed={active}
                  onClick={() => onSelectCapacity(opt.value)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-all",
                    active
                      ? "bg-[#EBF3FF] text-[#1769E8] border-[#93C5FD] shadow-[0_1px_3px_rgba(23,105,232,0.12)] dark:bg-primary/20 dark:text-primary dark:border-primary/50"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
