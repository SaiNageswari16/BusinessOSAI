import React from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, ShoppingCart, RotateCcw, ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";

const monthlyData = [
  { month: "Jan", revenue: 820000, orders: 3200, newCustomers: 410 },
  { month: "Feb", revenue: 910000, orders: 3850, newCustomers: 520 },
  { month: "Mar", revenue: 1050000, orders: 4100, newCustomers: 680 },
  { month: "Apr", revenue: 980000, orders: 3900, newCustomers: 590 },
  { month: "May", revenue: 1200000, orders: 4600, newCustomers: 820 },
  { month: "Jun", revenue: 1350000, orders: 5100, newCustomers: 945 },
];

const maxRevenue = Math.max(...monthlyData.map(d => d.revenue));

export function CustomerAnalytics({ tab = "analytics" }: { tab?: string }) {
  const { mockCrmStats } = useCrmData();
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Analytics</h1>
        <p className="text-sm text-muted-foreground">Deep-dive into revenue trends, order volume, and customer growth metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue (YTD)", value: "$12.5M", change: "+18.4%", up: true, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Total Orders", value: "50,430", change: "+12.1%", up: true, icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Repeat Purchase Rate", value: "64.2%", change: "+4.5%", up: true, icon: RotateCcw, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Churn Rate", value: "2.4%", change: "-0.3%", up: false, icon: Users, color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden group"
          >
            <div className={`absolute -right-4 -bottom-4 size-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity ${stat.bg}`} />
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`size-4 ${stat.color}`} />
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

      {/* Revenue bar chart */}
      <div className="glass-panel p-6 rounded-xl border border-border/50">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" /> Monthly Revenue
          </h2>
          <div className="flex gap-2">
            {["3M", "6M", "1Y", "All"].map(p => (
              <button key={p} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${p === "6M" ? "bg-primary text-white" : "bg-accent text-muted-foreground hover:bg-accent/80"}`}>{p}</button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-4 h-48">
          {monthlyData.map((d, i) => (
            <motion.div key={d.month} initial={{ height: 0 }} animate={{ height: "100%" }} transition={{ delay: i * 0.07 }} className="flex-1 flex flex-col items-center gap-2">
              <div className="flex-1 w-full flex items-end relative group">
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.07, duration: 0.4, ease: "easeOut" }}
                  style={{ height: `${(d.revenue / maxRevenue) * 100}%`, transformOrigin: "bottom" }}
                  className="w-full gradient-brand rounded-t-lg opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer relative"
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-semibold text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border px-2 py-1 rounded-md shadow-sm">
                    ${(d.revenue / 1000).toFixed(0)}K
                  </div>
                </motion.div>
              </div>
              <span className="text-xs text-muted-foreground">{d.month}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground">Top Customer Segments by Revenue</h3>
          {[
            { name: "Corporate", revenue: "$5.2M", pct: 72 },
            { name: "Wholesale", revenue: "$3.1M", pct: 48 },
            { name: "VIP", revenue: "$2.4M", pct: 35 },
            { name: "Retail", revenue: "$1.8M", pct: 24 },
          ].map((seg, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{seg.name}</span>
                <span className="font-semibold text-primary">{seg.revenue}</span>
              </div>
              <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${seg.pct}%` }} transition={{ delay: i * 0.1, duration: 0.5 }} className="h-full gradient-brand rounded-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground">Monthly Orders & Customers</h3>
          <div className="space-y-3">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-8">{d.month}</span>
                <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(d.orders / 5100) * 100}%` }} transition={{ delay: i * 0.08, duration: 0.4 }} className="h-full bg-blue-500/70 rounded-full" />
                </div>
                <span className="text-xs font-semibold text-foreground w-12 text-right">{d.orders.toLocaleString()}</span>
                <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(d.newCustomers / 945) * 100}%` }} transition={{ delay: i * 0.08, duration: 0.4 }} className="h-full bg-emerald-500/70 rounded-full" />
                </div>
                <span className="text-xs font-semibold text-emerald-600 w-8 text-right">+{d.newCustomers}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><div className="size-3 rounded-full bg-blue-500/70" /> Orders</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><div className="size-3 rounded-full bg-emerald-500/70" /> New Customers</div>
          </div>
        </div>
      </div>
    </div>
  );
}
