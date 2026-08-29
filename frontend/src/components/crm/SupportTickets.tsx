import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  MoreHorizontal,
  MessageSquare,
  Sparkles,
  Loader2,
  X,
  Trash2,
  Eye,
  RefreshCw,
  User,
  Tag,
  Flag,
  ArrowUpDown,
  Filter,
  Check,
  Building,
  Calendar,
  Layers,
  PhoneCall,
} from "lucide-react";

import { crmTicketsApi, crmCustomersApi, crmCallsApi, type CrmTicket, type CrmCustomer, type CRMCallLog } from "@/lib/api-client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { AiCallingModal } from "./AiCallingModal";


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
        if (isMounted && res.items) {
          setCustomers(res.items);
        }
      })
      .catch(() => {
        if (isMounted) setCustomers([]);
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
      toast.error("Please enter ticket description");
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
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-foreground flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Create Support Ticket</h2>
              <p className="text-xs text-muted-foreground">Log a new customer case or service inquiry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Customer / Account (Optional)
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
                <option value="Support">General Support</option>
                <option value="Billing">Billing & Payment</option>
                <option value="Technical">Technical Issue</option>
                <option value="Logistics">Shipping & Logistics</option>
                <option value="Returns">Returns & Refunds</option>
                <option value="Complaint">Complaint</option>
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
              Description & Customer Notes *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Describe the issue, customer message, or troubleshooting steps..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full p-3 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/60">
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
      toast.success(`Ticket marked as ${newStatus}`);
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
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-foreground flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base leading-tight">{currentTicket.subject}</h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    currentTicket.priority === "High" || currentTicket.priority === "Urgent"
                      ? "bg-rose-500/10 text-rose-600 border border-rose-200 dark:border-rose-900/30"
                      : currentTicket.priority === "Medium"
                      ? "bg-blue-500/10 text-blue-600 border border-blue-200 dark:border-blue-900/30"
                      : "bg-slate-500/10 text-slate-600 border border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {currentTicket.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Ticket ID: {currentTicket.id}</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60 text-xs">
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
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-sm"
              >
                {summarizing ? (
                  <><Loader2 className="size-3 animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles className="size-3" /> {currentTicket.ai_summary ? "Refresh AI Summary" : "Generate Summary"}</>
                )}
              </button>
            </div>
            {currentTicket.ai_summary ? (
              <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed font-medium">
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
        <div className="px-6 py-4 border-t border-border/60 bg-muted/30 flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete Ticket
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl shadow-sm hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Support Tickets Dashboard ──────────────────────────────────────────
export function SupportTickets({ tab = "active_tickets" }: Props) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<CrmTicket | null>(null);
  const [callingTicket, setCallingTicket] = useState<CrmTicket | null>(null);
  const [menuOpenTicketId, setMenuOpenTicketId] = useState<string | null>(null);
  const [callStatusMap, setCallStatusMap] = useState<Record<string, CRMCallLog>>({});

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await crmTicketsApi.list();
      setTickets(res || []);
      // Load call statuses in background
      try {
        const callRes = await crmCallsApi.listLogs(1, 200, "ticket");
        const map: Record<string, CRMCallLog> = {};
        for (const log of (callRes.items || [])) {
          if (log.target_id && !map[log.target_id]) {
            map[log.target_id] = log;
          }
        }
        setCallStatusMap(map);
      } catch { /* silent */ }
    } catch (err) {
      console.error("Failed to fetch support tickets:", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

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
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ai_summary: res.ai_summary } : t))
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
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? res : t)));
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
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      toast.success("Ticket deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete ticket");
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "Open").length;
    const inProgress = tickets.filter((t) => t.status === "In Progress").length;
    const resolved = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;
    const urgent = tickets.filter((t) => (t.priority === "Urgent" || t.priority === "High") && t.status === "Open").length;
    return { total, open, inProgress, resolved, urgent };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "All" || t.status === filterStatus;
      const matchesCat = filterCategory === "All" || t.category === filterCategory;
      return matchesSearch && matchesStatus && matchesCat;
    });
  }, [tickets, searchTerm, filterStatus, filterCategory]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Support Tickets</h2>
          <p className="text-xs text-muted-foreground">
            Manage, triage, and resolve customer support cases and technical inquiries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchTickets()}
            disabled={loading}
            className="p-1.5 h-8 w-8 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center justify-center"
            title="Refresh tickets"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" /> New Ticket
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Open Tickets</p>
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <AlertCircle className="size-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-foreground mt-2">{metrics.open}</h3>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">Awaiting resolution</p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">High & Urgent</p>
            <div className="size-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Flag className="size-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-rose-600 mt-2">{metrics.urgent}</h3>
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mt-1">Immediate triage needed</p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">In Progress</p>
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-foreground mt-2">{metrics.inProgress}</h3>
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-1">Actively being worked</p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Resolved</p>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 mt-2">{metrics.resolved}</h3>
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">Successfully closed</p>
        </div>
      </div>

      {/* Tickets Table / List */}
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-border/50 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by subject, customer, ticket ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {/* Status Pills */}
            <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
              {["All", "Open", "In Progress", "Resolved", "Closed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    filterStatus === st
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 px-3 bg-background border border-border rounded-lg text-xs font-medium text-muted-foreground focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="Support">Support</option>
              <option value="Billing">Billing</option>
              <option value="Technical">Technical</option>
              <option value="Logistics">Logistics</option>
              <option value="Returns">Returns</option>
              <option value="Complaint">Complaint</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="size-6 animate-spin mx-auto text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Loading support tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
                <MessageSquare className="size-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No Support Tickets Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchTerm || filterStatus !== "All" || filterCategory !== "All"
                  ? "No tickets match your active search filters."
                  : "No support tickets have been created yet. Click '+ New Ticket' to create one."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 text-[11px] font-bold text-muted-foreground uppercase bg-muted/30">
                  <th className="px-5 py-3.5">Ticket & Case</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-medium">
                {filteredTickets.map((ticket, i) => (
                  <motion.tr
                    key={ticket.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedTicket(ticket)}
                    className="hover:bg-muted/40 transition-colors group cursor-pointer"
                  >
                    {/* Ticket Subject & AI Summary */}
                    <td className="px-5 py-4 max-w-md">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <MessageSquare className="size-3.5" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-xs leading-snug group-hover:text-primary transition-colors">
                            {ticket.subject}
                          </p>

                          {ticket.ai_summary ? (
                            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/40 px-2.5 py-1.5 rounded-lg leading-relaxed font-normal">
                              <span className="font-semibold mr-1">💡 AI:</span>
                              {ticket.ai_summary}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => void runAiSummary(e, ticket.id)}
                              disabled={summarizingId === ticket.id}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              {summarizingId === ticket.id ? (
                                <><Loader2 className="size-3 animate-spin" /> Generating AI Summary...</>
                              ) : (
                                <><Sparkles className="size-3" /> Summarize with AI</>
                              )}
                            </button>
                          )}

                          <p className="text-[10px] text-muted-foreground font-mono">
                            ID: {ticket.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Customer & Call Status */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {((ticket as any).customer_name || "C").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-foreground font-semibold truncate max-w-[130px]">
                            {(ticket as any).customer_name || "Enterprise Client"}
                          </span>
                        </div>
                        {(() => {
                          const log = callStatusMap[ticket.id];
                          if (!log) return null;
                          const days = Math.floor((Date.now() - new Date(log.created_at).getTime()) / (1000 * 60 * 60 * 24));
                          const overdue = days >= 2;
                          return (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              overdue
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            }`}>
                              {overdue ? <Clock className="size-2.5" /> : <CheckCircle2 className="size-2.5" />}
                              {overdue ? `Call follow-up ${days}d ago` : days === 0 ? "Called today" : `Called ${days}d ago`}
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-muted/60 text-muted-foreground border border-border/50">
                        {ticket.category || "Support"}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 ${
                          ticket.priority === "High" || ticket.priority === "Urgent"
                            ? "bg-rose-500/10 text-rose-600 border border-rose-200 dark:border-rose-900/30"
                            : ticket.priority === "Medium"
                            ? "bg-blue-500/10 text-blue-600 border border-blue-200 dark:border-blue-900/30"
                            : "bg-slate-500/10 text-slate-600 border border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <span className={`size-1.5 rounded-full ${
                          ticket.priority === "High" || ticket.priority === "Urgent"
                            ? "bg-rose-500"
                            : ticket.priority === "Medium"
                            ? "bg-blue-500"
                            : "bg-slate-400"
                        }`} />
                        {ticket.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                          ticket.status === "Open"
                            ? "bg-blue-500/10 text-blue-600 border border-blue-200 dark:border-blue-900/30"
                            : ticket.status === "In Progress"
                            ? "bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-900/30"
                            : "bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-900/30"
                        }`}
                      >
                        {ticket.status === "Open" ? (
                          <AlertCircle className="size-3" />
                        ) : ticket.status === "In Progress" ? (
                          <Clock className="size-3" />
                        ) : (
                          <CheckCircle2 className="size-3" />
                        )}
                        {ticket.status}
                      </span>
                    </td>

                    {/* Created Time */}
                    <td className="px-4 py-4 text-muted-foreground text-[11px]">
                      {new Date(ticket.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Actions Menu */}
                    <td className="px-5 py-4 text-right relative">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCallingTicket(ticket);
                          }}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            callStatusMap[ticket.id]
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              : "border-border/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                          }`}
                          title={callStatusMap[ticket.id] ? "Ticket was called — Click to call again" : "Start AI Support Call"}
                        >
                          <PhoneCall className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenTicketId((prev) => (prev === ticket.id ? null : ticket.id));
                          }}
                          className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-xs"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </div>

                      {menuOpenTicketId === ticket.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-6 top-10 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 py-1.5 text-left text-xs font-medium text-foreground"
                        >
                          <button
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setMenuOpenTicketId(null);
                            }}
                            className="w-full px-3.5 py-2 hover:bg-muted flex items-center gap-2 text-left transition-colors"
                          >
                            <Eye className="size-3.5 text-primary" /> View Full Case
                          </button>
                          <button
                            onClick={() => {
                              setCallingTicket(ticket);
                              setMenuOpenTicketId(null);
                            }}
                            className="w-full px-3.5 py-2 hover:bg-muted flex items-center gap-2 text-left transition-colors text-indigo-600 dark:text-indigo-400"
                          >
                            <PhoneCall className="size-3.5" /> AI Support Call
                          </button>
                          <button
                            onClick={(e) => void runAiSummary(e, ticket.id)}
                            className="w-full px-3.5 py-2 hover:bg-muted flex items-center gap-2 text-left transition-colors text-indigo-600 dark:text-indigo-400"
                          >
                            <Sparkles className="size-3.5" /> AI Case Summary
                          </button>
                          
                          <div className="my-1 border-t border-border/60" />
                          <p className="px-3.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Set Status
                          </p>
                          <button
                            onClick={(e) => void handleUpdateStatus(e, ticket.id, "Open")}
                            className="w-full px-3.5 py-1.5 hover:bg-muted flex items-center gap-2 text-left transition-colors text-blue-600"
                          >
                            <AlertCircle className="size-3" /> Mark as Open
                          </button>
                          <button
                            onClick={(e) => void handleUpdateStatus(e, ticket.id, "In Progress")}
                            className="w-full px-3.5 py-1.5 hover:bg-muted flex items-center gap-2 text-left transition-colors text-amber-600"
                          >
                            <Clock className="size-3" /> Mark as In Progress
                          </button>
                          <button
                            onClick={(e) => void handleUpdateStatus(e, ticket.id, "Resolved")}
                            className="w-full px-3.5 py-1.5 hover:bg-muted flex items-center gap-2 text-left transition-colors text-emerald-600"
                          >
                            <CheckCircle2 className="size-3" /> Mark as Resolved
                          </button>
                          <button
                            onClick={(e) => void handleUpdateStatus(e, ticket.id, "Closed")}
                            className="w-full px-3.5 py-1.5 hover:bg-muted flex items-center gap-2 text-left transition-colors text-slate-500"
                          >
                            <Check className="size-3" /> Mark as Closed
                          </button>
                          
                          <div className="my-1 border-t border-border/60" />
                          <button
                            onClick={(e) => void handleDeleteTicket(e, ticket.id)}
                            className="w-full px-3.5 py-2 hover:bg-rose-500/10 text-rose-600 flex items-center gap-2 text-left transition-colors font-semibold"
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

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateTicketModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => void fetchTickets()}
          />
        )}
      </AnimatePresence>

      {/* Ticket Details Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <TicketDetailsModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onUpdated={(updated) => {
              setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
              setSelectedTicket(updated);
            }}
            onDeleted={(id) => {
              setTickets((prev) => prev.filter((t) => t.id !== id));
              setSelectedTicket(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* AI Voice Calling Modal */}
      {callingTicket && (
        <AiCallingModal
          open={!!callingTicket}
          onClose={() => {
            setCallingTicket(null);
            void fetchTickets();
          }}
          targetType="ticket"
          targetId={callingTicket.id}
          contactName={(callingTicket as any).customer_name || "Customer"}
          contactPhone={(callingTicket as any).customer_phone || undefined}
          contactEmail={(callingTicket as any).customer_email || undefined}
          companyName={(callingTicket as any).customer_company || undefined}
          initialPersona="support"
        />
      )}
    </div>
  );
}

