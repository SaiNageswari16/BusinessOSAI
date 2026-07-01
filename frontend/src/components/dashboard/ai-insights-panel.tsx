import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, Sparkles, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { aiInsights } from "@/data/mock";

const SEV = {
  critical: { ring: "ring-rose-500/20 border-rose-500/30 bg-rose-500/[0.04]", chip: "bg-rose-500/10 text-rose-600", icon: AlertTriangle, label: "Critical" },
  warn:     { ring: "ring-amber-500/20 border-amber-500/30 bg-amber-500/[0.04]", chip: "bg-amber-500/10 text-amber-600", icon: AlertTriangle, label: "Attention" },
  info:     { ring: "ring-blue-500/20 border-blue-500/20 bg-blue-500/[0.03]", chip: "bg-blue-500/10 text-blue-600", icon: Sparkles, label: "Info" },
  positive: { ring: "ring-emerald-500/20 border-emerald-500/30 bg-emerald-500/[0.04]", chip: "bg-emerald-500/10 text-emerald-600", icon: TrendingUp, label: "Opportunity" },
} as const;

export function AiInsightsPanel() {
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const visible = aiInsights.filter((i) => !dismissed.includes(i.id));

  return (
    <Card className="p-5 border-border/60 bg-gradient-to-br from-primary/[0.04] via-transparent to-[var(--brand-purple)]/[0.04]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg gradient-brand grid place-items-center text-white shadow-elegant">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Insights & Recommendations</div>
            <div className="text-xs text-muted-foreground">{visible.length} active · refreshed 2m ago</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-xs">View all</Button>
      </div>

      <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 -mr-1">
        {visible.map((ins, idx) => {
          const sev = SEV[ins.severity];
          const Icon = sev.icon;
          const completed = done.includes(ins.id);
          return (
            <motion.div
              key={ins.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
              className={cn(
                "relative rounded-xl border ring-1 p-3.5 transition-all hover:shadow-elegant",
                sev.ring,
                completed && "opacity-50",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("size-8 rounded-lg grid place-items-center shrink-0", sev.chip)}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", sev.chip)}>
                      {sev.label}
                    </span>
                    <span className="text-[10px] font-semibold text-primary">{ins.confidence}% confidence</span>
                  </div>
                  <div className={cn("mt-1 text-sm font-medium leading-snug", completed && "line-through")}>
                    {ins.title}
                  </div>
                  <div className="mt-0.5 text-xs text-emerald-600 font-medium">{ins.impact}</div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button size="sm" variant="default" className="h-7 px-2.5 text-xs gap-1">
                      {ins.action} <ArrowRight className="size-3" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1"
                      onClick={() => setDone((d) => [...d, ins.id])}
                    >
                      <Check className="size-3" /> Done
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                      onClick={() => setDismissed((d) => [...d, ins.id])}
                    >
                      <X className="size-3" /> Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
