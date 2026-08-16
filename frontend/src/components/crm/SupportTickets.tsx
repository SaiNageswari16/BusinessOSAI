import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, AlertCircle, Clock, CheckCircle2, MoreHorizontal, MessageSquare, Sparkles, Loader2, X } from "lucide-react";

import { crmTicketsApi, type CrmTicket } from "@/lib/api-client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";

interface Props {
  tab?: string;
}

export function SupportTickets({ tab = "active_tickets" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await crmTicketsApi.list();
      setTickets(res || []);
    } catch (err) {
      console.error("Failed to fetch support tickets:", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void fetchTickets();
  }, [tenant.id]);

  const runAiSummary = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSummarizingId(id);
    try {
      const res = await crmTicketsApi.summarize(id);
      setTickets(prev =>
        prev.map(t => (t.id === id ? { ...t, ai_summary: res.ai_summary } : t))
      );
      toast.success("Executive case summary compiled!");
    } catch {
      toast.error("AI Summary generation failed");
    } finally {
      setSummarizingId(null);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "All" || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">Manage and resolve customer inquiries and technical issues.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> New Ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Open Tickets", value: "245", trend: "+12 since yesterday", color: "text-blue-500" },
          { label: "Urgent", value: "18", trend: "Needs immediate attention", color: "text-red-500" },
          { label: "Avg Resolution Time", value: "4.2 hrs", trend: "-1.5 hrs improvement", color: "text-emerald-500" },
          { label: "Customer Satisfaction", value: "94%", trend: "Based on recent tickets", color: "text-purple-500" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden group bg-card">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
            <p className={`text-xs font-medium mt-2 ${stat.color}`}>{stat.trend}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50 bg-card">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {["All", "Open", "In Progress", "Resolved"].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === status 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "bg-background border border-border hover:bg-accent text-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading support cases…</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Ticket</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredTickets.map((ticket, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    key={ticket.id} 
                    className="hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 max-w-sm">
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        <MessageSquare className="size-4 text-primary" /> {ticket.subject}
                      </p>
                      
                      {ticket.ai_summary ? (
                        <p className="text-xs mt-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 p-2 rounded-lg italic">
                          💡 AI Summary: {ticket.ai_summary}
                        </p>
                      ) : (
                        <button
                          onClick={(e) => void runAiSummary(e, ticket.id)}
                          disabled={summarizingId === ticket.id}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {summarizingId === ticket.id ? (
                            <><Loader2 className="size-3 animate-spin" /> Summarizing...</>
                          ) : (
                            <><Sparkles className="size-3 animate-pulse" /> Summarize Ticket</>
                          )}
                        </button>
                      )}
                      
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">{ticket.id}</p>
                    </td>
                    <td className="px-6 py-4 font-medium">{(ticket as any).customer_name || "Enterprise Customer"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        ticket.priority === 'High' ? 'bg-red-500/10 text-red-600' :
                        ticket.priority === 'Medium' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-slate-500/10 text-slate-600'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 w-fit ${
                        ticket.status === 'Open' ? 'bg-blue-500/10 text-blue-600' :
                        ticket.status === 'In Progress' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {ticket.status === 'Open' ? <AlertCircle className="size-3" /> :
                         ticket.status === 'Resolved' || ticket.status === 'Closed' ? <CheckCircle2 className="size-3" /> :
                         <Clock className="size-3" />}
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{(ticket as any).assigned_to || "Support Team"}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(ticket.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
