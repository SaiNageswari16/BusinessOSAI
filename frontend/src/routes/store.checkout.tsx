import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useState } from "react";
import { toast } from "sonner";
import { Check, CreditCard, QrCode, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { paymentsApi } from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/razorpay-sdk";

export const Route = createFileRoute("/store/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { currency } = useCurrency();
  const { cartItems, cartTotal, clearCart } = useStoreCart();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Calculate totals based on cart
  const subTotal = cartTotal > 0 ? cartTotal : 549.0;
  const tax = subTotal * 0.1;
  const couponDiscount = 54.9; // Fixed for design mock
  const shippingCost = 0.0;
  const total = Math.max(0, subTotal + tax - couponDiscount + shippingCost);

  // First item for design showcase
  const firstCartItem = cartItems.length > 0 ? cartItems[0] : null;
  const reviewItem = firstCartItem
    ? {
        name: firstCartItem.product?.name || "Product",
        price: firstCartItem.product?.price || 0,
        quantity: firstCartItem.quantity || 1,
        image_url:
          firstCartItem.product?.image_url ||
          "https://images.unsplash.com/photo-1612083216599-52e857416954?w=200&h=200&fit=crop",
      }
    : {
        name: "Airpods- Max",
        price: 549.0,
        quantity: 1,
        image_url:
          "https://images.unsplash.com/photo-1612083216599-52e857416954?w=200&h=200&fit=crop",
      };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (paymentMethod === "razorpay") {
      try {
        // 1. Create order on backend using the tenant's DB credentials
        const orderData = await paymentsApi.createRazorpayOrder({
          amount: total,
          currency: "INR",
          notes: {
            customer_email: customerEmail,
            customer_name: customerName,
            customer_phone: customerPhone,
          },
        });

        // 2. Launch Razorpay Checkout Popup
        await openRazorpayCheckout({
          keyId: orderData.key_id || "rzp_test_RCEmjSWmFaZJbN",
          orderId: orderData.id,
          amount: orderData.amount,
          name: "BusinessOS Store",
          description: `Order Checkout (${currency.symbol}${total.toFixed(2)})`,
          prefill: {
            name: customerName || "Customer",
            email: customerEmail || "customer@example.com",
            contact: customerPhone || "+919876543210",
          },
          onSuccess: async (rzpRes) => {
            try {
              // 3. Verify signature on backend
              await paymentsApi.verifyRazorpayPayment({
                razorpay_order_id: rzpRes.razorpay_order_id,
                razorpay_payment_id: rzpRes.razorpay_payment_id,
                razorpay_signature: rzpRes.razorpay_signature,
              });

              toast.success("Payment verified! Order placed successfully.");
              setShowSuccessModal(true);
              clearCart();
            } catch (verErr: any) {
              toast.error(verErr.message || "Payment verification failed.");
            } finally {
              setIsSubmitting(false);
            }
          },
          onError: (err) => {
            toast.error(err.description || "Payment cancelled or failed.");
            setIsSubmitting(false);
          },
          onDismiss: () => {
            setIsSubmitting(false);
          },
        });
      } catch (err: any) {
        toast.error(err.message || "Could not initialize Razorpay checkout.");
        setIsSubmitting(false);
      }
    } else {
      // Offline / COD Simulation
      setTimeout(() => {
        setIsSubmitting(false);
        setShowSuccessModal(true);
        clearCart();
      }, 1200);
    }
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
                  <img
                    src={
                      reviewItem.image_url ||
                      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop"
                    }
                    alt={reviewItem.name}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{reviewItem.name}</h3>
                    <span className="text-lg font-bold text-gray-900">
                      {currency.symbol}
                      {(reviewItem.price || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>Color: Pink</span>
                    <span className="font-semibold text-gray-700">
                      Quantity: {String(reviewItem.quantity || 1).padStart(2, "0")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Delivery Information</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">First Name*</label>
                  <input
                    required
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50"
                    placeholder="Type first name..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Last Name*</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50"
                    placeholder="Type last name..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-800 mb-2">Address*</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50"
                    placeholder="Street address..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">City/ Town*</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50"
                    placeholder="City..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Zip Code*</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50"
                    placeholder="PIN Code..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Mobile*</label>
                  <input
                    required
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50"
                    placeholder="10-digit phone..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">Email*</label>
                  <input
                    required
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-green-600 bg-gray-50/50"
                    placeholder="Email address..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Payment */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summary</h2>

              {/* Payment Details */}
              <h3 className="text-lg font-bold text-gray-900 mb-4 pb-4 border-b border-gray-100">
                Choose Payment Method
              </h3>

              <div className="space-y-3 mb-6">
                {/* Razorpay Option */}
                <label
                  className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "razorpay"
                      ? "border-blue-600 bg-blue-50/30 shadow-xs"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="razorpay"
                    checked={paymentMethod === "razorpay"}
                    onChange={() => setPaymentMethod("razorpay")}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">
                        Razorpay (UPI, QR, Cards, NetBanking)
                      </span>
                      <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
                        Fast & Secure
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pay via Google Pay, PhonePe, Paytm, BHIM UPI, Visa, Mastercard, or 50+ Net Banking options.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-700">UPI</span>
                      <span className="text-[10px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-700">Credit / Debit</span>
                      <span className="text-[10px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-700">Net Banking</span>
                    </div>
                  </div>
                </label>

                {/* Cash on Delivery */}
                <label
                  className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "cod"
                      ? "border-green-600 bg-green-50/30 shadow-xs"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500 accent-green-600 cursor-pointer"
                  />
                  <div className="ml-3 flex-1">
                    <span className="text-sm font-bold text-gray-900">Cash on Delivery (COD)</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pay with cash or scan delivery agent's UPI QR when order arrives at doorstep.
                    </p>
                  </div>
                </label>
              </div>

              {/* Totals */}
              <div className="space-y-3 mb-6 font-medium text-sm">
                <div className="flex justify-between text-gray-800">
                  <span>Sub Total</span>
                  <span>
                    {currency.symbol}
                    {subTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span>Tax(10%)</span>
                  <span>
                    {currency.symbol}
                    {tax.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span>Coupon Discount</span>
                  <span>
                    -{currency.symbol}
                    {couponDiscount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span>Shipping Cost</span>
                  <span>Free</span>
                </div>
                <div className="flex justify-between text-gray-900 font-extrabold text-lg border-t border-gray-200 pt-3 mt-3">
                  <span>Total Amount</span>
                  <span className="text-emerald-700">
                    {currency.symbol}
                    {total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Pay Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#003d29] hover:bg-[#00271a] text-white font-extrabold h-14 rounded-full transition-all flex items-center justify-center text-base disabled:opacity-70 disabled:cursor-not-allowed mb-4 shadow-lg shadow-green-900/10"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    Connecting to Payment Gateway...
                  </span>
                ) : paymentMethod === "razorpay" ? (
                  `Pay with Razorpay (${currency.symbol}${total.toFixed(2)})`
                ) : (
                  `Place Order (COD)`
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>256-Bit SSL Encrypted & PCI-DSS Secure</span>
              </div>
            </div>
          </div>
        </form>

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gray-900">Order Confirmed!</h3>
                <p className="text-gray-500 text-sm mt-2">
                  Thank you for your order. We have received your payment and our team is preparing your package.
                </p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2 border border-gray-100 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Order ID:</span>
                  <span className="font-mono font-bold text-gray-800">
                    ORD-{Math.floor(100000 + Math.random() * 900000)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Paid:</span>
                  <span className="font-bold text-emerald-600">
                    {currency.symbol}
                    {total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Mode:</span>
                  <span className="font-semibold text-gray-800 uppercase">{paymentMethod}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleContinueShopping}
                className="w-full bg-[#003d29] hover:bg-[#00271a] text-white font-bold h-12 rounded-full transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
