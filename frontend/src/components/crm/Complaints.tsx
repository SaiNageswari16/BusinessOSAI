import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, AlertTriangle, MessageSquare, Plus, Clock, User, CheckCircle2 } from "lucide-react";

export function Complaints() {
  const [searchTerm, setSearchTerm] = useState("");

  const complaints = [
    { id: "CMP-001", customer: "Acme Corp", subject: "Delayed Delivery", severity: "High", status: "Investigating", date: "2026-07-01", owner: "James T." },
    { id: "CMP-002", customer: "Global Trade LLC", subject: "Defective Products in Batch", severity: "Critical", status: "Open", date: "2026-07-01", owner: "Sarah M." },
    { id: "CMP-003", customer: "David Chen", subject: "Rude Staff Behavior", severity: "Medium", status: "Resolved", date: "2026-06-29", owner: "Mike R." },
    { id: "CMP-004", customer: "TechNova Solutions", subject: "Billing Discrepancy", severity: "High", status: "Investigating", date: "2026-06-28", owner: "James T." },
    { id: "CMP-005", customer: "Sarah Jenkins", subject: "Product not as described", severity: "Low", status: "Closed", date: "2026-06-25", owner: "Sarah M." },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Complaints</h1>
          <p className="text-sm text-muted-foreground">Track and manage customer grievances and escalations.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Log Complaint
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-red-500/30 bg-red-500/5 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 size-32 rounded-full blur-3xl bg-red-500/20" />
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Critical & High Priority</p>
          <h3 className="text-4xl font-bold text-foreground">12</h3>
          <p className="text-xs font-medium mt-2 text-red-500 flex items-center gap-1">
            <AlertTriangle className="size-3" /> Requires immediate action
          </p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <p className="text-sm font-medium text-muted-foreground mb-1">Active Investigations</p>
          <h3 className="text-4xl font-bold text-foreground">45</h3>
          <p className="text-xs font-medium mt-2 text-muted-foreground">Avg. age: 3 days</p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 relative overflow-hidden group">
          <p className="text-sm font-medium text-muted-foreground mb-1">Resolution Rate (30d)</p>
          <h3 className="text-4xl font-bold text-foreground">92%</h3>
          <p className="text-xs font-medium mt-2 text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="size-3" /> +4% vs last month
          </p>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search complaints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Filter className="size-4" /> Filter
          </button>
        </div>
        
        <div className="divide-y divide-border/50">
          {complaints.map((comp, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={comp.id}
              className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center cursor-pointer group"
            >
              <div className="flex gap-4 items-start">
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  comp.severity === 'Critical' ? 'bg-red-500/10 text-red-600' :
                  comp.severity === 'High' ? 'bg-orange-500/10 text-orange-600' :
                  comp.severity === 'Medium' ? 'bg-blue-500/10 text-blue-600' :
                  'bg-slate-500/10 text-slate-600'
                }`}>
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground text-base">{comp.subject}</h4>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{comp.id}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><User className="size-3.5" /> {comp.customer}</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {comp.date}</span>
                    <span className="flex items-center gap-1.5"><MessageSquare className="size-3.5" /> {comp.owner}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
                  comp.status === 'Open' ? 'bg-blue-500/10 text-blue-600' :
                  comp.status === 'Investigating' ? 'bg-amber-500/10 text-amber-600' :
                  comp.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-600' :
                  'bg-slate-500/10 text-slate-600'
                }`}>
                  {comp.status}
                </span>
                <button className="px-3 py-1.5 bg-background border border-border hover:bg-accent rounded-lg text-sm font-medium transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  View Case
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
