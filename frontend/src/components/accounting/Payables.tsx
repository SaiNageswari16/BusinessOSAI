import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, ArrowRight, X, Save, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props { tab?: string; }

interface VendorBill {
  id: string;
  vendorName: string;
  date: string;
  dueDate: string;
  amount: number;
  balanceDue: number;
  status: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

const statusStyle = (s: string) => {
  const status = s.toLowerCase();
  switch (status) {
    case "paid": return "bg-emerald-500/10 text-emerald-500";
    case "unpaid": return "bg-amber-500/10 text-amber-500";
    case "overdue": return "bg-red-500/10 text-red-500";
    default: return "bg-muted text-muted-foreground";
  }
};

// ─── Modal: Add Bill ─────────────────────────────────────────────────────
function BillFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (bill: Partial<VendorBill>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendorName: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    amount: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSaved({
        id: `BILL-2026-${Math.floor(100 + Math.random() * 900)}`,
        vendorName: form.vendorName,
        date: form.date,
        dueDate: form.dueDate,
        amount: form.amount,
        balanceDue: form.amount,
        status: "Unpaid"
      });
      toast.success("Vendor bill added successfully!");
      setSaving(false);
      onClose();
    }, 400);
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
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Vendor Name *</label>
            <input value={form.vendorName} onChange={e => setForm(p => ({ ...p, vendorName: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Tech Supplies Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Bill Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Due Date *</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Bill Total Amount (INR) *</label>
            <input type="number" step="any" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" placeholder="0.00" />
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

// ─── Modal: Pay Bill ─────────────────────────────────────────────────────
function PayBillModal({ bill, onClose, onSaved }: { bill: VendorBill; onClose: () => void; onSaved: (amountPaid: number) => void }) {
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(bill.balanceDue);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > bill.balanceDue) {
      toast.error("Invalid payment amount");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      onSaved(amount);
      toast.success("Payment recorded successfully!");
      setSaving(false);
      onClose();
    }, 400);
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
            <p className="text-sm text-muted-foreground">Paying bill <span className="font-semibold text-foreground">{bill.id}</span> to <span className="font-semibold text-foreground">{bill.vendorName}</span></p>
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

// ─── Main Payables Component ──────────────────────────────────────────────
export function Payables({ tab = "bills" }: Props) {
  const [bills, setBills] = useState<VendorBill[]>([
    { id: "BILL-2026-001", vendorName: "Prime Distributors", date: "2026-06-15", dueDate: "2026-07-15", amount: 15200, balanceDue: 15200, status: "Unpaid" },
    { id: "BILL-2026-002", vendorName: "Tech Supplies Ltd", date: "2026-06-20", dueDate: "2026-07-20", amount: 8400, balanceDue: 0, status: "Paid" },
    { id: "BILL-2026-003", vendorName: "Metro Logistics", date: "2026-06-10", dueDate: "2026-07-10", amount: 4200, balanceDue: 4200, status: "Overdue" },
    { id: "BILL-2026-004", vendorName: "Office Depot", date: "2026-06-25", dueDate: "2026-07-25", amount: 1250, balanceDue: 1250, status: "Unpaid" },
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<VendorBill | null>(null);

  const handleAddBill = (newBill: Partial<VendorBill>) => {
    setBills(p => [newBill as VendorBill, ...p]);
  };

  const handlePayBill = (amountPaid: number) => {
    if (!selectedBill) return;
    setBills(p => p.map(b => {
      if (b.id === selectedBill.id) {
        const nextBal = b.balanceDue - amountPaid;
        return {
          ...b,
          balanceDue: nextBal,
          status: nextBal <= 0 ? "Paid" : b.status
        };
      }
      return b;
    }));
  };

  if (tab === "payments_made") {
    const payments = [
      { id: "PAY-OUT-001", vendor: "Tech Supplies Ltd", billRef: "BILL-2026-002", amount: 8400, date: "2026-06-22", method: "Bank Transfer", ref: "TXN-5521" },
      { id: "PAY-OUT-002", vendor: "CloudHost Pro", billRef: "BILL-2026-005", amount: 2999, date: "2026-06-05", method: "Bank Transfer", ref: "TXN-5440" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Payments Made</h1><p className="text-sm text-muted-foreground">All outgoing vendor payments and disbursements.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Record Payment</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Payment ID</th>
                <th className="px-6 py-4 font-medium">Vendor</th>
                <th className="px-6 py-4 font-medium">Bill Ref</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Method</th>
                <th className="px-6 py-4 font-medium">Txn Ref</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{p.id}</td>
                  <td className="px-6 py-4 font-medium">{p.vendor}</td>
                  <td className="px-6 py-4 text-primary">{p.billRef}</td>
                  <td className="px-6 py-4 text-muted-foreground">{p.date}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded-md text-xs">{p.method}</span></td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{p.ref}</td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-500">{fmt(p.amount)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default: bills list
  const totalOutstanding = bills.reduce((sum, b) => sum + b.balanceDue, 0);
  const overdueOutstanding = bills.filter(b => b.status === "Overdue").reduce((sum, b) => sum + b.balanceDue, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-bold">Vendor Bills</h1>
          <p className="text-sm text-muted-foreground">Accounts Payable — manage, track and pay vendor liabilities.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Bill
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{ label: "Total Outstanding", value: fmt(totalOutstanding), color: "text-amber-500" }, { label: "Overdue Bills", value: fmt(overdueOutstanding), color: "text-red-500" }, { label: "Paid This Month", value: fmt(8400), color: "text-emerald-500" }].map((s, i) => (
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
                <th className="px-6 py-4 text-right font-medium">Balance Due</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill, i) => (
                <motion.tr key={bill.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{bill.id}</td>
                  <td className="px-6 py-4 font-medium">{bill.vendorName}</td>
                  <td className="px-6 py-4 text-muted-foreground">{bill.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{bill.dueDate}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(bill.amount)}</td>
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
