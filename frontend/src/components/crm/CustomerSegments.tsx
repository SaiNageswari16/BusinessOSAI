import React from "react";
import { motion } from "framer-motion";
import { Target, Plus, TrendingUp, Sparkles, AlertTriangle, Zap, RotateCw, ShieldCheck, ShoppingCart } from "lucide-react";

import { useCrmData } from "@/hooks/useCrmData";

const iconMap: Record<string, any> = {
  Sparkles, Zap, AlertTriangle, RotateCw, TrendingUp, ShieldCheck, Target, ShoppingCart
};

export function CustomerSegments({ tab = "segmentation" }: { tab?: string }) {
  const { mockCustomerSegments } = useCrmData();
  const segments = mockCustomerSegments;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Segments</h1>
          <p className="text-sm text-muted-foreground">Dynamic behavioral and transactional customer segments.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Create Segment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {segments.map((segment, i) => {
          const Icon = iconMap[segment.icon] || Target;
          return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            key={segment.id}
            className="glass-panel p-5 rounded-xl border border-border/50 hover:border-primary/30 transition-all duration-300 group cursor-pointer relative overflow-hidden"
          >
            <div className={`absolute -right-6 -top-6 size-24 rounded-full blur-2xl opacity-20 ${segment.bg} group-hover:opacity-40 transition-opacity`} />
            
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className={`p-2.5 rounded-lg ${segment.bg}`}>
                <Icon className={`size-5 ${segment.color}`} />
              </div>
              <h3 className="font-semibold text-foreground">{segment.name}</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Population</p>
                <p className="font-bold text-lg">{segment.count.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">LTV / Revenue</p>
                <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{segment.revenue}</p>
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>
    </div>
  );
}
