import React, { useState } from "react";
import { motion } from "framer-motion";
import { Package, Search, Filter, ShieldCheck, DollarSign, Star, Store, Plus, Tag, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";
import { toast } from "sonner";

import { AddProductModal, EditProductModal } from "@/components/marketplace/MarketplaceModals";

export function MarketplaceProducts() {
  const queryClient = useQueryClient();
  const { currency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  const { data: apiProducts, isLoading } = useQuery({
    queryKey: ["marketplace-products"],
    queryFn: () => marketplaceApi.getProducts(),
    staleTime: 30000,
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

  const filtered = productsList.filter((p: any) => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.vendorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Marketplace Products</h2>
          <p className="text-xs text-muted-foreground">Manage and approve products listed by vendors across the marketplace.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products or vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <button className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer">
            <Filter className="size-4" /> Filter
          </button>
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="size-4" /> Add Product
          </button>
        </div>
      </div>

      <AddProductModal isOpen={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} />
      <EditProductModal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} product={editingProduct} />

      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {filtered.map((product: any, i: number) => (
                <motion.tr 
                  key={product.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0 border border-purple-100">
                        <Package className="size-4.5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground truncate max-w-[220px]" title={product.name}>{product.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800">
                      <Store className="size-3.5 text-slate-400" />
                      <span className="truncate max-w-[160px]" title={product.vendorName}>{product.vendorName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      <Tag className="size-3 text-slate-400" />
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                    {currency.symbol}{Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border", 
                      product.stock > 100 ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                      product.stock > 0 ? "bg-amber-50 text-amber-600 border-amber-200" :
                      "bg-rose-50 text-rose-600 border-rose-200"
                    )}>
                      {product.stock} units
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      product.status === "Approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                      product.status === "Pending" ? "bg-amber-50 text-amber-600 border-amber-200" :
                      "bg-rose-50 text-rose-600 border-rose-200"
                    )}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
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
                        className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
