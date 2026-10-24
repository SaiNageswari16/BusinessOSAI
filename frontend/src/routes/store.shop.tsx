import React, { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search, SlidersHorizontal, ArrowUpDown, Grid, List,
  ChevronRight, Home, Filter, X, Check, Package, RotateCcw
} from "lucide-react";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { useCurrency } from "@/hooks/use-currency";
import { DynamicProductCard } from "@/components/storefront/UniversalTemplateRouter";
import {
  fetchStorefrontProducts,
  fetchStorefrontCategories,
  mapStorefrontToOrganic,
  StorefrontCategory
} from "@/lib/storefront-api";
import { organicProducts as fallbackProducts, organicCategories as fallbackCategories } from "@/data/mockOrganicData";
import { StoreNotFound } from "./store.index";
import { cn } from "@/lib/utils";

interface ShopSearchParams {
  category?: string;
  search?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
  store?: string;
}

export const Route = createFileRoute("/store/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearchParams => ({
    category: typeof search.category === "string" ? search.category : undefined,
    search: typeof search.search === "string" ? search.search : undefined,
    sort: typeof search.sort === "string" ? search.sort : undefined,
    minPrice: typeof search.minPrice === "number" ? search.minPrice : undefined,
    maxPrice: typeof search.maxPrice === "number" ? search.maxPrice : undefined,
    inStock: search.inStock === true || search.inStock === "true",
    page: typeof search.page === "number" ? search.page : 1,
    store: typeof search.store === "string" ? search.store : undefined,
  }),
  component: StoreShopPage,
});

function StoreShopPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { theme, branding, storeSlug, isStoreNotFound, getStoreUrl } = useStoreTheme();

  const effectiveSlug = searchParams.store || storeSlug || undefined;

  // Search and filter states initialized from URL
  const [searchInput, setSearchInput] = useState(searchParams.search || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.category || "All");
  const [selectedSort, setSelectedSort] = useState(searchParams.sort || "featured");
  const [priceRange, setPriceRange] = useState<number>(searchParams.maxPrice || 10000);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(searchParams.inStock || false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const currentPage = searchParams.page || 1;
  const pageSize = 24;

  // 1. Fetch Categories for the store
  const { data: dynamicCategories = [] } = useQuery({
    queryKey: ["storefront-categories-shop", effectiveSlug],
    queryFn: () => fetchStorefrontCategories(undefined, effectiveSlug),
    staleTime: 60000,
  });

  // 2. Fetch Products for the store
  const { data: dynamicProductsData, isLoading, isError } = useQuery({
    queryKey: ["storefront-products-shop", effectiveSlug, selectedCategory, searchParams.search, currentPage],
    queryFn: () =>
      fetchStorefrontProducts(
        selectedCategory === "All" ? undefined : selectedCategory,
        searchParams.search,
        undefined,
        currentPage,
        pageSize,
        effectiveSlug
      ),
    staleTime: 60000,
  });

  if (isStoreNotFound) {
    return <StoreNotFound slug={effectiveSlug} />;
  }

  // Derive products list with fallback
  const rawItems = dynamicProductsData?.items || [];
  const mappedLive = rawItems.map((p, i) => mapStorefrontToOrganic(p, i));
  const baseProducts = mappedLive.length > 0 ? mappedLive : (rawItems.length === 0 && !isLoading ? [] : fallbackProducts);

  // Apply client-side filters (Price range, stock, sorting)
  const filteredProducts = useMemo(() => {
    let list = [...baseProducts];

    if (onlyInStock) {
      list = list.filter((p) => p.inStock);
    }

    if (priceRange < 10000) {
      list = list.filter((p) => p.price <= priceRange);
    }

    // Sort
    if (selectedSort === "price-low") {
      list.sort((a, b) => a.price - b.price);
    } else if (selectedSort === "price-high") {
      list.sort((a, b) => b.price - a.price);
    } else if (selectedSort === "rating") {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (selectedSort === "newest") {
      list.reverse();
    }

    return list;
  }, [baseProducts, onlyInStock, priceRange, selectedSort]);

  // Categories list
  const categoryOptions = useMemo(() => {
    if (dynamicCategories.length > 0) {
      return [
        { id: "all", name: "All", itemCount: dynamicProductsData?.total || baseProducts.length },
        ...dynamicCategories.map((c) => ({
          id: c.id,
          name: c.name,
          itemCount: c.item_count || baseProducts.filter((p) => p.category?.toLowerCase() === c.name.toLowerCase()).length,
        })),
      ];
    }
    return [
      { id: "all", name: "All", itemCount: fallbackProducts.length },
      ...fallbackCategories.map((c) => ({
        id: c.id,
        name: c.name,
        itemCount: c.itemCount,
      })),
    ];
  }, [dynamicCategories, dynamicProductsData, baseProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/store/shop",
      search: (prev: any) => ({
        ...prev,
        search: searchInput.trim() || undefined,
        page: 1,
        store: effectiveSlug,
      }),
    });
  };

  const handleCategoryClick = (catName: string) => {
    setSelectedCategory(catName);
    navigate({
      to: "/store/shop",
      search: (prev: any) => ({
        ...prev,
        category: catName === "All" ? undefined : catName,
        page: 1,
        store: effectiveSlug,
      }),
    });
  };

  const handleResetFilters = () => {
    setSelectedCategory("All");
    setSearchInput("");
    setPriceRange(10000);
    setOnlyInStock(false);
    setSelectedSort("featured");
    navigate({
      to: "/store/shop",
      search: () => ({
        store: effectiveSlug,
      }),
    });
  };

  const storeDisplayName = branding.storeName?.trim() || theme.name || "BusinessOS Store";
  const storeTagline = branding.tagline?.trim() || theme.tagline || "Hyperlocal Omnichannel Commerce";

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      {/* ── Breadcrumb Bar ── */}
      <div className="bg-white border-b border-gray-100 py-4 shadow-2xs">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Link
              to={getStoreUrl("") as any}
              className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            >
              <Home className="size-3.5" />
              <span>Home</span>
            </Link>
            <ChevronRight className="size-3 text-gray-400" />
            <span className="font-semibold text-gray-900">Shop Catalog</span>
            {selectedCategory !== "All" && (
              <>
                <ChevronRight className="size-3 text-gray-400" />
                <span
                  className="font-bold"
                  style={{ color: theme.primaryColor }}
                >
                  {selectedCategory}
                </span>
              </>
            )}
          </div>

          <div className="text-xs text-gray-400 hidden sm:block">
            Showing <span className="font-bold text-gray-800">{filteredProducts.length}</span> products
          </div>
        </div>
      </div>

      {/* ── Hero / Header Banner ── */}
      <div
        className="w-full py-10 px-4 mb-8 text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.primaryColor}dd 100%)`,
        }}
      >
        <div className="container mx-auto px-4 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-[11px] font-extrabold tracking-wide uppercase">
              <span>{theme.badgeText || "🛍️ Store Catalog"}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              {storeDisplayName}
            </h1>
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed font-medium">
              {storeTagline}
            </p>
          </div>

          {/* Quick Search in Hero */}
          <form
            onSubmit={handleSearchSubmit}
            className="w-full md:w-80 bg-white/95 rounded-2xl p-1.5 shadow-lg flex items-center gap-2"
          >
            <Search className="size-4 text-gray-400 ml-2.5 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search store inventory..."
              className="w-full bg-transparent text-xs text-gray-800 placeholder:text-gray-400 outline-none pr-2 py-1"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-xs shrink-0"
              style={{ backgroundColor: theme.primaryColor }}
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* Mobile Filter Toggle & Sort Toolbar */}
        <div className="lg:hidden flex items-center justify-between gap-3 mb-6 bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
          >
            <Filter className="size-4" /> Filters
          </button>

          <div className="flex items-center gap-2">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none text-gray-700"
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* ── Left Sidebar Filters ── */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
            {/* Categories filter box */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-bold text-sm text-gray-900 tracking-tight">Categories</h3>
                <span className="text-[10px] font-bold text-gray-400">
                  {categoryOptions.length} Types
                </span>
              </div>

              <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                {categoryOptions.map((cat) => {
                  const isActive = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryClick(cat.name)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer",
                        isActive
                          ? "font-bold shadow-2xs"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                      style={
                        isActive
                          ? {
                              backgroundColor: `${theme.primaryColor}15`,
                              color: theme.primaryColor,
                            }
                          : undefined
                      }
                    >
                      <span className="truncate">{cat.name}</span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                          isActive
                            ? "bg-white text-gray-800"
                            : "bg-gray-100 text-gray-400"
                        )}
                      >
                        {cat.itemCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price filter box */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="font-bold text-sm text-gray-900 tracking-tight">Price Range</h3>
                <span className="text-xs font-black" style={{ color: theme.primaryColor }}>
                  {currency.symbol}{priceRange.toLocaleString()}
                </span>
              </div>

              <div className="space-y-3">
                <input
                  type="range"
                  min="50"
                  max="10000"
                  step="50"
                  value={priceRange}
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                  style={{ accentColor: theme.primaryColor }}
                />
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-400">
                  <span>{currency.symbol}50</span>
                  <span>{currency.symbol}10,000+</span>
                </div>
              </div>
            </div>

            {/* Availability filter box */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-gray-900 tracking-tight pb-3 border-b border-gray-100">
                Availability
              </h3>
              <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="size-4 rounded border-gray-300 rounded-md"
                  style={{ accentColor: theme.primaryColor }}
                />
                <span>In Stock Items Only</span>
              </label>
            </div>

            {/* Reset filters action */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <RotateCcw className="size-3.5" /> Reset All Filters
            </button>
          </div>

          {/* ── Main Catalog Content ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Top Toolbar */}
            <div className="hidden lg:flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-gray-100 shadow-xs">
              <div className="text-xs font-bold text-gray-600">
                Found <span className="text-gray-900 font-extrabold">{filteredProducts.length}</span> items
                {selectedCategory !== "All" && ` in "${selectedCategory}"`}
              </div>

              <div className="flex items-center gap-4">
                {/* Sort selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400">Sort by:</span>
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 outline-none text-gray-800 cursor-pointer"
                  >
                    <option value="featured">Featured</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Top Rated</option>
                    <option value="newest">Newest Arrivals</option>
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors cursor-pointer",
                      viewMode === "grid" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-400 hover:text-gray-700"
                    )}
                    title="Grid View"
                  >
                    <Grid className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors cursor-pointer",
                      viewMode === "list" ? "bg-white text-gray-900 shadow-2xs" : "text-gray-400 hover:text-gray-700"
                    )}
                    title="List View"
                  >
                    <List className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Loading Skeleton */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
                    <div className="aspect-square bg-gray-100 rounded-xl" />
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredProducts.length === 0 && (
              <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center space-y-4 shadow-xs">
                <div className="size-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <Package className="size-8" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                  No matching products found
                </h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  We could not find any items matching your selected criteria. Try adjusting the category, price filter, or search term.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <RotateCcw className="size-3.5" /> Reset Filters
                </button>
              </div>
            )}

            {/* Products Grid */}
            {!isLoading && filteredProducts.length > 0 && (
              <div
                className={cn(
                  "grid gap-6",
                  viewMode === "grid"
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    : "grid-cols-1"
                )}
              >
                {filteredProducts.map((p) => (
                  <DynamicProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
