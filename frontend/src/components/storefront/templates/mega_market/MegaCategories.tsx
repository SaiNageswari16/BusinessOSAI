import React from "react";
import { Link } from "@tanstack/react-router";
import { Laptop, ChevronRight, Layers, Cpu } from "lucide-react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { cn } from "@/lib/utils";
import { DynamicStoreCategoriesProps } from "@/components/storefront/organic/OrganicCategories";

const FALLBACK_MEGA_IMAGE = "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300&q=80";

export function MegaCategories({
  categories = [],
  onSelectCategory,
  className,
  title = "Shop Tech & Hardware Departments",
  subtitle = "High-performance computing, smart gadgets, audio hardware, and verified enterprise electronics",
  isLoading = false,
}: DynamicStoreCategoriesProps) {
  const { theme } = useStoreTheme();
  const primaryColor = theme.primaryColor || "#0F172A";
  const accentColor = theme.accentColor || "#2563EB";

  if (isLoading) {
    return (
      <section className={cn("py-12 bg-[#F8FAFC] border-b border-slate-200", className)} aria-label="Loading tech departments">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-7 w-64 bg-slate-200 animate-pulse rounded-lg mb-2" />
          <div className="h-4 w-80 bg-slate-100 animate-pulse rounded mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col items-center">
                <div className="size-20 rounded-xl bg-slate-100 animate-pulse mb-3" />
                <div className="h-4 w-20 bg-slate-200 animate-pulse rounded mb-1" />
                <div className="h-3 w-12 bg-slate-100 animate-pulse rounded" />
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
    <section id="categories-section" className={cn("py-12 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F8FAFC] border-b border-slate-200", className)} aria-label="Tech hypermarket departments">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Tech Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-800 tracking-wide mb-2">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span>Full Spec & Hardware Catalog</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-sans">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-slate-500 mt-1 max-w-xl">{subtitle}</p>}
          </div>

          <Link
            to="/store/shop"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1.5 self-start sm:self-auto py-1.5 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 shadow-2xs group"
          >
            <span>All Tech Categories</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((cat) => {
            const itemCountText = typeof cat.itemCount === "number" ? `${cat.itemCount} Products` : "Browse Specs";
            const imageUrl = cat.image || FALLBACK_MEGA_IMAGE;

            return (
              <button
                key={cat.id || cat.name}
                type="button"
                onClick={() => onSelectCategory?.(cat)}
                aria-label={`Browse ${cat.name} tech department`}
                className="group relative flex flex-col items-center text-center p-4 rounded-xl bg-white border border-slate-200/90 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {/* Image Frame with Tech Spec Badge */}
                <div className="relative size-18 sm:size-22 rounded-xl overflow-hidden bg-slate-50 mb-3 border border-slate-200 group-hover:scale-105 transition-transform duration-200">
                  <img
                    src={imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_MEGA_IMAGE;
                    }}
                  />
                  <div className="absolute top-1 left-1 size-5 rounded-md bg-slate-900/80 backdrop-blur-xs flex items-center justify-center text-white">
                    <Layers className="w-2.5 h-2.5" />
                  </div>
                </div>

                <h3
                  className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1"
                  title={cat.name}
                >
                  {cat.name}
                </h3>
                <span className="text-[10px] text-slate-500 font-semibold mt-0.5 bg-slate-100 px-2 py-0.5 rounded-md group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
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
