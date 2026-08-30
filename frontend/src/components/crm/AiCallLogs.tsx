import React, { useState, useEffect, useMemo } from "react";
import {
  PhoneCall, Phone, Search, Filter, Sparkles, Calendar, Clock, User,
  Building, TrendingUp, Award, CheckCircle2, AlertCircle, FileText,
  Play, RotateCcw, Bot, RefreshCw, Plus, BarChart3, Flame,
  ArrowUpRight, Headphones, Check, Download, Layers, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CRMCallLog, CRMCallStats, crmCallsApi } from "@/lib/api-client";
import { CallTranscriptModal } from "./CallTranscriptModal";
import { AiCallingModal } from "./AiCallingModal";
import { toast } from "sonner";

export const AiCallLogs: React.FC = () => {
  const [logs, setLogs] = useState<CRMCallLog[]>([]);
  const [stats, setStats] = useState<CRMCallStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTargetType, setSelectedTargetType] = useState<string>("all");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Modals state
  const [selectedLogForTranscript, setSelectedLogForTranscript] = useState<CRMCallLog | null>(null);
  const [transcriptModalOpen, setTranscriptModalOpen] = useState<boolean>(false);
  const [callingModalOpen, setCallingModalOpen] = useState<boolean>(false);
  const [activeCallTarget, setActiveCallTarget] = useState<{
    targetType: "lead" | "customer" | "ticket";
    targetId: string;
    contactName: string;
    contactPhone?: string;
    companyName?: string;
    contextNotes?: string;
  } | null>(null);

  // Compute ISO date range for query
  const { startDateISO, endDateISO } = useMemo(() => {
    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { startDateISO: start.toISOString(), endDateISO: undefined };
    }
    if (dateFilter === "yesterday") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      return { startDateISO: start.toISOString(), endDateISO: end.toISOString() };
    }
    if (dateFilter === "7days") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDateISO: start.toISOString(), endDateISO: undefined };
    }
    if (dateFilter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { startDateISO: start.toISOString(), endDateISO: undefined };
    }
    if (dateFilter === "custom" && (customStartDate || customEndDate)) {
      return {
        startDateISO: customStartDate ? `${customStartDate}T00:00:00Z` : undefined,
        endDateISO: customEndDate ? `${customEndDate}T23:59:59Z` : undefined,
      };
    }
    return { startDateISO: undefined, endDateISO: undefined };
  }, [dateFilter, customStartDate, customEndDate]);

  const fetchLogsAndStats = async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        crmCallsApi.listLogs(
          1,
          200,
          selectedTargetType !== "all" ? selectedTargetType : undefined,
          undefined,
          searchQuery.trim() || undefined,
          selectedSentiment !== "all" ? selectedSentiment : undefined,
          selectedStatus !== "all" ? selectedStatus : undefined,
          undefined,
          startDateISO,
          endDateISO
        ),
        crmCallsApi.getStats().catch(() => null),
      ]);

      const items = (logsRes && (logsRes.items || (logsRes as any).data)) || [];
      setLogs(items);

      if (statsRes) {
        setStats(statsRes);
      }
    } catch (err: any) {
      console.error("Failed to load AI call logs:", err);
      toast.error("Failed to load call logs from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndStats();
  }, [selectedTargetType, selectedSentiment, selectedStatus, dateFilter, customStartDate, customEndDate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogsAndStats();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenTranscript = (log: CRMCallLog) => {
    setSelectedLogForTranscript(log);
    setTranscriptModalOpen(true);
  };

  const handleCallAgain = (log: CRMCallLog) => {
    setActiveCallTarget({
      targetType: (log.target_type as any) || "lead",
      targetId: log.target_id || `call_${Date.now()}`,
      contactName: log.contact_name,
      contactPhone: log.contact_phone || undefined,
      companyName: log.company_name || undefined,
      contextNotes: `Follow-up call. Previous summary: ${log.ai_summary || "None"}`,
    });
    setCallingModalOpen(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const handleExportCsv = () => {
    const exportUrl = crmCallsApi.exportCsvUrl({
      target_type: selectedTargetType !== "all" ? selectedTargetType : undefined,
      sentiment: selectedSentiment !== "all" ? selectedSentiment : undefined,
      status: selectedStatus !== "all" ? selectedStatus : undefined,
      start_date: startDateISO,
      end_date: endDateISO,
      search: searchQuery.trim() || undefined,
    });
    window.open(exportUrl, "_blank");
    toast.success("Exporting calls to CSV...");
  };

  const getSentimentPill = (sentiment?: string) => {
    const s = sentiment?.toLowerCase() || "";
    if (s.includes("positive") || s.includes("interested")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {sentiment || "Positive"}
        </span>
      );
    }
    if (s.includes("neutral") || s.includes("curious")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30">
          <span className="size-1.5 rounded-full bg-blue-500" />
          {sentiment || "Neutral"}
        </span>
      );
    }
    if (s.includes("objection") || s.includes("hesitant")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
          <span className="size-1.5 rounded-full bg-amber-500" />
          {sentiment || "Hesitant"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
        <span className="size-1.5 rounded-full bg-rose-500" />
        {sentiment || "Negative"}
      </span>
    );
  };

  // Derived metrics from logs if stats not provided
  const totalCalls = stats?.total_calls ?? logs.length;
  const avgDur = stats?.avg_duration_seconds ?? (logs.length > 0 ? Math.round(logs.reduce((acc, l) => acc + (l.duration_seconds || 0), 0) / logs.length) : 0);
  const positiveRate = stats?.positive_sentiment_rate ?? (logs.length > 0 ? Math.round((logs.filter((l) => l.sentiment?.toLowerCase().includes("positive")).length / logs.length) * 100) : 0);
  const avgScore = stats?.avg_qualification_score ?? (logs.length > 0 ? Math.round(logs.reduce((acc, l) => acc + (l.qualification_score || 70), 0) / logs.length) : 0);

  return (
    <div className="space-y-6 animate-fade-in p-2">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Headphones className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                Communication & AI Voice Logs
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                  {logs.length} Total Calls
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Full communication analytics, voice transcripts, qualification scores & CSV export.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* CSV Export */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-colors shadow-xs"
            title="Export filtered call logs to CSV spreadsheet"
          >
            <Download className="size-3.5 text-primary" />
            Export CSV
          </button>

          <button
            onClick={fetchLogsAndStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted/60 text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => {
              setActiveCallTarget({
                targetType: "lead",
                targetId: `manual_${Date.now()}`,
                contactName: "Direct Dial",
                companyName: "Enterprise Opportunity",
              });
              setCallingModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md transition-all duration-200"
          >
            <PhoneCall className="size-4" />
            Start AI Call
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover:border-indigo-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Calls Logged
            </span>
            <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Phone className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {totalCalls}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="size-3" /> Live DB Data
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover:border-emerald-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Avg Duration
            </span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {formatDuration(avgDur)}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              Per Consultation
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover:border-purple-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Positive Sentiment
            </span>
            <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Flame className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {positiveRate}%
            </span>
            <span className="text-[11px] font-semibold text-purple-600">
              Interest Rate
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Avg AI Score
            </span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Award className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {avgScore}/100
            </span>
            <span className="text-[11px] font-semibold text-emerald-600">
              Qualification Score
            </span>
          </div>
        </motion.div>
      </div>

      {/* Comprehensive Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-2.5 p-3 rounded-2xl bg-card border border-border shadow-xs">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contact, company, summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 h-8 rounded-xl bg-background border border-border text-xs focus:outline-none"
          />
        </div>

        {/* Target Type Filter */}
        <div>
          <select
            value={selectedTargetType}
            onChange={(e) => setSelectedTargetType(e.target.value)}
            className="w-full h-8 px-2.5 rounded-xl bg-background border border-border text-xs font-medium focus:outline-none"
          >
            <option value="all">🎯 All Contact Types</option>
            <option value="lead">Leads</option>
            <option value="customer">Customers</option>
            <option value="opportunity">Opportunities</option>
            <option value="ticket">Support Tickets</option>
          </select>
        </div>

        {/* Call Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full h-8 px-2.5 rounded-xl bg-background border border-border text-xs font-medium focus:outline-none"
          >
            <option value="all">📞 All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="No Answer">No Answer</option>
            <option value="Busy">Busy</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full h-8 px-2.5 rounded-xl bg-background border border-border text-xs font-medium focus:outline-none"
          >
            <option value="all">📅 All Time</option>
            <option value="today">Today's Calls</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Date Range...</option>
          </select>
        </div>

        {/* Sentiment Filter */}
        <div>
          <select
            value={selectedSentiment}
            onChange={(e) => setSelectedSentiment(e.target.value)}
            className="w-full h-8 px-2.5 rounded-xl bg-background border border-border text-xs font-medium focus:outline-none"
          >
            <option value="all">✨ All Sentiments</option>
            <option value="Positive">Positive & Interested</option>
            <option value="Neutral">Neutral / Inquiry</option>
            <option value="Objection">Objections / Hesitant</option>
            <option value="Negative">Negative / Not Interested</option>
          </select>
        </div>

        {/* Custom date range inputs */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-1 md:col-span-4 lg:col-span-5">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 px-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 px-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Call Logs Table */}
      <div className="rounded-2xl bg-card border border-border shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="size-8 animate-spin text-primary" />
            <p className="text-xs font-semibold">Loading call records from database...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground space-y-3">
            <PhoneCall className="size-12 mx-auto text-muted-foreground/30" />
            <p className="text-base font-bold text-foreground">No call logs found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No calls match the selected filters. Use the AI Dialer on any Lead or Customer to execute calls and log real-time data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Contact / Target</th>
                  <th className="px-4 py-3.5">Status & Time</th>
                  <th className="px-4 py-3.5">Duration</th>
                  <th className="px-4 py-3.5">Sentiment & Score</th>
                  <th className="px-4 py-3.5 min-w-[240px]">AI Summary & Key Takeaways</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr
                    key={log.id || (log as any).call_id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleOpenTranscript(log)}
                  >
                    {/* Contact details */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                          {log.contact_name ? log.contact_name.charAt(0).toUpperCase() : "C"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground hover:underline">
                              {log.contact_name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                              {log.target_type}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            {log.company_name && (
                              <span className="flex items-center gap-1 truncate">
                                <Building className="size-3" /> {log.company_name}
                              </span>
                            )}
                            {log.contact_phone && (
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="size-3" /> {log.contact_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status & Date */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : log.status === "In Progress"
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          }`}
                        >
                          {log.status === "Completed" ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <Clock className="size-3" />
                          )}
                          {log.status}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold">
                      {formatDuration(log.duration_seconds || 0)}
                    </td>

                    {/* Sentiment & Score */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {getSentimentPill(log.sentiment || undefined)}
                        {log.qualification_score != null && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted border">
                            {log.qualification_score}/100
                          </span>
                        )}
                      </div>
                    </td>

                    {/* AI Summary */}
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                        {log.ai_summary || "Call completed. Click to view live transcript."}
                      </p>
                      {log.action_items && log.action_items.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                          <Check className="size-3" />
                          <span>{log.action_items[0]}</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenTranscript(log)}
                        className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors"
                      >
                        Transcript
                      </button>
                      <button
                        onClick={() => handleCallAgain(log)}
                        disabled={!log.contact_phone}
                        className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 transition-colors disabled:opacity-40"
                        title="Re-dial"
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transcript Modal */}
      {selectedLogForTranscript && (
        <CallTranscriptModal
          isOpen={transcriptModalOpen}
          onClose={() => setTranscriptModalOpen(false)}
          callLog={selectedLogForTranscript}
        />
      )}

      {/* AI Voice Dialing Modal */}
      {activeCallTarget && (
        <AiCallingModal
          open={callingModalOpen}
          onClose={() => setCallingModalOpen(false)}
          targetType={activeCallTarget.targetType}
          targetId={activeCallTarget.targetId}
          contactName={activeCallTarget.contactName}
          contactPhone={activeCallTarget.contactPhone}
          companyName={activeCallTarget.companyName}
          defaultNotes={activeCallTarget.contextNotes}
          onCallCompleted={async () => {
            await fetchLogsAndStats();
          }}
        />
      )}
    </div>
  );
};
