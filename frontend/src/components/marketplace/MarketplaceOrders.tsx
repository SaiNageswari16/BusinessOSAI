import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Search, Filter, Store, User, MapPin, Calendar, Clock, CreditCard, Box, ExternalLink } from "lucide-react";
import { mockMarketplaceOrders } from "@/data/mockMarketplaceData";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

export function MarketplaceOrders() {
    const { currency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = mockMarketplaceOrders.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Multi-Vendor Orders</h2>
          <p className="text-xs text-muted-foreground">Track and manage cross-vendor orders, fulfillments, and payments.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search orders, customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2">
            <Filter className="size-4" /> Status
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((order, i) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="glass-panel p-5 rounded-xl border border-border/50 hover:shadow-elegant transition-all flex flex-col h-full"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-sm font-bold text-primary">{order.id}</span>
              <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase",
                order.status === "Delivered" ? "bg-emerald-500/10 text-emerald-600" :
                order.status === "Shipped" ? "bg-blue-500/10 text-blue-600" :
                order.status === "Processing" ? "bg-purple-500/10 text-purple-600" :
                order.status === "Cancelled" ? "bg-red-500/10 text-red-600" :
                "bg-amber-500/10 text-amber-600"
              )}>
                {order.status}
              </span>
            </div>

            <div className="space-y-3 mb-5 flex-1">
              <div className="flex items-start gap-3">
                <User className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.customerId}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Store className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{order.vendorName}</p>
                  <p className="text-xs text-muted-foreground">{order.vendorId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border/50">
                <Calendar className="size-3.5" /> 
                {new Date(order.date).toLocaleDateString()}
                <Clock className="size-3.5 ml-2" />
                {new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-border/50">
              <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                <Box className="size-4" /> {order.items} {order.items === 1 ? 'item' : 'items'}
              </div>
              <div className="text-lg font-bold text-foreground">
                {currency.symbol}{order.total.toFixed(2)}
              </div>
            </div>
            
            <button className="w-full mt-4 py-2 bg-accent/50 hover:bg-accent text-foreground text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              View Order Details <ExternalLink className="size-3" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
