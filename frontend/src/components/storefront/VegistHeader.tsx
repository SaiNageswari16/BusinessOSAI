import { Search, ShoppingBag, Heart, User, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useState } from "react";

export function VegistHeader() {
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
    <header className="bg-white border-b border-gray-100 font-sans">
      {/* Top Banner */}
      <div className="bg-blue-600 text-white text-xs py-2 px-4 flex justify-between items-center">
        <div>Free shipping orders from all item</div>
        <div className="flex space-x-4">
          <div className="flex items-center cursor-pointer hover:text-gray-200">
            English <ChevronDown className="h-3 w-3 ml-1" />
          </div>
          <div className="flex items-center cursor-pointer hover:text-gray-200">
            USD <ChevronDown className="h-3 w-3 ml-1" />
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 py-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/store" className="flex-shrink-0 mr-8">
          <div className="text-3xl font-black tracking-tight text-[#1A1A1A]">
            BUSINESS<span className="text-blue-600">OSAI</span>
          </div>
        </Link>

        {/* Search Bar */}
        <div className="flex-1 max-w-2xl hidden md:flex">
          <form
            onSubmit={handleSearch}
            className="flex w-full border-2 border-blue-600 rounded-full overflow-hidden"
          >
            <div className="bg-gray-50 border-r border-[#E5E4E2] px-4 py-2 flex items-center text-sm text-gray-600 min-w-[140px] cursor-pointer">
              All Categories <ChevronDown className="h-4 w-4 ml-auto" />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 outline-none"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 hover:bg-blue-700 transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>

        {/* Icons */}
        <div className="flex items-center space-x-6 ml-8">
          <Link to="/store/account" className="text-[#1E293B] hover:text-blue-600 transition-colors">
            <User className="h-6 w-6" />
          </Link>
          <div className="text-[#1E293B] hover:text-blue-600 transition-colors relative cursor-pointer">
            <Heart className="h-6 w-6" />
            <span className="absolute -top-2 -right-2 bg-[#FF4E50] text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">0</span>
          </div>
          <Link to="/store/cart" className="text-[#1E293B] hover:text-blue-600 transition-colors relative">
            <ShoppingBag className="h-6 w-6" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#FF4E50] text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
