import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, TrendingUp } from "lucide-react";
import { financialReportsApi, ProfitAndLossReport, TrialBalanceReport, downloadCsv } from "@/lib/api-client";
import { fmt } from "@/components/accounting/utils";
import { toast } from "sonner";

interface Props { tab?: string; }

export function ProfitAndLoss({ tab = "profit_and_loss" }: Props) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ProfitAndLossReport | null>(null);
  const [trial, setTrial] = useState<TrialBalanceReport | null>(null);
  const [forecastQuarters, setForecastQuarters] = useState<{ period: string; revenue: number; expenses: number; profit: number; margin: number }[]>([]);
  const [forecastError, setForecastError] = useState(false);

  // Default date range: current FY (Apr 2026 – Mar 2027)
  const today = new Date();
  const fyStart = new Date(today.getFullYear(), 3, 1); // Apr 1
  const [fromDate, setFromDate] = useState(fyStart.toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0]);

  useEffect(() => {
    if (tab === "profit_and_loss") {
      setLoading(true);
      financialReportsApi.profitAndLoss({ from_date: fromDate, to_date: toDate })
        .then(setReport)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab, fromDate, toDate]);

  useEffect(() => {
    if (tab === "trial_balance") {
      setLoading(true);
      financialReportsApi.trialBalance({ from_date: fromDate, to_date: toDate })
        .then(setTrial)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab, fromDate, toDate]);

  // ── Export helpers (defined at outer scope so all tab handlers can reach them) ──
  const exportForecast = () => {
    if (!forecastQuarters.length) { toast.error("No data to export"); return; }
    downloadCsv("profit_forecast.csv", ["Period", "Revenue", "Expenses", "Net Profit", "Margin %"],
      forecastQuarters.map(q => [q.period, q.revenue, q.expenses, q.profit, q.margin + "%"]));
    toast.success("Forecast exported");
  };

  const exportPL = () => {
    if (!report) { toast.error("No P&L data to export"); return; }
    const rows: (string | number)[][] = [];
    rows.push(["Category", "Account", "Amount"]);
    report.income.forEach(l => rows.push(["Revenue", l.account_name, l.net]));
    if (report.total_income) rows.push(["", "Total Revenue", report.total_income]);
    report.cogs.forEach(l => rows.push(["COGS", l.account_name, l.net]));
    if (report.gross_profit) rows.push(["", "Gross Profit", report.gross_profit]);
    report.expenses.forEach(l => rows.push(["Expense", l.account_name, l.net]));
    rows.push(["", "Net Profit", report.net_profit]);
    downloadCsv("profit_and_loss.csv", rows[0], rows.slice(1));
    toast.success("P&L exported");
  };

  const exportTB = () => {
    if (!trial) { toast.error("No Trial Balance data to export"); return; }
    const rows = trial.entries.map(r => [r.account_code, r.account_name, r.debit, r.credit]);
    downloadCsv("trial_balance.csv", ["Account Code", "Account Name", "Debit", "Credit"], rows);
    toast.success("Trial Balance exported");
  };

  // ── Profit Forecast — computed from quarterly P&L API data ─────────────
  if (tab === "profit_forecast") {
    const [loading, setLocalLoading] = useState(false);
    const [error, setForecastErrorLocal] = useState(false);

    useEffect(() => {
      setLocalLoading(true);
      setForecastError(false);

      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth(); // 0-indexed
      // Determine current fiscal year (Apr–Mar)
      const fyYear = month >= 3 ? year : year - 1;

      const quarterDefs = [
        { label: `Q1 FY${String(fyYear + 1).slice(2)} (Apr–Jun)`, from: `${fyYear}-04-01`, to: `${fyYear}-06-30` },
        { label: `Q2 FY${String(fyYear + 1).slice(2)} (Jul–Sep)`, from: `${fyYear}-07-01`, to: `${fyYear}-09-30` },
        { label: `Q3 FY${String(fyYear + 1).slice(2)} (Oct–Dec)`, from: `${fyYear}-10-01`, to: `${fyYear}-12-31` },
        { label: `Q4 FY${String(fyYear + 1).slice(2)} (Jan–Mar)`, from: `${String(fyYear + 1)}-01-01`, to: `${String(fyYear + 1)}-03-31` },
      ];

      Promise.all(
        quarterDefs.map(q =>
          financialReportsApi.profitAndLoss({ from_date: q.from, to_date: q.to }).then(r => ({ ...q, data: r }))
        )
      )
        .then(results => {
          setForecastQuarters(
            results.map(q => ({
              period: q.label,
              revenue: q.data.total_income || 0,
              expenses: (q.data.total_expenses || 0),
              profit: q.data.net_profit || 0,
              margin: (q.data.total_income || 0) > 0
                ? Number((((q.data.net_profit || 0) / (q.data.total_income || 1)) * 100).toFixed(1))
                : 0,
            }))
          );
        })
        .catch(() => setForecastError(true))
        .finally(() => setLocalLoading(false));
    }, [tab]);

    if (forecastError) {
      return (
        <div className="p-6 text-center text-red-400">
          Failed to load profit forecast. Ensure journal entries exist for the fiscal year.
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profit Forecast</h1>
            <p className="text-sm text-muted-foreground">Quarterly profit performance for the current fiscal year (Apr–Mar).</p>
          </div>
          <button onClick={exportForecast} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <FileText className="size-4" /> Export Forecast
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {forecastQuarters.map((q, i) => (
            <motion.div key={q.period} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel rounded-xl border border-border/50 p-5 space-y-2">
              <p className="text-xs text-muted-foreground uppercase font-semibold">{q.period}</p>
              <p className="text-2xl font-bold text-foreground">{fmt(q.profit)}</p>
              <p className={`text-sm font-medium ${q.profit >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                {q.margin}% margin
              </p>
              <div className="pt-2 border-t border-border/30 text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span>Revenue</span><span className="text-emerald-500 font-semibold">{fmt(q.revenue)}</span></div>
                <div className="flex justify-between"><span>Expenses</span><span className="text-red-400 font-semibold">{fmt(q.expenses)}</span></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Table */}
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
                </tr>
              </thead>
              <tbody>
                {forecastQuarters.map((q, i) => {
                  const isOverdue = q.profit < 0;
                  return (
                    <motion.tr key={q.period} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                      className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${isOverdue ? "bg-red-500/3" : ""}`}>
                      <td className="px-6 py-4 font-semibold text-foreground">{q.period}</td>
                      <td className="px-6 py-4 text-right font-semibold text-emerald-500">{fmt(q.revenue)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-red-400">{fmt(q.expenses)}</td>
                      <td className={`px-6 py-4 text-right font-bold ${isOverdue ? "text-red-500" : "text-foreground"}`}>{fmt(q.profit)}</td>
                      <td className={`px-6 py-4 text-right font-semibold ${q.margin >= 0 ? "text-blue-400" : "text-red-400"}`}>{q.margin}%</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Profit & Loss ───────────────────────────────────────────────────────
  if (tab === "profit_and_loss") {
    if (loading) {
      return <div className="p-6 text-center text-muted-foreground">Loading report…</div>;
    }
    if (!report) {
      return <div className="p-6 text-center text-red-400">Failed to load P&amp;L report.</div>;
    }

    const Row = ({ label, amount, type }: { label: string; amount: number; type: string }) => {
      let cls = "hover:bg-muted/10";
      if (type === "total") cls = "bg-primary/5 font-bold text-primary";
      else if (type === "subtotal") cls = "bg-muted/20 font-semibold text-foreground";
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex justify-between items-center px-6 py-3 ${cls} transition-colors`}>
          <span className={`text-sm ${type === "expense" || type === "revenue" ? "pl-4 text-muted-foreground" : ""}`}>{label}</span>
          <span className={`text-sm font-semibold ${type === "total" ? "text-primary text-base" : amount < 0 ? "text-red-500" : "text-foreground"}`}>
            {fmt(amount)}
          </span>
        </motion.div>
      );
    };

    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profit &amp; Loss Statement</h1>
            <p className="text-sm text-muted-foreground">
              {report.meta.title} — {report.meta.from_date} to {report.meta.to_date}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            <span className="text-muted-foreground">to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            <button onClick={exportPL} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
              <FileText className="size-4" /> Export PDF
            </button>
          </div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="p-6 border-b border-border/50 bg-muted/20">
            <h2 className="font-semibold text-foreground">Income Statement</h2>
            <p className="text-sm text-muted-foreground">Revenue, cost of goods sold, expenses and net profit.</p>
          </div>
          <div className="divide-y divide-border/30">
            {report.income.map((line, i) => (
              <Row key={line.account_code} label={line.account_name} amount={line.net} type="revenue" />
            ))}
            {report.income.length > 0 && <Row label="Total Revenue" amount={report.total_income} type="subtotal" />}
            {report.cogs.map((line, i) => (
              <Row key={line.account_code} label={line.account_name} amount={line.net} type="expense" />
            ))}
            {report.cogs.length > 0 && <Row label="Gross Profit" amount={report.gross_profit} type="subtotal" />}
            {report.expenses.map((line, i) => (
              <Row key={line.account_code} label={line.account_name} amount={line.net} type="expense" />
            ))}
            {report.expenses.length > 0 && <Row label="Net Profit" amount={report.net_profit} type="total" />}
          </div>
        </div>
      </div>
    );
  }

  // ── Trial Balance ───────────────────────────────────────────────────────
  if (tab === "trial_balance") {
    if (loading) {
      return <div className="p-6 text-center text-muted-foreground">Loading report…</div>;
    }
    if (!trial) {
      return <div className="p-6 text-center text-red-400">Failed to load Trial Balance.</div>;
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trial Balance</h1>
            <p className="text-sm text-muted-foreground">All account balances — debits must equal credits.</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            <span className="text-muted-foreground">to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            <button onClick={exportTB} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
              <FileText className="size-4" /> Export PDF
            </button>
          </div>
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
                {trial.entries.map((row: typeof trial.entries[0], i: number) => (
                  <motion.tr key={row.account_code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary text-xs">{row.account_code}</td>
                    <td className="px-6 py-4 text-foreground font-semibold">{row.account_name}</td>
                    <td className="px-6 py-4 text-right text-emerald-500 font-semibold">{row.debit > 0 ? fmt(row.debit) : "—"}</td>
                    <td className="px-6 py-4 text-right text-red-400 font-semibold">{row.credit > 0 ? fmt(row.credit) : "—"}</td>
                  </motion.tr>
                ))}
                <tr className="bg-muted/30 border-t border-border/50 font-bold text-sm">
                  <td className="px-6 py-4" colSpan={2}>TOTALS</td>
                  <td className="px-6 py-4 text-right text-emerald-500 font-bold">{fmt(trial.total_debit)}</td>
                  <td className="px-6 py-4 text-right text-red-400 font-bold">{fmt(trial.total_credit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {Math.abs(trial.total_debit - trial.total_credit) < 1 && (
          <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-sm text-emerald-600 font-medium">
            &#10003; Trial Balance is balanced — Debits equal Credits.
          </div>
        )}
      </div>
    );
  }

  return null;
}
