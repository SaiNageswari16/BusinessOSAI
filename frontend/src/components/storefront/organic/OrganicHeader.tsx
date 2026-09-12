import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Phone, User, Heart, ShoppingBag, Menu,
  ChevronDown, ArrowRight, LayoutGrid, X, Coins, Wallet, Sparkles, Package
} from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useCurrency } from "@/hooks/use-currency";
import { organicCategories as fallbackCategories, organicNavigationMenu } from "@/data/mockOrganicData";
import { fetchStorefrontCategories } from "@/lib/storefront-api";
import { cn } from "@/lib/utils";

interface Props {
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

export function OrganicHeader({ onOpenCart, onOpenMenu }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount, cartTotal, wishlistItems } = useStoreCart();
  const { user, isLoggedIn } = useStoreUser();
  const { currency } = useCurrency();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isPagesDropdownOpen, setIsPagesDropdownOpen] = useState(false);

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

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const pagesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (pagesDropdownRef.current && !pagesDropdownRef.current.contains(event.target as Node)) {
        setIsPagesDropdownOpen(false);
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
        category: selectedCategory !== "All Categories" ? selectedCategory : undefined,
      },
    });
  };

  const pagesSublinks = [
    { label: "Shop All Products", href: "/store/shop" },
    { label: "Live Order Tracking", href: "/store/orders" },
    { label: "My Customer Account", href: "/store/account" },
    { label: "Shopping Cart", href: "/store/cart" },
    { label: "Checkout & Delivery", href: "/store/checkout" },
    { label: "About LazyMonkey", href: "/store/about" },
    { label: "Store Contact", href: "/store/contact" },
  ];

  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-40 shadow-xs font-organic-body">
      {/* ── Top Utility & Search Row ── */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 lg:gap-8">
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenMenu}
              className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="size-6" />
            </button>

            <Link to="/store" className="flex items-center gap-2 group">
              <img
                src="/Logo.png"
                alt="LazyMonkey Store"
                className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div className="flex flex-col">
                <span className="font-black text-base text-gray-900 tracking-tight font-organic-heading leading-tight flex items-center gap-1">
                  LazyMonkey<span className="text-[#6BB252]">Store</span>
                </span>
                <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">
                  Omnichannel Marketplace
                </span>
              </div>
            </Link>
          </div>

          {/* Search Box with Integrated Category Selector */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-2xl items-center border-2 border-gray-200 focus-within:border-[#6BB252] rounded-full overflow-hidden transition-colors bg-[#FAF8EF]/40"
          >
            {/* Category select */}
            <div className="relative border-r border-gray-200">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none bg-transparent pl-4 pr-7 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer"
              >
                <option value="All Categories">All Categories</option>
                {categoriesList.map((c: any) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Query text input */}
            <input
              type="text"
              placeholder="Search across 2.65M+ products and groceries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 text-xs text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
            />

            {/* Submit button */}
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#6BB252] hover:bg-[#5ba342] text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Search className="size-4" />
            </button>
          </form>

          {/* Right Action Utilities: User Rewards, Account, Orders, Cart */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Logged in User Badges (Coins & Wallet) */}
            {isLoggedIn && user ? (
              <div className="hidden xl:flex items-center gap-2">
                {/* Coins Pill */}
                <Link
                  to="/store/account"
                  className="px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 text-[11px] font-bold border border-amber-500/20 flex items-center gap-1 transition-colors"
                  title="LazyMonkey Coins"
                >
                  <Coins className="size-3.5 text-amber-500" />
                  <span>{user.osaiCoins.toLocaleString()}</span>
                </Link>

                {/* Wallet Pill */}
                <Link
                  to="/store/account"
                  className="px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 text-[11px] font-bold border border-emerald-500/20 flex items-center gap-1 transition-colors"
                  title="Wallet Balance"
                >
                  <Wallet className="size-3.5 text-[#6BB252]" />
                  <span>{currency.symbol}{user.walletBalance.toFixed(0)}</span>
                </Link>
              </div>
            ) : null}

            {/* Orders Quick Link */}
            <Link
              to="/store/orders"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-gray-100 text-gray-700 text-xs font-bold transition-colors border border-transparent hover:border-gray-200"
              title="Track Orders"
            >
              <Package className="size-4 text-[#6BB252]" />
              <span className="hidden xl:inline">Track Orders</span>
            </Link>

            {/* Account / User Avatar */}
            <Link
              to="/store/account"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-gray-100 text-gray-700 text-xs font-bold transition-colors"
              title={isLoggedIn ? `Logged in as ${user?.name}` : "My Account"}
            >
              {isLoggedIn && user ? (
                <div className="size-7 rounded-full bg-[#6BB252] text-white text-[11px] font-black flex items-center justify-center shadow-2xs">
                  {user.firstName[0]?.toUpperCase() || "U"}
                </div>
              ) : (
                <User className="size-5" />
              )}
              <span className="hidden md:inline max-w-[100px] truncate">
                {isLoggedIn && user ? user.firstName : "Sign In"}
              </span>
            </Link>

            {/* Wishlist */}
            <Link
              to="/store/wishlist"
              className="size-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-700 relative transition-colors"
              title="Wishlist"
            >
              <Heart className="size-4.5" />
              {wishlistItems.length > 0 && (
                <span className="absolute top-0.5 right-0.5 size-4 bg-[#F95F09] text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none shadow-xs">
                  {wishlistItems.length}
                </span>
              )}
            </Link>

            {/* Cart Button */}
            <button
              type="button"
              onClick={onOpenCart}
              className="flex items-center gap-2 bg-[#FAF8EF] hover:bg-[#f2efe2] border border-gray-200/80 px-3 py-1.5 rounded-full transition-all cursor-pointer group"
            >
              <div className="relative text-[#6BB252]">
                <ShoppingBag className="size-4.5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 size-4.5 bg-[#6BB252] text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none border-2 border-white shadow-xs">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <span className="block font-extrabold text-gray-900 group-hover:text-[#6BB252]">
                  {currency.symbol}{cartTotal.toFixed(2)}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Secondary Navigation Bar (Categories & Pages Menu) ── */}
      <div className="border-t border-gray-100 bg-[#FAF8EF]/50">
        <div className="container mx-auto px-4 flex items-center justify-between">
          {/* All Categories Dropdown Button */}
          <div className="relative" ref={categoryDropdownRef}>
            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="flex items-center gap-2.5 bg-[#6BB252] text-white px-5 py-3 text-xs font-bold uppercase tracking-wider hover:bg-[#5ba342] transition-colors cursor-pointer"
            >
              <LayoutGrid className="size-4" />
              <span>All Categories</span>
              <ChevronDown
                className={cn("size-3.5 transition-transform duration-200", isCategoryOpen && "rotate-180")}
              />
            </button>

            {/* Category Dropdown Menu */}
            {isCategoryOpen && (
              <div className="absolute top-full left-0 w-64 bg-white border border-gray-200 shadow-xl rounded-b-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                {categoriesList.map((cat: any) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setIsCategoryOpen(false);
                      navigate({ to: "/store/shop", search: { category: cat.name } });
                    }}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-700 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <img src={cat.image || "/organic/images/category-thumb-1.jpg"} alt={cat.name} className="size-5 rounded-full object-cover" />
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-normal">({cat.itemCount || 24})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            <Link
              to="/store"
              className={cn(
                "px-3.5 py-3 text-xs font-bold text-gray-800 hover:text-[#6BB252] transition-colors",
                location.pathname === "/store" && "text-[#6BB252] border-b-2 border-[#6BB252]"
              )}
            >
              Home
            </Link>

            {/* Pages dropdown */}
            <div className="relative" ref={pagesDropdownRef}>
              <button
                type="button"
                onClick={() => setIsPagesDropdownOpen(!isPagesDropdownOpen)}
                className="flex items-center gap-1 px-3.5 py-3 text-xs font-bold text-gray-800 hover:text-[#6BB252] transition-colors cursor-pointer"
              >
                <span>Pages</span>
                <ChevronDown
                  className={cn("size-3.5 text-gray-400 transition-transform duration-200", isPagesDropdownOpen && "rotate-180")}
                />
              </button>

              {isPagesDropdownOpen && (
                <div className="absolute top-full left-0 w-52 bg-white border border-gray-200 shadow-xl rounded-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {pagesSublinks.map((item, idx) => (
                    <Link
                      key={idx}
                      to={item.href}
                      onClick={() => setIsPagesDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-medium text-gray-700 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/store/shop"
              className="px-3.5 py-3 text-xs font-bold text-gray-800 hover:text-[#6BB252] transition-colors"
            >
              Shop
            </Link>

            <Link
              to="/store/blog"
              className="px-3.5 py-3 text-xs font-bold text-gray-800 hover:text-[#6BB252] transition-colors"
            >
              Blog
            </Link>

            <Link
              to="/store/about"
              className="px-3.5 py-3 text-xs font-bold text-gray-800 hover:text-[#6BB252] transition-colors"
            >
              About Us
            </Link>

            <Link
              to="/store/contact"
              className="px-3.5 py-3 text-xs font-bold text-gray-800 hover:text-[#6BB252] transition-colors"
            >
              Contact
            </Link>
          </nav>

          {/* Quick promotion ticker / link */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="bg-[#F95F09]/10 text-[#F95F09] font-extrabold px-2.5 py-1 rounded-full text-[10px]">
              Special Offer
            </span>
            <Link
              to="/store/shop"
              className="text-gray-600 hover:text-[#6BB252] font-semibold text-xs flex items-center gap-1 transition-colors"
            >
              Free Delivery on orders over $50 <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
