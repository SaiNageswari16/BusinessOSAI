import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Eye, Heart } from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { StorefrontProduct } from "@/lib/storefront-api";

interface ProductGridProps {
  products: StorefrontProduct[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const { addToCart } = useStoreCart();
  const navigate = useNavigate();

  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-24 h-24 rounded-full bg-[#F2F2F2] border-2 border-[#E5E4E2] flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-blue-600 opacity-60" />
        </div>
        <h3 className="text-xl font-black text-[#1A1A1A] uppercase tracking-wide mb-2">No Products Available</h3>
        <p className="text-gray-500 max-w-sm">
          The store inventory is currently empty. Products added through the ERP inventory system will appear here automatically.
        </p>
      </div>
    );
  }

  const handleAddToCart = (e: React.MouseEvent, product: StorefrontProduct) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      price: product.selling_price || product.mrp || 0,
      mrp: product.mrp,
      image_url: product.image_url,
      category_name: product.category_name,
      brand: product.brand,
      stock: product.stock,
      vendorName: product.seller_name,
    }, 1);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-4">
      {products.map((product) => {
        // Random discount for visual effect
        const hasDiscount = product.mrp > product.selling_price;
        const discountVal = hasDiscount ? Math.round(((product.mrp - product.selling_price) / product.mrp) * 100) : 0;


        return (
          <div key={product.id} className="group relative border border-[#E5E4E2] rounded-lg overflow-hidden bg-white hover:shadow-xl transition-shadow duration-300">
            {/* Image & Badges Container */}
            <div className="relative h-[250px] w-full bg-white flex items-center justify-center p-6 overflow-hidden">
              {hasDiscount && (
                <span className="absolute top-3 left-3 bg-[#FF4E50] text-white text-[10px] font-bold px-2 py-1 rounded">
                  -{discountVal}%
                </span>
              )}
              
              <Link to="/store/product/$id" params={{ id: product.id }} className="w-full h-full flex items-center justify-center block">
                <img 
                  src={product.image_url || `https://source.unsplash.com/random/300x300/?${encodeURIComponent(product.category_name + ',' + product.name)}`} 
                  alt={product.name}
                  className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // Prevent infinite loop if fallback also fails
                    target.src = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop";
                  }}
                />
              </Link>

              {/* Hover Actions (Fade in on hover) */}
              <div className="absolute right-3 top-3 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-4 group-hover:translate-x-0">
                <button 
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="w-10 h-10 bg-white border border-[#E5E4E2] rounded-full flex items-center justify-center text-gray-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                  title="Add to Wishlist"
                >
                  <Heart className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    navigate({ to: "/store/product/$id", params: { id: product.id } });
                  }}
                  className="w-10 h-10 bg-white border border-[#E5E4E2] rounded-full flex items-center justify-center text-gray-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                  title="Quick View"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              {/* Add to Cart Button (Slide up on hover) */}
              <div className="absolute bottom-0 left-0 w-full p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 opacity-0 group-hover:opacity-100 bg-white bg-opacity-90">
                 <button 
                    onClick={(e) => handleAddToCart(e, product)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded transition-colors flex items-center justify-center text-sm"
                 >
                   <ShoppingBag className="w-4 h-4 mr-2" /> Add to cart
                 </button>
              </div>
            </div>
            
            {/* Details Container */}
            <div className="p-4 text-center border-t border-[#E5E4E2]">
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{product.category_name || "General"}</div>
              <Link to="/store/product/$id" params={{ id: product.id }}>
                <h3 className="text-sm font-bold text-[#1A1A1A] hover:text-blue-600 transition-colors mb-2 line-clamp-1">
                  {product.name}
                </h3>
              </Link>
              
              {/* Ratings */}
              <div className="flex items-center justify-center space-x-1 mb-2">
                <div className="flex text-[#FFA41C] text-sm">
                  {'★★★★★'}
                </div>
              </div>

              {/* Seller & Price */}
              {product.seller_name && (
                <div className="text-xs text-gray-400 mb-1 truncate">Sold by: <span className="text-sky-600 font-medium">{product.seller_name}</span></div>
              )}
              <div className="flex items-center justify-center space-x-2">
                {hasDiscount && product.mrp > 0 && (
                  <span className="text-gray-400 line-through text-sm">₹{product.mrp.toFixed(2)}</span>
                )}
                <span className="text-lg font-bold text-blue-600">₹{(product.selling_price || product.mrp || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        );

      })}
    </div>
  );
}
