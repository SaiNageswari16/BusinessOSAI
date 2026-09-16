import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, CheckCircle2, Clock, XCircle, Plane, Building2, Activity,
  FileText, Search, Filter, ShieldCheck, CreditCard,
  Eye, Check, X, Trash2, DollarSign, RefreshCw,
  AlertCircle, Calendar, MapPin, Receipt,
  Sparkles, Layers, Send, ExternalLink, Printer
} from "lucide-react";
import { toast } from "sonner";
import { expenseClaimsApi, ExpenseClaim, ExpenseClaimLine } from "@/lib/api-client";
import { fmt, statusStyle } from "@/components/accounting/utils";

interface Props {
  tab?: string;
}

interface ExpenseRecord {
  id: string;
  claim_number: string;
  employee: string;
  department: string;
  category: string;
  description: string;
  date: string;
  amount: number;
  status: string;
  rejection_reason?: string | null;
  approved_at?: string | null;
  lines: ExpenseClaimLine[];
  created_at?: string;
}

function mapClaimToRecord(c: ExpenseClaim): ExpenseRecord {
  const lines = c.lines && c.lines.length > 0 ? c.lines : [];
  const firstLine = lines[0];
  const category = firstLine?.category || "General";
  return {
    id: c.id,
    claim_number: c.claim_number || `EXP-${String(c.id).slice(0, 8)}`,
    employee: (c as any).employee_name || "Admin User",
    department: (c as any).department || "Operations",
    category,
    description: firstLine?.description || c.description || "Expense claim",
    date: c.claim_date,
    amount: typeof c.total_amount === "number" ? c.total_amount : Number(c.total_amount) || 0,
    status: (c.status || "pending").toLowerCase(),
    rejection_reason: c.rejection_reason,
    approved_at: c.approved_at,
    lines,
    created_at: c.created_at,
  };
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  travel: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  flight: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", border: "border-sky-500/20" },
  hotel: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20" },
  "office supplies": { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" },
  software: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/20" },
  "meals & entertainment": { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  rent: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20" },
  utilities: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20" },
  insurance: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
  maintenance: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
  operations: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/20" },
};

function getCategoryBadge(cat: string) {
  const key = Object.keys(CATEGORY_STYLES).find(k => (cat || "").toLowerCase().includes(k));
  const style = key ? CATEGORY_STYLES[key] : { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/20" };
  return `${style.bg} ${style.text} ${style.border}`;
}

const StatusBadge = ({ s }: { s: string }) => {
  const status = (s || "pending").toLowerCase();
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="size-3" /> Approved
      </span>
    );
  }
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        <CreditCard className="size-3" /> Reimbursed
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <XCircle className="size-3" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
      <Clock className="size-3" /> Pending Review
    </span>
  );
};

// ─── Modal: Multi-Line Expense Form ─────────────────────────────────────────
interface FormLine {
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  receipt_url: string;
}

function ExpenseFormModal({
  onClose,
  onSaved,
  defaultCategory = "Travel",
  initialClaim = null,
}: {
  onClose: () => void;
  onSaved: (claim: Partial<ExpenseRecord>) => void;
  defaultCategory?: string;
  initialClaim?: ExpenseRecord | null;
}) {
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState(initialClaim?.employee || "Admin User");
  const [department, setDepartment] = useState(initialClaim?.department || "Operations");
  const [claimDate, setClaimDate] = useState(initialClaim?.date || new Date().toISOString().split("T")[0]);
  const [claimDescription, setClaimDescription] = useState(initialClaim?.description || "");

  const [lines, setLines] = useState<FormLine[]>(
    initialClaim?.lines && initialClaim.lines.length > 0
      ? initialClaim.lines.map(l => ({
          expense_date: l.expense_date || new Date().toISOString().split("T")[0],
          category: l.category || defaultCategory,
          description: l.description || "",
          amount: Number(l.amount) || 0,
          receipt_url: l.receipt_url || "",
        }))
      : [
          {
            expense_date: new Date().toISOString().split("T")[0],
            category: defaultCategory,
            description: "",
            amount: 0,
            receipt_url: "",
          },
        ]
  );

  const totalAmount = useMemo(() => lines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0), [lines]);

  const addLine = () => {
    setLines(prev => [
      ...prev,
      {
        expense_date: claimDate,
        category: defaultCategory,
        description: "",
        amount: 0,
        receipt_url: "",
      },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) {
      toast.error("At least one expense line is required");
      return;
    }
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof FormLine, value: any) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount <= 0) {
      toast.error("Please enter a valid expense amount greater than 0");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        claim_date: claimDate,
        description: claimDescription || `${lines[0]?.category || "Business"} Expense`,
        status: "pending",
        lines: lines.map(l => ({
          expense_date: l.expense_date,
          category: l.category,
          description: l.description || l.category,
          amount: Number(l.amount) || 0,
          receipt_url: l.receipt_url || undefined,
        })),
      };

      let created: ExpenseClaim;
      if (initialClaim?.id) {
        created = await expenseClaimsApi.updateExpenseClaim(initialClaim.id, payload);
        toast.success("Expense claim updated!");
      } else {
        created = await expenseClaimsApi.createExpenseClaim(payload);
        toast.success("Expense claim submitted for approval!");
      }

      onSaved(mapClaimToRecord(created));
      onClose();
    } catch {
      toast.error("Failed to save expense claim");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-6"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Receipt className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground font-semibold">
                {initialClaim ? "Edit Expense Claim" : "Submit Expense Claim"}
              </h2>
              <p className="text-xs text-muted-foreground">Add items, receipts, and submit for manager approval</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground">Employee *</label>
              <input
                type="text"
                value={employee}
                onChange={e => setEmployee(e.target.value)}
                required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground">Department *</label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-medium"
              >
                <option value="Operations">Operations</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="IT & Engineering">IT & Engineering</option>
                <option value="Finance">Finance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground">Claim Date *</label>
              <input
                type="date"
                value={claimDate}
                onChange={e => setClaimDate(e.target.value)}
                required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-muted-foreground">Description / Notes</label>
            <input
              type="text"
              value={claimDescription}
              onChange={e => setClaimDescription(e.target.value)}
              placeholder="e.g. Business Travel & Client Meetings"
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none"
            />
          </div>

          {/* Line items repeater */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3.5" /> Itemized Expenses ({lines.length})
              </span>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md border border-primary/20 transition-colors"
              >
                <Plus className="size-3" /> Add Item Line
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-border/70 bg-muted/10 relative"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">Category</label>
                      <select
                        value={line.category}
                        onChange={e => updateLine(idx, "category", e.target.value)}
                        className="w-full h-8 px-2 text-xs rounded-md border bg-background outline-none"
                      >
                        <option value="Travel">Travel</option>
                        <option value="Hotel & Lodging">Hotel & Lodging</option>
                        <option value="Meals & Entertainment">Meals & Entertainment</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Software">Software & Tech</option>
                        <option value="Rent">Rent</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Insurance">Insurance</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Operations">Operations</option>
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">Description</label>
                      <input
                        type="text"
                        value={line.description}
                        onChange={e => updateLine(idx, "description", e.target.value)}
                        placeholder="Item details..."
                        required
                        className="w-full h-8 px-2.5 text-xs rounded-md border bg-background outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">Date</label>
                      <input
                        type="date"
                        value={line.expense_date}
                        onChange={e => updateLine(idx, "expense_date", e.target.value)}
                        required
                        className="w-full h-8 px-2 text-xs rounded-md border bg-background outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">Amount (INR) *</label>
                      <input
                        type="number"
                        step="any"
                        value={line.amount || ""}
                        onChange={e => updateLine(idx, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        required
                        className="w-full h-8 px-2.5 text-xs rounded-md border bg-background outline-none font-semibold text-foreground"
                      />
                    </div>

                    <div className="md:col-span-1 flex justify-end pt-3 md:pt-0">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 1}
                        className="size-7 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-2">
                    <Receipt className="size-3 text-muted-foreground" />
                    <input
                      type="url"
                      value={line.receipt_url}
                      onChange={e => updateLine(idx, "receipt_url", e.target.value)}
                      placeholder="Receipt or bill link (URL / Drive)..."
                      className="flex-1 text-[11px] h-6 px-2 rounded border border-border/60 bg-background/50 outline-none text-muted-foreground"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground font-semibold">Total Amount</span>
              <p className="text-2xl font-extrabold text-foreground">{fmt(totalAmount)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send className="size-4" /> {initialClaim ? "Update Claim" : "Submit Claim"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: Rejection Reason ────────────────────────────────────────────────
function RejectReasonModal({
  isOpen,
  onClose,
  onConfirm,
  claimId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  claimId: string;
}) {
  const [reason, setReason] = useState("");
  const presets = [
    "Original receipt/tax invoice missing",
    "Exceeds company travel/lodging budget policy",
    "Duplicate claim entry detected",
    "Needs additional departmental approval",
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center gap-3 text-rose-500">
          <div className="size-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
            <XCircle className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">Reject Expense Claim</h3>
            <p className="text-xs text-muted-foreground">Claim #{claimId}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Select or enter the specific reason for rejecting this claim.
        </p>

        <div className="space-y-1.5">
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setReason(p)}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors border ${
                reason === p
                  ? "bg-rose-500/10 border-rose-500/40 text-rose-600 font-semibold"
                  : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              • {p}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Custom rejection feedback..."
          rows={2}
          className="w-full p-2.5 text-xs rounded-lg border bg-background outline-none"
        />

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-xs font-semibold hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason || "Claim does not meet reimbursement criteria")}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Confirm Rejection
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Modal: Claim Detail & Receipt ──────────────────────────────────────────
function ClaimDetailModal({
  claim,
  onClose,
  onApprove,
  onReject,
  onPay,
}: {
  claim: ExpenseRecord;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPay: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
      >
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-base">{claim.claim_number}</h3>
                <StatusBadge s={claim.status} />
              </div>
              <p className="text-xs text-muted-foreground">{claim.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Employee</span>
              <span className="font-semibold text-foreground">{claim.employee}</span>
              <span className="text-muted-foreground block text-[11px]">{claim.department}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Date</span>
              <span className="font-semibold text-foreground">{claim.date}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Claim</span>
              <span className="font-extrabold text-primary text-sm">{fmt(claim.amount)}</span>
            </div>
          </div>

          {claim.rejection_reason && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Rejection Feedback:</span>
                <span>{claim.rejection_reason}</span>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Layers className="size-3.5" /> Breakdown ({claim.lines.length || 1} items)
            </h4>
            <div className="border border-border/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {claim.lines.length > 0 ? (
                    claim.lines.map((l, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 font-medium">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getCategoryBadge(l.category)}`}>
                            {l.category}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {l.description}
                          {l.receipt_url && (
                            <a
                              href={l.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-[10px] text-primary hover:underline mt-0.5 flex items-center gap-1"
                            >
                              <ExternalLink className="size-2.5" /> View Receipt
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{l.expense_date}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmt(Number(l.amount))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-2.5 font-medium">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getCategoryBadge(claim.category)}`}>
                          {claim.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-foreground">{claim.description}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{claim.date}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground">{fmt(claim.amount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border/50 bg-muted/20 flex items-center justify-between">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-muted transition-colors text-muted-foreground"
          >
            <Printer className="size-3.5" /> Print
          </button>
          <div className="flex items-center gap-2">
            {["pending", "draft", "submitted"].includes(claim.status) && (
              <>
                <button
                  onClick={() => {
                    onReject(claim.id);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    onApprove(claim.id);
                    onClose();
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Approve Claim
                </button>
              </>
            )}
            {claim.status === "approved" && (
              <button
                onClick={() => {
                  onPay(claim.id);
                  onClose();
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white gradient-brand shadow-sm hover:opacity-95 transition-opacity"
              >
                Mark as Reimbursed (Paid)
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── MAIN EXPENSES COMPONENT ────────────────────────────────────────────────
export function ExpenseClaims({ tab = "expense_claims" }: Props) {
  const currentTab = tab || "expense_claims";

  const [claims, setClaims] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalDefaultCategory, setModalDefaultCategory] = useState("Travel");
  const [editingClaim, setEditingClaim] = useState<ExpenseRecord | null>(null);
  const [selectedClaimDetail, setSelectedClaimDetail] = useState<ExpenseRecord | null>(null);
  const [rejectingClaimId, setRejectingClaimId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const res = await expenseClaimsApi.listExpenseClaims({ page_size: 150 });
      const mapped = (res.items || []).map(mapClaimToRecord);
      setClaims(mapped);
    } catch {
      toast.error("Failed to load expense records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, [currentTab]);

  const stats = useMemo(() => {
    const totalAmount = claims.reduce((a, c) => a + c.amount, 0);
    const pendingClaims = claims.filter(c => ["pending", "draft", "submitted"].includes(c.status));
    const pendingAmount = pendingClaims.reduce((a, c) => a + c.amount, 0);
    const approvedClaims = claims.filter(c => c.status === "approved" || c.status === "paid");
    const approvedAmount = approvedClaims.reduce((a, c) => a + c.amount, 0);

    const travelAmount = claims
      .filter(c => (c.category || "").toLowerCase().includes("travel") || (c.category || "").toLowerCase().includes("flight") || (c.category || "").toLowerCase().includes("hotel"))
      .reduce((a, c) => a + c.amount, 0);

    const officeAmount = claims
      .filter(c => ["office supplies", "software", "tech", "meals", "supplies"].some(k => (c.category || "").toLowerCase().includes(k)))
      .reduce((a, c) => a + c.amount, 0);

    const opexAmount = claims
      .filter(c => ["rent", "utilities", "insurance", "maintenance", "operations", "opex"].some(k => (c.category || "").toLowerCase().includes(k)))
      .reduce((a, c) => a + c.amount, 0);

    return {
      totalCount: claims.length,
      totalAmount,
      pendingCount: pendingClaims.length,
      pendingAmount,
      approvedCount: approvedClaims.length,
      approvedAmount,
      travelAmount,
      officeAmount,
      opexAmount,
    };
  }, [claims]);

  const handleApprove = async (id: string) => {
    try {
      await expenseClaimsApi.approveExpenseClaim(id);
      toast.success("Expense claim approved!");
      loadClaims();
    } catch {
      toast.error("Failed to approve claim");
    }
  };

  const handleConfirmReject = async (reason: string) => {
    if (!rejectingClaimId) return;
    try {
      await expenseClaimsApi.rejectExpenseClaim(rejectingClaimId, reason);
      toast.success("Expense claim rejected");
      setRejectingClaimId(null);
      loadClaims();
    } catch {
      toast.error("Failed to reject claim");
    }
  };

  const handlePay = async (id: string) => {
    try {
      await expenseClaimsApi.payExpenseClaim(id);
      toast.success("Expense claim marked as reimbursed (Paid)");
      loadClaims();
    } catch {
      toast.error("Failed to update status to Paid");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense claim?")) return;
    try {
      await expenseClaimsApi.deleteExpenseClaim(id);
      toast.success("Claim deleted successfully");
      loadClaims();
    } catch {
      toast.error("Failed to delete claim");
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      await expenseClaimsApi.batchApprove(selectedIds);
      toast.success(`Approved ${selectedIds.length} expense claims`);
      setSelectedIds([]);
      loadClaims();
    } catch {
      toast.error("Failed to batch approve claims");
    }
  };

  const openNewClaim = (cat = "Travel") => {
    setModalDefaultCategory(cat);
    setEditingClaim(null);
    setShowCreateModal(true);
  };

  const filteredAllClaims = useMemo(() => {
    return claims.filter(c => {
      const matchSearch =
        c.claim_number.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()) ||
        c.employee.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" ? true : c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [claims, search, statusFilter]);

  const pendingApprovals = useMemo(
    () => claims.filter(c => ["pending", "draft", "submitted"].includes(c.status)),
    [claims]
  );

  const travelClaims = useMemo(
    () => claims.filter(c => (c.category || "").toLowerCase().includes("travel") || (c.category || "").toLowerCase().includes("flight") || (c.category || "").toLowerCase().includes("hotel")),
    [claims]
  );

  const officeClaims = useMemo(
    () => claims.filter(c => ["office supplies", "software", "tech", "meals", "supplies"].some(k => (c.category || "").toLowerCase().includes(k))),
    [claims]
  );

  const opexClaims = useMemo(
    () => claims.filter(c => ["rent", "utilities", "insurance", "maintenance", "operations", "opex"].some(k => (c.category || "").toLowerCase().includes(k))),
    [claims]
  );

  // ─── TAB: APPROVALS ───────────────────────────────────────────────────────
  if (currentTab === "approvals") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Expense Approvals</h1>
            <p className="text-sm text-muted-foreground">
              Pending employee claims awaiting review: <span className="font-semibold text-foreground">{fmt(stats.pendingAmount)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBatchApprove}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 className="size-4" /> Approve Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="glass-panel rounded-xl border border-border/50 p-12 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="size-12 text-emerald-500 mb-3" />
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No pending expense approvals.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map(claim => (
              <div
                key={claim.id}
                className="glass-panel rounded-xl border border-border/50 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(claim.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedIds(p => [...p, claim.id]);
                      else setSelectedIds(p => p.filter(id => id !== claim.id));
                    }}
                    className="mt-1 size-4 rounded border-border text-primary cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-primary">{claim.claim_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getCategoryBadge(claim.category)}`}>
                        {claim.category}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-foreground">
                      {claim.employee} <span className="text-muted-foreground font-normal text-xs">· {claim.department}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{claim.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Submitted: {claim.date}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50">
                  <p className="text-xl font-bold text-foreground">{fmt(claim.amount)}</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedClaimDetail(claim)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted/50 transition-colors"
                    >
                      Breakdown
                    </button>
                    <button
                      onClick={() => setRejectingClaimId(claim.id)}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg text-xs font-semibold hover:bg-rose-500/20 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(claim.id)}
                      className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedClaimDetail && (
            <ClaimDetailModal
              claim={selectedClaimDetail}
              onClose={() => setSelectedClaimDetail(null)}
              onApprove={handleApprove}
              onReject={id => setRejectingClaimId(id)}
              onPay={handlePay}
            />
          )}
          {rejectingClaimId && (
            <RejectReasonModal
              isOpen={true}
              claimId={rejectingClaimId}
              onClose={() => setRejectingClaimId(null)}
              onConfirm={handleConfirmReject}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── TAB: TRAVEL ──────────────────────────────────────────────────────────
  if (currentTab === "travel") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Travel Expenses</h1>
            <p className="text-sm text-muted-foreground">
              Total travel disbursements: <span className="font-semibold text-foreground">{fmt(stats.travelAmount)}</span>
            </p>
          </div>
          <button
            onClick={() => openNewClaim("Travel")}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> New Travel Claim
          </button>
        </div>

        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {travelClaims.map(c => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-mono text-primary text-xs font-bold">{c.claim_number}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{c.employee}</td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[220px] truncate">{c.description}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.date}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(c.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge s={c.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedClaimDetail(c)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {travelClaims.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                    No travel expenses found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AnimatePresence>
          {showCreateModal && (
            <ExpenseFormModal
              defaultCategory="Travel"
              onClose={() => setShowCreateModal(false)}
              onSaved={() => loadClaims()}
            />
          )}
          {selectedClaimDetail && (
            <ClaimDetailModal
              claim={selectedClaimDetail}
              onClose={() => setSelectedClaimDetail(null)}
              onApprove={handleApprove}
              onReject={id => setRejectingClaimId(id)}
              onPay={handlePay}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── TAB: OFFICE EXPENSES ─────────────────────────────────────────────────
  if (currentTab === "office_expenses") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Office Expenses</h1>
            <p className="text-sm text-muted-foreground">
              Total office & software subscriptions: <span className="font-semibold text-foreground">{fmt(stats.officeAmount)}</span>
            </p>
          </div>
          <button
            onClick={() => openNewClaim("Office Supplies")}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> Add Office Expense
          </button>
        </div>

        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {officeClaims.map(c => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-mono text-primary text-xs font-bold">{c.claim_number}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{c.employee}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getCategoryBadge(c.category)}`}>
                      {c.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">{c.description}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.date}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(c.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge s={c.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedClaimDetail(c)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {officeClaims.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                    No office expenses found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AnimatePresence>
          {showCreateModal && (
            <ExpenseFormModal
              defaultCategory="Office Supplies"
              onClose={() => setShowCreateModal(false)}
              onSaved={() => loadClaims()}
            />
          )}
          {selectedClaimDetail && (
            <ClaimDetailModal
              claim={selectedClaimDetail}
              onClose={() => setSelectedClaimDetail(null)}
              onApprove={handleApprove}
              onReject={id => setRejectingClaimId(id)}
              onPay={handlePay}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── TAB: OPERATIONAL EXPENSES ────────────────────────────────────────────
  if (currentTab === "operational_expenses") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Operational Expenses</h1>
            <p className="text-sm text-muted-foreground">
              Rent, utilities, insurance, and recurring operational costs: <span className="font-semibold text-foreground">{fmt(stats.opexAmount)}</span>
            </p>
          </div>
          <button
            onClick={() => openNewClaim("Operations")}
            className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> Record OpEx
          </button>
        </div>

        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {opexClaims.map(c => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-mono text-primary text-xs font-bold">{c.claim_number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getCategoryBadge(c.category)}`}>
                      {c.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-medium">{c.description}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.date}</td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">{fmt(c.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge s={c.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedClaimDetail(c)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {opexClaims.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                    No operational expenses found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AnimatePresence>
          {showCreateModal && (
            <ExpenseFormModal
              defaultCategory="Operations"
              onClose={() => setShowCreateModal(false)}
              onSaved={() => loadClaims()}
            />
          )}
          {selectedClaimDetail && (
            <ClaimDetailModal
              claim={selectedClaimDetail}
              onClose={() => setSelectedClaimDetail(null)}
              onApprove={handleApprove}
              onReject={id => setRejectingClaimId(id)}
              onPay={handlePay}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── DEFAULT TAB: ALL EXPENSE CLAIMS ──────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Claims</h1>
          <p className="text-sm text-muted-foreground">
            Total claims filed: <span className="font-semibold text-foreground">{fmt(stats.totalAmount)}</span> ({stats.totalCount} claims)
          </p>
        </div>
        <button
          onClick={() => openNewClaim("Travel")}
          className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"
        >
          <Plus className="size-4" /> New Claim
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search claim, employee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border bg-background outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {["all", "pending", "approved", "paid", "rejected"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Department</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllClaims.map(claim => (
                <tr
                  key={claim.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-primary text-xs font-bold">{claim.claim_number}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{claim.employee}</td>
                  <td className="px-6 py-4 text-muted-foreground">{claim.department}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 bg-secondary/50 rounded-md text-xs font-semibold`}>
                      {claim.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[180px] truncate">{claim.description}</td>
                  <td className="px-6 py-4 text-muted-foreground">{claim.date}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(claim.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge s={claim.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedClaimDetail(claim)}
                        className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                        title="View Details"
                      >
                        <Eye className="size-3.5" />
                      </button>
                      {["pending", "draft", "submitted"].includes(claim.status) && (
                        <>
                          <button
                            onClick={() => handleApprove(claim.id)}
                            className="size-7 rounded-lg text-emerald-600 hover:bg-emerald-500/10 flex items-center justify-center transition-colors"
                            title="Approve"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setRejectingClaimId(claim.id)}
                            className="size-7 rounded-lg text-rose-600 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                            title="Reject"
                          >
                            <X className="size-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(claim.id)}
                        className="size-7 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAllClaims.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">
                    No expense claims found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <ExpenseFormModal
            defaultCategory="Travel"
            onClose={() => setShowCreateModal(false)}
            onSaved={() => loadClaims()}
          />
        )}
        {selectedClaimDetail && (
          <ClaimDetailModal
            claim={selectedClaimDetail}
            onClose={() => setSelectedClaimDetail(null)}
            onApprove={handleApprove}
            onReject={id => setRejectingClaimId(id)}
            onPay={handlePay}
          />
        )}
        {rejectingClaimId && (
          <RejectReasonModal
            isOpen={true}
            claimId={rejectingClaimId}
            onClose={() => setRejectingClaimId(null)}
            onConfirm={handleConfirmReject}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
