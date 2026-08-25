import React from "react";
import { motion } from "framer-motion";
import { Store, TrendingUp, Package, DollarSign, Clock, Users, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { mockMarketplaceStats } from "@/data/mockMarketplaceData";
import { useCurrency } from "@/hooks/use-currency";

export function VendorDashboard() {
    const { currency, formatCurrency } = useCurrency();
  const stats = [
    { label: "Total Vendors", value: mockMarketplaceStats.totalVendors.toLocaleString(), change: "+12.5%", up: true, icon: Store, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Active Vendors", value: mockMarketplaceStats.activeVendors.toLocaleString(), change: "+8.2%", up: true, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Pending Approvals", value: mockMarketplaceStats.pendingApprovals.toLocaleString(), change: "-2.1%", up: false, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Total Products", value: mockMarketplaceStats.totalProducts.toLocaleString(), change: "+24.8%", up: true, icon: Package, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Marketplace Overview</h2>
        <p className="text-xs text-muted-foreground">Monitor vendor performance, product approvals, and marketplace GMV.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden group"
          >
            <div className={`absolute -right-4 -bottom-4 size-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity ${stat.bg}`} />
            
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`size-5 ${stat.color}`} />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${stat.up ? "text-emerald-500" : "text-red-500"}`}>
                {stat.up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {stat.change}
              </span>
            </div>
            
            <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-border/50">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-foreground">Gross Merchandise Value (GMV)</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">{currency.symbol}{(mockMarketplaceStats.monthlyGMV / 1000000).toFixed(1)}M This Month</span>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {[45, 60, 55, 75, 80, 100, 95].map((h, i) => (
              <div key={i} className="w-full flex flex-col items-center gap-2 group relative">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.05 + 0.2 }}
                  className="w-full bg-primary/20 hover:bg-primary/40 rounded-t-lg transition-colors relative"
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border px-2 py-1 rounded shadow-sm text-xs whitespace-nowrap z-10">
                    {currency.symbol}{(h * 0.12).toFixed(1)}M
                  </div>
                </motion.div>
                <span className="text-xs text-muted-foreground">Day {i * 4 + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Pending Actions
            </h2>
            <div className="space-y-3">
              {[
                { title: "Vendor Approvals", count: 85, color: "text-amber-500", bg: "bg-amber-500/10" },
                { title: "Product Reviews", count: 342, color: "text-blue-500", bg: "bg-blue-500/10" },
                { title: "Payouts Due", count: 12, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              ].map((action, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-background/50 border border-border rounded-lg hover:border-primary/20 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`size-8 rounded-md flex items-center justify-center font-bold ${action.bg} ${action.color}`}>
                      {action.count}
                    </div>
                    <span className="text-sm font-medium">{action.title}</span>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-border/50">
            <h3 className="text-sm font-bold text-foreground mb-3">Platform Health</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Vendor Retention</span>
                  <span className="font-semibold text-emerald-500">94.2%</span>
                </div>
                <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[94.2%] rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">On-Time Delivery</span>
                  <span className="font-semibold text-blue-500">88.5%</span>
                </div>
                <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[88.5%] rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
