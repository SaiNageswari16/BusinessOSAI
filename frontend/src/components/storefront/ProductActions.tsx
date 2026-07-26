import { CartProduct } from "@/contexts/StoreCartContext";
import { useState } from "react";
import { MapPin, Lock, Truck } from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useNavigate } from "@tanstack/react-router";

interface ProductActionsProps {
  product: CartProduct;
}

export function ProductActions({ product }: ProductActionsProps) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useStoreCart();
  const navigate = useNavigate();

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate({ to: "/store/checkout" });
  };

  return (
    <div className="border border-[#E5E4E2] rounded-lg p-4 bg-white sticky top-4 shadow-sm">
      <div className="flex items-baseline space-x-1 text-[#1A1A1A] mb-4">
        <span className="text-sm align-top mt-2">KWD</span>
        <span className="text-3xl font-medium">{Math.floor(product.price)}</span>
        <span className="text-sm align-top mt-1">{((product.price % 1) * 100).toFixed(0).padStart(2, '0')}</span>
      </div>

      <div className="flex flex-col space-y-4 text-sm text-[#1A1A1A]">
        
        {/* Delivery Info */}
        <div className="flex items-start">
          <Truck className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0" />
          <div>
            <span className="font-semibold text-sky-700">FREE Delivery</span> by tomorrow. 
            <br />
            Order within <span className="text-green-600 font-medium">3 hrs 15 mins</span>.
          </div>
        </div>

        <div className="flex items-center text-sky-700 hover:text-amber-600 cursor-pointer hover:underline">
          <MapPin className="h-4 w-4 mr-1" />
          Deliver to Kuwait City
        </div>

        {/* Stock Status */}
        <div className="text-xl font-medium text-green-700">
          {(product.stock ?? 1) > 0 ? "In Stock" : "Out of Stock"}
        </div>
        
        {product.brand && (
          <div className="flex items-center text-gray-500 text-xs">
            Sold by <span className="text-sky-700 hover:underline cursor-pointer ml-1">{product.brand}</span>
          </div>
        )}

        {/* Quantity Selector */}
        <div className="pt-2">
          <label htmlFor="quantity" className="sr-only">Quantity</label>
          <select 
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="border border-gray-300 rounded-md py-1.5 px-3 bg-gray-50 hover:bg-[#F2F2F2] outline-none focus:ring-2 focus:ring-sky-500 w-full sm:w-auto"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <option key={num} value={num}>Quantity: {num}</option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
          <button 
            onClick={handleAddToCart}
            className="w-full bg-amber-400 hover:bg-amber-500 text-[#1A1A1A] font-medium py-2.5 rounded-full shadow-sm transition-colors"
          >
            Add to Cart
          </button>
          
          <button 
            onClick={handleBuyNow}
            className="w-full bg-amber-500 hover:bg-amber-600 text-[#1A1A1A] font-medium py-2.5 rounded-full shadow-sm transition-colors"
          >
            Buy Now
          </button>
        </div>

        {/* Secure Transaction */}
        <div className="flex items-center text-gray-500 mt-4 justify-center">
          <Lock className="h-4 w-4 mr-1" />
          <span>Secure transaction</span>
        </div>

      </div>
    </div>
  );
}
