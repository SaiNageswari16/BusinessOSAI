import React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight,
  LineChart, PieChart, BarChart3, Activity, CreditCard, FileText
} from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

export function FinanceDashboard({ tab = "overview" }: Props) {
  const { mockFinanceStats, mockInvoices, mockVendorBills } = useAccountingData();
  const s = mockFinanceStats;

  if (tab === "cash_flow" || tab === "cash_flow_statement") {
    const cashFlows = [
      { category: "Operating Activities", items: [
        { label: "Net Income", amount: 1636000 },
        { label: "Depreciation Add-back", amount: 110000 },
        { label: "Decrease in Receivables", amount: -450000 },
        { label: "Increase in Payables", amount: 210000 },
      ]},
      { category: "Investing Activities", items: [
        { label: "Purchase of Fixed Assets", amount: -95000 },
        { label: "Proceeds from Asset Disposal", amount: 12000 },
      ]},
      { category: "Financing Activities", items: [
        { label: "Short-term Loan Drawdown", amount: 300000 },
        { label: "Owner Drawings", amount: -200000 },
      ]},
    ];
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cash Flow Statement</h1>
          <p className="text-sm text-muted-foreground">Period: January 1, 2026 – June 30, 2026</p>
        </div>
        {cashFlows.map((section, si) => {
          const total = section.items.reduce((s, i) => s + i.amount, 0);
          return (
            <div key={section.category} className="glass-panel rounded-xl border border-border/50 overflow-hidden">
              <div className="px-6 py-4 bg-muted/20 border-b border-border/50">
                <h3 className="font-semibold text-foreground">{section.category}</h3>
              </div>
              <div className="divide-y divide-border/30">
                {section.items.map((item, i) => (
                  <motion.div key={item.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: si * 0.1 + i * 0.04 }}
                    className="flex justify-between items-center px-6 py-3 hover:bg-muted/10 transition-colors">
                    <span className="text-sm text-muted-foreground pl-4">{item.label}</span>
                    <span className={`text-sm font-medium ${item.amount < 0 ? "text-red-500" : "text-foreground"}`}>
                      {item.amount < 0 ? `-$${Math.abs(item.amount).toLocaleString()}` : `$${item.amount.toLocaleString()}`}
                    </span>
                  </motion.div>
                ))}
                <div className="flex justify-between px-6 py-4 bg-muted/30 font-semibold text-sm">
                  <span>Net {section.category}</span>
                  <span className={total >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {total >= 0 ? `$${total.toLocaleString()}` : `-$${Math.abs(total).toLocaleString()}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="glass-panel p-5 rounded-xl border border-primary/30 bg-primary/5 flex justify-between items-center">
          <span className="font-semibold text-foreground">Net Change in Cash</span>
          <span className="text-xl font-bold text-primary">$1,523,000</span>
        </div>
      </div>
    );
  }

  if (tab === "revenue") {
    const revenueBreakdown = [
      { channel: "Retail In-Store", amount: 1450000, pct: 45, trend: "+8.2%", pos: true },
      { channel: "Online / eCommerce", amount: 980000, pct: 31, trend: "+22.4%", pos: true },
      { channel: "Wholesale", amount: 450000, pct: 14, trend: "-3.1%", pos: false },
      { channel: "Service Revenue", amount: 480000, pct: 10, trend: "+11.5%", pos: true },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Revenue</h1><p className="text-sm text-muted-foreground">Revenue breakdown by channel — YTD 2026.</p></div>
        <div className="glass-panel p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-4">
          <TrendingUp className="size-8 text-emerald-500" />
          <div>
            <p className="text-sm text-muted-foreground">Total Revenue YTD</p>
            <p className="text-3xl font-bold text-foreground">${(s.totalRevenueYTD / 1000000).toFixed(2)}M</p>
          </div>
          <span className="ml-auto text-emerald-500 font-semibold text-lg">+12.5% YoY</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {revenueBreakdown.map((r, i) => (
            <motion.div key={r.channel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-foreground">{r.channel}</h3>
                <span className={`text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 ${r.pos ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                  {r.pos ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{r.trend}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground mb-2">${r.amount.toLocaleString()}</p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{r.pct}% of total revenue</p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "expenses") {
    const expenseBreakdown = [
      { category: "Cost of Goods Sold", amount: 1400000, pct: 17, color: "bg-red-500" },
      { category: "Payroll & Benefits", amount: 420000, pct: 5.1, color: "bg-amber-500" },
      { category: "Rent & Utilities", amount: 96000, pct: 1.2, color: "bg-orange-500" },
      { category: "Marketing", amount: 65000, pct: 0.8, color: "bg-purple-500" },
      { category: "Depreciation", amount: 110000, pct: 1.3, color: "bg-blue-500" },
      { category: "Other Expenses", amount: 209000, pct: 2.5, color: "bg-cyan-500" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Expenses</h1><p className="text-sm text-muted-foreground">Expense breakdown by category — YTD 2026.</p></div>
        <div className="glass-panel p-5 rounded-xl border border-red-500/30 bg-red-500/5 flex items-center gap-4">
          <TrendingDown className="size-8 text-red-500" />
          <div>
            <p className="text-sm text-muted-foreground">Total Expenses YTD</p>
            <p className="text-3xl font-bold text-foreground">${(s.totalExpensesYTD / 1000000).toFixed(2)}M</p>
          </div>
          <span className="ml-auto text-emerald-500 font-semibold text-lg">-2.4% vs Budget</span>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium text-right">Amount</th>
                  <th className="px-6 py-4 font-medium">% of Revenue</th>
                  <th className="px-6 py-4 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {expenseBreakdown.map((exp, i) => (
                  <motion.tr key={exp.category} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{exp.category}</td>
                    <td className="px-6 py-4 text-right font-medium">${exp.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-muted-foreground">{exp.pct}%</td>
                    <td className="px-6 py-4 w-40">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${exp.color}`} style={{ width: `${exp.pct * 5}%` }} />
                      </div>
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

  if (tab === "profit") {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const profitData = [
      { month: "Jan", revenue: 2100000, expenses: 1380000, profit: 720000, margin: 34.3 },
      { month: "Feb", revenue: 2250000, expenses: 1410000, profit: 840000, margin: 37.3 },
      { month: "Mar", revenue: 2400000, expenses: 1350000, profit: 1050000, margin: 43.8 },
      { month: "Apr", revenue: 2350000, expenses: 1290000, profit: 1060000, margin: 45.1 },
      { month: "May", revenue: 2580000, expenses: 1300000, profit: 1280000, margin: 49.6 },
      { month: "Jun", revenue: 2820000, expenses: 1470000, profit: 1350000, margin: 47.9 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Profit Analysis</h1><p className="text-sm text-muted-foreground">Monthly profit performance — H1 2026.</p></div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Net Profit (YTD)", value: `$${(s.netProfit / 1000000).toFixed(2)}M`, color: "text-emerald-500", trend: "+15.2%" },
            { label: "Profit Margin", value: `${s.profitMargin}%`, color: "text-blue-500", trend: "+2.1pp" },
            { label: "Best Month (Jun)", value: "$1.35M", color: "text-indigo-500", trend: "+47.9% margin" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-emerald-500 mt-1">{s.trend}</p>
            </motion.div>
          ))}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Month</th>
                  <th className="px-6 py-4 text-right font-medium">Revenue</th>
                  <th className="px-6 py-4 text-right font-medium">Expenses</th>
                  <th className="px-6 py-4 text-right font-medium">Net Profit</th>
                  <th className="px-6 py-4 text-right font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {profitData.map((row, i) => (
                  <motion.tr key={row.month} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{row.month} 2026</td>
                    <td className="px-6 py-4 text-right">${row.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-400">${row.expenses.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-500">${row.profit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-blue-400">{row.margin}%</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: overview
  const kpis = [
    { label: "Total Revenue (YTD)", value: `$${(s.totalRevenueYTD / 1000000).toFixed(1)}M`, trend: "+12.5%", pos: true, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Total Expenses (YTD)", value: `$${(s.totalExpensesYTD / 1000000).toFixed(1)}M`, trend: "-2.4% vs budget", pos: true, icon: TrendingDown, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Net Profit", value: `$${(s.netProfit / 1000000).toFixed(1)}M`, trend: `${s.profitMargin}% margin`, pos: true, icon: DollarSign, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Cash Balance", value: `$${(s.cashBalance / 1000000).toFixed(2)}M`, trend: "+5.1%", pos: true, icon: Wallet, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Accounts Receivable", value: `$${(s.accountsReceivable / 1000).toFixed(0)}K`, trend: "4 invoices open", pos: true, icon: CreditCard, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Accounts Payable", value: `$${(s.accountsPayable / 1000).toFixed(0)}K`, trend: "5 bills pending", pos: false, icon: FileText, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Finance Dashboard</h1><p className="text-sm text-muted-foreground">Real-time financial overview — Nimbus Retail Group.</p></div>
        <button className="px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">New Journal Entry</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-5 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${kpi.bg}`}><kpi.icon className={`size-5 ${kpi.color}`} /></div>
              <span className={`text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 ${kpi.pos ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                {kpi.pos ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{kpi.trend}
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground mb-1">{kpi.value}</p>
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Recent Invoices</h3>
          <div className="space-y-3">
            {mockInvoices.slice(0, 4).map(inv => (
              <div key={inv.id} className="flex justify-between items-center text-sm">
                <div><p className="font-medium text-foreground">{inv.customerName}</p><p className="text-xs text-muted-foreground">{inv.id} · Due {inv.dueDate}</p></div>
                <div className="text-right">
                  <p className="font-semibold">${inv.amount.toLocaleString()}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : inv.status === "Overdue" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Recent Vendor Bills</h3>
          <div className="space-y-3">
            {mockVendorBills.slice(0, 4).map(bill => (
              <div key={bill.id} className="flex justify-between items-center text-sm">
                <div><p className="font-medium text-foreground">{bill.vendorName}</p><p className="text-xs text-muted-foreground">{bill.id} · Due {bill.dueDate}</p></div>
                <div className="text-right">
                  <p className="font-semibold">${bill.amount.toLocaleString()}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${bill.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : bill.status === "Overdue" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>{bill.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
