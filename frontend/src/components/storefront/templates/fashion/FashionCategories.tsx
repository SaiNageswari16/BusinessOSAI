import React from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ChevronRight, ArrowUpRight } from "lucide-react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { cn } from "@/lib/utils";
import { DynamicStoreCategoriesProps } from "@/components/storefront/organic/OrganicCategories";

const FALLBACK_FASHION_IMAGE = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80";

export function FashionCategories({
  categories = [],
  onSelectCategory,
  className,
  title = "Curated Lookbooks & Collections",
  subtitle = "Runway-inspired apparel, designer tailoring, signature footwear, and haute accessories",
  isLoading = false,
}: DynamicStoreCategoriesProps) {
  const { theme } = useStoreTheme();
  const primaryColor = theme.primaryColor || "#18181B";
  const accentColor = theme.accentColor || "#E11D48";

  if (isLoading) {
    return (
      <section className={cn("py-12 bg-[#FAFAFA] border-b border-zinc-200", className)} aria-label="Loading fashion collections">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-8 w-60 bg-zinc-200 animate-pulse rounded mb-2" />
          <div className="h-4 w-72 bg-zinc-100 animate-pulse rounded mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-zinc-200 animate-pulse" />
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
    <section id="categories-section" className={cn("py-14 bg-gradient-to-b from-[#FAFAFA] via-white to-[#FAFAFA] border-b border-zinc-200", className)} aria-label="Fashion collections and categories">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-9">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-300 text-[11px] font-bold text-zinc-800 tracking-wider uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>Autumn / Winter Lookbook</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 font-serif tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-zinc-500 mt-1 max-w-xl">{subtitle}</p>}
          </div>

          <Link
            to="/store/shop"
            className="text-xs font-bold text-zinc-900 hover:text-rose-600 transition-colors flex items-center gap-1.5 self-start sm:self-auto py-1.5 px-4 rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 shadow-2xs group uppercase tracking-wider"
          >
            <span>View All Lines</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Editorial Image-Led Category Tiles (Aspect 3:4) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {categories.map((cat) => {
            const itemCountText = typeof cat.itemCount === "number" ? `${cat.itemCount} Designs` : "Shop Line";
            const imageUrl = cat.image || FALLBACK_FASHION_IMAGE;

            return (
              <button
                key={cat.id || cat.name}
                type="button"
                onClick={() => onSelectCategory?.(cat)}
                aria-label={`Explore ${cat.name} fashion collection`}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/80 shadow-xs hover:shadow-xl transition-all duration-500 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 text-left"
              >
                {/* Full-Bleed Editorial Background Image */}
                <img
                  src={imageUrl}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_FASHION_IMAGE;
                  }}
                />

                {/* Dark Editorial Gradient Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent group-hover:from-black/95 transition-all duration-300" />

                {/* Floating Top Arrow Badge */}
                <div className="absolute top-2.5 right-2.5 size-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 shadow-xs">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>

                {/* Bottom Content Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-3.5 flex flex-col justify-end text-white z-10">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-rose-300/90 mb-0.5">
                    {itemCountText}
                  </span>
                  <h3
                    className="font-serif font-black text-sm text-white leading-snug line-clamp-2 group-hover:text-rose-200 transition-colors"
                    title={cat.name}
                  >
                    {cat.name}
                  </h3>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
