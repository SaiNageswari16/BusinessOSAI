import React from "react";
import { Link } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useCurrency } from "@/hooks/use-currency";
import { Heart, Star, Truck, ShieldCheck, Check, ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface MegaProductCardProps {
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
    rating?: number;
    review_count?: number;
    short_description?: string;
  };
  className?: string;
}

export function MegaProductCard({ product, className }: MegaProductCardProps) {
  const { addToCart, items } = useStoreCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { formatCurrency } = useCurrency();

  const price = Number(product.selling_price ?? product.price ?? 0);
  const originalPrice = Number(product.mrp ?? product.original_price ?? 0);
  const discountPct = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const image = product.image_url || product.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80";

  const cartItem = items.find((i) => i.productId === product.id);
  const inCart = Boolean(cartItem);
  const isWishlisted = isInWishlist(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product.id,
      name: product.name,
      price,
      image,
      quantity: 1,
    });
    toast.success(`Added "${product.name}" to cart!`);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      productId: product.id,
      name: product.name,
      price,
      image,
    });
  };

  return (
    <div
      className={cn(
        "group bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:border-blue-400 relative",
        className
      )}
    >
      {/* ── Top Image Container ── */}
      <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-50 mb-2.5 p-2">
        <Link to="/store/product/$id" params={{ id: product.id }}>
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </Link>

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-2 right-2 size-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-500 shadow-sm hover:bg-white hover:text-rose-500 transition-all cursor-pointer"
        >
          <Heart className={cn("w-3.5 h-3.5", isWishlisted && "fill-rose-500 text-rose-500")} />
        </button>

        {/* Discount Badge */}
        {discountPct > 0 && (
          <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-xs">
            {discountPct}% OFF
          </span>
        )}
      </div>

      {/* ── Specs & Details ── */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Express Badge */}
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
            <span className="uppercase tracking-wider">{product.category || "Electronics"}</span>
            <span className="inline-flex items-center gap-0.5 text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-extrabold">
              <Zap className="w-2.5 h-2.5 fill-blue-600" /> Express
            </span>
          </div>

          {/* Title */}
          <Link
            to="/store/product/$id"
            params={{ id: product.id }}
            className="text-xs font-bold text-slate-900 line-clamp-2 hover:text-blue-600 transition-colors leading-tight"
          >
            {product.name}
          </Link>

          {/* Star Rating */}
          <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-500 font-bold">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-slate-500 text-[10px] font-semibold">(4.8)</span>
          </div>
        </div>

        {/* Price & Buy Button */}
        <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
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
            <div className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <Truck className="w-2.5 h-2.5" /> FREE Delivery Tomorrow
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs",
              inCart
                ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
            )}
          >
            {inCart ? (
              <>
                <Check className="w-3 h-3" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3 h-3" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
