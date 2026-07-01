import React from "react";
import { motion } from "framer-motion";
import { Filter, Download, PieChart, TrendingUp, DollarSign, Target, Percent } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";

interface Props {
  tab?: string;
}

export function SalesPipeline({ tab = "kanban" }: Props) {
  const { mockDeals } = useCrmData();
  const stages = [
    { name: "Prospecting", conversion: 100 },
    { name: "Qualification", conversion: 85 },
    { name: "Needs Analysis", conversion: 60 },
    { name: "Value Proposition", conversion: 45 },
    { name: "Negotiation", conversion: 30 },
    { name: "Closed Won", conversion: 15 },
  ];

  const maxConversion = 100;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">Analyze conversion rates and revenue forecast across stages.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Download className="size-4" /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-primary/20 group-hover:bg-primary/30 transition-colors" />
          <div className="p-2.5 bg-primary/10 rounded-lg w-fit mb-4 text-primary">
            <DollarSign className="size-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Total Pipeline Value</p>
          <h3 className="text-3xl font-bold text-foreground">$4.2M</h3>
          <p className="text-xs font-medium mt-2 text-emerald-500">+12% vs last quarter</p>
        </div>
        
        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors" />
          <div className="p-2.5 bg-amber-500/10 rounded-lg w-fit mb-4 text-amber-600">
            <TrendingUp className="size-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Expected Revenue</p>
          <h3 className="text-3xl font-bold text-foreground">$1.8M</h3>
          <p className="text-xs font-medium mt-2 text-muted-foreground">Weighted by probability</p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors" />
          <div className="p-2.5 bg-emerald-500/10 rounded-lg w-fit mb-4 text-emerald-600">
            <Target className="size-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Win Rate</p>
          <h3 className="text-3xl font-bold text-foreground">32.4%</h3>
          <p className="text-xs font-medium mt-2 text-emerald-500">+2.1% improvement</p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors" />
          <div className="p-2.5 bg-blue-500/10 rounded-lg w-fit mb-4 text-blue-600">
            <Percent className="size-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">Sales Cycle</p>
          <h3 className="text-3xl font-bold text-foreground">42 Days</h3>
          <p className="text-xs font-medium mt-2 text-emerald-500">-5 days faster</p>
        </div>
      </div>

      <div className="glass-panel p-8 rounded-xl border border-border/50 flex flex-col items-center">
        <h2 className="text-xl font-bold text-foreground mb-8 self-start flex items-center gap-2">
          <PieChart className="size-5 text-primary" /> Conversion Funnel
        </h2>
        
        <div className="w-full max-w-4xl space-y-4 relative">
          {/* Connecting line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/50 -translate-x-1/2 z-0" />
          
          {stages.map((stage, i) => {
            const width = Math.max((stage.conversion / maxConversion) * 100, 15);
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={stage.name}
                className="relative z-10 flex flex-col items-center group"
              >
                <div 
                  className="h-16 flex items-center justify-between px-6 rounded-full shadow-md text-white overflow-hidden relative cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all"
                  style={{ 
                    width: `${width}%`,
                    background: `linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)`,
                    opacity: 1 - (i * 0.1) // slightly fade lower stages
                  }}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="font-semibold text-sm md:text-base whitespace-nowrap overflow-hidden text-ellipsis">{stage.name}</span>
                  <span className="font-bold text-sm md:text-lg">{stage.conversion}%</span>
                </div>
                
                {i < stages.length - 1 && (
                  <div className="h-6 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-5">
                    <span className="text-[10px] bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground z-20">
                      -{stages[i].conversion - stages[i+1].conversion}% dropoff
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
