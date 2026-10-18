import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useCurrency } from "@/hooks/use-currency";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import {
  Zap,
  Clock,
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  MapPin,
  ChevronDown,
  Sparkles,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickMartHeaderProps {
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

export function QuickMartHeader({ onOpenCart, onOpenMenu }: QuickMartHeaderProps) {
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

  const quickCategories = [
    { label: "⚡ 10-Min Munchies", category: "Snacks" },
    { label: "🥛 Milk & Dairy", category: "Dairy" },
    { label: "🥤 Cold Drinks", category: "Beverages" },
    { label: "🍞 Bread & Bakery", category: "Bakery" },
    { label: "🥬 Fresh Fruits & Veg", category: "Produce" },
    { label: "🍫 Chocolates & Sweets", category: "Sweets" },
    { label: "🧴 Personal Care", category: "Personal Care" },
  ];

  const primaryColor = theme.primaryColor || "#7C3AED";
  const accentColor = theme.accentColor || "#F59E0B";

  return (
    <header className="w-full bg-white border-b border-purple-100/80 sticky top-0 z-40 font-sans shadow-xs">
      {/* ── 1. Top Express Ticker ── */}
      <div
        className="px-4 py-1.5 text-xs font-bold text-white flex items-center justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs">
            <span className="flex items-center gap-1 bg-amber-400 text-purple-950 font-black px-2 py-0.5 rounded-full text-[10px] tracking-wide uppercase shadow-2xs">
              <Zap className="size-3 fill-current" /> 10-Min Delivery
            </span>
            <span className="truncate">
              {branding.announcementText || "⚡ Hyperlocal instant essentials delivered in 10 minutes flat • Midnight orders open!"}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4 text-[11px] text-purple-200">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="size-3 text-amber-300" /> Average dispatch time: <strong className="text-white">4 mins</strong>
            </span>
            <span className="flex items-center gap-1">
              <PhoneCall className="size-3 text-amber-300" /> Helpline: {branding.supportPhone || "+91 98450 12345"}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Main Quick Mart Header ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3 md:gap-6">
          
          {/* Mobile menu trigger */}
          <button
            onClick={onOpenMenu}
            className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>

          {/* Logo & Delivery Location */}
          <div className="flex items-center gap-4 shrink-0">
            <Link to="/store" className="flex items-center gap-2.5 group">
              <div
                className="size-9 sm:size-10 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform"
                style={{ backgroundColor: primaryColor }}
              >
                <Zap className="size-5 fill-amber-300 text-amber-300" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg sm:text-xl tracking-tight leading-tight text-slate-900 flex items-center gap-1">
                  {theme.name || "ExpressMart"}
                  <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 tracking-wider">
                    FAST
                  </span>
                </span>
                <span className="text-[10px] text-slate-500 font-semibold tracking-tight hidden sm:block">
                  {theme.tagline || "10-Minute Hyperlocal Quick Commerce"}
                </span>
              </div>
            </Link>

            {/* Hyperlocal Darkstore Badge */}
            <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-slate-200 text-xs">
              <div className="size-7 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600">
                <MapPin className="size-3.5" />
              </div>
              <div className="text-left leading-tight">
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span>Deliver in 10 Mins</span>
                  <ChevronDown className="size-3 text-slate-400" />
                </div>
                <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                  BTM 2nd Stage, Bengaluru
                </div>
              </div>
            </div>
          </div>

          {/* Center Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-xl hidden md:flex items-center bg-slate-100/90 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3.5 py-2 transition-all focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 focus-within:bg-white"
          >
            <Search className="size-4 text-slate-400 shrink-0 mr-2" />
            <input
              type="text"
              placeholder="Search 'milk', 'potato chips', 'cold drink', 'chocolates'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-slate-800 outline-none placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs text-slate-400 hover:text-slate-600 px-1 cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="ml-2 text-xs font-bold px-3 py-1 rounded-lg text-white shrink-0 cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              Search
            </button>
          </form>

          {/* Right Action Icons: Login, Wishlist & Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/store/account"
              className="hidden sm:flex items-center gap-1.5 p-2 rounded-xl text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer text-xs font-semibold"
            >
              <User className="size-4" />
              <span>{user ? user.first_name || "Account" : "Sign In"}</span>
            </Link>

            <Link
              to="/store/wishlist"
              className="relative p-2 rounded-xl text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer"
              title="Saved Items"
            >
              <Heart className="size-4.5" />
              {safeWishlistItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 text-[9px] font-black bg-rose-500 text-white rounded-full size-4 flex items-center justify-center">
                  {safeWishlistItems}
                </span>
              )}
            </Link>

            {/* Quick Cart Button with Total */}
            <button
              onClick={onOpenCart}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="relative">
                <ShoppingCart className="size-4 sm:size-4.5 text-amber-300" />
                {safeTotalItems > 0 && (
                  <span
                    className="absolute -top-2 -right-2 text-[9px] font-black text-purple-950 rounded-full size-4 flex items-center justify-center shadow-xs"
                    style={{ backgroundColor: accentColor }}
                  >
                    {safeTotalItems}
                  </span>
                )}
              </div>
              <div className="text-left hidden xs:block leading-tight">
                <div className="text-[10px] text-purple-200 uppercase font-black tracking-wide">
                  {safeTotalItems > 0 ? `${safeTotalItems} items` : "My Cart"}
                </div>
                <div className="text-xs font-extrabold text-white">
                  {safeTotalItems > 0 ? formatCurrency(total) : "Empty"}
                </div>
              </div>
            </button>
          </div>

        </div>

        {/* Mobile search bar visible on small devices */}
        <form
          onSubmit={handleSearchSubmit}
          className="mt-2.5 md:hidden flex items-center bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200"
        >
          <Search className="size-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search snacks, groceries, instant food..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 outline-none"
          />
        </form>
      </div>

      {/* ── 3. Quick Commerce Category Rail ── */}
      <div className="border-t border-slate-100 bg-slate-50/70 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 text-xs font-bold whitespace-nowrap">
          <Link
            to="/store/shop"
            className="px-3 py-1 rounded-full bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1 shrink-0 hover:bg-purple-200 transition-colors"
          >
            <span>All Categories</span>
          </Link>

          {quickCategories.map((c, i) => (
            <Link
              key={i}
              to="/store/shop"
              search={{ category: c.category } as any}
              className="px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-purple-400 hover:text-purple-700 transition-all shrink-0 shadow-2xs"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
