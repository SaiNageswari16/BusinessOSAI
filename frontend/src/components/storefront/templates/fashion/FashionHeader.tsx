import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import {
  ShoppingBag,
  Heart,
  Search,
  User,
  Menu,
  Sparkles,
  ChevronDown
} from "lucide-react";

interface FashionHeaderProps {
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

export function FashionHeader({ onOpenCart, onOpenMenu }: FashionHeaderProps) {
  const navigate = useNavigate();
  const { totalItems = 0, cartCount = 0 } = useStoreCart();
  const { totalWishlistItems = 0, wishlistItems = [] } = useWishlist();
  const safeTotalItems = totalItems || cartCount || 0;
  const safeWishlistItems = totalWishlistItems || (wishlistItems || []).length || 0;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ to: "/store/shop", search: { q: searchQuery.trim() } as any });
      setSearchOpen(false);
    }
  };

  return (
    <header className="w-full bg-white text-zinc-900 border-b border-zinc-200/80 sticky top-0 z-40 font-sans shadow-2xs">
      {/* ── Top Announcement Bar ── */}
      <div className="bg-zinc-950 text-white text-[11px] font-medium tracking-widest uppercase text-center py-2 px-4">
        <span>Complimentary Express Courier on Orders Above ₹1,999 &bull; 14-Day Boutique Exchanges</span>
      </div>

      {/* ── Main Editorial Header ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMenu}
          className="lg:hidden p-1.5 text-zinc-900 hover:bg-zinc-100 rounded-lg cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Left Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold tracking-wider uppercase text-zinc-700">
          <Link to="/store/shop" className="hover:text-black transition-colors">
            New Arrivals
          </Link>
          <Link to="/store/shop" search={{ category: "Women" } as any} className="hover:text-black transition-colors">
            Women
          </Link>
          <Link to="/store/shop" search={{ category: "Men" } as any} className="hover:text-black transition-colors">
            Men
          </Link>
          <Link to="/store/shop" search={{ category: "Accessories" } as any} className="hover:text-black transition-colors">
            Jewelry & Bags
          </Link>
          <Link to="/store/shop" className="text-rose-600 font-bold hover:text-rose-700 transition-colors">
            End of Season Sale
          </Link>
        </nav>

        {/* Centered Editorial Brand Title */}
        <Link to="/store" className="text-center group">
          <div className="text-2xl sm:text-3xl font-black tracking-[0.2em] uppercase font-serif text-zinc-950 leading-none">
            VOGUE & CO.
          </div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-zinc-400 font-sans mt-0.5">
            Atelier &bull; High Fashion
          </div>
        </Link>

        {/* Right Action Icons: Search, Wishlist, Bag */}
        <div className="flex items-center gap-4">
          {/* Search Trigger */}
          <div className="relative">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center">
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                  placeholder="Search designer wear..."
                  className="w-48 sm:w-64 h-8 pl-3 pr-8 rounded-full border border-zinc-300 text-xs text-zinc-900 outline-none focus:border-zinc-900"
                />
                <button type="submit" className="absolute right-2 text-zinc-500">
                  <Search className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1 text-zinc-800 hover:text-black transition-colors cursor-pointer"
                title="Search Collection"
              >
                <Search className="w-5 h-5 stroke-[1.75]" />
              </button>
            )}
          </div>

          {/* Wishlist */}
          <Link
            to="/store/shop"
            className="p-1 text-zinc-800 hover:text-black transition-colors relative"
            title="Wishlist"
          >
            <Heart className="w-5 h-5 stroke-[1.75]" />
            {safeWishlistItems > 0 && (
              <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-rose-600 text-white text-[8px] font-bold flex items-center justify-center">
                {safeWishlistItems}
              </span>
            )}
          </Link>

          {/* Cart Bag */}
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2 p-1 text-zinc-950 hover:opacity-80 transition-opacity cursor-pointer relative"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5 stroke-[1.75]" />
              {safeTotalItems > 0 && (
                <span className="absolute -top-1.5 -right-2 size-4 rounded-full bg-zinc-950 text-white text-[9px] font-black flex items-center justify-center">
                  {safeTotalItems}
                </span>
              )}
            </div>
            <span className="hidden sm:inline text-xs font-bold tracking-wider uppercase">
              Bag ({safeTotalItems})
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
