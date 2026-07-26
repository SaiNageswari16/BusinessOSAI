import React, { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { financialReportsApi, BalanceSheetReport } from "@/lib/api-client";
import { fmt } from "@/components/accounting/utils";

interface Props { tab?: string; }

export function BalanceSheet({ tab = "balance_sheet" }: Props) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const [asOf, setAsOf] = useState(today);

  useEffect(() => {
    if (tab === "balance_sheet") {
      setLoading(true);
      financialReportsApi.balanceSheet({ as_of: asOf })
        .then(setReport)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab, asOf]);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading report…</div>;
  }
  if (!report) {
    return <div className="p-6 text-center text-red-400">Failed to load Balance Sheet.</div>;
  }

  const Section = ({ title, rows, total, color }: { title: string; rows: any[]; total: number; color: string }) => (
    <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
      <div className={`px-6 py-4 border-b border-border/50 ${color}`}>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border/30">
        {rows.map((row: any) => (
          <div key={row.account_code} className="flex justify-between px-6 py-3 text-sm hover:bg-muted/10 transition-colors">
            <span className="text-muted-foreground pl-2">{row.account_name}</span>
            <span className="font-medium text-foreground">{fmt(Math.abs(row.net))}</span>
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
          <h1 className="text-2xl font-bold text-foreground">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">{report.meta.title} — As of {report.meta.to_date}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <FileText className="size-4" /> Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Assets" rows={report.assets} total={report.total_assets} color="bg-blue-500/5 border-b border-blue-500/20" />
        <div className="space-y-4">
          <Section title="Liabilities" rows={report.liabilities} total={report.total_liabilities} color="bg-red-500/5 border-b border-red-500/20" />
          <Section title="Equity" rows={report.equity} total={report.total_equity} color="bg-emerald-500/5 border-b border-emerald-500/20" />
        </div>
      </div>
    </div>
  );
}
