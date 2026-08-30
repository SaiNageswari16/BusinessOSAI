import { toast } from "sonner";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Download, PieChart, TrendingUp, DollarSign, Target, Percent,
  PhoneCall, Calendar, Clock, User, ArrowUpRight, CheckCircle2,
  PhoneForwarded, FileText, Layers, Award, BarChart3, ChevronRight,
  ShieldCheck, Sparkles
} from "lucide-react";

import {
  crmOpportunitiesApi, crmLeadsApi, crmCallsApi,
  type CrmOpportunity, type SalesExecutive, type CRMCallLog
} from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { AiCallingModal } from "./AiCallingModal";
import { NotesAndDispositionModal } from "./NotesAndDispositionModal";

interface Props {
  tab?: string;
}

const FUNNEL_STAGES = [
  { name: "Prospecting", color: "from-blue-600 to-indigo-600", bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-600 dark:text-blue-400" },
  { name: "Qualification", color: "from-indigo-600 to-violet-600", bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-600 dark:text-indigo-400" },
  { name: "Needs Analysis", color: "from-violet-600 to-purple-600", bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-600 dark:text-violet-400" },
  { name: "Value Proposition", color: "from-purple-600 to-pink-600", bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-600 dark:text-purple-400" },
  { name: "Negotiation", color: "from-amber-600 to-orange-600", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600 dark:text-amber-400" },
  { name: "Closed Won", color: "from-emerald-600 to-teal-600", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400" },
];

export function SalesPipeline({ tab = "kanban" }: Props) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  const [deals, setDeals] = useState<CrmOpportunity[]>([]);
  const [executives, setExecutives] = useState<SalesExecutive[]>([]);
  const [recentCalls, setRecentCalls] = useState<CRMCallLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [callingDeal, setCallingDeal] = useState<CrmOpportunity | null>(null);
  const [notesTargetDeal, setNotesTargetDeal] = useState<CrmOpportunity | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dealsRes, execsRes, callsRes] = await Promise.all([
        crmOpportunitiesApi.list(),
        crmLeadsApi.listSalesExecutives().catch(() => []),
        crmCallsApi.listLogs(1, 10, undefined, undefined, undefined, undefined, undefined).catch(() => ({ items: [], total: 0 })),
      ]);
      setDeals(dealsRes || []);
      setExecutives(execsRes || []);
      setRecentCalls((callsRes as any)?.items || (callsRes as any)?.data || []);
    } catch (err) {
      console.error("Failed to fetch pipeline analytics:", err);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllData();
  }, [tenant?.id]);

  // Calculations
  const activeDeals = deals.filter((d) => d.stage !== "Closed Lost");
  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const expectedRevenue = activeDeals.reduce(
    (sum, d) => sum + Number(d.amount || 0) * (Number(d.probability || 0) / 100),
    0
  );
  const closedDeals = deals.filter((d) => d.stage === "Closed Won" || d.stage === "Closed Lost");
  const wonDeals = deals.filter((d) => d.stage === "Closed Won");
  const wonTotal = wonDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const winRate = closedDeals.length > 0 ? (wonDeals.length / closedDeals.length) * 100 : (deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0);

  // Upcoming scheduled followups across all deals
  const upcomingFollowups = deals
    .filter((d) => d.next_step_at || d.next_step)
    .sort((a, b) => {
      if (!a.next_step_at) return 1;
      if (!b.next_step_at) return -1;
      return new Date(a.next_step_at).getTime() - new Date(b.next_step_at).getTime();
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Sales Pipeline & Follow-up Analytics</h2>
          <p className="text-xs text-muted-foreground">
            Stage-by-stage conversion funnel, revenue forecasting, caller metrics, and scheduled follow-ups.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const url = crmOpportunitiesApi.exportCsvUrl();
              window.open(url, "_blank");
            }}
            className="flex items-center gap-1.5 px-3.5 h-8 bg-muted/60 hover:bg-muted border border-border rounded-xl text-xs font-semibold text-foreground transition-colors shadow-xs"
          >
            <Download className="size-3.5 text-emerald-600" /> Export CSV Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-xs">Loading sales pipeline analytics from database...</div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Pipeline</p>
                <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <DollarSign className="size-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-foreground mt-2">
                {currency.symbol}{Math.round(totalPipelineValue).toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Layers className="size-3 text-primary" /> Across {activeDeals.length} active opportunities
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Weighted Forecast</p>
                <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-foreground mt-2">
                {currency.symbol}{Math.round(expectedRevenue).toLocaleString()}
              </h3>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                Weighted by deal probability %
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Win Rate</p>
                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <Target className="size-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {winRate.toFixed(1)}%
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {wonDeals.length} Won · {currency.symbol}{Math.round(wonTotal).toLocaleString()}
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sales Staff</p>
                <div className="size-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                  <User className="size-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-foreground mt-2">
                {executives.length || 1} Active Reps
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Managing {deals.length} total deals
              </p>
            </div>
          </div>

          {/* Conversion Funnel Section */}
          <div className="p-6 rounded-2xl border border-border/80 bg-card shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <PieChart className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Multi-Stage Conversion Funnel</h3>
                  <p className="text-xs text-muted-foreground">
                    Live deal counts and total contract value by pipeline stage
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground px-2.5 py-1 rounded-lg bg-muted">
                Total Pipeline Deals: {deals.length}
              </span>
            </div>

            {/* Visual Stage Funnel Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FUNNEL_STAGES.map((stage, idx) => {
                const stageDeals = deals.filter((d) => d.stage === stage.name);
                const stageValue = stageDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
                const stageCalls = stageDeals.reduce((sum, d) => sum + Number(d.calls_count || 0), 0);
                const pctOfTotal = totalPipelineValue > 0 ? (stageValue / totalPipelineValue) * 100 : 0;

                return (
                  <motion.div
                    key={stage.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`p-4 rounded-2xl border ${stage.border} ${stage.bg} flex flex-col justify-between space-y-3 relative overflow-hidden group hover:shadow-md transition-all`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-6 rounded-full bg-background border border-border flex items-center justify-center text-[11px] font-bold text-foreground">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-sm text-foreground">{stage.name}</h4>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-background/80 border ${stage.border} ${stage.text}`}>
                        {stageDeals.length} {stageDeals.length === 1 ? "Deal" : "Deals"}
                      </span>
                    </div>

                    <div>
                      <p className="text-xl font-black text-foreground">
                        {currency.symbol}{Math.round(stageValue).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {pctOfTotal.toFixed(1)}% of total pipeline
                      </p>
                    </div>

                    <div className="w-full bg-background/60 h-2 rounded-full overflow-hidden border border-border/40">
                      <div
                        className={`h-full bg-gradient-to-r ${stage.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(Math.max(pctOfTotal, stageDeals.length > 0 ? 10 : 0), 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                      <span className="flex items-center gap-1 font-medium">
                        <PhoneCall className="size-3 text-indigo-500" />
                        {stageCalls} Calls Done
                      </span>
                      <span className="font-semibold text-foreground">
                        Avg Prob: {stageDeals.length > 0 ? Math.round(stageDeals.reduce((s, d) => s + (d.probability || 0), 0) / stageDeals.length) : 0}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Follow-ups & Activity Logs Dual Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Deal Follow-ups */}
            <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-foreground">Scheduled Deal Follow-ups</h3>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {upcomingFollowups.length} Pending Actions
                </span>
              </div>

              {upcomingFollowups.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No upcoming follow-ups scheduled. Click "Log Call / Followup Notes" on any deal card to schedule.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingFollowups.map((deal) => (
                    <div
                      key={deal.id}
                      className="p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="font-bold text-xs text-foreground truncate">{deal.name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Target className="size-3 text-primary" /> {deal.customer_name || (deal as any).customer_name || "Linked Account"}
                          <span className="mx-1">·</span>
                          <span className="font-semibold text-emerald-600">{currency.symbol}{Number(deal.amount || 0).toLocaleString()}</span>
                        </p>
                        {deal.next_step && (
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">
                            👉 {deal.next_step}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        {deal.next_step_at ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                            📅 {new Date(deal.next_step_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        ) : null}
                        <button
                          onClick={() => setCallingDeal(deal)}
                          className="mt-1.5 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-[10px] font-bold transition ml-auto"
                        >
                          <PhoneCall className="size-3" /> Call Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales Executive Performance & Call Leaderboard */}
            <div className="p-5 rounded-2xl border border-border/80 bg-card shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Award className="size-4 text-amber-600" />
                  <h3 className="font-bold text-sm text-foreground">Sales Staff Activity & Calls</h3>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {executives.length} Team Members
                </span>
              </div>

              {executives.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No sales staff records found.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {executives.map((exec) => {
                    const execDeals = deals.filter((d) => d.owner_user_id === exec.id);
                    const execPipelineVal = execDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);

                    return (
                      <div
                        key={exec.id}
                        className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {exec.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-foreground">{exec.name}</p>
                            <p className="text-[10px] text-muted-foreground">{exec.role_name || "Sales Executive"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="text-xs font-bold text-foreground">{currency.symbol}{Math.round(execPipelineVal).toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground">{execDeals.length} Deals</p>
                          </div>
                          <div className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1">
                            <PhoneCall className="size-3" />
                            {exec.total_calls_count || 0} Calls
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* AI Voice Calling Modal */}
      {callingDeal && (
        <AiCallingModal
          open={!!callingDeal}
          onClose={() => setCallingDeal(null)}
          targetType="deal"
          targetId={callingDeal.id}
          contactName={(callingDeal as any).customer_name || callingDeal.name}
          contactPhone={(callingDeal as any).contact_phone || undefined}
          contactEmail={(callingDeal as any).contact_email || undefined}
          companyName={(callingDeal as any).company_name || undefined}
          dealValue={callingDeal.amount}
          defaultNotes={`Deal: ${callingDeal.name}, Current Stage: ${callingDeal.stage}, Value: ${callingDeal.amount}`}
          onCallCompleted={async () => {
            await loadAllData();
          }}
        />
      )}
    </div>
  );
}
