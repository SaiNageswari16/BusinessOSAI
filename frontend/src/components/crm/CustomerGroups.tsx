import React from "react";
import { motion } from "framer-motion";
import { Users, Plus, Network, Building2, Store, Crown, Briefcase } from "lucide-react";

import { useCrmData } from "@/hooks/useCrmData";

const iconMap: Record<string, any> = {
  Store, Boxes, Building2, Crown, Network, Briefcase
};

export function CustomerGroups({ tab = "customer_groups" }: { tab?: string }) {
  const { mockCustomerGroups } = useCrmData();
  const groups = mockCustomerGroups;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Groups</h1>
          <p className="text-sm text-muted-foreground">Manage organizational groupings for your customers.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Create Group
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group, i) => {
          const Icon = iconMap[group.icon] || Store;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={group.id}
              className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300 group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${group.bg}`}>
                  <Icon className={`size-6 ${group.color}`} />
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-muted/50 rounded-md border border-border/50 text-muted-foreground">
                  {group.id}
                </span>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-1">{group.name}</h3>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-2">{group.description}</p>

              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="font-semibold">{group.count.toLocaleString()}</span>
                  <span className="text-muted-foreground">Customers</span>
                </div>
                <button className="text-primary text-sm font-medium hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Just a quick icon fix since Boxes isn't imported
function Boxes(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
}
