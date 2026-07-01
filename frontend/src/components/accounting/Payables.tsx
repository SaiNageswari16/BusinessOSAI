import React from "react";
import { motion } from "framer-motion";
import { Plus, Download, ArrowRight } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

const statusStyle = (s: string) => {
  switch (s) {
    case "Paid": return "bg-emerald-500/10 text-emerald-500";
    case "Unpaid": return "bg-amber-500/10 text-amber-500";
    case "Overdue": return "bg-red-500/10 text-red-500";
    default: return "bg-muted text-muted-foreground";
  }
};

export function Payables({ tab = "bills" }: Props) {
  const { mockVendorBills } = useAccountingData();

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
        <div className="grid grid-cols-3 gap-4">
          {[{ label: "Paid This Month", value: "$11,399", color: "text-emerald-500" }, { label: "Outstanding", value: "$38,050", color: "text-amber-500" }, { label: "Total YTD Paid", value: "$420K", color: "text-blue-500" }].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
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
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{p.id}</td>
                    <td className="px-6 py-4 font-medium">{p.vendor}</td>
                    <td className="px-6 py-4 text-primary">{p.billRef}</td>
                    <td className="px-6 py-4 text-muted-foreground">{p.date}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded-md text-xs">{p.method}</span></td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{p.ref}</td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-500">${p.amount.toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "credit_notes") {
    const notes = [
      { id: "CN-2026-001", vendor: "Prime Distributors", date: "2026-06-25", amount: 3200, reason: "Returned damaged goods — Batch #P221", linkedBill: "BILL-2026-001", status: "Applied" },
      { id: "CN-2026-002", vendor: "Metro Logistics", date: "2026-06-10", amount: 420, reason: "Short delivery — 2 units missing", linkedBill: "BILL-2026-003", status: "Pending" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Credit Notes</h1><p className="text-sm text-muted-foreground">Vendor credit notes received for returns and adjustments.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Credit Note</button>
        </div>
        <div className="space-y-4">
          {notes.map((note, i) => (
            <motion.div key={note.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm font-semibold text-primary">{note.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${note.status === "Applied" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{note.status}</span>
                  </div>
                  <p className="font-semibold text-foreground">{note.vendor}</p>
                  <p className="text-sm text-muted-foreground mt-1">{note.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">Linked to: {note.linkedBill} · {note.date}</p>
                </div>
                <p className="text-2xl font-bold text-emerald-500">-${note.amount.toLocaleString()}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "debit_notes") {
    const notes = [
      { id: "DN-2026-001", vendor: "Office World", date: "2026-07-01", amount: 185, reason: "Price variance — invoice higher than PO", linkedBill: "BILL-2026-004", status: "Raised" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Debit Notes</h1><p className="text-sm text-muted-foreground">Debit notes raised to vendors for price variances and disputes.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Raise Debit Note</button>
        </div>
        {notes.map((note, i) => (
          <motion.div key={note.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-sm font-semibold text-amber-500">{note.id}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">{note.status}</span>
                </div>
                <p className="font-semibold text-foreground">{note.vendor}</p>
                <p className="text-sm text-muted-foreground mt-1">{note.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">Linked to: {note.linkedBill} · {note.date}</p>
              </div>
              <p className="text-2xl font-bold text-amber-500">${note.amount.toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  if (tab === "vendor_aging") {
    const aging = [
      { vendor: "Prime Distributors", current: 32000, days30: 0, days60: 0, days90: 0, total: 32000 },
      { vendor: "Metro Logistics", current: 0, days30: 0, days60: 4200, days90: 0, total: 4200 },
      { vendor: "Office World", current: 1850, days30: 0, days60: 0, days90: 0, total: 1850 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Vendor Aging (AP Aging)</h1><p className="text-sm text-muted-foreground">Outstanding payables grouped by age.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50"><Download className="size-4" /> Export Aging</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Vendor</th>
                  <th className="px-6 py-4 text-right font-medium">Current</th>
                  <th className="px-6 py-4 text-right font-medium">1–30 Days</th>
                  <th className="px-6 py-4 text-right font-medium">31–60 Days</th>
                  <th className="px-6 py-4 text-right font-medium">61–90 Days</th>
                  <th className="px-6 py-4 text-right font-medium">Total Due</th>
                </tr>
              </thead>
              <tbody>
                {aging.map((row, i) => (
                  <motion.tr key={row.vendor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{row.vendor}</td>
                    <td className="px-6 py-4 text-right">{row.current > 0 ? `$${row.current.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right text-amber-500">{row.days30 > 0 ? `$${row.days30.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right text-orange-500">{row.days60 > 0 ? `$${row.days60.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right text-red-500">{row.days90 > 0 ? `$${row.days90.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">${row.total.toLocaleString()}</td>
                  </motion.tr>
                ))}
                <tr className="bg-muted/30 border-t border-border/50 font-semibold text-sm">
                  <td className="px-6 py-4">Total</td>
                  <td className="px-6 py-4 text-right">$33,850</td>
                  <td className="px-6 py-4 text-right text-amber-500">—</td>
                  <td className="px-6 py-4 text-right text-orange-500">$4,200</td>
                  <td className="px-6 py-4 text-right text-red-500">—</td>
                  <td className="px-6 py-4 text-right text-primary">$38,050</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: vendor_bills
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Vendor Bills</h1><p className="text-sm text-muted-foreground">All outstanding and paid vendor invoices.</p></div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50"><Download className="size-4" /> Export</button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Bill</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{ label: "Total Outstanding", value: "$38,050", color: "text-amber-500" }, { label: "Overdue Bills", value: "$4,200", color: "text-red-500" }, { label: "Paid This Month", value: "$11,399", color: "text-emerald-500" }].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-5 rounded-xl border border-border/50">
            <p className={`text-xs font-medium uppercase tracking-wider ${s.color} mb-2`}>{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
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
                <th className="px-6 py-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {mockVendorBills.map((bill, i) => (
                <motion.tr key={bill.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{bill.id}</td>
                  <td className="px-6 py-4 font-medium">{bill.vendorName}</td>
                  <td className="px-6 py-4 text-muted-foreground">{bill.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{bill.dueDate}</td>
                  <td className="px-6 py-4 text-right font-medium">${bill.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-medium">${bill.balanceDue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(bill.status)}`}>{bill.status}</span></td>
                  <td className="px-6 py-4 text-right"><button className="text-primary text-sm hover:underline inline-flex items-center gap-1">Pay <ArrowRight className="size-3" /></button></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
