import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Store, Home, ShoppingBag, BookOpen, Mail, ShieldCheck, Heart, User, Package } from "lucide-react";
import { organicCategories as fallbackCategories } from "@/data/mockOrganicData";
import { fetchStorefrontCategories } from "@/lib/storefront-api";
import { cn } from "@/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function OrganicOffcanvasMenu({ isOpen, onClose }: Props) {
  const navigate = useNavigate();

  const { data: dynamicCategories } = useQuery({
    queryKey: ["storefront-offcanvas-categories"],
    queryFn: () => fetchStorefrontCategories(),
    staleTime: 60000,
  });

  const categoriesList = dynamicCategories && dynamicCategories.length > 0
    ? dynamicCategories
    : fallbackCategories;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-y-0 left-0 max-w-full flex pr-10">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-screen max-w-xs sm:max-w-sm bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-[#FAF8EF]">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/Logo.png"
                    alt="LazyMonkey Store"
                    className="h-8 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="font-black text-sm text-gray-900 tracking-tight font-organic-heading leading-tight flex items-center gap-1">
                      LazyMonkey<span className="text-[#6BB252]">Store</span>
                    </span>
                    <span className="text-[9px] text-gray-400 font-semibold tracking-wider uppercase">
                      Direct Marketplace
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="size-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Menu Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Main Navigation Links */}
                <div>
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-2.5 px-2">
                    Navigation
                  </h4>
                  <div className="space-y-1">
                    <Link
                      to="/store"
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-800 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors"
                    >
                      <Home className="size-4 text-[#6BB252]" />
                      Home
                    </Link>

                    <Link
                      to="/store/shop"
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-800 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors"
                    >
                      <ShoppingBag className="size-4 text-[#6BB252]" />
                      Shop All Products
                    </Link>

                    <Link
                      to="/store/orders"
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-800 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors"
                    >
                      <Package className="size-4 text-[#6BB252]" />
                      Live Order Tracking
                    </Link>

                    <Link
                      to="/store/blog"
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-800 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors"
                    >
                      <BookOpen className="size-4 text-[#6BB252]" />
                      Our Journals & Blog
                    </Link>

                    <Link
                      to="/store/about"
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-800 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors"
                    >
                      <ShieldCheck className="size-4 text-[#6BB252]" />
                      About LazyMonkey
                    </Link>

                    <Link
                      to="/store/contact"
                      onClick={onClose}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-800 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors"
                    >
                      <Mail className="size-4 text-[#6BB252]" />
                      Contact Us
                    </Link>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-2.5 px-2">
                    Shop by Category
                  </h4>
                  <div className="space-y-1">
                    {categoriesList.map((cat: any) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate({
                            to: "/store/shop",
                            search: { category: cat.name },
                          });
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-[#FAF8EF] hover:text-[#6BB252] transition-colors cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <img
                            src={cat.image_url || cat.image || "/organic/images/category-thumb-1.jpg"}
                            alt={cat.name}
                            className="size-6 rounded-full object-cover shrink-0"
                          />
                          <span className="truncate">{cat.name}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {cat.item_count ? (
                            <span className="text-[10px] text-gray-400">({cat.item_count})</span>
                          ) : null}
                          <ChevronRight className="size-3.5 text-gray-300" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account & Wishlist shortcuts */}
                <div className="pt-4 border-t border-gray-100 space-y-1">
                  <Link
                    to="/store/account"
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-black"
                  >
                    <User className="size-4 text-gray-400" /> My Account
                  </Link>
                  <Link
                    to="/store/wishlist"
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-black"
                  >
                    <Heart className="size-4 text-gray-400" /> My Wishlist
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
