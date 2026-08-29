import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Calendar, Mail, Phone, Plus, Search,
  Facebook, RefreshCw, Sparkles, X, Trash2, Key,
  PhoneCall, CheckCircle2, Clock, Loader2, Target, Megaphone, Layers, Briefcase,
  ClipboardList, FileText, PhoneOff, PhoneForwarded
} from "lucide-react";
import { toast } from "sonner";
import { crmLeadsApi, crmCallsApi, type CrmLead, type LeadAttribution, type CRMCallLog } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { AiCallingModal } from "./AiCallingModal";
import { NotesAndDispositionModal } from "./NotesAndDispositionModal";

const stages: CrmLead["status"][] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
const blankLead = { name: "", company_name: "", email: "", phone: "", source: "Website", estimated_value: "0" };

export function Leads() {
    const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankLead);

  // Manual Call Disposition & Notes Modal State
  const [notesTargetLead, setNotesTargetLead] = useState<CrmLead | null>(null);

  // Facebook Lead Ads States
  const [showFbSettings, setShowFbSettings] = useState(false);
  const [fbForm, setFbForm] = useState({ access_token: "", page_or_form_id: "", api_version: "v25.0" });
  const [fbConfigured, setFbConfigured] = useState(false);
  const [importingFb, setImportingFb] = useState(false);

  // AI Call States
  const [callTarget, setCallTarget] = useState<CrmLead | null>(null);
  // Map of leadId -> latest call log (for differentiation: called vs needs-to-be-called)
  const [callStatusMap, setCallStatusMap] = useState<Record<string, CRMCallLog>>({}); 

  // Ad Attribution Drawer
  const [attrLead, setAttrLead] = useState<CrmLead | null>(null);
  const [attribution, setAttribution] = useState<LeadAttribution | null>(null);
  const [loadingAttr, setLoadingAttr] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const leadsData = (await crmLeadsApi.list(1, 100, search || undefined)).items;
      setLeads(leadsData);
      // Asynchronously load call statuses without blocking UI
      void loadCallStatuses(leadsData.map(l => l.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load leads");
    } finally {
      setLoading(false);
    }
  };

  /** Fetch the latest call log for all lead IDs to build a "called/not-called" status map */
  const loadCallStatuses = async (leadIds: string[]) => {
    try {
      const res = await crmCallsApi.listLogs(1, 200, "lead");
      const map: Record<string, CRMCallLog> = {};
      // Build a map: leadId -> most recent call log
      for (const log of (res.items || [])) {
        if (log.target_id && leadIds.includes(log.target_id)) {
          // listLogs returns sorted desc by created_at, so first entry per target_id is the latest
          if (!map[log.target_id]) {
            map[log.target_id] = log;
          }
        }
      }
      setCallStatusMap(map);
    } catch {
      // Silent — call status is optional enrichment
    }
  };

  useEffect(() => {
    void load();
    const fetchCreds = async () => {
      try {
        const res = await crmLeadsApi.getFacebookCredentials();
        if (res.configured) {
          setFbConfigured(true);
          setFbForm({ access_token: "", page_or_form_id: res.fb_page_or_form_id || "", api_version: res.fb_api_version || "v25.0" });
        }
      } catch (e) { /* silent */ }
    };
    void fetchCreds();
  }, [tenant.id]);


  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return leads.filter((lead) => !term || lead.name.toLowerCase().includes(term) || lead.company_name?.toLowerCase().includes(term));
  }, [leads, search]);

  const createLead = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const lead = await crmLeadsApi.create({ ...form, estimated_value: Number(form.estimated_value), status: "New" });
      setLeads((current) => [lead, ...current]);
      setForm(blankLead);
      setShowForm(false);
      toast.success("Lead created");
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
      setLeads((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success(`Lead moved to ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update lead");
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
    } catch { toast.error("Failed to delete credentials"); }
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
      error: "AI lead qualification failed"
    });
  };

  // ── AI Call ──────────────────────────────────────────────────────────────────
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

  return (
    <div className="p-4 min-h-[calc(100vh-6rem)] flex flex-col space-y-3">

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Leads Management</h2>
          <p className="text-xs text-muted-foreground">Track, qualify, convert — and call with AI.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-56 pl-8 pr-3 h-8 bg-background border border-border rounded-lg text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFbSettings(true)}
            className={`flex items-center gap-1.5 px-2.5 h-8 border rounded-lg text-xs font-medium transition-colors ${
              fbConfigured
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/15"
                : "bg-muted border-border hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            <Facebook className="size-3.5 text-blue-600" />
            {fbConfigured ? "FB Connected" : "Connect FB Ads"}
          </button>
          <button
            onClick={handleFbImport}
            disabled={importingFb || !fbConfigured}
            className="flex items-center gap-1.5 px-2.5 h-8 bg-indigo-50 border hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:text-indigo-400 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`size-3.5 ${importingFb ? "animate-spin" : ""}`} />
            {importingFb ? "Syncing..." : "Sync FB Ads"}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold"
          >
            <Plus className="size-3.5" /> Add Lead
          </button>
        </div>
      </div>

      {/* Creation Form */}
      {showForm && (
        <form onSubmit={createLead} className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4">
          {([
            ['name', 'Contact name', true],
            ['company_name', 'Company', false],
            ['email', 'Email', false],
            ['phone', 'Phone (+91...)', false],
            ['source', 'Source', false],
            ['estimated_value', 'Estimated value', false]
          ] as const).map(([field, label, required]) => (
            <input
              key={field}
              required={required}
              type={field === 'estimated_value' ? 'number' : field === 'email' ? 'email' : 'text'}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              placeholder={label}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none"
            />
          ))}
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-sm hover:underline">Cancel</button>
            <button disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground font-medium">
              {saving ? 'Saving…' : 'Create lead'}
            </button>
          </div>
        </form>
      )}

      {/* Leads Kanban */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading leads…</div>
      ) : (
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 items-start">
          {stages.map((stage) => {
            const stageLeads = filtered.filter((lead) => lead.status === stage);
            return (
              <section key={stage} className="flex-shrink-0 w-80 flex flex-col rounded-xl border border-border/50 bg-muted/20 max-h-[78vh] overflow-hidden">
                <header className="p-4 border-b border-border/50 flex justify-between bg-background/50">
                  <h2 className="font-semibold text-sm">{stage}</h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-background border">{stageLeads.length}</span>
                </header>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {stageLeads.map((lead) => (
                    <motion.article
                      layout key={lead.id}
                      className="bg-background p-4 rounded-lg border border-border shadow-sm relative overflow-hidden group"
                    >
                      {/* AI Badge */}
                      {lead.ai_score != null ? (
                        <div className="absolute right-2 top-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            lead.ai_sentiment === "Urgent" ? "bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse" :
                            lead.ai_sentiment === "Positive" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                            lead.ai_sentiment === "Frustrated" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                            "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          }`}>
                            {lead.ai_sentiment} · {lead.ai_score}%
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => void runAiAnalysis(lead.id)}
                          className="absolute right-2 top-2 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Score with AI"
                        >
                          <Sparkles className="size-3 text-indigo-500" />
                        </button>
                      )}

                      {lead.meta?.ad_id && (
                        <button
                          onClick={() => openAttribution(lead)}
                          className="absolute right-2 top-9 p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="View ad attribution"
                        >
                          <Target className="size-3 text-blue-500" />
                        </button>
                      )}

                      <h3 className="font-semibold text-sm pr-20 truncate">{lead.name}</h3>
                      <p className="text-xs text-primary mb-2 truncate">{lead.company_name || "Individual"}</p>
                      {lead.email && <p className="flex gap-1.5 text-xs text-muted-foreground truncate"><Mail className="size-3 shrink-0 mt-0.5" />{lead.email}</p>}
                      {lead.phone && <p className="flex gap-1.5 mt-1 text-xs text-muted-foreground"><Phone className="size-3 shrink-0 mt-0.5" />{lead.phone}</p>}

                      <div className="mt-3 pt-3 border-t flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600 shrink-0">{currency.symbol}{Number(lead.estimated_value).toLocaleString()}</span>
                        <select
                          value={lead.status}
                          onChange={(e) => void moveLead(lead, e.target.value as CrmLead["status"])}
                          className="min-w-0 flex-1 bg-transparent text-xs border-none focus:outline-none"
                        >
                          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      {/* ── Call Disposition & Notes Badge Block ── */}
                      {lead.call_disposition && (
                        <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[10px] text-indigo-700 dark:text-indigo-300">
                          <PhoneForwarded className="size-3 shrink-0 text-indigo-600" />
                          <span className="font-bold truncate">{lead.call_disposition}</span>
                          {lead.call_duration_minutes ? (
                            <span className="text-muted-foreground ml-auto shrink-0 font-mono">
                              {lead.call_duration_minutes}m
                            </span>
                          ) : null}
                        </div>
                      )}

                      {lead.customer_response && (
                        <div className="mt-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50 text-[10px] text-foreground italic line-clamp-2">
                          "{lead.customer_response}"
                        </div>
                      )}

                      {lead.notes && !lead.customer_response && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground line-clamp-1">
                          <FileText className="size-3 shrink-0 text-indigo-500" />
                          <span className="truncate">{lead.notes}</span>
                        </div>
                      )}

                      {/* ── Call Status Differentiation Block ── */}
                      {(() => {
                        const callLog = callStatusMap[lead.id];
                        const hasPhone = !!lead.phone;
                        const wasCalled = !!callLog;
                        const callDate = wasCalled ? new Date(callLog.created_at) : null;
                        const daysSinceCall = callDate
                          ? Math.floor((Date.now() - callDate.getTime()) / (1000 * 60 * 60 * 24))
                          : null;
                        const needsFollowUp = wasCalled && daysSinceCall !== null && daysSinceCall >= 2;

                        if (!hasPhone) {
                          return (
                            <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-muted/30 text-[10px] text-muted-foreground">
                              <PhoneOff className="size-3 shrink-0" />
                              <span>No phone — cannot call</span>
                            </div>
                          );
                        }

                        if (wasCalled && !needsFollowUp) {
                          // Recently called — green badge + re-call option
                          return (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="size-3 shrink-0" />
                                <span className="font-semibold">Called</span>
                                <span className="opacity-70">·</span>
                                <span className="opacity-70">
                                  {daysSinceCall === 0 ? "Today" : `${daysSinceCall}d ago`}
                                  {callLog.sentiment && ` · ${callLog.sentiment}`}
                                </span>
                              </div>
                              <button
                                onClick={() => openCallModal(lead)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                              >
                                <PhoneCall className="size-3" />
                                Call Again
                              </button>
                            </div>
                          );
                        }

                        if (wasCalled && needsFollowUp) {
                          // Follow-up overdue — amber pulsing badge
                          return (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-700 dark:text-amber-400 animate-pulse">
                                <Clock className="size-3 shrink-0" />
                                <span className="font-bold">Follow-up Needed</span>
                                <span className="opacity-70">· {daysSinceCall}d ago</span>
                              </div>
                              <button
                                onClick={() => openCallModal(lead)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                              >
                                <PhoneCall className="size-3" />
                                Call Now
                              </button>
                            </div>
                          );
                        }

                        // Never called — primary indigo CTA
                        return (
                          <button
                            onClick={() => openCallModal(lead)}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                          >
                            <PhoneCall className="size-3" />
                            Start AI Call
                          </button>
                        );
                      })()}

                      {/* Log Call & Notes Button */}
                      <button
                        onClick={() => setNotesTargetLead(lead)}
                        className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border border-border/80 bg-background hover:bg-muted text-foreground transition-colors"
                      >
                        <ClipboardList className="size-3.5 text-indigo-600" />
                        Log Call & Notes
                      </button>

                      {lead.next_follow_up_at && (
                        <p className="mt-1.5 flex gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="size-3" /> Follow up {new Date(lead.next_follow_up_at).toLocaleDateString()}
                        </p>
                      )}
                    </motion.article>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-background/50">
                      <AlertCircle className="size-5 opacity-30" />
                      <p className="text-xs">No leads</p>
                    </div>
                  )}
                </div>
                {stage !== "Lost" && (
                  <button onClick={() => setShowForm(true)} className="border-t p-3 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 bg-background/30 hover:bg-background/50 transition-colors">
                    <Plus className="size-3" /> Add lead
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Universal AI Voice Studio & Dialer Modal ────────────────────────────────────── */}
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

      {/* Facebook Settings Modal */}
      <AnimatePresence>
        {showFbSettings && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-5 border-b flex justify-between items-center bg-muted/10">
                <div className="flex items-center gap-2">
                  <Facebook className="size-5 text-blue-600" />
                  <h3 className="font-bold">Facebook Lead Ads Settings</h3>
                </div>
                <button onClick={() => setShowFbSettings(false)}><X className="size-4" /></button>
              </div>
              <form onSubmit={saveFbCredentials} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                    <span>Facebook Page ID <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span></span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Page ID (Auto-resolved if left empty)"
                    value={fbForm.page_or_form_id}
                    onChange={(e) => setFbForm({ ...fbForm, page_or_form_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">If left blank, the system automatically fetches your Page ID and Name from the token.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Page Access Token</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                      required type="password" placeholder="EAA..."
                      value={fbForm.access_token}
                      onChange={(e) => setFbForm({ ...fbForm, access_token: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">API Version</label>
                  <select value={fbForm.api_version} onChange={(e) => setFbForm({ ...fbForm, api_version: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="v25.0">v25.0 (Latest)</option>
                    <option value="v24.0">v24.0</option>
                  </select>
                </div>
                <div className="pt-3 border-t flex justify-between">
                  {fbConfigured && (
                    <button type="button" onClick={deleteFbCredentials} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-semibold">
                      <Trash2 className="size-3.5" /> Disconnect
                    </button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button type="button" onClick={() => setShowFbSettings(false)} className="px-3 py-2 text-sm hover:underline">Cancel</button>
                    <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground font-semibold">Save</button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Ad Attribution Drawer ───────────────────────────────────── */}
      <AnimatePresence>
        {attrLead && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: 20 }}
              className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-5 border-b flex justify-between items-center bg-gradient-to-r from-blue-500/10 to-violet-500/10">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Target className="size-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Ad Attribution</h3>
                    <p className="text-xs text-muted-foreground">{attrLead.name}</p>
                  </div>
                </div>
                <button onClick={() => { setAttrLead(null); setAttribution(null); }}><X className="size-4" /></button>
              </div>

              <div className="p-5 space-y-3">
                {loadingAttr ? (
                  <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Resolving ad data...
                  </div>
                ) : attribution ? (
                  <>
                    {/* Ad Account */}
                    {attribution.ad_account_id && (
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 flex gap-3">
                        <Briefcase className="size-4 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Ad Account</p>
                          <p className="text-sm font-semibold">{attribution.ad_account_name || attribution.ad_account_id}</p>
                          <p className="text-xs text-muted-foreground font-mono">{attribution.ad_account_id}</p>
                        </div>
                      </div>
                    )}

                    {/* Campaign */}
                    {attribution.campaign ? (
                      <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 flex gap-3">
                        <Megaphone className="size-4 text-violet-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Campaign</p>
                          <p className="text-sm font-semibold truncate">{attribution.campaign.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{attribution.campaign_id}</p>
                          <span className="text-[10px] mt-1 inline-block px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 border border-violet-500/20">{attribution.campaign.status}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-muted/20 p-3 flex gap-3">
                        <Megaphone className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign</p>
                          <p className="text-xs text-muted-foreground">No local mirror — {attribution.campaign_id ? "ad was created outside this app" : "not available"}</p>
                          {attribution.campaign_id && <p className="text-xs text-muted-foreground font-mono">{attribution.campaign_id}</p>}
                        </div>
                      </div>
                    )}

                    {/* Ad Set */}
                    {attribution.adset ? (
                      <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 flex gap-3">
                        <Layers className="size-4 text-indigo-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Ad Set</p>
                          <p className="text-sm font-semibold">{attribution.adset.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{attribution.adset_id}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-muted/20 p-3 flex gap-3">
                        <Layers className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ad Set</p>
                          <p className="text-xs text-muted-foreground">{attribution.adset_id ? "Created outside this app" : "Not available"}</p>
                          {attribution.adset_id && <p className="text-xs text-muted-foreground font-mono">{attribution.adset_id}</p>}
                        </div>
                      </div>
                    )}

                    {/* Ad */}
                    {attribution.ad ? (
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 flex gap-3">
                        <Target className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Ad</p>
                          <p className="text-sm font-semibold">{attribution.ad.headline || attribution.ad.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{attribution.ad_id}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border bg-muted/20 p-3 flex gap-3">
                        <Target className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ad</p>
                          <p className="text-xs text-muted-foreground">{attribution.ad_id ? "Created outside this app" : "Not available"}</p>
                          {attribution.ad_id && <p className="text-xs text-muted-foreground font-mono">{attribution.ad_id}</p>}
                        </div>
                      </div>
                    )}

                    {/* Form */}
                    {attribution.form_id && (
                      <div className="rounded-lg border border-border bg-muted/20 p-3 flex gap-3">
                        <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lead Form</p>
                          <p className="text-sm font-semibold">{attribution.form_name || attribution.form_id}</p>
                          <p className="text-xs text-muted-foreground font-mono">{attribution.form_id}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notes & Call Disposition Modal */}
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
          onSaveSuccess={(updated) => {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === notesTargetLead.id
                  ? {
                      ...l,
                      ...(updated.status ? { status: updated.status as CrmLead["status"] } : {}),
                      notes: updated.notes !== undefined ? updated.notes : l.notes,
                      call_disposition: updated.call_disposition !== undefined ? updated.call_disposition : l.call_disposition,
                      call_duration_minutes: updated.call_duration_minutes !== undefined ? updated.call_duration_minutes : l.call_duration_minutes,
                      customer_response: updated.customer_response !== undefined ? updated.customer_response : l.customer_response,
                      next_follow_up_at: updated.next_follow_up_at !== undefined ? updated.next_follow_up_at : l.next_follow_up_at,
                    }
                  : l
              )
            );
          }}
        />
      )}
    </div>
  );
}
