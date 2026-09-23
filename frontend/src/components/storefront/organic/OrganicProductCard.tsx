import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Star, Heart, ShoppingCart, Check, Plus, Minus, ShieldCheck } from "lucide-react";
import { OrganicProduct } from "@/data/mockOrganicData";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  product: OrganicProduct;
  className?: string;
}

export function OrganicProductCard({ product, className }: Props) {
  const navigate = useNavigate();
  const { addToCart, wishlistItems, toggleWishlist } = useStoreCart();
  const { currency } = useCurrency();
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  const isFavorited = wishlistItems.some((item) => item.id === product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        mrp: product.originalPrice,
        image_url: product.image,
        category_name: product.category,
      },
      quantity
    );
    setIsAdded(true);
    toast.success(`Added ${quantity}x "${product.name}" to cart!`);
    setTimeout(() => setIsAdded(false), 1800);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.originalPrice,
      image_url: product.image,
      category_name: product.category,
    });
  };

  return (
    <div
      onClick={() => navigate({ to: `/store/product/${product.id}` })}
      className={cn(
        "group relative bg-white border border-gray-100 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:border-[#16A34A]/40 hover:-translate-y-1 cursor-pointer",
        className
      )}
    >
      {/* Top badges: Discount & Wishlist */}
      <div className="flex items-center justify-between z-10">
        {product.discountBadge ? (
          <span className="bg-[#16A34A] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs tracking-wider uppercase">
            {product.discountBadge}
          </span>
        ) : (
          <span className="bg-[#ECFDF5] text-[#16A34A] text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
            Verified
          </span>
        )}

        <button
          type="button"
          onClick={handleToggleWishlist}
          title={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
          className={cn(
            "size-8 rounded-full flex items-center justify-center transition-all cursor-pointer",
            isFavorited
              ? "bg-red-50 text-red-500 hover:bg-red-100"
              : "bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500"
          )}
        >
          <Heart className={cn("size-4", isFavorited && "fill-red-500")} />
        </button>
      </div>

      {/* Product Image */}
      <div className="relative w-full aspect-square my-2 flex items-center justify-center overflow-hidden rounded-xl bg-gray-50/80 p-3">
        <img
          src={product.image}
          alt={product.name}
          className="max-h-full max-w-full object-contain rounded-lg transition-transform duration-500 group-hover:scale-105 shadow-2xs"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=500&auto=format&fit=crop&q=80";
          }}
        />
      </div>

      {/* Product Details */}
      <div className="space-y-1.5 text-left mt-1">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <span className="truncate max-w-[120px]">{product.category}</span>
          {product.sku && <span className="font-mono text-[9px] text-gray-500 bg-gray-100 px-1 rounded">{product.sku}</span>}
        </div>

        <h3 className="font-bold text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug group-hover:text-[#16A34A] transition-colors">
          {product.name}
        </h3>

        {/* Rating stars */}
        <div className="flex items-center gap-1.5">
          <div className="flex text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "size-3",
                  i < Math.floor(product.rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-gray-200 fill-gray-200"
                )}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-400 font-medium">({product.reviewsCount})</span>
        </div>

        {/* Price row */}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-sm sm:text-base font-black text-gray-900">
            {currency.symbol}{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {product.originalPrice > product.price && (
            <del className="text-xs text-gray-400 font-normal">
              {currency.symbol}{product.originalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </del>
          )}
        </div>
      </div>

      {/* Quantity & Add to Cart Area */}
      <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {/* Quantity Stepper */}
          <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="size-6 flex items-center justify-center text-gray-600 hover:text-black hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-6 text-center text-xs font-bold text-gray-800 select-none">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="size-6 flex items-center justify-center text-gray-600 hover:text-black hover:bg-gray-200 rounded transition-colors cursor-pointer"
            >
              <Plus className="size-3" />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            type="button"
            onClick={handleAddToCart}
            className={cn(
              "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs",
              isAdded
                ? "bg-emerald-700 text-white"
                : "bg-[#16A34A] hover:bg-[#15803d] text-white hover:shadow-md"
            )}
          >
            {isAdded ? (
              <>
                <Check className="size-3.5" /> Added
              </>
            ) : (
              <>
                <ShoppingCart className="size-3.5" /> Add
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
