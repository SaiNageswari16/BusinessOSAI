import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, AlertCircle, Clock, CheckCircle2, MoreHorizontal, MessageSquare, Sparkles, Loader2, X } from "lucide-react";

import { crmTicketsApi, crmCustomersApi, type CrmTicket, type CrmCustomer } from "@/lib/api-client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";

interface Props {
  tab?: string;
}

// ─── Modal: Create New Support Ticket ─────────────────────────────────────────
function CreateTicketModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    subject: "",
    category: "Support",
    priority: "Medium",
    description: "",
  });

  useEffect(() => {
    let isMounted = true;
    crmCustomersApi
      .list(1, 100)
      .then((res) => {
        if (isMounted) {
          setCustomers(res.items || []);
          if (res.items && res.items.length > 0) {
            setForm((p) => ({ ...p, customer_id: res.items[0].id }));
          }
        }
      })
      .catch(() => {
        if (isMounted) setCustomers([]);
      })
      .finally(() => {
        if (isMounted) setLoadingCustomers(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) {
      toast.error("Please enter a ticket subject");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Please enter ticket details");
      return;
    }

    setSubmitting(true);
    try {
      await crmTicketsApi.create({
        customer_id: form.customer_id || undefined,
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
      });
      toast.success("Support ticket created successfully!");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create support ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card border border-border/70 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-foreground"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <h2 className="font-bold text-base">Create Support Ticket</h2>
              <p className="text-xs text-muted-foreground">Log a new customer issue or inquiry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Customer / Account
            </label>
            <select
              value={form.customer_id}
              onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))}
              className="w-full h-10 px-3 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">-- General Inquiry / Unassigned Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : c.email ? `(${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Subject / Issue Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Delayed shipment for Order #1042"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              className="w-full h-10 px-3 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Support">Support</option>
                <option value="Billing">Billing & Payment</option>
                <option value="Technical">Technical Issue</option>
                <option value="Logistics">Shipping & Delivery</option>
                <option value="Returns">Returns & Refunds</option>
                <option value="General">General Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full h-10 px-3 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Description & Notes *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Describe the issue, customer request, or context..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full p-3 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold rounded-xl gradient-brand text-white shadow-md hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="size-3.5" /> Create Ticket
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: View / Edit Support Ticket Details ──────────────────────────────
function TicketDetailsModal({
  ticket,
  onClose,
  onUpdated,
  onDeleted,
}: {
  ticket: CrmTicket;
  onClose: () => void;
  onUpdated: (updated: CrmTicket) => void;
  onDeleted: (id: string) => void;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<CrmTicket>(ticket);

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await crmTicketsApi.update(currentTicket.id, { status: newStatus });
      setCurrentTicket(res);
      onUpdated(res);
      toast.success(`Ticket status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    try {
      const res = await crmTicketsApi.update(currentTicket.id, { priority: newPriority });
      setCurrentTicket(res);
      onUpdated(res);
      toast.success(`Priority updated to ${newPriority}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update priority");
    }
  };

  const handleAiSummarize = async () => {
    setSummarizing(true);
    try {
      const res = await crmTicketsApi.summarize(currentTicket.id);
      const updated = { ...currentTicket, ai_summary: res.ai_summary };
      setCurrentTicket(updated);
      onUpdated(updated);
      toast.success("AI case summary generated!");
    } catch (err: any) {
      toast.error(err.message || "AI Summary generation failed");
    } finally {
      setSummarizing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    setDeleting(true);
    try {
      await crmTicketsApi.delete(currentTicket.id);
      toast.success("Ticket deleted successfully");
      onDeleted(currentTicket.id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete ticket");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card border border-border/70 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-foreground flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">{currentTicket.subject}</h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    currentTicket.priority === "High" || currentTicket.priority === "Urgent"
                      ? "bg-red-500/10 text-red-600"
                      : currentTicket.priority === "Medium"
                      ? "bg-blue-500/10 text-blue-600"
                      : "bg-slate-500/10 text-slate-600"
                  }`}
                >
                  {currentTicket.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {currentTicket.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm">
          {/* Metadata Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/50 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Status</span>
              <div className="mt-1 font-semibold flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${
                  currentTicket.status === 'Open' ? 'bg-blue-500' :
                  currentTicket.status === 'In Progress' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`} />
                {currentTicket.status}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Category</span>
              <div className="mt-1 font-semibold text-foreground">{currentTicket.category}</div>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Customer</span>
              <div className="mt-1 font-semibold text-foreground truncate">{(currentTicket as any).customer_name || "Enterprise Customer"}</div>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Created</span>
              <div className="mt-1 font-semibold text-foreground">
                {new Date(currentTicket.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* AI Executive Summary Card */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/40 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                <Sparkles className="size-4 text-indigo-500" />
                <span>AI Case Summary & Diagnostic</span>
              </div>
              <button
                onClick={handleAiSummarize}
                disabled={summarizing}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1"
              >
                {summarizing ? (
                  <><Loader2 className="size-3 animate-spin" /> Regenerating...</>
                ) : (
                  <><Sparkles className="size-3" /> {currentTicket.ai_summary ? "Refresh AI Summary" : "Generate Summary"}</>
                )}
              </button>
            </div>
            {currentTicket.ai_summary ? (
              <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">
                {currentTicket.ai_summary}
              </p>
            ) : (
              <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 italic">
                No summary generated yet. Click "Generate Summary" to produce an instant diagnostic.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Issue Description & Notes</h4>
            <div className="bg-muted/20 border border-border/60 p-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap font-sans text-foreground">
              {currentTicket.description || "No description provided."}
            </div>
          </div>

          {/* Quick Status Control */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Update Ticket Status</h4>
            <div className="flex flex-wrap gap-2">
              {["Open", "In Progress", "Resolved", "Closed"].map((st) => (
                <button
                  key={st}
                  onClick={() => void handleStatusChange(st)}
                  disabled={updatingStatus || currentTicket.status === st}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    currentTicket.status === st
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete Ticket
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl shadow-sm hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function SupportTickets({ tab = "active_tickets" }: Props) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<CrmTicket | null>(null);
  const [menuOpenTicketId, setMenuOpenTicketId] = useState<string | null>(null);

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

  // Close actions menu on global click
  useEffect(() => {
    const handleGlobalClick = () => setMenuOpenTicketId(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

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

  const handleUpdateStatus = async (e: React.MouseEvent, ticketId: string, status: string) => {
    e.stopPropagation();
    setMenuOpenTicketId(null);
    try {
      const res = await crmTicketsApi.update(ticketId, { status });
      setTickets(prev => prev.map(t => t.id === ticketId ? res : t));
      toast.success(`Ticket marked as ${status}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDeleteTicket = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    setMenuOpenTicketId(null);
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await crmTicketsApi.delete(ticketId);
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      toast.success("Ticket deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete ticket");
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
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> New Ticket
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateTicketModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => void fetchTickets()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedTicket && (
          <TicketDetailsModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onUpdated={(updated) => {
              setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
              setSelectedTicket(updated);
            }}
            onDeleted={(id) => {
              setTickets(prev => prev.filter(t => t.id !== id));
              setSelectedTicket(null);
            }}
          />
        )}
      </AnimatePresence>

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
                    onClick={() => setSelectedTicket(ticket)}
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
                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenTicketId(prev => prev === ticket.id ? null : ticket.id);
                        }}
                        className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>

                      {menuOpenTicketId === ticket.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-6 top-10 w-44 bg-card border border-border rounded-xl shadow-xl z-30 py-1.5 text-left text-xs font-medium text-foreground"
                        >
                          <button
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setMenuOpenTicketId(null);
                            }}
                            className="w-full px-3.5 py-2 hover:bg-muted flex items-center gap-2 text-left transition-colors"
                          >
                            <MessageSquare className="size-3.5 text-primary" /> View Details
                          </button>
                          <button
                            onClick={(e) => void runAiSummary(e, ticket.id)}
                            className="w-full px-3.5 py-2 hover:bg-muted flex items-center gap-2 text-left transition-colors text-indigo-600 dark:text-indigo-400"
                          >
                            <Sparkles className="size-3.5" /> AI Summary
                          </button>
                          <div className="my-1 border-t border-border/50" />
                          <button
                            onClick={(e) => void handleUpdateStatus(e, ticket.id, "Open")}
                            className="w-full px-3.5 py-1.5 hover:bg-muted flex items-center gap-2 text-left transition-colors"
                          >
                            Mark as Open
                          </button>
                          <button
                            onClick={(e) => void handleUpdateStatus(e, ticket.id, "In Progress")}
                            className="w-full px-3.5 py-1.5 hover:bg-muted flex items-center gap-2 text-left transition-colors"
                          >
                            Mark as In Progress
                          </button>
                          <button
                            onClick={(e) => void handleUpdateStatus(e, ticket.id, "Resolved")}
                            className="w-full px-3.5 py-1.5 hover:bg-muted flex items-center gap-2 text-left transition-colors text-emerald-600"
                          >
                            Mark as Resolved
                          </button>
                          <button
                            onClick={(e) => void handleUpdateStatus(e, ticket.id, "Closed")}
                            className="w-full px-3.5 py-1.5 hover:bg-muted flex items-center gap-2 text-left transition-colors text-slate-500"
                          >
                            Mark as Closed
                          </button>
                          <div className="my-1 border-t border-border/50" />
                          <button
                            onClick={(e) => void handleDeleteTicket(e, ticket.id)}
                            className="w-full px-3.5 py-2 hover:bg-red-500/10 text-red-600 flex items-center gap-2 text-left transition-colors"
                          >
                            <Trash2 className="size-3.5" /> Delete Ticket
                          </button>
                        </div>
                      )}
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
