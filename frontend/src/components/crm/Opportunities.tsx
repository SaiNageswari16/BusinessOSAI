import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, Rocket, Calendar, Building, DollarSign, ExternalLink } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";

export function Opportunities() {
  const { mockDeals } = useCrmData();
  const [searchTerm, setSearchTerm] = useState("");

  const opportunities = mockDeals.filter(d => d.stage !== "Closed Won" && d.stage !== "Closed Lost");

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Opportunities</h1>
          <p className="text-sm text-muted-foreground">List view of all active sales opportunities and potential revenue.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Opportunity
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search opportunities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
          <Filter className="size-4" /> Filter
        </button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
              <tr>
                <th className="px-6 py-4">Opportunity Name</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Stage</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Probability</th>
                <th className="px-6 py-4">Expected Close</th>
                <th className="px-6 py-4">Owner</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {opportunities.map((opp, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={opp.id} 
                  className="hover:bg-muted/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <Rocket className="size-4 text-primary" /> {opp.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{opp.id}</p>
                  </td>
                  <td className="px-6 py-4 font-medium flex items-center gap-2 mt-2">
                    <Building className="size-4 text-muted-foreground" /> {opp.customer}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-accent border border-border text-foreground">
                      {opp.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-600 text-right">
                    ${opp.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden w-16">
                        <div className="h-full bg-primary" style={{ width: `${opp.probability}%` }} />
                      </div>
                      <span className="text-xs font-medium">{opp.probability}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground flex items-center gap-2 mt-2">
                    <Calendar className="size-4" /> {new Date(opp.closingDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-medium">{opp.owner}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary hover:underline text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto">
                      View Details <ExternalLink className="size-3" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
