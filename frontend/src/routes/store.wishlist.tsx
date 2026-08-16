import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/store/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlistItems, toggleWishlist, addToCart } = useStoreCart();

  return (
    <div className="bg-white min-h-screen pb-20">
      <div className="bg-[#F2F2F2] py-10 mb-12 border-b border-[#E5E4E2]">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-widest mb-4">My Wishlist</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        {wishlistItems.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
            <Heart className="w-16 h-16 mx-auto text-gray-300 mb-6" />
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">Your wishlist is empty</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">Save items you love here so you can easily find them later and add them to your cart when you're ready.</p>
            <Link to="/store/shop" className="bg-purple-900 hover:bg-amber-600 text-white px-8 py-3 rounded-full font-bold transition-colors uppercase tracking-wide inline-flex items-center">
              Continue Shopping <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {wishlistItems.map((item) => (
              <div key={item.id} className="group relative border border-[#E5E4E2] rounded-lg overflow-hidden bg-white hover:shadow-xl transition-all duration-300">
                
                {/* Remove from Wishlist Button */}
                <button 
                  onClick={() => toggleWishlist(item)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Product Image */}
                <Link to="/store/product/$id" params={{ id: item.id.split('-')[0] }} className="block relative aspect-square overflow-hidden bg-gray-50">
                  <img
                    src={item.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop"}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </Link>

                {/* Product Info */}
                <div className="p-4">
                  <Link to="/store/product/$id" params={{ id: item.id.split('-')[0] }}>
                    <h3 className="text-sm font-bold text-[#1A1A1A] mb-1 group-hover:text-purple-900 transition-colors line-clamp-2">
                      {item.name}
                    </h3>
                  </Link>
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-lg font-black text-purple-900">{item.price.toFixed(2)} KWD</span>
                    {item.mrp && item.mrp > item.price && (
                      <span className="text-sm text-gray-400 line-through">{item.mrp.toFixed(2)} KWD</span>
                    )}
                  </div>
                  
                  {/* Move to Cart */}
                  <button 
                    onClick={() => {
                      addToCart(item, 1);
                      toggleWishlist(item); // Remove from wishlist after adding to cart
                    }}
                    className="w-full bg-[#1A1A1A] hover:bg-purple-900 text-white font-bold py-2.5 rounded transition-colors uppercase tracking-wide text-xs flex items-center justify-center"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Move to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
