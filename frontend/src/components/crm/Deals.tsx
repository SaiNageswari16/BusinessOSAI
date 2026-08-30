import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Filter, MoreHorizontal, Target, Calendar, User, PhoneCall,
  ClipboardList, FileText, PhoneForwarded
} from "lucide-react";

import { crmOpportunitiesApi, type CrmOpportunity } from "@/lib/api-client";
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

export function Deals({ tab = "all_deals" }: Props) {
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();

  const [searchTerm, setSearchTerm] = useState("");
  const [deals, setDeals] = useState<CrmOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [callingDeal, setCallingDeal] = useState<CrmOpportunity | null>(null);
  const [notesTargetDeal, setNotesTargetDeal] = useState<CrmOpportunity | null>(null);
  const [newDeal, setNewDeal] = useState({ name: "", customer_name: "", amount: 0, probability: 50, stage: "Prospecting" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stages = ["Prospecting", "Qualification", "Needs Analysis", "Value Proposition", "Negotiation", "Closed Won", "Closed Lost"];

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await crmOpportunitiesApi.create(newDeal);
      toast.success("Deal created successfully!");
      setIsAddModalOpen(false);
      setNewDeal({ name: "", customer_name: "", amount: 0, probability: 50, stage: "Prospecting" });
      void fetchDeals();
    } catch(err: any) {
      toast.error(err?.message || "Failed to create deal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const res = await crmOpportunitiesApi.list();
      setDeals(res || []);
    } catch (err) {
      console.error("Failed to fetch deals:", err);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void fetchDeals();
  }, [tenant?.id]);

  const moveDeal = async (id: string, stage: string) => {
    try {
      await crmOpportunitiesApi.update(id, { stage });
      setDeals(prev => prev.map(d => d.id === id ? { ...d, stage } : d));
      toast.success(`Deal stage updated to ${stage}`);
    } catch {
      toast.error("Failed to update deal stage");
    }
  };

  const getDealsByStage = (stage: string) => {
    return deals.filter(d => d.stage === stage && 
      (d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       ((d as any).customer_name || "").toLowerCase().includes(searchTerm.toLowerCase())));
  };

  return (
    <div className="p-4 h-[calc(100vh-6rem)] flex flex-col space-y-3">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Deals Pipeline</h2>
          <p className="text-xs text-muted-foreground">Interactive status board to manage active opportunities.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search deals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 pl-8 pr-3 h-8 bg-background border border-border rounded-lg text-xs focus:outline-none"
            />
          </div>
          <button onClick={() => toast.info('Feature coming soon!')} className="flex items-center gap-1.5 px-3 h-8 bg-background border border-border rounded-lg text-xs font-semibold hover:bg-accent transition-colors">
            <Filter className="size-3.5" /> Filter
          </button>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity">
                <Plus className="size-3.5" /> Add Deal
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Deal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Deal Name</Label>
                  <Input required value={newDeal.name} onChange={e => setNewDeal({...newDeal, name: e.target.value})} placeholder="e.g. Enterprise License" />
                </div>
                <div className="space-y-2">
                  <Label>Customer / Lead Name</Label>
                  <Input value={newDeal.customer_name} onChange={e => setNewDeal({...newDeal, customer_name: e.target.value})} placeholder="e.g. Acme Corp" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount ({currency.symbol})</Label>
                    <Input required type="number" min="0" value={newDeal.amount} onChange={e => setNewDeal({...newDeal, amount: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Probability (%)</Label>
                    <Input required type="number" min="0" max="100" value={newDeal.probability} onChange={e => setNewDeal({...newDeal, probability: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <select value={newDeal.stage} onChange={e => setNewDeal({...newDeal, stage: e.target.value})} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {stages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <DialogFooter className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isSubmitting ? "Saving..." : "Save Deal"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading pipeline...</div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
          {stages.map((stage) => {
            const stageDeals = getDealsByStage(stage);
            const totalValue = stageDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);

            return (
              <div key={stage} className="flex-shrink-0 w-72 flex flex-col h-full border-r border-border/50 pr-4 last:border-0">
                <div className="mb-4">
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider mb-1">{stage}</h3>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{stageDeals.length} Deals</span>
                    <span className="font-bold text-primary">{currency.symbol}{totalValue.toLocaleString()}</span>
                  </div>
                  <div className="h-1 w-full bg-accent mt-2 rounded-full overflow-hidden">
                    <div className={`h-full ${
                      stage === 'Closed Won' ? 'bg-emerald-500' :
                      stage === 'Closed Lost' ? 'bg-red-500' :
                      'bg-primary'
                    }`} style={{ width: `${deals.length > 0 ? (stageDeals.length / deals.length) * 100 : 0}%` }} />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                  {stageDeals.map((deal) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={deal.id}
                      className="bg-card p-4 rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-all border-l-4"
                      style={{ borderLeftColor: `hsl(var(--primary))` }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-foreground text-sm leading-tight pr-2">{deal.name}</h4>
                        <button
                          onClick={() => setCallingDeal(deal)}
                          className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition shrink-0"
                          title="Start AI Deal Call"
                        >
                          <PhoneCall className="size-3.5" />
                        </button>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Target className="size-3" /> {(deal as any).customer_name || "Robert Johnson (Lead)"}
                      </p>
                      
                      <div className="flex justify-between items-center gap-2 mb-3">
                        <div className="text-xs font-bold text-emerald-600">
                          {currency.symbol}{Number(deal.amount || 0).toLocaleString()}
                        </div>
                        <select
                          value={deal.stage}
                          onChange={(e) => void moveDeal(deal.id, e.target.value)}
                          className="bg-transparent text-[10px] border-none focus:outline-none font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                        >
                          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      {/* ── Call Disposition & Notes Badge Block ── */}
                      {deal.call_disposition && (
                        <div className="mt-2 mb-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-[10px] text-indigo-700 dark:text-indigo-300">
                          <PhoneForwarded className="size-3 shrink-0 text-indigo-600" />
                          <span className="font-bold truncate">{deal.call_disposition}</span>
                          {deal.call_duration_minutes ? (
                            <span className="text-muted-foreground ml-auto shrink-0 font-mono">
                              {deal.call_duration_minutes}m
                            </span>
                          ) : null}
                        </div>
                      )}

                      {deal.customer_response && (
                        <div className="mb-2 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50 text-[10px] text-foreground italic line-clamp-2">
                          "{deal.customer_response}"
                        </div>
                      )}

                      {deal.notes && !deal.customer_response && (
                        <div className="mb-2 flex items-center gap-1 text-[10px] text-muted-foreground line-clamp-1">
                          <FileText className="size-3 shrink-0 text-indigo-500" />
                          <span className="truncate">{deal.notes}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" /> 
                          {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "—"}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="size-3" /> {(deal as any).owner_name?.split(' ')[0] || "Admin"}
                        </div>
                      </div>

                      {/* Log Call & Notes Button */}
                      <button
                        onClick={() => setNotesTargetDeal(deal)}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border/80 bg-background hover:bg-muted text-foreground transition-colors"
                      >
                        <ClipboardList className="size-3 text-indigo-600" />
                        Log Call & Notes
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Universal AI Calling Modal */}
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

      {/* Manual Call Disposition & Notes Modal for Deals */}
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
          availableStatuses={stages}
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
                      call_disposition: updated.call_disposition !== undefined ? updated.call_disposition : d.call_disposition,
                      call_duration_minutes: updated.call_duration_minutes !== undefined ? updated.call_duration_minutes : d.call_duration_minutes,
                      customer_response: updated.customer_response !== undefined ? updated.customer_response : d.customer_response,
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
