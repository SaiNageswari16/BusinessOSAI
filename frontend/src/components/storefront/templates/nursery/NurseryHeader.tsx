import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useCurrency } from "@/hooks/use-currency";
import {
  Sprout,
  Search,
  ShoppingCart,
  Heart,
  User,
  PhoneCall,
  Menu,
  Sun,
  Droplets,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Leaf
} from "lucide-react";

interface NurseryHeaderProps {
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

export function NurseryHeader({ onOpenCart, onOpenMenu }: NurseryHeaderProps) {
  const navigate = useNavigate();
  const { totalItems } = useStoreCart();
  const { totalWishlistItems } = useWishlist();
  const { user } = useStoreUser();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ to: "/store/shop", search: { q: searchQuery.trim() } as any });
    }
  };

  return (
    <header className="w-full bg-[#FAF8F5] border-b border-[#E6E0D5] text-[#1B4D3E] font-sans sticky top-0 z-40 transition-colors shadow-2xs">
      {/* ── Top Botanical Announcement Bar ── */}
      <div className="bg-[#1B4D3E] text-[#E8F3EE] px-4 py-1.5 text-xs font-semibold flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-3.5 h-3.5 text-[#86EFAC]" />
            <span>100% Organically Nurtured Plants &bull; Free Plant Health Guarantee &bull; Same-Day Eco Dispatch</span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-[#A7F3D0]">
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-amber-300" /> Free Sunlight & Care Guide With Every Plant
            </span>
            <span className="flex items-center gap-1 font-bold text-white">
              <PhoneCall className="w-3 h-3" /> Plant Doctor: +91 98450 12345
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Strip ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMenu}
          className="lg:hidden p-2 text-[#1B4D3E] hover:bg-[#EAE4D7] rounded-xl cursor-pointer"
          aria-label="Open mobile menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Brand Logo */}
        <Link to="/store" className="flex items-center gap-2.5 text-decoration-none group">
          <div className="size-10 rounded-2xl bg-gradient-to-br from-[#1B4D3E] to-[#2D735C] text-white flex items-center justify-center shadow-md shadow-[#1B4D3E]/20 group-hover:scale-105 transition-transform">
            <Sprout className="w-6 h-6 text-[#86EFAC]" />
          </div>
          <div>
            <div className="text-xl font-black tracking-tight text-[#1B4D3E] leading-none font-serif flex items-center gap-1.5">
              <span>GreenFlora</span>
              <span className="text-[10px] font-sans font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-[#E8F3EE] text-[#1B4D3E] border border-[#C5E1D4]">
                Nursery
              </span>
            </div>
            <p className="text-[10px] text-[#5A7A6D] font-medium tracking-wide mt-0.5">
              Botanicals, Ceramic Pots & Living Decor
            </p>
          </div>
        </Link>

        {/* Botanical Live Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-lg mx-6 relative"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search air-purifying plants, bonsai, ceramic planters, organic soil..."
            className="w-full h-11 pl-10 pr-24 rounded-full bg-white border border-[#D5CDC0] text-sm text-[#1B4D3E] placeholder:text-[#889E94] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E] focus:border-transparent shadow-xs transition-all"
          />
          <Search className="w-4 h-4 text-[#5A7A6D] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <button
            type="submit"
            className="absolute right-1 top-1 bottom-1 px-4 rounded-full bg-[#1B4D3E] text-white text-xs font-bold hover:bg-[#153D31] transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Action Controls: Wishlist, Cart, Profile */}
        <div className="flex items-center gap-2">
          {/* Wishlist */}
          <Link
            to="/store/shop"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#1B4D3E] hover:bg-[#EAE4D7] transition-colors"
          >
            <div className="relative">
              <Heart className="w-5 h-5 text-[#C25E3E]" />
              {totalWishlistItems > 0 && (
                <span className="absolute -top-1.5 -right-2 size-4 rounded-full bg-[#C25E3E] text-white text-[9px] font-black flex items-center justify-center">
                  {totalWishlistItems}
                </span>
              )}
            </div>
            <span className="hidden xl:inline">Wishlist</span>
          </Link>

          {/* Plant Cart Button */}
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1B4D3E] text-white hover:bg-[#153D31] transition-all shadow-md shadow-[#1B4D3E]/20 cursor-pointer active:scale-95"
          >
            <div className="relative">
              <ShoppingCart className="w-4 h-4 text-[#86EFAC]" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2.5 size-4.5 rounded-full bg-[#C25E3E] text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="text-xs font-bold tracking-wide hidden sm:inline">
              Garden Cart ({totalItems})
            </span>
          </button>
        </div>
      </div>

      {/* ── Sub Navigation Links Strip ── */}
      <div className="bg-[#FAF8F5] border-t border-[#E6E0D5]/70 hidden lg:block">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between text-xs font-bold text-[#2D5A4A]">
          <div className="flex items-center gap-6">
            <Link to="/store/shop" className="hover:text-[#1B4D3E] transition-colors flex items-center gap-1">
              <Leaf className="w-3.5 h-3.5 text-[#16A34A]" /> All Botanicals
            </Link>
            <Link to="/store/shop" search={{ category: "Indoor Plants" } as any} className="hover:text-[#1B4D3E] transition-colors">
              Indoor & Air Purifiers
            </Link>
            <Link to="/store/shop" search={{ category: "Flowering & Bonsai" } as any} className="hover:text-[#1B4D3E] transition-colors">
              Flowering & Bonsai
            </Link>
            <Link to="/store/shop" search={{ category: "Pots & Planters" } as any} className="hover:text-[#1B4D3E] transition-colors">
              Pots & Planters
            </Link>
            <Link to="/store/shop" search={{ category: "Soil & Fertilizers" } as any} className="hover:text-[#1B4D3E] transition-colors">
              Soil, Seeds & Nutrition
            </Link>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-[#C25E3E] font-extrabold uppercase tracking-wider">
            <span>🌿 Plant Care Advice & Tips</span>
          </div>
        </div>
      </div>
    </header>
  );
}
