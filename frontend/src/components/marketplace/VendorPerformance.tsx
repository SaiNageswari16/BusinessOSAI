import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, ShieldAlert, Award, Clock, AlertTriangle, CheckCircle2, TrendingUp, Search, Filter, RefreshCw, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { marketplaceApi } from "@/lib/marketplace-api";

interface VendorSLA {
  id: string;
  vendorName: string;
  vendorCode: string;
  category: string;
  slaTier: "Platinum" | "Gold" | "Silver" | "At Risk";
  onTimeDispatch: number; // percentage
  cancellationRate: number; // percentage
  returnRate: number; // percentage
  avgFulfillmentHours: number;
  totalOrdersProcessed: number;
  slaScore: number; // out of 100
  status: "Compliant" | "Warning" | "Suspended";
}

export function VendorPerformance() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState("all");

  const [vendorMetrics, setVendorMetrics] = useState<VendorSLA[]>([
    {
      id: "SLA-001",
      vendorName: "Apex Tech Solutions",
      vendorCode: "APEX",
      category: "Electronics",
      slaTier: "Platinum",
      onTimeDispatch: 98.4,
      cancellationRate: 0.6,
      returnRate: 1.2,
      avgFulfillmentHours: 4.5,
      totalOrdersProcessed: 1420,
      slaScore: 97,
      status: "Compliant",
    },
    {
      id: "SLA-002",
      vendorName: "Global Logistics Hub",
      vendorCode: "GLOG",
      category: "Logistics & Freight",
      slaTier: "Gold",
      onTimeDispatch: 94.2,
      cancellationRate: 1.5,
      returnRate: 2.1,
      avgFulfillmentHours: 8.2,
      totalOrdersProcessed: 980,
      slaScore: 91,
      status: "Compliant",
    },
    {
      id: "SLA-003",
      vendorName: "Nexus Supply Chain",
      vendorCode: "NEXS",
      category: "Industrial Tools",
      slaTier: "Platinum",
      onTimeDispatch: 99.1,
      cancellationRate: 0.2,
      returnRate: 0.8,
      avgFulfillmentHours: 3.2,
      totalOrdersProcessed: 2150,
      slaScore: 98,
      status: "Compliant",
    },
    {
      id: "SLA-004",
      vendorName: "Urban Retail Group",
      vendorCode: "URBN",
      category: "Fashion & Lifestyle",
      slaTier: "At Risk",
      onTimeDispatch: 78.5,
      cancellationRate: 6.4,
      returnRate: 8.9,
      avgFulfillmentHours: 34.0,
      totalOrdersProcessed: 310,
      slaScore: 64,
      status: "Warning",
    },
  ]);

  useEffect(() => {
    marketplaceApi.getVendorPerformance().then(data => {
      if (data.scorecards && data.scorecards.length > 0) {
        setVendorMetrics(data.scorecards);
      }
    }).catch(() => {});
  }, []);

  const issueWarning = (id: string) => {
    setVendorMetrics(prev =>
      prev.map(v => v.id === id ? { ...v, status: v.status === "Warning" ? "Suspended" : "Warning" } : v)
    );
  };

  const filtered = vendorMetrics.filter(v => {
    const matchesSearch = v.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.vendorCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === "all" || v.slaTier.toLowerCase() === tierFilter.toLowerCase();
    return matchesSearch && matchesTier;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Performance & SLA Scorecard</h1>
          <p className="text-sm text-muted-foreground">Track fulfillment speed, SLA compliance metrics, cancellation rates, and operational health.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vendor SLA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select 
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none"
          >
            <option value="all">All Tiers</option>
            <option value="platinum">Platinum</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="at risk">At Risk</option>
          </select>
        </div>
      </div>

      {/* SLA Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Clock className="size-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Marketplace Dispatch</p>
            <h3 className="text-xl font-bold text-foreground">5.2 Hours</h3>
            <p className="text-[11px] text-emerald-600 font-medium">96.8% On-Time</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Award className="size-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg SLA Compliance</p>
            <h3 className="text-xl font-bold text-foreground">92.5 / 100</h3>
            <p className="text-[11px] text-primary font-medium">Top Tier Performance</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Order Cancellation</p>
            <h3 className="text-xl font-bold text-foreground">1.4%</h3>
            <p className="text-[11px] text-amber-600 font-medium">Well below 3.0% threshold</p>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
          <div className="size-12 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold">
            <ShieldAlert className="size-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Vendors At Risk</p>
            <h3 className="text-xl font-bold text-foreground">1 Vendor</h3>
            <p className="text-[11px] text-red-600 font-medium">SLA Warning Active</p>
          </div>
        </div>
      </div>

      {/* Vendor SLA Performance Table */}
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/20">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Activity className="size-4 text-primary" /> Vendor SLA Metrics & Scorecards
          </h3>
          <span className="text-xs text-muted-foreground">Updated in real-time from fulfillment pipeline</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="bg-muted/40 uppercase font-semibold text-[10px] text-foreground border-b border-border/50">
              <tr>
                <th className="p-3.5">Vendor</th>
                <th className="p-3.5">SLA Tier</th>
                <th className="p-3.5">On-Time Dispatch</th>
                <th className="p-3.5">Cancellation Rate</th>
                <th className="p-3.5">Return Rate</th>
                <th className="p-3.5">Avg Dispatch Time</th>
                <th className="p-3.5 text-center">SLA Score</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((v, i) => (
                <motion.tr 
                  key={v.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-accent/30 transition-colors"
                >
                  <td className="p-3.5 font-medium text-foreground">
                    <div>
                      <span className="font-semibold text-sm">{v.vendorName}</span>
                      <p className="text-[10px] font-mono text-muted-foreground">{v.vendorCode} • {v.category}</p>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider",
                      v.slaTier === "Platinum" ? "bg-purple-500/10 text-purple-600 border border-purple-500/20" :
                      v.slaTier === "Gold" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                      v.slaTier === "Silver" ? "bg-sky-500/10 text-sky-600 border border-sky-500/20" :
                      "bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse"
                    )}>
                      {v.slaTier}
                    </span>
                  </td>
                  <td className="p-3.5 font-semibold text-foreground">
                    <span className={v.onTimeDispatch >= 95 ? "text-emerald-600" : "text-amber-600"}>
                      {v.onTimeDispatch}%
                    </span>
                  </td>
                  <td className="p-3.5 font-semibold text-foreground">
                    <span className={v.cancellationRate <= 2 ? "text-emerald-600" : "text-red-600"}>
                      {v.cancellationRate}%
                    </span>
                  </td>
                  <td className="p-3.5 font-semibold text-foreground">{v.returnRate}%</td>
                  <td className="p-3.5 font-mono text-foreground">{v.avgFulfillmentHours} hrs</td>
                  <td className="p-3.5 text-center">
                    <div className="inline-flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                      {v.slaScore}
                    </div>
                  </td>
                  <td className="p-3.5 text-right">
                    <button 
                      onClick={() => issueWarning(v.id)}
                      className={cn("px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ml-auto",
                        v.status === "Compliant" ? "bg-accent hover:bg-accent/80 text-foreground" :
                        v.status === "Warning" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20" :
                        "bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20"
                      )}
                    >
                      <AlertOctagon className="size-3.5" />
                      {v.status === "Compliant" ? "Issue Notice" : v.status === "Warning" ? "Status: Warning" : "Status: Suspended"}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
