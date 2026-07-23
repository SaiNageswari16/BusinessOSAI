import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, MoreHorizontal, Target, Calendar, User } from "lucide-react";

import { crmOpportunitiesApi, type CrmOpportunity } from "@/lib/api-client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/tenant-context";

interface Props {
  tab?: string;
}

export function Deals({ tab = "all_deals" }: Props) {
  const { tenant } = useTenant();

  const [searchTerm, setSearchTerm] = useState("");
  const [deals, setDeals] = useState<CrmOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const stages = ["Prospecting", "Qualification", "Needs Analysis", "Value Proposition", "Negotiation", "Closed Won", "Closed Lost"];

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const res = await crmOpportunitiesApi.list();
      setDeals(res || []);
    } catch (err) {
      console.error("Failed to fetch deals:", err);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void fetchDeals();
  }, [tenant.id]);

  const moveDeal = async (id: string, stage: string) => {
    try {
      await crmOpportunitiesApi.update(id, { stage });
      setDeals(prev => prev.map(d => d.id === id ? { ...d, stage } : d));
      toast.success(`Deal stage updated to ${stage}`);
    } catch {
      toast.error("Failed to update deal stage");
    }
  };

  const getDealsByStage = (stage: string) => {
    return deals.filter(d => d.stage === stage && 
      (d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       ((d as any).customer_name || "").toLowerCase().includes(searchTerm.toLowerCase())));
  };

  return (
    <div className="p-6 h-[calc(100vh-6rem)] flex flex-col space-y-6">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals Pipeline</h1>
          <p className="text-sm text-muted-foreground">Interactive status board to manage active opportunities.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Filter className="size-4" /> Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Deal
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading pipeline...</div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {stages.map((stage) => {
            const stageDeals = getDealsByStage(stage);
            const totalValue = stageDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);

            return (
              <div key={stage} className="flex-shrink-0 w-72 flex flex-col h-full border-r border-border/50 pr-4 last:border-0">
                <div className="mb-4">
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-1">{stage}</h3>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{stageDeals.length} Deals</span>
                    <span className="font-bold text-primary">₹{totalValue.toLocaleString()}</span>
                  </div>
                  <div className="h-1 w-full bg-accent mt-2 rounded-full overflow-hidden">
                    <div className={`h-full ${
                      stage === 'Closed Won' ? 'bg-emerald-500' :
                      stage === 'Closed Lost' ? 'bg-red-500' :
                      'bg-primary'
                    }`} style={{ width: `${deals.length > 0 ? (stageDeals.length / deals.length) * 100 : 0}%` }} />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                  {stageDeals.map((deal) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={deal.id}
                      className="bg-card p-4 rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-all border-l-4"
                      style={{ borderLeftColor: `hsl(var(--primary))` }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-foreground text-sm leading-tight pr-4">{deal.name}</h4>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Target className="size-3" /> {(deal as any).customer_name || "Robert Johnson (Lead)"}
                      </p>
                      
                      <div className="flex justify-between items-center gap-2 mb-3">
                        <div className="text-xs font-bold text-emerald-600">
                          ₹{Number(deal.amount || 0).toLocaleString()}
                        </div>
                        <select
                          value={deal.stage}
                          onChange={(e) => void moveDeal(deal.id, e.target.value)}
                          className="bg-transparent text-[10px] border-none focus:outline-none font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                        >
                          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" /> 
                          {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "—"}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="size-3" /> {(deal as any).owner_name?.split(' ')[0] || "Admin"}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
