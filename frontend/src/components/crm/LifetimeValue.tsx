import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ShoppingCart, Users, DollarSign, RefreshCw, AlertCircle, Building2 } from "lucide-react";
import { crmIntelligenceApi, IntelLtv, IntelLtvCustomer } from "@/lib/api-client";

const GRADIENT_COLORS = [
  "from-cyan-500 to-blue-600",
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-violet-500 to-indigo-600",
];

export function LifetimeValue({ tab = "ltv" }: { tab?: string }) {
  const [data, setData] = useState<IntelLtv | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmIntelligenceApi.getLifetimeValue();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load CLV data");
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
        <div className="grid grid-cols-2 gap-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 bg-accent rounded-xl" />)}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{error || "No CLV data available"}</p>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm">
          <RefreshCw className="size-4" /> Retry
        </button>
      </div>
    );
  }

  const maxLTV = Math.max(...data.customers.map(c => c.ltv), 1);

  const summaryStats = [
    { label: "Avg Customer LTV", value: fmt(data.summary.avg_ltv), icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Total Customer Value", value: fmt(data.summary.total_customer_value), icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Total Customers", value: data.summary.total_customers.toLocaleString(), icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Avg Orders / Customer", value: data.summary.avg_orders_per_customer.toFixed(1), icon: ShoppingCart, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Lifetime Value (CLV)</h1>
          <p className="text-sm text-muted-foreground mt-1">Real total revenue, profit, and engagement computed from live sales orders per customer.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-sm text-muted-foreground transition-colors">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryStats.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4"
          >
            <div className={`p-3 rounded-xl ${stat.bg} shrink-0`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-xl font-bold text-foreground">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Customer CLV Cards */}
      {data.customers.length === 0 ? (
        <div className="glass-panel p-10 rounded-xl border border-border/50 text-center">
          <ShoppingCart className="size-10 mx-auto text-muted-foreground opacity-30 mb-3" />
          <p className="text-muted-foreground">No sales orders found. CLV data will appear here once orders are created.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.customers.map((c, i) => {
            const gradient = GRADIENT_COLORS[i % GRADIENT_COLORS.length];
            const pct = Math.round((c.ltv / maxLTV) * 100);
            return (
              <motion.div
                key={c.customer_id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="glass-panel rounded-xl border border-border/50 overflow-hidden hover:shadow-elegant transition-all"
              >
                <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />
                <div className="p-6">
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{c.customer}</h3>
                      {c.company && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Building2 className="size-3" /> {c.company}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">Customer for {c.years} year{c.years !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">{fmt(c.ltv)}</p>
                      <p className="text-xs text-muted-foreground">Lifetime Value</p>
                    </div>
                  </div>

                  {/* LTV bar */}
                  <div className="mb-5">
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>LTV Progress</span>
                      <span>{pct}% of top customer</span>
                    </div>
                    <div className="h-3 w-full bg-accent rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.1 + 0.3, duration: 0.7, ease: "easeOut" }}
                        className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Profit Generated", value: fmt(c.profit) },
                      { label: "Total Orders", value: c.orders.toLocaleString() },
                      { label: "Customer Since", value: `${c.years}y` },
                    ].map((metric, j) => (
                      <div key={j} className="p-3 bg-muted/30 rounded-lg border border-border/50 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{metric.label}</p>
                        <p className="font-bold text-foreground">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
