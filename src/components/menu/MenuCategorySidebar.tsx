import { BookOpen, FolderPlus, LayoutGrid } from "lucide-react";

import { MENU_SIDEBAR_CATEGORIES } from "@/components/menu/menu-utils";
import { cn } from "@/lib/utils";

interface MenuCategorySidebarProps {
  activeCategory: string;
  totalItemsCount: number;
  combosCount: number;
  customCategories: string[];
  onSelectCategory: (categoryId: string) => void;
  onOpenManageCategories: () => void;
}

export function MenuCategorySidebar({
  activeCategory,
  totalItemsCount,
  combosCount,
  customCategories,
  onSelectCategory,
  onOpenManageCategories,
}: MenuCategorySidebarProps) {
  const allActive = activeCategory === "all";
  const customActive = activeCategory === "Custom Categories";

  return (
    <aside className="flex w-full shrink-0 flex-col justify-between rounded-2xl border border-[#E1E9F4] bg-white p-2.5 shadow-2xs lg:w-[228px] xl:w-[238px]">
      <div className="space-y-1">
        {/* All Items Row */}
        <button
          type="button"
          onClick={() => onSelectCategory("all")}
          className={cn(
            "relative flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all",
            allActive
              ? "bg-[#EDF4FF] text-[#0866F5] shadow-2xs before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-[#0866F5]"
              : "text-[#1E293B] hover:bg-[#F8FAFC]",
          )}
        >
          <span className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg border",
                allActive
                  ? "border-[#BFDBFE] bg-white text-[#0866F5]"
                  : "border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]",
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
            </span>
            <span
              className={cn(
                "text-[13px] font-extrabold",
                allActive ? "text-[#0866F5]" : "text-[#102344]",
              )}
            >
              All Items
            </span>
          </span>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-extrabold tabular",
              allActive
                ? "bg-[#DCEAFF] text-[#0866F5]"
                : "bg-[#F1F5F9] text-[#475569]",
            )}
          >
            {totalItemsCount}
          </span>
        </button>

        {/* 12 Standard Categories */}
        {MENU_SIDEBAR_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          const badgeVal = cat.id === "Combos" ? combosCount : cat.displayCount;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                "relative flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all",
                active
                  ? "bg-[#EDF4FF] text-[#0866F5] shadow-2xs before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-[#0866F5]"
                  : "text-[#1E293B] hover:bg-[#F8FAFC]",
              )}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]",
                    cat.iconBg,
                    cat.iconColor,
                  )}
                >
                  {cat.emoji}
                </span>
                <span
                  className={cn(
                    "truncate text-[13px] font-bold",
                    active ? "text-[#0866F5] font-extrabold" : "text-[#1E293B]",
                  )}
                >
                  {cat.label}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tabular",
                  active
                    ? "bg-[#DCEAFF] text-[#0866F5] font-extrabold"
                    : "bg-[#F1F5F9] text-[#475569]",
                )}
              >
                {badgeVal}
              </span>
            </button>
          );
        })}

        {/* Custom Categories Row */}
        <button
          type="button"
          onClick={() => onSelectCategory("Custom Categories")}
          className={cn(
            "relative flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all",
            customActive
              ? "bg-[#EDF4FF] text-[#0866F5] shadow-2xs before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-[#0866F5]"
              : "text-[#1E293B] hover:bg-[#F8FAFC]",
          )}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#D8E3F2] bg-[#F8FAFC] text-[#1E293B]">
              <LayoutGrid className="h-3.5 w-3.5" />
            </span>
            <span
              className={cn(
                "truncate text-[12.5px] font-bold",
                customActive ? "text-[#0866F5] font-extrabold" : "text-[#1E293B]",
              )}
            >
              Custom Categories
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tabular",
              customActive
                ? "bg-[#DCEAFF] text-[#0866F5] font-extrabold"
                : "bg-[#F1F5F9] text-[#475569]",
            )}
          >
            {customCategories.length}
          </span>
        </button>
      </div>

      {/* Manage Categories Button */}
      <div className="mt-3 border-t border-[#EEF3F9] pt-2.5">
        <button
          type="button"
          onClick={onOpenManageCategories}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D5E0EE] bg-white px-3 py-2.5 text-[12.5px] font-extrabold text-[#102344] shadow-2xs transition-colors hover:border-blue-300 hover:bg-[#F8FAFC]"
        >
          <FolderPlus className="h-4 w-4 text-[#1E293B]" />
          <span>Manage Categories</span>
        </button>
      </div>
    </aside>
  );
}
