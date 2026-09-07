import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ShoppingBag, Trash2, Plus, Minus, ArrowRight, Home,
  ShieldCheck, Truck, Tag, ArrowLeft
} from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/store/cart")({
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount } = useStoreCart();
  const { currency } = useCurrency();

  const [couponCode, setCouponCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (code === "ORGANIC25" || code === "SUMMER2026") {
      setDiscountPercent(25);
      toast.success(`Coupon "${code}" applied! 25% discount activated.`);
    } else if (code === "FRESH10") {
      setDiscountPercent(10);
      toast.success(`Coupon "${code}" applied! 10% discount activated.`);
    } else {
      toast.error("Invalid discount coupon code. Try 'ORGANIC25'.");
    }
  };

  const discountAmount = (cartTotal * discountPercent) / 100;
  const shippingFee = cartTotal > 50 || cartTotal === 0 ? 0.0 : 4.99;
  const finalTotal = Math.max(0, cartTotal - discountAmount + shippingFee);

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* ── Breadcrumb ── */}
      <div className="bg-[#FAF8EF] py-8 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Your Shopping Basket
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Cart ({cartCount} items)</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {cartItems.length === 0 ? (
          <div className="max-w-md mx-auto py-20 text-center space-y-4">
            <div className="size-24 rounded-full bg-[#FAF8EF] flex items-center justify-center text-gray-400 mx-auto">
              <ShoppingBag className="size-12 text-[#6BB252]" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 font-organic-heading">
              Your basket is empty
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Explore our selection of farm-fresh organic produce, cold-pressed juices, and bakery goods.
            </p>
            <Link
              to="/store/shop"
              className="inline-flex items-center gap-2 bg-[#6BB252] hover:bg-[#5ba342] text-white px-8 py-3 rounded-full text-xs font-bold transition-all shadow-md"
            >
              Start Shopping <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* ── Left: Cart Items Table ── */}
            <div className="lg:col-span-8 space-y-6">
              <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8EF] border-b border-gray-100 text-gray-700 uppercase text-[11px] font-bold">
                      <tr>
                        <th className="px-6 py-4">Product</th>
                        <th className="px-6 py-4 text-center">Unit Price</th>
                        <th className="px-6 py-4 text-center">Quantity</th>
                        <th className="px-6 py-4 text-right">Subtotal</th>
                        <th className="px-6 py-4 text-center">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cartItems.map((item) => (
                        <tr key={item.product.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3.5">
                              <div className="size-16 rounded-xl bg-[#FAF8EF] p-1.5 flex items-center justify-center border border-gray-200/60 shrink-0">
                                <img
                                  src={item.product.image_url || "/organic/images/product-thumb-1.png"}
                                  alt={item.product.name}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <div>
                                <Link
                                  to="/store/product/$id"
                                  params={{ id: String(item.product.id) }}
                                  className="font-bold text-sm text-gray-900 hover:text-[#6BB252] transition-colors line-clamp-1"
                                >
                                  {item.product.name}
                                </Link>
                                <span className="text-[11px] text-gray-400 block mt-0.5">
                                  {item.product.category_name || "Organic Grocery"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-center font-bold text-gray-800">
                            {currency.symbol}{(item.product.price || 0).toFixed(2)}
                          </td>

                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex items-center border border-gray-200 rounded-lg bg-white p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                                className="size-6 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                              >
                                <Minus className="size-2.5" />
                              </button>
                              <span className="w-7 text-center font-bold text-gray-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                className="size-6 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                              >
                                <Plus className="size-2.5" />
                              </button>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right font-black text-gray-900 text-sm">
                            {currency.symbol}{((item.product.price || 0) * item.quantity).toFixed(2)}
                          </td>

                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product.id)}
                              className="size-8 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 inline-flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Actions: Clear & Continue */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Link
                  to="/store/shop"
                  className="inline-flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-[#6BB252] transition-colors"
                >
                  <ArrowLeft className="size-4" /> Continue Shopping
                </Link>

                <button
                  type="button"
                  onClick={clearCart}
                  className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  Clear Entire Basket
                </button>
              </div>
            </div>

            {/* ── Right: Order Summary ── */}
            <div className="lg:col-span-4 space-y-6">
              {/* Coupon Code Input */}
              <div className="border border-gray-100 rounded-2xl p-5 bg-[#FAF8EF]/40 space-y-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="size-4 text-[#6BB252]" /> Promo Code
                </h3>
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="e.g. ORGANIC25"
                    className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs uppercase outline-none focus:border-[#6BB252]"
                  />
                  <button
                    type="submit"
                    className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Apply
                  </button>
                </form>
                {discountPercent > 0 && (
                  <p className="text-[11px] font-bold text-emerald-600">
                    ✓ {discountPercent}% discount applied!
                  </p>
                )}
              </div>

              {/* Summary Breakdown Card */}
              <div className="border border-gray-100 rounded-2xl p-6 bg-[#FAF8EF] space-y-4">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider font-organic-heading">
                  Order Summary
                </h3>

                <div className="space-y-2.5 text-xs text-gray-600 border-b border-gray-200/60 pb-4">
                  <div className="flex justify-between">
                    <span>Items Subtotal</span>
                    <span className="font-bold text-gray-900">
                      {currency.symbol}{cartTotal.toFixed(2)}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Discount ({discountPercent}%)</span>
                      <span>-{currency.symbol}{discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Doorstep Delivery</span>
                    <span className="font-bold text-gray-900">
                      {shippingFee === 0 ? "FREE" : `${currency.symbol}${shippingFee.toFixed(2)}`}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline pt-1">
                  <span className="font-bold text-sm text-gray-800">Total</span>
                  <span className="text-2xl font-black text-[#6BB252]">
                    {currency.symbol}{finalTotal.toFixed(2)}
                  </span>
                </div>

                <p className="text-[10px] text-gray-400 leading-tight">
                  Free delivery applied on all organic orders above $50.
                </p>

                <button
                  type="button"
                  onClick={() => navigate({ to: "/store/checkout" })}
                  className="w-full py-3.5 px-6 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
                >
                  Proceed to Checkout <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
