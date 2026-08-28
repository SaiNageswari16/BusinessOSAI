import React, { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  CreditCard, DollarSign, Package, ShoppingCart,
  TrendingUp, Users, AlertTriangle, ArrowRightLeft,
  Clock, Zap, CheckCircle2, ChevronRight, Store, RotateCcw,
  Receipt, Wallet, Layers, ShieldCheck, FileText, Lock, UserCheck
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { posApi, crmApi, inventoryApi } from "../../lib/api-client";
import { workspaceApi } from "../../lib/workspace-api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "../../contexts/auth-context";
import { useTenant } from "../../contexts/tenant-context";
import { useCurrency } from "@/hooks/use-currency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const defaultHourlyData = [
  { hour: "06:00", revenue: 0 },
  { hour: "07:00", revenue: 0 },
  { hour: "08:00", revenue: 0 },
  { hour: "09:00", revenue: 0 },
  { hour: "10:00", revenue: 0 },
  { hour: "11:00", revenue: 0 },
  { hour: "12:00", revenue: 0 },
  { hour: "13:00", revenue: 0 },
  { hour: "14:00", revenue: 0 },
  { hour: "15:00", revenue: 0 },
  { hour: "16:00", revenue: 0 },
  { hour: "17:00", revenue: 0 },
  { hour: "18:00", revenue: 0 },
  { hour: "19:00", revenue: 0 },
  { hour: "20:00", revenue: 0 },
  { hour: "21:00", revenue: 0 },
  { hour: "22:00", revenue: 0 },
];

const mockRecentTransactions = [
  {
    id: "tx-1",
    receipt_number: "REC-DW21J9Z7",
    time: "12:14 PM",
    customer: "Walk-in",
    method: "CASH",
    amount: 1625.40,
    status: "COMPLETED",
  },
  {
    id: "tx-2",
    receipt_number: "REC-3SMEBJPO",
    time: "07:35 PM",
    customer: "Walk-in",
    method: "CASH",
    amount: 630.00,
    status: "COMPLETED",
  },
  {
    id: "tx-3",
    receipt_number: "REC-Z0D6LY12",
    time: "03:56 PM",
    customer: "Walk-in",
    method: "CASH",
    amount: 178.50,
    status: "COMPLETED",
  },
];

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--card)",
  borderColor: "var(--border)",
  borderRadius: "8px",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

export function PosDashboard() {
  const { user } = useAuth();
  const { tenant: company } = useTenant();
  const { currency, formatCurrency: fmtCurrency } = useCurrency();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("today");

  const { data: workspaceData } = useQuery({
    queryKey: ["current-workspace"],
    queryFn: workspaceApi.getCurrentWorkspace,
    staleTime: Infinity,
  });

  const { data: summaryData } = useQuery({
    queryKey: ["pos-daily-summary"],
    queryFn: () => posApi.getDailySummary(),
    refetchInterval: 60000,
  });

  const { data: historyData } = useQuery({
    queryKey: ["pos-transactions-history"],
    queryFn: () => posApi.getHistory({ limit: 6 }),
    refetchInterval: 30000,
  });

  const { data: productsData } = useQuery({
    queryKey: ["pos-inventory-low-stock"],
    queryFn: async () => {
      try {
        const res = await inventoryApi.getProducts();
        return Array.isArray(res) ? res.filter((p: any) => Number(p.stock_quantity || p.initial_stock || 0) <= 5) : [];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  const todayRevenue = summaryData?.total_revenue || 0;
  const todayOrders = summaryData?.transactions_count || 0;
  const totalReturns = summaryData?.total_returns || 0;
  const avgBill = todayOrders > 0 ? todayRevenue / todayOrders : 0;
  const paymentReceived = todayRevenue - totalReturns;

  const displayTransactions = Array.isArray(historyData) && historyData.length > 0
    ? historyData
    : mockRecentTransactions;

  const lowStockItems = Array.isArray(productsData) ? productsData : [];

  const hourlyChartData = useMemo(() => {
    if (summaryData?.hourly_sales && summaryData.hourly_sales.length > 0) {
      return summaryData.hourly_sales;
    }
    return defaultHourlyData;
  }, [summaryData]);

  const topKpis = [
    {
      id: "revenue",
      label: "Today's Revenue",
      value: fmtCurrency(todayRevenue),
      trend: "↗ Live",
      trendColor: "text-emerald-600 bg-emerald-500/10",
      subtext: "vs yesterday",
      icon: DollarSign,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
    },
    {
      id: "orders",
      label: "Total Orders",
      value: String(todayOrders),
      trend: "↗ Live",
      trendColor: "text-emerald-600 bg-emerald-500/10",
      subtext: "vs yesterday",
      icon: ShoppingCart,
      iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400",
    },
    {
      id: "avg_bill",
      label: "Average Bill",
      value: fmtCurrency(avgBill),
      trend: "↗ Live",
      trendColor: "text-emerald-600 bg-emerald-500/10",
      subtext: "vs yesterday",
      icon: CreditCard,
      iconBg: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400",
    },
    {
      id: "returns",
      label: "Returns & Refunds",
      value: fmtCurrency(totalReturns),
      trend: "↘ Live",
      trendColor: "text-rose-600 bg-rose-500/10",
      subtext: "vs yesterday",
      icon: RotateCcw,
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
    },
    {
      id: "payment_received",
      label: "Payment Received",
      value: fmtCurrency(paymentReceived),
      trend: "↗ Live",
      trendColor: "text-emerald-600 bg-emerald-500/10",
      subtext: "vs yesterday",
      icon: Wallet,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
    },
  ];

  const quickActions = [
    {
      id: "open_pos",
      label: "Open POS",
      sub: "Start a new transaction",
      icon: Zap,
      iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400",
      link: "/pos?tab=terminal",
    },
    {
      id: "hold_orders",
      label: "Hold Orders",
      sub: "View & manage held orders",
      icon: Clock,
      iconBg: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400",
      link: "/pos?tab=sales&view=held",
    },
    {
      id: "cash_in_out",
      label: "Cash In / Out",
      sub: "Add or withdraw cash",
      icon: DollarSign,
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
      link: "/pos?tab=payment_in",
    },
    {
      id: "returns",
      label: "Returns",
      sub: "Process return transactions",
      icon: ArrowRightLeft,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
      link: "/pos?tab=sales&view=cancelled",
    },
    {
      id: "print_z_report",
      label: "Print Z-Report",
      sub: "End of day summary report",
      icon: Store,
      iconBg: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400",
      link: "/pos?tab=reports",
    },
    {
      id: "close_shift",
      label: "Close Shift",
      sub: "Close current shift",
      icon: AlertTriangle,
      iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
      link: "/pos?tab=terminal",
    },
  ];

  const bottomStats = [
    {
      label: "Open Orders",
      value: "0",
      sub: "Awaiting completion",
      icon: Clock,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
    },
    {
      label: "Held Orders",
      value: "0",
      sub: "On hold",
      icon: ShoppingCart,
      iconBg: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400",
    },
    {
      label: "Open Tabs",
      value: "0",
      sub: "Active tabs",
      icon: Layers,
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
    },
    {
      label: "Active Customers",
      value: "0",
      sub: "Today",
      icon: Users,
      iconBg: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400",
    },
    {
      label: "Today's Transactions",
      value: String(todayOrders),
      sub: "Completed",
      icon: Receipt,
      iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400",
    },
    {
      label: "Active Shift",
      value: user?.name?.split(" ")[0] || (user as any)?.username || "venatic",
      sub: "Since 08:00 AM",
      icon: ShieldCheck,
      iconBg: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400",
    },
  ];

  return (
    <div className="space-y-3 font-sans">
      {/* ── Top Header Row ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">POS Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {workspaceData?.name || company?.name || "Store HQ"} &mdash; Register: REG-01
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Shift Open: {user?.name?.split(" ")[0] || (user as any)?.username || "venatic"}
          </span>
          <Button
            asChild
            className="h-8.5 gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs shadow-xs border-0"
          >
            <Link to="/pos" search={{ tab: "terminal" }}>
              <ShoppingCart className="size-3.5" /> Open POS
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Top 5 KPI Cards Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {topKpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.id} className="bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className={cn("size-8 rounded-xl flex items-center justify-center", kpi.iconBg)}>
                  <Icon className="size-4" />
                </div>
                <span className="text-xs font-medium text-muted-foreground text-right truncate">
                  {kpi.label}
                </span>
              </div>

              <div className="my-2">
                <div className="text-xl font-bold tracking-tight text-foreground">
                  {kpi.value}
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40">
                <span className={cn("inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded", kpi.trendColor)}>
                  {kpi.trend}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {kpi.subtext}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Middle Section: Left Quick Actions (~30%) & Right Trends/Transactions (~70%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column (4 cols / ~32%): Quick Actions & Low Stock Alerts */}
        <div className="lg:col-span-4 space-y-3 flex flex-col">
          {/* Quick Actions Card */}
          <Card className="bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex-1">
            <h3 className="text-sm font-bold text-foreground mb-2">Quick Actions</h3>
            <div className="space-y-1">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.id}
                    to={action.link}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0", action.iconBg)}>
                        <Icon className="size-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-foreground group-hover:text-indigo-600 transition-colors truncate">
                          {action.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {action.sub}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Low Stock Alerts Card */}
          <Card className="bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h3 className="text-sm font-bold text-foreground">Low Stock Alerts</h3>
              <span className="text-[11px] font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full">
                {lowStockItems.length} items
              </span>
            </div>

            <div className="py-6 flex flex-col items-center justify-center text-center">
              <div className="size-10 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-2">
                <Package className="size-5" />
              </div>
              <p className="text-xs text-muted-foreground">No critical stock alerts.</p>
            </div>
          </Card>
        </div>

        {/* Right Column (8 cols / ~68%): Hourly Sales Trend & Recent Transactions */}
        <div className="lg:col-span-8 space-y-3 flex flex-col">
          {/* Today's Hourly Sales Trend Card */}
          <Card className="bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-sm font-bold text-foreground">Today's Hourly Sales Trend</h3>
              <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/40">
                <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-background text-foreground shadow-xs border border-border/50 rounded-md">
                  Today ▾
                </span>
              </div>
            </div>

            <div className="h-[180px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="posSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                  <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val}`}
                    domain={[0, 4]}
                    ticks={[0, 1, 2, 3, 4]}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [fmtCurrency(value), "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#posSalesGrad)"
                    dot={{ r: 2.5, fill: "#4f46e5" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Recent Transactions Card */}
          <Card className="bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h3 className="text-sm font-bold text-foreground">Recent Transactions</h3>
              <Link
                to="/pos"
                search={{ tab: "sales" }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-0.5"
              >
                View All <ChevronRight className="size-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Receipt No</th>
                    <th className="py-2.5 px-3 font-semibold">Time</th>
                    <th className="py-2.5 px-3 font-semibold">Customer</th>
                    <th className="py-2.5 px-3 font-semibold">Method</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {displayTransactions.map((tx: any) => {
                    const isCompleted = (tx.status || "COMPLETED").toUpperCase() === "COMPLETED";
                    const isRefunded = (tx.status || "").toUpperCase() === "REFUNDED";

                    return (
                      <tr key={tx.id || tx.receipt_number} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">
                          {tx.receipt_number || tx.id}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {tx.time || (tx.created_at ? format(new Date(tx.created_at), "hh:mm a") : "12:00 PM")}
                        </td>
                        <td className="py-2.5 px-3 text-foreground whitespace-nowrap">
                          {tx.customer?.name || tx.customerName || tx.customer || "Walk-in"}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-muted/60 text-foreground border border-border/40">
                            {tx.method || tx.payments?.[0]?.payment_method || "CASH"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-foreground text-right whitespace-nowrap">
                          {fmtCurrency(tx.amount || tx.total_amount || tx.total || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              isCompleted
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : isRefunded
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            )}
                          >
                            <CheckCircle2 className="size-3" />
                            {tx.status || "COMPLETED"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Row 3: Bottom 6 Mini Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {bottomStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="bg-card border border-border/70 rounded-2xl p-3 shadow-xs flex items-center gap-3">
              <div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0", stat.iconBg)}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground truncate">{stat.label}</div>
                <div className="text-sm font-bold text-foreground truncate">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground/80 truncate">{stat.sub}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
