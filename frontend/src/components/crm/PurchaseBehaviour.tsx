import React from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Clock, Star, Tag, TrendingUp, Coffee } from "lucide-react";

const topCategories = [
  { name: "Electronics", pct: 42, revenue: "$5.2M" },
  { name: "Office Supplies", pct: 28, revenue: "$3.5M" },
  { name: "Software Licenses", pct: 18, revenue: "$2.2M" },
  { name: "Accessories", pct: 12, revenue: "$1.5M" },
];

const topBrands = [
  { name: "Apple", score: 91 },
  { name: "Dell", score: 78 },
  { name: "Microsoft", score: 74 },
  { name: "HP", score: 65 },
  { name: "Logitech", score: 55 },
];

const purchaseTimes = [
  { hour: "08–10 AM", orders: 420 },
  { hour: "10–12 PM", orders: 1240 },
  { hour: "12–2 PM", orders: 980 },
  { hour: "2–4 PM", orders: 1850 },
  { hour: "4–6 PM", orders: 2100 },
  { hour: "6–8 PM", orders: 1600 },
  { hour: "8–10 PM", orders: 820 },
];

const maxOrders = Math.max(...purchaseTimes.map(p => p.orders));

export function PurchaseBehaviour() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Purchase Behaviour</h1>
        <p className="text-sm text-muted-foreground">Understand buying frequency, preferred categories, brands, and purchase timing.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Purchase Frequency", value: "2.4x / mo", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Avg Order Value", value: "$248", icon: ShoppingCart, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Peak Purchase Hour", value: "4–6 PM", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Top Category", value: "Electronics", icon: Star, color: "text-purple-500", bg: "bg-purple-500/10" },
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
        {/* Favourite Categories */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Tag className="size-4 text-primary" /> Top Purchase Categories
          </h3>
          <div className="space-y-4">
            {topCategories.map((cat, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{cat.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{cat.pct}%</span>
                    <span className="font-semibold text-primary text-xs">{cat.revenue}</span>
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
        </div>

        {/* Preferred Brands */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Star className="size-4 text-primary" /> Preferred Brands
          </h3>
          <div className="space-y-3">
            {topBrands.map((brand, i) => (
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
                    <span className="font-medium">{brand.name}</span>
                    <span className="text-muted-foreground text-xs">{brand.score} pts</span>
                  </div>
                  <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${brand.score}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="h-full bg-amber-500/80 rounded-full"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Purchase Time Heatmap */}
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-primary" /> Peak Purchase Hours
          </h3>
          <div className="space-y-2">
            {purchaseTimes.map((pt, i) => (
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
                    {pt.orders.toLocaleString()} orders
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
