import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, CheckCircle, Clock, XCircle, Plane, Building, Activity, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

interface OpExRecord {
  id: string;
  category: string;
  description: string;
  amount: number;
  period: string;
  approvedBy: string;
  status: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

const statusStyle = (s: string) => {
  const status = s.toLowerCase();
  switch (status) {
    case "approved": return "bg-emerald-500/10 text-emerald-500";
    case "pending": return "bg-amber-500/10 text-amber-500";
    case "rejected": return "bg-red-500/10 text-red-500";
    default: return "bg-muted text-muted-foreground";
  }
};

const StatusIcon = ({ s }: { s: string }) => {
  const status = s.toLowerCase();
  if (status === "approved") return <CheckCircle className="size-3" />;
  if (status === "rejected") return <XCircle className="size-3" />;
  return <Clock className="size-3" />;
};

// ─── Modal: New Expense Claim ────────────────────────────────────────────
function ExpenseFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (claim: Partial<ExpenseRecord>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee: "Super Admin",
    department: "Operations",
    category: "Travel",
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSaved({
        id: `EXP-2026-${Math.floor(100 + Math.random() * 900)}`,
        employee: form.employee,
        department: form.department,
        category: form.category,
        description: form.description,
        amount: form.amount,
        date: form.date,
        status: "Pending"
      });
      toast.success("Expense claim submitted successfully!");
      setSaving(false);
      onClose();
    }, 400);
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
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Employee Name *</label>
            <input value={form.employee} onChange={e => setForm(p => ({ ...p, employee: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none" />
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
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Department *</label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} required
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
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Description *</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required rows={2}
              className="w-full p-3 text-sm rounded-lg border bg-background outline-none" placeholder="Client lunch, airline tickets..." />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Submit Claim
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: Add OpEx ─────────────────────────────────────────────────────
function OpExFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (opex: Partial<OpExRecord>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "Rent",
    description: "",
    amount: 0,
    period: "July 2026",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSaved({
        id: `OPEX-2026-${Math.floor(100 + Math.random() * 900)}`,
        category: form.category,
        description: form.description,
        amount: form.amount,
        period: form.period,
        approvedBy: "CFO",
        status: "Approved"
      });
      toast.success("Operational expense added successfully!");
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">Record Operational Expense</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Category *</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none">
                <option value="Rent">Rent</option>
                <option value="Utilities">Utilities</option>
                <option value="Insurance">Insurance</option>
                <option value="Office Maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Filing Period *</label>
              <input value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none" placeholder="July 2026" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Total Amount (INR) *</label>
            <input type="number" step="any" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-semibold text-primary" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Description *</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required rows={2}
              className="w-full p-3 text-sm rounded-lg border bg-background outline-none" placeholder="E.g. Q3 HQ lease payment" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              Record Expense
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Expense Claims Component ────────────────────────────────────────
export function ExpenseClaims({ tab = "claims" }: Props) {
  const [claims, setClaims] = useState<ExpenseRecord[]>([
    { id: "EXP-2026-001", employee: "Ananya Sharma", department: "Sales", category: "Travel", description: "Flight tickets to client meeting in Bangalore", date: "2026-06-15", amount: 12400, status: "Approved" },
    { id: "EXP-2026-002", employee: "Rahul Verma", department: "Marketing", category: "Office Supplies", description: "Specialty presentation boards & markers", date: "2026-06-20", amount: 4800, status: "Pending" },
    { id: "EXP-2026-003", employee: "Ananya Sharma", department: "Sales", category: "Meals & Entertainment", description: "Business dinner with Acme team", date: "2026-06-16", amount: 9500, status: "Approved" },
    { id: "EXP-2026-004", employee: "Siddharth Sen", department: "IT & Engineering", category: "Software", description: "GitHub Enterprise license reimbursement", date: "2026-06-25", amount: 21000, status: "Pending" },
  ]);
  const [opexList, setOpexList] = useState<OpExRecord[]>([
    { id: "OPEX-001", category: "Rent", description: "Q3 2026 Head Office Lease", amount: 48000, period: "Jul–Sep 2026", approvedBy: "CFO", status: "Approved" },
    { id: "OPEX-002", category: "Utilities", description: "Electricity, water & internet", amount: 12000, period: "June 2026", approvedBy: "Finance", status: "Approved" },
    { id: "OPEX-003", category: "Insurance", description: "Annual business insurance renewal", amount: 24000, period: "FY2026", approvedBy: "CFO", status: "Approved" },
  ]);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showOpexModal, setShowOpexModal] = useState(false);

  const handleAddClaim = (newC: Partial<ExpenseRecord>) => {
    setClaims(p => [newC as ExpenseRecord, ...p]);
  };

  const handleAddOpex = (newO: Partial<OpExRecord>) => {
    setOpexList(p => [newO as OpExRecord, ...p]);
  };

  const handleApprove = (id: string) => {
    setClaims(p => p.map(c => c.id === id ? { ...c, status: "Approved" } : c));
    toast.success("Expense claim approved successfully!");
  };

  const handleReject = (id: string) => {
    setClaims(p => p.map(c => c.id === id ? { ...c, status: "Rejected" } : c));
    toast.success("Expense claim rejected!");
  };

  if (tab === "approvals") {
    const pending = claims.filter(e => e.status === "Pending");
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Expense Approvals</h1><p className="text-sm text-muted-foreground">Pending employee claims awaiting review.</p></div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-sm font-semibold">
            <Clock className="size-4" /> {pending.length} pending
          </div>
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
    const officeClaims = claims.filter(e => ["Office Supplies", "Software", "Meals & Entertainment"].includes(e.category));
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
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Operational Expenses</h1><p className="text-sm text-muted-foreground">Rent, utilities, insurance, and recurring operational costs.</p></div>
          <button onClick={() => setShowOpexModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Activity className="size-4" /> Add OpEx</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Period</th>
                  <th className="px-6 py-4 font-medium">Approved By</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {opexList.map((e, i) => (
                  <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary text-xs">{e.id}</td>
                    <td className="px-6 py-4"><span className="px-2.5 py-1 bg-secondary/50 rounded-md text-xs font-semibold">{e.category}</span></td>
                    <td className="px-6 py-4 text-muted-foreground font-semibold">{e.description}</td>
                    <td className="px-6 py-4 text-muted-foreground">{e.period}</td>
                    <td className="px-6 py-4 text-muted-foreground font-semibold">{e.approvedBy}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{fmt(e.amount)}</td>
                    <td className="px-6 py-4 text-center"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500">{e.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <AnimatePresence>
          {showOpexModal && (
            <OpExFormModal onClose={() => setShowOpexModal(false)} onSaved={handleAddOpex} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Default: expense_claims
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground font-bold">Expense Claims</h1><p className="text-sm text-muted-foreground">Employee business expense reimbursements.</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowClaimModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> New Claim</button>
        </div>
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
