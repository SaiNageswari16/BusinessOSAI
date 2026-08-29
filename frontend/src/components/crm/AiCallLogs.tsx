import React, { useState, useEffect, useMemo } from "react";
import {
  PhoneCall,
  Phone,
  Search,
  Filter,
  Sparkles,
  Calendar,
  Clock,
  User,
  Building,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertCircle,
  FileText,
  Play,
  RotateCcw,
  Bot,
  RefreshCw,
  Plus,
  BarChart3,
  Flame,
  ArrowUpRight,
  Headphones,
  Check,
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTargetType, setSelectedTargetType] = useState<string>("all");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("all");

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

  const fetchLogsAndStats = async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        crmCallsApi.listLogs(),
        crmCallsApi.getStats(),
      ]);

      if (logsRes && logsRes.data) {
        setLogs(logsRes.data);
      }
      if (statsRes && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load AI call logs:", err);
      toast.error("Failed to load call logs. Using local records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndStats();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        log.contact_name?.toLowerCase().includes(q) ||
        log.company_name?.toLowerCase().includes(q) ||
        log.contact_phone?.toLowerCase().includes(q) ||
        log.agent_persona?.toLowerCase().includes(q) ||
        log.ai_summary?.toLowerCase().includes(q);

      // Target Type
      const matchesType =
        selectedTargetType === "all" || log.target_type === selectedTargetType;

      // Sentiment
      const matchesSentiment =
        selectedSentiment === "all" ||
        (selectedSentiment === "positive" &&
          (log.sentiment?.toLowerCase().includes("positive") ||
            log.sentiment?.toLowerCase().includes("interested"))) ||
        (selectedSentiment === "neutral" &&
          log.sentiment?.toLowerCase().includes("neutral")) ||
        (selectedSentiment === "hesitant" &&
          (log.sentiment?.toLowerCase().includes("objection") ||
            log.sentiment?.toLowerCase().includes("hesitant"))) ||
        (selectedSentiment === "negative" &&
          (log.sentiment?.toLowerCase().includes("negative") ||
            log.sentiment?.toLowerCase().includes("rejected")));

      return matchesSearch && matchesType && matchesSentiment;
    });
  }, [logs, searchQuery, selectedTargetType, selectedSentiment]);

  const handleOpenTranscript = (log: CRMCallLog) => {
    setSelectedLogForTranscript(log);
    setTranscriptModalOpen(true);
  };

  const handleCallAgain = (log: CRMCallLog) => {
    setActiveCallTarget({
      targetType: (log.target_type as any) || "lead",
      targetId: log.target_id,
      contactName: log.contact_name,
      contactPhone: log.contact_phone,
      companyName: log.company_name,
      contextNotes: `Follow-up call. Previous summary: ${log.ai_summary || "None"}`,
    });
    setCallingModalOpen(true);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Title and Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Headphones className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                AI Voice Agent Logs & Analytics
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                  Live
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Complete history of all automated AI voice interactions, transcripts, qualification scores & key takeaways.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200"
          >
            <PhoneCall className="size-4" />
            Start New AI Call
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total AI Calls
            </span>
            <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Phone className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {stats?.total_calls ?? logs.length}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="size-3" /> +100% automated
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Talk Time
            </span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {Math.round(((stats?.total_duration_seconds ?? 0) / 60) * 10) / 10}m
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              Saved SDR hours
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all"
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
              {stats?.positive_sentiment_rate ?? "85%"}
            </span>
            <span className="text-[11px] font-semibold text-purple-600">
              High interest
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Avg Lead Score
            </span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Award className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-foreground">
              {stats?.avg_qualification_score ?? "82"}/100
            </span>
            <span className="text-[11px] font-semibold text-emerald-600">
              Sales Qualified
            </span>
          </div>
        </motion.div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by contact, company, agent persona, summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-muted/40 border border-border focus:border-indigo-500 focus:outline-none text-xs sm:text-sm text-foreground transition-all"
          />
        </div>

        {/* Target Type Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border">
          {[
            { id: "all", label: "All Contacts" },
            { id: "lead", label: "Leads" },
            { id: "customer", label: "Customers" },
            { id: "ticket", label: "Support" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTargetType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedTargetType === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sentiment Filter Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={selectedSentiment}
            onChange={(e) => setSelectedSentiment(e.target.value)}
            className="px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive & Interested</option>
            <option value="neutral">Neutral / Inquiry</option>
            <option value="hesitant">Hesitant / Objections</option>
            <option value="negative">Negative</option>
          </select>
        </div>
      </div>

      {/* Call Logs Table / List */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="size-8 animate-spin text-indigo-500" />
            <p className="text-sm font-semibold">Loading AI voice logs & intelligence records...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-3">
            <PhoneCall className="size-12 mx-auto text-muted-foreground/40" />
            <p className="text-base font-bold text-foreground">No call logs found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No AI call logs match your current search filters. Initiate a call with leads or customers to see real-time transcripts and metrics.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Contact / Target</th>
                  <th className="px-4 py-3.5">Agent Persona & Mode</th>
                  <th className="px-4 py-3.5">Duration & Time</th>
                  <th className="px-4 py-3.5">Sentiment & Score</th>
                  <th className="px-4 py-3.5 min-w-[240px]">AI Summary & Key Takeaways</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => (
                  <motion.tr
                    key={log.call_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => handleOpenTranscript(log)}
                  >
                    {/* Contact details */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                          {log.contact_name ? log.contact_name.charAt(0).toUpperCase() : "C"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground hover:underline">
                              {log.contact_name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
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
                              <span className="flex items-center gap-1">
                                <Phone className="size-3" /> {log.contact_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Agent & Mode */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Bot className="size-3.5 text-indigo-500" />
                        <span>{log.agent_persona}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {log.call_mode === "livekit_sip" ? "Live SIP VoIP" : "AI Web Voice"}
                      </span>
                    </td>

                    {/* Duration & Time */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 font-semibold text-foreground">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span>{formatDuration(log.duration_seconds)}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>

                    {/* Sentiment & Score */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        {getSentimentPill(log.sentiment)}
                        {log.qualification_score && (
                          <div className="text-[10px] font-bold text-muted-foreground">
                            Score: <span className="text-foreground">{log.qualification_score}/100</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Summary */}
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-foreground/80 line-clamp-2 max-w-md">
                        {log.ai_summary || "Call completed with contact. Transcript recorded."}
                      </p>
                      {log.action_items && log.action_items.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600 font-semibold">
                          <CheckCircle2 className="size-3" />
                          <span>{log.action_items[0]}</span>
                          {log.action_items.length > 1 && (
                            <span className="text-muted-foreground">+{log.action_items.length - 1} more</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleOpenTranscript(log)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/70 text-xs font-semibold text-foreground transition-colors"
                          title="View transcript & audio playback"
                        >
                          <FileText className="size-3.5 text-indigo-500" />
                          <span>Transcript</span>
                        </button>

                        <button
                          onClick={() => handleCallAgain(log)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
                          title="Initiate follow-up call"
                        >
                          <PhoneCall className="size-3.5" />
                          <span className="hidden sm:inline">Call</span>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transcript & Audio Modal */}
      <CallTranscriptModal
        open={transcriptModalOpen}
        onClose={() => setTranscriptModalOpen(false)}
        callLog={selectedLogForTranscript}
        onCallAgain={handleCallAgain}
      />

      {/* Trigger AI Calling Modal */}
      {activeCallTarget && (
        <AiCallingModal
          open={callingModalOpen}
          onClose={() => {
            setCallingModalOpen(false);
            fetchLogsAndStats(); // Refresh logs after call ends
          }}
          targetType={activeCallTarget.targetType}
          targetId={activeCallTarget.targetId}
          contactName={activeCallTarget.contactName}
          contactPhone={activeCallTarget.contactPhone}
          companyName={activeCallTarget.companyName}
          contextNotes={activeCallTarget.contextNotes}
        />
      )}
    </div>
  );
};
