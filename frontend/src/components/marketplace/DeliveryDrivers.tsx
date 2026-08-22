import React, { useState } from "react";
import { motion } from "framer-motion";
import { Users, Truck, CheckCircle2, Phone, ShieldCheck, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicleType: "Cargo Van" | "Delivery Bike" | "Heavy Freight Truck";
  licenseNo: string;
  completedDeliveries: number;
  rating: number;
  status: "On-Duty & Available" | "In-Transit" | "Off-Duty";
}

export function DeliveryDrivers() {
  const [searchTerm, setSearchTerm] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([
    {
      id: "DRV-401",
      name: "Michael Vance",
      phone: "+1 (555) 382-9102",
      vehicleType: "Cargo Van",
      licenseNo: "DL-88192301",
      completedDeliveries: 420,
      rating: 4.9,
      status: "In-Transit",
    },
    {
      id: "DRV-402",
      name: "Hassan Al-Zahrani",
      phone: "+966 50 123 4567",
      vehicleType: "Delivery Bike",
      licenseNo: "DL-77291034",
      completedDeliveries: 890,
      rating: 4.8,
      status: "On-Duty & Available",
    },
    {
      id: "DRV-403",
      name: "Alex Rivera",
      phone: "+1 (555) 901-2244",
      vehicleType: "Heavy Freight Truck",
      licenseNo: "CDL-99120482",
      completedDeliveries: 310,
      rating: 5.0,
      status: "Off-Duty",
    },
  ]);

  const filtered = drivers.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fleet Drivers Roster</h1>
          <p className="text-sm text-muted-foreground">Manage internal fleet drivers, vehicle assignments, driving license checks, and active duty status.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search driver name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((drv, i) => (
          <motion.div
            key={drv.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 space-y-4 hover:border-primary/20 transition-all flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  {drv.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base leading-snug">{drv.name}</h3>
                  <span className="text-[10px] font-mono text-muted-foreground">{drv.id} • {drv.vehicleType}</span>
                </div>
              </div>
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                drv.status === "On-Duty & Available" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                drv.status === "In-Transit" ? "bg-sky-500/10 text-sky-600 border border-sky-500/20" :
                "bg-muted text-muted-foreground border border-border"
              )}>
                {drv.status}
              </span>
            </div>

            <div className="bg-background/50 p-3 rounded-lg border border-border/40 text-xs space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Contact Phone:</span>
                <span className="font-mono text-foreground font-semibold flex items-center gap-1">
                  <Phone className="size-3 text-primary" /> {drv.phone}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>License Verified:</span>
                <span className="font-mono text-foreground font-semibold text-[10px]">{drv.licenseNo}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Completed Jobs:</span>
                <span className="font-bold text-foreground font-mono">{drv.completedDeliveries}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
