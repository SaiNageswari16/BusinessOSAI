import { useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { StorefrontProduct } from "@/lib/storefront-api";

interface ProductGridProps {
  products: StorefrontProduct[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const { addToCart } = useStoreCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const navigate = useNavigate();

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-2">No Products Available</h3>
        <p className="text-gray-500 max-w-sm">The store inventory is currently empty.</p>
      </div>
    );
  }

  const handleAddToCart = (e: React.MouseEvent, product: StorefrontProduct) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: product.selling_price || product.mrp || 0,
        mrp: product.mrp,
        image_url: product.image_url,
        category_name: product.category_name,
        brand: product.brand,
        stock: product.stock,
        vendorName: product.seller_name,
      },
      1,
    );
  };

  const handleWishlistToggle = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(productId);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-4">
      {products.map((product) => {
        const price = (product.selling_price || product.mrp || 0).toFixed(2);
        const isWished = isInWishlist(product.id);

        return (
          <div
            key={product.id}
            className="group bg-white rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col cursor-pointer border border-transparent hover:border-gray-100"
            onClick={() => navigate({ to: `/store/product/${product.id}` })}
          >
            {/* Image Container */}
            <div className="relative h-[240px] w-full bg-[#f5f5f5] flex items-center justify-center p-6 mb-4 rounded-xl">
              <img
                src={
                  product.image_url ||
                  `https://source.unsplash.com/random/300x300/?${encodeURIComponent(product.category_name + "," + product.name)}`
                }
                alt={product.name}
                className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src =
                    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop";
                }}
              />
              {/* Heart Icon */}
              <button
                onClick={(e) => handleWishlistToggle(e, product.id)}
                className="absolute right-4 top-4 w-8 h-8 bg-white rounded-full flex items-center justify-center transition-colors shadow-sm"
              >
                <Heart className={`w-4 h-4 ${isWished ? 'fill-green-600 text-green-600' : 'text-gray-400 hover:text-red-500'}`} />
              </button>
            </div>

            {/* Details Container */}
            <div className="px-2 flex flex-col flex-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-base font-bold text-gray-900 line-clamp-1 flex-1 pr-2 group-hover:text-[#003d29] transition-colors">
                  {product.name}
                </h3>
                <span className="text-base font-bold text-gray-900 flex-shrink-0">${price}</span>
              </div>

              <div className="text-xs text-gray-500 mb-2 line-clamp-1">
                {product.short_description || "Organic Cotton, fairtrade certified"}
              </div>

              {/* Ratings */}
              <div className="flex items-center space-x-1 mb-4">
                <div className="flex text-green-600 text-xs">{"★★★★★"}</div>
                <span className="text-xs text-gray-400">(121)</span>
              </div>

              <div className="mt-auto">
                <button
                  onClick={(e) => handleAddToCart(e, product)}
                  className="w-28 border-2 border-gray-900 text-gray-900 hover:bg-[#003d29] hover:text-white hover:border-[#003d29] font-bold py-1.5 rounded-full transition-colors flex items-center justify-center text-xs"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
