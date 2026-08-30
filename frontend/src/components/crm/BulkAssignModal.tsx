import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserCheck, Users, Shuffle, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { crmLeadsApi, type SalesExecutive } from "@/lib/api-client";

interface BulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeadIds: string[];
  executives: SalesExecutive[];
  onSuccess: () => void;
}

export function BulkAssignModal({
  isOpen,
  onClose,
  selectedLeadIds,
  executives,
  onSuccess,
}: BulkAssignModalProps) {
  const [mode, setMode] = useState<"single" | "round_robin">("single");
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<string>("");
  const [roundRobinUserIds, setRoundRobinUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Initialize round robin with all executives
  React.useEffect(() => {
    if (executives.length > 0) {
      if (!selectedExecutiveId) {
        setSelectedExecutiveId(executives[0].id);
      }
      setRoundRobinUserIds(executives.map((e) => e.id));
    }
  }, [executives]);

  const toggleRoundRobinUser = (id: string) => {
    setRoundRobinUserIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const handleAssign = async () => {
    if (selectedLeadIds.length === 0) {
      toast.error("No leads selected.");
      return;
    }

    if (mode === "single" && !selectedExecutiveId) {
      toast.error("Please choose a sales executive.");
      return;
    }

    if (mode === "round_robin" && roundRobinUserIds.length === 0) {
      toast.error("Please select at least one sales executive for round-robin.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await crmLeadsApi.bulkAssign({
        lead_ids: selectedLeadIds,
        mode,
        owner_user_id: mode === "single" ? selectedExecutiveId : undefined,
        user_ids: mode === "round_robin" ? roundRobinUserIds : undefined,
      });

      toast.success(res.message || `Successfully assigned ${selectedLeadIds.length} leads.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to assign leads.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <UserCheck className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Lead Assignment System</h3>
                <p className="text-xs text-muted-foreground">
                  Assign <span className="font-bold text-primary">{selectedLeadIds.length}</span> selected lead{selectedLeadIds.length > 1 ? "s" : ""} to sales executives
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Assignment Mode Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === "single"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="size-3.5" />
                Direct Assign
              </button>
              <button
                type="button"
                onClick={() => setMode("round_robin")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === "round_robin"
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shuffle className="size-3.5" />
                Round-Robin Distribution
              </button>
            </div>

            {mode === "single" ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-foreground">
                  Select Sales Executive
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {executives.map((exec) => {
                    const isSelected = selectedExecutiveId === exec.id;
                    return (
                      <div
                        key={exec.id}
                        onClick={() => setSelectedExecutiveId(exec.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary shadow-xs"
                            : "bg-background border-border hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                            {exec.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{exec.name}</p>
                            <p className="text-[11px] text-muted-foreground">{exec.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border font-medium">
                            {exec.active_leads_count} active leads
                          </span>
                          {isSelected && <Check className="size-4 text-primary" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Distribute Equally Across ({roundRobinUserIds.length} selected)
                  </label>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3 text-amber-500" />
                    ~{Math.ceil(selectedLeadIds.length / Math.max(roundRobinUserIds.length, 1))} leads per rep
                  </span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {executives.map((exec) => {
                    const isChecked = roundRobinUserIds.includes(exec.id);
                    return (
                      <div
                        key={exec.id}
                        onClick={() => toggleRoundRobinUser(exec.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800"
                            : "bg-background border-border opacity-60 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="size-4 rounded text-primary border-border focus:ring-primary"
                          />
                          <div>
                            <p className="text-xs font-bold text-foreground">{exec.name}</p>
                            <p className="text-[11px] text-muted-foreground">{exec.email}</p>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border font-medium">
                          {exec.active_leads_count} active
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border flex items-center justify-between bg-muted/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleAssign}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-md"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Confirm Assignment ({selectedLeadIds.length})
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
