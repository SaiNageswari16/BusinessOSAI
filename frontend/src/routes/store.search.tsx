import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontProducts } from "@/lib/storefront-api";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/store/search")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || "",
    };
  },
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();

  const { data: productData, isLoading, isError } = useQuery({
    queryKey: ["storefrontProducts", "", q],
    queryFn: () => fetchStorefrontProducts(undefined, q),
    enabled: !!q,
  });

  const products = productData?.items ?? [];

  return (
    <div className="container mx-auto px-4 py-12 font-sans min-h-screen">
      <div className="flex items-center space-x-3 mb-6">
        <Search className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-wide">
          Search Results
        </h1>
      </div>

      <p className="text-gray-600 mb-8 text-sm md:text-base">
        {q ? (
          <span>
            Showing results for "<strong className="text-blue-600">{q}</strong>"
          </span>
        ) : (
          "Please enter a search term in the header to find products."
        )}
      </p>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Searching marketplace...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-20 text-red-500 border border-[#E5E4E2] rounded-lg bg-red-50">
          Could not load search results. Please check your backend connection.
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-[#E5E4E2] rounded-lg bg-gray-50 p-8">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
            <Search className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">No matching products found</h3>
          <p className="text-gray-500 text-sm max-w-md">
            We couldn't find anything matching "{q}". Try checking your spelling or searching for general categories like "coke", "label", "gum", or "cookies".
          </p>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
