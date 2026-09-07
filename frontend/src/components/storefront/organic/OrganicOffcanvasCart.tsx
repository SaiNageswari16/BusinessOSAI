import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, ShoppingBag, ArrowRight, Plus, Minus } from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function OrganicOffcanvasCart({ isOpen, onClose }: Props) {
  const { cartItems, removeFromCart, updateQuantity, cartTotal, cartCount } = useStoreCart();
  const { currency } = useCurrency();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-screen max-w-md bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-[#FAF8EF]">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-[#6BB252]/15 text-[#6BB252] flex items-center justify-center">
                    <ShoppingBag className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Your Cart</h3>
                    <p className="text-xs text-gray-500 font-medium">{cartCount} items in basket</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="size-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="size-20 rounded-full bg-[#FAF8EF] flex items-center justify-center text-gray-400">
                      <ShoppingBag className="size-10 stroke-1" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg">Your cart is empty</h4>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">
                        Add fresh organic fruits, vegetables, bread, and groceries to your cart.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        navigate({ to: "/store/shop" });
                      }}
                      className="bg-[#6BB252] hover:bg-[#5ba342] text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex gap-3.5 p-3 rounded-xl border border-gray-100 bg-[#fafafa] hover:bg-white hover:border-[#6BB252]/30 transition-all"
                    >
                      {/* Thumbnail */}
                      <div className="size-16 rounded-lg bg-white border border-gray-200/60 p-1 flex items-center justify-center shrink-0">
                        <img
                          src={item.product.image_url || "/organic/images/product-thumb-1.png"}
                          alt={item.product.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h5 className="font-bold text-xs text-gray-900 truncate">
                            {item.product.name}
                          </h5>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-0.5 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>

                        <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                          {currency.symbol}{(item.product.price || 0).toFixed(2)}
                        </p>

                        {/* Quantity controls */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/40">
                          <div className="flex items-center border border-gray-200 rounded-md bg-white">
                            <button
                              onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                              className="size-6 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                            >
                              <Minus className="size-2.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-gray-800">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="size-6 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                            >
                              <Plus className="size-2.5" />
                            </button>
                          </div>

                          <span className="text-xs font-extrabold text-gray-900">
                            {currency.symbol}{((item.product.price || 0) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {cartItems.length > 0 && (
                <div className="p-5 border-t border-gray-100 bg-[#FAF8EF] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Subtotal</span>
                    <span className="text-lg font-black text-gray-900">
                      {currency.symbol}{cartTotal.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Taxes and free delivery calculated at checkout.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        onClose();
                        navigate({ to: "/store/cart" });
                      }}
                      className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      View Cart
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        navigate({ to: "/store/checkout" });
                      }}
                      className="w-full py-2.5 px-4 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      Checkout <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
