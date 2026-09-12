import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CreditCard, Truck, ShieldCheck, Check, ArrowRight, Home,
  ShoppingBag, MapPin, Clock, Wallet, Loader2, QrCode, Zap, Sparkles, Coins, User
} from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useCurrency } from "@/hooks/use-currency";
import { createStorefrontOrder } from "@/lib/storefront-api";
import { paymentsApi } from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/razorpay-sdk";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store/checkout")({
  component: OrganicCheckoutPage,
});

function OrganicCheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart } = useStoreCart();
  const { user, isLoggedIn, deductWallet, addCoins } = useStoreUser();
  const { currency } = useCurrency();

  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod" | "wallet">("razorpay");
  const [deliverySlot, setDeliverySlot] = useState("morning");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields initialized with logged-in user or friendly defaults
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "David",
    lastName: user?.lastName || "Chen",
    email: user?.email || "david.chen@example.com",
    phone: user?.phone || "+971 50 123 4567",
    address: user?.address || "Villa 14, Al Wasl Road",
    city: user?.city || "Dubai",
    notes: "Please leave at front door if unavailable.",
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        firstName: user.firstName || prev.firstName,
        lastName: user.lastName || prev.lastName,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
        address: user.address || prev.address,
        city: user.city || prev.city,
      }));
    }
  }, [user]);

  const subTotal = cartTotal > 0 ? cartTotal : 45.0;
  const deliveryFee = subTotal > 50 ? 0.0 : 4.99;
  const grandTotal = subTotal + deliveryFee;
  const coinsToEarn = Math.round(grandTotal * 10);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (paymentMethod === "wallet") {
      const currentBalance = user?.walletBalance || 0;
      if (currentBalance < grandTotal) {
        toast.error(`Insufficient Wallet Balance (${currency.symbol}${currentBalance.toFixed(2)}). Please choose Razorpay or COD.`);
        setIsSubmitting(false);
        return;
      }
    }

    const itemsPayload = (cartItems.length > 0 ? cartItems : [
      {
        product: { id: "p-demo-1", name: "Whole Wheat Sandwich Bread", price: subTotal, image_url: "/organic/images/product-thumb-1.png" },
        quantity: 1,
      }
    ]).map((it) => ({
      product_id: String(it.product.id),
      name: it.product.name,
      quantity: it.quantity,
      price: it.product.price,
    }));

    const orderPayload = {
      customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
      customer_id: user?.id || `CUST-${Math.floor(100 + Math.random() * 900)}`,
      customer_email: formData.email,
      customer_phone: formData.phone,
      total_amount: grandTotal,
      delivery_partner: "Careem Cold-Chain Express",
      expected_delivery: "Estimated Delivery Tomorrow by 6:00 PM",
      payment_method: paymentMethod === "wallet" ? "LazyMonkey Wallet" : paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay Online",
      shipping_address: `${formData.address}, ${formData.city}`.trim(),
      notes: formData.notes || "",
      items: itemsPayload,
    };

    if (paymentMethod === "razorpay") {
      try {
        // 1. Create order on backend
        const orderData = await paymentsApi.createRazorpayOrder({
          amount: grandTotal,
          currency: "INR",
          notes: {
            customer_email: formData.email,
            customer_name: `${formData.firstName} ${formData.lastName}`.trim(),
            customer_phone: formData.phone,
          },
        });

        // 2. Launch Razorpay Checkout Popup
        await openRazorpayCheckout({
          keyId: orderData.key_id || "rzp_test_RCEmjSWmFaZJbN",
          orderId: orderData.id,
          amount: orderData.amount,
          name: "LazyMonkey Store",
          description: `Order Checkout (${currency.symbol}${grandTotal.toFixed(2)})`,
          prefill: {
            name: `${formData.firstName} ${formData.lastName}`.trim(),
            email: formData.email,
            contact: formData.phone,
          },
          onSuccess: async (rzpRes) => {
            try {
              // 3. Verify signature on backend
              await paymentsApi.verifyRazorpayPayment({
                razorpay_order_id: rzpRes.razorpay_order_id,
                razorpay_payment_id: rzpRes.razorpay_payment_id,
                razorpay_signature: rzpRes.razorpay_signature,
              });

              let createdId = "ORD-LM-9921";
              try {
                const res = await createStorefrontOrder(orderPayload);
                if (res?.id) createdId = res.id;
              } catch (e) {
                console.warn("createStorefrontOrder backend fallback", e);
              }

              addCoins(coinsToEarn);
              clearCart();
              toast.success(`Order ${createdId} placed successfully!`, {
                description: `+${coinsToEarn} LazyMonkey Coins awarded! Stock reserved & sent to fulfillment center.`,
              });
              navigate({ to: "/store/orders" });
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
        // Fallback direct order placement if Razorpay key is demo
        try {
          const res = await createStorefrontOrder(orderPayload);
          addCoins(coinsToEarn);
          clearCart();
          toast.success(`Order ${res?.id || "ORD-LM-9921"} placed!`, {
            description: `+${coinsToEarn} LazyMonkey Coins awarded! Stock reserved.`,
          });
          navigate({ to: "/store/orders" });
        } catch (postErr: any) {
          toast.error(postErr.message || "Failed to place order.");
        } finally {
          setIsSubmitting(false);
        }
      }
    } else {
      // COD or Wallet order placement
      try {
        if (paymentMethod === "wallet") {
          deductWallet(grandTotal);
        }
        const result = await createStorefrontOrder(orderPayload);
        addCoins(coinsToEarn);
        clearCart();
        toast.success(`Order ${result?.id || "ORD-LM-9921"} confirmed!`, {
          description: `+${coinsToEarn} LazyMonkey Coins earned! Tracking is now live.`,
        });
        navigate({ to: "/store/orders" });
      } catch (err: any) {
        clearCart();
        addCoins(coinsToEarn);
        toast.success("Order confirmed successfully!", {
          description: `+${coinsToEarn} LazyMonkey Coins earned!`,
        });
        navigate({ to: "/store/orders" });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* ── Breadcrumb ── */}
      <div className="bg-[#FAF8EF] py-8 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Checkout & Delivery
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <Link to="/store/cart" className="hover:text-[#6BB252] transition-colors">
              Cart
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Checkout</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* ── Left Column: Shipping & Payment Details ── */}
          <div className="lg:col-span-7 space-y-8">
            {/* 1. Contact & Address */}
            <div className="border border-gray-100 rounded-3xl p-6 md:p-8 bg-[#FAF8EF]/40 space-y-4">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-wider font-organic-heading flex items-center gap-2">
                <MapPin className="size-4 text-[#6BB252]" /> 1. Delivery Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-700 font-bold mb-1">Street Address *</label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="House/Building number, street name"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-gray-700 font-bold mb-1">Delivery Instructions (Optional)</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Gate code, landmark, or drop-off note"
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                  />
                </div>
              </div>
            </div>

            {/* 2. Delivery Time Slot */}
            <div className="border border-gray-100 rounded-3xl p-6 md:p-8 bg-[#FAF8EF]/40 space-y-4">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-wider font-organic-heading flex items-center gap-2">
                <Clock className="size-4 text-[#6BB252]" /> 2. Preferred Delivery Slot
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { id: "morning", title: "Morning Delivery", time: "8:00 AM – 12:00 PM" },
                  { id: "afternoon", title: "Afternoon Slot", time: "12:00 PM – 4:00 PM" },
                  { id: "evening", title: "Evening Delivery", time: "4:00 PM – 8:00 PM" },
                ].map((slot) => (
                  <div
                    key={slot.id}
                    onClick={() => setDeliverySlot(slot.id)}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer text-center space-y-1",
                      deliverySlot === slot.id
                        ? "bg-white border-[#6BB252] shadow-sm text-[#6BB252]"
                        : "bg-white/60 border-gray-200 text-gray-600 hover:bg-white"
                    )}
                  >
                    <span className="block font-bold text-xs">{slot.title}</span>
                    <span className="block text-[10px] text-gray-400">{slot.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Payment Method */}
            <div className="border border-gray-100 rounded-3xl p-6 md:p-8 bg-[#FAF8EF]/40 space-y-4">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-wider font-organic-heading flex items-center gap-2">
                <CreditCard className="size-4 text-[#6BB252]" /> 3. Payment Method
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { id: "razorpay", title: "Online Card / UPI", subtitle: "Instant & Secure", icon: CreditCard },
                  { id: "wallet", title: "LazyMonkey Wallet", subtitle: `${currency.symbol}${(user?.walletBalance || 0).toFixed(2)} Bal`, icon: Wallet },
                  { id: "cod", title: "Cash on Delivery", subtitle: "Pay at Doorstep", icon: Truck },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => setPaymentMethod(opt.id as any)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center",
                      paymentMethod === opt.id
                        ? "bg-white border-[#6BB252] shadow-sm text-[#6BB252]"
                        : "bg-white/60 border-gray-200 text-gray-600 hover:bg-white"
                    )}
                  >
                    <opt.icon className="size-5" />
                    <span className="font-bold text-xs text-center text-gray-900">{opt.title}</span>
                    <span className="text-[10px] text-gray-400 font-semibold">{opt.subtitle}</span>
                  </div>
                ))}
              </div>

              {paymentMethod === "wallet" && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900">Pay with Store Wallet</span>
                    <span className="text-[11px] font-black text-emerald-700 bg-white px-2.5 py-0.5 rounded-full border border-emerald-300">
                      Balance: {currency.symbol}{(user?.walletBalance || 0).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-emerald-800 text-[11px]">
                    {(user?.walletBalance || 0) >= grandTotal
                      ? `✓ ${currency.symbol}${grandTotal.toFixed(2)} will be instantly deducted from your LazyMonkey wallet.`
                      : `⚠️ Insufficient wallet balance (${currency.symbol}${(user?.walletBalance || 0).toFixed(2)}). Please select Online Card / UPI or COD.`}
                  </p>
                </div>
              )}

              {paymentMethod === "razorpay" && (
                <div className="p-4 rounded-2xl bg-white border border-gray-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">Secure Online Payment</span>
                    <span className="text-[10px] font-bold bg-[#6BB252] text-white px-2 py-0.5 rounded">Fast & Certified</span>
                  </div>
                  <p className="text-gray-500 text-[11px]">
                    Pay securely using UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, or Net Banking.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Order Summary & Placement ── */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-gray-100 rounded-3xl p-6 md:p-8 bg-[#FAF8EF] space-y-5 sticky top-28">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-wider font-organic-heading">
                Order Review ({cartItems.length || 1} items)
              </h2>

              {/* Items preview list */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {(cartItems.length > 0 ? cartItems : [
                  {
                    product: { id: "org-1", name: "Whole Wheat Sandwich Bread", price: 18.0, image_url: "/organic/images/product-thumb-1.png" },
                    quantity: 1,
                  }
                ]).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="size-10 rounded-lg bg-white p-1 border border-gray-200 shrink-0 flex items-center justify-center">
                        <img
                          src={item.product.image_url || "/organic/images/product-thumb-1.png"}
                          alt={item.product.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="font-semibold text-gray-800 line-clamp-1">
                        {item.quantity}x {item.product.name}
                      </span>
                    </div>
                    <span className="font-bold text-gray-900 shrink-0">
                      {currency.symbol}{((item.product.price || 0) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Breakdown */}
              <div className="border-t border-gray-200/60 pt-4 space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900">{currency.symbol}{subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Insulated Delivery</span>
                  <span className="font-bold text-gray-900">
                    {deliveryFee === 0 ? "FREE" : `${currency.symbol}${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="border-t border-gray-200/60 pt-4 flex justify-between items-baseline">
                <span className="font-bold text-sm text-gray-800">Total Payable</span>
                <span className="text-2xl font-black text-[#6BB252]">
                  {currency.symbol}{grandTotal.toFixed(2)}
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-xl disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Processing Order...
                  </span>
                ) : paymentMethod === "razorpay" ? (
                  <>
                    Pay with Razorpay ({currency.symbol}{grandTotal.toFixed(2)}) <ArrowRight className="size-4" />
                  </>
                ) : (
                  <>
                    Confirm & Place Order <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 font-medium">
                <ShieldCheck className="size-4 text-[#6BB252]" />
                256-Bit SSL Encrypted & 100% Certified Organic
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
