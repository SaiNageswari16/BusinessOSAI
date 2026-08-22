import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, MapPin, Package, CheckCircle2, Navigation, Clock, Phone, AlertTriangle,
  Search, Filter, ShieldCheck, RefreshCw, Zap, Compass, User, AlertOctagon, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { marketplaceApi } from "@/lib/marketplace-api";

interface ActiveDelivery {
  id: string;
  orderId: string;
  customerName: string;
  status: "In Transit" | "Out for Delivery" | "Delivered" | "Delayed";
  driver: string;
  phone: string;
  vehicleType: string;
  eta: string;
  progress: number;
  destination: string;
  currentLocation: string;
  mapPos: { x: number; y: number }; // percentage coords on map canvas
  courierPartner: string;
}

export function DeliveryTracking() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDelivery, setSelectedDelivery] = useState<ActiveDelivery | null>(null);
  const [callModalDriver, setCallModalDriver] = useState<ActiveDelivery | null>(null);

  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([
    {
      id: "DEL-4482",
      orderId: "ORD-98235",
      customerName: "David Miller",
      status: "In Transit",
      driver: "Mike Johnson",
      phone: "+1 (555) 382-9102",
      vehicleType: "Express Cargo Van",
      eta: "35 mins",
      progress: 75,
      destination: "742 Evergreen Terrace, Sector 4",
      currentLocation: "Transit Hub 4 - Hwy 101 Northbound",
      mapPos: { x: 38, y: 42 },
      courierPartner: "DHL Express",
    },
    {
      id: "DEL-4483",
      orderId: "ORD-98236",
      customerName: "Sarah Jenkins",
      status: "Out for Delivery",
      driver: "Sarah Connor",
      phone: "+1 (555) 901-2244",
      vehicleType: "Hyperlocal Electric Scooter",
      eta: "12 mins",
      progress: 90,
      destination: "100 Universal City Plaza, Suite 400",
      currentLocation: "0.8 miles from delivery destination",
      mapPos: { x: 68, y: 32 },
      courierPartner: "Aramex Express",
    },
    {
      id: "DEL-4484",
      orderId: "ORD-98238",
      customerName: "Robert Chen",
      status: "Delayed",
      driver: "John Smith",
      phone: "+1 (555) 771-0099",
      vehicleType: "Heavy Freight Semi-Truck",
      eta: "Delayed +40 mins",
      progress: 45,
      destination: "456 Market St, Industrial Park",
      currentLocation: "Traffic Congestion on Interstate 280",
      mapPos: { x: 25, y: 65 },
      courierPartner: "FedEx Freight",
    },
    {
      id: "DEL-4481",
      orderId: "ORD-98234",
      customerName: "Amira Al-Mansoor",
      status: "Delivered",
      driver: "Tom Cruise",
      phone: "+1 (555) 443-8811",
      vehicleType: "Cargo Van",
      eta: "Delivered at 2:30 PM",
      progress: 100,
      destination: "123 Main St, Central Plaza",
      currentLocation: "Completed at Customer Doorstep",
      mapPos: { x: 78, y: 72 },
      courierPartner: "Local Fleet Direct",
    },
  ]);

  const filtered = deliveries.filter(d => {
    const matchesSearch = d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.driver.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Live Fleet & Delivery Operations Tracking</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500 animate-ping" /> GPS Live Telemetry
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Real-time visibility into marketplace delivery fleets, driver GPS telemetry, and transit SLAs.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Delivery, Order, or Driver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="in transit">In Transit</option>
            <option value="out for delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="delayed">Delayed Alerts</option>
          </select>
        </div>
      </div>

      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
            <Truck className="size-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Dispatches</p>
            <h3 className="text-xl font-bold text-foreground">148 Shipments</h3>
            <p className="text-[11px] text-blue-600 font-medium">Across 12 Dispatch Hubs</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On-Time Delivery SLA</p>
            <h3 className="text-xl font-bold text-foreground">98.4%</h3>
            <p className="text-[11px] text-emerald-600 font-medium">+1.2% vs Last Week</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <Zap className="size-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Express Fulfillment</p>
            <h3 className="text-xl font-bold text-foreground">24 Mins</h3>
            <p className="text-[11px] text-amber-600 font-medium">Hyperlocal Guarantee Active</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Transit Delays / Incidents</p>
            <h3 className="text-xl font-bold text-foreground">1 Alert</h3>
            <p className="text-[11px] text-red-600 font-medium">Reroute Suggested</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map Vector Canvas + Active Delivery List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Vector Map Canvas */}
        <div className="lg:col-span-7 glass-panel rounded-xl border border-border/50 overflow-hidden relative min-h-[480px] flex flex-col justify-between p-4 shadow-sm bg-slate-950/40">
          
          {/* Map Header Overlay */}
          <div className="z-10 flex justify-between items-center bg-background/80 backdrop-blur-md p-3 rounded-lg border border-border/50 text-xs">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-primary animate-spin" style={{ animationDuration: '10s' }} />
              <span className="font-semibold text-foreground">Metropolitan Express Fleet Live Map</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500" /> In Transit</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> Out for Delivery</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500" /> Delayed</span>
            </div>
          </div>

          {/* SVG Map Roads & Grid Background */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
            <svg className="w-full h-full stroke-slate-700/60" strokeWidth="1.5" fill="none">
              <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#map-grid)" />
              {/* Simulated Arterial Highways */}
              <path d="M -50 150 Q 200 80 500 200 T 900 350" stroke="rgba(59,130,246,0.3)" strokeWidth="4" />
              <path d="M 120 -50 Q 180 250 350 500" stroke="rgba(16,185,129,0.3)" strokeWidth="3" />
              <path d="M 300 50 Q 450 300 800 120" stroke="rgba(245,158,11,0.3)" strokeWidth="3" />
            </svg>
          </div>

          {/* Map Delivery Markers */}
          <div className="relative z-10 flex-1 my-4">
            {deliveries.map((del) => {
              const isSelected = selectedDelivery?.id === del.id;
              return (
                <motion.div
                  key={del.id}
                  style={{ left: `${del.mapPos.x}%`, top: `${del.mapPos.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  onClick={() => setSelectedDelivery(del)}
                  whileHover={{ scale: 1.15 }}
                >
                  {/* Pulse Ring */}
                  <span className={cn("absolute -inset-2 rounded-full opacity-75 animate-ping",
                    del.status === "Delivered" ? "bg-emerald-500" :
                    del.status === "In Transit" ? "bg-blue-500" :
                    del.status === "Delayed" ? "bg-red-500" : "bg-amber-500"
                  )} />

                  {/* Marker Pin */}
                  <div className={cn("relative size-9 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-background font-bold text-xs transition-transform",
                    del.status === "Delivered" ? "bg-emerald-600" :
                    del.status === "In Transit" ? "bg-blue-600" :
                    del.status === "Delayed" ? "bg-red-600" : "bg-amber-600",
                    isSelected ? "ring-4 ring-primary scale-110" : ""
                  )}>
                    <Truck className="size-4" />
                  </div>

                  {/* Hover Tooltip */}
                  <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 hidden group-hover:block bg-background/95 border border-border p-2 rounded-lg text-[11px] whitespace-nowrap shadow-xl z-30">
                    <p className="font-bold text-foreground">{del.id} ({del.status})</p>
                    <p className="text-muted-foreground">Driver: {del.driver}</p>
                    <p className="text-emerald-500 font-mono">ETA: {del.eta}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Selected Delivery Drawer Overlay on Map */}
          {selectedDelivery && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="z-10 bg-background/90 backdrop-blur-md p-4 rounded-xl border border-border space-y-3 shadow-xl"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{selectedDelivery.id}</span>
                    <span className="text-xs text-muted-foreground font-mono">Order: {selectedDelivery.orderId}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Customer: <strong className="text-foreground">{selectedDelivery.customerName}</strong></p>
                </div>
                <button onClick={() => setSelectedDelivery(null)} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs bg-accent/40 p-2.5 rounded-lg">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Current Location</span>
                  <p className="font-medium text-foreground truncate">{selectedDelivery.currentLocation}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">ETA & Progress</span>
                  <p className="font-bold text-emerald-500 font-mono">{selectedDelivery.eta} ({selectedDelivery.progress}%)</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Map Footer Legend */}
          <div className="z-10 flex justify-between items-center text-[11px] text-muted-foreground bg-background/70 backdrop-blur-md p-2 px-3 rounded-lg border border-border/40">
            <span>Click any vehicle marker pin to inspect live telemetry</span>
            <span>Live GPS Refresh: <strong className="text-emerald-500 font-mono">Every 5s</strong></span>
          </div>
        </div>

        {/* Active Dispatches List */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="font-bold text-foreground flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Package className="size-4 text-primary" /> Active Dispatches</span>
            <span className="text-xs font-normal text-muted-foreground">Showing {filtered.length} active</span>
          </h3>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
            {filtered.map((del, i) => (
              <motion.div
                key={del.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn("glass-panel p-4 rounded-xl border transition-all cursor-pointer",
                  selectedDelivery?.id === del.id ? "border-primary bg-primary/5 shadow-md" : "border-border/50 hover:border-primary/30"
                )}
                onClick={() => setSelectedDelivery(del)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">{del.id}</h4>
                      <span className="text-xs text-muted-foreground font-mono">Order: {del.orderId}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Customer: <strong className="text-foreground">{del.customerName}</strong></p>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase",
                    del.status === "Delivered" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                    del.status === "In Transit" ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
                    del.status === "Delayed" ? "bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse" :
                    "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  )}>
                    {del.status}
                  </span>
                </div>

                <div className="space-y-1.5 mb-3 text-xs">
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="truncate">{del.destination}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Navigation className="size-3.5 text-sky-500 shrink-0" />
                    <span className={cn("truncate", del.status === "Delayed" ? "text-red-500" : "text-foreground")}>
                      {del.currentLocation}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3 text-primary" /> ETA: <strong className="text-foreground">{del.eta}</strong>
                    </span>
                    <span className="font-mono font-semibold text-foreground">{del.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-accent/60 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${del.progress}%` }}
                      transition={{ delay: 0.2, duration: 0.8 }}
                      className={cn("h-full rounded-full",
                        del.progress === 100 ? "bg-emerald-500" :
                        del.status === "Delayed" ? "bg-red-500" : "bg-blue-500"
                      )}
                    />
                  </div>
                </div>

                {/* Driver Footer & Call Quick Action */}
                <div className="flex justify-between items-center pt-2.5 border-t border-border/40 text-xs">
                  <div className="text-muted-foreground">
                    Driver: <span className="font-semibold text-foreground">{del.driver}</span> ({del.vehicleType})
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCallModalDriver(del); }}
                    className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                  >
                    <Phone className="size-3" /> Call Driver
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Driver Call Modal */}
      {callModalDriver && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Phone className="size-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">{callModalDriver.driver}</h3>
              <p className="text-xs text-muted-foreground">{callModalDriver.vehicleType} • {callModalDriver.courierPartner}</p>
            </div>
            <div className="bg-accent/40 p-3 rounded-lg font-mono font-bold text-primary text-base">
              {callModalDriver.phone}
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => setCallModalDriver(null)} className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-xs font-medium">Close</button>
              <a href={`tel:${callModalDriver.phone}`} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1">
                <Phone className="size-3" /> Dial Now
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
