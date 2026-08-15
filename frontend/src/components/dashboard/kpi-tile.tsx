import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useCurrency } from "@/hooks/use-currency";

type Tone = "blue" | "purple" | "cyan" | "green" | "amber";

const TONES: Record<Tone, { icon: string; chart: string }> = {
  blue:   { icon: "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]",     chart: "var(--brand-blue)"   },
  purple: { icon: "bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]", chart: "var(--brand-purple)" },
  cyan:   { icon: "bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)]",     chart: "var(--brand-cyan)"   },
  green:  { icon: "bg-emerald-500/10 text-emerald-600",                     chart: "var(--brand-green)"  },
  amber:  { icon: "bg-amber-500/10 text-amber-600",                         chart: "oklch(0.75 0.17 70)" },
};

interface KpiTileProps {
  label: string;
  value: string | number;
  change: number;
  hint?: string;
  icon?: ReactNode;
  spark?: { i: number; v: number }[];
  tone?: Tone;
  delay?: number;
  isCurrency?: boolean;
}

export function KpiTile({ label, value, change, hint, icon, spark, tone = "blue", delay = 0, isCurrency = false }: KpiTileProps) {
  const { formatCurrency, currency, exchangeRates } = useCurrency();
  
  let displayValue = value;
  if (isCurrency && typeof value === 'number') {
    const rate = exchangeRates[currency.code] || 1;
    const amount = value * rate;
    
    // Custom formatting for large numbers to keep it compact (e.g. 2.13M instead of 2,130,000)
    if (amount >= 1_000_000) {
      displayValue = `${currency.symbol}${(amount / 1_000_000).toFixed(2)}M`;
    } else if (amount >= 100_000 && amount % 1000 === 0) {
      displayValue = `${currency.symbol}${(amount / 1_000).toFixed(0)}K`;
    } else {
      displayValue = formatCurrency(value);
    }
  } else if (typeof value === 'number') {
    displayValue = new Intl.NumberFormat().format(value);
  }

  const up = change >= 0;
  const t = TONES[tone];
  const id = `g-${label.replace(/\W/g, "")}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -2 }}
    >
      <Card className="group relative overflow-hidden p-4 border-border/60 hover:shadow-elegant transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</div>
            <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{displayValue}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold",
                up ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10")}>
                {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {Math.abs(change)}%
              </span>
              {hint && <span className="text-muted-foreground truncate">{hint}</span>}
            </div>
          </div>
          {icon && <div className={cn("size-9 rounded-lg grid place-items-center shrink-0", t.icon)}>{icon}</div>}
        </div>
        {spark && (
          <div className="-mx-4 -mb-4 mt-3 h-12 opacity-80 group-hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.chart} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={t.chart} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={t.chart} strokeWidth={1.8} fill={`url(#${id})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
