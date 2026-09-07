import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Phone, User, Heart, ShoppingBag, Menu,
  ChevronDown, ArrowRight, LayoutGrid, X
} from "lucide-react";
import { useStoreCart } from "@/contexts/StoreCartContext";
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
    { label: "About Us", href: "/store/about" },
    { label: "Shop", href: "/store/shop" },
    { label: "Single Product", href: "/store/product/org-1" },
    { label: "Cart", href: "/store/cart" },
    { label: "Checkout", href: "/store/checkout" },
    { label: "Blog", href: "/store/blog" },
    { label: "Single Post", href: "/store/blog/blog-1" },
    { label: "Styles & Components", href: "/store/styles" },
    { label: "Contact Us", href: "/store/contact" },
    { label: "Thank You Page", href: "/store/thank-you" },
    { label: "My Account", href: "/store/account" },
    { label: "404 Error Page", href: "/store/404" },
  ];

  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-40 shadow-xs">
      {/* ── Top Utility & Search Row ── */}
      <div className="container mx-auto px-4 py-3.5">
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
                src="/organic/images/logo.svg"
                alt="Organic"
                className="h-8 md:h-9 w-auto object-contain transition-transform group-hover:scale-105"
              />
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
                className="appearance-none bg-transparent pl-4 pr-7 py-2.5 text-xs font-semibold text-gray-700 outline-none cursor-pointer"
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
              placeholder="Search for more than 20,000 organic products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2.5 text-xs text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
            />

            {/* Submit button */}
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#6BB252] hover:bg-[#5ba342] text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <Search className="size-4" />
            </button>
          </form>

          {/* Right Action Utilities: Phone, Account, Wishlist, Cart */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Phone support */}
            <div className="hidden xl:flex items-center gap-2.5 border-r border-gray-200 pr-5">
              <div className="size-9 rounded-full bg-[#FAF8EF] text-[#6BB252] flex items-center justify-center border border-gray-200/50">
                <Phone className="size-4" />
              </div>
              <div className="text-left">
                <span className="block text-[10px] text-gray-400 font-medium uppercase leading-tight">
                  For Support?
                </span>
                <span className="block text-xs font-bold text-gray-800">
                  (800) 123-4567
                </span>
              </div>
            </div>

            {/* Account */}
            <Link
              to="/store/account"
              className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-colors"
              title="My Account"
            >
              <User className="size-5" />
            </Link>

            {/* Wishlist */}
            <Link
              to="/store/wishlist"
              className="size-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-700 relative transition-colors"
              title="Wishlist"
            >
              <Heart className="size-5" />
              {wishlistItems.length > 0 && (
                <span className="absolute top-1 right-1 size-4 bg-[#F95F09] text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none shadow-xs">
                  {wishlistItems.length}
                </span>
              )}
            </Link>

            {/* Cart Button */}
            <button
              type="button"
              onClick={onOpenCart}
              className="flex items-center gap-2.5 bg-[#FAF8EF] hover:bg-[#f2efe2] border border-gray-200/80 px-3.5 py-2 rounded-full transition-all cursor-pointer group"
            >
              <div className="relative text-[#6BB252]">
                <ShoppingBag className="size-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 size-4.5 bg-[#6BB252] text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none border-2 border-white shadow-xs">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <span className="block text-[10px] text-gray-400 uppercase font-medium leading-tight">
                  Your Cart
                </span>
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
