import React from "react";
import { motion } from "framer-motion";
import { Truck, MapPin, Package, CheckCircle2, Navigation, Clock, Phone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

export function DeliveryTracking() {
    const { currency, formatCurrency } = useCurrency();
  const deliveries = [
    { id: "DEL-4482", orderId: "ORD-98235", status: "In Transit", driver: "Mike Johnson", phone: "+1 555-0198", eta: "45 mins", progress: 75, destination: "742 Evergreen Terrace, Springfield", currentLocation: "Route 9, Northbound" },
    { id: "DEL-4483", orderId: "ORD-98236", status: "Out for Delivery", driver: "Sarah Connor", phone: "+1 555-0122", eta: "2 hours", progress: 30, destination: "100 Universal City Plaza, CA", currentLocation: "Distribution Center South" },
    { id: "DEL-4481", orderId: "ORD-98234", status: "Delivered", driver: "Tom Cruise", phone: "+1 555-0111", eta: "Delivered at 2:30 PM", progress: 100, destination: "123 Main St, New York", currentLocation: "At destination" },
    { id: "DEL-4484", orderId: "ORD-98238", status: "Delayed", driver: "John Smith", phone: "+1 555-0177", eta: "Updating...", progress: 45, destination: "456 Market St, San Francisco", currentLocation: "Traffic incident on Hwy 101" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Live Delivery Tracking</h2>
        <p className="text-xs text-muted-foreground">Real-time visibility into all marketplace fleet operations and third-party logistics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map visualization placeholder */}
        <div className="lg:col-span-2 glass-panel rounded-xl border border-border/50 overflow-hidden relative min-h-[400px]">
          <div className="absolute inset-0 opacity-20 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=37.7749,-122.4194&zoom=12&size=800x400&sensor=false')] bg-cover bg-center grayscale mix-blend-overlay pointer-events-none" />
          
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-10 pointer-events-none">
            <div className="bg-background/80 backdrop-blur-md p-6 rounded-xl border border-border shadow-xl">
              <Navigation className="size-8 text-primary mx-auto mb-3" />
              <h3 className="font-bold text-foreground">Interactive Fleet Map</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">Map visualization relies on Google Maps API key which is not configured in this mock environment.</p>
            </div>
          </div>

          {/* Mock tracking dots */}
          <motion.div animate={{ x: [0, 20, 0], y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} className="absolute top-[30%] left-[40%] size-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] z-0" />
          <motion.div animate={{ x: [0, -30, 0], y: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }} className="absolute top-[60%] left-[70%] size-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] z-0" />
          <motion.div animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute top-[45%] left-[55%] size-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] z-0" />
        </div>

        {/* Active Deliveries List */}
        <div className="space-y-4">
          <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
            <Package className="size-4" /> Active Dispatches
          </h3>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
            {deliveries.map((del, i) => (
              <motion.div
                key={del.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{del.id}</h4>
                    <p className="text-xs text-muted-foreground">Order: {del.orderId}</p>
                  </div>
                  <span className={cn("px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase",
                    del.status === "Delivered" ? "bg-emerald-500/10 text-emerald-600" :
                    del.status === "In Transit" ? "bg-blue-500/10 text-blue-600" :
                    del.status === "Delayed" ? "bg-red-500/10 text-red-600" :
                    "bg-amber-500/10 text-amber-600"
                  )}>
                    {del.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2 text-xs">
                    <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground truncate">{del.destination}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Navigation className="size-3.5 text-primary shrink-0" />
                    <span className={cn("truncate", del.status === "Delayed" ? "text-red-500" : "text-foreground")}>
                      {del.currentLocation}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="size-3" /> ETA: {del.eta}</span>
                    <span className="font-semibold">{del.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${del.progress}%` }}
                      transition={{ delay: 0.5, duration: 1 }}
                      className={cn("h-full rounded-full",
                        del.progress === 100 ? "bg-emerald-500" :
                        del.status === "Delayed" ? "bg-red-500" : "bg-blue-500"
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-border/50">
                  <div className="text-xs text-muted-foreground">
                    Driver: <span className="font-semibold text-foreground">{del.driver}</span>
                  </div>
                  <button className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors">
                    <Phone className="size-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
