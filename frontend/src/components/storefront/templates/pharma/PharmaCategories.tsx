import React from "react";
import { Link } from "@tanstack/react-router";
import { Pill, ShieldCheck, ChevronRight, Activity } from "lucide-react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { cn } from "@/lib/utils";
import { DynamicStoreCategoriesProps } from "@/components/storefront/organic/OrganicCategories";

const FALLBACK_PHARMA_IMAGE = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&q=80";

export function PharmaCategories({
  categories = [],
  onSelectCategory,
  className,
  title = "Healthcare Departments & Pharmacy Categories",
  subtitle = "Genuine medicines, clinical supplements, ayurvedic care, and verified health devices",
  isLoading = false,
}: DynamicStoreCategoriesProps) {
  const { theme } = useStoreTheme();
  const primaryColor = theme.primaryColor || "#0284C7";
  const accentColor = theme.accentColor || "#0D9488";

  if (isLoading) {
    return (
      <section className={cn("py-12 bg-[#F0F9FF]/50 border-b border-sky-100", className)} aria-label="Loading healthcare categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-7 w-64 bg-sky-200/50 animate-pulse rounded-lg mb-2" />
          <div className="h-4 w-80 bg-sky-100 animate-pulse rounded mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-white border border-sky-100 flex flex-col items-center">
                <div className="size-16 rounded-xl bg-sky-100 animate-pulse mb-3" />
                <div className="h-4 w-20 bg-sky-200/50 animate-pulse rounded mb-1" />
                <div className="h-3 w-12 bg-sky-100 animate-pulse rounded" />
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
    <section id="categories-section" className={cn("py-12 bg-gradient-to-b from-[#F0F9FF]/80 via-white to-[#F0F9FF]/60 border-b border-sky-100", className)} aria-label="Pharmacy and medical categories">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Clinical Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 border border-sky-200 text-[11px] font-bold text-sky-800 tracking-wide mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>100% Certified Healthcare Formulations</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-sans">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-slate-600 mt-1 max-w-xl">{subtitle}</p>}
          </div>

          <Link
            to="/store/shop"
            className="text-xs font-bold text-sky-700 hover:text-sky-900 transition-colors flex items-center gap-1.5 self-start sm:self-auto py-1 px-3 rounded-md border border-sky-200 bg-white hover:bg-sky-50/80 shadow-2xs group"
          >
            <span>All Medical Categories</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((cat) => {
            const itemCountText = typeof cat.itemCount === "number" ? `${cat.itemCount} Formulations` : "Browse Rx";
            const imageUrl = cat.image || FALLBACK_PHARMA_IMAGE;

            return (
              <button
                key={cat.id || cat.name}
                type="button"
                onClick={() => onSelectCategory?.(cat)}
                aria-label={`Browse ${cat.name} pharmaceutical category`}
                className="group relative flex flex-col items-center text-center p-4 rounded-xl bg-white border border-sky-100/90 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-100 transition-all duration-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
              >
                {/* Image Container with Rx / Medical icon badge */}
                <div className="relative size-16 sm:size-20 rounded-xl overflow-hidden bg-sky-50 mb-3 border border-sky-100 group-hover:scale-105 transition-transform duration-200">
                  <img
                    src={imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_PHARMA_IMAGE;
                    }}
                  />
                  <div className="absolute top-1 right-1 size-5 rounded-full bg-white/90 shadow-2xs flex items-center justify-center text-sky-700">
                    <Pill className="w-2.5 h-2.5" />
                  </div>
                </div>

                <h3
                  className="font-bold text-xs text-slate-800 group-hover:text-sky-700 transition-colors line-clamp-1"
                  title={cat.name}
                >
                  {cat.name}
                </h3>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5 text-teal-600" />
                  <span>{itemCountText}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
