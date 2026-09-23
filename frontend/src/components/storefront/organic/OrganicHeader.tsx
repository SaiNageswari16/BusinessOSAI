import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Heart, User, ShoppingBag, Menu,
  ChevronDown, X
} from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useStoreUser } from "@/contexts/StoreUserContext";
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
  const { cartCount, wishlistItems } = useStoreCart();
  const { user, isLoggedIn } = useStoreUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [isCategoriesDropdownOpen, setIsCategoriesDropdownOpen] = useState(false);

  const { data: dynamicCategories } = useQuery({
    queryKey: ["storefront-header-categories"],
    queryFn: () => fetchStorefrontCategories(),
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
        search: searchQuery,
      },
    });
  };

  const shopSublinks = [
    { label: "All Products", href: "/store/shop" },
    { label: "Electronics & Tech", href: "/store/shop", search: { category: "Electronics" } },
    { label: "Fashion & Footwear", href: "/store/shop", search: { category: "Fashion" } },
    { label: "Home & Kitchen", href: "/store/shop", search: { category: "Home & Kitchen" } },
    { label: "Beauty & Personal Care", href: "/store/shop", search: { category: "Beauty" } },
    { label: "Groceries & Essentials", href: "/store/shop", search: { category: "Groceries" } },
  ];

  const isHomeActive = location.pathname === "/store" || location.pathname === "/store/";

  return (
    <header className="w-full bg-white border-b border-gray-100/80 sticky top-0 z-40 shadow-xs font-sans">
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

            <Link to="/store" className="flex items-center gap-2 group">
              {/* Cute monkey logo with leaf matching ss2 */}
              <div className="size-9 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center text-xl shadow-2xs group-hover:scale-105 transition-transform overflow-hidden relative">
                <span className="text-xl select-none">🐵</span>
                <span className="absolute -top-0.5 right-0 text-[10px] text-emerald-600 font-black">🌱</span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-gray-900 tracking-tight leading-tight flex items-center">
                  LazyMonkey<span className="text-[#16A34A]">AI</span>
                </span>
                <span className="text-[7.5px] sm:text-[8px] font-bold text-gray-400 tracking-[0.2em] uppercase">
                  WORK SMARTER • LIVE BETTER
                </span>
              </div>
            </Link>
          </div>

          {/* ── Center: Main Navigation Menu (Exact like ss2) ── */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7 text-sm font-semibold">
            {/* Home Link */}
            <Link
              to="/store"
              className={cn(
                "relative py-2 transition-colors",
                isHomeActive
                  ? "text-[#16A34A] font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-[#16A34A] after:rounded-full"
                  : "text-gray-700 hover:text-[#16A34A]"
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
                  "flex items-center gap-1 py-2 text-gray-700 hover:text-[#16A34A] transition-colors cursor-pointer",
                  location.pathname.startsWith("/store/shop") && !isHomeActive && "text-[#16A34A] font-bold"
                )}
              >
                <span>Shop</span>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", isShopDropdownOpen && "rotate-180")} />
              </button>

              {isShopDropdownOpen && (
                <div className="absolute top-full left-0 w-52 bg-white border border-gray-100 shadow-xl rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {shopSublinks.map((item, idx) => (
                    <Link
                      key={idx}
                      to={item.href}
                      search={item.search}
                      onClick={() => setIsShopDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-medium text-gray-700 hover:bg-emerald-50/60 hover:text-[#16A34A] transition-colors"
                    >
                      {item.label}
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
                className="flex items-center gap-1 py-2 text-gray-700 hover:text-[#16A34A] transition-colors cursor-pointer"
              >
                <span>Categories</span>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", isCategoriesDropdownOpen && "rotate-180")} />
              </button>

              {isCategoriesDropdownOpen && (
                <div className="absolute top-full left-0 w-60 bg-white border border-gray-100 shadow-xl rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {categoriesList.slice(0, 8).map((cat: any) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setIsCategoriesDropdownOpen(false);
                        navigate({ to: "/store/shop", search: { category: cat.name } });
                      }}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-gray-700 hover:bg-emerald-50/60 hover:text-[#16A34A] transition-colors cursor-pointer text-left"
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="text-[10px] text-gray-400 font-normal">({cat.itemCount || 24})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Offers */}
            <Link
              to="/store/shop"
              search={{ filter: "sale" }}
              className="py-2 text-gray-700 hover:text-[#16A34A] transition-colors"
            >
              Offers
            </Link>

            {/* Orders */}
            <Link
              to="/store/orders"
              className={cn(
                "py-2 transition-colors",
                location.pathname.startsWith("/store/orders")
                  ? "text-[#16A34A] font-bold"
                  : "text-gray-700 hover:text-[#16A34A]"
              )}
            >
              Orders
            </Link>

            {/* Help */}
            <Link
              to="/store/contact"
              className={cn(
                "py-2 transition-colors",
                location.pathname.startsWith("/store/contact")
                  ? "text-[#16A34A] font-bold"
                  : "text-gray-700 hover:text-[#16A34A]"
              )}
            >
              Help
            </Link>
          </nav>

          {/* ── Search Input (Exact rounded pill like ss2) ── */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center flex-1 max-w-sm xl:max-w-md bg-gray-50/90 border border-gray-200/80 rounded-full px-3.5 py-1.5 focus-within:border-[#16A34A] focus-within:bg-white transition-all shadow-2xs"
          >
            <Search className="size-4 text-gray-400 shrink-0 mr-2" />
            <input
              type="text"
              placeholder="Search for products, brands, and more..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400"
            />
          </form>

          {/* ── Right Icons: Wishlist, Profile, Cart with Badge ── */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Wishlist Icon */}
            <Link
              to="/store/wishlist"
              className="p-2 text-gray-700 hover:text-[#16A34A] transition-colors relative"
              title="Wishlist"
            >
              <Heart className="size-5 stroke-[1.8]" />
              {wishlistItems.length > 0 && (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-[#16A34A]" />
              )}
            </Link>

            {/* Account / User Avatar */}
            <Link
              to="/store/account"
              className="p-2 text-gray-700 hover:text-[#16A34A] transition-colors"
              title={isLoggedIn ? `Account: ${user?.name}` : "Sign In"}
            >
              <User className="size-5 stroke-[1.8]" />
            </Link>

            {/* Shopping Cart Icon with Badge (like ss2 green badge '3') */}
            <button
              type="button"
              onClick={onOpenCart}
              className="p-2 text-gray-700 hover:text-[#16A34A] transition-colors relative cursor-pointer"
              title="Shopping Cart"
            >
              <ShoppingBag className="size-5 stroke-[1.8]" />
              <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 bg-[#16A34A] text-white text-[9.5px] font-black rounded-full flex items-center justify-center leading-none shadow-2xs">
                {cartCount > 0 ? cartCount : 3}
              </span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
