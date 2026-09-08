import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Package, Search, Filter, ShieldCheck, DollarSign, Star, Store,
  Plus, Tag, Check, MapPin, Globe, Layers, AlertTriangle, Eye, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketplaceApi, resolveImageUrl } from "@/lib/api-client";
import { toast } from "sonner";

import { AddProductModal, EditProductModal } from "@/components/marketplace/MarketplaceModals";

export function MarketplaceProducts() {
  const queryClient = useQueryClient();
  const { currency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState("All");
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const { data: apiProducts, isLoading, refetch } = useQuery({
    queryKey: ["marketplace-products"],
    queryFn: () => marketplaceApi.getProducts(),
    staleTime: 10000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ productId, status }: { productId: string; status: string }) =>
      marketplaceApi.updateProductStatus(productId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-products"] });
      toast.success("Product approved and published to live catalog!");
    },
  });

  const productsList = apiProducts || [];

  const filtered = productsList.filter((p: any) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (p.name || "").toLowerCase().includes(term) ||
      (p.vendorName || "").toLowerCase().includes(term) ||
      (p.sku || "").toLowerCase().includes(term) ||
      (p.category || "").toLowerCase().includes(term) ||
      (p.rack_location || "").toLowerCase().includes(term);

    const matchesChannel =
      channelFilter === "All" ||
      (p.channel || "Omnichannel Store").toLowerCase().includes(channelFilter.toLowerCase());

    return matchesSearch && matchesChannel;
  });

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-purple-900/10 via-background to-slate-900/5 p-4 rounded-2xl border border-purple-500/20 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow-sm">
              <Package className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Omnichannel & Marketplace Products
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Unified Stock Master
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Centralized physical store inventory and vendor marketplace listings synchronized across POS and E-Commerce.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors border cursor-pointer"
            title="Refresh Products"
          >
            <RefreshCw className="size-4" />
          </button>
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="size-4" /> Add Product
          </button>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2">
          {["All", "Omnichannel", "Vendor"].map((cf) => (
            <button
              key={cf}
              onClick={() => setChannelFilter(cf)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer",
                channelFilter === cf
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {cf === "All" ? "All Channels" : cf === "Omnichannel" ? "🏬 Store Master" : "🤝 Vendor Listings"}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:w-72 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by SKU, Name, Rack Location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
      </div>

      <AddProductModal isOpen={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} />
      <EditProductModal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} product={editingProduct} />

      {/* ── Table ── */}
      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Product & SKU</th>
                <th className="px-5 py-3.5">Channel / Source</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5 text-right">Pricing</th>
                <th className="px-5 py-3.5 text-center">Real-Time Stock Position</th>
                <th className="px-5 py-3.5 text-center">Catalog Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Package className="size-5" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">No products found</p>
                      <p className="text-xs text-muted-foreground">Try adjusting your search query or add a new product.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((product: any, i: number) => {
                  const onHand = product.on_hand_stock ?? product.stock ?? 0;
                  const reserved = product.reserved_stock ?? 0;
                  const available = product.available_stock !== undefined ? product.available_stock : Math.max(0, onHand - reserved);

                  return (
                    <motion.tr
                      key={product.id || i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Product Name & SKU */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0 border border-purple-100 overflow-hidden">
                            {product.image_url ? (
                              <img src={resolveImageUrl(product.image_url)} alt={product.name} className="size-full object-cover" />
                            ) : (
                              <Package className="size-4.5" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-foreground truncate max-w-[220px]" title={product.name}>
                              {product.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                              <span className="font-semibold text-slate-700">{product.sku || product.id}</span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5 text-purple-700 bg-purple-50 px-1 rounded border border-purple-200">
                                <MapPin className="size-2.5" /> {product.rack_location || "Store Shelf"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border",
                          product.vendorId === "STORE-MAIN"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          <Store className="size-3" />
                          {product.vendorName}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          <Tag className="size-3 text-slate-400" />
                          {product.category || "General"}
                        </span>
                      </td>

                      {/* Pricing */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="font-black text-slate-900 text-sm">
                          {currency.symbol}{Number(product.online_price || product.price || 0).toFixed(2)}
                        </div>
                        {product.store_price && product.store_price !== product.online_price && (
                          <div className="text-[10px] text-muted-foreground">
                            Store: {currency.symbol}{Number(product.store_price).toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* Real-time Stock */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border",
                            available > 20
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : available > 0
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          )}>
                            Available: {available}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>On-Hand: <strong className="text-slate-800">{onHand}</strong></span>
                            <span>•</span>
                            <span className="text-purple-700 font-medium">Reserved: <strong>{reserved}</strong></span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                          product.status === "Approved"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : product.status === "Pending"
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-rose-50 text-rose-600 border-rose-200"
                        )}>
                          {product.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {product.status === "Pending" && (
                            <button
                              onClick={() => approveMutation.mutate({ productId: product.id, status: "Approved" })}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldCheck className="size-3.5" /> Approve
                            </button>
                          )}
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
