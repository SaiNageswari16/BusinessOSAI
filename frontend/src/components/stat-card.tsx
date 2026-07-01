import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  hint?: string;
  icon?: ReactNode;
  delay?: number;
}

export function StatCard({ label, value, change, hint, icon, delay = 0 }: StatCardProps) {
  const up = (change ?? 0) >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }}>
      <Card className="relative overflow-hidden p-5 hover:shadow-elegant transition-shadow border-border/60">
        <div className="absolute -top-12 -right-12 size-32 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground tracking-wide">{label}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
          </div>
          {icon && (
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">{icon}</div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          {change !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold",
              up ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10")}>
              {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(change)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      </Card>
    </motion.div>
  );
}
