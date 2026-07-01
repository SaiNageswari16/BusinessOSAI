import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Mail, Phone, Calendar, MoreHorizontal, AlertCircle, ArrowRight } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";

interface Props {
  tab?: string;
}

export function Leads({ tab = "all_leads" }: Props) {
  const { mockLeads } = useCrmData();
  const [searchTerm, setSearchTerm] = useState("");
  const stages = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

  const getLeadsByStage = (stage: string) => {
    return mockLeads.filter(l => l.status === stage && 
      (l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       l.company.toLowerCase().includes(searchTerm.toLowerCase())));
  };

  return (
    <div className="p-6 h-[calc(100vh-6rem)] flex flex-col space-y-6">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">Manage and track potential customers through the qualification process.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Filter className="size-4" /> Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Lead
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
        {stages.map((stage) => {
          const stageLeads = getLeadsByStage(stage);
          return (
            <div key={stage} className="flex-shrink-0 w-80 flex flex-col bg-muted/20 rounded-xl border border-border/50 h-full">
              <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/50 rounded-t-xl">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <span className={`size-2 rounded-full ${
                    stage === 'New' ? 'bg-blue-500' :
                    stage === 'Contacted' ? 'bg-amber-500' :
                    stage === 'Qualified' ? 'bg-indigo-500' :
                    stage === 'Proposal' ? 'bg-purple-500' :
                    stage === 'Won' ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  {stage}
                </h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-background rounded-md border border-border text-muted-foreground">
                  {stageLeads.length}
                </span>
              </div>
              
              <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin">
                {stageLeads.map((lead) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={lead.id}
                    className="bg-background p-4 rounded-lg border border-border shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-foreground text-sm">{lead.name}</h4>
                      <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </div>
                    <p className="text-xs font-medium text-primary mb-3">{lead.company}</p>
                    
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="size-3" /> {lead.email}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="size-3" /> {lead.phone}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-border/50">
                      <span className="text-xs font-semibold text-emerald-600">${lead.estimatedValue.toLocaleString()}</span>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                        <Calendar className="size-3" /> {new Date(lead.lastContact).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {stageLeads.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground">
                    <AlertCircle className="size-5 mb-1 opacity-20" />
                    <p className="text-xs font-medium">No leads in this stage</p>
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-background/50 border-t border-border/50 rounded-b-xl">
                <button className="w-full py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors flex items-center justify-center gap-1">
                  <Plus className="size-3" /> Quick Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
