import React, { useState } from "react";
import { motion } from "framer-motion";
import { Store, Search, Filter, MoreHorizontal, Star, Package, DollarSign, MapPin, CheckCircle2, XCircle, Clock } from "lucide-react";
import { mockVendors } from "@/data/mockMarketplaceData";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

export function Vendors() {
    const { currency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = mockVendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Vendors</h2>
          <p className="text-xs text-muted-foreground">Manage marketplace vendors, approvals, and performance.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2">
            <Filter className="size-4" /> Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((vendor, i) => (
          <motion.div
            key={vendor.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-panel p-5 rounded-xl border border-border/50 hover:shadow-elegant hover:border-primary/20 transition-all flex flex-col h-full"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                  {vendor.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground truncate max-w-[120px]" title={vendor.name}>{vendor.name}</h3>
                  <p className="text-xs text-muted-foreground">{vendor.id}</p>
                </div>
              </div>
              <span className={cn("px-2 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase",
                vendor.status === "Active" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                vendor.status === "Pending" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                "bg-red-500/10 text-red-600 border border-red-500/20"
              )}>
                {vendor.status}
              </span>
            </div>

            <div className="space-y-3 mb-5 flex-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="size-3.5" />
                <span>{vendor.category}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                <span className="truncate">{vendor.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="size-3.5 text-amber-500" />
                <span>{vendor.rating > 0 ? vendor.rating : "New"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/50">
              <div className="bg-background/50 p-2 rounded-lg text-center">
                <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Orders</p>
                <p className="font-semibold text-foreground text-sm flex items-center justify-center gap-1">
                  <Package className="size-3 text-primary" />
                  {vendor.totalOrders.toLocaleString()}
                </p>
              </div>
              <div className="bg-background/50 p-2 rounded-lg text-center">
                <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Revenue</p>
                <p className="font-semibold text-foreground text-sm flex items-center justify-center gap-1">
                  <DollarSign className="size-3 text-emerald-500" />
                  {currency.symbol}{(vendor.revenue / 1000).toFixed(0)}K
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
