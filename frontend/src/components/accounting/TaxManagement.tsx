import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, CheckCircle, Clock, AlertTriangle, Plus, Download, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props { tab?: string; }

interface TaxEntry {
  id: string;
  period: string;
  type: string;
  taxableAmount: number;
  taxAmount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
}

interface TaxRule {
  id: string;
  name: string;
  type: string;
  rate: number;
  appliesTo: string;
  status: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case "Paid": case "Filed": return "bg-emerald-500/10 text-emerald-500";
    case "Pending": return "bg-amber-500/10 text-amber-500";
    default: return "bg-muted text-muted-foreground";
  }
};

const getTypeStyle = (type: string) => {
  switch (type) {
    case "GST": return "text-indigo-500 bg-indigo-500/10";
    case "TDS": return "text-purple-500 bg-purple-500/10";
    case "VAT": return "text-cyan-500 bg-cyan-500/10";
    default: return "text-muted-foreground bg-muted";
  }
};

// ─── Modal: Add Tax Rule ─────────────────────────────────────────────────
function TaxRuleFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (rule: Partial<TaxRule>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "GST",
    rate: 18,
    appliesTo: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSaved({
        id: `RULE-${Math.floor(100 + Math.random() * 900)}`,
        name: form.name,
        type: form.type,
        rate: form.rate,
        appliesTo: form.appliesTo || "General Goods & Services",
        status: "Active"
      });
      toast.success("Tax Rule added successfully!");
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">Add Tax Rule</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Rule Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="CGST + SGST 18%" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Tax Type *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="GST">GST</option>
                <option value="TDS">TDS</option>
                <option value="VAT">VAT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Rate (%) *</label>
              <input type="number" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Applies To *</label>
            <input value={form.appliesTo} onChange={e => setForm(p => ({ ...p, appliesTo: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="General Products & Services" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Rule
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: File Tax Return ──────────────────────────────────────────────
function FileReturnModal({ onClose, onSaved }: { onClose: () => void; onSaved: (entry: Partial<TaxEntry>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    period: "Q2 2026",
    type: "GST",
    taxableAmount: 0,
    taxAmount: 0,
    dueDate: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSaved({
        id: `TAX-${Math.floor(100 + Math.random() * 900)}`,
        period: form.period,
        type: form.type,
        taxableAmount: form.taxableAmount,
        taxAmount: form.taxAmount,
        paidAmount: form.taxAmount,
        dueDate: form.dueDate,
        status: "Filed"
      });
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">File Tax Return</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Filing Period *</label>
              <input value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none" placeholder="June 2026" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Tax Type *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none">
                <option value="GST">GST</option>
                <option value="TDS">TDS</option>
                <option value="VAT">VAT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Taxable Value *</label>
              <input type="number" value={form.taxableAmount} onChange={e => setForm(p => ({ ...p, taxableAmount: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Tax Amount *</label>
              <input type="number" value={form.taxAmount} onChange={e => setForm(p => ({ ...p, taxAmount: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-semibold text-primary" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Due Date *</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              File & Record Pay
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Tax Management Component ───────────────────────────────────────
export function TaxManagement({ tab = "gst" }: Props) {
  const [entries, setEntries] = useState<TaxEntry[]>([
    { id: "TAX-2026-001", period: "June 2026", type: "GST", taxableAmount: 2500000, taxAmount: 450000, paidAmount: 450000, dueDate: "2026-07-20", status: "Filed" },
    { id: "TAX-2026-002", period: "Q2 2026", type: "TDS", taxableAmount: 850000, taxAmount: 85000, paidAmount: 85000, dueDate: "2026-07-07", status: "Filed" },
    { id: "TAX-2026-003", period: "June 2026", type: "VAT", taxableAmount: 320000, taxAmount: 16000, paidAmount: 0, dueDate: "2026-07-15", status: "Pending" },
  ]);
  const [rules, setRules] = useState<TaxRule[]>([
    { id: "RULE-001", name: "Standard GST 18%", type: "GST", rate: 18, appliesTo: "General Products & Services", status: "Active" },
    { id: "RULE-002", name: "Reduced GST 5%", type: "GST", rate: 5, appliesTo: "Essential Goods", status: "Active" },
    { id: "RULE-003", name: "Zero-rated GST", type: "GST", rate: 0, appliesTo: "Exports & SEZ Supplies", status: "Active" },
    { id: "RULE-004", name: "TDS on Professional Fees", type: "TDS", rate: 10, appliesTo: "Payments > ₹30,000", status: "Active" },
    { id: "RULE-005", name: "TDS on Rent", type: "TDS", rate: 10, appliesTo: "Monthly Rent > ₹50,000", status: "Active" },
  ]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);

  const handleAddRule = (newRule: Partial<TaxRule>) => {
    setRules(p => [newRule as TaxRule, ...p]);
  };

  const handleAddFiling = (newFiling: Partial<TaxEntry>) => {
    setEntries(p => [newFiling as TaxEntry, ...p]);
  };

  const typeFilter: Record<string, string> = { gst: "GST", tds: "TDS", vat: "VAT" };
  const targetType = typeFilter[tab];
  const filteredEntries = targetType ? entries.filter(t => t.type === targetType) : entries;
  const titleMap: Record<string, string> = { gst: "GST Returns", tds: "TDS (Tax Deducted at Source)", vat: "VAT Management", tax_rules: "Tax Rules", tax_filing: "Tax Filing Calendar" };
  const title = titleMap[tab] || "Tax Management";

  if (tab === "tax_rules") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Tax Rules</h1><p className="text-sm text-muted-foreground">Configure tax rates and rules applied to transactions.</p></div>
          <button onClick={() => setShowRuleModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Rule</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr><th className="px-6 py-4 font-medium">Rule ID</th><th className="px-6 py-4 font-medium">Name</th><th className="px-6 py-4 font-medium">Type</th><th className="px-6 py-4 text-right font-medium">Rate</th><th className="px-6 py-4 font-medium">Applies To</th><th className="px-6 py-4 text-center font-medium">Status</th></tr>
              </thead>
              <tbody>
                {rules.map((r, i) => (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary text-xs">{r.id}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{r.name}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-md text-xs font-semibold">{r.type}</span></td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{r.rate}%</td>
                    <td className="px-6 py-4 text-muted-foreground">{r.appliesTo}</td>
                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500">{r.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <AnimatePresence>
          {showRuleModal && (
            <TaxRuleFormModal onClose={() => setShowRuleModal(false)} onSaved={handleAddRule} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (tab === "tax_filing") {
    const filings = [
      { period: "Q2 2026 (Apr–Jun)", type: "GST", dueDate: "2026-07-20", status: "Filed", filedOn: "2026-07-18" },
      { period: "June 2026", type: "TDS", dueDate: "2026-07-07", status: "Filed", filedOn: "2026-07-06" },
      { period: "H1 2026", type: "VAT", dueDate: "2026-07-15", status: "Filed", filedOn: "2026-07-14" },
      { period: "Q3 2026 (Jul–Sep)", type: "GST", dueDate: "2026-10-20", status: "Pending", filedOn: "—" },
      { period: "July 2026", type: "TDS", dueDate: "2026-08-07", status: "Pending", filedOn: "—" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Tax Filing Calendar</h1><p className="text-sm text-muted-foreground">Due dates, filings, and compliance status.</p></div>
          <button onClick={() => setShowFileModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> File Return</button>
        </div>
        <div className="space-y-3">
          {filings.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`glass-panel p-5 rounded-xl border flex justify-between items-center ${f.status === "Pending" ? "border-amber-500/30 bg-amber-500/5" : "border-border/50"}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${f.status === "Filed" ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                  {f.status === "Filed" ? <CheckCircle className="size-5 text-emerald-500" /> : <Clock className="size-5 text-amber-500" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{f.type} — {f.period}</p>
                  <p className="text-sm text-muted-foreground">Due: {f.dueDate}{f.filedOn !== "—" ? ` · Filed: ${f.filedOn}` : ""}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${f.status === "Filed" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{f.status}</span>
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {showFileModal && (
            <FileReturnModal onClose={() => setShowFileModal(false)} onSaved={handleAddFiling} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  const totalPaid = filteredEntries.reduce((s, e) => s + e.paidAmount, 0);
  const pendingCount = filteredEntries.filter(e => e.status === "Pending").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">Track filings, payments, and compliance status.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFileModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> File Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Tax Paid", value: fmt(totalPaid), icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Pending Filings", value: String(pendingCount), icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Compliance Status", value: "100%", icon: AlertTriangle, color: "text-blue-500", bg: "bg-blue-500/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.bg}`}><s.icon className={`size-5 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Filing ID</th>
                <th className="px-6 py-4 font-medium">Period</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 text-right font-medium">Taxable Amount</th>
                <th className="px-6 py-4 text-right font-medium">Tax Amount</th>
                <th className="px-6 py-4 text-right font-medium">Paid</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((tax, i) => (
                <motion.tr key={tax.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-mono text-primary text-xs">{tax.id}</td>
                  <td className="px-6 py-4 text-muted-foreground font-semibold">{tax.period}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${getTypeStyle(tax.type)}`}>{tax.type}</span></td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(tax.taxableAmount)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(tax.taxAmount)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-500">{fmt(tax.paidAmount)}</td>
                  <td className="px-6 py-4 text-muted-foreground font-semibold">{tax.dueDate}</td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusStyle(tax.status)}`}>{tax.status}</span></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AnimatePresence>
        {showFileModal && (
          <FileReturnModal onClose={() => setShowFileModal(false)} onSaved={handleAddFiling} />
        )}
      </AnimatePresence>
    </div>
  );
}

