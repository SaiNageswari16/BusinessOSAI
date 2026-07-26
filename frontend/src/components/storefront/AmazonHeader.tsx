import { Search, ShoppingCart, MapPin, Menu } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useState } from "react";

export function AmazonHeader() {
  const { cartCount } = useStoreCart();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ to: "/store/search", search: { q: searchQuery } });
    }
  };

  return (
    <header className="bg-sky-600 text-white shadow-md">
      <div className="flex items-center justify-between px-4 py-2 h-[60px]">
        
        {/* Left: Logo & Location */}
        <div className="flex items-center space-x-6">
          <Link to="/store" className="flex items-center mt-1 border border-transparent hover:border-white p-1 rounded-sm">
            <span className="text-2xl font-bold tracking-tight">Marketplace</span>
          </Link>
          
          <div className="hidden md:flex items-center border border-transparent hover:border-white p-1 rounded-sm cursor-pointer">
            <MapPin className="h-4 w-4 mr-1 mt-3" />
            <div className="flex flex-col text-sm leading-tight">
              <span className="text-gray-300 text-xs">Deliver to</span>
              <span className="font-bold text-white">Select your address</span>
            </div>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-[800px] px-6 hidden sm:block">
          <form onSubmit={handleSearch} className="flex h-10 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#F3A847]">
            <select className="bg-[#F2F2F2] text-black border-r border-gray-300 px-2 outline-none text-sm w-auto min-w-[50px] cursor-pointer hidden md:block">
              <option>All</option>
              <option>Electronics</option>
              <option>Furniture</option>
              <option>Clothing</option>
            </select>
            <input 
              type="text" 
              placeholder="Search Marketplace" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 text-black outline-none placeholder:text-gray-500"
            />
            <button type="submit" className="bg-amber-500 hover:bg-amber-600 px-4 flex items-center justify-center transition-colors">
              <Search className="h-5 w-5 text-sky-900" />
            </button>
          </form>
        </div>

        {/* Right: Account, Returns, Cart */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Link to="/store/account" className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer flex flex-col leading-tight">
            <span className="text-xs text-gray-300">Hello, sign in</span>
            <span className="font-bold text-sm">Account & Lists</span>
          </Link>

          <Link to="/store/account" className="hidden md:flex border border-transparent hover:border-white p-1 rounded-sm cursor-pointer flex-col leading-tight">
            <span className="text-xs text-gray-300">Returns</span>
            <span className="font-bold text-sm">& Orders</span>
          </Link>

          <Link to="/store/cart" className="flex items-end border border-transparent hover:border-white p-1 rounded-sm cursor-pointer relative">
            <div className="relative">
              <ShoppingCart className="h-8 w-8" />
              {cartCount > 0 && (
                <span className="absolute -top-1 left-[14px] bg-amber-500 text-sky-900 rounded-full px-1.5 text-xs font-bold">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="font-bold text-sm hidden sm:inline-block ml-1">Cart</span>
          </Link>
        </div>

      </div>
      
      {/* Mobile Search (Shows only on small screens) */}
      <div className="bg-sky-600 px-4 pb-3 sm:hidden">
        <div className="flex h-10 rounded-md overflow-hidden">
          <input 
            type="text" 
            placeholder="Search Marketplace" 
            className="flex-1 px-4 text-black outline-none placeholder:text-gray-500"
          />
          <button className="bg-amber-500 hover:bg-amber-600 px-4 flex items-center justify-center">
            <Search className="h-5 w-5 text-sky-900" />
          </button>
        </div>
      </div>
    </header>
  );
}
