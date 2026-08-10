import { Search, ShoppingCart, User, ChevronDown, Phone, MapPin } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useState } from "react";

export function LazyMonkeyAIHeader() {
  const { cartCount } = useStoreCart();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({
        to: "/store/search",
        search: { q: searchQuery.trim() },
      });
    }
  };

  return (
    <header className="bg-white font-sans border-b border-[#E5E4E2]">
      {/* Top Banner */}
      <div className="bg-[#003d29] text-white text-xs py-2 px-4 flex justify-between items-center h-10">
        <div className="flex items-center space-x-2 w-1/3">
          <Phone className="h-3 w-3" />
          <span>+001234567890</span>
        </div>
        <div className="flex items-center justify-center w-1/3 text-center">
          <span>Get 50% Off on Selected Items</span>
          <span className="mx-2">|</span>
          <Link to="/store/shop" className="font-bold hover:underline">
            Shop Now
          </Link>
        </div>
        <div className="flex space-x-6 w-1/3 justify-end items-center">
          <div className="flex items-center cursor-pointer hover:text-gray-200">
            Eng <ChevronDown className="h-3 w-3 ml-1" />
          </div>
          <div className="flex items-center cursor-pointer hover:text-gray-200">
            Location <ChevronDown className="h-3 w-3 ml-1" />
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/store" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-8 h-8 flex items-center justify-center transition-transform group-hover:scale-105">
            <img src="/Logo.png" alt="Shopcart Logo" className="w-full h-full object-contain" />
          </div>
          <div className="text-2xl font-black tracking-tight text-[#003d29] hidden sm:block">
            Shopcart
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden lg:flex items-center space-x-6 mx-8 font-semibold text-gray-700 text-sm">
          <Link
            to="/store/shop"
            className="hover:text-[#003d29] transition-colors flex items-center"
          >
            Categories <ChevronDown className="h-4 w-4 ml-1" />
          </Link>
          <Link to="/store/shop" className="hover:text-[#003d29] transition-colors">
            Deals
          </Link>
          <Link to="/store/shop" className="hover:text-[#003d29] transition-colors">
            What's New
          </Link>
          <Link to="/store/pages" className="hover:text-[#003d29] transition-colors">
            Delivery
          </Link>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md hidden md:flex mx-4">
          <form
            onSubmit={handleSearch}
            className="flex w-full bg-gray-100 rounded-full overflow-hidden px-4 py-2 items-center focus-within:ring-2 focus-within:ring-[#003d29]/20 transition-all"
          >
            <input
              type="text"
              placeholder="Search Product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-500"
            />
            <button
              type="submit"
              className="text-gray-500 hover:text-[#003d29] transition-colors ml-2"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>

        {/* Icons */}
        <div className="flex items-center space-x-6 flex-shrink-0">
          <Link
            to="/store/account"
            className="text-gray-700 hover:text-[#003d29] transition-colors flex items-center space-x-2"
          >
            <User className="h-5 w-5" />
            <span className="text-sm font-semibold hidden md:block">Account</span>
          </Link>
          <Link
            to="/store/cart"
            className="text-gray-700 hover:text-[#003d29] transition-colors relative flex items-center space-x-2"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="text-sm font-semibold hidden md:block">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 left-3 bg-[#003d29] text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
