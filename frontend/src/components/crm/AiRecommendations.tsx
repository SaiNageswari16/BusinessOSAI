import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BrainCircuit, Sparkles, ArrowUpRight, AlertTriangle, TrendingUp,
  Gift, Crown, ShoppingBag, RefreshCw, Star, Shield, AlertCircle
} from "lucide-react";
import { crmIntelligenceApi, IntelRecommendations, IntelRecommendation } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

const ICON_MAP: Record<string, React.ElementType> = {
  alert: AlertTriangle,
  crown: Crown,
  trending: TrendingUp,
  gift: Gift,
  bag: ShoppingBag,
  shield: Shield,
};

const ICON_COLOR_MAP: Record<string, { iconColor: string; iconBg: string }> = {
  churn_risk: { iconColor: "text-red-500", iconBg: "bg-red-500/10" },
  upsell: { iconColor: "text-amber-500", iconBg: "bg-amber-500/10" },
  conversion: { iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
  support: { iconColor: "text-blue-500", iconBg: "bg-blue-500/10" },
  loyalty: { iconColor: "text-purple-500", iconBg: "bg-purple-500/10" },
  win_back: { iconColor: "text-orange-500", iconBg: "bg-orange-500/10" },
};

export function AiRecommendations({ tab = "recommendations" }: { tab?: string }) {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<IntelRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmIntelligenceApi.getRecommendations();
      setData(res);
      setDismissed(new Set()); // reset dismissals on refresh
    } catch (e: any) {
      setError(e?.message || "Failed to load AI recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-accent rounded-lg" />
        <div className="h-36 bg-accent rounded-xl" />
        <div className="grid grid-cols-2 gap-5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 bg-accent rounded-xl" />)}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-muted-foreground">{error || "No recommendations available"}</p>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm">
          <RefreshCw className="size-4" /> Retry
        </button>
      </div>
    );
  }

  const visible = data.recommendations.filter(r => !dismissed.has(r.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">AI Recommendations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Antigravity AI generates real-time, actionable recommendations from your live customer data.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity shrink-0">
          <RefreshCw className="size-3.5" /> Refresh AI Insights
        </button>
      </div>

      {/* AI Banner */}
      <div className="relative overflow-hidden rounded-xl p-6 border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-purple-500/10">
        <div className="absolute -right-16 -top-16 size-56 rounded-full blur-3xl bg-primary/15" />
        <div className="absolute -left-8 -bottom-8 size-40 rounded-full blur-3xl bg-purple-500/10" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="size-16 rounded-2xl gradient-brand flex items-center justify-center shadow-elegant shrink-0">
            <Sparkles className="size-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground mb-1">Antigravity AI — Customer Intelligence Engine</h2>
            <p className="text-sm text-muted-foreground">
              Analysed <span className="font-semibold text-foreground">{data.summary.customers_analysed.toLocaleString()} customer profiles</span>,{" "}
              <span className="font-semibold text-foreground">{data.summary.transactions_analysed.toLocaleString()} transactions</span>, and{" "}
              <span className="font-semibold text-foreground">{data.summary.support_interactions.toLocaleString()} support interactions</span> to generate these recommendations.
            </p>
          </div>
          <div className="flex gap-6 shrink-0">
            {[
              { label: "Recommendations", value: data.summary.total_recommendations },
              { label: "Avg Confidence", value: `${data.summary.avg_confidence}%` },
              { label: "Actionable", value: visible.length },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendation Cards */}
      {visible.length === 0 ? (
        <div className="glass-panel p-10 rounded-xl border border-border/50 text-center">
          <BrainCircuit className="size-10 mx-auto text-muted-foreground opacity-30 mb-3" />
          <p className="font-medium text-foreground mb-1">No active recommendations</p>
          <p className="text-sm text-muted-foreground">
            {data.summary.customers_analysed === 0
              ? "Add customers and sales orders to get AI recommendations."
              : "All your customers appear healthy! Check back after more interactions."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visible.map((rec, i) => {
            const IconComp = ICON_MAP[rec.icon_type] || AlertTriangle;
            const colors = ICON_COLOR_MAP[rec.type] || ICON_COLOR_MAP.support;
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={cn(
                  "glass-panel rounded-xl border overflow-hidden hover:shadow-elegant transition-all duration-300 group cursor-pointer",
                  rec.priority === "Urgent" ? "border-red-500/30 hover:border-red-500/50" :
                  rec.priority === "High" ? "border-amber-500/30 hover:border-amber-500/50" :
                  "border-border/50 hover:border-primary/30"
                )}
              >
                {/* Priority stripe */}
                <div className={cn("h-1 w-full",
                  rec.priority === "Urgent" ? "bg-red-500" :
                  rec.priority === "High" ? "bg-amber-500" :
                  "bg-blue-500"
                )} />

                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-xl shrink-0", colors.iconBg)}>
                        <IconComp className={cn("size-5", colors.iconColor)} />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-base leading-tight">{rec.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium text-foreground">{rec.customer}</span> · {rec.customer_seg}
                        </p>
                      </div>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ml-3",
                      rec.priority === "Urgent" ? "bg-red-500/10 text-red-600" :
                      rec.priority === "High" ? "bg-amber-500/10 text-amber-600" :
                      "bg-blue-500/10 text-blue-600"
                    )}>
                      {rec.priority}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{rec.description}</p>

                  {/* Confidence score */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Star className="size-3 text-amber-400" fill="currentColor" /> AI Confidence
                      </span>
                      <span className="font-bold text-foreground">{rec.confidence}%</span>
                    </div>
                    <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${rec.confidence}%` }}
                        transition={{ delay: i * 0.07 + 0.3, duration: 0.6, ease: "easeOut" }}
                        className={cn("h-full rounded-full",
                          rec.confidence >= 90 ? "bg-emerald-500" :
                          rec.confidence >= 70 ? "bg-blue-500" : "bg-amber-500"
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                    <button className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-md flex items-center justify-center gap-2",
                      rec.priority === "Urgent" ? "bg-red-500 text-white hover:bg-red-600" :
                      rec.priority === "High" ? "bg-amber-500 text-white hover:bg-amber-600" :
                      "gradient-brand text-white hover:opacity-90"
                    )}>
                      {rec.action} <ArrowUpRight className="size-4" />
                    </button>
                    <button
                      onClick={() => setDismissed(d => new Set([...d, rec.id]))}
                      className="px-4 py-2 bg-background border border-border hover:bg-accent rounded-lg text-sm font-medium transition-colors"
                    >
                      Dismiss
                    </button>
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
