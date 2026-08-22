import React, { useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Clock, DollarSign, Store, ShieldCheck, Star, Search, Plus, Calendar, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceListing {
  id: string;
  title: string;
  provider: string;
  category: string;
  rateType: "Hourly Rate" | "Fixed Project Rate";
  price: number;
  rating: number;
  completedJobs: number;
  slaResponse: string;
  status: "Active" | "Pending Review";
}

export function MarketplaceServices() {
  const [searchTerm, setSearchTerm] = useState("");

  const [services, setServices] = useState<ServiceListing[]>([
    {
      id: "SRV-201",
      title: "Commercial IT Hardware On-Site Installation & Setup",
      provider: "Apex Tech Solutions",
      category: "IT Support & Infrastructure",
      rateType: "Hourly Rate",
      price: 85.00,
      rating: 4.9,
      completedJobs: 142,
      slaResponse: "< 2 Hours",
      status: "Active",
    },
    {
      id: "SRV-202",
      title: "Warehouse Ergonomic Layout & Racking Assembly",
      provider: "Global Logistics Hub",
      category: "Warehouse Logistics",
      rateType: "Fixed Project Rate",
      price: 1250.00,
      rating: 4.8,
      completedJobs: 38,
      slaResponse: "< 4 Hours",
      status: "Active",
    },
    {
      id: "SRV-203",
      title: "Heavy Industrial Machinery Annual Maintenance (PMC)",
      provider: "Nexus Supply Chain",
      category: "Maintenance & Repairs",
      rateType: "Fixed Project Rate",
      price: 2400.00,
      rating: 5.0,
      completedJobs: 65,
      slaResponse: "< 1 Hour",
      status: "Active",
    },
  ]);

  const filtered = services.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Services & Contracts</h1>
          <p className="text-sm text-muted-foreground">Manage B2B service listings, hourly/project rate bookings, and vendor service SLAs.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((srv, i) => (
          <motion.div
            key={srv.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 flex flex-col justify-between hover:border-primary/20 transition-all space-y-4"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-primary/10 text-primary border border-primary/20">
                  {srv.category}
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                  <Star className="size-3.5 fill-amber-400" /> {srv.rating}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-base leading-snug">{srv.title}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Store className="size-3.5 text-primary" /> Provider: <strong className="text-foreground">{srv.provider}</strong>
              </p>
            </div>

            <div className="bg-background/50 p-3 rounded-lg border border-border/40 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{srv.rateType}:</span>
                <span className="text-lg font-bold text-emerald-500 font-mono">
                  ${srv.price.toFixed(2)} {srv.rateType === "Hourly Rate" ? "/ hr" : ""}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/30">
                <span>Response SLA: <strong className="text-foreground">{srv.slaResponse}</strong></span>
                <span>Completed Jobs: <strong className="text-foreground">{srv.completedJobs}</strong></span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
