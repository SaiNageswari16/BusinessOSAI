import React, { useState } from "react";
import { motion } from "framer-motion";
import { Truck, CheckCircle2, Star, Search, Plus, Network, ShieldCheck, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliveryPartner {
  id: string;
  name: string;
  code: string;
  type: "3PL Logistics" | "Hyperlocal Courier" | "Freight Provider";
  apiStatus: "Connected" | "Disconnected" | "Pending API Key";
  activeFleetSize: number;
  onTimeRate: number; // percentage
  coverageZones: string;
  status: "Active" | "Inactive";
}

export function DeliveryPartners() {
  const [searchTerm, setSearchTerm] = useState("");

  const [partners, setPartners] = useState<DeliveryPartner[]>([
    {
      id: "PART-101",
      name: "DHL Express Logistics",
      code: "DHL",
      type: "3PL Logistics",
      apiStatus: "Connected",
      activeFleetSize: 450,
      onTimeRate: 98.6,
      coverageZones: "Global & Nationwide",
      status: "Active",
    },
    {
      id: "PART-102",
      name: "FedEx Freight Systems",
      code: "FDX",
      type: "Freight Provider",
      apiStatus: "Connected",
      activeFleetSize: 320,
      onTimeRate: 97.2,
      coverageZones: "Interstate & Regional",
      status: "Active",
    },
    {
      id: "PART-103",
      name: "Aramex Express Hub",
      code: "ARMX",
      type: "Hyperlocal Courier",
      apiStatus: "Connected",
      activeFleetSize: 180,
      onTimeRate: 96.4,
      coverageZones: "Metro & Same-Day Radius",
      status: "Active",
    },
  ]);

  const filtered = partners.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">3PL Logistics & Delivery Partners</h1>
          <p className="text-sm text-muted-foreground">Manage third-party logistics (3PL) carrier integrations, API connections, and courier SLA performance.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logistics partner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 space-y-4 hover:border-primary/20 transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold font-mono text-sm border border-primary/20">
                    <Truck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-base leading-snug">{p.name}</h3>
                    <span className="text-[10px] font-mono text-muted-foreground">{p.code} • {p.type}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {p.status}
                </span>
              </div>
            </div>

            <div className="bg-background/50 p-3 rounded-lg border border-border/40 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Status:</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> {p.apiStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Fleet Size:</span>
                <span className="font-mono text-foreground font-semibold">{p.activeFleetSize} Vehicles</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">On-Time Delivery SLA:</span>
                <span className="font-bold text-emerald-500 font-mono">{p.onTimeRate}%</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
