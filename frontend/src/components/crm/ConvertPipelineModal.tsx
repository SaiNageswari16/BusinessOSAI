import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Building2, User, DollarSign, Calendar, Check, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { crmLeadsApi, type CrmLead } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

interface ConvertPipelineModalProps {
  isOpen: boolean;
  lead: CrmLead | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConvertPipelineModal({
  isOpen,
  lead,
  onClose,
  onSuccess,
}: ConvertPipelineModalProps) {
  const { currency } = useCurrency();
  const [dealName, setDealName] = useState("");
  const [dealAmount, setDealAmount] = useState<string>("0");
  const [dealStage, setDealStage] = useState("Needs Analysis");
  const [customerType, setCustomerType] = useState("Corporate");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (lead) {
      setDealName(`${lead.name} - ${lead.company_name || "Enterprise Deal"}`);
      setDealAmount(String(lead.estimated_value || 0));
      setNotes(lead.notes || "");
      // Default expected close in 30 days
      const date = new Date();
      date.setDate(date.getDate() + 30);
      setExpectedCloseDate(date.toISOString().split("T")[0]);
    }
  }, [lead]);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    setSubmitting(true);
    try {
      const res = await crmLeadsApi.convertPipeline(lead.id, {
        deal_name: dealName.trim(),
        deal_amount: Number(dealAmount) || 0,
        deal_stage: dealStage,
        customer_type: customerType,
        expected_close_date: expectedCloseDate ? `${expectedCloseDate}T00:00:00Z` : undefined,
        notes: notes.trim() || undefined,
      });

      toast.success(res.message || "Lead converted to Customer & Deal successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to convert lead to pipeline.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !lead) return null;

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
          <div className="p-5 border-b border-border flex justify-between items-center bg-gradient-to-r from-emerald-500/10 via-primary/10 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Convert to Customer & Deal</h3>
                <p className="text-xs text-muted-foreground">
                  Promote <span className="font-bold text-foreground">{lead.name}</span> into active Accounts & Pipeline
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

          {/* Form */}
          <form onSubmit={handleConvert} className="p-5 space-y-4">
            <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-xs space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-primary" />
                Customer Record: <span className="font-normal">{lead.name} ({lead.company_name || "Individual"})</span>
              </p>
              <p className="text-muted-foreground pl-5">
                Email: {lead.email || "N/A"} · Phone: {lead.phone || "N/A"}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Deal / Opportunity Name *
              </label>
              <input
                required
                type="text"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                placeholder="e.g. Acme Corp - Enterprise License"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Deal Amount ({currency.symbol}) *
                </label>
                <div className="relative">
                  <input
                    required
                    type="number"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-bold text-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={dealStage}
                  onChange={(e) => setDealStage(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none"
                >
                  <option value="Prospecting">Prospecting</option>
                  <option value="Qualification">Qualification</option>
                  <option value="Needs Analysis">Needs Analysis</option>
                  <option value="Value Proposition">Value Proposition</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Closed Won">Closed Won</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Customer Type
                </label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none"
                >
                  <option value="Corporate">Corporate</option>
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="VIP">VIP</option>
                  <option value="Distributor">Distributor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Expected Close Date
                </label>
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Deal Notes & Context
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key requirements discussed, objections solved, next steps..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none resize-none"
              />
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-md"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <ArrowRight className="size-3.5" />
                    Confirm Pipeline Conversion
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
