import React from "react";
import { Link } from "@tanstack/react-router";
import { Sprout, ChevronRight, Leaf, Flower2 } from "lucide-react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { cn } from "@/lib/utils";
import { DynamicStoreCategoriesProps, StoreCategoryItem } from "@/components/storefront/organic/OrganicCategories";

const FALLBACK_NURSERY_IMAGE = "https://images.unsplash.com/photo-1545241047-6083a3684587?w=300&q=80";

export function NurseryCategories({
  categories = [],
  onSelectCategory,
  className,
  title = "Botanical Collections & Plant Care",
  subtitle = "Sustainably grown houseplants, handcrafted planters, and organic gardening essentials",
  isLoading = false,
}: DynamicStoreCategoriesProps) {
  const { theme } = useStoreTheme();
  const primaryColor = theme.primaryColor || "#1B4D3E";
  const accentColor = theme.accentColor || "#C25E3E";

  if (isLoading) {
    return (
      <section className={cn("py-12 bg-[#FAF8F5]/80 border-b border-[#E6E0D5]", className)} aria-label="Loading botanical categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-7 w-60 bg-[#E6E0D5] animate-pulse rounded-lg mb-2" />
          <div className="h-4 w-80 bg-[#F2ECE1] animate-pulse rounded mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-3xl bg-white border border-[#E6E0D5] flex flex-col items-center">
                <div className="size-20 rounded-full bg-[#E6E0D5] animate-pulse mb-3" />
                <div className="h-4 w-20 bg-[#E6E0D5] animate-pulse rounded mb-1" />
                <div className="h-3 w-12 bg-[#F2ECE1] animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section id="categories-section" className={cn("py-12 bg-gradient-to-b from-[#FAF8F5] via-[#F6F2EB] to-[#FAF8F5] border-b border-[#E6E0D5]", className)} aria-label="Botanical nursery categories">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Botanical Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F3EE] border border-[#C5E1D4] text-[11px] font-bold tracking-wide mb-2 text-[#1B4D3E]">
              <Sprout className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Certified Organic Nursery</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1B4D3E] font-serif tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-[#52796F] mt-1 max-w-xl">{subtitle}</p>}
          </div>

          <Link
            to="/store/shop"
            className="text-xs font-bold text-[#1B4D3E] hover:text-[#C25E3E] transition-colors flex items-center gap-1.5 self-start sm:self-auto py-1 px-3 rounded-full border border-[#D5CDC0] bg-white hover:bg-[#FAF8F5] shadow-2xs group"
          >
            <span>Explore All Botanicals</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Botanical Category Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((cat) => {
            const itemCountText = typeof cat.itemCount === "number" ? `${cat.itemCount} plants & pots` : "Explore";
            const imageUrl = cat.image || FALLBACK_NURSERY_IMAGE;

            return (
              <button
                key={cat.id || cat.name}
                type="button"
                onClick={() => onSelectCategory?.(cat)}
                aria-label={`Browse ${cat.name} plant category`}
                className="group relative flex flex-col items-center text-center p-4 rounded-3xl bg-white border border-[#E6E0D5] hover:border-[#C25E3E]/60 hover:shadow-lg hover:shadow-[#1B4D3E]/5 transition-all duration-300 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#1B4D3E] focus-visible:ring-offset-2"
              >
                {/* Image Frame with Botanical Leaf Accent */}
                <div className="relative size-20 sm:size-24 rounded-full overflow-hidden bg-[#E8F3EE] mb-3 border-2 border-[#D5CDC0] group-hover:border-[#C25E3E] group-hover:scale-105 transition-all duration-300 shadow-inner">
                  <img
                    src={imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_NURSERY_IMAGE;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Sprout Icon Pill */}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B4D3E] bg-[#E8F3EE] px-2 py-0.5 rounded-full mb-1 group-hover:bg-[#C25E3E]/10 group-hover:text-[#C25E3E] transition-colors">
                  <Leaf className="w-2.5 h-2.5" />
                  <span>Nursery</span>
                </span>

                <h3
                  className="font-serif font-bold text-xs text-[#1B4D3E] group-hover:text-[#C25E3E] transition-colors line-clamp-1"
                  title={cat.name}
                >
                  {cat.name}
                </h3>
                <span className="text-[10px] text-[#6E8A7D] font-medium mt-0.5">
                  {itemCountText}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
