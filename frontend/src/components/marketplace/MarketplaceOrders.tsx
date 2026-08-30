import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Search, Filter, Store, User, MapPin, Calendar, Clock, CreditCard, Box, ExternalLink, Truck, CheckCircle2, ChevronRight } from "lucide-react";
import { mockMarketplaceOrders } from "@/data/mockMarketplaceData";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";

export function MarketplaceOrders() {
  const queryClient = useQueryClient();
  const { currency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const { data: apiOrders, isLoading } = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: () => marketplaceApi.getOrders(),
    staleTime: 30000,
  });

  const dispatchMutation = useMutation({
    mutationFn: ({ orderId, courier }: { orderId: string; courier: string }) =>
      marketplaceApi.dispatchOrder(orderId, courier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      setSelectedOrder(null);
    },
  });

  const ordersList = apiOrders || [];

  const filtered = ordersList.filter((o: any) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || o.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
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
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/40">
            {["All", "Processing", "Shipped", "Delivered"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer",
                  statusFilter === st
                    ? "bg-background text-foreground shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left whitespace-nowrap">Order ID</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Customer</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Vendor</th>
                <th className="px-6 py-4 text-left whitespace-nowrap">Date & Time</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">Items</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Total Amount</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Fulfillment Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {filtered.map((order: any) => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4 font-mono font-bold text-purple-700 text-sm">
                    {order.id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">{order.customerName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{order.customerId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{order.vendorName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{order.vendorId}</div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-slate-400" />
                      <span>{new Date(order.date).toLocaleDateString()}</span>
                      <span className="text-slate-400">·</span>
                      <span>{new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      <Box className="size-3" /> {order.items} {order.items === 1 ? 'item' : 'items'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                    {currency.symbol}{Number(order.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      order.status === "Delivered" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                      order.status === "Shipped" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                      order.status === "Processing" ? "bg-purple-500/10 text-purple-700 border-purple-500/20" :
                      order.status === "Cancelled" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                      "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    )}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {order.status === "Processing" || order.status === "Pending" ? (
                      <button
                        onClick={() => dispatchMutation.mutate({ orderId: order.id, courier: "Careem Express" })}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer ml-auto"
                      >
                        <Truck className="size-3.5" /> Dispatch
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-600 text-xs font-medium">
                        <Truck className="size-3 text-slate-400" /> {order.delivery_partner || "Careem Express"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
