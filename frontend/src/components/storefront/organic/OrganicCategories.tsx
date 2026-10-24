import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FolderTree } from "lucide-react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { cn } from "@/lib/utils";

export interface StoreCategoryItem {
  id: string;
  name: string;
  slug?: string;
  image?: string;
  itemCount?: number;
  description?: string;
  icon?: string;
}

export interface DynamicStoreCategoriesProps {
  categories: StoreCategoryItem[];
  onSelectCategory?: (category: StoreCategoryItem) => void;
  className?: string;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

const FALLBACK_CATEGORY_IMAGE = "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=300&q=80";

export function OrganicCategories({
  categories = [],
  onSelectCategory,
  className,
  title = "Categories & Departments",
  subtitle = "Explore our wide selection across fresh produce, pantry, and daily essentials",
  isLoading = false,
}: DynamicStoreCategoriesProps) {
  const { theme } = useStoreTheme();
  const primaryColor = theme.primaryColor || "#16A34A";

  if (isLoading) {
    return (
      <section className={cn("py-12 border-b border-gray-100", className)} aria-label="Loading categories">
        <div className="container mx-auto px-4">
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded-lg mb-2" />
          <div className="h-4 w-72 bg-gray-100 animate-pulse rounded-md mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-gray-100 flex flex-col items-center">
                <div className="size-16 sm:size-20 rounded-2xl bg-gray-200 animate-pulse mb-3" />
                <div className="h-4 w-20 bg-gray-200 animate-pulse rounded mb-1" />
                <div className="h-3 w-12 bg-gray-100 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <section className={cn("py-8 border-b border-gray-100", className)} aria-label="Empty categories">
        <div className="container mx-auto px-4 text-center py-8">
          <FolderTree className="size-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 font-medium">No store categories available at the moment.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="categories-section" className={cn("py-12 border-b border-gray-100", className)} aria-label="Store categories">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight font-sans">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <Link
            to="/store/shop"
            className="text-xs font-bold flex items-center gap-1 group transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 rounded-md"
            style={{ color: primaryColor }}
          >
            View All <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((cat) => {
            const itemCountText = typeof cat.itemCount === "number" ? `${cat.itemCount} items` : "Explore";
            const imageUrl = cat.image || FALLBACK_CATEGORY_IMAGE;

            return (
              <button
                key={cat.id || cat.name}
                type="button"
                onClick={() => onSelectCategory?.(cat)}
                aria-label={`Browse ${cat.name} category`}
                className="group flex flex-col items-center text-center p-4 rounded-2xl bg-white border border-gray-100 hover:shadow-md transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  ["--hover-border" as any]: `${primaryColor}66`,
                }}
              >
                <div className="size-16 sm:size-20 rounded-2xl overflow-hidden bg-gray-50 mb-3 border border-gray-100 group-hover:scale-105 transition-transform duration-300">
                  <img
                    src={imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_CATEGORY_IMAGE;
                    }}
                  />
                </div>
                <h3
                  className="font-bold text-xs text-gray-800 transition-colors line-clamp-1 group-hover:text-[var(--hover-color)]"
                  style={{ ["--hover-color" as any]: primaryColor }}
                  title={cat.name}
                >
                  {cat.name}
                </h3>
                <span className="text-[10px] text-gray-400 font-medium mt-0.5">
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
