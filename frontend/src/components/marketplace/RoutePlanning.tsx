import React, { useState } from "react";
import { motion } from "framer-motion";
import { Navigation, MapPin, Truck, Clock, CheckCircle2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliveryRoute {
  id: string;
  routeName: string;
  assignedDriver: string;
  vehicle: string;
  totalStops: number;
  totalDistanceKm: number;
  estimatedTimeHrs: number;
  stops: { stopNo: number; address: string; orderId: string; status: "Completed" | "Pending" }[];
}

export function RoutePlanning() {
  const [routes, setRoutes] = useState<DeliveryRoute[]>([
    {
      id: "RTE-901",
      routeName: "North Metro Express Loop #4",
      assignedDriver: "Michael Vance",
      vehicle: "Cargo Van (VAN-04)",
      totalStops: 5,
      totalDistanceKm: 28.5,
      estimatedTimeHrs: 2.2,
      stops: [
        { stopNo: 1, address: "Regional Sorting Facility (Hub 4)", orderId: "DEPOT", status: "Completed" },
        { stopNo: 2, address: "108 Ocean Drive, Downtown", orderId: "ORD-8825", status: "Completed" },
        { stopNo: 3, address: "742 Evergreen Terrace, Sector 4", orderId: "ORD-8829", status: "Pending" },
        { stopNo: 4, address: "55 Park Avenue, Building B", orderId: "ORD-8831", status: "Pending" },
        { stopNo: 5, address: "12 Industrial Parkway", orderId: "ORD-8835", status: "Pending" },
      ],
    },
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Multi-Stop Delivery Route Optimization & Sequence Planner</h1>
          <p className="text-sm text-muted-foreground">Optimize driver stop sequences, reduce travel distance, and track live route progress.</p>
        </div>
      </div>

      <div className="space-y-6">
        {routes.map((r) => (
          <div key={r.id} className="glass-panel p-6 rounded-xl border border-border/50 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-border/40">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold font-mono">{r.id}</span>
                <h3 className="text-lg font-bold text-foreground">{r.routeName}</h3>
                <p className="text-xs text-muted-foreground">Driver: <strong className="text-primary">{r.assignedDriver}</strong> • Vehicle: {r.vehicle}</p>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-xs text-muted-foreground font-mono">Distance: <strong className="text-foreground">{r.totalDistanceKm} km</strong></span>
                <p className="text-xs font-semibold text-emerald-600">Est. Time: {r.estimatedTimeHrs} hrs ({r.totalStops} Stops)</p>
              </div>
            </div>

            {/* Stops Sequence */}
            <div className="space-y-3 relative pl-6 border-l-2 border-border/60">
              {r.stops.map((stop) => (
                <div key={stop.stopNo} className="relative space-y-0.5">
                  <div className={cn("absolute -left-[31px] top-0.5 size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    stop.status === "Completed" ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground"
                  )}>
                    {stop.stopNo}
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">{stop.address}</span>
                    <span className="font-mono text-muted-foreground text-[11px]">{stop.orderId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
