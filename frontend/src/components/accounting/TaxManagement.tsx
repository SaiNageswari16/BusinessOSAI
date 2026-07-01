import React from "react";
import { motion } from "framer-motion";
import { Calculator, CheckCircle, Clock, AlertTriangle, Plus, Download, Settings, FileCheck } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

export function TaxManagement({ tab = "tax_returns" }: Props) {
  const { mockTaxEntries } = useAccountingData();
  const typeFilter: Record<string, string> = { gst: "GST", tds: "TDS", vat: "VAT" };
  const filtered = typeFilter[tab] ? mockTaxEntries.filter(t => t.type === typeFilter[tab]) : mockTaxEntries;
  const titleMap: Record<string, string> = { gst: "GST Returns", tds: "TDS (Tax Deducted at Source)", vat: "VAT Management", tax_rules: "Tax Rules", tax_filing: "Tax Filing Calendar" };
  const title = titleMap[tab] || "Tax Management";

  if (tab === "tax_rules") {
    const rules = [
      { id: "RULE-001", name: "Standard GST 18%", type: "GST", rate: 18, appliesTo: "General Products & Services", status: "Active" },
      { id: "RULE-002", name: "Reduced GST 5%", type: "GST", rate: 5, appliesTo: "Essential Goods", status: "Active" },
      { id: "RULE-003", name: "Zero-rated GST", type: "GST", rate: 0, appliesTo: "Exports & SEZ Supplies", status: "Active" },
      { id: "RULE-004", name: "TDS on Professional Fees", type: "TDS", rate: 10, appliesTo: "Payments > ₹30,000", status: "Active" },
      { id: "RULE-005", name: "TDS on Rent", type: "TDS", rate: 10, appliesTo: "Monthly Rent > ₹50,000", status: "Active" },
      { id: "RULE-006", name: "Standard VAT 5%", type: "VAT", rate: 5, appliesTo: "Regional Sales", status: "Active" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Tax Rules</h1><p className="text-sm text-muted-foreground">Configure tax rates and rules applied to transactions.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Rule</button>
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
                    <td className="px-6 py-4 font-medium text-primary">{r.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{r.name}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-md text-xs font-semibold">{r.type}</span></td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{r.rate}%</td>
                    <td className="px-6 py-4 text-muted-foreground">{r.appliesTo}</td>
                    <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">{r.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
          <div><h1 className="text-2xl font-bold text-foreground">Tax Filing Calendar</h1><p className="text-sm text-muted-foreground">All tax return due dates, filings, and compliance status.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><FileCheck className="size-4" /> File Return</button>
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
      </div>
    );
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Paid": return "bg-emerald-500/10 text-emerald-500";
      case "Filed": return "bg-blue-500/10 text-blue-500";
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{typeFilter[tab] ? `Track ${typeFilter[tab]} filings, payments, and compliance.` : "GST, TDS, VAT — all tax filings and compliance."}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80">
            <Download className="size-4" /> Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> File Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Tax Paid (YTD)", value: "$235,500", icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Pending Filings", value: "2", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Next Due Date", value: "Aug 7, 2026", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
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
                <th className="px-6 py-4 font-medium text-right">Taxable Amount</th>
                <th className="px-6 py-4 font-medium text-right">Tax Amount</th>
                <th className="px-6 py-4 font-medium text-right">Paid</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {(filtered.length > 0 ? filtered : mockTaxEntries).map((tax, i) => (
                <motion.tr key={tax.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{tax.id}</td>
                  <td className="px-6 py-4 text-muted-foreground">{tax.period}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-semibold ${getTypeStyle(tax.type)}`}>{tax.type}</span></td>
                  <td className="px-6 py-4 text-right">${tax.taxableAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-medium">${tax.taxAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-medium text-emerald-500">${tax.paidAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-muted-foreground">{tax.dueDate}</td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(tax.status)}`}>{tax.status}</span></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
