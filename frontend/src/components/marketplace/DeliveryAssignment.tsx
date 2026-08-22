import React, { useState } from "react";
import { motion } from "framer-motion";
import { Network, Truck, CheckCircle2, Clock, Search, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface DispatchOrder {
  id: string;
  orderId: string;
  customerName: string;
  pickupAddress: string;
  deliveryAddress: string;
  suggestedDriver: string;
  assignedDriver?: string;
  status: "Unassigned" | "Assigned" | "In-Transit";
}

export function DeliveryAssignment() {
  const [searchTerm, setSearchTerm] = useState("");

  const [queue, setQueue] = useState<DispatchOrder[]>([
    {
      id: "DSP-701",
      orderId: "ORD-8829",
      customerName: "Robert Chen",
      pickupAddress: "Apex Regional Warehouse Hub A",
      deliveryAddress: "742 Evergreen Terrace, Sector 4",
      suggestedDriver: "Hassan Al-Zahrani (Nearest - 1.2 km)",
      status: "Unassigned",
    },
    {
      id: "DSP-702",
      orderId: "ORD-8825",
      customerName: "David Miller",
      pickupAddress: "Urban Retail Central Store Hub",
      deliveryAddress: "108 Ocean Drive, Downtown",
      suggestedDriver: "Michael Vance",
      assignedDriver: "Michael Vance",
      status: "In-Transit",
    },
  ]);

  const assignDriver = (id: string) => {
    setQueue(prev =>
      prev.map(q => q.id === id ? { ...q, assignedDriver: q.suggestedDriver.split(' (')[0], status: "Assigned" } : q)
    );
  };

  const filtered = queue.filter(q =>
    q.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delivery Order Dispatch & Assignment Queue</h1>
          <p className="text-sm text-muted-foreground">Assign ready orders to nearest available drivers, run auto-assignment rules, and trigger dispatch notifications.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-primary/20 transition-all"
          >
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground font-mono">{item.id}</span>
                <span className="text-xs text-muted-foreground">Order: <strong className="text-foreground">{item.orderId}</strong></span>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                  item.status === "Unassigned" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                  item.status === "Assigned" ? "bg-sky-500/10 text-sky-600 border border-sky-500/20" :
                  "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                )}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Customer: <strong className="text-foreground">{item.customerName}</strong></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                <div>Pickup: <span className="text-foreground">{item.pickupAddress}</span></div>
                <div>Dropoff: <span className="text-foreground">{item.deliveryAddress}</span></div>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-border/40">
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground uppercase block">AI Match Driver</span>
                <span className="font-semibold text-primary text-xs">{item.assignedDriver || item.suggestedDriver}</span>
              </div>
              {item.status === "Unassigned" && (
                <button
                  onClick={() => assignDriver(item.id)}
                  className="px-3.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap"
                >
                  <Truck className="size-3.5" /> Assign Driver
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
