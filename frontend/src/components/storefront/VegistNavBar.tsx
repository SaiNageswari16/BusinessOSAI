import { Menu, PhoneCall, ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

export function VegistNavBar() {
  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm relative z-40">
      <div className="container mx-auto px-4 flex items-center justify-between h-[54px]">
        
        {/* Left Side: Department Dropdown (Optional feature) */}
        <div className="bg-blue-600 text-white h-full flex items-center px-6 font-bold cursor-pointer min-w-[250px]">
          <Menu className="h-5 w-5 mr-3" />
          Shop By Department
        </div>

        {/* Center Navigation Links */}
        <div className="flex-1 flex justify-center space-x-8 text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
          <Link to="/store" className="hover:text-blue-600 transition-colors flex items-center">
            Home
          </Link>
          <Link to="/store/shop" className="hover:text-blue-600 transition-colors flex items-center relative group">
            Shop <ChevronDown className="h-4 w-4 ml-1 text-gray-400 group-hover:text-blue-600" />
            {/* Hot Badge */}
            <span className="absolute -top-3 right-0 bg-[#FF4E50] text-white text-[9px] px-1.5 py-0.5 rounded-[3px]">HOT</span>
          </Link>
          <Link to="/store/product/$id" params={{ id: "1" }} className="hover:text-blue-600 transition-colors flex items-center">
            Product
          </Link>
          <Link to="/store/collection" className="hover:text-blue-600 transition-colors flex items-center relative group">
            Collection <ChevronDown className="h-4 w-4 ml-1 text-gray-400 group-hover:text-blue-600" />
          </Link>
          <Link to="/store/blog" className="hover:text-blue-600 transition-colors flex items-center">
            Blog
          </Link>
          <Link to="/store/pages" className="hover:text-blue-600 transition-colors flex items-center relative group">
            Page <ChevronDown className="h-4 w-4 ml-1 text-gray-400 group-hover:text-blue-600" />
          </Link>
        </div>

        {/* Right Side: Hotline */}
        <div className="flex items-center text-sm">
          <PhoneCall className="h-5 w-5 text-blue-600 mr-2" />
          <span className="text-gray-500 mr-1">Hotline:</span>
          <span className="font-bold text-[#1A1A1A]">123-456-7890</span>
        </div>

      </div>
    </nav>
  );
}
