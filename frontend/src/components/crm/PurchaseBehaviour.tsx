import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Clock, Star, Tag, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";
import { crmIntelligenceApi, IntelPurchaseBehaviour } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

export function PurchaseBehaviour() {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<IntelPurchaseBehaviour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmIntelligenceApi.getPurchaseBehaviour();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load purchase behaviour data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-accent rounded-lg" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-accent rounded-xl" />)}</div>
        <div className="grid grid-cols-3 gap-6">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 bg-accent rounded-xl" />)}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{error || "No purchase behaviour data available"}</p>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm">
          <RefreshCw className="size-4" /> Retry
        </button>
      </div>
    );
  }

  const maxOrders = Math.max(...data.purchase_times.map(p => p.orders), 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Behaviour</h1>
          <p className="text-sm text-muted-foreground mt-1">Real buying frequency, customer segments, top spenders, and purchase timing from live order data.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-sm text-muted-foreground transition-colors">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Purchase Frequency", value: `${data.summary.avg_frequency}x / cust`, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Avg Order Value", value: fmt(data.summary.avg_order_value), icon: ShoppingCart, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Peak Purchase Hour", value: data.summary.peak_hour, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Top Customer Type", value: data.summary.top_category, icon: Star, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4"
          >
            <div className={`p-3 rounded-xl ${stat.bg} shrink-0`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-lg font-bold text-foreground">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Segments by Revenue */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Tag className="size-4 text-primary" /> Customer Types by Revenue
          </h3>
          {data.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {data.categories.map((cat, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">{cat.pct}%</span>
                      <span className="font-semibold text-primary text-xs">{fmt(cat.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.pct}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="h-full gradient-brand rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Spenders */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Star className="size-4 text-primary" /> Top Spenders
          </h3>
          {data.top_buyers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {data.top_buyers.map((buyer, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-4"
                >
                  <div className="size-8 rounded-lg bg-accent flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                    #{i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{buyer.name}</span>
                      <span className="text-muted-foreground text-xs">{buyer.score} pts</span>
                    </div>
                    <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${buyer.score}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className="h-full bg-amber-500/80 rounded-full"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Time Distribution */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-primary" /> Peak Purchase Hours
          </h3>
          {data.purchase_times.every(p => p.orders === 0) ? (
            <p className="text-sm text-muted-foreground">Not enough order data to compute timing.</p>
          ) : (
            <div className="space-y-2">
              {data.purchase_times.map((pt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{pt.hour}</span>
                  <div className="flex-1 h-6 bg-accent rounded-lg overflow-hidden relative group cursor-pointer">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(pt.orders / maxOrders) * 100}%` }}
                      transition={{ delay: i * 0.06, duration: 0.5 }}
                      className="h-full rounded-lg"
                      style={{
                        background: `hsl(${230 - (pt.orders / maxOrders) * 80}, 70%, ${60 - (pt.orders / maxOrders) * 20}%)`,
                        opacity: 0.7 + (pt.orders / maxOrders) * 0.3
                      }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {pt.orders} orders
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
