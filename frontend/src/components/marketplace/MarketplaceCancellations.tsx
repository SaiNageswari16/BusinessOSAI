import React, { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Search, Package, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CancelledOrder {
  id: string;
  orderId: string;
  customerName: string;
  vendorName: string;
  itemCount: number;
  totalAmount: number;
  cancelledBy: "Buyer" | "Vendor" | "System Admin";
  reason: string;
  cancellationDate: string;
  restockingStatus: "Restocked to Inventory" | "Pending Restock" | "N/A (Pre-Dispatch)";
}

export function MarketplaceCancellations() {
  const [searchTerm, setSearchTerm] = useState("");

  const [cancellations, setCancellations] = useState<CancelledOrder[]>([
    {
      id: "CAN-301",
      orderId: "ORD-8819",
      customerName: "Robert Chen",
      vendorName: "Nexus Supply Chain",
      itemCount: 2,
      totalAmount: 640.00,
      cancelledBy: "Buyer",
      reason: "Accidental duplicate order submitted.",
      cancellationDate: "2026-08-14 16:45",
      restockingStatus: "N/A (Pre-Dispatch)",
    },
    {
      id: "CAN-302",
      orderId: "ORD-8804",
      customerName: "Amira Al-Mansoor",
      vendorName: "Apex Tech Solutions",
      itemCount: 1,
      totalAmount: 189.99,
      cancelledBy: "Vendor",
      reason: "Unexpected stock deficit at regional warehouse.",
      cancellationDate: "2026-08-12 10:20",
      restockingStatus: "Restocked to Inventory",
    },
  ]);

  const filtered = cancellations.filter(c =>
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Order Cancellations</h1>
          <p className="text-sm text-muted-foreground">Monitor buyer/vendor order cancellations, cancellation reasons, and automated inventory restocking.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search cancellation or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((can, i) => (
          <motion.div
            key={can.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 space-y-3 hover:border-primary/20 transition-all"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-border/40">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold font-mono text-sm border border-amber-500/20">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground font-mono">{can.id}</span>
                    <span className="text-xs text-muted-foreground">Order: <strong className="text-foreground">{can.orderId}</strong></span>
                  </div>
                  <p className="text-xs text-muted-foreground">Cancelled By: <strong className="text-amber-600">{can.cancelledBy}</strong> • Date: {can.cancellationDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-base font-extrabold text-foreground font-mono">${can.totalAmount.toFixed(2)}</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-600 border border-red-500/20">
                  Cancelled
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-background/50 p-3 rounded-lg border border-border/40 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Cancellation Reason</span>
                <p className="text-foreground font-medium">{can.reason}</p>
              </div>
              <div className="bg-background/50 p-3 rounded-lg border border-border/40 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Inventory Restocking Status</span>
                <p className="text-emerald-600 font-semibold">{can.restockingStatus}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
