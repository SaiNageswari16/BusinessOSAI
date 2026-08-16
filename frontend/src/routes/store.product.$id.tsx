import { createFileRoute } from "@tanstack/react-router";
import { ProductGallery } from "../components/storefront/ProductGallery";
import { ProductInfo } from "../components/storefront/ProductInfo";
import { mockMarketplaceProducts, MarketplaceProduct } from "../data/mockMarketplaceData";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontProducts, StorefrontProduct } from "@/lib/storefront-api";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/store/product/$id")({
  component: ProductDetail,
});

const mockAsStorefrontProduct = (mock: MarketplaceProduct): StorefrontProduct => {
  return {
    id: mock.id,
    name: mock.name,
    sku: `MOCK-${mock.id}`,
    category_name: mock.category,
    brand: mock.vendorName,
    short_description: `Mock product from ${mock.vendorName}`,
    image_url: undefined,
    mrp: mock.price * 1.2,
    selling_price: mock.price,
    stock: mock.stock,
    images: [],
    variants: [],
  };
};

function ProductDetail() {
  const { id } = Route.useParams();

  const { data: productData } = useQuery({
    queryKey: ["storefrontProducts"],
    queryFn: () => fetchStorefrontProducts(),
  });
  const allProducts = productData?.items ?? [];

  const liveProduct = allProducts.find((p) => p.id === id);
  const mockProduct = mockMarketplaceProducts.find((p) => p.id === id);

  const product = liveProduct || (mockProduct ? mockAsStorefrontProduct(mockProduct) : undefined);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-black text-gray-900 mb-4">Product Not Found</h1>
        <Link
          to="/store"
          className="bg-[#003d29] hover:bg-[#00271a] text-white px-8 py-3 rounded-full font-bold transition-colors"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-20 font-sans">
      {/* Shopcart Breadcrumb */}
      <div className="container mx-auto px-4 py-6">
        <div className="text-sm font-semibold text-gray-500 flex items-center space-x-2">
          <Link to="/store" className="hover:text-gray-900 transition-colors">
            Electronics
          </Link>
          <span className="text-gray-300">/</span>
          <span className="hover:text-gray-900 transition-colors cursor-pointer">Audio</span>
          <span className="text-gray-300">/</span>
          <span className="hover:text-gray-900 transition-colors cursor-pointer">Headphones</span>
          <span className="text-gray-300">/</span>
          <span className="hover:text-gray-900 transition-colors cursor-pointer">
            Shop Headphones by type
          </span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 truncate max-w-[200px] sm:max-w-none">
            {product.name.toLowerCase().replace(/\s+/g, "-")}
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-4">
          {/* Left Column: Image Gallery */}
          <div className="md:w-1/2">
            <ProductGallery productId={product.id} productName={product.name} imageUrl={product.image_url} />
          </div>

          {/* Right Column: Product Info & Actions */}
          <div>
            <ProductInfo product={product} />
          </div>
        </div>

        {/* Full Specifications Section */}
        <div className="mt-20">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{product.name} Full Specifications</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* General Specs */}
            <div className="bg-[#f5f5f5] rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">General</h3>
              <div className="space-y-2">
                {[
                  { label: "Brand", value: product.brand || "Apple" },
                  { label: "Model", value: product.name },
                  { label: "Price", value: `$${(product.selling_price || product.mrp || 549).toFixed(2)}` },
                  { label: "Release date", value: "December 2020" },
                  { label: "Model Number", value: product.sku || "AirPods Max" },
                  { label: "Headphone Type", value: "Over-Ear" },
                  { label: "Connectivity", value: "Wireless" }
                ].map((spec, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg text-sm">
                    <span className="font-semibold text-gray-700 w-1/3">{spec.label}</span>
                    <span className="text-gray-600 flex-1">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Details Specs */}
            <div className="bg-[#f5f5f5] rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Product details</h3>
              <div className="space-y-2">
                {product.specifications && typeof product.specifications === 'object' && !Array.isArray(product.specifications) ? (
                  Object.entries(product.specifications).map(([key, value], idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg text-sm">
                      <span className="font-semibold text-gray-700 w-1/3">{key}</span>
                      <span className="text-gray-600 flex-1">{String(value)}</span>
                    </div>
                  ))
                ) : (
                  [
                    { label: "Microphone", value: "Yes" },
                    { label: "Driver Type", value: "Dynamic" },
                    { label: "Driver Size (mm)", value: "40" },
                    { label: "Number of Drivers", value: "1" },
                    { label: "Water Resistant", value: "No" },
                    { label: "Weight (g)", value: "385.00" },
                    { label: "Battery Life (Hrs)", value: "20" }
                  ].map((spec, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg text-sm">
                      <span className="font-semibold text-gray-700 w-1/3">{spec.label}</span>
                      <span className="text-gray-600 flex-1">{spec.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
