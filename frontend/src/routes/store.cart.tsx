import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { Trash2 } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/store/cart")({
  component: CartPage,
});

function CartPage() {
  const { cartItems, removeFromCart, addToCart, cartTotal, cartCount } = useStoreCart();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white p-8 rounded-sm shadow-sm flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-4">Your Amazon Cart is empty</h1>
          <Link to="/store" className="text-sky-600 hover:underline">
            Shop today's deals
          </Link>
          <div className="mt-8 flex space-x-4">
            <Link to="/store/account" className="bg-amber-400 hover:bg-amber-500 text-black px-6 py-2 rounded-md shadow-sm text-sm">
              Sign in to your account
            </Link>
            <Link to="/store" className="border border-gray-300 hover:bg-gray-50 text-black px-6 py-2 rounded-md text-sm">
              Sign up now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Cart Items */}
        <div className="lg:col-span-9 bg-white p-6 rounded-sm shadow-sm">
          <div className="flex justify-between items-end border-b border-[#E5E4E2] pb-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-medium">Shopping Cart</h1>
            <span className="text-sm text-gray-500 hidden sm:inline-block">Price</span>
          </div>

          <div className="space-y-6">
            {cartItems.map((item) => (
              <div key={item.product.id} className="flex flex-col sm:flex-row border-b border-[#E5E4E2] pb-6">
                
                {/* Product Image */}
                <div className="sm:w-1/4 mb-4 sm:mb-0 mr-4 flex-shrink-0 flex items-center justify-center bg-gray-50 p-2 rounded-md">
                  <img 
                    src={`https://source.unsplash.com/random/400x400/?${encodeURIComponent(item.product.name)}`} 
                    alt={item.product.name}
                    className="w-full max-h-32 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop";
                    }}
                  />
                </div>

                {/* Product Details */}
                <div className="flex-1">
                  <div className="flex justify-between">
                    <Link to="/store/product/$id" params={{ id: item.product.id }} className="text-lg font-medium text-[#1A1A1A] hover:text-amber-600 line-clamp-2">
                      {item.product.name}
                    </Link>
                    <span className="text-lg font-bold sm:hidden ml-4">
                      {item.product.price.toFixed(2)} KWD
                    </span>
                  </div>
                  
                  <div className="text-sm text-green-700 mt-1 mb-2">In Stock</div>
                  <div className="text-xs text-gray-500 mb-2">
                    Sold by: <span className="text-sky-700 hover:underline cursor-pointer">{item.product.vendorName}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-4 mt-4">
                    <select 
                      value={item.quantity}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value);
                        // Add difference to cart context (which will override existing qty properly)
                        addToCart(item.product, newQty - item.quantity); 
                      }}
                      className="border border-gray-300 rounded-md py-1 px-2 bg-gray-50 hover:bg-[#F2F2F2] outline-none focus:ring-2 focus:ring-sky-500 text-sm shadow-sm"
                    >
                      {[...Array(10).keys()].map(i => (
                        <option key={i+1} value={i+1}>Qty: {i+1}</option>
                      ))}
                    </select>
                    
                    <div className="border-l border-gray-300 h-4"></div>
                    
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-sm text-sky-700 hover:underline flex items-center"
                    >
                      Delete
                    </button>
                    
                    <div className="border-l border-gray-300 h-4 hidden sm:block"></div>
                    
                    <button className="text-sm text-sky-700 hover:underline hidden sm:block">
                      Save for later
                    </button>
                  </div>
                </div>
                
                {/* Price (Desktop) */}
                <div className="hidden sm:block ml-4 text-lg font-bold whitespace-nowrap">
                  {item.product.price.toFixed(2)} KWD
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <div className="text-xl">
              Subtotal ({cartCount} item{cartCount !== 1 ? 's' : ''}): <span className="font-bold">{cartTotal.toFixed(2)} KWD</span>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Box */}
        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-sm shadow-sm sticky top-4">
            <div className="text-lg mb-4">
              Subtotal ({cartCount} item{cartCount !== 1 ? 's' : ''}): <span className="font-bold">{cartTotal.toFixed(2)} KWD</span>
            </div>
            
            <button 
              onClick={() => navigate({ to: "/store/checkout" })}
              className="w-full bg-amber-400 hover:bg-amber-500 text-black py-2 rounded-full shadow-sm text-sm font-medium transition-colors"
            >
              Proceed to checkout
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
