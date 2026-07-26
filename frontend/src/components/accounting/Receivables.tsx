import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, Search, ArrowRight, Clock, AlertTriangle, RefreshCw, Loader2, X, Save, AlertCircle, CheckCircle } from "lucide-react";
import { invoicesApi, Invoice } from "@/lib/api-client";
import { toast } from "sonner";

interface Props { tab?: string; }

const statusStyle = (s: string) => {
  const status = s.toLowerCase();
  switch (status) {
    case "paid": return "bg-emerald-500/10 text-emerald-500";
    case "unpaid": case "draft": return "bg-amber-500/10 text-amber-500";
    case "overdue": return "bg-red-500/10 text-red-500";
    case "partially_paid": case "partially paid": return "bg-blue-500/10 text-blue-500";
    default: return "bg-muted text-muted-foreground";
  }
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

// ─── Modal: New Invoice ──────────────────────────────────────────────────
function InvoiceFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    invoice_type: "tax_invoice",
    currency_code: "INR",
  });
  const [lines, setLines] = useState([
    { product_name: "", quantity: 1, unit_price: 0, tax_rate: 18 }
  ]);

  const handleAddLine = () => {
    setLines(p => [...p, { product_name: "", quantity: 1, unit_price: 0, tax_rate: 18 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines(p => p.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, val: any) => {
    setLines(p => p.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.some(l => !l.product_name)) {
      toast.error("All lines must have a description/product name!");
      return;
    }
    setSaving(true);
    try {
      await invoicesApi.createInvoice({
        ...form,
        lines: lines.map(l => ({
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate
        }))
      });
      toast.success("Invoice created successfully!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground">Create Customer Invoice</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Customer Name *</label>
              <input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Acme Corp Pvt Ltd" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Customer Email</label>
              <input type="email" value={form.customer_email} onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="billing@acme.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Invoice Date *</label>
              <input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Due Date *</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground font-semibold">Invoice Items</h3>
              <button type="button" onClick={handleAddLine} className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold rounded-lg flex items-center gap-1">
                <Plus className="size-3" /> Add Item
              </button>
            </div>

            <div className="border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-2 font-medium">Item Description</th>
                    <th className="px-4 py-2 font-medium text-right w-20">Qty</th>
                    <th className="px-4 py-2 font-medium text-right w-28">Unit Price</th>
                    <th className="px-4 py-2 font-medium text-right w-20">Tax %</th>
                    <th className="px-3 py-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-border/50 last:border-0">
                      <td className="p-2">
                        <input value={line.product_name} onChange={e => updateLine(idx, "product_name", e.target.value)} required
                          className="w-full h-8 px-2 text-xs rounded-lg border bg-background font-medium" placeholder="Consulting Services, POS Terminals..." />
                      </td>
                      <td className="p-2 w-20">
                        <input type="number" value={line.quantity} onChange={e => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)} required
                          className="w-full h-8 px-2 text-xs text-right rounded-lg border bg-background" />
                      </td>
                      <td className="p-2 w-28">
                        <input type="number" value={line.unit_price} onChange={e => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)} required
                          className="w-full h-8 px-2 text-xs text-right rounded-lg border bg-background font-semibold" placeholder="0.00" />
                      </td>
                      <td className="p-2 w-20">
                        <input type="number" value={line.tax_rate} onChange={e => updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)} required
                          className="w-full h-8 px-2 text-xs text-right rounded-lg border bg-background" />
                      </td>
                      <td className="p-2 text-center w-12">
                        <button type="button" onClick={() => handleRemoveLine(idx)} disabled={lines.length <= 1}
                          className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors disabled:opacity-30">
                          <X className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Create Invoice
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: Record Payment ───────────────────────────────────────────────
function RecordPaymentModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(invoice.balance_due);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > invoice.balance_due) {
      toast.error(`Amount must be between 0 and outstanding balance ${fmt(invoice.balance_due)}`);
      return;
    }
    setSaving(true);
    try {
      await invoicesApi.recordPayment(invoice.id, {
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod
      });
      toast.success("Payment recorded successfully!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground">Record Payment</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Recording payment for invoice <span className="font-semibold text-foreground">{invoice.invoice_number}</span></p>
            <p className="text-xs text-muted-foreground mt-1">Outstanding Balance: <span className="font-semibold text-foreground">{fmt(invoice.balance_due)}</span></p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Payment Date *</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Amount Received (INR) *</label>
            <input type="number" step="any" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" max={invoice.balance_due} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Payment Method *</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || amount <= 0} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Record Payment
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Receivables Component ───────────────────────────────────────────
export function Receivables({ tab = "invoices" }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoicesApi.listInvoices({ page: 1, page_size: 50, status: statusFilter || undefined, search: search || undefined });
      setInvoices(res.items);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    try {
      await invoicesApi.sendInvoice(id); // Using sendInvoice as approval workflow helper
      toast.success("Invoice sent/approved!");
      load();
    } catch {
      toast.error("Failed to approve invoice");
    }
  };

  if (tab === "customers") {
    const customers = [
      { id: "CUST-001", name: "Acme Corporation", outstanding: 14160, invoices: 1, creditLimit: 150000, risk: "Low" },
      { id: "CUST-002", name: "Globex Biotech", outstanding: 2655, invoices: 1, creditLimit: 75000, risk: "Low" }
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">AR Customers</h1><p className="text-sm text-muted-foreground">Customer credit limits, outstanding balances, and risk status.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Customer</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Customer ID</th>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 text-right font-medium">Outstanding Balance</th>
                <th className="px-6 py-4 text-center font-medium">Open Invoices</th>
                <th className="px-6 py-4 text-right font-medium">Credit Limit</th>
                <th className="px-6 py-4 text-center font-medium">Risk Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-primary">{c.id}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{c.name}</td>
                  <td className={`px-6 py-4 text-right font-semibold ${c.outstanding > 0 ? "text-amber-500" : "text-emerald-500"}`}>{fmt(c.outstanding)}</td>
                  <td className="px-6 py-4 text-center">{c.invoices}</td>
                  <td className="px-6 py-4 text-right text-muted-foreground">{fmt(c.creditLimit)}</td>
                  <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">{c.risk}</span></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default: invoices list
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage and track customer sales invoices.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <button onClick={load} className="p-2 border border-border rounded-lg hover:bg-muted/50 transition-colors"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="size-8 animate-spin text-primary" /></div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <AlertCircle className="size-8 mb-2" /><p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-5 py-3 font-medium">Invoice #</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 text-right font-medium">Total Amount</th>
                  <th className="px-5 py-3 text-right font-medium">Balance Due</th>
                  <th className="px-5 py-3 text-center font-medium">Status</th>
                  <th className="px-5 py-3 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <motion.tr key={inv.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-primary font-semibold">{inv.invoice_number}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{inv.customer_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{inv.invoice_date}</td>
                    <td className="px-5 py-3 text-muted-foreground">{inv.due_date || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{fmt(inv.total_amount)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{fmt(inv.balance_due)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusStyle(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center flex items-center justify-center gap-1.5">
                      {inv.status.toLowerCase() === "draft" && (
                        <button onClick={() => handleApprove(inv.id)} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-semibold hover:bg-primary/20 transition-colors">Approve</button>
                      )}
                      {inv.balance_due > 0 && (
                        <button onClick={() => setSelectedInvoice(inv)} className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-semibold hover:bg-emerald-500/20 transition-colors">Record Pay</button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <InvoiceFormModal onClose={() => setShowAddModal(false)} onSaved={load} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedInvoice && (
          <RecordPaymentModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onSaved={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
