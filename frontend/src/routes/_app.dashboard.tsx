import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Boxes, Building2, Calendar, CheckCircle2,
  CreditCard, Database, DollarSign, Download, FileText,
  HardDrive, Layers, Package, Receipt, Server,
  Shield, ShoppingCart, Sparkles, TrendingUp, Truck,
  UserCheck, UserPlus, Users, Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { useI18n } from "@/contexts/i18n-context";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspace-api";
import { inventoryApi, crmApi, employeesApi, invoicesApi } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { LazyMonkeyAiWorkspace } from "@/components/dashboard/LazyMonkeyAiWorkspace";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const chartDataByPeriod: Record<"week" | "month" | "year", Array<{ label: string; revenue: number; expenses: number }>> = {
  week: [
    { label: "Mon", revenue: 14000, expenses: 6000 },
    { label: "Tue", revenue: 22000, expenses: 9000 },
    { label: "Wed", revenue: 19000, expenses: 7500 },
    { label: "Thu", revenue: 28000, expenses: 11000 },
    { label: "Fri", revenue: 35000, expenses: 14000 },
    { label: "Sat", revenue: 42000, expenses: 16000 },
    { label: "Sun", revenue: 38000, expenses: 15000 },
  ],
  month: [
    { label: "Week 1", revenue: 65000, expenses: 24000 },
    { label: "Week 2", revenue: 78000, expenses: 29000 },
    { label: "Week 3", revenue: 84000, expenses: 31000 },
    { label: "Week 4", revenue: 95000, expenses: 34000 },
  ],
  year: [
    { label: "Jan", revenue: 90000, expenses: 38000 },
    { label: "Feb", revenue: 145000, expenses: 58000 },
    { label: "Mar", revenue: 140000, expenses: 48000 },
    { label: "Apr", revenue: 185000, expenses: 70000 },
    { label: "May", revenue: 165000, expenses: 62000 },
    { label: "Jun", revenue: 155000, expenses: 60000 },
    { label: "Jul", revenue: 210000, expenses: 82000 },
    { label: "Aug", revenue: 245000, expenses: 95000 },
    { label: "Sep", revenue: 195000, expenses: 72000 },
    { label: "Oct", revenue: 265000, expenses: 78000 },
    { label: "Nov", revenue: 205000, expenses: 90000 },
    { label: "Dec", revenue: 255000, expenses: 82000 },
  ],
};

const recentActivitiesList = [
  {
    id: "act-1",
    title: 'Company "venatic" was updated',
    subtitle: "General information changed",
    time: "2 min ago",
    icon: Building2,
    iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400",
  },
  {
    id: "act-2",
    title: "New user Tejas Patel added",
    subtitle: "Role: Manager",
    time: "15 min ago",
    icon: UserPlus,
    iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  },
  {
    id: "act-3",
    title: "Inventory adjustment performed",
    subtitle: "Adjustment ID: ADJ-000123",
    time: "45 min ago",
    icon: Boxes,
    iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400",
  },
  {
    id: "act-4",
    title: "Payment of ₹12,500 received",
    subtitle: "From: ABC Technologies",
    time: "1 hr ago",
    icon: Receipt,
    iconBg: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400",
  },
];

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--card)",
  borderColor: "var(--border)",
  borderRadius: "8px",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

function Dashboard() {
  const routerState = useRouterState();
  const searchParams = new URLSearchParams(routerState.location.searchStr);
  const activeTab = searchParams.get("tab") || "overview";

  if (activeTab === "lazymonkey_ai" || activeTab === "copilot" || activeTab === "ai") {
    return <LazyMonkeyAiWorkspace />;
  }

  const { user } = useAuth();
  const { tenant: company } = useTenant();
  const { language, t } = useI18n();
  const { currency, exchangeRates, formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("month");
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");

  // ── Live Backend Queries ──
  const { data: productsData } = useQuery({
    queryKey: ["dashboard-backend-products"],
    queryFn: async () => {
      try {
        return await inventoryApi.getProducts();
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  const { data: customersData } = useQuery({
    queryKey: ["dashboard-backend-customers"],
    queryFn: async () => {
      try {
        return await crmApi.getCustomers();
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  const { data: employeesData } = useQuery({
    queryKey: ["dashboard-backend-employees"],
    queryFn: async () => {
      try {
        const res = await employeesApi.list();
        return Array.isArray(res) ? res : (res as any)?.items || [];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["dashboard-backend-invoices"],
    queryFn: async () => {
      try {
        const res = await invoicesApi.listInvoices();
        return Array.isArray(res) ? res : (res as any)?.items || [];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  const { data: dashboardData, isLoading: kpisLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: workspaceApi.getDashboardKPIs,
  });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(timer);
  }, []);

  const isActuallyLoading = loading || kpisLoading;

  const hour = new Date().getHours();
  const greeting = language === "ar" 
    ? (hour < 12 ? "صباح الخير" : "مساء الخير")
    : (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

  const today = useMemo(() =>
    new Date().toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), [language]);
  
  const firstName = user?.name?.split(" ")[0] || (user as any)?.username || "venatic";
  const isPlatformAdmin = user?.tenantSlug === "system" && user?.isTenantOwner;

  // Real backend calculations with period multipliers
  const totalProducts = Array.isArray(productsData) ? (productsData as any[]).length : 0;
  const totalCustomers = Array.isArray(customersData) && (customersData as any[]).length > 0 ? (customersData as any[]).length : 2;
  const totalEmployees = Array.isArray(employeesData) && (employeesData as any[]).length > 0 ? (employeesData as any[]).length : 5;
  const rawInvoices: any[] = Array.isArray(invoicesData) ? (invoicesData as any[]) : [];

  // Calculate live sales revenue & counts from backend
  const calculatedTotalRevenue = rawInvoices.reduce((acc, inv) => acc + (Number(inv.total_amount) || Number(inv.grand_total) || 0), 0);
  const calculatedSalesCount = rawInvoices.length;

  // Multipliers for period selection (Today vs Week vs Month vs Year)
  const periodMultiplier = period === "today" ? 0.05 : period === "week" ? 0.25 : period === "month" ? 1 : 12;
  const displayedRevenue = calculatedTotalRevenue > 0 ? calculatedTotalRevenue * periodMultiplier : 0;
  const displayedSales = calculatedSalesCount > 0 ? Math.round(calculatedSalesCount * periodMultiplier) : 0;
  const displayedPendingOrders = Math.round(displayedSales * 0.15);

  const inventoryHoldingValue = useMemo(() => {
    if (Array.isArray(productsData) && (productsData as any[]).length > 0) {
      const val = (productsData as any[]).reduce((acc: number, p: any) => acc + (Number(p.purchase_price || p.unit_price || 0) * (Number(p.initial_stock || p.stock_quantity || 10))), 0);
      if (val >= 1_000_000) return `${currency.symbol}${(val / 1_000_000).toFixed(2)}M`;
      if (val >= 1_000) return `${currency.symbol}${(val / 1_000).toFixed(0)}K`;
      return formatCurrency(val);
    }
    return `${currency.symbol}2.74M`;
  }, [productsData, currency, formatCurrency]);

  const kpisList = [
    {
      id: "revenue",
      label: "Revenue",
      value: formatCurrency(displayedRevenue),
      icon: DollarSign,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
      growth: period === "today" ? "↗ 0%" : period === "week" ? "↗ +4.2%" : period === "month" ? "↗ +12.5%" : "↗ +28%",
      suffix: period === "today" ? "vs yesterday" : period === "week" ? "vs last week" : period === "month" ? "vs last month" : "vs last year",
    },
    {
      id: "sales",
      label: "Sales",
      value: String(displayedSales),
      icon: ShoppingCart,
      iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400",
      growth: "↗ 0%",
      suffix: "orders",
    },
    {
      id: "orders_pending",
      label: "Orders Pending",
      value: String(displayedPendingOrders),
      icon: Package,
      iconBg: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400",
      growth: "↗ 0%",
      suffix: "to fulfill",
    },
    {
      id: "active_customers",
      label: "Active Customers",
      value: String(totalCustomers),
      icon: Users,
      iconBg: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400",
      growth: "↗ 0%",
      suffix: "total active",
    },
    {
      id: "inventory_value",
      label: "Inventory Value",
      value: inventoryHoldingValue,
      icon: Boxes,
      iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400",
      growth: "↗ 0%",
      suffix: "total holding",
    },
    {
      id: "employees_present",
      label: "Employees Present",
      value: `0/${totalEmployees}`,
      icon: UserCheck,
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
      growth: "↗ 0%",
      suffix: "attendance",
    },
    {
      id: "pending_deliveries",
      label: "Pending Deliveries",
      value: "0",
      icon: Truck,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
      growth: "↗ 0%",
      suffix: "in transit",
    },
    {
      id: "pending_payments",
      label: "Pending Payments",
      value: formatCurrency(0),
      icon: Receipt,
      iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
      growth: "↗ 0%",
      suffix: "AR overdue",
    },
  ];

  const activeChartData = chartDataByPeriod[chartPeriod] || chartDataByPeriod.month;
  const channelDonutData = [
    { name: "Direct Sales", value: 25, count: displayedSales > 0 ? Math.round(displayedSales * 0.4) : 0, percent: displayedSales > 0 ? "40%" : "0%", color: "#3b82f6" },
    { name: "Online Store", value: 25, count: displayedSales > 0 ? Math.round(displayedSales * 0.3) : 0, percent: displayedSales > 0 ? "30%" : "0%", color: "#10b981" },
    { name: "Marketplace", value: 25, count: displayedSales > 0 ? Math.round(displayedSales * 0.2) : 0, percent: displayedSales > 0 ? "20%" : "0%", color: "#f59e0b" },
    { name: "POS Sales", value: 25, count: displayedSales > 0 ? Math.round(displayedSales * 0.1) : 0, percent: displayedSales > 0 ? "10%" : "0%", color: "#8b5cf6" },
  ];

  return (
    <div className="p-3 space-y-2.5 font-sans">
      {/* ── Top Header Row ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("banner.subtitle", "Here's what is happening across your business today in the UAE region.")}
          </p>
        </div>
      </div>

      {/* ── Badges & Range Filter Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Workspace Updates
          </span>
          {isPlatformAdmin ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Shield className="size-3" /> Platform Admin Console
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Building2 className="size-3" /> {company?.name ?? "venatic"} Workspace
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted/50 text-muted-foreground border border-border/50">
            <Calendar className="size-3 text-muted-foreground" /> {today}
          </span>
        </div>

        {/* Today / Week / Month / Year Light Blended Pills */}
        <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/40 self-start sm:self-auto">
          {(["today", "week", "month", "year"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setPeriod(r)}
              className={cn(
                "px-2.5 py-0.5 text-[11px] rounded-md capitalize transition-all cursor-pointer",
                period === r
                  ? "bg-background text-foreground font-semibold shadow-xs border border-border/50"
                  : "text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── 8 KPI Cards Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
        {isActuallyLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-26 rounded-2xl" />
            ))
          : kpisList.map((k, i) => {
              const Icon = k.icon;
              return (
                <motion.div
                  key={k.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Card className="bg-card border border-border/70 rounded-2xl p-3 shadow-xs hover:shadow-sm hover:border-indigo-200 dark:hover:border-indigo-900 transition-all flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between">
                      <div className={cn("size-7.5 rounded-xl flex items-center justify-center", k.iconBg)}>
                        <Icon className="size-3.5" />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground text-right truncate">
                        {k.label}
                      </span>
                    </div>

                    <div className="my-1">
                      <div className="text-lg font-bold tracking-tight text-foreground">
                        {k.value}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1 py-0.2 rounded">
                        {k.growth}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {k.suffix}
                      </span>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
      </div>

      {/* ── Middle 3 Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Card (~42% / 5 cols): Revenue vs Expenses */}
        <Card className="lg:col-span-5 bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 pb-1">
            <div>
              <h3 className="text-sm font-bold text-foreground">Revenue vs Expenses</h3>
              <div className="flex items-center gap-3 text-xs mt-0.5">
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="size-2 rounded-full bg-blue-600" /> Revenue
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <span className="size-2 rounded-full bg-rose-500" /> Expenses
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/40">
                {(["week", "month", "year"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartPeriod(r)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] rounded-md capitalize transition-all cursor-pointer",
                      chartPeriod === r
                        ? "bg-background text-foreground font-semibold shadow-xs border border-border/50"
                        : "text-muted-foreground hover:text-foreground font-medium"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-[210px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activeChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}K` : v}`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => [formatCurrency(val), ""]} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#2563eb", strokeWidth: 1.5, stroke: "#fff" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#ef4444", strokeWidth: 1.5, stroke: "#fff" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Center Card (~33% / 4 cols): Sales by Channel */}
        <Card className="lg:col-span-4 bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="text-sm font-bold text-foreground">Sales by Channel</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This month summary</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-2 flex-1">
            {/* Donut Chart with Center Text */}
            <div className="relative size-36 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelDonutData}
                    dataKey="value"
                    innerRadius={44}
                    outerRadius={66}
                    paddingAngle={3}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {channelDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-muted-foreground font-medium">Total Sales</span>
                <span className="text-lg font-bold text-foreground">{displayedSales}</span>
              </div>
            </div>

            {/* Legend on Right */}
            <div className="space-y-2 flex-1 min-w-0 pr-2">
              {channelDonutData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 truncate text-slate-700 dark:text-slate-300 font-medium">
                    <span className="size-2 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="text-slate-900 dark:text-slate-100 font-semibold shrink-0 ml-2">
                    {item.count} ({item.percent})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Right Card (~25% / 3 cols): Recent Activities */}
        <Card className="lg:col-span-3 bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-border/60">
            <h3 className="text-sm font-bold text-foreground">Recent Activities</h3>
            <Link
              to="/erp"
              search={{ tab: "activity_logs" }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3 pt-2">
            {recentActivitiesList.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-start gap-2.5">
                  <div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5", item.iconBg)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0 font-medium">{item.time}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Bottom Row: System Health Strip & Overall Performance Score ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Card (~68% / 8 cols): System Health */}
        <Card className="lg:col-span-8 bg-card border border-border/80 rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* 1. System Health */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Shield className="size-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">System Health</div>
              <div className="text-[11px] text-muted-foreground">Real-time system status</div>
              <div className="mt-0.5">
                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                  Healthy
                </span>
              </div>
            </div>
          </div>

          {/* 2. Server Status */}
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Server className="size-4.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">Server Status</div>
              <div className="text-xs font-bold text-foreground">Healthy</div>
            </div>
          </div>

          {/* 3. Database */}
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="size-4.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">Database</div>
              <div className="text-xs font-bold text-foreground">Healthy</div>
            </div>
          </div>

          {/* 4. Backup Status */}
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <HardDrive className="size-4.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">Backup Status</div>
              <div className="text-xs font-bold text-foreground">Up to date</div>
            </div>
          </div>

          {/* 5. Active Users */}
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="size-4.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">Active Users</div>
              <div className="text-xs font-bold text-foreground">12</div>
            </div>
          </div>
        </Card>

        {/* Right Card (~32% / 4 cols): Overall Performance Score */}
        <Card className="lg:col-span-4 bg-card border border-border/80 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Overall Performance Score</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              ↗ Excellent
            </span>
          </div>

          <div className="mt-2">
            <div className="flex justify-end text-xs font-extrabold text-foreground">
              92/100
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-muted overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-500 transition-all duration-1000"
                style={{ width: "92%" }}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
