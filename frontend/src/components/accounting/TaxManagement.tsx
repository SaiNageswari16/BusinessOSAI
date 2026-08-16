import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, AlertTriangle, X, Save, Loader2, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { taxApi, TaxReturn, TaxCode, TaxPayment } from "@/lib/api-client";
import { fmt, statusStyle, typeStyle } from "@/components/accounting/utils";
import { useCurrency } from "@/hooks/use-currency";

interface Props { tab?: string; }

interface TaxRule {
  id: string;
  name: string;
  type: string;
  rate: number;
  appliesTo: string;
  status: string;
}

// ─── Modal: Add Tax Rule ─────────────────────────────────────────────────
function TaxRuleFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (rule: Partial<TaxRule>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    tax_type: "GST",
    rate: 18,
    is_inclusive: false,
    is_active: true,
    effective_from: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await taxApi.createTaxCode({
        name: form.name,
        code: form.code || form.name.toUpperCase().slice(0, 6),
        tax_type: form.tax_type,
        rate: form.rate,
        is_inclusive: form.is_inclusive,
        is_active: form.is_active,
        effective_from: form.effective_from,
      });
      toast.success("Tax Rule created!");
      onSaved({
        id: created.id,
        name: created.name,
        type: created.tax_type,
        rate: created.rate,
        appliesTo: created.code,
        status: created.is_active ? "Active" : "Inactive",
      });
      onClose();
    } catch {
      toast.error("Failed to create tax rule");
    } finally {
      setSaving(false);
    }
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
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Standard GST 18%" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Tax Type *</label>
              <select value={form.tax_type} onChange={e => setForm(p => ({ ...p, tax_type: e.target.value }))} required
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

// ─── Main Tax Management Component ───────────────────────────────────────
export function TaxManagement({ tab = "gst" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const [returns, setReturns] = useState<TaxReturn[]>([]);
  const [rules, setRules] = useState<TaxRule[]>([]);
  const [payments, setPayments] = useState<TaxPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  const handleAddRule = (newRule: Partial<TaxRule>) => {
    setRules(p => [newRule as TaxRule, ...p]);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [returnsRes, codesRes, paymentsRes] = await Promise.all([
        taxApi.listTaxReturns(),
        taxApi.listTaxCodes(),
        taxApi.listTaxPayments(),
      ]);
      setReturns(returnsRes.items || []);
      setRules((codesRes.items || []).map(r => ({
        id: r.id,
        name: r.name,
        type: r.tax_type,
        rate: r.rate,
        appliesTo: r.code,
        status: r.is_active ? "Active" : "Inactive",
      })));
      setPayments(paymentsRes.items || []);
    } catch {
      toast.error("Failed to load tax data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (["gst", "tds", "vat", "tax_rules", "tax_filing"].includes(tab)) {
      loadData();
    }
  }, [tab]);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading tax data…</div>;
  }

  const typeFilter: Record<string, string> = { gst: "GST", tds: "TDS", vat: "VAT" };
  const targetType = typeFilter[tab];
  const filteredReturns = targetType ? returns.filter(r => r.return_type === targetType) : returns;
  const titleMap: Record<string, string> = { gst: "GST Returns", tds: "TDS (Tax Deducted at Source)", vat: "VAT Management", tax_rules: "Tax Rules", tax_filing: "Tax Filing Calendar" };
  const title = titleMap[tab] || "Tax Management";

  if (tab === "tax_rules") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Tax Rules</h1><p className="text-sm text-muted-foreground">Configure tax rates and rules applied to transactions.</p></div>
          <button onClick={() => setShowRuleModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Rule</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr><th className="px-6 py-4 font-medium">ID</th><th className="px-6 py-4 font-medium">Name</th><th className="px-6 py-4 font-medium">Type</th><th className="px-6 py-4 text-right font-medium">Rate</th><th className="px-6 py-4 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {rules.map((r, i) => (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary text-xs">{r.id}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">{r.name}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${typeStyle(r.type)}`}>{r.type}</span></td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{r.rate}%</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusStyle(r.status)}`}>{r.status}</span></td>
                  </motion.tr>
                ))}
                {rules.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No tax rules configured.</td></tr>
                )}
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
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Tax Filing Calendar</h1><p className="text-sm text-muted-foreground">Due dates, filings, and compliance status.</p></div>
        </div>
        <div className="space-y-3">
          {returns.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`glass-panel p-5 rounded-xl border flex justify-between items-center ${r.status === "pending" ? "border-amber-500/30 bg-amber-500/5" : "border-border/50"}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${r.status === "filed" ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                  {r.status === "filed" ? <CheckCircle className="size-5 text-emerald-500" /> : <Clock className="size-5 text-amber-500" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{r.return_type} — {r.id.slice(0, 12)}</p>
                  <p className="text-sm text-muted-foreground">{r.period_start} to {r.period_end}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyle(r.status)}`}>{r.status}</span>
            </motion.div>
          ))}
          {returns.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No tax returns found.</p>
          )}
        </div>
      </div>
    );
  }

  const totalPaid = filteredReturns.reduce((s, r) => s + Number(r.total_tax_amount || 0), 0);
  const pendingCount = filteredReturns.filter(r => r.status === "pending").length;

  const paidByReturn = payments.reduce((acc, p) => {
    if (p.tax_return_id) {
      acc[p.tax_return_id] = (acc[p.tax_return_id] || 0) + Number(p.amount || 0);
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">Track filings, payments, and compliance status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Tax", value: fmt(totalPaid), icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Pending Filings", value: String(pendingCount), icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Returns", value: String(filteredReturns.length), icon: AlertTriangle, color: "text-blue-500", bg: "bg-blue-500/10" },
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
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Period</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 text-right font-medium">Taxable</th>
                <th className="px-6 py-4 text-right font-medium">Tax Amount</th>
                <th className="px-6 py-4 text-right font-medium">Paid</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.map((tax, i) => (
                <motion.tr key={tax.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-mono text-primary text-xs">{tax.id}</td>
                  <td className="px-6 py-4 text-muted-foreground font-semibold">{tax.period}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${typeStyle(tax.return_type)}`}>{tax.return_type}</span></td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(tax.total_taxable_value)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(tax.total_tax_amount)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-500">{fmt(paidByReturn[tax.id] || 0)}</td>
                  <td className="px-6 py-4 text-muted-foreground font-semibold">{tax.period_end}</td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusStyle(tax.status)}`}>{tax.status}</span></td>
                </motion.tr>
              ))}
              {filteredReturns.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No tax returns found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
