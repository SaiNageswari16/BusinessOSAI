import React from "react";
import { Link } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useCurrency } from "@/hooks/use-currency";
import { Plus, Minus, Zap, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface QuickMartProductCardProps {
  product: {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    image_url?: string;
    image?: string;
    selling_price?: number;
    price?: number;
    mrp?: number;
    original_price?: number;
    stock?: number;
    unit?: string;
  };
  className?: string;
}

export function QuickMartProductCard({ product, className }: QuickMartProductCardProps) {
  const { addToCart, updateQuantity, items = [], cartItems = [] } = useStoreCart();
  const { formatCurrency } = useCurrency();

  const price = Number(product.selling_price ?? product.price ?? 0);
  const originalPrice = Number(product.mrp ?? product.original_price ?? 0);
  const discountPct = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const image = product.image_url || product.image || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80";

  const activeItems = items || cartItems || [];
  const cartItem = activeItems.find((i: any) => (i?.product?.id || i?.productId || i?.id) === product.id);
  const qtyInCart = cartItem ? cartItem.quantity : 0;

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (qtyInCart === 0) {
      addToCart({
        id: product.id,
        productId: product.id,
        name: product.name,
        price,
        mrp: originalPrice,
        image,
        image_url: image,
        quantity: 1,
      }, 1);
    } else {
      updateQuantity(product.id, qtyInCart + 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (qtyInCart > 0) {
      updateQuantity(product.id, qtyInCart - 1);
    }
  };

  return (
    <div
      className={cn(
        "group bg-white rounded-2xl border border-slate-200/90 p-3 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-violet-300 relative",
        className
      )}
    >
      {/* ── Top Image Container ── */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 mb-2 p-1">
        <Link to="/store/product/$id" params={{ id: product.id }}>
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        </Link>

        {/* 10 Min Delivery Tag */}
        <span className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-xs text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
          <Clock className="w-2.5 h-2.5 text-amber-400" />
          <span>10 MINS</span>
        </span>

        {/* Discount Badge */}
        {discountPct > 0 && (
          <span className="absolute bottom-2 left-2 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs">
            {discountPct}% OFF
          </span>
        )}
      </div>

      {/* ── Product Info ── */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Unit / Weight Tag */}
          <div className="text-[10px] font-bold text-slate-500 mb-0.5">
            {product.unit || "1 unit / pack"}
          </div>

          {/* Title */}
          <Link
            to="/store/product/$id"
            params={{ id: product.id }}
            className="text-xs font-bold text-slate-900 line-clamp-2 hover:text-violet-600 transition-colors leading-tight"
          >
            {product.name}
          </Link>
        </div>

        {/* Price & Interactive Quantity Stepper */}
        <div className="pt-2 mt-2 flex items-center justify-between gap-1.5">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-slate-900">
                {formatCurrency(price)}
              </span>
              {originalPrice > price && (
                <span className="text-[10px] text-slate-400 line-through">
                  {formatCurrency(originalPrice)}
                </span>
              )}
            </div>
          </div>

          {/* Stepper / Add Button */}
          {qtyInCart === 0 ? (
            <button
              onClick={handleIncrement}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border-1.5 border-emerald-500 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer active:scale-95 shadow-xs uppercase tracking-wider"
            >
              ADD
            </button>
          ) : (
            <div className="flex items-center rounded-xl bg-[#7C3AED] text-white overflow-hidden shadow-xs">
              <button
                onClick={handleDecrement}
                className="px-2 py-1.5 hover:bg-[#6D28D9] transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-2 text-xs font-black">{qtyInCart}</span>
              <button
                onClick={handleIncrement}
                className="px-2 py-1.5 hover:bg-[#6D28D9] transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
