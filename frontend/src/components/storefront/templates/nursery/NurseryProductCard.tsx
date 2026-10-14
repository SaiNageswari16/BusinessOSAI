import React from "react";
import { Link } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useCurrency } from "@/hooks/use-currency";
import {
  Heart,
  Sprout,
  Sun,
  Droplets,
  Plus,
  Check,
  Star,
  Leaf
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface NurseryProductCardProps {
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
    pot_size?: string;
    sunlight?: string;
    watering?: string;
    pet_friendly?: boolean;
  };
  className?: string;
}

export function NurseryProductCard({ product, className }: NurseryProductCardProps) {
  const { addToCart, items = [], cartItems = [] } = useStoreCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { formatCurrency } = useCurrency();

  const price = Number(product.selling_price ?? product.price ?? 0);
  const originalPrice = Number(product.mrp ?? product.original_price ?? 0);
  const discountPct = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const image = product.image_url || product.image || "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500&q=80";

  // Check if item already in cart safely
  const activeItems = items || cartItems || [];
  const inCart = activeItems.some((i: any) => (i?.product?.id || i?.productId || i?.id) === product.id);
  const isWishlisted = isInWishlist ? isInWishlist(product.id) : false;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggleWishlist) {
      toggleWishlist(product.id);
    }
  };

  // Plant Care defaults (derived or smart fallback for non-plant inventory)
  const sunlight = product.sunlight || "Indirect Light";
  const watering = product.watering || "1x Weekly";
  const isPetFriendly = product.pet_friendly !== undefined ? product.pet_friendly : true;

  return (
    <div
      className={cn(
        "group bg-white rounded-2xl border border-[#E6E0D5] p-3.5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:border-[#1B4D3E]/40 relative",
        className
      )}
    >
      {/* ── Top Image Container ── */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#FAF8F5] mb-3">
        <Link to="/store/product/$id" params={{ id: product.id }}>
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </Link>

        {/* Discount Badge */}
        {discountPct > 0 && (
          <span className="absolute top-2.5 left-2.5 bg-[#C25E3E] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            {discountPct}% OFF
          </span>
        )}

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-2.5 right-2.5 size-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#1B4D3E] shadow-sm hover:bg-white hover:text-[#C25E3E] transition-all cursor-pointer"
          title={isWishlisted ? "Remove from wishlist" : "Save to plant wishlist"}
        >
          <Heart className={cn("w-4 h-4", isWishlisted && "fill-[#C25E3E] text-[#C25E3E]")} />
        </button>

        {/* Bottom Quick Plant Care Guide Overlay */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-white/90 backdrop-blur-md rounded-lg py-1 px-2 flex items-center justify-between text-[9px] font-bold text-[#2D5A4A] shadow-xs">
          <span className="flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-500" /> {sunlight}
          </span>
          <span className="flex items-center gap-1">
            <Droplets className="w-3 h-3 text-sky-500" /> {watering}
          </span>
        </div>
      </div>

      {/* ── Product Info & Botanical Metadata ── */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Category / Nursery Tag */}
          <div className="flex items-center justify-between text-[11px] font-bold text-[#6E8A7D] mb-1">
            <span className="uppercase tracking-wider">
              {product.category || "Indoor Living"}
            </span>
            {isPetFriendly && (
              <span className="text-[10px] text-[#16A34A] bg-[#E8F3EE] px-1.5 py-0.2 rounded-md font-extrabold">
                🐾 Pet Safe
              </span>
            )}
          </div>

          {/* Product Title */}
          <Link
            to="/store/product/$id"
            params={{ id: product.id }}
            className="text-sm font-bold text-[#1B4D3E] line-clamp-2 hover:text-[#16A34A] transition-colors leading-snug font-serif"
          >
            {product.name}
          </Link>
        </div>

        {/* Price & Action Row */}
        <div className="pt-3 mt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-[#1B4D3E]">
                {formatCurrency(price)}
              </span>
              {originalPrice > price && (
                <span className="text-xs text-slate-400 line-through">
                  {formatCurrency(originalPrice)}
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#6E8A7D] font-medium">
              Free Eco Pot Included
            </div>
          </div>

          {/* Botanical Add to Garden Button */}
          <button
            onClick={handleAddToCart}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs",
              inCart
                ? "bg-[#E8F3EE] text-[#16A34A] border border-[#A7F3D0]"
                : "bg-[#1B4D3E] text-white hover:bg-[#153D31] active:scale-95"
            )}
          >
            {inCart ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>In Garden</span>
              </>
            ) : (
              <>
                <Leaf className="w-3.5 h-3.5 text-[#86EFAC]" />
                <span>Plant It</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
