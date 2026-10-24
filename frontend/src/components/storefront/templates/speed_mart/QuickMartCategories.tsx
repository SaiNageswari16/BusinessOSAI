import React from "react";
import { Link } from "@tanstack/react-router";
import { Zap, ChevronRight, Clock } from "lucide-react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { cn } from "@/lib/utils";
import { DynamicStoreCategoriesProps } from "@/components/storefront/organic/OrganicCategories";

const FALLBACK_QUICKMART_IMAGE = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&q=80";

export function QuickMartCategories({
  categories = [],
  onSelectCategory,
  className,
  title = "Explore By Category",
  subtitle = "Instant essentials, fresh snacks & drinks delivered in 10 minutes",
  isLoading = false,
}: DynamicStoreCategoriesProps) {
  const { theme } = useStoreTheme();
  const primaryColor = theme.primaryColor || "#7C3AED";
  const accentColor = theme.accentColor || "#F59E0B";

  if (isLoading) {
    return (
      <section className={cn("py-8 bg-[#FDF4FF]/60 border-b border-purple-100/60", className)} aria-label="Loading quick categories">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-6 w-48 bg-purple-200/50 animate-pulse rounded-md mb-6" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 rounded-2xl bg-white border border-purple-100 flex flex-col items-center">
                <div className="size-14 rounded-full bg-purple-100 animate-pulse mb-2" />
                <div className="h-3 w-14 bg-purple-200/50 animate-pulse rounded" />
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
    <section id="categories-section" className={cn("py-8 bg-gradient-to-b from-[#FDF4FF]/90 via-white to-[#FDF4FF]/60 border-b border-purple-100/70", className)} aria-label="Quick commerce categories">
      <div className="max-w-7xl mx-auto px-4">
        {/* QuickMart Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                  {title}
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  <Clock className="w-2.5 h-2.5" /> 10-Min Fast Drop
                </span>
              </div>
              {subtitle && <p className="text-[11px] text-gray-500 line-clamp-1">{subtitle}</p>}
            </div>
          </div>

          <Link
            to="/store/shop"
            className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 shrink-0"
          >
            See All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* High-Density Compact Category Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 sm:gap-3">
          {categories.map((cat) => {
            const itemCountText = typeof cat.itemCount === "number" ? `${cat.itemCount} items` : "";
            const imageUrl = cat.image || FALLBACK_QUICKMART_IMAGE;

            return (
              <button
                key={cat.id || cat.name}
                type="button"
                onClick={() => onSelectCategory?.(cat)}
                aria-label={`Order from ${cat.name}`}
                className="group flex flex-col items-center text-center p-2.5 sm:p-3 rounded-2xl bg-white border border-purple-100/70 hover:border-purple-400 hover:shadow-md hover:shadow-purple-100 transition-all duration-150 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 active:scale-95"
              >
                <div className="size-14 sm:size-16 rounded-2xl overflow-hidden bg-purple-50/60 mb-2 border border-purple-100 group-hover:scale-105 transition-transform duration-200">
                  <img
                    src={imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_QUICKMART_IMAGE;
                    }}
                  />
                </div>
                <span
                  className="font-bold text-[11px] text-gray-800 group-hover:text-purple-700 transition-colors line-clamp-1 max-w-full"
                  title={cat.name}
                >
                  {cat.name}
                </span>
                {itemCountText && (
                  <span className="text-[9px] text-gray-400 font-medium">
                    {itemCountText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
