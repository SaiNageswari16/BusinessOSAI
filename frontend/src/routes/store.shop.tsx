import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, ChevronRight, LayoutGrid, List } from "lucide-react";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontProducts, fetchStorefrontCategories } from "@/lib/storefront-api";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/store/shop")({
  component: ShopPage,
});

function ShopPage() {
  const { currency } = useCurrency();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const { data: productData } = useQuery({
    queryKey: ["storefrontProducts", selectedCategory],
    queryFn: () => fetchStorefrontProducts(selectedCategory),
  });
  const allProducts = productData?.items ?? [];

  const { data: categories = [] } = useQuery({
    queryKey: ["storefrontCategories"],
    queryFn: () => fetchStorefrontCategories(),
  });

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Breadcrumb Banner */}
      <div className="bg-[#F2F2F2] py-10 mb-12 border-b border-[#E5E4E2]">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-widest mb-4">
            Shop
          </h1>
          <div className="text-sm text-gray-500 flex items-center justify-center space-x-2">
            <Link
              to="/store"
              className="hover:text-blue-600 flex items-center transition-colors font-medium"
            >
              <Home className="h-4 w-4 mr-1" />
              Home
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-[#1A1A1A] font-bold">Shop</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar: Filters */}
          <div className="lg:col-span-1 space-y-8">
            {/* Categories */}
            <div className="border border-[#E5E4E2] rounded-lg p-6">
              <h3 className="text-lg font-black text-[#1A1A1A] uppercase tracking-wide mb-4">
                Categories
              </h3>
              <ul className="space-y-3">
                <li
                  onClick={() => setSelectedCategory(undefined)}
                  className="flex justify-between items-center group cursor-pointer"
                >
                  <span
                    className={`transition-colors ${!selectedCategory ? "text-blue-600 font-bold" : "text-gray-600 group-hover:text-blue-600"}`}
                  >
                    All
                  </span>
                </li>
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="flex justify-between items-center group cursor-pointer"
                  >
                    <span
                      className={`transition-colors ${selectedCategory === cat.id ? "text-blue-600 font-bold" : "text-gray-600 group-hover:text-blue-600"}`}
                    >
                      {cat.name}
                    </span>
                    <span className="w-6 h-6 rounded-full bg-[#F2F2F2] flex items-center justify-center text-xs text-gray-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Price Filter (Mock) */}
            <div className="border border-[#E5E4E2] rounded-lg p-6">
              <h3 className="text-lg font-black text-[#1A1A1A] uppercase tracking-wide mb-4">
                Filter By Price
              </h3>
              <div className="mb-4">
                <input
                  type="range"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Price: {currency.symbol}10 - {currency.symbol}2000</span>
                <button className="bg-[#1A1A1A] hover:bg-blue-600 text-white px-4 py-1.5 text-xs font-bold uppercase rounded transition-colors">
                  Filter
                </button>
              </div>
            </div>

            {/* Brands */}
            <div className="border border-[#E5E4E2] rounded-lg p-6">
              <h3 className="text-lg font-black text-[#1A1A1A] uppercase tracking-wide mb-4">
                Brands
              </h3>
              <ul className="space-y-3">
                {["TechNova", "Global Trade", "Fresh Foods", "Style Hub"].map((brand) => (
                  <li key={brand} className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
                    />
                    <span className="text-gray-600 group-hover:text-blue-600 transition-colors">
                      {brand}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Products */}
          <div className="lg:col-span-3">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-[#F2F2F2] p-4 border border-[#E5E4E2] rounded-lg mb-8">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:text-blue-600"}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:text-blue-600"}`}
                >
                  <List className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-500">
                  Showing 1–{allProducts.length} of {allProducts.length} results
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select className="border border-gray-300 rounded px-3 py-1.5 text-sm text-[#1E293B] outline-none focus:border-blue-600">
                  <option>Default sorting</option>
                  <option>Sort by popularity</option>
                  <option>Sort by average rating</option>
                  <option>Sort by latest</option>
                  <option>Sort by price: low to high</option>
                  <option>Sort by price: high to low</option>
                </select>
              </div>
            </div>

            {/* Product Grid */}
            <ProductGrid products={allProducts} />
          </div>
        </div>
      </div>
    </div>
  );
}
