import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, ShoppingCart, RotateCcw, ArrowUpRight, ArrowDownRight, BarChart3, RefreshCw, AlertCircle } from "lucide-react";
import { crmIntelligenceApi, IntelAnalytics } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

export function CustomerAnalytics({ tab = "analytics" }: { tab?: string }) {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<IntelAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmIntelligenceApi.getAnalytics();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-accent rounded-lg" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-accent rounded-xl" />)}</div>
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{error || "No data available"}</p>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm">
          <RefreshCw className="size-4" /> Retry
        </button>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.monthly_data.map(d => d.revenue), 1);
  const maxOrders = Math.max(...data.monthly_data.map(d => d.orders), 1);
  const maxNewCust = Math.max(...data.monthly_data.map(d => d.new_customers), 1);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const stats = [
    { label: "Total Revenue (YTD)", value: fmt(data.total_revenue), sub: `${data.total_orders.toLocaleString()} orders`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Total Customers", value: data.total_customers.toLocaleString(), sub: `${data.active_customers.toLocaleString()} active`, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Repeat Purchase Rate", value: `${data.repeat_rate}%`, sub: "returning customers", icon: RotateCcw, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Avg Order Value", value: fmt(data.avg_order_value), sub: `${data.new_customers_this_month} new this month`, icon: ShoppingCart, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  const maxSegCount = Math.max(...data.segments.map(s => s.count), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Live revenue trends, order volume, and customer growth metrics from your CRM database.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-sm text-muted-foreground transition-colors">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden group"
          >
            <div className={`absolute -right-4 -bottom-4 size-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity ${stat.bg}`} />
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`size-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Revenue bar chart */}
      <div className="glass-panel p-6 rounded-xl border border-border/50">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" /> Monthly Revenue
          </h2>
          <span className="text-xs text-muted-foreground">Last 6 months · Live data</span>
        </div>
        {data.monthly_data.every(d => d.revenue === 0) ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <BarChart3 className="size-8 opacity-30" />
            <p className="text-sm">No sales orders recorded yet. Revenue will appear here once orders are created.</p>
          </div>
        ) : (
          <div className="flex items-end gap-4 h-48">
            {data.monthly_data.map((d, i) => (
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
                      {fmt(d.revenue)}
                    </div>
                  </motion.div>
                </div>
                <span className="text-xs text-muted-foreground">{d.month}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Breakdown panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Segments */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground">Customer Segments</h3>
          {data.segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customer segments yet.</p>
          ) : (
            data.segments.map((seg, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{seg.name}</span>
                  <span className="font-semibold text-primary">{seg.count.toLocaleString()} customers</span>
                </div>
                <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(seg.count / maxSegCount) * 100}%` }} transition={{ delay: i * 0.1, duration: 0.5 }} className="h-full gradient-brand rounded-full" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Monthly Orders & Customers */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground">Monthly Orders & New Customers</h3>
          <div className="space-y-3">
            {data.monthly_data.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-8">{d.month}</span>
                <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(d.orders / maxOrders) * 100}%` }} transition={{ delay: i * 0.08, duration: 0.4 }} className="h-full bg-blue-500/70 rounded-full" />
                </div>
                <span className="text-xs font-semibold text-foreground w-12 text-right">{d.orders.toLocaleString()}</span>
                <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(d.new_customers / maxNewCust) * 100}%` }} transition={{ delay: i * 0.08, duration: 0.4 }} className="h-full bg-emerald-500/70 rounded-full" />
                </div>
                <span className="text-xs font-semibold text-emerald-600 w-8 text-right">+{d.new_customers}</span>
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
