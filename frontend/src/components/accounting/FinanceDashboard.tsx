import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight,
  CreditCard, FileText, Loader2
} from "lucide-react";
import { invoicesApi, inventoryApi, financialReportsApi } from "@/lib/api-client";
import { toast } from "sonner";
import { fmt } from "@/components/accounting/utils";
import { useCurrency } from "@/hooks/use-currency";

interface Props { tab?: string; }

interface InvoiceRow {
  id: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
}

interface BillRow {
  id: string;
  supplier_name: string;
  bill_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
}

export function FinanceDashboard({ tab = "overview" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [invRes, billRes] = await Promise.all([
        invoicesApi.listInvoices({ page_size: 50 }),
        inventoryApi.getVendorBills(),
      ]);
      const invItems = (invRes.items || []) as any[];
      setInvoices(invItems.map(inv => ({
        id: inv.id,
        customer_name: inv.customer_name || "—",
        invoice_date: inv.invoice_date,
        due_date: inv.due_date || "—",
        total_amount: inv.total_amount,
        paid_amount: inv.amount_paid || 0,
        balance_due: inv.balance_due,
        status: inv.status,
      })));
      setBills((billRes || []).map(b => ({
        ...b,
        balance_due: (b.total_amount || 0) - (b.amount_paid || 0),
      })));
      const today = new Date();
      const fyStart = new Date(today.getFullYear(), 3, 1);
      setDateRange({ from: fyStart.toISOString().split("T")[0], to: today.toISOString().split("T")[0] });
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "overview") loadOverview();
  }, [tab]);

  if (tab === "cash_flow" || tab === "cash_flow_statement") {
    const [flowReport, setFlowReport] = useState<{
      operating: any[];
      net_operating: number;
      investing: any[];
      net_investing: number;
      financing: any[];
      net_financing: number;
      net_cash_flow: number;
    } | null>(null);
    const [cfLoading, setCfLoading] = useState(false);
    const [cfRange, setCfRange] = useState<{ from: string; to: string }>({ from: "", to: "" });

    useEffect(() => {
      if (tab !== "cash_flow" && tab !== "cash_flow_statement") return;
      setCfLoading(true);
      const today = new Date();
      const start = new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0];
      const end = today.toISOString().split("T")[0];
      setCfRange({ from: start, to: end });
      financialReportsApi.cashFlow({ from_date: start, to_date: end })
        .then(setFlowReport)
        .catch(() => setFlowReport(null))
        .finally(() => setCfLoading(false));
    }, [tab]);

    if (cfLoading) {
      return <div className="p-6 flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
    }
    if (!flowReport) {
      return <div className="p-6 text-center text-red-400">Failed to load cash flow report.</div>;
    }

    const sections = [
      { category: "Operating Activities", items: flowReport.operating, total: flowReport.net_operating },
      { category: "Investing Activities", items: flowReport.investing, total: flowReport.net_investing },
      { category: "Financing Activities", items: flowReport.financing, total: flowReport.net_financing },
    ];

    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-bold">Cash Flow Statement</h1>
          <p className="text-sm text-muted-foreground">Period: {cfRange.from && cfRange.to ? `${cfRange.from} to ${cfRange.to}` : "loading…"}</p>
        </div>
        {sections.map((section, si) => {
          const total = section.items.reduce((s: number, i: any) => s + i.net, 0);
          return (
            <div key={section.category} className="glass-panel rounded-xl border border-border/50 overflow-hidden">
              <div className="px-6 py-4 bg-muted/20 border-b border-border/50">
                <h3 className="font-semibold text-foreground">{section.category}</h3>
              </div>
              <div className="divide-y divide-border/30">
                {section.items.map((item, i) => (
                  <motion.div
                    key={item.account_code}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: si * section.items.length * 0.05 + i * 0.04 }}
                    className="flex justify-between items-center px-6 py-3 hover:bg-muted/10 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground pl-4">{item.account_name}</span>
                    <span className={`text-sm font-semibold ${item.net < 0 ? "text-red-500" : "text-foreground"}`}>
                      {fmt(item.net)}
                    </span>
                  </motion.div>
                ))}
                <div className="flex justify-between px-6 py-4 bg-muted/30 font-semibold text-sm">
                  <span>Net {section.category}</span>
                  <span className={total >= 0 ? "text-emerald-500 font-semibold" : "text-red-500 font-semibold"}>
                    {fmt(total)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="glass-panel p-5 rounded-xl border border-primary/30 bg-primary/5 flex justify-between items-center">
          <span className="font-bold text-foreground">Net Change in Cash</span>
          <span className="text-xl font-bold text-primary">{fmt(flowReport.net_cash_flow)}</span>
        </div>
      </div>
    );
  }

  if (tab === "revenue") {
    const totalRevenue = invoices.reduce((s, i) => s + i.total_amount, 0);
    const paidRevenue = invoices.reduce((s, i) => s + i.paid_amount, 0);
    const channelBreakdown = [
      { channel: "Invoice Revenue", amount: totalRevenue, pct: totalRevenue > 0 ? 100 : 0 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground font-bold">Revenue</h1><p className="text-sm text-muted-foreground">Revenue breakdown by channel — {dateRange.from ? `YTD ${dateRange.from.slice(0,4)}` : "YTD"}.</p></div>
        <div className="glass-panel p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-4">
          <TrendingUp className="size-8 text-emerald-500" />
          <div>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-3xl font-bold text-foreground">{fmt(totalRevenue)}</p>
          </div>
          <span className="ml-auto text-emerald-500 font-semibold text-lg">{fmt(paidRevenue)} received</span>
        </div>
      </div>
    );
  }

  if (tab === "expenses") {
    const totalExpenses = bills.reduce((s, b) => s + b.total_amount, 0);
    const paidExpenses = bills.reduce((s, b) => s + (b.amount_paid || 0), 0);
    const expenseBreakdown = [
      { category: "Vendor Bills", amount: totalExpenses, pct: totalExpenses > 0 ? 100 : 0, color: "bg-red-500" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground font-bold">Expenses</h1><p className="text-sm text-muted-foreground">Expense breakdown by category — {dateRange.from ? `from ${dateRange.from}` : "YTD"}.</p></div>
        <div className="glass-panel p-5 rounded-xl border border-red-500/30 bg-red-500/5 flex items-center gap-4">
          <TrendingDown className="size-8 text-red-500" />
          <div>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-3xl font-bold text-foreground">{fmt(totalExpenses)}</p>
          </div>
          <span className="ml-auto text-emerald-500 font-semibold text-lg">{fmt(paidExpenses)} paid</span>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-right font-medium">% of Total</th>
                  <th className="px-6 py-4 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {expenseBreakdown.map((exp, i) => (
                  <motion.tr key={exp.category} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{exp.category}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{fmt(exp.amount)}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">{exp.pct}%</td>
                    <td className="px-6 py-4 w-40">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${exp.color}`} style={{ width: `${exp.pct}%` }} />
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
    const totalRevenue = invoices.reduce((s, i) => s + i.total_amount, 0);
    const totalExpenses = bills.reduce((s, b) => s + b.total_amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground font-bold">Profit Analysis</h1><p className="text-sm text-muted-foreground">Aggregated profit from invoices and bills — {dateRange.from ? `${dateRange.from} to ${dateRange.to}` : "all time"}.</p></div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Net Profit", value: fmt(netProfit), color: netProfit >= 0 ? "text-emerald-500" : "text-red-500" },
            { label: "Profit Margin", value: `${profitMargin}%`, color: "text-blue-500" },
            { label: "Revenue", value: fmt(totalRevenue), color: "text-indigo-500" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="px-6 py-4 bg-muted/20 border-b border-border/50">
            <h3 className="font-semibold text-foreground">Revenue vs Expenses</h3>
          </div>
          <div className="divide-y divide-border/30">
            <div className="flex justify-between items-center px-6 py-3">
              <span className="text-sm text-muted-foreground">Total Revenue</span>
              <span className="text-sm font-semibold text-emerald-500">{fmt(totalRevenue)}</span>
            </div>
            <div className="flex justify-between items-center px-6 py-3">
              <span className="text-sm text-muted-foreground">Total Expenses</span>
              <span className="text-sm font-semibold text-red-400">{fmt(totalExpenses)}</span>
            </div>
            <div className="flex justify-between px-6 py-4 bg-muted/20 font-semibold text-sm">
              <span>Net Profit</span>
              <span className={`font-bold ${netProfit >= 0 ? "text-primary" : "text-red-500"}`}>{fmt(netProfit)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: overview
  if (loading) {
    return <div className="p-6 flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  const totalRevenue = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalExpenses = bills.reduce((s, b) => s + b.total_amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalAR = invoices.reduce((s, i) => s + (i.balance_due || 0), 0);
  const totalAP = bills.reduce((s, b) => s + (b.balance_due || 0), 0);

  const kpis = [
    { label: "Total Revenue (YTD)", value: fmt(totalRevenue), trend: `${invoices.length} invoices`, pos: true, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Total Expenses (YTD)", value: fmt(totalExpenses), trend: `${bills.length} bills`, pos: true, icon: TrendingDown, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Net Profit", value: fmt(netProfit), trend: `${totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0}% margin`, pos: true, icon: DollarSign, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Cash Balance", value: fmt(totalRevenue - totalExpenses), trend: "Net P&L", pos: true, icon: Wallet, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Accounts Receivable", value: fmt(totalAR), trend: "Invoices open", pos: true, icon: CreditCard, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Accounts Payable", value: fmt(totalAP), trend: "Bills pending", pos: false, icon: FileText, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground font-bold">Finance Dashboard</h1><p className="text-sm text-muted-foreground">Real-time financial overview.</p></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-5 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${kpi.bg}`}><kpi.icon className={`size-5 ${kpi.color}`} /></div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1 ${kpi.pos ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
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
            {invoices.slice(0, 4).map(inv => (
              <div key={inv.id} className="flex justify-between items-center text-sm">
                <div>
                  <p className="font-semibold text-foreground">{inv.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{inv.id.slice(0, 12)} · Due {inv.due_date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{fmt(inv.total_amount)}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${inv.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : inv.status === "overdue" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>{inv.status}</span>
                </div>
              </div>
            ))}
            {invoices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No invoices found.</p>
            )}
          </div>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Recent Vendor Bills</h3>
          <div className="space-y-3">
            {bills.slice(0, 4).map(bill => (
              <div key={bill.id} className="flex justify-between items-center text-sm">
                <div>
                  <p className="font-semibold text-foreground">{bill.supplier_name}</p>
                  <p className="text-xs text-muted-foreground">{bill.id.slice(0, 12)} · Due {bill.due_date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{fmt(bill.total_amount)}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${bill.status === "paid" ? "bg-emerald-500/10 text-emerald-500" : bill.status === "overdue" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>{bill.status}</span>
                </div>
              </div>
            ))}
            {bills.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No bills found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
