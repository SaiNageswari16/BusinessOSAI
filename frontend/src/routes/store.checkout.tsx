import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/store/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { cartItems, cartTotal, clearCart, cartCount } = useStoreCart();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If cart is empty, redirect back to cart page
  if (cartItems.length === 0 && !isSubmitting) {
    navigate({ to: "/store/cart" });
    return null;
  }

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate network request
    setTimeout(() => {
      clearCart();
      toast.success("Order placed successfully!", {
        style: { background: '#10b981', color: 'white', border: 'none' } // green
      });
      navigate({ to: "/store/orders" });
    }, 1500);
  };

  return (
    <div className="bg-white min-h-screen pt-4 pb-20">
      
      {/* Checkout Header */}
      <div className="bg-gray-50 border-b border-[#E5E4E2] py-4 mb-8">
        <div className="container mx-auto px-4 flex justify-between items-center max-w-5xl">
          <h1 className="text-2xl sm:text-3xl font-medium">Checkout</h1>
          <Lock className="text-gray-400 h-6 w-6" />
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Step 1: Shipping Address */}
            <div className="border border-[#E5E4E2] rounded-sm p-6 relative">
              <div className="absolute -left-3 -top-3 bg-amber-500 text-sky-900 rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-md">1</div>
              <h2 className="text-xl font-bold mb-4 ml-4">Shipping address</h2>
              <div className="ml-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full name</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-sm p-2 outline-none focus:ring-2 focus:ring-sky-500" placeholder="First and Last name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone number</label>
                  <input required type="tel" className="w-full border border-gray-300 rounded-sm p-2 outline-none focus:ring-2 focus:ring-sky-500" placeholder="+965 ..." />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Address line 1</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-sm p-2 outline-none focus:ring-2 focus:ring-sky-500" placeholder="Street address, P.O. box, company name, c/o" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input required type="text" className="w-full border border-gray-300 rounded-sm p-2 outline-none focus:ring-2 focus:ring-sky-500" defaultValue="Kuwait City" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State / Province</label>
                  <input type="text" className="w-full border border-gray-300 rounded-sm p-2 outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
            </div>

            {/* Step 2: Payment Method */}
            <div className="border border-[#E5E4E2] rounded-sm p-6 relative">
              <div className="absolute -left-3 -top-3 bg-amber-500 text-sky-900 rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-md">2</div>
              <h2 className="text-xl font-bold mb-4 ml-4">Payment method</h2>
              <div className="ml-4 space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="radio" name="payment" value="card" defaultChecked className="h-4 w-4 text-sky-600 focus:ring-sky-500" />
                  <span className="font-medium">Credit or Debit Card</span>
                </label>
                <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <input type="text" placeholder="Card number" className="w-full border border-gray-300 rounded-sm p-2 outline-none focus:ring-2 focus:ring-sky-500" />
                  </div>
                  <div>
                    <input type="text" placeholder="MM/YY" className="w-full border border-gray-300 rounded-sm p-2 outline-none focus:ring-2 focus:ring-sky-500" />
                  </div>
                  <div>
                    <input type="text" placeholder="CVC" className="w-full border border-gray-300 rounded-sm p-2 outline-none focus:ring-2 focus:ring-sky-500" />
                  </div>
                </div>
                
                <label className="flex items-center space-x-3 mt-4 cursor-pointer">
                  <input type="radio" name="payment" value="cod" className="h-4 w-4 text-sky-600 focus:ring-sky-500" />
                  <span className="font-medium">Cash on Delivery (COD)</span>
                </label>
              </div>
            </div>

            {/* Step 3: Review Items */}
            <div className="border border-[#E5E4E2] rounded-sm p-6 relative">
              <div className="absolute -left-3 -top-3 bg-amber-500 text-sky-900 rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-md">3</div>
              <h2 className="text-xl font-bold mb-4 ml-4">Review items and shipping</h2>
              <div className="ml-4 border border-[#E5E4E2] rounded-sm p-4">
                <div className="text-green-700 font-bold mb-4">Delivery: Tomorrow</div>
                {cartItems.map((item) => (
                  <div key={item.product.id} className="flex mb-4">
                    <img 
                      src={`https://source.unsplash.com/random/100x100/?${encodeURIComponent(item.product.name)}`} 
                      className="w-16 h-16 object-contain mr-4"
                      alt=""
                    />
                    <div>
                      <div className="font-bold text-sm">{item.product.name}</div>
                      <div className="text-sm text-gray-600">Price: {item.product.price.toFixed(2)} KWD</div>
                      <div className="text-sm font-medium">Quantity: {item.quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-4">
            <div className="border border-[#E5E4E2] rounded-sm p-6 sticky top-4">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-black py-3 rounded-full shadow-sm text-sm font-medium transition-colors mb-4"
              >
                {isSubmitting ? 'Processing...' : 'Place your order'}
              </button>
              
              <div className="text-center text-xs text-gray-500 mb-4 border-b border-[#E5E4E2] pb-4">
                By placing your order, you agree to our privacy notice and conditions of use.
              </div>

              <h3 className="font-bold text-lg mb-2">Order Summary</h3>
              <div className="space-y-2 text-sm text-[#1E293B]">
                <div className="flex justify-between">
                  <span>Items ({cartCount}):</span>
                  <span>{cartTotal.toFixed(2)} KWD</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping & handling:</span>
                  <span>0.00 KWD</span>
                </div>
                <div className="flex justify-between border-b border-[#E5E4E2] pb-2">
                  <span>Estimated Tax:</span>
                  <span>0.00 KWD</span>
                </div>
                <div className="flex justify-between font-bold text-xl text-[#B12704] pt-2">
                  <span>Order total:</span>
                  <span>{cartTotal.toFixed(2)} KWD</span>
                </div>
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
