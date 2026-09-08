import React, { useState } from "react";
import { motion } from "framer-motion";
import { Truck, MapPin, Package, CheckCircle2, Navigation, Clock, Phone, AlertTriangle, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";

export function DeliveryTracking() {
  const { currency, formatCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: () => marketplaceApi.getOrders(),
    staleTime: 10000,
  });

  const ordersList = orders || [];
  
  // Map orders to active delivery items
  const deliveries = ordersList.map((o: any) => {
    const isDelivered = o.status === "Delivered";
    const isShipped = o.status === "Shipped" || o.fulfillment_status === "Shipped";
    const isReady = o.fulfillment_status === "Ready to Ship";
    
    let progress = 25;
    let statusText = "Processing in Store";
    if (isReady) {
      progress = 50;
      statusText = "Ready for Courier Pickup";
    } else if (isShipped) {
      progress = 75;
      statusText = "In Transit with Courier";
    } else if (isDelivered) {
      progress = 100;
      statusText = "Delivered";
    }

    return {
      id: o.tracking_number || `TRK-${o.id}`,
      orderId: o.id,
      customerName: o.customerName,
      status: isDelivered ? "Delivered" : isShipped ? "In Transit" : isReady ? "Ready to Ship" : "Processing",
      statusText,
      driver: o.delivery_partner || "Express Logistics",
      phone: o.customer_phone || "+971 4 800 1234",
      eta: isDelivered ? "Delivered" : isShipped ? "Same-Day (2-4 hrs)" : "Scheduled Dispatch",
      progress,
      destination: o.shipping_address || "Standard Storefront Registered Address",
      currentLocation: isDelivered ? "Customer Address" : isShipped ? "Courier Hub (Out for Delivery)" : "Physical Store Fulfillment Station",
      totalAmount: o.total,
    };
  });

  const filtered = deliveries.filter((d: any) =>
    d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.driver?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Live Delivery & Dispatch Tracking</h2>
          <p className="text-xs text-muted-foreground">Real-time visibility into all store orders, integrated courier fleets, and customer dispatches.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tracking, order ID, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors border cursor-pointer"
            title="Refresh Tracking"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map visualization panel */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-border/50 overflow-hidden relative min-h-[420px] bg-card shadow-xs">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
          
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-10">
            <div className="bg-background/90 backdrop-blur-md p-6 rounded-2xl border border-border shadow-xl max-w-sm">
              <Navigation className="size-8 text-purple-700 mx-auto mb-3 animate-bounce" />
              <h3 className="font-bold text-foreground">Live Courier Fleet Routing</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Active parcel routing synchronized with <strong>Careem Express, DHL, and Store Fleet</strong> dispatch APIs.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  {filtered.length} Active Dispatches
                </span>
              </div>
            </div>
          </div>

          {/* Animated tracking dots */}
          <motion.div animate={{ x: [0, 25, 0], y: [0, -15, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }} className="absolute top-[25%] left-[35%] size-3.5 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] z-0" />
          <motion.div animate={{ x: [0, -35, 0], y: [0, 20, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="absolute top-[65%] left-[65%] size-3.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] z-0" />
          <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ repeat: Infinity, duration: 2.5 }} className="absolute top-[45%] left-[50%] size-3.5 rounded-full bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.8)] z-0" />
        </div>

        {/* Active Deliveries List from Live Database */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-2 text-sm">
              <Package className="size-4 text-purple-700" /> Active Dispatches ({filtered.length})
            </h3>
          </div>
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="p-8 text-center bg-card border rounded-2xl text-muted-foreground text-xs">
                No active dispatches right now. Newly fulfilled orders will appear here automatically.
              </div>
            ) : (
              filtered.map((del, i) => (
                <motion.div
                  key={del.id || i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card p-4 rounded-xl border border-border hover:border-purple-500/30 transition-colors shadow-xs"
                >
                  <div className="flex justify-between items-start mb-2.5">
                    <div>
                      <h4 className="font-mono font-bold text-xs text-purple-700">{del.id}</h4>
                      <p className="text-[11px] text-foreground font-semibold">{del.orderId} · {del.customerName}</p>
                    </div>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      del.status === "Delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      del.status === "In Transit" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      del.status === "Ready to Ship" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-purple-50 text-purple-700 border-purple-200"
                    )}>
                      {del.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-3 text-xs">
                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <MapPin className="size-3 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{del.destination}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                      <Truck className="size-3 text-purple-700 shrink-0" />
                      <span>{del.driver} ({del.currentLocation})</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-muted-foreground flex items-center gap-1"><Clock className="size-3" /> ETA: {del.eta}</span>
                      <span className="text-foreground">{del.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${del.progress}%` }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className={cn("h-full rounded-full",
                          del.progress === 100 ? "bg-emerald-500" :
                          del.progress >= 75 ? "bg-blue-500" : "bg-purple-600"
                        )}
                      />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
