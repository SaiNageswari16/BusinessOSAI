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
  const [maxPrice, setMaxPrice] = useState<number>(5000);
  const [organicOnly, setOrganicOnly] = useState<boolean>(true);

  // Sync selected category if route query changes
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  // Fetch live products
  const { data: dynamicProductsData, isLoading: isProductsLoading } = useQuery({
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

  const liveItems: OrganicProduct[] = useMemo(() => {
    return (dynamicProductsData?.items || []).map((p, i) => mapStorefrontToOrganic(p, i));
  }, [dynamicProductsData]);

  const allProducts: OrganicProduct[] = useMemo(() => {
    return liveItems.length > 0 ? liveItems : fallbackProducts;
  }, [liveItems]);

  const categoriesList = useMemo(() => {
    if (dynamicCategoriesData && dynamicCategoriesData.length > 0) {
      return dynamicCategoriesData.map((c, i) => ({
        id: c.id,
        name: c.name,
        slug: c.name.toLowerCase().replace(/\s+/g, "-"),
        image: c.image_url || fallbackCategories[i % fallbackCategories.length]?.image || "/organic/images/category-thumb-1.jpg",
        itemCount: c.item_count || allProducts.filter(p => p.category?.toLowerCase() === c.name.toLowerCase()).length || 1,
      }));
    }
    // If no backend categories returned, derive from products
    if (liveItems.length > 0) {
      const distinctCats = Array.from(new Set(liveItems.map(p => p.category).filter(Boolean)));
      return distinctCats.map((cat, i) => ({
        id: `cat-${i}`,
        name: cat,
        slug: cat.toLowerCase().replace(/\s+/g, "-"),
        image: fallbackCategories[i % fallbackCategories.length]?.image || "/organic/images/category-thumb-1.jpg",
        itemCount: liveItems.filter(p => p.category === cat).length,
      }));
    }
    return fallbackCategories;
  }, [dynamicCategoriesData, liveItems, allProducts]);

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
      <div className="bg-[#FAF8EF] py-10 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Organic Grocery Shop
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Shop</span>
            {selectedCategory !== "All" && (
              <>
                <span>/</span>
                <span className="text-gray-800 font-semibold">{selectedCategory}</span>
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
            <div className="border border-gray-100 rounded-2xl p-5 bg-[#FAF8EF]/40">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-3.5 font-organic-heading">
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
                        ? "bg-[#6BB252] text-white font-bold shadow-xs"
                        : "text-gray-700 hover:bg-white hover:text-[#6BB252]"
                    )}
                  >
                    <span>All Categories</span>
                    <span className={cn("text-[10px]", selectedCategory === "All" ? "text-white/80" : "text-gray-400")}>
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
                          ? "bg-[#6BB252] text-white font-bold shadow-xs"
                          : "text-gray-700 hover:bg-white hover:text-[#6BB252]"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <img src={cat.image} alt={cat.name} className="size-4 rounded-full object-cover" />
                        {cat.name}
                      </span>
                      <span className={cn("text-[10px]", selectedCategory.toLowerCase() === cat.name.toLowerCase() ? "text-white/80" : "text-gray-400")}>
                        ({cat.itemCount})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Filter */}
            <div className="border border-gray-100 rounded-2xl p-5 bg-[#FAF8EF]/40">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-3 font-organic-heading flex justify-between items-center">
                <span>Filter by Price</span>
                <span className="text-[#6BB252] font-black">{currency.symbol}{maxPrice}</span>
              </h3>
              <input
                type="range"
                min="5"
                max="5000"
                step="25"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#6BB252]"
              />
              <div className="flex justify-between text-[11px] text-gray-400 font-medium mt-2">
                <span>{currency.symbol}5</span>
                <span>{currency.symbol}5000</span>
              </div>
            </div>

            {/* Quality & Certification */}
            <div className="border border-gray-100 rounded-2xl p-5 bg-[#FAF8EF]/40 space-y-2.5">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-3 font-organic-heading">
                Quality Verification
              </h3>
              <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={organicOnly}
                  onChange={(e) => setOrganicOnly(e.target.checked)}
                  className="rounded border-gray-300 text-[#6BB252] focus:ring-[#6BB252]"
                />
                100% Certified Organic
              </label>
              <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-gray-300 text-[#6BB252] focus:ring-[#6BB252]"
                />
                Pesticide-Free Harvest
              </label>
              <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-gray-300 text-[#6BB252] focus:ring-[#6BB252]"
                />
                Non-GMO Guaranteed
              </label>
            </div>
          </div>

          {/* ── Right Products Section ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-[#FAF8EF]/40">
              <p className="text-xs text-gray-600 font-medium">
                Showing <span className="font-bold text-gray-900">{filteredProducts.length}</span> organic products
              </p>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Sort by:</span>
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 outline-none cursor-pointer"
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
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-[#FAF8EF]/30 rounded-3xl border border-gray-100 p-8 space-y-3">
                <h3 className="text-lg font-bold text-gray-800 font-organic-heading">No products found</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Try adjusting your category filter or increasing your price range limit.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("All");
                    setMaxPrice(50);
                  }}
                  className="bg-[#6BB252] text-white text-xs font-bold px-6 py-2 rounded-full cursor-pointer"
                >
                  Reset Filters
                </button>
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
