import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Filter, MoreHorizontal, Target, Calendar, User, PhoneCall,
  ClipboardList, FileText, PhoneForwarded, Download, TrendingUp, CheckCircle2,
  DollarSign, BarChart3
} from "lucide-react";

import { crmOpportunitiesApi, crmLeadsApi, type CrmOpportunity, type SalesExecutive } from "@/lib/api-client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/tenant-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/hooks/use-currency";
import { AiCallingModal } from "./AiCallingModal";
import { NotesAndDispositionModal } from "./NotesAndDispositionModal";

interface Props {
  tab?: string;
}

const STAGES = [
  "Prospecting",
  "Qualification",
  "Needs Analysis",
  "Value Proposition",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

export function Deals({ tab = "all_deals" }: Props) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [executives, setExecutives] = useState<SalesExecutive[]>([]);
  const [deals, setDeals] = useState<CrmOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [callingDeal, setCallingDeal] = useState<CrmOpportunity | null>(null);
  const [notesTargetDeal, setNotesTargetDeal] = useState<CrmOpportunity | null>(null);
  const [newDeal, setNewDeal] = useState({ name: "", customer_name: "", amount: 0, probability: 50, stage: "Prospecting" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const res = await crmOpportunitiesApi.list({
        search: searchTerm || undefined,
        stage: stageFilter !== "all" ? stageFilter : undefined,
        assigned_to: assignedFilter !== "all" ? assignedFilter : undefined,
      });
      setDeals(res || []);
    } catch (err) {
      console.error("Failed to fetch deals:", err);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutives = async () => {
    try {
      const execs = await crmLeadsApi.listSalesExecutives();
      setExecutives(execs || []);
    } catch {
      // non-manager fallback
      setExecutives([]);
    }
  };

  useEffect(() => {
    void loadExecutives();
  }, [tenant?.id]);

  useEffect(() => {
    void fetchDeals();
  }, [tenant?.id, stageFilter, assignedFilter]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await crmOpportunitiesApi.create(newDeal);
      toast.success("Deal created successfully!");
      setIsAddModalOpen(false);
      setNewDeal({ name: "", customer_name: "", amount: 0, probability: 50, stage: "Prospecting" });
      void fetchDeals();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create deal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveDeal = async (id: string, stage: string) => {
    try {
      await crmOpportunitiesApi.update(id, { stage });
      setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
      toast.success(`Deal stage updated to ${stage}`);
    } catch {
      toast.error("Failed to update deal stage");
    }
  };

  const getDealsByStage = (stage: string) => {
    return deals.filter(
      (d) =>
        d.stage === stage &&
        (d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ((d as any).customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const totalPipeline = deals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const weightedPipeline = deals.reduce((sum, d) => sum + (Number(d.amount || 0) * (Number(d.probability || 0) / 100)), 0);
  const wonDeals = deals.filter((d) => d.stage === "Closed Won");
  const wonTotal = wonDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  return (
    <div className="p-4 h-[calc(100vh-6rem)] flex flex-col space-y-3">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Deals & Opportunities Pipeline</h2>
          <p className="text-xs text-muted-foreground">
            Multi-stage deal flow, probability forecasts, and active negotiations synced with database.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search deals or accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 pl-8 pr-3 h-8 bg-background border border-border rounded-xl text-xs focus:outline-none"
            />
          </div>

          {/* Assigned Executive Filter */}
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="h-8 px-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none"
          >
            <option value="all">👤 All Reps</option>
            <option value="me">⭐ My Deals</option>
            {executives.map((exec) => (
              <option key={exec.id} value={exec.id}>
                👤 {exec.name}
              </option>
            ))}
          </select>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-8 px-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none"
          >
            <option value="all">🎯 All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Export Deals CSV */}
          <button
            onClick={() => {
              const url = crmOpportunitiesApi.exportCsvUrl({
                search: searchTerm || undefined,
                stage: stageFilter,
                assigned_to: assignedFilter,
              });
              window.open(url, "_blank");
            }}
            className="flex items-center gap-1.5 px-3 h-8 bg-muted/60 hover:bg-muted border border-border rounded-xl text-xs font-semibold text-foreground transition-colors"
            title="Export filtered deals to CSV"
          >
            <Download className="size-3.5 text-emerald-600" />
            Export CSV
          </button>

          {/* Add Deal Button & Modal */}
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-95 transition-opacity">
                <Plus className="size-3.5" /> Add Deal
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Deal Opportunity</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Deal Name *</Label>
                  <Input
                    required
                    value={newDeal.name}
                    onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                    placeholder="e.g. Annual Enterprise Subscription"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer / Lead Name</Label>
                  <Input
                    value={newDeal.customer_name}
                    onChange={(e) => setNewDeal({ ...newDeal, customer_name: e.target.value })}
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount ({currency.symbol}) *</Label>
                    <Input
                      required
                      type="number"
                      min="0"
                      value={newDeal.amount}
                      onChange={(e) => setNewDeal({ ...newDeal, amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Probability (%)</Label>
                    <Input
                      required
                      type="number"
                      min="0"
                      max="100"
                      value={newDeal.probability}
                      onChange={(e) => setNewDeal({ ...newDeal, probability: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Initial Stage</Label>
                  <select
                    value={newDeal.stage}
                    onChange={(e) => setNewDeal({ ...newDeal, stage: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <DialogFooter className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 gradient-brand text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isSubmitting ? "Creating Deal..." : "Commit Deal to Pipeline"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Target className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Total Deals</p>
            <p className="text-sm font-bold text-foreground">{deals.length}</p>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <DollarSign className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Pipeline Value</p>
            <p className="text-sm font-bold text-foreground">{currency.symbol}{Math.round(totalPipeline).toLocaleString()}</p>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
          <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <TrendingUp className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Weighted Forecast</p>
            <p className="text-sm font-bold text-foreground">{currency.symbol}{Math.round(weightedPipeline).toLocaleString()}</p>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Closed Won</p>
            <p className="text-sm font-bold text-emerald-600">{currency.symbol}{Math.round(wonTotal).toLocaleString()} ({wonDeals.length})</p>
          </div>
        </div>
      </div>

      {/* Kanban Pipeline Board */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-xs">Loading real deals from database...</div>
      ) : (
        <div className="flex-1 flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
          {STAGES.map((stage) => {
            const stageDeals = getDealsByStage(stage);
            const totalValue = stageDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);

            return (
              <div key={stage} className="flex-shrink-0 w-72 flex flex-col h-full bg-muted/20 border border-border/70 rounded-2xl p-3">
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground text-xs uppercase tracking-wider">{stage}</h3>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-[11px] text-muted-foreground">Total:</span>
                    <span className="font-bold text-primary text-xs">
                      {currency.symbol}{totalValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-muted/60 mt-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        stage === "Closed Won"
                          ? "bg-emerald-500"
                          : stage === "Closed Lost"
                          ? "bg-red-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${deals.length > 0 ? (stageDeals.length / deals.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                  {stageDeals.map((deal) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={deal.id}
                      className="bg-card p-3.5 rounded-xl border border-border shadow-xs hover:shadow-md transition-all space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-foreground text-xs leading-tight pr-2">{deal.name}</h4>
                        <button
                          onClick={() => setCallingDeal(deal)}
                          className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition shrink-0"
                          title="Start AI Call on Deal"
                        >
                          <PhoneCall className="size-3.5" />
                        </button>
                      </div>

                      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                        <Target className="size-3 text-primary" /> {deal.customer_name || (deal as any).customer_name || "Linked Account"}
                      </p>

                      <div className="flex justify-between items-center gap-2 p-1.5 rounded-lg bg-muted/30">
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {currency.symbol}{Number(deal.amount || 0).toLocaleString()}
                        </div>
                        <select
                          value={deal.stage}
                          onChange={(e) => void moveDeal(deal.id, e.target.value)}
                          className="bg-transparent text-[10px] border-none focus:outline-none font-bold text-primary cursor-pointer"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Calls Logged Tracker Badge */}
                      <div className="flex items-center justify-between text-[10px] px-2 py-1 rounded-lg bg-muted/50 border border-border/60">
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <PhoneCall className="size-3 text-indigo-500" />
                          {deal.calls_count || 0} {Number(deal.calls_count) === 1 ? "Call Done" : "Calls Done"}
                        </span>
                        {deal.last_call_status ? (
                          <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                            deal.last_call_status.toLowerCase() === "completed"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : deal.last_call_status.toLowerCase() === "no-answer"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-primary/10 text-primary"
                          }`}>
                            {deal.last_call_status}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No calls yet</span>
                        )}
                      </div>

                      {/* Next Scheduled Follow-up / Action */}
                      {(deal.next_step || deal.next_step_at) && (
                        <div className="px-2 py-1 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-[10px] text-blue-700 dark:text-blue-300">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3 text-blue-500" /> Next Follow-up:
                            </span>
                            {deal.next_step_at && (
                              <span className="font-mono">{new Date(deal.next_step_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            )}
                          </div>
                          {deal.next_step && <p className="truncate mt-0.5 opacity-90">{deal.next_step}</p>}
                        </div>
                      )}

                      {/* Call Disposition & Notes */}
                      {deal.call_disposition && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] text-primary">
                          <PhoneForwarded className="size-3 shrink-0" />
                          <span className="font-bold truncate">{deal.call_disposition}</span>
                          {deal.call_duration_minutes ? (
                            <span className="text-muted-foreground ml-auto shrink-0 font-mono">
                              {deal.call_duration_minutes}m
                            </span>
                          ) : null}
                        </div>
                      )}

                      {deal.customer_response && (
                        <div className="px-2 py-1 rounded-md bg-muted/40 text-[10px] text-foreground italic line-clamp-2">
                          "{deal.customer_response}"
                        </div>
                      )}

                      {deal.notes && !deal.customer_response && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground line-clamp-1">
                          <FileText className="size-3 shrink-0 text-primary" />
                          <span className="truncate">{deal.notes}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {deal.expected_close_date
                            ? new Date(deal.expected_close_date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="size-3" /> {deal.owner_name?.split(" ")[0] || (deal as any).owner_name?.split(" ")[0] || "Executive"}
                        </div>
                      </div>

                      {/* Log Call & Notes Button */}
                      <button
                        onClick={() => setNotesTargetDeal(deal)}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold border border-border bg-background hover:bg-muted text-foreground transition-colors"
                      >
                        <ClipboardList className="size-3 text-primary" />
                        Log Call / Followup Notes
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
            await fetchDeals();
          }}
        />
      )}

      {/* Notes & Call Disposition Modal */}
      {notesTargetDeal && (
        <NotesAndDispositionModal
          isOpen={!!notesTargetDeal}
          onClose={() => setNotesTargetDeal(null)}
          entityType="opportunity"
          entityId={notesTargetDeal.id}
          entityName={notesTargetDeal.name}
          entityCompany={(notesTargetDeal as any).customer_name}
          entityPhone={(notesTargetDeal as any).contact_phone}
          currentStatus={notesTargetDeal.stage}
          availableStatuses={STAGES}
          initialNotes={notesTargetDeal.notes}
          initialDisposition={notesTargetDeal.call_disposition}
          initialMinutes={notesTargetDeal.call_duration_minutes}
          initialResponse={notesTargetDeal.customer_response}
          initialNextFollowup={notesTargetDeal.next_step_at}
          onSaveSuccess={(updated) => {
            setDeals((prev) =>
              prev.map((d) =>
                d.id === notesTargetDeal.id
                  ? {
                      ...d,
                      ...(updated.status ? { stage: updated.status } : {}),
                      notes: updated.notes !== undefined ? updated.notes : d.notes,
                      call_disposition:
                        updated.call_disposition !== undefined
                          ? updated.call_disposition
                          : d.call_disposition,
                      call_duration_minutes:
                        updated.call_duration_minutes !== undefined
                          ? updated.call_duration_minutes
                          : d.call_duration_minutes,
                      customer_response:
                        updated.customer_response !== undefined
                          ? updated.customer_response
                          : d.customer_response,
                    }
                  : d
              )
            );
          }}
        />
      )}
    </div>
  );
}
