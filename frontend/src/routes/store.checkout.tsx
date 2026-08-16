import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/store/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { currency } = useCurrency();
  const { cartItems, cartTotal, clearCart } = useStoreCart();
  const navigate = useNavigate();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("credit_card");

  // Calculate totals based on cart (mocked values from screenshot)
  const subTotal = cartTotal > 0 ? cartTotal : 549.00;
  const tax = subTotal * 0.10;
  const couponDiscount = 54.90; // Fixed for design mock
  const shippingCost = 0.00;
  const total = subTotal + tax - couponDiscount + shippingCost;

  // Use the first cart item for the review section, or mock if empty for design purposes
  const firstCartItem = cartItems.length > 0 ? cartItems[0] : null;
  const reviewItem = firstCartItem ? {
    name: firstCartItem.product?.name || "Product",
    price: firstCartItem.product?.price || 0,
    quantity: firstCartItem.quantity || 1,
    image_url: firstCartItem.product?.image_url || "https://images.unsplash.com/photo-1612083216599-52e857416954?w=200&h=200&fit=crop"
  } : {
    name: "Airpods- Max",
    price: 549.00,
    quantity: 1,
    image_url: "https://images.unsplash.com/photo-1612083216599-52e857416954?w=200&h=200&fit=crop" // Pink airpods ish
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate network request
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccessModal(true);
      clearCart();
    }, 1500);
  };

  const handleContinueShopping = () => {
    setShowSuccessModal(false);
    navigate({ to: "/store" });
  };

  return (
    <div className="bg-[#f8f9fa] min-h-screen py-10 font-sans">
      <div className="container mx-auto px-4 max-w-6xl">
        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Review & Shipping */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Review Item And Shipping */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Review Item And Shipping</h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-32 h-32 bg-[#f5f5f5] rounded-xl overflow-hidden flex items-center justify-center p-2 flex-shrink-0">
                  <img src={reviewItem.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop"} alt={reviewItem.name} className="w-full h-full object-contain mix-blend-multiply" />
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{reviewItem.name}</h3>
                    <span className="text-lg font-bold text-gray-900">{currency.symbol}{(reviewItem.price || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>Color: Pink</span>
                    <span className="font-semibold text-gray-700">Quantity: {String(reviewItem.quantity || 1).padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Returning Customer Checkbox */}
            <div className="flex items-center space-x-3">
              <input type="checkbox" id="returning" className="w-5 h-5 rounded text-green-600 focus:ring-green-500 border-gray-300 accent-green-600" defaultChecked />
              <label htmlFor="returning" className="text-sm font-medium text-gray-700 cursor-pointer">Returning Customer?</label>
            </div>

            {/* Delivery Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Delivery Information</h2>
                <button type="button" className="bg-[#f0f0f0] text-gray-700 px-4 py-2 rounded-full text-xs font-semibold hover:bg-gray-200 transition-colors">
                  Save Information
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">First Name*</label>
                  <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Last Name*</label>
                  <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-800 mb-2">Address*</label>
                  <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">City/ Town*</label>
                  <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Zip Code*</label>
                  <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Mobile*</label>
                  <input required type="tel" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Email*</label>
                  <input required type="email" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Payment */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summery</h2>
              
              {/* Coupon */}
              <div className="flex bg-[#f5f5f5] rounded-full overflow-hidden p-1 mb-8">
                <input type="text" placeholder="Enter Coupon Code" className="flex-1 bg-transparent px-4 text-sm outline-none" />
                <button type="button" className="bg-[#003d29] hover:bg-[#00271a] text-white px-6 py-2 rounded-full text-sm font-bold transition-colors">
                  Apply coupon
                </button>
              </div>

              {/* Payment Details */}
              <h3 className="text-lg font-bold text-gray-900 mb-4 pb-4 border-b border-gray-100">Payment Details</h3>
              
              <div className="space-y-4 mb-6">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="w-5 h-5 text-green-600 focus:ring-green-500 border-gray-300 accent-green-600" />
                  <span className="text-sm font-medium text-gray-700">Cash on Delivery</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="radio" name="payment" value="shopcart" checked={paymentMethod === "shopcart"} onChange={() => setPaymentMethod("shopcart")} className="w-5 h-5 text-green-600 focus:ring-green-500 border-gray-300 accent-green-600" />
                  <span className="text-sm font-medium text-gray-700">Shopcart Card</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="radio" name="payment" value="paypal" checked={paymentMethod === "paypal"} onChange={() => setPaymentMethod("paypal")} className="w-5 h-5 text-green-600 focus:ring-green-500 border-gray-300 accent-green-600" />
                  <span className="text-sm font-medium text-gray-700">Paypal</span>
                </label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="radio" name="payment" value="credit_card" checked={paymentMethod === "credit_card"} onChange={() => setPaymentMethod("credit_card")} className="w-5 h-5 text-green-600 focus:ring-green-500 border-gray-300 accent-green-600" />
                    <span className="text-sm font-medium text-gray-700">Credit or Debit card</span>
                  </label>
                  
                  {/* Card Icons */}
                  <div className="pl-8 flex gap-2 mb-2">
                    <div className="bg-white border border-gray-200 rounded px-2 py-1 h-8 flex items-center justify-center">
                      <span className="font-bold text-xs">amazon</span>
                    </div>
                    <div className="bg-white border border-gray-200 rounded px-2 py-1 h-8 flex items-center justify-center">
                      <div className="w-6 flex">
                        <div className="w-4 h-4 rounded-full bg-red-500 opacity-80 mix-blend-multiply"></div>
                        <div className="w-4 h-4 rounded-full bg-yellow-500 opacity-80 mix-blend-multiply -ml-2"></div>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded px-2 py-1 h-8 flex items-center justify-center">
                      <span className="font-bold text-xs text-blue-800 italic">VISA</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Inputs */}
              {paymentMethod === "credit_card" && (
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">Email*</label>
                    <input required type="email" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">Card Holder Name*</label>
                    <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="Type here..." />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">Card Number*</label>
                    <div className="relative">
                      <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 pl-10 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="0000****1245" />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-2">Expiry</label>
                      <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="MM/YY" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-2">CVC</label>
                      <input required type="text" className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50" placeholder="000" />
                    </div>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="space-y-3 mb-6 font-medium text-sm">
                <div className="flex justify-between text-gray-800">
                  <span>Sub Total</span>
                  <span>{currency.symbol}{subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span>Tax(10%)</span>
                  <span>{currency.symbol}{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span>Coupon Discount</span>
                  <span>-{currency.symbol}{couponDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span>Shipping Cost</span>
                  <span>-{currency.symbol}{shippingCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-3 mt-3">
                  <span></span>
                  <span>={currency.symbol}{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Pay Button */}
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-[#003d29] hover:bg-[#00271a] text-white font-bold h-14 rounded-full transition-colors flex items-center justify-center text-lg disabled:opacity-70 disabled:cursor-not-allowed mb-4"
              >
                {isSubmitting ? "Processing..." : `Pay ${currency.symbol}${total.toFixed(2)}`}
              </button>

              {/* Cashback banner */}
              <div className="bg-[#e9e6e0] rounded-xl p-4 flex items-center gap-4">
                <div className="bg-[#003d29] rounded w-12 h-8 relative flex-shrink-0">
                  <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-white opacity-50"></div>
                  <div className="absolute bottom-1 right-1 w-2 h-2 bg-yellow-400 rounded-sm"></div>
                  <div className="absolute bottom-1 right-4 w-2 h-2 bg-white rounded-sm"></div>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-gray-900">Earn 5% cash back</span> <span className="text-gray-700">on Shopcart</span>
                  <div className="text-xs text-gray-500 font-medium underline cursor-pointer mt-0.5">Learn More</div>
                </div>
              </div>
              
            </div>
          </div>
        </form>
      </div>

      {/* Success Modal Overlay */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-md"></div>
          <div className="relative bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
            
            {/* Modal graphic / animation */}
            <div className="w-32 h-32 mb-6 relative flex items-center justify-center">
              {/* Blur gradient background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 to-green-100 rounded-full blur-xl opacity-70"></div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-4 w-2 h-2 bg-red-400 rounded-full"></div>
              <div className="absolute bottom-4 left-0 w-2 h-2 border border-blue-400 rounded-full"></div>
              <div className="absolute top-1/4 left-2 w-3 h-3 border-2 border-yellow-400 rounded-sm transform rotate-45"></div>
              
              {/* Main Check circle */}
              <div className="relative w-20 h-20 bg-green-400 rounded-full flex items-center justify-center shadow-lg shadow-green-200">
                <Check className="text-white w-10 h-10 stroke-[3]" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your order has been<br/>accepted</h2>
            <p className="text-xs font-medium text-gray-500 mb-8">Transaction ID: {Math.floor(Math.random() * 10000000000)}</p>
            
            <button 
              onClick={handleContinueShopping}
              className="bg-[#f97316] hover:bg-[#ea580c] text-white font-bold h-12 px-8 rounded-full transition-colors w-full"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
