import React from "react";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";

interface Props { tab?: string; }

export function ProfitAndLoss({ tab = "profit_and_loss" }: Props) {

  if (tab === "trial_balance") {
    const trialBalance = [
      { code: "1000", name: "Cash in Bank", debit: 1250000.50, credit: 0 },
      { code: "1100", name: "Petty Cash", debit: 15000, credit: 0 },
      { code: "1200", name: "Accounts Receivable", debit: 450000, credit: 0 },
      { code: "1500", name: "Inventory", debit: 850000, credit: 0 },
      { code: "1600", name: "Fixed Assets (Net)", debit: 2100000, credit: 0 },
      { code: "2000", name: "Accounts Payable", debit: 0, credit: 210000 },
      { code: "2100", name: "GST Payable", debit: 0, credit: 48000 },
      { code: "2200", name: "Salaries Payable", debit: 0, credit: 85000 },
      { code: "3000", name: "Owner's Equity", debit: 0, credit: 1500000 },
      { code: "3100", name: "Retained Earnings", debit: 0, credit: 2100000 },
      { code: "4000", name: "Sales Revenue", debit: 0, credit: 3200000 },
      { code: "4100", name: "Service Revenue", debit: 0, credit: 480000 },
      { code: "5000", name: "Cost of Goods Sold", debit: 1400000, credit: 0 },
      { code: "5100", name: "Payroll Expenses", debit: 420000, credit: 0 },
      { code: "5200", name: "Rent & Utilities", debit: 96000, credit: 0 },
      { code: "5300", name: "Marketing", debit: 65000, credit: 0 },
      { code: "5400", name: "Depreciation", debit: 110000, credit: 0 },
    ];
    const totalDebit = trialBalance.reduce((s, r) => s + r.debit, 0);
    const totalCredit = trialBalance.reduce((s, r) => s + r.credit, 0);
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Trial Balance</h1><p className="text-sm text-muted-foreground">All account balances as of June 30, 2026 — debits must equal credits.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><FileText className="size-4" /> Export PDF</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Account Name</th>
                  <th className="px-6 py-4 text-right font-medium">Debit (DR)</th>
                  <th className="px-6 py-4 text-right font-medium">Credit (CR)</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.map((row, i) => (
                  <motion.tr key={row.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary text-xs">{row.code}</td>
                    <td className="px-6 py-4 text-foreground">{row.name}</td>
                    <td className="px-6 py-4 text-right text-emerald-500 font-medium">{row.debit > 0 ? `$${row.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : "—"}</td>
                    <td className="px-6 py-4 text-right text-red-400 font-medium">{row.credit > 0 ? `$${row.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : "—"}</td>
                  </motion.tr>
                ))}
                <tr className="bg-muted/30 border-t border-border/50 font-bold text-sm">
                  <td className="px-6 py-4" colSpan={2}>TOTALS</td>
                  <td className="px-6 py-4 text-right text-emerald-500">${totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right text-red-400">${totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {Math.abs(totalDebit - totalCredit) < 1 && (
          <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-sm text-emerald-600 font-medium">
            ✓ Trial Balance is balanced — Debits equal Credits.
          </div>
        )}
      </div>
    );
  }

  if (tab === "profit_forecast") {
    const quarters = [
      { period: "Q1 2026 (Actual)", revenue: 6750000, expenses: 4140000, profit: 2610000, margin: 38.7 },
      { period: "Q2 2026 (Actual)", revenue: 7750000, expenses: 4060000, profit: 3690000, margin: 47.6 },
      { period: "Q3 2026 (Forecast)", revenue: 4200000, expenses: 2600000, profit: 1600000, margin: 38.1 },
      { period: "Q4 2026 (Forecast)", revenue: 5100000, expenses: 2900000, profit: 2200000, margin: 43.1 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Profit Forecast</h1><p className="text-sm text-muted-foreground">Quarterly actual vs. forecast profit performance for FY 2026.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><FileText className="size-4" /> Export Forecast</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Period</th>
                  <th className="px-6 py-4 text-right font-medium">Revenue</th>
                  <th className="px-6 py-4 text-right font-medium">Expenses</th>
                  <th className="px-6 py-4 text-right font-medium">Net Profit</th>
                  <th className="px-6 py-4 text-right font-medium">Margin %</th>
                  <th className="px-6 py-4 text-center font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {quarters.map((q, i) => (
                  <motion.tr key={q.period} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                    className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${q.period.includes("Forecast") ? "bg-blue-500/3" : ""}`}>
                    <td className="px-6 py-4 font-semibold text-foreground">{q.period}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-500">${q.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-medium text-red-400">${q.expenses.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">${q.profit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-blue-400">{q.margin}%</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${q.period.includes("Forecast") ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                        {q.period.includes("Forecast") ? "Forecast" : "Actual"}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: profit_and_loss full statement
  const rows = [
    { label: "Sales Revenue", amount: 3200000, type: "revenue" },
    { label: "Service Revenue", amount: 480000, type: "revenue" },
    { label: "Other Income", amount: 95000, type: "revenue" },
    { label: "Gross Revenue", amount: 3775000, type: "subtotal" },
    { label: "Cost of Goods Sold", amount: -1400000, type: "expense" },
    { label: "Gross Profit", amount: 2375000, type: "subtotal" },
    { label: "Payroll Expenses", amount: -420000, type: "expense" },
    { label: "Rent & Utilities", amount: -96000, type: "expense" },
    { label: "Marketing & Advertising", amount: -65000, type: "expense" },
    { label: "Depreciation", amount: -110000, type: "expense" },
    { label: "Other Operating Expenses", amount: -48000, type: "expense" },
    { label: "Total Operating Expenses", amount: -739000, type: "subtotal" },
    { label: "Net Profit", amount: 1636000, type: "total" },
  ];
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Profit & Loss Statement</h1><p className="text-sm text-muted-foreground">Income statement for the period ending June 30, 2026.</p></div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><FileText className="size-4" /> Export PDF</button>
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="p-6 border-b border-border/50 bg-muted/20">
          <h2 className="font-semibold text-foreground">Nimbus Retail Group</h2>
          <p className="text-sm text-muted-foreground">Profit & Loss — January 1, 2026 to June 30, 2026</p>
        </div>
        <div className="divide-y divide-border/30">
          {rows.map((row, i) => (
            <motion.div key={row.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className={`flex justify-between items-center px-6 py-3 ${
                row.type === "total" ? "bg-primary/5 font-bold text-primary" :
                row.type === "subtotal" ? "bg-muted/20 font-semibold text-foreground" :
                "hover:bg-muted/10"
              } transition-colors`}>
              <span className={`text-sm ${row.type === "expense" || row.type === "revenue" ? "pl-4 text-muted-foreground" : ""}`}>{row.label}</span>
              <span className={`text-sm font-medium ${row.type === "total" ? "text-primary text-base" : row.amount < 0 ? "text-red-500" : "text-foreground"}`}>
                {row.amount < 0 ? `-$${Math.abs(row.amount).toLocaleString()}` : `$${row.amount.toLocaleString()}`}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
