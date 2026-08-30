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
    <header className="bg-white font-sans border-b border-slate-200 shadow-xs">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-emerald-900 text-white text-xs py-2 px-4 flex justify-between items-center h-10">
        <div className="flex items-center space-x-2 w-1/3">
          <Phone className="h-3 w-3" />
          <span>+971 4 123 4567</span>
        </div>
        <div className="flex items-center justify-center w-1/3 text-center">
          <span className="font-semibold">Smart AI Store for Lazy Geniuses</span>
          <span className="mx-2">|</span>
          <Link to="/store/shop" className="font-bold text-amber-400 hover:underline">
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
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/store" className="flex items-center gap-2.5 group flex-shrink-0">
          <div className="size-9 flex items-center justify-center transition-transform group-hover:scale-105">
            <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="size-full object-contain drop-shadow-xs" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-slate-900 leading-none flex items-center">
              <span className="text-purple-700">Lazy</span>Monkey<span className="text-emerald-600">AI</span>
            </span>
            <span className="text-[10px] font-semibold mt-0.5 flex items-center gap-1">
              <span className="text-slate-600 font-medium">Smart</span>
              <span className="text-emerald-600 font-extrabold">AI</span>
              <span className="text-slate-600 font-medium">for</span>
              <span className="text-amber-600 font-bold">Lazy Geniuses</span>
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden lg:flex items-center space-x-6 mx-8 font-semibold text-slate-700 text-sm">
          <Link
            to="/store/shop"
            className="hover:text-purple-700 transition-colors flex items-center"
          >
            Categories <ChevronDown className="h-4 w-4 ml-1" />
          </Link>
          <Link to="/store/shop" className="hover:text-purple-700 transition-colors">
            Deals
          </Link>
          <Link to="/store/shop" className="hover:text-purple-700 transition-colors">
            What's New
          </Link>
          <Link to="/store/pages" className="hover:text-purple-700 transition-colors">
            Delivery
          </Link>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md hidden md:flex mx-4">
          <form
            onSubmit={handleSearch}
            className="flex w-full bg-slate-100 rounded-full overflow-hidden px-4 py-2 items-center focus-within:ring-2 focus-within:ring-purple-600/30 transition-all border border-slate-200"
          >
            <input
              type="text"
              placeholder="Search Product"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400"
            />
            <button
              type="submit"
              className="text-slate-500 hover:text-purple-700 transition-colors ml-2"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>

        {/* Icons */}
        <div className="flex items-center space-x-6 flex-shrink-0">
          <Link
            to="/store/account"
            className="text-slate-700 hover:text-purple-700 transition-colors flex items-center space-x-2"
          >
            <User className="h-5 w-5" />
            <span className="text-sm font-semibold hidden md:block">Account</span>
          </Link>
          <Link
            to="/store/cart"
            className="text-slate-700 hover:text-purple-700 transition-colors relative flex items-center space-x-2"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="text-sm font-semibold hidden md:block">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 left-3 bg-emerald-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center shadow-xs">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
