import React from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, FileText, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface MockScreenProps {
  title: string;
  description?: string;
  type?: "crm" | "accounting" | "analytics" | "settings";
}

export function MockScreen({ title, description, type = "crm" }: MockScreenProps) {
  const cards = [
    { title: "Key Metrics", value: "24,592", change: "+12.5%", icon: Activity },
    { title: "Active Projects", value: "12", change: "On Track", icon: LayoutDashboard },
    { title: "Pending Reviews", value: "4", change: "-2 from yesterday", icon: FileText },
    { title: "System Status", value: "Optimal", change: "99.9% Uptime", icon: Settings },
  ];

  const colors = {
    crm: "from-rose-500/20 to-rose-500/5 text-rose-600",
    accounting: "from-violet-500/20 to-violet-500/5 text-violet-600",
    analytics: "from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-600",
    settings: "from-slate-500/20 to-slate-500/5 text-slate-600",
  };

  const bgClass = colors[type];

  return (
    <div className="p-6 md:p-8 space-y-8 w-full max-w-screen-2xl mx-auto h-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("p-8 rounded-2xl border border-border/50 bg-gradient-to-br", bgClass)}
      >
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-lg opacity-80 max-w-2xl">
          {description || "This module is currently in wireframe mode. We are gathering requirements to build out the full functionality."}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx }}
            className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300 group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-lg bg-background", bgClass)}>
                <card.icon className="size-5" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
            <p className="text-3xl font-bold mt-1 text-foreground group-hover:text-primary transition-colors">
              {card.value}
            </p>
            <p className="text-xs text-muted-foreground mt-2 font-medium">
              {card.change}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-panel p-8 rounded-xl border border-border/50 min-h-[400px] flex flex-col items-center justify-center text-center space-y-4"
      >
        <div className={cn("p-6 rounded-full bg-background mb-4", bgClass)}>
          <LayoutDashboard className="size-10" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Interactive Mockup Environment</h3>
        <p className="text-muted-foreground max-w-md">
          This area will contain detailed data tables, interactive charts, and action panels specific to the {title} module.
        </p>
      </motion.div>
    </div>
  );
}
