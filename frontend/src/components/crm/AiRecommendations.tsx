import React from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Sparkles, ArrowUpRight, AlertTriangle, TrendingUp, Gift, Crown, ShoppingBag, RefreshCw, Star } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";
import { cn } from "@/lib/utils";

const allRecommendations = [
  { id: "AIR-1", type: "churn_risk", customer: "David Chen", customerSeg: "Inactive", title: "High Churn Risk Detected", description: "Customer has been inactive for 45 days. Recommend sending a personalised 15% win-back coupon via WhatsApp.", confidence: 89, action: "Send Campaign", priority: "Urgent", icon: AlertTriangle, iconColor: "text-red-500", iconBg: "bg-red-500/10" },
  { id: "AIR-2", type: "upsell", customer: "Acme Corp", customerSeg: "Premium", title: "Upsell to Diamond Membership", description: "Customer consistently exceeds Gold tier limits. Upgrading to Diamond will increase CLV by an estimated $45,000.", confidence: 94, action: "Propose Upgrade", priority: "High", icon: Crown, iconColor: "text-amber-500", iconBg: "bg-amber-500/10" },
  { id: "AIR-3", type: "next_purchase", customer: "Sarah Jenkins", customerSeg: "Frequent Buyer", title: "Predictive Purchase Opportunity", description: "Based on purchase cycle analysis (every 18 days), Sarah is likely to purchase Office Supplies in the next 3–5 days.", confidence: 78, action: "Suggest Product", priority: "Medium", icon: ShoppingBag, iconColor: "text-blue-500", iconBg: "bg-blue-500/10" },
  { id: "AIR-4", type: "credit_limit", customer: "Global Trade LLC", customerSeg: "High Value", title: "Credit Limit Increase Recommended", description: "9 consecutive on-time payments. Increasing credit limit by $50,000 will likely increase order size by 30%.", confidence: 99, action: "Review Limit", priority: "High", icon: TrendingUp, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
  { id: "AIR-5", type: "loyalty", customer: "TechNova Solutions", customerSeg: "New Customer", title: "Loyalty Program Enrollment", description: "Customer has made 5 purchases but is not enrolled in the Loyalty Program. Enrollment could boost retention by 40%.", confidence: 85, action: "Enroll in Loyalty", priority: "Medium", icon: Gift, iconColor: "text-purple-500", iconBg: "bg-purple-500/10" },
  { id: "AIR-6", type: "win_back", customer: "Davis Retail", customerSeg: "Inactive", title: "Win-Back Campaign Needed", description: "Customer was a top buyer 6 months ago. Re-engagement campaign with a 20% offer could recover $24,000 in lost revenue.", confidence: 72, action: "Launch Win-Back", priority: "Urgent", icon: RefreshCw, iconColor: "text-orange-500", iconBg: "bg-orange-500/10" },
];

const priorityOrder: Record<string, number> = { Urgent: 0, High: 1, Medium: 2 };
const sorted = [...allRecommendations].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

export function AiRecommendations({ tab = "recommendations" }: { tab?: string }) {
  const { mockAiRecommendations } = useCrmData();
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <BrainCircuit className="size-7 text-primary" /> AI Recommendations
          </h1>
          <p className="text-sm text-muted-foreground">Antigravity AI generates real-time, actionable recommendations for every customer interaction.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity shrink-0">
          <RefreshCw className="size-4" /> Refresh AI Insights
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
              The model analysed <span className="font-semibold text-foreground">20,452 customer profiles</span>,{" "}
              <span className="font-semibold text-foreground">80,120 transactions</span>, and{" "}
              <span className="font-semibold text-foreground">1,240 support interactions</span> to generate these recommendations.
            </p>
          </div>
          <div className="flex gap-6 shrink-0">
            {[
              { label: "Recommendations", value: "248" },
              { label: "Avg Confidence", value: "86%" },
              { label: "Acted On", value: "142" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendation cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {sorted.map((rec, i) => (
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
                  <div className={cn("p-2.5 rounded-xl shrink-0", rec.iconBg)}>
                    <rec.icon className={cn("size-5", rec.iconColor)} />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base leading-tight">{rec.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground">{rec.customer}</span> · {rec.customerSeg}
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
                <button className="px-4 py-2 bg-background border border-border hover:bg-accent rounded-lg text-sm font-medium transition-colors">
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
