import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useCurrency } from "@/hooks/use-currency";
import { Heart, ShoppingBag, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface FashionProductCardProps {
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
  };
  className?: string;
}

export function FashionProductCard({ product, className }: FashionProductCardProps) {
  const { addToCart, items } = useStoreCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { formatCurrency } = useCurrency();

  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [selectedColor, setSelectedColor] = useState<number>(0);

  const price = Number(product.selling_price ?? product.price ?? 0);
  const originalPrice = Number(product.mrp ?? product.original_price ?? 0);
  const discountPct = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const image = product.image_url || product.image || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80";

  const cartItem = items.find((i) => i.productId === product.id);
  const inCart = Boolean(cartItem);
  const isWishlisted = isInWishlist(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      productId: product.id,
      name: `${product.name} (${selectedSize})`,
      price,
      image,
      quantity: 1,
    });
    toast.success(`Added "${product.name}" (${selectedSize}) to Bag!`);
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

  const dummyColors = ["#18181B", "#C25E3E", "#A8A29E", "#15803D"];
  const dummySizes = ["XS", "S", "M", "L", "XL"];

  return (
    <div className={cn("group flex flex-col justify-between relative", className)}>
      {/* ── Vertical Portrait Image Container ── */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-100 rounded-xl mb-3">
        <Link to="/store/product/$id" params={{ id: product.id }}>
          <img
            src={image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
          />
        </Link>

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-3 right-3 size-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-zinc-900 shadow-sm hover:bg-white hover:text-rose-600 transition-all cursor-pointer"
          title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart className={cn("w-4 h-4 stroke-[1.75]", isWishlisted && "fill-rose-600 text-rose-600")} />
        </button>

        {/* Discount Tag */}
        {discountPct > 0 && (
          <span className="absolute top-3 left-3 bg-zinc-950 text-white text-[9px] font-bold px-2 py-0.5 rounded tracking-widest uppercase">
            -{discountPct}%
          </span>
        )}

        {/* Hover-revealed Quick Size & Add Strip */}
        <div className="absolute inset-x-2 bottom-2 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-white/95 backdrop-blur-md rounded-xl p-2 shadow-xl border border-zinc-200">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Size:</span>
            <div className="flex items-center gap-1">
              {dummySizes.map((sz) => (
                <button
                  key={sz}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedSize(sz);
                  }}
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors",
                    selectedSize === sz
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  )}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            className="w-full py-1.5 rounded-lg bg-zinc-950 text-white text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{inCart ? "In Bag (Add More)" : "Quick Add to Bag"}</span>
          </button>
        </div>
      </div>

      {/* ── Product Info ── */}
      <div>
        {/* Color Swatch Dots */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {dummyColors.map((color, idx) => (
            <button
              key={color}
              onClick={() => setSelectedColor(idx)}
              className={cn(
                "size-3 rounded-full border border-white ring-1 transition-all cursor-pointer",
                selectedColor === idx ? "ring-zinc-900 scale-125" : "ring-transparent hover:scale-110"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Category */}
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-0.5">
          {product.category || "Atelier Collection"}
        </div>

        {/* Title */}
        <Link
          to="/store/product/$id"
          params={{ id: product.id }}
          className="text-sm font-semibold text-zinc-900 line-clamp-1 hover:underline transition-all block font-serif"
        >
          {product.name}
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-sm font-black text-zinc-950">
            {formatCurrency(price)}
          </span>
          {originalPrice > price && (
            <span className="text-xs text-zinc-400 line-through">
              {formatCurrency(originalPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
