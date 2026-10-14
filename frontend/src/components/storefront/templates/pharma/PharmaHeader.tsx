import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useStoreCart } from "@/contexts/StoreCartContext";
import { useWishlist } from "@/contexts/StoreWishlistContext";
import { useStoreUser } from "@/contexts/StoreUserContext";
import {
  Pill,
  Search,
  ShoppingCart,
  Heart,
  User,
  ShieldCheck,
  FileText,
  PhoneCall,
  Menu,
  Activity,
  PlusCircle,
  Truck
} from "lucide-react";
import { toast } from "sonner";

interface PharmaHeaderProps {
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

export function PharmaHeader({ onOpenCart, onOpenMenu }: PharmaHeaderProps) {
  const navigate = useNavigate();
  const { totalItems } = useStoreCart();
  const { totalWishlistItems } = useWishlist();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ to: "/store/shop", search: { q: searchQuery.trim() } as any });
    }
  };

  const handleUploadRx = () => {
    toast.info("Upload Prescription: Select doctor's prescription image or PDF to auto-dispense.", {
      action: {
        label: "Select File",
        onClick: () => toast.success("Prescription received! A certified pharmacist is reviewing."),
      },
    });
  };

  return (
    <header className="w-full bg-white border-b border-sky-100 text-slate-800 font-sans sticky top-0 z-40 transition-colors shadow-2xs">
      {/* ── Top Clinical Compliance Strip ── */}
      <div className="bg-[#0284C7] text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-200" />
            <span>100% Genuine Certified Medicines &bull; Licensed Pharmacist Supervised &bull; Free Express Delivery over ₹499</span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-sky-100">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-300" /> Doctor Tele-Consult Available
            </span>
            <span className="flex items-center gap-1 font-bold text-white">
              <PhoneCall className="w-3 h-3" /> Pharmacy Helpline: 1800-425-9999
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Strip ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMenu}
          className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
          aria-label="Open mobile menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Brand Logo */}
        <Link to="/store" className="flex items-center gap-2.5 text-decoration-none group">
          <div className="size-10 rounded-2xl bg-gradient-to-br from-[#0284C7] to-[#0D9488] text-white flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-black tracking-tight text-slate-900 leading-none flex items-center gap-1.5">
              <span>MedPlus</span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                Pharma & Rx
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">
              Licensed Pharmacy & Certified Healthcare
            </p>
          </div>
        </Link>

        {/* Pharma Live Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-lg mx-6 relative"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicines by brand name, generic salt, or health category..."
            className="w-full h-11 pl-10 pr-24 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:border-transparent shadow-xs transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <button
            type="submit"
            className="absolute right-1 top-1 bottom-1 px-4 rounded-full bg-[#0284C7] text-white text-xs font-bold hover:bg-[#0369A1] transition-colors cursor-pointer"
          >
            Find
          </button>
        </form>

        {/* Action Controls: Upload Prescription, Wishlist, Cart */}
        <div className="flex items-center gap-2">
          {/* Quick Prescription Upload Button */}
          <button
            onClick={handleUploadRx}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#0D9488] bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors cursor-pointer"
            title="Upload Doctor's Prescription"
          >
            <FileText className="w-4 h-4 text-[#0D9488]" />
            <span>Upload Rx</span>
          </button>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0284C7] text-white hover:bg-[#0369A1] transition-all shadow-md shadow-sky-500/20 cursor-pointer active:scale-95"
          >
            <div className="relative">
              <ShoppingCart className="w-4 h-4 text-white" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2.5 size-4.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="text-xs font-bold tracking-wide hidden sm:inline">
              Medicine Bag ({totalItems})
            </span>
          </button>
        </div>
      </div>

      {/* ── Sub Navigation Links Strip ── */}
      <div className="bg-slate-50 border-t border-slate-200/60 hidden lg:block">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-6">
            <Link to="/store/shop" className="hover:text-[#0284C7] transition-colors flex items-center gap-1">
              <Pill className="w-3.5 h-3.5 text-sky-600" /> All Medicines
            </Link>
            <Link to="/store/shop" search={{ category: "Prescription Drugs" } as any} className="hover:text-[#0284C7] transition-colors">
              Prescription (Rx)
            </Link>
            <Link to="/store/shop" search={{ category: "Vitamins & Nutrition" } as any} className="hover:text-[#0284C7] transition-colors">
              Vitamins & Supplements
            </Link>
            <Link to="/store/shop" search={{ category: "Ayurveda & Herbal" } as any} className="hover:text-[#0284C7] transition-colors">
              Ayurveda & Herbal Care
            </Link>
            <Link to="/store/shop" search={{ category: "Medical Devices" } as any} className="hover:text-[#0284C7] transition-colors">
              BP Monitors & Devices
            </Link>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#0D9488] font-extrabold uppercase tracking-wider">
            <Truck className="w-3.5 h-3.5" />
            <span>Temperature-Controlled Delivery</span>
          </div>
        </div>
      </div>
    </header>
  );
}
