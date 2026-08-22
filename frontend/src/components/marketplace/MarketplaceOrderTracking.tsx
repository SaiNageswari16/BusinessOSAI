import React, { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Truck, Search, Package, Clock, CheckCircle2, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderTrackingData {
  trackingNo: string;
  orderId: string;
  courierPartner: string;
  driverName: string;
  driverPhone: string;
  currentLocation: string;
  estimatedDelivery: string;
  transitStatus: "In Transit" | "Out for Delivery" | "Delivered";
  waypoints: { location: string; timestamp: string; done: boolean }[];
}

export function MarketplaceOrderTracking() {
  const [searchCode, setSearchCode] = useState("TRK-8825-EXP");

  const [trackingData, setTrackingData] = useState<OrderTrackingData>({
    trackingNo: "TRK-8825-EXP",
    orderId: "ORD-8825",
    courierPartner: "Express Freight Logistics",
    driverName: "Michael Vance",
    driverPhone: "+1 (555) 382-9102",
    currentLocation: "En route to Logistics Hub 4 (North Zone)",
    estimatedDelivery: "Today by 05:00 PM",
    transitStatus: "In Transit",
    waypoints: [
      { location: "Vendor Warehouse Dispatch (Apex Tech Solutions)", timestamp: "08:45 AM", done: true },
      { location: "Central Marketplace Sorting Facility", timestamp: "11:20 AM", done: true },
      { location: "Regional Transit Hub 4", timestamp: "01:15 PM", done: true },
      { location: "Out for Doorstep Delivery", timestamp: "Expected 04:00 PM", done: false },
      { location: "Customer Destination Address", timestamp: "Expected 05:00 PM", done: false },
    ],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Live Order Shipment Tracking</h1>
          <p className="text-sm text-muted-foreground">Search by Order ID or Tracking Number for real-time courier progress and estimated delivery times.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Enter Tracking No or Order ID..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Shipment Details */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tracking Reference</span>
                <h3 className="text-xl font-extrabold text-primary font-mono">{trackingData.trackingNo}</h3>
                <p className="text-xs text-muted-foreground">Order ID: <strong className="text-foreground">{trackingData.orderId}</strong></p>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-sky-500/10 text-sky-600 border border-sky-500/20">
                {trackingData.transitStatus}
              </span>
            </div>

            <div className="bg-background/50 p-4 rounded-lg border border-border/40 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Courier Partner:</span>
                <span className="font-semibold text-foreground">{trackingData.courierPartner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned Driver:</span>
                <span className="font-semibold text-foreground">{trackingData.driverName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Delivery:</span>
                <span className="font-bold text-emerald-500 font-mono">{trackingData.estimatedDelivery}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Transit Stepper */}
        <div className="lg:col-span-7">
          <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
              <Navigation className="size-4 text-primary" /> Live Transit Waypoints
            </h3>

            <div className="space-y-4 relative pl-6 border-l-2 border-border/60">
              {trackingData.waypoints.map((wp, idx) => (
                <div key={idx} className="relative space-y-0.5">
                  <div className={cn("absolute -left-[31px] top-0.5 size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    wp.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground border border-border"
                  )}>
                    {wp.done ? "✓" : idx + 1}
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className={cn("font-semibold", wp.done ? "text-foreground" : "text-muted-foreground")}>{wp.location}</span>
                    <span className="font-mono text-muted-foreground text-[11px]">{wp.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
