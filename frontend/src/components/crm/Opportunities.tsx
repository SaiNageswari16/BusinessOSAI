import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Rocket, Calendar, Building, Download, PhoneCall,
  ClipboardList, DollarSign, TrendingUp, CheckCircle2, Target
} from "lucide-react";
import { crmOpportunitiesApi, crmLeadsApi, type CrmOpportunity, type SalesExecutive } from "@/lib/api-client";
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

const STAGES = [
  "Prospecting",
  "Qualification",
  "Needs Analysis",
  "Value Proposition",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

export function Opportunities() {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [executives, setExecutives] = useState<SalesExecutive[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [callingOpp, setCallingOpp] = useState<CrmOpportunity | null>(null);
  const [notesTargetOpp, setNotesTargetOpp] = useState<CrmOpportunity | null>(null);
  const [newOpp, setNewOpp] = useState({ name: "", customer_name: "", amount: 0, probability: 50, stage: "Prospecting" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOpps = async () => {
    setLoading(true);
    try {
      const res = await crmOpportunitiesApi.list({
        search: searchTerm || undefined,
        stage: stageFilter !== "all" ? stageFilter : undefined,
        assigned_to: assignedFilter !== "all" ? assignedFilter : undefined,
      });
      setOpportunities(res || []);
    } catch (err) {
      console.error("Failed to fetch opportunities:", err);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutives = async () => {
    try {
      const execs = await crmLeadsApi.listSalesExecutives();
      setExecutives(execs || []);
    } catch {
      setExecutives([]);
    }
  };

  useEffect(() => {
    void loadExecutives();
  }, [tenant?.id]);

  useEffect(() => {
    void fetchOpps();
  }, [tenant?.id, stageFilter, assignedFilter]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await crmOpportunitiesApi.create(newOpp);
      toast.success("Opportunity created successfully!");
      setIsAddModalOpen(false);
      setNewOpp({ name: "", customer_name: "", amount: 0, probability: 50, stage: "Prospecting" });
      void fetchOpps();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create opportunity");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOpps = opportunities.filter((opp) => {
    return (
      opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((opp as any).customer_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalRevenue = opportunities.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const weightedRevenue = opportunities.reduce((sum, o) => sum + (Number(o.amount || 0) * (Number(o.probability || 0) / 100)), 0);
  const wonCount = opportunities.filter((o) => o.stage === "Closed Won").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Opportunities Master Table</h2>
          <p className="text-xs text-muted-foreground">List of all active sales opportunities, expected revenue, and stage progression.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV */}
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
            title="Export opportunities to CSV"
          >
            <Download className="size-3.5 text-emerald-600" />
            Export CSV
          </button>

          {/* Add Opportunity Modal */}
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition-opacity">
                <Plus className="size-3.5" /> Add Opportunity
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Opportunity</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Opportunity Name *</Label>
                  <Input required value={newOpp.name} onChange={(e) => setNewOpp({ ...newOpp, name: e.target.value })} placeholder="e.g. Enterprise License Deal" />
                </div>
                <div className="space-y-2">
                  <Label>Customer / Lead Name</Label>
                  <Input value={newOpp.customer_name} onChange={(e) => setNewOpp({ ...newOpp, customer_name: e.target.value })} placeholder="e.g. Acme Corp" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount ({currency.symbol}) *</Label>
                    <Input required type="number" min="0" value={newOpp.amount} onChange={(e) => setNewOpp({ ...newOpp, amount: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Probability (%)</Label>
                    <Input required type="number" min="0" max="100" value={newOpp.probability} onChange={(e) => setNewOpp({ ...newOpp, probability: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <select value={newOpp.stage} onChange={(e) => setNewOpp({ ...newOpp, stage: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none">
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <DialogFooter className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full px-4 py-2 gradient-brand text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isSubmitting ? "Saving..." : "Commit Opportunity"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Target className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Total Opportunities</p>
            <p className="text-sm font-bold text-foreground">{opportunities.length}</p>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <DollarSign className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Pipeline Value</p>
            <p className="text-sm font-bold text-foreground">{currency.symbol}{Math.round(totalRevenue).toLocaleString()}</p>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
          <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <TrendingUp className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Weighted Value</p>
            <p className="text-sm font-bold text-foreground">{currency.symbol}{Math.round(weightedRevenue).toLocaleString()}</p>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium">Closed Won</p>
            <p className="text-sm font-bold text-emerald-600">{wonCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-card border border-border shadow-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search opportunities or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 h-8 bg-background border border-border rounded-xl text-xs focus:outline-none"
          />
        </div>

        {/* Assigned Executive Filter */}
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          className="h-8 px-2.5 bg-background border border-border rounded-xl text-xs font-medium focus:outline-none"
        >
          <option value="all">👤 All Assigned Reps</option>
          <option value="me">⭐ My Opportunities</option>
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
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-xs">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">Loading sales opportunities from database…</div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] text-muted-foreground bg-muted/40 uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold">Opportunity Name</th>
                  <th className="px-4 py-3 font-semibold">Customer / Account</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold">Probability</th>
                  <th className="px-4 py-3 font-semibold">Calls Logged</th>
                  <th className="px-4 py-3 font-semibold">Next Follow-up</th>
                  <th className="px-4 py-3 font-semibold">Close Date</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOpps.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      No matching opportunities found in database.
                    </td>
                  </tr>
                ) : (
                  filteredOpps.map((opp, i) => (
                    <motion.tr
                      key={opp.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground flex items-center gap-1.5">
                          <Rocket className="size-3.5 text-primary" /> {opp.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{opp.id.slice(0, 8)}...</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Building className="size-3.5 text-muted-foreground" />
                          {opp.customer_name || (opp as any).customer_name || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-muted border border-border text-foreground">
                          {opp.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400 text-right">
                        {currency.symbol}{Number(opp.amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16">
                            <div className="h-full bg-primary" style={{ width: `${opp.probability}%` }} />
                          </div>
                          <span className="text-[11px] font-medium">{opp.probability}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 font-semibold text-foreground text-[11px]">
                            <PhoneCall className="size-3 text-indigo-500" />
                            {opp.calls_count || 0}
                          </span>
                          {opp.last_call_status && (
                            <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                              opp.last_call_status.toLowerCase() === "completed"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-primary/10 text-primary"
                            }`}>
                              {opp.last_call_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-[11px]">
                        {opp.next_step_at ? (
                          <div>
                            <span className="font-semibold text-foreground">
                              {new Date(opp.next_step_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                            {opp.next_step && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{opp.next_step}</p>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString() : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{opp.owner_name || (opp as any).owner_name || "Sales Rep"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setCallingOpp(opp)}
                            className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition"
                            title="Call with AI Voice Agent"
                          >
                            <PhoneCall className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setNotesTargetOpp(opp)}
                            className="p-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition"
                            title="Log Call & Notes"
                          >
                            <ClipboardList className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* AI Voice Calling Modal */}
      {callingOpp && (
        <AiCallingModal
          open={!!callingOpp}
          onClose={() => setCallingOpp(null)}
          targetType="deal"
          targetId={callingOpp.id}
          contactName={(callingOpp as any).customer_name || callingOpp.name}
          contactPhone={(callingOpp as any).contact_phone || undefined}
          contactEmail={(callingOpp as any).contact_email || undefined}
          companyName={(callingOpp as any).company_name || undefined}
          dealValue={callingOpp.amount}
          defaultNotes={`Opportunity: ${callingOpp.name}, Current Stage: ${callingOpp.stage}, Value: ${callingOpp.amount}`}
          onCallCompleted={async () => {
            await fetchOpps();
          }}
        />
      )}

      {/* Notes & Call Disposition Modal */}
      {notesTargetOpp && (
        <NotesAndDispositionModal
          isOpen={!!notesTargetOpp}
          onClose={() => setNotesTargetOpp(null)}
          entityType="opportunity"
          entityId={notesTargetOpp.id}
          entityName={notesTargetOpp.name}
          entityCompany={(notesTargetOpp as any).customer_name}
          entityPhone={(notesTargetOpp as any).contact_phone}
          currentStatus={notesTargetOpp.stage}
          availableStatuses={STAGES}
          initialNotes={notesTargetOpp.notes}
          initialDisposition={notesTargetOpp.call_disposition}
          initialMinutes={notesTargetOpp.call_duration_minutes}
          initialResponse={notesTargetOpp.customer_response}
          initialNextFollowup={notesTargetOpp.next_step_at}
          onSaveSuccess={(updated) => {
            setOpportunities((prev) =>
              prev.map((d) =>
                d.id === notesTargetOpp.id
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
