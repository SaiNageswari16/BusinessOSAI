import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, ChevronRight, LayoutGrid, List, SlidersHorizontal, Check, RefreshCw } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  organicProducts as fallbackProducts,
  organicCategories as fallbackCategories,
  OrganicProduct
} from "@/data/mockOrganicData";
import { OrganicProductCard } from "@/components/storefront/organic/OrganicProductCard";
import { fetchStorefrontProducts, fetchStorefrontCategories, mapStorefrontToOrganic } from "@/lib/storefront-api";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store/shop")({
  component: ShopPage,
});

function ShopPage() {
  const routerState = useRouterState();
  const searchParams = new URLSearchParams(routerState.location.searchStr);
  const initialCategory = searchParams.get("category") || "All";
  const initialFilter = searchParams.get("filter") || "";
  const initialSearch = searchParams.get("search") || "";

  const { currency } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedSort, setSelectedSort] = useState("featured");
  const [maxPrice, setMaxPrice] = useState<number>(50000);
  const [oemCertifiedOnly, setOemCertifiedOnly] = useState<boolean>(true);

  // Sync selected category if route query changes
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  // Fetch live products
  const { data: dynamicProductsData, isLoading: isProductsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ["storefront-products-shop", initialSearch],
    queryFn: () => fetchStorefrontProducts(undefined, initialSearch || undefined, undefined, 1, 100),
    staleTime: 30000,
  });

  // Fetch live categories
  const { data: dynamicCategoriesData } = useQuery({
    queryKey: ["storefront-categories-shop"],
    queryFn: () => fetchStorefrontCategories(),
    staleTime: 60000,
  });

  const allProducts: OrganicProduct[] = useMemo(() => {
    const liveItems = (dynamicProductsData?.items || []).map((p, i) => mapStorefrontToOrganic(p, i));
    return liveItems.length > 0 ? liveItems : fallbackProducts;
  }, [dynamicProductsData]);

  const categoriesList = useMemo(() => {
    if (dynamicCategoriesData && dynamicCategoriesData.length > 0) {
      return dynamicCategoriesData.map((c, i) => ({
        id: c.id,
        name: c.name,
        slug: c.name.toLowerCase().replace(/\s+/g, "-"),
        image: c.image_url || fallbackCategories[i % fallbackCategories.length]?.image || "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=100&q=80",
        itemCount: c.item_count || allProducts.filter(p => p.category?.toLowerCase() === c.name.toLowerCase()).length || 0,
      }));
    }
    // If no backend categories returned, derive from real inventory products
    if (allProducts.length > 0) {
      const distinctCats = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
      return distinctCats.map((cat, i) => ({
        id: `cat-${i}`,
        name: cat,
        slug: cat.toLowerCase().replace(/\s+/g, "-"),
        image: fallbackCategories[i % fallbackCategories.length]?.image || "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=100&q=80",
        itemCount: allProducts.filter(p => p.category === cat).length,
      }));
    }
    return fallbackCategories;
  }, [dynamicCategoriesData, allProducts]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      // Category filter
      if (selectedCategory !== "All" && product.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
        if (!product.category?.toLowerCase().includes(selectedCategory.toLowerCase())) {
          return false;
        }
      }
      // Query filter
      if (initialSearch && !product.name.toLowerCase().includes(initialSearch.toLowerCase()) && !product.category?.toLowerCase().includes(initialSearch.toLowerCase())) {
        return false;
      }
      // Promo filter
      if (initialFilter === "sale" && !product.discountBadge) return false;
      if (initialFilter === "combo" && !product.discountBadge?.includes("50")) return false;
      if (initialFilter === "coupons" && !product.discountBadge) return false;

      // Price filter
      if (product.price > maxPrice) return false;

      return true;
    }).sort((a, b) => {
      if (selectedSort === "price-low") return a.price - b.price;
      if (selectedSort === "price-high") return b.price - a.price;
      if (selectedSort === "rating") return b.rating - a.rating;
      return 0; // featured default
    });
  }, [allProducts, selectedCategory, initialSearch, initialFilter, maxPrice, selectedSort]);

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* ── Breadcrumb Banner ── */}
      <div className="bg-slate-50 py-10 mb-10 border-b border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 font-organic-heading mb-2">
            Commercial Equipment & Hardware Catalog
          </h1>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#2563EB] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#2563EB] font-bold">Shop All Equipment</span>
            {selectedCategory !== "All" && (
              <>
                <span>/</span>
                <span className="text-slate-800 font-semibold">{selectedCategory}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* ── Left Sidebar Filters ── */}
          <div className="lg:col-span-1 space-y-6">
            {/* Categories filter */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/70">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3.5 font-organic-heading">
                Categories
              </h3>
              <ul className="space-y-1 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("All")}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer",
                      selectedCategory === "All"
                        ? "bg-[#2563EB] text-white font-bold shadow-xs"
                        : "text-slate-700 hover:bg-white hover:text-[#2563EB]"
                    )}
                  >
                    <span>All Categories</span>
                    <span className={cn("text-[10px]", selectedCategory === "All" ? "text-white/80" : "text-slate-400")}>
                      ({allProducts.length})
                    </span>
                  </button>
                </li>
                {categoriesList.map((cat) => (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer",
                        selectedCategory.toLowerCase() === cat.name.toLowerCase()
                          ? "bg-[#2563EB] text-white font-bold shadow-xs"
                          : "text-slate-700 hover:bg-white hover:text-[#2563EB]"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <img src={cat.image} alt={cat.name} className="size-4 rounded-full object-cover" />
                        {cat.name}
                      </span>
                      <span className={cn("text-[10px]", selectedCategory.toLowerCase() === cat.name.toLowerCase() ? "text-white/80" : "text-slate-400")}>
                        ({cat.itemCount})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Filter */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/70">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 font-organic-heading flex justify-between items-center">
                <span>Filter by Price</span>
                <span className="text-[#2563EB] font-black">{currency.symbol}{maxPrice}</span>
              </h3>
              <input
                type="range"
                min="50"
                max="50000"
                step="50"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-medium mt-2">
                <span>{currency.symbol}50</span>
                <span>{currency.symbol}50,000</span>
              </div>
            </div>

            {/* Quality & Certification */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/70 space-y-2.5">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 font-organic-heading">
                Enterprise Standards
              </h3>
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={oemCertifiedOnly}
                  onChange={(e) => setOemCertifiedOnly(e.target.checked)}
                  className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                />
                100% Direct OEM Certified
              </label>
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                />
                GST Input Tax Credit Eligible
              </label>
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                />
                1-Year Commercial Warranty
              </label>
            </div>
          </div>

          {/* ── Right Products Section ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/70">
              <p className="text-xs text-slate-600 font-medium">
                Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span> commercial items
              </p>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Sort by:</span>
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="featured">Featured Picks</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Highest Customer Rating</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Product Grid */}
            {isProductsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-3xl border border-slate-200 p-5 animate-pulse space-y-4">
                    <div className="h-44 bg-slate-100 rounded-2xl w-full" />
                    <div className="h-4 bg-slate-100 rounded-md w-1/3" />
                    <div className="h-5 bg-slate-100 rounded-md w-3/4" />
                    <div className="flex justify-between items-center pt-2">
                      <div className="h-6 bg-slate-100 rounded-md w-1/4" />
                      <div className="h-9 bg-slate-100 rounded-full w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-200 p-8 space-y-3">
                <h3 className="text-lg font-bold text-slate-800 font-organic-heading">No commercial products found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No active equipment or supplies matched your selected category or search filter.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("All");
                      setMaxPrice(50000);
                      setOemCertifiedOnly(false);
                    }}
                    className="bg-[#2563EB] text-white text-xs font-bold px-6 py-2 rounded-full cursor-pointer hover:bg-[#1D4ED8] transition-colors"
                  >
                    Reset All Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => refetchProducts()}
                    className="border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold px-4 py-2 rounded-full cursor-pointer transition-colors inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="size-3.5" /> Refresh Inventory
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <OrganicProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
