import { createFileRoute } from "@tanstack/react-router";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontProducts } from "@/lib/storefront-api";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

function StoreHome() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["storefrontProducts"],
    queryFn: () => fetchStorefrontProducts(),
    staleTime: 60_000, // 1 min cache
  });
  const allProducts = data?.items ?? [];

  const filterPills = ["Headphone Type", "Price", "Review", "Color", "Material", "Offer"];

  return (
    <div className="w-full bg-white font-sans pb-20">
      <div className="container mx-auto px-4 mt-6">
        {/* Hero Banner */}
        <div className="w-full bg-[#fcf0e4] rounded-xl overflow-hidden flex flex-col md:flex-row items-center justify-between px-8 md:px-16 py-10 mb-8 h-auto md:h-[350px]">
          <div className="max-w-md z-10 text-center md:text-left mb-8 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-black text-[#003d29] leading-[1.1] mb-8">
              Grab Upto 50% Off On Selected Headphone
            </h1>
            <button className="bg-[#003d29] hover:bg-[#00271a] text-white px-8 py-3 rounded-full font-bold transition-colors">
              Buy Now
            </button>
          </div>
          <div className="relative h-64 md:h-[400px] w-full md:w-1/2 flex justify-center md:justify-end">
            <img
              src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=800"
              alt="Headphones Girl"
              className="h-full object-cover rounded-xl mix-blend-multiply opacity-90"
              style={{
                maskImage:
                  "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
              }}
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div className="flex flex-wrap items-center gap-2">
            {filterPills.map((pill, idx) => (
              <button
                key={idx}
                className="bg-[#f2f2f2] hover:bg-[#e0e0e0] text-gray-800 px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2 transition-colors"
                onClick={() => {
                  // In a real app this would update search params or local state
                  console.log(`Filtering by ${pill}`);
                }}
              >
                <span>{pill}</span>
                <ChevronDown size={14} className="text-gray-500" />
              </button>
            ))}
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-full flex items-center transition-colors">
              All Filters <SlidersHorizontal className="w-4 h-4 ml-2 opacity-50" />
            </button>
          </div>

          <button className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-full flex items-center transition-colors">
            Sort by <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
          </button>
        </div>

        {/* Main Products Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Headphones For You!</h2>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 border-4 border-[#003d29] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-16 text-red-500">
              Could not load products. Please check your backend connection.
            </div>
          ) : (
            <ProductGrid products={allProducts.slice(0, 8)} />
          )}
        </section>

        {/* Similar Items Section */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Similar Items You Might Like</h2>
          {isLoading ? null : <ProductGrid products={allProducts.slice(4, 8)} />}
        </section>

        {/* Recently Viewed Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recently Viewed</h2>
          {isLoading ? null : <ProductGrid products={allProducts.slice(0, 4)} />}
        </section>
      </div>
    </div>
  );
}
