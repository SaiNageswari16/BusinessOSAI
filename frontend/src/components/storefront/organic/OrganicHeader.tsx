import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Heart, User, ShoppingBag, Menu,
  ChevronDown, X
} from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useStoreTheme } from "@/contexts/StoreThemeContext";
import { useCurrency } from "@/hooks/use-currency";
import { organicCategories as fallbackCategories } from "@/data/mockOrganicData";
import { fetchStorefrontCategories } from "@/lib/storefront-api";
import { cn } from "@/lib/utils";

interface Props {
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

export function OrganicHeader({ onOpenCart, onOpenMenu }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, branding, storeSlug, getStoreUrl } = useStoreTheme();
  const { cartCount, wishlistItems } = useStoreCart();
  const { user, isLoggedIn } = useStoreUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [isCategoriesDropdownOpen, setIsCategoriesDropdownOpen] = useState(false);

  const { data: dynamicCategories } = useQuery({
    queryKey: ["storefront-header-categories", storeSlug],
    queryFn: () => fetchStorefrontCategories(undefined, storeSlug || undefined),
    staleTime: 60000,
  });

  const categoriesList = useMemo(() => {
    if (dynamicCategories && dynamicCategories.length > 0) {
      return dynamicCategories;
    }
    return fallbackCategories;
  }, [dynamicCategories]);

  const shopDropdownRef = useRef<HTMLDivElement>(null);
  const categoriesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(event.target as Node)) {
        setIsShopDropdownOpen(false);
      }
      if (categoriesDropdownRef.current && !categoriesDropdownRef.current.contains(event.target as Node)) {
        setIsCategoriesDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate({
      to: "/store/shop",
      search: {
        search: searchQuery.trim(),
        store: storeSlug || undefined,
      } as any,
    });
  };

  const isHomeActive =
    location.pathname === "/store" ||
    location.pathname === "/store/" ||
    (storeSlug && (location.pathname === `/store/${storeSlug}` || location.pathname === `/store/${storeSlug}/`));

  const effectiveStoreName = branding.storeName?.trim() || theme.name || "BusinessOS Store";
  const effectiveTagline = branding.tagline?.trim() || theme.tagline || "WORK SMARTER • LIVE BETTER";

  return (
    <header className="w-full bg-white border-b border-gray-100/80 sticky top-0 z-40 shadow-xs font-sans">
      {/* ── Top Announcement Bar ── */}
      <div
        className="w-full px-4 py-1.5 text-xs font-semibold text-white flex items-center justify-between transition-colors shadow-2xs"
        style={{ backgroundColor: theme.primaryColor || "#16A34A" }}
      >
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="truncate">
            {branding.announcementText || "🌿 Special Offer: Free Express Delivery on orders above ₹499 • 100% Certified Sourcing"}
          </span>
          {branding.supportPhone && (
            <span className="hidden md:flex items-center gap-1.5 text-[11px] font-medium opacity-95 shrink-0 ml-4">
              Helpline: {branding.supportPhone}
            </span>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4 lg:gap-6">
          
          {/* ── Left: Logo with Mobile Menu ── */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenMenu}
              className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="size-5.5" />
            </button>

            <Link to={getStoreUrl("") as any} className="flex items-center gap-2 group">
              <div
                className="size-9 rounded-xl flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform overflow-hidden relative"
                style={{ backgroundColor: theme.primaryColor || "#16A34A" }}
              >
                <span className="text-lg select-none">🛍️</span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-gray-900 tracking-tight leading-tight flex items-center">
                  {effectiveStoreName}
                </span>
                <span className="text-[7.5px] sm:text-[8px] font-bold text-gray-400 tracking-[0.2em] uppercase truncate max-w-[150px]">
                  {effectiveTagline}
                </span>
              </div>
            </Link>
          </div>

          {/* ── Center: Main Navigation Menu ── */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7 text-sm font-semibold">
            {/* Home Link */}
            <Link
              to={getStoreUrl("") as any}
              style={isHomeActive ? { color: theme.primaryColor } : undefined}
              className={cn(
                "relative py-2 transition-colors",
                isHomeActive
                  ? "font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:rounded-full"
                  : "text-gray-700 hover:text-gray-950"
              )}
            >
              Home
            </Link>

            {/* Shop Dropdown */}
            <div className="relative" ref={shopDropdownRef}>
              <button
                type="button"
                onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
                className={cn(
                  "flex items-center gap-1 py-2 text-gray-700 transition-colors cursor-pointer hover:opacity-85",
                  location.pathname.includes("/shop") && "font-bold"
                )}
                style={location.pathname.includes("/shop") ? { color: theme.primaryColor } : undefined}
              >
                <span>Shop</span>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", isShopDropdownOpen && "rotate-180")} />
              </button>

              {isShopDropdownOpen && (
                <div className="absolute top-full left-0 w-52 bg-white border border-gray-100 shadow-xl rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <Link
                    to={getStoreUrl("/shop") as any}
                    onClick={() => setIsShopDropdownOpen(false)}
                    className="block px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    All Products
                  </Link>
                  {categoriesList.slice(0, 6).map((cat: any) => (
                    <Link
                      key={cat.id || cat.name}
                      to={getStoreUrl("/shop") as any}
                      search={{ category: cat.name, store: storeSlug || undefined } as any}
                      onClick={() => setIsShopDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors truncate"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Categories Dropdown */}
            <div className="relative" ref={categoriesDropdownRef}>
              <button
                type="button"
                onClick={() => setIsCategoriesDropdownOpen(!isCategoriesDropdownOpen)}
                className="flex items-center gap-1 py-2 text-gray-700 transition-colors cursor-pointer hover:opacity-85"
              >
                <span>Categories</span>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", isCategoriesDropdownOpen && "rotate-180")} />
              </button>

              {isCategoriesDropdownOpen && (
                <div className="absolute top-full left-0 w-60 bg-white border border-gray-100 shadow-xl rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {categoriesList.slice(0, 8).map((cat: any) => (
                    <button
                      key={cat.id || cat.name}
                      type="button"
                      onClick={() => {
                        setIsCategoriesDropdownOpen(false);
                        navigate({
                          to: "/store/shop",
                          search: { category: cat.name, store: storeSlug || undefined } as any,
                        });
                      }}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer text-left"
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="text-[10px] text-gray-400 font-normal">({cat.itemCount || 12})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Offers */}
            <Link
              to={getStoreUrl("/shop") as any}
              search={{ filter: "sale", store: storeSlug || undefined } as any}
              className="py-2 text-gray-700 hover:opacity-85 transition-colors"
            >
              Offers
            </Link>

            {/* Orders */}
            <Link
              to={getStoreUrl("/orders") as any}
              className={cn(
                "py-2 transition-colors",
                location.pathname.includes("/orders") ? "font-bold" : "text-gray-700 hover:opacity-85"
              )}
              style={location.pathname.includes("/orders") ? { color: theme.primaryColor } : undefined}
            >
              Orders
            </Link>

            {/* Help */}
            <Link
              to={getStoreUrl("/contact") as any}
              className={cn(
                "py-2 transition-colors",
                location.pathname.includes("/contact") ? "font-bold" : "text-gray-700 hover:opacity-85"
              )}
              style={location.pathname.includes("/contact") ? { color: theme.primaryColor } : undefined}
            >
              Help
            </Link>
          </nav>

          {/* ── Search Input ── */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center flex-1 max-w-sm xl:max-w-md bg-gray-50/90 border border-gray-200/80 rounded-full px-3.5 py-1.5 focus-within:bg-white transition-all shadow-2xs"
          >
            <Search className="size-4 text-gray-400 shrink-0 mr-2" />
            <input
              type="text"
              placeholder={`Search ${effectiveStoreName}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400"
            />
          </form>

          {/* ── Right Icons: Wishlist, Profile, Cart with Badge ── */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Wishlist Icon */}
            <Link
              to={getStoreUrl("/wishlist") as any}
              className="p-2 text-gray-700 hover:text-gray-950 transition-colors relative"
              title="Wishlist"
            >
              <Heart className="size-5 stroke-[1.8]" />
              {wishlistItems.length > 0 && (
                <span
                  className="absolute top-1 right-1 size-2 rounded-full"
                  style={{ backgroundColor: theme.primaryColor || "#16A34A" }}
                />
              )}
            </Link>

            {/* Account / User Avatar */}
            <Link
              to={getStoreUrl("/account") as any}
              className="p-2 text-gray-700 hover:text-gray-950 transition-colors"
              title={isLoggedIn ? `Account: ${user?.name}` : "Sign In"}
            >
              <User className="size-5 stroke-[1.8]" />
            </Link>

            {/* Shopping Cart Icon with Badge */}
            <button
              type="button"
              onClick={onOpenCart}
              className="p-2 text-gray-700 hover:text-gray-950 transition-colors relative cursor-pointer"
              title="Shopping Cart"
            >
              <ShoppingBag className="size-5 stroke-[1.8]" />
              <span
                className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 text-white text-[9.5px] font-black rounded-full flex items-center justify-center leading-none shadow-2xs"
                style={{ backgroundColor: theme.accentColor || theme.primaryColor || "#16A34A" }}
              >
                {cartCount > 0 ? cartCount : 0}
              </span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
