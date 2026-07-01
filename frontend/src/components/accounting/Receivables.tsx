import React from "react";
import { motion } from "framer-motion";
import { Plus, Download, Search, ArrowRight, Clock, AlertTriangle } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

const statusStyle = (s: string) => {
  switch (s) {
    case "Paid": return "bg-emerald-500/10 text-emerald-500";
    case "Unpaid": return "bg-amber-500/10 text-amber-500";
    case "Overdue": return "bg-red-500/10 text-red-500";
    case "Partially Paid": return "bg-blue-500/10 text-blue-500";
    default: return "bg-muted text-muted-foreground";
  }
};

export function Receivables({ tab = "invoices" }: Props) {
  const { mockInvoices } = useAccountingData();

  if (tab === "customers") {
    const customers = [
      { id: "CUST-001", name: "Acme Corp", outstanding: 15200, invoices: 1, creditLimit: 50000, lastPayment: "2026-06-10", risk: "Low" },
      { id: "CUST-004", name: "David Chen", outstanding: 0, invoices: 0, creditLimit: 10000, lastPayment: "2026-06-15", risk: "Low" },
      { id: "EXT-001", name: "Davis Retail Group", outstanding: 4500.50, invoices: 1, creditLimit: 20000, lastPayment: "2026-05-20", risk: "Medium" },
      { id: "EXT-002", name: "Smith & Co", outstanding: 2100, invoices: 1, creditLimit: 15000, lastPayment: "2026-04-30", risk: "High" },
      { id: "CUST-005", name: "TechNova Solutions", outstanding: 4000, invoices: 1, creditLimit: 30000, lastPayment: "2026-06-01", risk: "Low" },
      { id: "CUST-003", name: "Global Trade LLC", outstanding: 0, invoices: 0, creditLimit: 25000, lastPayment: "2026-06-25", risk: "Low" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">AR Customers</h1><p className="text-sm text-muted-foreground">Customer credit limits, outstanding balances, and payment history.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Customer</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Customer ID</th>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 text-right font-medium">Outstanding</th>
                  <th className="px-6 py-4 text-center font-medium">Open Invoices</th>
                  <th className="px-6 py-4 text-right font-medium">Credit Limit</th>
                  <th className="px-6 py-4 font-medium">Last Payment</th>
                  <th className="px-6 py-4 text-center font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary">{c.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{c.name}</td>
                    <td className={`px-6 py-4 text-right font-semibold ${c.outstanding > 0 ? "text-amber-500" : "text-emerald-500"}`}>${c.outstanding.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">{c.invoices}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">${c.creditLimit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.lastPayment}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${c.risk === "Low" ? "bg-emerald-500/10 text-emerald-500" : c.risk === "Medium" ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"}`}>{c.risk}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "payments") {
    const payments = [
      { id: "PAY-001", customer: "David Chen", invoiceRef: "INV-2026-001", amount: 1500, date: "2026-06-15", method: "Bank Transfer", ref: "TXN-8841" },
      { id: "PAY-002", customer: "TechNova Solutions", invoiceRef: "INV-2026-004", amount: 4400, date: "2026-06-20", method: "Cheque", ref: "CHQ-4420" },
      { id: "PAY-003", customer: "Global Trade LLC", invoiceRef: "INV-2026-006", amount: 6750, date: "2026-06-25", method: "Bank Transfer", ref: "TXN-9001" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Payments Received</h1><p className="text-sm text-muted-foreground">All incoming customer payments and receipts.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Record Payment</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[{ label: "Received This Month", value: "$12,650", color: "text-emerald-500" }, { label: "Pending Clearance", value: "$4,400", color: "text-amber-500" }, { label: "Total YTD Collected", value: "$1.15M", color: "text-blue-500" }].map((s, i) => (
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
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium">Invoice Ref</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 font-medium">Transaction Ref</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{p.id}</td>
                    <td className="px-6 py-4">{p.customer}</td>
                    <td className="px-6 py-4 text-primary">{p.invoiceRef}</td>
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

  if (tab === "outstanding") {
    const aging = [
      { customer: "Acme Corp", current: 15200, days30: 0, days60: 0, days90: 0, total: 15200 },
      { customer: "Davis Retail Group", current: 0, days30: 4500.50, days60: 0, days90: 0, total: 4500.50 },
      { customer: "Smith & Co", current: 0, days30: 0, days60: 2100, days90: 0, total: 2100 },
      { customer: "TechNova Solutions", current: 4000, days30: 0, days60: 0, days90: 0, total: 4000 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Outstanding Receivables (AR Aging)</h1><p className="text-sm text-muted-foreground">Aging analysis of all unpaid customer invoices.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50"><Download className="size-4" /> Export Aging</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 text-right font-medium">Current</th>
                  <th className="px-6 py-4 text-right font-medium">1–30 Days</th>
                  <th className="px-6 py-4 text-right font-medium">31–60 Days</th>
                  <th className="px-6 py-4 text-right font-medium">61–90 Days</th>
                  <th className="px-6 py-4 text-right font-medium">Total Due</th>
                </tr>
              </thead>
              <tbody>
                {aging.map((row, i) => (
                  <motion.tr key={row.customer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{row.customer}</td>
                    <td className="px-6 py-4 text-right">{row.current > 0 ? `$${row.current.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right text-amber-500">{row.days30 > 0 ? `$${row.days30.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right text-orange-500">{row.days60 > 0 ? `$${row.days60.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right text-red-500">{row.days90 > 0 ? `$${row.days90.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">${row.total.toLocaleString()}</td>
                  </motion.tr>
                ))}
                <tr className="bg-muted/30 border-t border-border/50 font-semibold text-sm">
                  <td className="px-6 py-4">Total</td>
                  <td className="px-6 py-4 text-right">$19,200</td>
                  <td className="px-6 py-4 text-right text-amber-500">$4,500</td>
                  <td className="px-6 py-4 text-right text-orange-500">$2,100</td>
                  <td className="px-6 py-4 text-right text-red-500">—</td>
                  <td className="px-6 py-4 text-right text-primary">$25,800</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "collections") {
    const activities = [
      { customer: "Smith & Co", amount: 2100, daysOverdue: 51, lastContact: "2026-06-20", method: "Email", nextFollowUp: "2026-07-05", status: "In Progress" },
      { customer: "Davis Retail Group", amount: 4500.50, daysOverdue: 11, lastContact: "2026-06-28", method: "Phone", nextFollowUp: "2026-07-08", status: "Promised" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Collections</h1><p className="text-sm text-muted-foreground">Track follow-ups and collection activities for overdue invoices.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Log Activity</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[{ label: "Accounts in Collection", value: 2 }, { label: "Total Overdue", value: "$6,600" }, { label: "Avg Days Overdue", value: "31 days" }].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p><p className="text-2xl font-bold text-foreground">{s.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="space-y-4">
          {activities.map((a, i) => (
            <motion.div key={a.customer} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-red-500/20 bg-red-500/5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{a.customer}</h3>
                  <p className="text-sm text-red-500 font-medium">{a.daysOverdue} days overdue · ${a.amount.toLocaleString()} outstanding</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${a.status === "Promised" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{a.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-muted-foreground text-xs">Last Contact</p><p className="font-medium">{a.lastContact} via {a.method}</p></div>
                <div><p className="text-muted-foreground text-xs">Next Follow-up</p><p className="font-medium">{a.nextFollowUp}</p></div>
                <div className="flex items-center gap-2 justify-end">
                  <button className="px-3 py-1.5 bg-primary text-white rounded-md text-xs hover:opacity-90">Log Call</button>
                  <button className="px-3 py-1.5 border border-border/50 rounded-md text-xs hover:bg-muted">Send Email</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Default: invoices
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Invoices</h1><p className="text-sm text-muted-foreground">Customer invoices — track status, payments, and overdue amounts.</p></div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50"><Download className="size-4" /> Export</button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> New Invoice</button>
        </div>
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Invoice ID</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Issue Date</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
                <th className="px-6 py-4 text-right font-medium">Balance Due</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {mockInvoices.map((inv, i) => (
                <motion.tr key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{inv.id}</td>
                  <td className="px-6 py-4"><p className="font-medium">{inv.customerName}</p><p className="text-xs text-muted-foreground">{inv.customerId}</p></td>
                  <td className="px-6 py-4 text-muted-foreground">{inv.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{inv.dueDate}</td>
                  <td className="px-6 py-4 text-right font-medium">${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right font-medium">${inv.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle(inv.status)}`}>{inv.status}</span></td>
                  <td className="px-6 py-4 text-right"><button className="text-primary text-sm hover:underline inline-flex items-center gap-1">View <ArrowRight className="size-3" /></button></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
