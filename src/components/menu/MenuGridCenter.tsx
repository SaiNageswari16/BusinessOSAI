import {
  CheckCircle2,
  Copy,
  Heart,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import {
  getMenuCategoryDisplay,
  getMenuDisplayName,
  getMenuPrepTimeMins,
  getMenuServingSize,
  MENU_GRID_SHOWCASE_IDS,
  type MenuAvailabilityFilter,
  type MenuDietaryFilter,
  type MenuFilterState,
  type MenuSortOption,
} from "@/components/menu/menu-utils";
import { getDishImage } from "@/lib/images";
import type { MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MenuGridCenterProps {
  items: MenuItem[];
  totalMenuCount: number;
  selectedItemId: string;
  filterState: MenuFilterState;
  viewMode: "grid" | "list";
  favoriteIds: string[];
  categoryOptions: string[];
  onSelectItem: (item: MenuItem) => void;
  onUpdateFilter: (patch: Partial<MenuFilterState>) => void;
  onClearFilters: () => void;
  onChangeViewMode: (mode: "grid" | "list") => void;
  onToggleFavorite: (itemId: string) => void;
  onEditItem: (item: MenuItem) => void;
  onDuplicateItem: (item: MenuItem) => void;
  onDeleteItem: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
  onToggleBestseller: (item: MenuItem) => void;
}

export function MenuGridCenter({
  items,
  totalMenuCount,
  selectedItemId,
  filterState,
  viewMode,
  favoriteIds,
  categoryOptions,
  onSelectItem,
  onUpdateFilter,
  onClearFilters,
  onChangeViewMode,
  onToggleFavorite,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  onToggleAvailability,
  onToggleBestseller,
}: MenuGridCenterProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const sectionHeading =
    filterState.sidebarCategory === "all"
      ? `All Menu Items (${items.length === totalMenuCount ? totalMenuCount : items.length})`
      : `${filterState.sidebarCategory} (${items.length})`;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3">
      {/* 1. Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E1E9F4] bg-white p-2 shadow-2xs">
        {/* Search Input */}
        <div className="relative min-w-[210px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={filterState.searchQuery}
            onChange={(e) => onUpdateFilter({ searchQuery: e.target.value })}
            placeholder="Search menu items (e.g., Biryani, Paneer, Coffee...)"
            aria-label="Search menu items"
            className="h-10 w-full rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] pl-9 pr-3 text-[12.5px] font-medium text-[#102344] placeholder:text-[#64748B] focus:border-[#0866F5] focus:bg-white focus:outline-none"
          />
        </div>

        {/* Category Dropdown */}
        <label className="flex h-10 min-w-[126px] flex-col justify-center rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] px-2.5">
          <span className="text-[9.5px] font-semibold leading-none text-[#64748B]">Category</span>
          <select
            aria-label="Filter by category"
            value={filterState.dropdownCategory}
            onChange={(e) => onUpdateFilter({ dropdownCategory: e.target.value })}
            className="mt-0.5 bg-transparent text-[11.5px] font-extrabold text-[#102344] focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        {/* Availability Dropdown */}
        <label className="flex h-10 min-w-[96px] flex-col justify-center rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] px-2.5">
          <span className="text-[9.5px] font-semibold leading-none text-[#64748B]">
            Availability
          </span>
          <select
            aria-label="Filter by availability"
            value={filterState.availability}
            onChange={(e) =>
              onUpdateFilter({ availability: e.target.value as MenuAvailabilityFilter })
            }
            className="mt-0.5 bg-transparent text-[11.5px] font-extrabold text-[#102344] focus:outline-none"
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="unavailable">Sold Out</option>
          </select>
        </label>

        {/* Dietary Type Dropdown */}
        <label className="flex h-10 min-w-[82px] flex-col justify-center rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] px-2.5">
          <span className="text-[9.5px] font-semibold leading-none text-[#64748B]">Type</span>
          <select
            aria-label="Filter by item type"
            value={filterState.dietary}
            onChange={(e) => onUpdateFilter({ dietary: e.target.value as MenuDietaryFilter })}
            className="mt-0.5 bg-transparent text-[11.5px] font-extrabold text-[#102344] focus:outline-none"
          >
            <option value="all">All</option>
            <option value="veg">Veg</option>
            <option value="non-veg">Non-Veg</option>
          </select>
        </label>

        {/* Clear Button */}
        <button
          type="button"
          onClick={onClearFilters}
          className="h-10 rounded-xl border border-[#DCE6F2] bg-[#F4F7FC] px-3 text-[12px] font-extrabold text-[#102344] transition-colors hover:bg-[#EBF2FC]"
        >
          Clear
        </button>

        {/* Grid / List Toggle + Sort By */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] p-1">
          <button
            type="button"
            onClick={() => onChangeViewMode("grid")}
            aria-label="Grid view"
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11.5px] font-extrabold transition-all",
              viewMode === "grid"
                ? "border border-[#BFDBFE] bg-[#DCEAFF] text-[#0866F5]"
                : "text-[#475569] hover:bg-slate-100",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Grid</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("list")}
            aria-label="List view"
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-bold transition-all",
              viewMode === "list"
                ? "border border-[#BFDBFE] bg-[#DCEAFF] text-[#0866F5] font-extrabold"
                : "text-[#475569] hover:bg-slate-100",
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>

          <div className="h-5 w-px bg-[#DCE6F2]" />

          <label className="flex flex-col justify-center px-1.5">
            <span className="text-[9px] font-semibold leading-none text-[#64748B]">Sort By</span>
            <select
              aria-label="Sort menu items"
              value={filterState.sortBy}
              onChange={(e) => onUpdateFilter({ sortBy: e.target.value as MenuSortOption })}
              className="mt-0.5 bg-transparent text-[11px] font-extrabold text-[#102344] focus:outline-none"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-asc">Price: Low-High</option>
              <option value="price-desc">Price: High-Low</option>
              <option value="bestsellers">Bestsellers</option>
            </select>
          </label>
        </div>
      </div>

      {/* 2. Section Heading */}
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-[15.5px] font-extrabold tracking-tight text-[#102344]">
          {sectionHeading}
        </h2>
      </div>

      {/* 3. Menu Items Grid or List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white py-16 text-center">
          <p className="text-[14px] font-extrabold text-[#102344]">
            No menu items match the selected filters
          </p>
          <p className="mt-1 text-[12px] text-[#64748B]">
            Try clearing your search query or switching category and dietary filters.
          </p>
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 rounded-xl bg-[#0866F5] px-4 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#0756D0]"
          >
            Reset All Filters
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const displayName = getMenuDisplayName(item);
            const isSelected = selectedItemId === item.id;
            const isFav = favoriteIds.includes(item.id);
            const showBestsellerPill =
              item.id === "M22" ||
              (item.bestseller && !MENU_GRID_SHOWCASE_IDS.includes(item.id)) ||
              (filterState.sidebarCategory === "Bestsellers" && item.bestseller);
            const menuOpen = openMenuId === item.id;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setOpenMenuId(null);
                  onSelectItem(item);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectItem(item);
                  }
                }}
                className={cn(
                  "group relative flex flex-col rounded-2xl border bg-white p-2 text-left transition-all cursor-pointer",
                  isSelected
                    ? "border-[#0866F5] bg-[#FAFDFE] ring-2 ring-[#0866F5]/15 shadow-sm"
                    : "border-[#E1E9F4] shadow-2xs hover:border-[#BFD4F2] hover:shadow-sm",
                )}
              >
                {/* Dish Image Container */}
                <div className="relative h-[116px] w-full overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={getDishImage(item.name, item.category)}
                    alt={displayName}
                    loading="lazy"
                    className={cn(
                      "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                      !item.available && "grayscale opacity-75",
                    )}
                  />

                  {/* Top-left Bestseller Badge */}
                  {showBestsellerPill && (
                    <span className="absolute left-2 top-2 rounded-md bg-[#EF4444] px-2 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                      Bestseller
                    </span>
                  )}

                  {/* Top-right Favorite Heart */}
                  <button
                    type="button"
                    aria-label={isFav ? `Remove ${displayName} from favorites` : `Favorite ${displayName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item.id);
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-xs transition-colors hover:bg-black/55"
                  >
                    <Heart
                      className={cn(
                        "h-3.5 w-3.5",
                        isFav ? "fill-[#EF4444] text-[#EF4444]" : "text-white",
                      )}
                    />
                  </button>

                  {/* Bottom-right Availability Pill */}
                  <span
                    className={cn(
                      "absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-[10.5px] font-extrabold shadow-xs",
                      item.available
                        ? "border border-[#A7F3D0] bg-[#DCFCE7] text-[#059669]"
                        : "border border-[#FECACA] bg-[#FEE2E2] text-[#DC2626]",
                    )}
                  >
                    {item.available ? "Available" : "Sold Out"}
                  </span>
                </div>

                {/* Dish Title & Veg/Non-Veg Indicator */}
                <div className="mt-2 px-1">
                  <div className="truncate text-[13.5px] font-extrabold leading-snug text-[#102344]">
                    {displayName}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {item.veg ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#16A34A]">
                        <span className="flex h-3 w-3 items-center justify-center rounded-xs border border-[#16A34A]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                        </span>
                        Veg
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF1F2] px-1.5 py-0.5 text-[10px] font-bold text-[#E11D48]">
                        <span className="flex h-3 w-3 items-center justify-center rounded-xs border border-[#E11D48]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#E11D48]" />
                        </span>
                        Non-Veg
                      </span>
                    )}
                  </div>
                </div>

                {/* Price + Edit & More Actions Row */}
                <div className="mt-2 flex items-center justify-between border-t border-[#F1F5F9] px-1 pt-2">
                  <span className="text-[15px] font-extrabold text-[#102344] tabular">
                    ₹{item.price}
                  </span>

                  <div className="relative flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${displayName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem(item);
                        onEditItem(item);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE6F2] bg-[#F8FAFC] text-[#334155] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-[#0866F5]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      aria-label={`More actions for ${displayName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(menuOpen ? null : item.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE6F2] bg-[#F8FAFC] text-[#334155] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-[#0866F5]"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>

                    {/* Quick Action Popover */}
                    {menuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-8 right-0 z-30 w-44 rounded-xl border border-[#DCE6F2] bg-white p-1.5 shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onEditItem(item);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-[#1E293B] hover:bg-[#F1F5F9]"
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#0866F5]" />
                          Edit Item
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onDuplicateItem(item);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-[#1E293B] hover:bg-[#F1F5F9]"
                        >
                          <Copy className="h-3.5 w-3.5 text-[#475569]" />
                          Duplicate Item
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onToggleAvailability(item);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-[#1E293B] hover:bg-[#F1F5F9]"
                        >
                          {item.available ? (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-amber-600" />
                              Mark Sold Out
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Mark Available
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onToggleBestseller(item);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-[#1E293B] hover:bg-[#F1F5F9]"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                          {item.bestseller ? "Remove Bestseller" : "Mark Bestseller"}
                        </button>
                        <div className="my-1 h-px bg-[#EEF3F9]" />
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onDeleteItem(item);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-[#E11D48] hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Item
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="overflow-hidden rounded-2xl border border-[#E1E9F4] bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="border-b border-[#E2EBF6] bg-[#F8FAFC] text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
                <tr>
                  <th className="px-3.5 py-2.5">Item</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Prep / Portion</th>
                  <th className="px-3 py-2.5">Price</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3F9]">
                {items.map((item) => {
                  const displayName = getMenuDisplayName(item);
                  const isSelected = selectedItemId === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected ? "bg-[#EDF4FF]/70" : "hover:bg-[#F8FAFC]",
                      )}
                    >
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={getDishImage(item.name, item.category)}
                            alt={displayName}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 font-extrabold text-[#102344]">
                              <span>{displayName}</span>
                              {item.bestseller && (
                                <span className="rounded bg-[#EF4444] px-1.5 py-0.2 text-[9.5px] font-bold text-white">
                                  Bestseller
                                </span>
                              )}
                            </div>
                            <div className="max-w-[220px] truncate text-[11px] text-[#64748B]">
                              {item.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-[#334155]">
                        {getMenuCategoryDisplay(item)}
                      </td>
                      <td className="px-3 py-2.5">
                        {item.veg ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] font-bold text-[#16A34A]">
                            ● Veg
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF1F2] px-2 py-0.5 text-[10.5px] font-bold text-[#E11D48]">
                            ● Non-Veg
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] font-medium text-[#475569]">
                        {getMenuPrepTimeMins(item)} mins • {getMenuServingSize(item)}
                      </td>
                      <td className="px-3 py-2.5 font-extrabold text-[#102344] tabular">
                        ₹{item.price}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleAvailability(item);
                          }}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10.5px] font-extrabold",
                            item.available
                              ? "bg-[#DCFCE7] text-[#059669]"
                              : "bg-[#FEE2E2] text-[#DC2626]",
                          )}
                        >
                          {item.available ? "Available" : "Sold Out"}
                        </button>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${displayName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditItem(item);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE6F2] bg-white text-[#334155] hover:border-blue-300 hover:text-[#0866F5]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Duplicate ${displayName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateItem(item);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#DCE6F2] bg-white text-[#334155] hover:border-blue-300 hover:text-[#0866F5]"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${displayName}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteItem(item);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/60 text-[#E11D48] hover:bg-rose-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
