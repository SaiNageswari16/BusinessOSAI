import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useCurrency } from "@/hooks/use-currency";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import {
  Laptop,
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  ShieldCheck,
  ChevronDown,
  Cpu,
  Zap,
  PhoneCall,
  Headphones,
} from "lucide-react";

interface MegaHeaderProps {
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

export function MegaHeader({ onOpenCart, onOpenMenu }: MegaHeaderProps) {
  const navigate = useNavigate();
  const { theme, branding } = useStoreTheme();
  const { totalItems = 0, cartCount = 0, total = 0 } = useStoreCart();
  const { totalWishlistItems = 0, wishlistItems = [] } = useWishlist();
  const { user } = useStoreUser();
  const { formatCurrency } = useCurrency();
  const [searchQuery, setSearchQuery] = useState("");

  const safeTotalItems = totalItems || cartCount || 0;
  const safeWishlistItems = totalWishlistItems || (wishlistItems || []).length || 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ to: "/store/shop", search: { search: searchQuery.trim() } as any });
    }
  };

  const primaryColor = theme.primaryColor || "#0F172A";
  const accentColor = theme.accentColor || "#2563EB";

  const techCategories = [
    { label: "💻 Laptops & PCs", category: "Laptops" },
    { label: "📱 Smartphones", category: "Mobiles" },
    { label: "🎧 Audio & Sound", category: "Audio" },
    { label: "🎮 Gaming Gear", category: "Gaming" },
    { label: "⌚ Smart Watches", category: "Wearables" },
    { label: "🔌 Tech Accessories", category: "Accessories" },
  ];

  return (
    <header className="w-full bg-[#0F172A] text-slate-100 font-sans border-b border-slate-800 sticky top-0 z-40 shadow-md">
      {/* ── 1. Top Tech Announcement Bar ── */}
      <div className="bg-[#090D16] border-b border-slate-800/80 px-4 py-1 text-xs text-slate-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-blue-400 font-bold">
              <ShieldCheck className="size-3.5" /> 100% Genuine Certified Hardware
            </span>
            <span className="hidden sm:inline text-slate-500">&bull;</span>
            <span className="hidden sm:inline text-slate-400 truncate">
              {branding.announcementText || "Free Express Shipping on Orders Above ₹999 • Official Brand Warranty Included"}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Headphones className="size-3 text-blue-400" /> 24/7 Tech Support: {branding.supportPhone || "+91 98450 12345"}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Main Search & Navigation Bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          
          <button
            onClick={onOpenMenu}
            className="lg:hidden p-1.5 text-slate-300 hover:bg-slate-800 rounded-lg"
          >
            <Menu className="size-5" />
          </button>

          {/* Mega Brand Logo */}
          <Link to="/store" className="flex items-center gap-2.5 shrink-0">
            <div
              className="size-10 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: accentColor }}
            >
              <Laptop className="size-5" />
            </div>
            <div>
              <div className="text-xl font-black text-white leading-tight tracking-tight">
                {theme.name || "MegaStore"}
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-tight hidden sm:block">
                {theme.tagline || "Electronics, Gadgets & Hardware"}
              </div>
            </div>
          </Link>

          {/* Department Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-2xl hidden md:flex items-center bg-white rounded-xl overflow-hidden border border-slate-700 shadow-inner"
          >
            <div className="bg-slate-100 text-slate-700 px-3 py-2 text-xs font-bold border-r border-slate-200 flex items-center gap-1 shrink-0">
              <span>All Tech</span>
              <ChevronDown className="size-3 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search laptops, RTX GPUs, wireless earbuds, smart monitors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="px-5 py-2 font-bold text-xs text-white flex items-center gap-1 transition-opacity hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              <Search className="size-3.5" />
              <span>Search</span>
            </button>
          </form>

          {/* Right Action Icons */}
          <div className="flex items-center gap-3">
            <Link
              to="/store/account"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 text-xs font-semibold"
            >
              <User className="size-4 text-blue-400" />
              <span>{user ? user.first_name || "Account" : "Sign In"}</span>
            </Link>

            <Link
              to="/store/wishlist"
              className="relative p-2 text-slate-300 hover:bg-slate-800 rounded-xl"
              title="Saved Items"
            >
              <Heart className="size-4.5" />
              {safeWishlistItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-rose-500 text-white rounded-full size-4 flex items-center justify-center">
                  {safeWishlistItems}
                </span>
              )}
            </Link>

            <button
              onClick={onOpenCart}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all active:scale-95"
              style={{ backgroundColor: accentColor }}
            >
              <div className="relative">
                <ShoppingCart className="size-4 sm:size-4.5" />
                {safeTotalItems > 0 && (
                  <span className="absolute -top-2 -right-2 text-[9px] font-black bg-amber-400 text-slate-950 rounded-full size-4 flex items-center justify-center">
                    {safeTotalItems}
                  </span>
                )}
              </div>
              <div className="text-left hidden xs:block leading-tight">
                <div className="text-[10px] text-blue-100 uppercase font-bold">Cart</div>
                <div className="text-xs font-bold text-white">
                  {safeTotalItems > 0 ? formatCurrency(total) : "₹0"}
                </div>
              </div>
            </button>
          </div>

        </div>
      </div>

      {/* ── 3. Tech Department Category Strip ── */}
      <div className="bg-[#141E33] border-t border-slate-800/80 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 text-xs font-semibold whitespace-nowrap">
          <Link
            to="/store/shop"
            className="px-3 py-1 rounded-md bg-blue-600/30 text-blue-300 border border-blue-500/30 hover:bg-blue-600/40"
          >
            All Hardware
          </Link>

          {techCategories.map((c, i) => (
            <Link
              key={i}
              to="/store/shop"
              search={{ category: c.category } as any}
              className="px-3 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
