import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, MessageSquare, AlertCircle, Clock, CheckCircle2, MoreHorizontal, MessageCircle } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";

interface Props {
  tab?: string;
}

export function SupportTickets({ tab = "active_tickets" }: Props) {
  const { mockTickets } = useCrmData();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const filteredTickets = mockTickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
            <p className={`text-xs font-medium mt-2 ${stat.color}`}>{stat.trend}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {["All", "Open", "In Progress", "Waiting on Customer", "Resolved"].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === status 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "bg-background/50 border border-border hover:bg-accent text-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
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
                  transition={{ delay: i * 0.05 }}
                  key={ticket.id} 
                  className="hover:bg-muted/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <MessageSquare className="size-4 text-primary" /> {ticket.subject}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{ticket.id}</p>
                  </td>
                  <td className="px-6 py-4 font-medium">{ticket.customer}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                      ticket.priority === 'Urgent' ? 'bg-red-500/10 text-red-600' :
                      ticket.priority === 'High' ? 'bg-orange-500/10 text-orange-600' :
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
                      ticket.status === 'Waiting on Customer' ? 'bg-purple-500/10 text-purple-600' :
                      'bg-emerald-500/10 text-emerald-600'
                    }`}>
                      {ticket.status === 'Open' ? <AlertCircle className="size-3" /> :
                       ticket.status === 'Resolved' || ticket.status === 'Closed' ? <CheckCircle2 className="size-3" /> :
                       <Clock className="size-3" />}
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{ticket.assignedTo}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(ticket.created).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-primary rounded-md transition-colors" title="Reply">
                        <MessageCircle className="size-4" />
                      </button>
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </div>
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
