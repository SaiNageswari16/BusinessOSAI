import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, CheckCircle, Clock, XCircle, Plane, Building, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { expenseClaimsApi, ExpenseClaim } from "@/lib/api-client";
import { fmt, statusStyle } from "@/components/accounting/utils";
import { useCurrency } from "@/hooks/use-currency";

interface Props { tab?: string; }

interface ExpenseRecord {
  id: string;
  employee: string;
  department: string;
  category: string;
  description: string;
  date: string;
  amount: number;
  status: string;
}

const StatusIcon = ({ s }: { s: string }) => {
  const status = s.toLowerCase();
  if (status === "approved" || status === "approve") return <CheckCircle className="size-3" />;
  if (status === "rejected" || status === "reject") return <XCircle className="size-3" />;
  return <Clock className="size-3" />;
};

function mapClaimToRecord(c: ExpenseClaim): ExpenseRecord {
  return {
    id: c.claim_number || c.id.slice(0, 12),
    employee: "—",
    department: "—",
    category: c.description || "General",
    description: c.description || "",
    date: c.claim_date,
    amount: c.total_amount,
    status: c.status,
  };
}

// ─── Modal: New Expense Claim ────────────────────────────────────────────
function ExpenseFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (claim: Partial<ExpenseRecord>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee: "",
    department: "Operations",
    category: "Travel",
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await expenseClaimsApi.createExpenseClaim({
        claim_date: form.date,
        description: form.description || form.category,
        lines: [
          {
            expense_date: form.date,
            category: form.category,
            description: form.description,
            amount: form.amount,
          },
        ],
      });
      toast.success("Expense claim submitted!");
      onSaved({
        ...mapClaimToRecord(created),
        id: created.claim_number || created.id.slice(0, 12),
        amount: created.total_amount,
        status: created.status,
      });
      onClose();
    } catch {
      toast.error("Failed to submit expense claim");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">Submit Expense Claim</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Description *</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required rows={2}
              className="w-full p-3 text-sm rounded-lg border bg-background outline-none" placeholder="Business expense details..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Category *</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none">
                <option value="Travel">Travel</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Software">Software & Tech</option>
                <option value="Meals & Entertainment">Meals & Entertainment</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Department</label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none">
                <option value="Operations">Operations</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="IT & Engineering">IT & Engineering</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Amount (INR) *</label>
              <input type="number" step="any" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-semibold" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Expense Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Submit Claim
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Expense Claims Component ────────────────────────────────────────
export function ExpenseClaims({ tab = "claims" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const [claims, setClaims] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const res = await expenseClaimsApi.listExpenseClaims({ page_size: 100 });
      const mapped = (res.items || []).map(mapClaimToRecord);
      setClaims(mapped);
    } catch {
      toast.error("Failed to load expense claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (["claims", "approvals", "travel", "office_expenses", "operational_expenses"].includes(tab)) {
      loadClaims();
    }
  }, [tab]);

  const handleAddClaim = (newC: Partial<ExpenseRecord>) => {
    setClaims(p => [newC as ExpenseRecord, ...p]);
  };

  const handleApprove = async (id: string) => {
    try {
      await expenseClaimsApi.approveExpenseClaim(id);
      setClaims(p => p.map(c => c.id === id ? { ...c, status: "Approved" } : c));
      toast.success("Expense claim approved!");
    } catch {
      toast.error("Failed to approve claim");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await expenseClaimsApi.rejectExpenseClaim(id, "Rejected");
      setClaims(p => p.map(c => c.id === id ? { ...c, status: "Rejected" } : c));
      toast.success("Expense claim rejected!");
    } catch {
      toast.error("Failed to reject claim");
    }
  };

  if (tab === "approvals") {
    const pending = claims.filter(e => e.status.toLowerCase() === "pending");
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Expense Approvals</h1><p className="text-sm text-muted-foreground">Pending employee claims awaiting review.</p></div>
          {pending.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-sm font-semibold">
              <Clock className="size-4" /> {pending.length} pending
            </div>
          )}
        </div>
        {pending.length === 0 ? (
          <div className="glass-panel p-12 rounded-xl border border-border/50 flex flex-col items-center justify-center text-center">
            <CheckCircle className="size-12 text-emerald-500 mb-4" />
            <h3 className="font-semibold text-foreground">All caught up!</h3>
            <p className="text-sm text-muted-foreground">No pending expense approvals.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((claim, i) => (
              <motion.div key={claim.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="glass-panel p-6 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm font-semibold text-foreground">{claim.id}</span>
                      <span className="px-2 py-0.5 bg-secondary/60 rounded text-xs text-muted-foreground font-semibold">{claim.category}</span>
                    </div>
                    <p className="font-semibold text-foreground">{claim.employee} <span className="text-muted-foreground font-normal text-sm">· {claim.department}</span></p>
                    <p className="text-sm text-muted-foreground mt-1">{claim.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Submitted: {claim.date}</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{fmt(claim.amount)}</p>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                  <button onClick={() => handleApprove(claim.id)} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors">Approve</button>
                  <button onClick={() => handleReject(claim.id)} className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-sm font-semibold hover:bg-red-500/20 transition-colors">Reject</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (tab === "travel") {
    const travelClaims = claims.filter(e => e.category === "Travel");
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Travel Expenses</h1><p className="text-sm text-muted-foreground">All business travel reimbursements.</p></div>
          <button onClick={() => setShowClaimModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Plane className="size-4" /> New Travel Claim</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {travelClaims.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary text-xs">{c.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{c.employee}</td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">{c.description}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.date}</td>
                    <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(c.amount)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(c.status)}`}>
                        <StatusIcon s={c.status} /> {c.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
                {travelClaims.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No travel expenses found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <AnimatePresence>
          {showClaimModal && (
            <ExpenseFormModal onClose={() => setShowClaimModal(false)} onSaved={handleAddClaim} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (tab === "office_expenses") {
    const officeClaims = claims.filter(e => ["Office Supplies", "Software", "Meals & Entertainment", "office supplies", "software", "meals & entertainment"].includes(e.category));
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Office Expenses</h1><p className="text-sm text-muted-foreground">Office supplies and software subscriptions.</p></div>
          <button onClick={() => setShowClaimModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Building className="size-4" /> New Claim</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {officeClaims.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary text-xs">{c.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{c.employee}</td>
                    <td className="px-6 py-4"><span className="px-2.5 py-1 bg-secondary/50 rounded-md text-xs font-semibold">{c.category}</span></td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">{c.description}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.date}</td>
                    <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(c.amount)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(c.status)}`}>
                        <StatusIcon s={c.status} /> {c.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
                {officeClaims.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No office expenses found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <AnimatePresence>
          {showClaimModal && (
            <ExpenseFormModal onClose={() => setShowClaimModal(false)} onSaved={handleAddClaim} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (tab === "operational_expenses") {
    const opexClaims = claims.filter(e => ["Rent", "Utilities", "Insurance", "Maintenance", "rent", "utilities", "insurance", "maintenance"].includes(e.category));
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Operational Expenses</h1><p className="text-sm text-muted-foreground">Rent, utilities, insurance, and recurring operational costs.</p></div>
          <button onClick={() => setShowClaimModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Building className="size-4" /> Add OpEx</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {opexClaims.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary text-xs">{c.id}</td>
                    <td className="px-6 py-4"><span className="px-2.5 py-1 bg-secondary/50 rounded-md text-xs font-semibold">{c.category}</span></td>
                    <td className="px-6 py-4 text-muted-foreground font-semibold">{c.description}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.date}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{fmt(c.amount)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(c.status)}`}>
                        <StatusIcon s={c.status} /> {c.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
                {opexClaims.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No operational expenses found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <AnimatePresence>
          {showClaimModal && (
            <ExpenseFormModal onClose={() => setShowClaimModal(false)} onSaved={handleAddClaim} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Default: claims
  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading expense claims…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground font-bold">Expense Claims</h1><p className="text-sm text-muted-foreground">Employee business expense reimbursements.</p></div>
        <button onClick={() => setShowClaimModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> New Claim</button>
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Department</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, i) => (
                <motion.tr key={claim.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-mono text-primary text-xs">{claim.id}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{claim.employee}</td>
                  <td className="px-6 py-4 text-muted-foreground">{claim.department}</td>
                  <td className="px-6 py-4"><span className="px-2.5 py-1 bg-secondary/50 rounded-md text-xs font-semibold">{claim.category}</span></td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[180px] truncate">{claim.description}</td>
                  <td className="px-6 py-4 text-muted-foreground">{claim.date}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(claim.amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(claim.status)}`}>
                      <StatusIcon s={claim.status} /> {claim.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
              {claims.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No expense claims found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AnimatePresence>
        {showClaimModal && (
          <ExpenseFormModal onClose={() => setShowClaimModal(false)} onSaved={handleAddClaim} />
        )}
      </AnimatePresence>
    </div>
  );
}
