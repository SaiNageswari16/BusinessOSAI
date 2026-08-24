import React, { useState } from "react";
import { motion } from "framer-motion";
import { Package, Search, Filter, ShieldCheck, DollarSign, Star, Store, Plus, Tag } from "lucide-react";
import { mockMarketplaceProducts } from "@/data/mockMarketplaceData";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

export function MarketplaceProducts() {
    const { currency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = mockMarketplaceProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Products</h1>
          <p className="text-sm text-muted-foreground">Manage and approve products listed by vendors across the marketplace.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products or vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2">
            <Filter className="size-4" /> Filter
          </button>
          <button className="px-3 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity flex items-center gap-2">
            <Plus className="size-4" /> Bulk Import
          </button>
        </div>
      </div>

      <div className="glass-panel border border-border/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="px-6 py-4 font-semibold text-muted-foreground">Product</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Vendor</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Category</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Price</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Stock</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((product, i) => (
                <motion.tr 
                  key={product.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-accent/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <Package className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground truncate max-w-[200px]" title={product.name}>{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Store className="size-3.5 text-muted-foreground" />
                      <span className="text-foreground truncate max-w-[150px]" title={product.vendorName}>{product.vendorName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <Tag className="size-3.5 text-primary" />
                      {product.category}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {currency.symbol}{product.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-1 rounded text-xs font-medium", 
                      product.stock > 100 ? "bg-emerald-500/10 text-emerald-600" :
                      product.stock > 0 ? "bg-amber-500/10 text-amber-600" :
                      "bg-red-500/10 text-red-600"
                    )}>
                      {product.stock} units
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase",
                      product.status === "Approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                      product.status === "Pending" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                      "bg-red-500/10 text-red-600 border border-red-500/20"
                    )}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {product.status === "Pending" ? (
                      <button className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ml-auto">
                        <ShieldCheck className="size-3.5" /> Approve
                      </button>
                    ) : (
                      <button className="px-3 py-1 text-xs font-medium bg-background border border-border hover:bg-accent rounded-md transition-colors">
                        Edit
                      </button>
                    )}
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
