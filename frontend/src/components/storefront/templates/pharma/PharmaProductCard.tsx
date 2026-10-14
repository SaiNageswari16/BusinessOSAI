import React from "react";
import { Link } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useCurrency } from "@/hooks/use-currency";
import {
  Heart,
  Pill,
  ShieldCheck,
  Check,
  Plus,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface PharmaProductCardProps {
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
    short_description?: string;
    dosage?: string;
    requires_rx?: boolean;
    composition?: string;
  };
  className?: string;
}

export function PharmaProductCard({ product, className }: PharmaProductCardProps) {
  const { addToCart, items } = useStoreCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { formatCurrency } = useCurrency();

  const price = Number(product.selling_price ?? product.price ?? 0);
  const originalPrice = Number(product.mrp ?? product.original_price ?? 0);
  const discountPct = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const image = product.image_url || product.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&q=80";

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
    toast.success(`Added "${product.name}" to Medicine Bag!`);
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

  const isRx = product.requires_rx !== undefined ? product.requires_rx : false;
  const composition = product.composition || product.short_description || "Pharmaceutical Grade Formulation";

  return (
    <div
      className={cn(
        "group bg-white rounded-2xl border border-sky-100 p-3.5 flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:border-sky-300 relative",
        className
      )}
    >
      {/* ── Top Image Container ── */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-50 mb-3 border border-slate-100">
        <Link to="/store/product/$id" params={{ id: product.id }}>
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </Link>

        {/* Rx Badge / OTC Badge */}
        <span
          className={cn(
            "absolute top-2.5 left-2.5 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-xs",
            isRx
              ? "bg-rose-600 text-white"
              : "bg-teal-600 text-white"
          )}
        >
          {isRx ? "Rx Required" : "OTC Care"}
        </span>

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-2.5 right-2.5 size-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-500 shadow-sm hover:bg-white hover:text-rose-500 transition-all cursor-pointer"
          title={isWishlisted ? "Remove from saved" : "Save medicine"}
        >
          <Heart className={cn("w-4 h-4", isWishlisted && "fill-rose-500 text-rose-500")} />
        </button>

        {/* Discount Badge */}
        {discountPct > 0 && (
          <span className="absolute bottom-2 left-2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs">
            {discountPct}% OFF
          </span>
        )}
      </div>

      {/* ── Product Info & Clinical Details ── */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Category */}
          <div className="text-[10px] font-extrabold text-[#0D9488] uppercase tracking-wider mb-1">
            {product.category || "Pharmaceuticals"}
          </div>

          {/* Product Title */}
          <Link
            to="/store/product/$id"
            params={{ id: product.id }}
            className="text-sm font-bold text-slate-900 line-clamp-2 hover:text-[#0284C7] transition-colors leading-snug"
          >
            {product.name}
          </Link>

          {/* Salt / Composition Info */}
          <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 font-mono">
            {composition}
          </p>
        </div>

        {/* Price & Action Row */}
        <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-slate-900">
                {formatCurrency(price)}
              </span>
              {originalPrice > price && (
                <span className="text-xs text-slate-400 line-through">
                  {formatCurrency(originalPrice)}
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3" /> 100% Genuine
            </div>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs",
              inCart
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-[#0284C7] text-white hover:bg-[#0369A1] active:scale-95"
            )}
          >
            {inCart ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
