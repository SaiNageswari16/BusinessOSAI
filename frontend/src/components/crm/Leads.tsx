import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Calendar, Mail, Phone, Plus, Search,
  Facebook, RefreshCw, Sparkles, X, Trash2, Key,
  PhoneCall, CheckCircle2, Clock, Loader2, Target, Megaphone, Layers, Briefcase,
  ClipboardList, FileText, PhoneOff, PhoneForwarded, Download, Upload,
  UserCheck, Users, LayoutGrid, Table as TableIcon, CheckSquare, Square,
  Filter, ArrowUpDown, ChevronRight, UserPlus, Star
} from "lucide-react";
import { toast } from "sonner";
import {
  crmLeadsApi,
  crmCallsApi,
  type CrmLead,
  type LeadAttribution,
  type CRMCallLog,
  type SalesExecutive
} from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { downloadLeadsTemplateExcel } from "@/lib/crm-excel-utils";
import { AiCallingModal } from "./AiCallingModal";
import { NotesAndDispositionModal } from "./NotesAndDispositionModal";
import { BulkAssignModal } from "./BulkAssignModal";
import { BulkImportLeadsModal } from "./BulkImportLeadsModal";
import { ConvertPipelineModal } from "./ConvertPipelineModal";

const stages: CrmLead["status"][] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
const blankLead = { name: "", company_name: "", email: "", phone: "", source: "Website", estimated_value: "0" };

export function Leads() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  // Data states
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [executives, setExecutives] = useState<SalesExecutive[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Filtering states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [scheduleFilter, setScheduleFilter] = useState<"all" | "overdue" | "today" | "tomorrow" | "this_week" | "unscheduled">("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Selection states for bulk actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankLead);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [convertTargetLead, setConvertTargetLead] = useState<CrmLead | null>(null);
  const [notesTargetLead, setNotesTargetLead] = useState<CrmLead | null>(null);
  const [callTarget, setCallTarget] = useState<CrmLead | null>(null);

  // Facebook Lead Ads States
  const [showFbSettings, setShowFbSettings] = useState(false);
  const [fbForm, setFbForm] = useState({ access_token: "", page_or_form_id: "", api_version: "v25.0" });
  const [fbConfigured, setFbConfigured] = useState(false);
  const [importingFb, setImportingFb] = useState(false);

  // Ad Attribution Drawer
  const [attrLead, setAttrLead] = useState<CrmLead | null>(null);
  const [attribution, setAttribution] = useState<LeadAttribution | null>(null);
  const [loadingAttr, setLoadingAttr] = useState(false);

  // Compute ISO date range based on dateFilter selection
  const { createdAfter, createdBefore } = useMemo(() => {
    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { createdAfter: start.toISOString(), createdBefore: undefined };
    }
    if (dateFilter === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { createdAfter: start.toISOString(), createdBefore: end.toISOString() };
    }
    if (dateFilter === "7days") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { createdAfter: start.toISOString(), createdBefore: undefined };
    }
    if (dateFilter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { createdAfter: start.toISOString(), createdBefore: undefined };
    }
    if (dateFilter === "custom" && (customStartDate || customEndDate)) {
      return {
        createdAfter: customStartDate ? `${customStartDate}T00:00:00Z` : undefined,
        createdBefore: customEndDate ? `${customEndDate}T23:59:59Z` : undefined,
      };
    }
    return { createdAfter: undefined, createdBefore: undefined };
  }, [dateFilter, customStartDate, customEndDate]);

  // Day-by-Day / Scheduled follow-ups filtering
  const scheduleCounts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    const tomorrowEnd = new Date(todayEnd.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    let overdue = 0, today = 0, tomorrow = 0, thisWeek = 0;
    leads.forEach((l) => {
      if (l.next_follow_up_at) {
        const d = new Date(l.next_follow_up_at);
        if (d < todayStart) overdue++;
        else if (d >= todayStart && d <= todayEnd) today++;
        else if (d >= tomorrowStart && d <= tomorrowEnd) tomorrow++;
        if (d >= todayStart && d <= weekEnd) thisWeek++;
      }
    });
    return { all: leads.length, overdue, today, tomorrow, thisWeek };
  }, [leads]);

  const leadsToDisplay = useMemo(() => {
    if (scheduleFilter === "all") return leads;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    const tomorrowEnd = new Date(todayEnd.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    return leads.filter((l) => {
      if (!l.next_follow_up_at) return scheduleFilter === "unscheduled";
      const fDate = new Date(l.next_follow_up_at);
      if (scheduleFilter === "overdue") return fDate < todayStart;
      if (scheduleFilter === "today") return fDate >= todayStart && fDate <= todayEnd;
      if (scheduleFilter === "tomorrow") return fDate >= tomorrowStart && fDate <= tomorrowEnd;
      if (scheduleFilter === "this_week") return fDate >= todayStart && fDate <= weekEnd;
      return true;
    });
  }, [leads, scheduleFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const [leadsRes, execsRes] = await Promise.all([
        crmLeadsApi.list(
          1,
          200,
          search.trim() || undefined,
          statusFilter !== "all" ? statusFilter : undefined,
          assignedFilter !== "all" ? assignedFilter : undefined,
          createdAfter,
          createdBefore
        ),
        crmLeadsApi.listSalesExecutives().catch(() => [] as SalesExecutive[]),
      ]);
      setLeads(leadsRes.items || []);
      setExecutives(execsRes || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tenant?.id, statusFilter, assignedFilter, dateFilter, customStartDate, customEndDate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const fetchCreds = async () => {
      try {
        const res = await crmLeadsApi.getFacebookCredentials();
        if (res.configured) {
          setFbConfigured(true);
          setFbForm({ access_token: "", page_or_form_id: res.fb_page_or_form_id || "", api_version: res.fb_api_version || "v25.0" });
        }
      } catch {
        /* silent */
      }
    };
    void fetchCreds();
  }, [tenant?.id]);

  // Row selection helpers
  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map((l) => l.id));
    }
  };

  const createLead = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const lead = await crmLeadsApi.create({ ...form, estimated_value: Number(form.estimated_value), status: "New" });
      setLeads((current) => [lead, ...current]);
      setForm(blankLead);
      setShowForm(false);
      toast.success("Lead created successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create lead");
    } finally {
      setSaving(false);
    }
  };

  const moveLead = async (lead: CrmLead, status: CrmLead["status"]) => {
    if (status === lead.status) return;
    try {
      const updated = await crmLeadsApi.update(lead.id, { status });
      setLeads((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      toast.success(`Lead moved to ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update lead");
    }
  };

  const handleInlineAssign = async (leadId: string, ownerUserId: string) => {
    try {
      await crmLeadsApi.update(leadId, { owner_user_id: ownerUserId || null });
      const exec = executives.find((e) => e.id === ownerUserId);
      setLeads((current) =>
        current.map((item) =>
          item.id === leadId
            ? { ...item, owner_user_id: ownerUserId || null, owner_name: exec?.name || null }
            : item
        )
      );
      toast.success("Lead assigned successfully");
    } catch {
      toast.error("Failed to reassign lead");
    }
  };

  const saveFbCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbForm.access_token.trim()) {
      toast.error("Page Access Token is required.");
      return;
    }
    try {
      const res = await crmLeadsApi.saveFacebookCredentials({
        fb_access_token: fbForm.access_token.trim(),
        fb_page_or_form_id: fbForm.page_or_form_id.trim() || undefined,
        fb_api_version: fbForm.api_version,
      });
      setFbConfigured(true);
      setShowFbSettings(false);
      setFbForm({
        access_token: "",
        page_or_form_id: res.fb_page_or_form_id || fbForm.page_or_form_id,
        api_version: res.fb_api_version || fbForm.api_version,
      });
      toast.success("Facebook credentials saved successfully");
    } catch (err: any) {
      toast.error(err?.detail || "Failed to save credentials");
    }
  };

  const deleteFbCredentials = async () => {
    try {
      await crmLeadsApi.deleteFacebookCredentials();
      setFbConfigured(false);
      setFbForm({ access_token: "", page_or_form_id: "", api_version: "v25.0" });
      toast.success("Facebook credentials removed");
    } catch {
      toast.error("Failed to delete credentials");
    }
  };

  const handleFbImport = async () => {
    setImportingFb(true);
    try {
      const res = await crmLeadsApi.importFacebookLeads();
      toast.success(res.message);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import leads from Facebook");
    } finally {
      setImportingFb(false);
    }
  };

  const runAiAnalysis = async (id: string) => {
    const apiPromise = crmLeadsApi.analyzeLeadAi(id);
    toast.promise(apiPromise, {
      loading: "Evaluating lead quality & sentiment with AI...",
      success: (res) => {
        setLeads((current) =>
          current.map((item) =>
            item.id === id ? { ...item, ai_score: res.ai_score, ai_sentiment: res.ai_sentiment } : item
          )
        );
        return `Score: ${res.ai_score}% · Sentiment: ${res.ai_sentiment}`;
      },
      error: "AI lead qualification failed",
    });
  };

  const openCallModal = (lead: CrmLead) => {
    setCallTarget(lead);
  };

  const openAttribution = async (lead: CrmLead) => {
    if (!lead.meta?.ad_id) {
      toast.info("No ad attribution data for this lead (may have been created manually).");
      return;
    }
    setAttrLead(lead);
    setAttribution(null);
    setLoadingAttr(true);
    try {
      const data = await crmLeadsApi.getAttribution(lead.id);
      setAttribution(data);
    } catch {
      toast.error("Could not load attribution data");
    } finally {
      setLoadingAttr(false);
    }
  };

  const shareGoogleReview = (lead: CrmLead) => {
    const reviewLink = "https://search.google.com/local/writereview";
    const msg = `Hi ${lead.name}, thank you for choosing us! We'd love your feedback—please take 10 seconds to leave us a quick 5-star Google review here: ${reviewLink}`;
    if (lead.phone) {
      const cleanPhone = lead.phone.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      toast.success("Opening WhatsApp with Google Review request!");
    } else {
      navigator.clipboard.writeText(reviewLink);
      toast.success("Google Review link copied to clipboard!");
    }
  };

  return (
    <div className="p-4 min-h-[calc(100vh-6rem)] flex flex-col space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Leads & Sales Management</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
              {leads.length} Leads
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Role-based visibility, lead assignment, bulk Excel import, and calling tracker.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center p-1 bg-muted/40 rounded-xl border border-border">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === "table" ? "bg-background text-foreground shadow-xs border border-border" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View (Batch Assignment)"
            >
              <TableIcon className="size-3.5" />
              Table
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === "kanban" ? "bg-background text-foreground shadow-xs border border-border" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Kanban Board"
            >
              <LayoutGrid className="size-3.5" />
              Kanban
            </button>
          </div>

          {/* Sample Excel Download */}
          <button
            onClick={downloadLeadsTemplateExcel}
            className="flex items-center gap-1.5 px-3 h-8 bg-muted/60 hover:bg-muted border border-border rounded-xl text-xs font-semibold text-foreground transition-colors"
            title="Download sample formatted Excel template for import"
          >
            <Download className="size-3.5 text-primary" />
            Sample Excel
          </button>

          {/* Bulk Import */}
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-1.5 px-3 h-8 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 transition-colors"
          >
            <Upload className="size-3.5 text-emerald-600" />
            Import Leads
          </button>

          {/* Export Leads CSV */}
          <button
            onClick={() => {
              const url = crmLeadsApi.exportCsvUrl({
                search,
                status: statusFilter,
                assigned_to: assignedFilter,
                created_after: dateRange.after,
                created_before: dateRange.before,
              });
              window.open(url, "_blank");
            }}
            className="flex items-center gap-1.5 px-3 h-8 bg-muted/60 hover:bg-muted border border-border rounded-xl text-xs font-semibold text-foreground transition-colors"
            title="Export filtered leads to CSV"
          >
            <Download className="size-3.5 text-emerald-600" />
            Export CSV
          </button>

          {/* Facebook Ads Integration */}
          <button
            onClick={() => setShowFbSettings(true)}
            className={`flex items-center gap-1.5 px-2.5 h-8 border rounded-xl text-xs font-medium transition-colors ${
              fbConfigured
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/15"
                : "bg-muted/60 border-border hover:bg-muted text-muted-foreground"
            }`}
          >
            <Facebook className="size-3.5 text-blue-600" />
            {fbConfigured ? "FB Connected" : "Connect FB Ads"}
          </button>

          <button
            onClick={handleFbImport}
            disabled={importingFb || !fbConfigured}
            className="flex items-center gap-1.5 px-2.5 h-8 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:text-indigo-400 rounded-xl text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`size-3.5 ${importingFb ? "animate-spin" : ""}`} />
            {importingFb ? "Syncing..." : "Sync FB"}
          </button>

          {/* Create Lead */}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3.5 h-8 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="size-3.5" /> Add Lead
          </button>
        </div>
      </div>

      {/* Day-by-Day Scheduled Follow-ups Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-card border border-border shadow-xs">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground px-2 flex items-center gap-1.5">
          <Calendar className="size-3.5 text-primary" /> Follow-up Schedule:
        </span>
        <button
          onClick={() => setScheduleFilter("all")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
            scheduleFilter === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>All Leads</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/20 font-mono">
            {scheduleCounts.all}
          </span>
        </button>

        <button
          onClick={() => setScheduleFilter("overdue")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
            scheduleFilter === "overdue"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
          }`}
        >
          <span>🚨 Overdue</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
            {scheduleCounts.overdue}
          </span>
        </button>

        <button
          onClick={() => setScheduleFilter("today")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
            scheduleFilter === "today"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
          }`}
        >
          <span>📅 Due Today</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
            {scheduleCounts.today}
          </span>
        </button>

        <button
          onClick={() => setScheduleFilter("tomorrow")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
            scheduleFilter === "tomorrow"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
          }`}
        >
          <span>🌅 Tomorrow</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
            {scheduleCounts.tomorrow}
          </span>
        </button>

        <button
          onClick={() => setScheduleFilter("this_week")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
            scheduleFilter === "this_week"
              ? "bg-purple-600 text-white shadow-xs"
              : "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100"
          }`}
        >
          <span>📆 Next 7 Days</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
            {scheduleCounts.thisWeek}
          </span>
        </button>
      </div>

      {/* Advanced Filters & Date Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-2.5 p-3 rounded-2xl bg-card border border-border shadow-xs">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, phone, email..."
            className="w-full pl-8 pr-3 h-8 bg-background border border-border rounded-xl text-xs focus:outline-none"
          />
        </div>

        {/* Assigned Executive Filter */}
        <div>
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="w-full h-8 px-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none"
          >
            <option value="all">👤 All Assigned Reps</option>
            <option value="me">⭐ My Assigned Leads</option>
            <option value="unassigned">⚠️ Unassigned Leads</option>
            {executives.map((exec) => (
              <option key={exec.id} value={exec.id}>
                👤 {exec.name} ({exec.active_leads_count} leads)
              </option>
            ))}
          </select>
        </div>

        {/* Lead Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-8 px-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none"
          >
            <option value="all">🎯 All Stages / Statuses</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full h-8 px-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none"
          >
            <option value="all">📅 All Time</option>
            <option value="today">Today's Leads</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Date Range...</option>
          </select>
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-1 md:col-span-4 lg:col-span-1">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-1/2 h-8 px-2 bg-background border border-border rounded-xl text-[11px] focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-1/2 h-8 px-2 bg-background border border-border rounded-xl text-[11px] focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Creation Form */}
      {showForm && (
        <form onSubmit={createLead} className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          {([
            ["name", "Contact name *", true],
            ["company_name", "Company name", false],
            ["email", "Email address", false],
            ["phone", "Phone (+91...)", false],
            ["source", "Source (e.g. Website, Referral)", false],
            ["estimated_value", "Estimated deal value", false],
          ] as const).map(([field, label, required]) => (
            <input
              key={field}
              required={required}
              type={field === "estimated_value" ? "number" : field === "email" ? "email" : "text"}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              placeholder={label}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none"
            />
          ))}
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs hover:underline">
              Cancel
            </button>
            <button
              disabled={saving}
              className="rounded-xl bg-primary px-4 py-2 text-xs text-primary-foreground font-bold shadow-xs"
            >
              {saving ? "Saving..." : "Create Lead"}
            </button>
          </div>
        </form>
      )}

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedLeadIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-foreground text-background shadow-2xl border border-border"
          >
            <div className="flex items-center gap-2 pr-3 border-r border-background/20 text-xs font-bold">
              <CheckSquare className="size-4 text-primary" />
              <span>{selectedLeadIds.length} lead{selectedLeadIds.length > 1 ? "s" : ""} selected</span>
            </div>

            <button
              onClick={() => setShowBulkAssign(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <UserCheck className="size-3.5" />
              Bulk Assign to Sales Reps
            </button>

            <button
              onClick={() => setSelectedLeadIds([])}
              className="px-2.5 py-1.5 rounded-xl text-xs text-background/70 hover:text-background hover:bg-background/10 transition-colors"
            >
              Deselect All
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area: Table vs Kanban */}
      {loading ? (
        <div className="py-24 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span>Loading leads & executive metrics...</span>
        </div>
      ) : viewMode === "table" ? (
        /* ── TABLE VIEW (Rich List & Batch Assignment Mode) ── */
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {selectedLeadIds.length === leadsToDisplay.length && leadsToDisplay.length > 0 ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3">Lead & Company</th>
                  <th className="p-3">Contact Details</th>
                  <th className="p-3">Assigned Sales Executive</th>
                  <th className="p-3">Calls Done & Follow-up</th>
                  <th className="p-3">Estimated Value</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {leadsToDisplay.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="size-8 opacity-30" />
                        <p className="text-sm font-semibold">No leads found matching current schedule & filters</p>
                        <p className="text-xs opacity-70">Try selecting "All Leads" or adjusting your search criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  leadsToDisplay.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectLead(lead.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isSelected ? (
                              <CheckSquare className="size-4 text-primary" />
                            ) : (
                              <Square className="size-4" />
                            )}
                          </button>
                        </td>

                        {/* Name & Company */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-foreground hover:underline cursor-pointer">
                                  {lead.name}
                                </p>
                                {lead.ai_score != null && (
                                  <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                      lead.ai_sentiment === "Positive"
                                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                        : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                    }`}
                                  >
                                    AI: {lead.ai_score}%
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground text-[11px]">
                                {lead.company_name || "Individual"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact Details */}
                        <td className="p-3 space-y-1">
                          {lead.phone && (
                            <p className="flex items-center gap-1.5 text-foreground font-mono font-medium">
                              <Phone className="size-3 text-muted-foreground" />
                              {lead.phone}
                            </p>
                          )}
                          {lead.email && (
                            <p className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="size-3" />
                              {lead.email}
                            </p>
                          )}
                        </td>

                        {/* Assigned Sales Executive */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={lead.owner_user_id || ""}
                              onChange={(e) => handleInlineAssign(lead.id, e.target.value)}
                              className="bg-background border border-border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer max-w-[160px] truncate"
                            >
                              <option value="">⚠️ Unassigned</option>
                              {executives.map((exec) => (
                                <option key={exec.id} value={exec.id}>
                                  👤 {exec.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Calls Done & Scheduled Follow-up */}
                        <td className="p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] border border-indigo-200 dark:border-indigo-800">
                              <PhoneCall className="size-3" />
                              {lead.calls_count || 0} call{lead.calls_count !== 1 ? "s" : ""}
                            </span>

                            {lead.last_call_status && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  lead.last_call_status === "Completed"
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-amber-500/10 text-amber-600"
                                }`}
                              >
                                {lead.last_call_status}
                              </span>
                            )}
                          </div>

                          {lead.next_follow_up_at && (
                            <button
                              type="button"
                              onClick={() => setNotesTargetLead(lead)}
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors text-left"
                              title="Click to reschedule follow-up or log disposition"
                            >
                              <Clock className="size-3 text-purple-600 shrink-0" />
                              <span>Due: {new Date(lead.next_follow_up_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            </button>
                          )}
                          {lead.last_contact_at && !lead.next_follow_up_at && (
                            <p className="text-[10px] text-muted-foreground">
                              Last contact: {new Date(lead.last_contact_at).toLocaleDateString()}
                            </p>
                          )}
                        </td>

                        {/* Estimated Value */}
                        <td className="p-3 font-bold text-emerald-600 text-xs">
                          {formatCurrency(lead.estimated_value || 0)}
                        </td>

                        {/* Stage Selector */}
                        <td className="p-3">
                          <select
                            value={lead.status}
                            onChange={(e) => void moveLead(lead, e.target.value as CrmLead["status"])}
                            className="bg-background border border-border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none"
                          >
                            {stages.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => shareGoogleReview(lead)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-colors"
                            title="Request 5-Star Google Review via WhatsApp / SMS"
                          >
                            <Star className="size-3.5 fill-amber-500 text-amber-500" />
                          </button>
                          <button
                            onClick={() => openCallModal(lead)}
                            disabled={!lead.phone}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 transition-colors disabled:opacity-30"
                            title="Call with AI Voice Agent"
                          >
                            <PhoneCall className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setNotesTargetLead(lead)}
                            className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
                            title="Log Notes & Call Disposition"
                          >
                            <ClipboardList className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setConvertTargetLead(lead)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                            title="Convert to Customer & Deal Pipeline"
                          >
                            <Sparkles className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── KANBAN VIEW ── */
        <div className="flex-1 flex gap-5 overflow-x-auto pb-4 items-start">
          {stages.map((stage) => {
            const stageLeads = leadsToDisplay.filter((lead) => lead.status === stage);
            return (
              <section
                key={stage}
                className="flex-shrink-0 w-80 flex flex-col rounded-2xl border border-border/60 bg-muted/20 max-h-[78vh] overflow-hidden shadow-xs"
              >
                <header className="p-3.5 border-b border-border/50 flex justify-between items-center bg-card/60">
                  <h2 className="font-bold text-xs uppercase tracking-wide text-foreground">{stage}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-background border font-bold">
                    {stageLeads.length}
                  </span>
                </header>

                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {stageLeads.map((lead) => (
                    <motion.article
                      layout
                      key={lead.id}
                      className="bg-card p-4 rounded-xl border border-border shadow-xs relative overflow-hidden group space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-xs text-foreground">{lead.name}</h3>
                          <p className="text-[11px] text-muted-foreground">{lead.company_name || "Individual"}</p>
                        </div>
                        <span className="text-xs font-black text-emerald-600">
                          {formatCurrency(lead.estimated_value || 0)}
                        </span>
                      </div>

                      {/* Contact items */}
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        {lead.phone && (
                          <p className="flex items-center gap-1 font-mono">
                            <Phone className="size-3 text-muted-foreground" />
                            {lead.phone}
                          </p>
                        )}
                        {lead.email && (
                          <p className="flex items-center gap-1 truncate">
                            <Mail className="size-3 text-muted-foreground" />
                            {lead.email}
                          </p>
                        )}
                      </div>

                      {/* Scheduled Follow-up Badge */}
                      {lead.next_follow_up_at && (
                        <button
                          type="button"
                          onClick={() => setNotesTargetLead(lead)}
                          className="w-full flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors text-left"
                          title="Click to reschedule or log outcome"
                        >
                          <Clock className="size-3 text-purple-600 shrink-0" />
                          <span className="truncate">Due: {new Date(lead.next_follow_up_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </button>
                      )}

                      {/* Owner Rep */}
                      <div className="pt-2 border-t flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium">
                          👤 {lead.owner_name || "Unassigned"}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                          {lead.calls_count || 0} calls
                        </span>
                      </div>

                      {/* Quick Actions */}
                      <div className="grid grid-cols-3 gap-1 pt-1">
                        <button
                          onClick={() => shareGoogleReview(lead)}
                          className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold transition-colors"
                          title="Request 5-Star Google Review"
                        >
                          <Star className="size-3 fill-amber-500 text-amber-500" /> Review
                        </button>
                        <button
                          onClick={() => openCallModal(lead)}
                          disabled={!lead.phone}
                          className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold transition-colors disabled:opacity-40"
                        >
                          <PhoneCall className="size-3" /> Call
                        </button>
                        <button
                          onClick={() => setConvertTargetLead(lead)}
                          className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold transition-colors"
                        >
                          <Sparkles className="size-3" /> Convert
                        </button>
                      </div>
                    </motion.article>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="h-20 border border-dashed rounded-xl flex items-center justify-center text-muted-foreground text-xs bg-background/30">
                      No leads
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ── Bulk Assignment Modal ── */}
      {showBulkAssign && (
        <BulkAssignModal
          isOpen={showBulkAssign}
          onClose={() => setShowBulkAssign(false)}
          selectedLeadIds={selectedLeadIds}
          executives={executives}
          onSuccess={() => {
            setSelectedLeadIds([]);
            void load();
          }}
        />
      )}

      {/* ── Bulk Import Excel/CSV Modal ── */}
      {showBulkImport && (
        <BulkImportLeadsModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          executives={executives}
          onSuccess={() => {
            void load();
          }}
        />
      )}

      {/* ── Convert to Pipeline Modal ── */}
      {convertTargetLead && (
        <ConvertPipelineModal
          isOpen={!!convertTargetLead}
          lead={convertTargetLead}
          onClose={() => setConvertTargetLead(null)}
          onSuccess={() => {
            void load();
          }}
        />
      )}

      {/* ── AI Dial Studio Modal ── */}
      {callTarget && (
        <AiCallingModal
          open={!!callTarget}
          onClose={() => setCallTarget(null)}
          targetType="lead"
          targetId={callTarget.id}
          contactName={callTarget.name}
          contactPhone={callTarget.phone || undefined}
          contactEmail={callTarget.email || undefined}
          companyName={callTarget.company_name || undefined}
          dealValue={callTarget.estimated_value}
          defaultNotes={callTarget.notes || undefined}
          onCallCompleted={async () => {
            await load();
          }}
        />
      )}

      {/* ── Notes & Call Disposition Modal ── */}
      {notesTargetLead && (
        <NotesAndDispositionModal
          isOpen={!!notesTargetLead}
          onClose={() => setNotesTargetLead(null)}
          entityType="lead"
          entityId={notesTargetLead.id}
          entityName={notesTargetLead.name}
          entityCompany={notesTargetLead.company_name}
          entityPhone={notesTargetLead.phone}
          currentStatus={notesTargetLead.status}
          availableStatuses={stages}
          initialNotes={notesTargetLead.notes}
          initialDisposition={notesTargetLead.call_disposition}
          initialMinutes={notesTargetLead.call_duration_minutes}
          initialResponse={notesTargetLead.customer_response}
          initialNextFollowup={notesTargetLead.next_follow_up_at}
          onSaveSuccess={() => {
            void load();
          }}
        />
      )}

      {/* ── Facebook Settings Modal ── */}
      <AnimatePresence>
        {showFbSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-5 border-b flex justify-between items-center bg-muted/20">
                <div className="flex items-center gap-2">
                  <Facebook className="size-5 text-blue-600" />
                  <h3 className="font-bold text-sm">Facebook Lead Ads Settings</h3>
                </div>
                <button onClick={() => setShowFbSettings(false)}>
                  <X className="size-4" />
                </button>
              </div>
              <form onSubmit={saveFbCredentials} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Facebook Page ID <span className="text-[10px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-resolved from token if empty"
                    value={fbForm.page_or_form_id}
                    onChange={(e) => setFbForm({ ...fbForm, page_or_form_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Page Access Token *
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      required
                      type="password"
                      placeholder="EAA..."
                      value={fbForm.access_token}
                      onChange={(e) => setFbForm({ ...fbForm, access_token: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">API Version</label>
                  <select
                    value={fbForm.api_version}
                    onChange={(e) => setFbForm({ ...fbForm, api_version: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="v25.0">v25.0 (Latest)</option>
                    <option value="v24.0">v24.0</option>
                  </select>
                </div>
                <div className="pt-3 border-t flex justify-between items-center">
                  {fbConfigured && (
                    <button
                      type="button"
                      onClick={deleteFbCredentials}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-semibold"
                    >
                      <Trash2 className="size-3.5" /> Disconnect
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setShowFbSettings(false)}
                      className="px-3 py-1.5 text-xs hover:underline"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-primary px-4 py-2 text-xs text-primary-foreground font-bold shadow-xs"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
