import { StorefrontProduct } from "@/lib/storefront-api";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useState } from "react";
import { Truck, RotateCcw, Heart } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface ProductInfoProps {
  product: StorefrontProduct;
}

export function ProductInfo({ product }: ProductInfoProps) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useStoreCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isWished = isInWishlist(product.id);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(product.id);
  };

  const handleAddToCart = () => {
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
      },
      quantity,
    );
  };

  const increment = () => setQuantity((q) => q + 1);
  const decrement = () => setQuantity((q) => (q > 1 ? q - 1 : 1));

  const price = (product.selling_price || product.mrp || 0).toFixed(2);
  const monthly = ((product.selling_price || product.mrp || 0) / 6).toFixed(2);

  const navigate = useNavigate();

  const handleBuyNow = () => {
    handleAddToCart();
    navigate({ to: "/store/checkout" });
  };

  return (
    <div className="flex flex-col space-y-6 max-w-lg">
      {/* Title & Desc */}
      <div>
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 pr-4">{product.name}</h1>
          <button
            onClick={handleWishlistToggle}
            className="flex-shrink-0 w-10 h-10 bg-[#f5f5f5] rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <Heart size={20} className={`${isWished ? 'fill-green-600 text-green-600' : 'text-gray-400 hover:text-red-500'}`} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-3 leading-relaxed">
          {product.short_description ||
            "A perfect balance of exhilarating high-fidelity audio and the effortless magic of this product."}
        </p>
        <div className="flex items-center space-x-2">
          <div className="flex text-green-600 text-sm">{"★★★★★"}</div>
          <span className="text-xs text-gray-500 font-semibold">(121)</span>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Pricing */}
      <div>
        <div className="flex items-baseline space-x-2 mb-1">
          <span className="text-2xl font-bold text-gray-900">${price}</span>
          <span className="text-lg font-bold text-gray-900">or ${monthly}/month</span>
        </div>
        <p className="text-xs text-gray-500 font-medium">
          Suggested payments with 6 months special financing
        </p>
      </div>

      <hr className="border-gray-200" />

      {/* Colors */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Choose a Color</h3>
        <div className="flex space-x-3">
          {["bg-[#ffb6a3]", "bg-gray-800", "bg-[#c1d3c0]", "bg-gray-200", "bg-[#4b5b78]"].map(
            (color, idx) => (
              <button
                key={idx}
                className={`w-8 h-8 rounded-full ${color} border-2 ${idx === 0 ? "border-gray-900 shadow-sm ring-2 ring-offset-2 ring-gray-900" : "border-white ring-1 ring-gray-200"}`}
              />
            ),
          )}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Quantity & Stock */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center bg-[#f2f4f5] rounded-full px-4 h-12 w-32 justify-between">
          <button
            onClick={decrement}
            className="text-gray-600 hover:text-gray-900 font-medium text-xl"
          >
            -
          </button>
          <span className="font-bold text-gray-900">{quantity}</span>
          <button
            onClick={increment}
            className="text-gray-600 hover:text-gray-900 font-medium text-xl"
          >
            +
          </button>
        </div>

        <div className="text-sm">
          <div className="font-semibold text-gray-900">
            Only <span className="text-orange-500">12 Items</span> Left!
          </div>
          <div className="text-gray-500">Don't miss it</div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex space-x-4 pt-2">
        <button 
          onClick={handleBuyNow}
          className="flex-1 bg-[#003d29] hover:bg-[#00271a] text-white font-bold h-12 rounded-full transition-colors flex items-center justify-center"
        >
          Buy Now
        </button>
        <button
          onClick={handleAddToCart}
          className="flex-1 border border-[#003d29] text-[#003d29] hover:bg-gray-50 font-bold h-12 rounded-full transition-colors flex items-center justify-center"
        >
          Add to Cart
        </button>
      </div>

      {/* Delivery Info */}
      <div className="border border-gray-200 rounded-xl mt-6 divide-y divide-gray-200">
        <div className="p-4 flex items-start space-x-4">
          <Truck className="w-6 h-6 text-orange-500 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-1">Free Delivery</h4>
            <a href="#" className="text-xs text-gray-500 underline hover:text-gray-700">Enter your Postal code for Delivery Availability</a>
          </div>
        </div>
        <div className="p-4 flex items-start space-x-4">
          <RotateCcw className="w-6 h-6 text-orange-500 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-1">Return Delivery</h4>
            <p className="text-xs text-gray-500">Free 30days Delivery Returns. <a href="#" className="underline hover:text-gray-700">Details</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
