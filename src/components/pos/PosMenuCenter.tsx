import {
  ArrowRight,
  ChevronDown,
  Filter,
  Heart,
  Plus,
  RotateCcw,
  Search,
  Wheat,
  X,
} from "lucide-react";

import {
  FEATURED_SPECIALS,
  filterCombosForPos,
  getItemsForPosCategory,
  matchesPosFilters,
  POS_CATEGORIES,
  type PosDietaryFilters,
} from "@/components/pos/pos-config";
import { inr } from "@/lib/calc";
import { getDishImage, posHeroBiryani } from "@/lib/images";
import type { ComboItem } from "@/lib/store";
import type { MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PosMenuCenterProps {
  menu: MenuItem[];
  combos: ComboItem[];
  activeCategory: string;
  focusedSingleCategory: boolean;
  featuredIndex: number;
  searchQuery: string;
  filters: PosDietaryFilters;
  favoriteIds: string[];
  cartQtyByItem: Map<string, number>;
  onChangeFeaturedIndex: (idx: number) => void;
  onChangeSearchQuery: (q: string) => void;
  onUpdateFilters: (patch: Partial<PosDietaryFilters>) => void;
  onResetFilters: () => void;
  onToggleFavorite: (itemId: string) => void;
  onQuickAdd: (item: MenuItem) => void;
  onOpenCustomize: (item: MenuItem) => void;
  onAddCombo: (combo: ComboItem) => void;
  onViewAllCategory: (categoryId: string) => void;
  onExitSingleCategory: () => void;
}

export function PosMenuCenter({
  menu,
  combos,
  activeCategory,
  focusedSingleCategory,
  featuredIndex,
  searchQuery,
  filters,
  favoriteIds,
  cartQtyByItem,
  onChangeFeaturedIndex,
  onChangeSearchQuery,
  onUpdateFilters,
  onResetFilters,
  onToggleFavorite,
  onQuickAdd,
  onOpenCustomize,
  onAddCombo,
  onViewAllCategory,
  onExitSingleCategory,
}: PosMenuCenterProps) {
  const currentFeatured =
    FEATURED_SPECIALS[featuredIndex % FEATURED_SPECIALS.length] ?? FEATURED_SPECIALS[0]!;
  const featuredMenuItem =
    menu.find((m) => m.id === currentFeatured.itemId) ??
    menu.find((m) => m.name.toLowerCase().includes("biryani")) ??
    menu[0];

  const hasActiveFilters =
    filters.dietary !== "all" ||
    filters.jainOnly ||
    filters.glutenFreeOnly ||
    filters.availableOnly ||
    filters.stationFilter !== "all" ||
    searchQuery.trim().length > 0;

  const renderDishCard = (item: MenuItem, isTopRankBadge = false) => {
    const inCartQty = cartQtyByItem.get(item.id) ?? 0;
    const isFav = favoriteIds.includes(item.id);
    const imgSrc = getDishImage(item.name, item.category);

    return (
      <div
        key={item.id}
        className={cn(
          "group flex flex-col rounded-xl border bg-white p-1.5 shadow-2xs transition-all",
          !item.available
            ? "border-slate-200 opacity-60"
            : inCartQty > 0
              ? "border-[#0866F5]/50 ring-1 ring-[#0866F5]/15"
              : "border-[#E1E9F4] hover:border-blue-300 hover:shadow-sm",
        )}
      >
        {/* Dish Image Box */}
        <div className="relative h-[78px] w-full overflow-hidden rounded-lg bg-slate-100">
          <img
            src={imgSrc}
            alt={item.name}
            loading="lazy"
            onClick={() => {
              if (item.available) onOpenCustomize(item);
            }}
            className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* In-Cart Quantity Indicator */}
          {inCartQty > 0 && (
            <span className="absolute left-1.5 top-1.5 rounded bg-[#0866F5] px-1.5 py-0.5 text-[9.5px] font-extrabold leading-none text-white shadow-xs tabular">
              {inCartQty}×
            </span>
          )}

          {/* Unavailable Overlay */}
          {!item.available && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">
                Sold Out
              </span>
            </div>
          )}

          {/* Top-Right #1 Badge or Favorite Heart Button */}
          {isTopRankBadge ? (
            <span className="absolute right-1.5 top-1.5 rounded bg-[#F59E0B] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-slate-950 shadow-xs">
              #1
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Favorite ${item.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item.id);
              }}
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-[2px] transition-colors hover:bg-black/55"
            >
              <Heart
                className={cn("h-3 w-3", isFav ? "fill-rose-500 text-rose-500" : "text-white")}
              />
            </button>
          )}
        </div>

        {/* Dish Details */}
        <div className="mt-1.5 flex flex-1 flex-col justify-between px-0.5">
          <div>
            <button
              type="button"
              disabled={!item.available}
              onClick={() => onOpenCustomize(item)}
              title={`${item.name} — Click to customize modifiers & add-ons`}
              className="line-clamp-2 min-h-[28px] text-left text-[11.5px] font-bold leading-[1.2] text-[#102344] transition-colors hover:text-[#0866F5]"
            >
              {item.name}
            </button>

            {/* Dietary Indicator */}
            <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium">
              {item.veg ? (
                <>
                  <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-[2px] border border-[#059669]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                  </span>
                  <span className="text-[#059669]">Veg</span>
                </>
              ) : (
                <>
                  <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-[2px] border border-[#DC2626]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                  </span>
                  <span className="text-[#DC2626]">Non-Veg</span>
                </>
              )}
            </div>
          </div>

          {/* Price & Quick Add Button */}
          <div className="mt-1.5 flex items-center justify-between pt-0.5">
            <span className="text-[12.5px] font-extrabold text-[#102344] tabular">
              {inr(item.price)}
            </span>
            <button
              type="button"
              disabled={!item.available}
              aria-label={`Add ${item.name}`}
              onClick={() => onQuickAdd(item)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0866F5] text-white shadow-2xs transition-transform hover:bg-[#0756D0] active:scale-95 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Multi-section overview vs single focused category / search mode
  const isOverviewMode =
    !focusedSingleCategory && activeCategory === "Bestsellers" && !searchQuery.trim();

  const overviewSectionDefs = POS_CATEGORIES.filter((c) => c.id !== "Combos");
  const filteredCombos = filterCombosForPos(combos, searchQuery, filters);

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3">
      {/* 1. Featured Dish Hero Banner ("Today's Special") */}
      <div className="relative h-[144px] w-full overflow-hidden rounded-2xl border border-[#3A1F10] bg-[#231007] shadow-xs">
        <img
          src={posHeroBiryani}
          alt={currentFeatured.title}
          className="h-full w-full object-cover object-left"
        />
        <div className="absolute inset-0 flex flex-col justify-between py-3 pr-5 pl-[38%] sm:pl-[42%]">
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-[#FBBF24]">
              {currentFeatured.tag}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 className="text-[16px] font-extrabold leading-tight text-white drop-shadow-xs xl:text-[18.5px]">
                {currentFeatured.title}
              </h2>
              <span className="rounded-md bg-[#F59E0B] px-2 py-0.5 text-[10px] font-extrabold text-[#1E1308] shadow-2xs">
                {currentFeatured.badge}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-[#E5D6C8]">
              {currentFeatured.subtitle}
            </p>
          </div>

          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[20px] font-extrabold leading-none text-white tabular">
                {inr(featuredMenuItem?.price ?? currentFeatured.price)}
              </div>
              {/* Carousel Dots */}
              <div className="mt-2 flex items-center gap-1.5">
                {FEATURED_SPECIALS.map((sp, idx) => {
                  const active = idx === featuredIndex % FEATURED_SPECIALS.length;
                  return (
                    <button
                      key={sp.itemId}
                      type="button"
                      aria-label={`View featured special ${sp.title}`}
                      onClick={() => onChangeFeaturedIndex(idx)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        active ? "w-3 bg-[#3B82F6]" : "w-1.5 bg-white/45 hover:bg-white/75",
                      )}
                    />
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (featuredMenuItem) onQuickAdd(featuredMenuItem);
              }}
              className="h-9 min-w-[92px] rounded-xl bg-[#0866F5] px-6 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-[#0756D0] active:scale-[0.98]"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* 2. Search & Dietary Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Search menu items, e.g., Biryani, Pasta, Coffee..."
            className="h-9 w-full rounded-xl border border-[#E1E9F4] bg-white pl-8 pr-7 text-[12px] text-[#102344] shadow-2xs placeholder:text-[#94A3B8] focus:border-[#0866F5] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChangeSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#102344]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Veg Toggle Pill */}
        <button
          type="button"
          onClick={() => onUpdateFilters({ dietary: filters.dietary === "veg" ? "all" : "veg" })}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[11.5px] font-semibold transition-all",
            filters.dietary === "veg"
              ? "border-[#059669] bg-[#ECFDF5] text-[#059669] shadow-2xs"
              : "border-[#E1E9F4] bg-white text-[#1E293B] hover:bg-slate-50",
          )}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-[#059669]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
          </span>
          <span>Veg</span>
        </button>

        {/* Non-Veg Toggle Pill */}
        <button
          type="button"
          onClick={() =>
            onUpdateFilters({ dietary: filters.dietary === "non-veg" ? "all" : "non-veg" })
          }
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[11.5px] font-semibold transition-all",
            filters.dietary === "non-veg"
              ? "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626] shadow-2xs"
              : "border-[#E1E9F4] bg-white text-[#1E293B] hover:bg-slate-50",
          )}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border border-[#DC2626]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
          </span>
          <span>Non-Veg</span>
        </button>

        {/* Jain Toggle Pill */}
        <button
          type="button"
          onClick={() => onUpdateFilters({ jainOnly: !filters.jainOnly })}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[11.5px] font-semibold transition-all",
            filters.jainOnly
              ? "border-[#0866F5] bg-[#EBF3FF] text-[#0866F5] shadow-2xs"
              : "border-[#E1E9F4] bg-white text-[#1E293B] hover:bg-slate-50",
          )}
        >
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full border",
              filters.jainOnly ? "border-[#0866F5] bg-[#0866F5]" : "border-[#0866F5]",
            )}
          />
          <span>Jain</span>
        </button>

        {/* Gluten Free Toggle Pill */}
        <button
          type="button"
          onClick={() => onUpdateFilters({ glutenFreeOnly: !filters.glutenFreeOnly })}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[11.5px] font-semibold transition-all",
            filters.glutenFreeOnly
              ? "border-[#D97706] bg-[#FFFBEB] text-[#B45309] shadow-2xs"
              : "border-[#E1E9F4] bg-white text-[#1E293B] hover:bg-slate-50",
          )}
        >
          <Wheat className="h-3.5 w-3.5 text-[#D97706]" />
          <span>Gluten Free</span>
          <ChevronDown className="h-3 w-3 text-[#64748B]" />
        </button>

        {/* Availability / Reset Filter Icon Button */}
        <button
          type="button"
          title={
            hasActiveFilters
              ? "Reset active filters"
              : filters.availableOnly
                ? "Showing available items only"
                : "Filter available items only"
          }
          onClick={() => {
            if (hasActiveFilters) {
              onResetFilters();
            } else {
              onUpdateFilters({ availableOnly: !filters.availableOnly });
            }
          }}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
            hasActiveFilters
              ? "border-[#0866F5] bg-[#EBF3FF] text-[#0866F5]"
              : "border-[#E1E9F4] bg-white text-[#475569] hover:bg-slate-50",
          )}
        >
          {hasActiveFilters ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <Filter className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* 3. Product Sections & Dish Cards */}
      {isOverviewMode ? (
        <div className="space-y-4">
          {overviewSectionDefs.map((catDef) => {
            const sectionItems = getItemsForPosCategory(catDef.id, menu).filter((it) =>
              matchesPosFilters(it, searchQuery, filters),
            );
            if (sectionItems.length === 0) return null;
            const visibleSlice = sectionItems.slice(0, 6);

            return (
              <div key={catDef.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px]">{catDef.emoji}</span>
                    <h3 className="text-[14px] font-extrabold text-[#102344]">{catDef.label}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewAllCategory(catDef.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0866F5] transition-colors hover:underline"
                  >
                    <span>View All</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                  {visibleSlice.map((item, idx) =>
                    renderDishCard(item, catDef.id === "Bestsellers" && idx === 0),
                  )}
                </div>
              </div>
            );
          })}

          {/* Combos Section at Bottom */}
          {filteredCombos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px]">🍱</span>
                  <h3 className="text-[14px] font-extrabold text-[#102344]">Combos</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onViewAllCategory("Combos")}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0866F5] hover:underline"
                >
                  <span>View All</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {filteredCombos.map((combo) => (
                  <div
                    key={combo.id}
                    className="flex flex-col justify-between rounded-xl border border-[#E1E9F4] bg-white p-3 shadow-2xs transition-all hover:border-blue-300"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          Save {inr(combo.regularPrice - combo.price)}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            combo.veg ? "text-[#059669]" : "text-[#DC2626]",
                          )}
                        >
                          {combo.veg ? "● Veg" : "● Non-Veg"}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[12px] font-bold text-[#102344]">
                        {combo.name}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10.5px] text-[#64748B]">
                        {combo.description}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                      <div>
                        <span className="text-[13px] font-extrabold text-[#102344] tabular">
                          {inr(combo.price)}
                        </span>
                        <span className="ml-1.5 text-[10.5px] text-[#94A3B8] line-through tabular">
                          {inr(combo.regularPrice)}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={!combo.available}
                        onClick={() => onAddCombo(combo)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0866F5] text-white hover:bg-[#0756D0] disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : activeCategory === "Combos" ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]">🍱</span>
              <h3 className="text-[14px] font-extrabold text-[#102344]">
                Value Combos ({filteredCombos.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={onExitSingleCategory}
              className="text-[11px] font-bold text-[#0866F5] hover:underline"
            >
              ← Back to All Sections
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredCombos.map((combo) => (
              <div
                key={combo.id}
                className="flex flex-col justify-between rounded-xl border border-[#E1E9F4] bg-white p-3.5 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Save {inr(combo.regularPrice - combo.price)}
                    </span>
                    <span
                      className={cn(
                        "text-[10.5px] font-bold",
                        combo.veg ? "text-[#059669]" : "text-[#DC2626]",
                      )}
                    >
                      {combo.veg ? "● Veg Combo" : "● Non-Veg Combo"}
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-[13px] font-bold text-[#102344]">{combo.name}</h4>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">{combo.description}</p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div>
                    <span className="text-[14px] font-extrabold text-[#102344] tabular">
                      {inr(combo.price)}
                    </span>
                    <span className="ml-1.5 text-[11px] text-[#94A3B8] line-through tabular">
                      {inr(combo.regularPrice)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!combo.available}
                    onClick={() => onAddCombo(combo)}
                    className="rounded-lg bg-[#0866F5] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#0756D0] disabled:opacity-40"
                  >
                    + Add Combo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        (() => {
          const baseItems = searchQuery.trim()
            ? menu
            : getItemsForPosCategory(activeCategory, menu);
          const matchingItems = baseItems.filter((it) =>
            matchesPosFilters(it, searchQuery, filters),
          );
          const catDef = POS_CATEGORIES.find((c) => c.id === activeCategory);

          return (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px]">{catDef?.emoji ?? "🍽️"}</span>
                  <h3 className="text-[14px] font-extrabold text-[#102344]">
                    {searchQuery.trim()
                      ? `Search Results (${matchingItems.length})`
                      : `${catDef?.label ?? activeCategory} (${matchingItems.length})`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onExitSingleCategory}
                  className="text-[11px] font-bold text-[#0866F5] hover:underline"
                >
                  ← Show All Sections
                </button>
              </div>

              {matchingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white py-12 text-center">
                  <p className="text-[13px] font-bold text-[#102344]">
                    No dishes match your active filters
                  </p>
                  <p className="mt-1 text-[11.5px] text-[#64748B]">
                    Try clearing search terms or dietary filters.
                  </p>
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="mt-3 rounded-lg bg-[#0866F5] px-3.5 py-1.5 text-[11.5px] font-bold text-white hover:bg-[#0756D0]"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                  {matchingItems.map((item, idx) =>
                    renderDishCard(item, activeCategory === "Bestsellers" && idx === 0),
                  )}
                </div>
              )}
            </div>
          );
        })()
      )}
    </section>
  );
}
