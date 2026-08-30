import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Phone, PhoneCall, Clock, Calendar, FileText, CheckCircle2,
  AlertCircle, MessageSquare, Plus, User, Building, Send, Tag,
  History, Sparkles, PhoneForwarded, ChevronRight, Loader2
} from "lucide-react";
import { toast } from "sonner";
import {
  crmLeadsApi,
  crmOpportunitiesApi,
  type CrmLeadActivity
} from "@/lib/api-client";
import { Button } from "@/components/ui/button";

const CALL_DISPOSITIONS = [
  { label: "Callback Requested", icon: PhoneForwarded, color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400" },
  { label: "Interested / Positive", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400" },
  { label: "Meeting Scheduled", icon: Calendar, color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400" },
  { label: "Follow-up Required", icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400" },
  { label: "No Answer / Busy", icon: Phone, color: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400" },
  { label: "Not Interested", icon: AlertCircle, color: "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400" },
  { label: "WhatsApp / Message Sent", icon: MessageSquare, color: "text-teal-600 bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400" },
  { label: "Wrong Number", icon: X, color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entityType: "lead" | "opportunity";
  entityId: string;
  entityName: string;
  entityCompany?: string | null;
  entityPhone?: string | null;
  currentStatus: string;
  availableStatuses: string[];
  initialNotes?: string | null;
  initialDisposition?: string | null;
  initialMinutes?: number | null;
  initialResponse?: string | null;
  initialNextFollowup?: string | null;
  onSaveSuccess: (updated: {
    status?: string;
    notes?: string;
    call_disposition?: string;
    call_duration_minutes?: number;
    customer_response?: string;
    next_follow_up_at?: string;
  }) => void;
}

export function NotesAndDispositionModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  entityCompany,
  entityPhone,
  currentStatus,
  availableStatuses,
  initialNotes = "",
  initialDisposition = "",
  initialMinutes = 0,
  initialResponse = "",
  initialNextFollowup = "",
  onSaveSuccess,
}: Props) {
  const [activeTab, setActiveTab] = useState<"log_call" | "notes_history">("log_call");
  
  // State for editing current status & notes
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(initialNotes || "");
  
  // State for new interaction / call disposition log
  const [disposition, setDisposition] = useState(initialDisposition || "");
  const [durationMinutes, setDurationMinutes] = useState<number>(initialMinutes || 0);
  const [customerResponse, setCustomerResponse] = useState(initialResponse || "");
  const [nextFollowup, setNextFollowup] = useState(
    initialNextFollowup ? new Date(initialNextFollowup).toISOString().slice(0, 16) : ""
  );
  
  // History logs
  const [activities, setActivities] = useState<CrmLeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && entityId) {
      setStatus(currentStatus);
      setNotes(initialNotes || "");
      setDisposition(initialDisposition || "");
      setDurationMinutes(initialMinutes || 0);
      setCustomerResponse(initialResponse || "");
      setNextFollowup(
        initialNextFollowup ? new Date(initialNextFollowup).toISOString().slice(0, 16) : ""
      );
      void fetchActivities();
    }
  }, [isOpen, entityId]);

  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      if (entityType === "lead") {
        const res = await crmLeadsApi.listActivities(entityId);
        setActivities(res || []);
      } else {
        const res = await crmOpportunitiesApi.listActivities(entityId);
        setActivities(res || []);
      }
    } catch {
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleQuickAddMinutes = (mins: number) => {
    setDurationMinutes((prev) => Math.max(0, (prev || 0) + mins));
  };

  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payloadUpdate: Record<string, any> = {
        notes,
        call_disposition: disposition || undefined,
        call_duration_minutes: durationMinutes,
        customer_response: customerResponse || undefined,
      };

      if (status !== currentStatus) {
        if (entityType === "lead") payloadUpdate.status = status;
        else payloadUpdate.stage = status;
      }

      if (nextFollowup) {
        payloadUpdate.next_follow_up_at = new Date(nextFollowup).toISOString();
      }

      // 1. Update lead or opportunity entity record
      if (entityType === "lead") {
        await crmLeadsApi.update(entityId, payloadUpdate);
      } else {
        await crmOpportunitiesApi.update(entityId, payloadUpdate);
      }

      // 2. Also log an activity entry if disposition or customer response was provided
      if (disposition || customerResponse || durationMinutes > 0) {
        const summaryText = disposition
          ? `Call Logged: ${disposition} (${durationMinutes} mins)${customerResponse ? ` - Response: "${customerResponse}"` : ""}`
          : `Call Logged: ${durationMinutes} mins${customerResponse ? ` - Response: "${customerResponse}"` : ""}`;

        const activityPayload = {
          activity_type: "Call",
          summary: summaryText,
          call_disposition: disposition || undefined,
          call_duration_minutes: durationMinutes,
          customer_response: customerResponse || undefined,
          occurred_at: new Date().toISOString(),
        };

        if (entityType === "lead") {
          await crmLeadsApi.addActivity(entityId, activityPayload);
        } else {
          await crmOpportunitiesApi.addActivity(entityId, activityPayload);
        }
      }

      toast.success("Interaction & notes saved successfully!");
      onSaveSuccess({
        status,
        notes,
        call_disposition: disposition,
        call_duration_minutes: durationMinutes,
        customer_response: customerResponse,
        next_follow_up_at: nextFollowup ? new Date(nextFollowup).toISOString() : undefined,
      });
      void fetchActivities();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save call disposition & notes");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-border/80 bg-muted/30 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                {entityType === "lead" ? "Lead Notes & Disposition" : "Deal Notes & Disposition"}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border">
                Current: {status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <User className="size-5 text-indigo-600 shrink-0" />
              {entityName}
            </h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {entityCompany && (
                <span className="flex items-center gap-1">
                  <Building className="size-3.5" />
                  {entityCompany}
                </span>
              )}
              {entityPhone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="size-3.5 text-emerald-600" />
                  {entityPhone}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border px-5 bg-background shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("log_call")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === "log_call"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <PhoneCall className="size-4" />
            Log Call & Response
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notes_history")}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === "notes_history"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="size-4" />
            Notes & Activity History ({activities.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === "log_call" ? (
            <form id="call-disposition-form" onSubmit={handleSaveInteraction} className="space-y-4">
              {/* Row 1: Status / Stage Changer */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Update {entityType === "lead" ? "Lead Status" : "Deal Stage"}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableStatuses.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                        status === st
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-background text-muted-foreground border-border hover:border-indigo-300 hover:text-foreground"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Call Disposition Chips */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Call Disposition (Outcome)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CALL_DISPOSITIONS.map((item) => {
                    const isSelected = disposition === item.label;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setDisposition(item.label)}
                        className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all text-left ${
                          isSelected
                            ? "ring-2 ring-indigo-500 font-bold " + item.color
                            : "bg-background border-border hover:bg-muted/40 text-foreground"
                        }`}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Talk Time / Minutes Talked */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-indigo-600" />
                    Minutes Talked
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                    {durationMinutes} min{durationMinutes !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="600"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-1 flex-1">
                    {[1, 2, 5, 10, 15, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => handleQuickAddMinutes(mins)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                      >
                        +{mins}m
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDurationMinutes(0)}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 4: What's His Response */}
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Customer Response / Call Summary
                </label>
                <textarea
                  rows={2}
                  value={customerResponse}
                  onChange={(e) => setCustomerResponse(e.target.value)}
                  placeholder="e.g. Discussed pricing; requested a callback next Tuesday at 3 PM; wants enterprise quotation..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Row 5: Scheduled Next Follow-up & General Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5 flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-indigo-600" />
                    Next Follow-up Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={nextFollowup}
                    onChange={(e) => setNextFollowup(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5 flex items-center gap-1.5">
                    <FileText className="size-3.5 text-indigo-600" />
                    Main Account Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Key account notes or background..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Primary Notes Banner */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20">
                <h4 className="text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                  <FileText className="size-3.5 text-indigo-600" />
                  General Notes
                </h4>
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {notes || <span className="text-muted-foreground italic">No general notes added yet.</span>}
                </p>
              </div>

              {/* Timeline of past activities */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Call & Interaction Timeline
                </h4>

                {loadingActivities ? (
                  <div className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2 text-xs">
                    <Loader2 className="size-4 animate-spin" />
                    Loading activity history...
                  </div>
                ) : activities.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/10">
                    <History className="size-6 mx-auto mb-1 opacity-40" />
                    <p className="text-xs font-medium">No past interactions recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activities.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 rounded-xl border border-border bg-card shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                            <PhoneCall className="size-3" />
                            {act.activity_type}
                            {act.call_disposition && (
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300">
                                {act.call_disposition}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(act.occurred_at || act.created_at).toLocaleString()}
                          </span>
                        </div>

                        {act.call_duration_minutes ? (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3 text-emerald-600" />
                            <span>Duration: <strong>{act.call_duration_minutes} mins</strong></span>
                          </div>
                        ) : null}

                        {act.customer_response && (
                          <div className="text-xs bg-muted/40 p-2 rounded-lg text-foreground border border-border/50">
                            <span className="text-[10px] font-bold text-muted-foreground block mb-0.5">Response:</span>
                            "{act.customer_response}"
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">{act.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          {activeTab === "log_call" && (
            <Button
              type="submit"
              form="call-disposition-form"
              disabled={saving}
              className="gradient-brand text-white font-bold text-xs h-9 px-5 rounded-lg shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Disposition & Notes"
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
