import React from "react";
import { FileText } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props {
  tab?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export function BalanceSheet({ tab = "balance_sheet" }: Props) {
  const assets = [
    { label: "Cash in Bank", amount: 1250000 },
    { label: "Petty Cash", amount: 15000 },
    { label: "Accounts Receivable", amount: 450000 },
    { label: "Prepaid Expenses", amount: 28000 },
    { label: "Inventory", amount: 850000 },
    { label: "Fixed Assets (Net)", amount: 2100000 },
  ];
  const liabilities = [
    { label: "Accounts Payable", amount: 210000 },
    { label: "GST Payable", amount: 48000 },
    { label: "Salaries Payable", amount: 85000 },
    { label: "Short-Term Loans", amount: 300000 },
  ];
  const equity = [
    { label: "Owner's Equity", amount: 1500000 },
    { label: "Retained Earnings", amount: 2100000 },
    { label: "Net Profit (YTD)", amount: 1636000 },
  ];

  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
  const totalEquity = equity.reduce((s, e) => s + e.amount, 0);

  const Section = ({ title, rows, total, color }: any) => (
    <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
      <div className={`px-6 py-4 border-b border-border/50 ${color}`}>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border/30">
        {rows.map((row: any, i: number) => (
          <div key={row.label} className="flex justify-between px-6 py-3 text-sm hover:bg-muted/10 transition-colors">
            <span className="text-muted-foreground pl-2">{row.label}</span>
            <span className="font-medium text-foreground">{fmt(row.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between px-6 py-4 bg-muted/20 font-semibold text-sm">
          <span>Total {title}</span>
          <span className="text-primary font-semibold">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-bold">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">Financial position as of June 30, 2026.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <FileText className="size-4" /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Assets" rows={assets} total={totalAssets} color="bg-blue-500/5 border-b border-blue-500/20" />
        <div className="space-y-4">
          <Section title="Liabilities" rows={liabilities} total={totalLiabilities} color="bg-red-500/5 border-b border-red-500/20" />
          <Section title="Equity" rows={equity} total={totalEquity} color="bg-emerald-500/5 border-b border-emerald-500/20" />
        </div>
      </div>
    </div>
  );
}
