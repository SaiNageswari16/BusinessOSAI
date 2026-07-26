import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, ArrowRight, X, Save, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { inventoryApi } from "@/lib/api-client";
import { fmt, statusStyle } from "@/components/accounting/utils";

interface Props { tab?: string; }

interface VendorBill {
  id: string;
  billNumber: string;
  vendorName: string;
  poNumber: string | null;
  date: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
}

interface VendorPayment {
  id: string;
  billNumber: string | null;
  vendor: string;
  amount: number;
  date: string;
  method: string;
  reference: string | null;
}

function mapBackendBill(b: any): VendorBill {
  return {
    id: b.id.slice(0, 12),
    billNumber: b.bill_number || "",
    vendorName: b.supplier_name || "—",
    poNumber: b.po_number,
    date: b.bill_date ? new Date(b.bill_date).toISOString().split("T")[0] : "—",
    dueDate: b.due_date ? new Date(b.due_date).toISOString().split("T")[0] : "—",
    amount: parseFloat(b.total_amount) || 0,
    paidAmount: parseFloat(b.paid_amount) || 0,
    balanceDue: (parseFloat(b.total_amount) || 0) - (parseFloat(b.paid_amount) || 0),
    status: b.status || "Draft",
  };
}

function mapBackendPayment(p: any): VendorPayment {
  return {
    id: p.id.slice(0, 12),
    billNumber: p.bill_number,
    vendor: "—",
    amount: parseFloat(p.amount_paid) || 0,
    date: p.payment_date ? new Date(p.payment_date).toISOString().split("T")[0] : "—",
    method: p.payment_method || "—",
    reference: p.reference_number,
  };
}

interface CreditNote { id: string; credit_note_number: string; vendor_name: string; amount: number; issue_date: string; status: string; notes?: string }
interface DebitNote { id: string; debit_note_number: string; vendor_name: string; amount: number; issue_date: string; status: string; notes?: string }
interface AgingRow { vendor_name: string; current: number; days_30: number; days_60: number; days_90: number; total_outstanding: number }

function mapBackendCreditNote(c: any): CreditNote {
  return { id: c.id.slice(0, 12), credit_note_number: c.credit_note_number || "", vendor_name: c.vendor_name || "—", amount: parseFloat(c.amount) || 0, issue_date: c.issue_date ? new Date(c.issue_date).toISOString().split("T")[0] : "—", status: c.status || "Issued", notes: c.notes };
}
function mapBackendDebitNote(d: any): DebitNote {
  return { id: d.id.slice(0, 12), debit_note_number: d.debit_note_number || "", vendor_name: d.vendor_name || "—", amount: parseFloat(d.amount) || 0, issue_date: d.issue_date ? new Date(d.issue_date).toISOString().split("T")[0] : "—", status: d.status || "Issued", notes: d.notes };
}
function bucketAging(bills: VendorBill[]): AgingRow[] {
  const map: Record<string, AgingRow> = {};
  for (const b of bills) {
    if (!map[b.vendorName]) map[b.vendorName] = { vendor_name: b.vendorName, current: 0, days_30: 0, days_60: 0, days_90: 0, total_outstanding: 0 };
    const row = map[b.vendorName];
    const days = b.balanceDue > 0 ? Math.floor((Date.now() - new Date(b.dueDate).getTime()) / 86400000) : 0;
    row.total_outstanding += b.balanceDue;
    if (days <= 0) row.current += b.balanceDue;
    else if (days <= 30) row.days_30 += b.balanceDue;
    else if (days <= 60) row.days_60 += b.balanceDue;
    else row.days_90 += b.balanceDue;
  }
  return Object.values(map).filter(r => r.total_outstanding > 0);
}

// ─── Modal: Add Bill ──────────────────────────────────────────────────────
function BillFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (bill: Partial<VendorBill>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bill_number: "",
    purchase_order_id: "",
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    total_amount: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await inventoryApi.createVendorBill({
        bill_number: form.bill_number,
        purchase_order_id: form.purchase_order_id,
        due_date: form.due_date,
        total_amount: form.total_amount,
      });
      toast.success("Vendor bill added successfully!");
      onSaved({ ...mapBackendBill(created), id: created.id.slice(0, 12) });
      onClose();
    } catch {
      toast.error("Failed to create vendor bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">Add Vendor Bill</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Bill Number *</label>
            <input value={form.bill_number} onChange={e => setForm(p => ({ ...p, bill_number: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="BILL-2026-001" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Purchase Order ID *</label>
            <input value={form.purchase_order_id} onChange={e => setForm(p => ({ ...p, purchase_order_id: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono" placeholder="UUID of PO" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Due Date *</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Total Amount (INR) *</label>
              <input type="number" step="any" value={form.total_amount} onChange={e => setForm(p => ({ ...p, total_amount: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" placeholder="0.00" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Add Bill
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: Pay Bill ──────────────────────────────────────────────────────
function PayBillModal({ bill, onClose, onSaved }: { bill: VendorBill; onClose: () => void; onSaved: (payment: Partial<VendorPayment>) => void }) {
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(bill.balanceDue);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > bill.balanceDue) {
      toast.error("Invalid payment amount");
      return;
    }
    setSaving(true);
    try {
      const created = await inventoryApi.createVendorPayment({
        vendor_bill_id: bill.id,
        payment_date: paymentDate,
        payment_method: "Bank Transfer",
        amount_paid: amount,
        reference_number: `TXN-${Date.now().toString().slice(-6)}`,
      });
      toast.success("Payment recorded successfully!");
      onSaved(mapBackendPayment(created));
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
          <h2 className="font-bold text-lg text-foreground font-semibold">Pay Vendor Bill</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Paying bill <span className="font-semibold text-foreground">{bill.billNumber}</span> to <span className="font-semibold text-foreground">{bill.vendorName}</span></p>
            <p className="text-xs text-muted-foreground mt-1">Outstanding Balance: <span className="font-semibold text-foreground">{fmt(bill.balanceDue)}</span></p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Payment Date *</label>
            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Payment Amount (INR) *</label>
            <input type="number" step="any" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" max={bill.balanceDue} />
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

// ─── Main Payables Component ───────────────────────────────────────────────
export function Payables({ tab = "bills" }: Props) {
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<VendorBill | null>(null);

  const loadBills = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getVendorBills();
      const mapped = (res || []).map(mapBackendBill);
      setBills(mapped);
    } catch {
      toast.error("Failed to load vendor bills");
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getVendorPayments();
      const mapped = (res || []).map(mapBackendPayment);
      setPayments(mapped);
    } catch {
      toast.error("Failed to load vendor payments");
    } finally {
      setLoading(false);
    }
  };

  const loadCreditNotes = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getVendorCreditNotes();
      setCreditNotes((res || []).map(mapBackendCreditNote));
    } catch { toast.error("Failed to load credit notes"); }
    finally { setLoading(false); }
  };

  const loadDebitNotes = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getVendorDebitNotes();
      setDebitNotes((res || []).map(mapBackendDebitNote));
    } catch { toast.error("Failed to load debit notes"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === "bills") loadBills();
    if (tab === "payments_made") loadPayments();
    if (tab === "credit_notes") loadCreditNotes();
    if (tab === "debit_notes") loadDebitNotes();
  }, [tab]);

  const handleAddBill = (newBill: Partial<VendorBill>) => {
    setBills(p => [newBill as VendorBill, ...p]);
  };

  const handlePayBill = (payment: Partial<VendorPayment>) => {
    if (!selectedBill) return;
    const paidAmount = payment.amount || 0;
    setBills(p => p.map(b => {
      if (b.id === selectedBill.id) {
        const nextPaid = b.paidAmount + paidAmount;
        const nextStatus = nextPaid >= b.amount ? "Paid" : "Partially Paid";
        return { ...b, paidAmount: nextPaid, balanceDue: b.amount - nextPaid, status: nextStatus };
      }
      return b;
    }));
    setPayments(p => [payment as VendorPayment, ...p]);
  };

  // Credit Notes tab
  if (tab === "credit_notes") {
    if (loading) return <div className="p-6 text-center text-muted-foreground">Loading credit notes…</div>;
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Credit Notes</h1><p className="text-sm text-muted-foreground">Vendor credits and refunds received.</p></div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr><th className="px-6 py-4 font-medium">CN Number</th><th className="px-6 py-4 font-medium">Vendor</th><th className="px-6 py-4 font-medium">Issue Date</th><th className="px-6 py-4 text-right font-medium">Amount</th><th className="px-6 py-4 text-center font-medium">Status</th></tr>
              </thead>
              <tbody>
                {creditNotes.map((cn, i) => (
                  <motion.tr key={cn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="px-6 py-4 font-medium text-foreground">{cn.credit_note_number}</td>
                    <td className="px-6 py-4">{cn.vendor_name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{cn.issue_date}</td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-500">{fmt(cn.amount)}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(cn.status)}`}>{cn.status}</span></td>
                  </motion.tr>
                ))}
                {creditNotes.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No credit notes found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Debit Notes tab
  if (tab === "debit_notes") {
    if (loading) return <div className="p-6 text-center text-muted-foreground">Loading debit notes…</div>;
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Debit Notes</h1><p className="text-sm text-muted-foreground">Debit memos and charges from vendors.</p></div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr><th className="px-6 py-4 font-medium">DN Number</th><th className="px-6 py-4 font-medium">Vendor</th><th className="px-6 py-4 font-medium">Issue Date</th><th className="px-6 py-4 text-right font-medium">Amount</th><th className="px-6 py-4 text-center font-medium">Status</th></tr>
              </thead>
              <tbody>
                {debitNotes.map((dn, i) => (
                  <motion.tr key={dn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="px-6 py-4 font-medium text-foreground">{dn.debit_note_number}</td>
                    <td className="px-6 py-4">{dn.vendor_name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{dn.issue_date}</td>
                    <td className="px-6 py-4 text-right font-semibold text-red-400">{fmt(dn.amount)}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(dn.status)}`}>{dn.status}</span></td>
                  </motion.tr>
                ))}
                {debitNotes.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No debit notes found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Vendor Aging tab
  if (tab === "vendor_aging") {
    const aging = useMemo(() => bucketAging(bills), [bills]);
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Vendor Aging</h1><p className="text-sm text-muted-foreground">Outstanding payables aging by vendor.</p></div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr><th className="px-6 py-4 font-medium">Vendor</th><th className="px-6 py-4 text-right font-medium">Current</th><th className="px-6 py-4 text-right font-medium">1-30 Days</th><th className="px-6 py-4 text-right font-medium">31-60 Days</th><th className="px-6 py-4 text-right font-medium">61-90 Days</th><th className="px-6 py-4 text-right font-medium">Total Outstanding</th></tr>
              </thead>
              <tbody>
                {aging.map((r, i) => (
                  <motion.tr key={r.vendor_name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="px-6 py-4 font-semibold text-foreground">{r.vendor_name}</td>
                    <td className="px-6 py-4 text-right text-emerald-500">{fmt(r.current)}</td>
                    <td className="px-6 py-4 text-right text-amber-500">{fmt(r.days_30)}</td>
                    <td className="px-6 py-4 text-right text-orange-500">{fmt(r.days_60)}</td>
                    <td className="px-6 py-4 text-right text-red-500">{fmt(r.days_90)}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{fmt(r.total_outstanding)}</td>
                  </motion.tr>
                ))}
                {aging.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No outstanding payables.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Payments Made tab
  if (tab === "payments_made") {
    if (loading) {
      return <div className="p-6 text-center text-muted-foreground">Loading payments…</div>;
    }
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Payments Made</h1><p className="text-sm text-muted-foreground">All outgoing vendor payments and disbursements.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Payment ID</th>
                  <th className="px-6 py-4 font-medium">Bill Ref</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{p.id}</td>
                    <td className="px-6 py-4 text-primary">{p.billNumber || "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{p.date}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded-md text-xs">{p.method}</span></td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{p.reference || "—"}</td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-500">{fmt(p.amount)}</td>
                  </motion.tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No payments recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: bills list
  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading bills…</div>;
  }

  const totalOutstanding = bills.reduce((sum, b) => sum + b.balanceDue, 0);
  const overdueOutstanding = bills.filter(b => b.status === "Overdue").reduce((sum, b) => sum + b.balanceDue, 0);
  const paidThisMonth = bills.filter(b => b.status === "Paid").reduce((sum, b) => sum + b.paidAmount, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Bills</h1>
          <p className="text-sm text-muted-foreground">Accounts Payable — manage, track and pay vendor liabilities.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Bill
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Outstanding", value: fmt(totalOutstanding), color: "text-amber-500" },
          { label: "Overdue Bills", value: fmt(overdueOutstanding), color: "text-red-500" },
          { label: "Paid This Month", value: fmt(paidThisMonth), color: "text-emerald-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-panel p-5 rounded-xl border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Bill ID</th>
                <th className="px-6 py-4 font-medium">Vendor</th>
                <th className="px-6 py-4 font-medium">Bill Date</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
                <th className="px-6 py-4 text-right font-medium">Paid</th>
                <th className="px-6 py-4 text-right font-medium">Balance Due</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill, i) => (
                <motion.tr key={bill.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{bill.billNumber}</td>
                  <td className="px-6 py-4 font-medium">{bill.vendorName}</td>
                  <td className="px-6 py-4 text-muted-foreground">{bill.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{bill.dueDate}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(bill.amount)}</td>
                  <td className="px-6 py-4 text-right text-emerald-500">{fmt(bill.paidAmount)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(bill.balanceDue)}</td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(bill.status)}`}>{bill.status}</span></td>
                  <td className="px-6 py-4 text-center">
                    {bill.balanceDue > 0 ? (
                      <button onClick={() => setSelectedBill(bill)} className="text-primary text-xs font-semibold hover:underline inline-flex items-center gap-1">Pay Bill →</button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </motion.tr>
              ))}
              {bills.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">No vendor bills found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <BillFormModal onClose={() => setShowAddModal(false)} onSaved={handleAddBill} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedBill && (
          <PayBillModal bill={selectedBill} onClose={() => setSelectedBill(null)} onSaved={handlePayBill} />
        )}
      </AnimatePresence>
    </div>
  );
}
