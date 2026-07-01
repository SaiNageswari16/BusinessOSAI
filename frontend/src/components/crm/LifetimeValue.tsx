import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, ShoppingCart, Users, DollarSign, ArrowUpRight } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";

const lifetimeData = [
  { customer: "Global Trade LLC", ltv: 4500000, revenue: 4500000, profit: 1350000, visits: 89, orders: 320, years: 5, color: "from-cyan-500 to-blue-600" },
  { customer: "Acme Corp", ltv: 2800000, revenue: 2800000, profit: 840000, visits: 154, orders: 210, years: 4, color: "from-indigo-500 to-purple-600" },
  { customer: "Sarah Jenkins", ltv: 12400, revenue: 12400, profit: 3720, visits: 48, orders: 28, years: 2, color: "from-emerald-500 to-teal-600" },
  { customer: "David Chen", ltv: 28500, revenue: 28500, profit: 8550, visits: 22, orders: 12, years: 1, color: "from-amber-500 to-orange-600" },
];

export function LifetimeValue({ tab = "ltv" }: Props) {
  const { mockCustomers } = useCrmData();
  const maxLTV = lifetimeData[0].ltv;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Lifetime Value (CLV)</h1>
        <p className="text-sm text-muted-foreground">Understand total revenue, profit, and engagement metrics across the customer lifecycle.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Customer LTV", value: "$4,500", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Total Customer Value", value: "$91.5M", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Avg Customer Lifespan", value: "3.2 Years", icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Avg Orders per Customer", value: "24.8", icon: ShoppingCart, color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((stat, i) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {lifetimeData.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="glass-panel rounded-xl border border-border/50 overflow-hidden hover:shadow-elegant transition-all"
          >
            <div className={`h-1.5 w-full bg-gradient-to-r ${c.color}`} />
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{c.customer}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Customer for {c.years} year{c.years > 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">${(c.ltv / 1000000 >= 1 ? (c.ltv / 1000000).toFixed(1) + "M" : (c.ltv / 1000).toFixed(0) + "K")}</p>
                  <p className="text-xs text-muted-foreground">Lifetime Value</p>
                </div>
              </div>

              {/* LTV bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>LTV Progress</span>
                  <span>{Math.round((c.ltv / maxLTV) * 100)}% of top customer</span>
                </div>
                <div className="h-3 w-full bg-accent rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.ltv / maxLTV) * 100}%` }}
                    transition={{ delay: i * 0.1 + 0.3, duration: 0.7, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${c.color}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Profit Generated", value: `$${(c.profit / 1000 >= 1 ? (c.profit / 1000).toFixed(0) + "K" : c.profit)}` },
                  { label: "Total Orders", value: c.orders },
                  { label: "Store Visits", value: c.visits },
                ].map((metric, j) => (
                  <div key={j} className="p-3 bg-muted/30 rounded-lg border border-border/50 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{metric.label}</p>
                    <p className="font-bold text-foreground">{metric.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
