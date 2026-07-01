import React, { useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, AlertTriangle, TrendingDown, Shield, Search, Filter, ArrowUpRight } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";
import { cn } from "@/lib/utils";

const churnData = [
  { customer: "David Chen", id: "CUST-004", risk: 89, lastPurchase: "46 days ago", reason: "No activity for 46 days, declining order frequency", tier: "Inactive" },
  { customer: "TechNova Solutions", id: "CUST-005", risk: 72, lastPurchase: "30 days ago", reason: "Billing dispute open, reduced order volume by 60%", tier: "At Risk" },
  { customer: "Sarah Jenkins", id: "CUST-002", risk: 38, lastPurchase: "2 days ago", reason: "Slight dip in purchase frequency vs baseline", tier: "Watch" },
  { customer: "Davis Retail", id: "EXT-001", risk: 91, lastPurchase: "62 days ago", reason: "No recent engagement, competitor pricing mentioned in last call", tier: "Inactive" },
  { customer: "Smith & Co", id: "EXT-002", risk: 55, lastPurchase: "18 days ago", reason: "Support ticket unresolved for 12 days, NPS score dropped", tier: "At Risk" },
];

interface Props {
  tab?: string;
}

export function ChurnPrediction({ tab = "churn_prediction" }: Props) {
  const { mockCustomers } = useCrmData();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState("All");

  const filtered = churnData.filter(c =>
    c.customer.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterTier === "All" || c.tier === filterTier)
  );

  const getRiskColor = (risk: number) => {
    if (risk >= 75) return { text: "text-red-600", bg: "bg-red-500", bar: "bg-red-500" };
    if (risk >= 50) return { text: "text-amber-600", bg: "bg-amber-500", bar: "bg-amber-500" };
    return { text: "text-blue-600", bg: "bg-blue-500", bar: "bg-blue-500" };
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <BrainCircuit className="size-7 text-primary" /> Churn Prediction
        </h1>
        <p className="text-sm text-muted-foreground">Antigravity AI predicts customers likely to stop purchasing, with confidence scores and actionable insights.</p>
      </div>

      {/* AI Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 p-6 bg-gradient-to-r from-primary/10 via-background to-primary/5">
        <div className="absolute -right-12 -top-12 size-48 rounded-full blur-3xl bg-primary/20" />
        <div className="absolute -left-8 -bottom-8 size-36 rounded-full blur-3xl bg-purple-500/10" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="size-16 rounded-2xl gradient-brand flex items-center justify-center shadow-elegant shrink-0">
            <BrainCircuit className="size-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground mb-1">Antigravity AI Churn Model</h2>
            <p className="text-sm text-muted-foreground">Trained on 80,000+ purchase events. The model analyzes recency, frequency, support interactions, NPS scores, and competitor signals to predict churn with <span className="font-semibold text-primary">94.2% accuracy</span>.</p>
          </div>
          <div className="flex gap-6 shrink-0">
            {[
              { label: "High Risk", value: "12", color: "text-red-500" },
              { label: "At Risk", value: "45", color: "text-amber-500" },
              { label: "Watch", value: "128", color: "text-blue-500" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
          {["All", "Inactive", "At Risk", "Watch"].map(tier => (
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

      <div className="space-y-4">
        {filtered.map((c, i) => {
          const colors = getRiskColor(c.risk);
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-panel p-5 rounded-xl border border-border/50 hover:border-red-500/20 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="size-11 rounded-xl bg-accent flex items-center justify-center shrink-0 text-lg font-bold text-muted-foreground">
                    {c.customer.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{c.customer}</p>
                    <p className="text-xs text-muted-foreground">{c.id} · Last purchase: {c.lastPurchase}</p>
                  </div>
                </div>

                {/* Risk score */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center w-20">
                    <div className={`text-2xl font-bold ${colors.text}`}>{c.risk}%</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Churn Risk</div>
                  </div>
                  <div className="w-32 h-2 bg-accent rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.risk}%` }}
                      transition={{ delay: i * 0.08 + 0.2, duration: 0.6 }}
                      className={`h-full ${colors.bar} rounded-full`}
                    />
                  </div>
                  <span className={cn("px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap",
                    c.tier === "Inactive" ? "bg-red-500/10 text-red-600" :
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
        })}
      </div>
    </div>
  );
}
