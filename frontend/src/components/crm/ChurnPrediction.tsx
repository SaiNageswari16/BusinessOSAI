import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, AlertTriangle, Search, ArrowUpRight, RefreshCw, AlertCircle } from "lucide-react";
import { crmIntelligenceApi, IntelChurn, IntelChurnCustomer } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

interface Props { tab?: string; }

export function ChurnPrediction({ tab = "churn_prediction" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<IntelChurn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState("All");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmIntelligenceApi.getChurn();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load churn predictions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getRiskColor = (risk: number) => {
    if (risk >= 70) return { text: "text-red-600", bar: "bg-red-500" };
    if (risk >= 45) return { text: "text-amber-600", bar: "bg-amber-500" };
    return { text: "text-blue-600", bar: "bg-blue-500" };
  };

  const tierMap: Record<string, string> = {
    "High Risk": "Inactive",
    "At Risk": "At Risk",
    "Watch": "Watch",
  };

  const filtered = (data?.customers ?? []).filter(c =>
    c.customer.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterTier === "All" || c.tier === filterTier || (filterTier === "Inactive" && c.tier === "High Risk"))
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-accent rounded-lg" />
        <div className="h-32 bg-accent rounded-xl" />
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-accent rounded-xl" />)}</div>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Churn Prediction</h2>
          <p className="text-sm text-muted-foreground mt-1">Customers at risk of churning, computed from real purchase recency, frequency, and support data.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 h-8 bg-accent hover:bg-accent/80 rounded-lg text-xs font-semibold text-muted-foreground transition-colors">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {/* AI Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 p-6 bg-gradient-to-r from-primary/10 via-background to-primary/5">
        <div className="absolute -right-12 -top-12 size-48 rounded-full blur-3xl bg-primary/20" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="size-16 rounded-2xl gradient-brand flex items-center justify-center shadow-elegant shrink-0">
            <BrainCircuit className="size-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground mb-1">Antigravity AI Churn Model</h2>
            <p className="text-sm text-muted-foreground">
              Analysed <span className="font-semibold text-primary">{data.summary.total} customers</span> using purchase recency, order frequency, and open support tickets to predict churn risk.
            </p>
          </div>
          <div className="flex gap-6 shrink-0">
            {[
              { label: "High Risk", value: data.summary.high_risk, color: "text-red-500" },
              { label: "At Risk", value: data.summary.at_risk, color: "text-amber-500" },
              { label: "Watch", value: data.summary.watch, color: "text-blue-500" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search at-risk customers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2">
          {["All", "High Risk", "At Risk", "Watch"].map(tier => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={cn("px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                filterTier === tier ? "bg-primary text-white shadow-md" : "bg-background/50 border border-border hover:bg-accent text-foreground"
              )}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="glass-panel p-10 rounded-xl border border-border/50 text-center">
            <BrainCircuit className="size-10 mx-auto text-muted-foreground opacity-30 mb-3" />
            <p className="text-muted-foreground">No customers match the current filter.</p>
          </div>
        ) : (
          filtered.map((c, i) => {
            const colors = getRiskColor(c.risk);
            return (
              <motion.div
                key={c.customer_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass-panel p-5 rounded-xl border border-border/50 hover:border-red-500/20 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="size-11 rounded-xl bg-accent flex items-center justify-center shrink-0 text-lg font-bold text-muted-foreground">
                      {c.customer.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{c.customer}</p>
                      <p className="text-xs text-muted-foreground">{c.company || "Individual"} · Last purchase: {c.last_purchase}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center w-20">
                      <div className={`text-2xl font-bold ${colors.text}`}>{c.risk}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Churn Risk</div>
                    </div>
                    <div className="w-32 h-2 bg-accent rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${c.risk}%` }}
                        transition={{ delay: i * 0.06 + 0.2, duration: 0.6 }}
                        className={`h-full ${colors.bar} rounded-full`}
                      />
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap",
                      c.tier === "High Risk" ? "bg-red-500/10 text-red-600" :
                      c.tier === "At Risk" ? "bg-amber-500/10 text-amber-600" :
                      "bg-blue-500/10 text-blue-600"
                    )}>
                      {c.tier}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col md:flex-row items-start md:items-center gap-4">
                  <div className="flex items-start gap-2 flex-1">
                    <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{c.reason}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors">
                      Send Win-Back
                    </button>
                    <button className="px-3 py-1.5 text-xs font-medium bg-background border border-border hover:bg-accent rounded-lg transition-colors flex items-center gap-1">
                      View Profile <ArrowUpRight className="size-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
