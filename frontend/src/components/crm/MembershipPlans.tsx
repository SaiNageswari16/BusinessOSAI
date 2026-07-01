import React from "react";
import { motion } from "framer-motion";
import { Plus, Check, Users, Shield, Star, Crown, Gem, Settings } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";

interface Props {
  tab?: string;
}

export function MembershipPlans({ tab = "active_plans" }: Props) {
  const { mockMembershipPlans } = useCrmData();

  const getIconForPlan = (name: string) => {
    switch(name) {
      case "Basic": return Shield;
      case "Silver": return Star;
      case "Gold": return Crown;
      case "Platinum": return Gem;
      case "Diamond": return Gem;
      default: return Shield;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Membership Plans</h1>
          <p className="text-sm text-muted-foreground">Manage subscription tiers and benefits for customers.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {mockMembershipPlans.map((plan, i) => {
          const Icon = getIconForPlan(plan.name);
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={plan.id}
              className="glass-panel rounded-xl border border-border/50 overflow-hidden relative group hover:shadow-elegant transition-all duration-300 flex flex-col h-full"
            >
              <div className={`h-2 w-full ${plan.color}`} />
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2.5 rounded-lg bg-background border border-border shadow-sm`}>
                    <Icon className={`size-5 ${plan.color.replace('bg-', 'text-').replace('500', '600').replace('400', '500')}`} />
                  </div>
                  <button className="p-1.5 text-muted-foreground hover:bg-accent rounded-md transition-colors opacity-0 group-hover:opacity-100">
                    <Settings className="size-4" />
                  </button>
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-2xl font-black">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">/year</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/50 p-2 rounded-lg mb-6">
                  <Users className="size-4" />
                  <span className="font-semibold text-foreground">{plan.users.toLocaleString()}</span> members
                </div>

                <div className="space-y-3 mb-6 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Benefits</p>
                  {plan.benefits.map((benefit, j) => (
                    <div key={j} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <button className="w-full py-2 bg-background border border-border hover:bg-accent transition-colors rounded-lg text-sm font-medium mt-auto">
                  Manage Tier
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
