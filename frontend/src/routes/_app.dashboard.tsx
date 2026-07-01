import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Banknote, Bell, Boxes, Building2,
  CalendarCheck, CheckCircle2, ChevronRight, DollarSign, FileText, Info,
  Package, Receipt, Send, ShoppingBag, ShoppingCart, Sparkles, Store,
  TrendingUp, Trophy, UserPlus, Users, Wallet, Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { AiInsightsPanel } from "@/components/dashboard/ai-insights-panel";
import { Section } from "@/components/dashboard/section";
import {
  kpis, healthBreakdown, revenueData, channelData, ordersTrend, recentActivity,
  notifications, inventoryAlerts, operationsWidgets, branchPerformance, hrSummary,
  marketplaceSummary, financialOverview, aiForecast, calendarEvents, suggestedPrompts,
} from "@/data/mock";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const KPI_ICONS = [
  DollarSign, ShoppingCart, Receipt, Users, UserPlus, Boxes,
  Package, Wallet, Store, TrendingUp, Banknote, Wallet,
];

const QUICK_ACTIONS = [
  { label: "Generate Invoice", icon: FileText, tone: "blue" },
  { label: "Create PO", icon: ShoppingBag, tone: "purple" },
  { label: "Add Product", icon: Package, tone: "cyan" },
  { label: "Register Employee", icon: UserPlus, tone: "green" },
  { label: "Approve Leave", icon: CalendarCheck, tone: "amber" },
  { label: "View Inventory", icon: Boxes, tone: "blue" },
  { label: "Open Marketplace", icon: Store, tone: "purple" },
  { label: "Run Payroll", icon: Banknote, tone: "green" },
];

const QA_TONES: Record<string, string> = {
  blue: "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]",
  purple: "bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]",
  cyan: "bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)]",
  green: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
};

const NOTIF_TONES: Record<string, string> = {
  warn: "border-l-amber-500 bg-amber-500/[0.04]",
  success: "border-l-emerald-500 bg-emerald-500/[0.04]",
  info: "border-l-blue-500 bg-blue-500/[0.04]",
};

const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;

function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salesRange, setSalesRange] = useState("month");
  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = useMemo(() => new Date().toLocaleDateString("en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }), []);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="px-6 lg:px-10 py-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ───────── Welcome ───────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden border-border/60 p-6 lg:p-8">
          <div className="absolute inset-0 gradient-brand opacity-[0.06]" />
          <div className="absolute -top-24 -right-24 size-72 rounded-full bg-[var(--brand-purple)]/15 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-[var(--brand-blue)]/15 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  All systems operational
                </span>
                <span>· {today}</span>
              </div>
              <h1 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
                {greeting}, {firstName} <span className="inline-block animate-[wave_1.5s_ease-in-out]">👋</span>
              </h1>
              <p className="mt-1.5 text-muted-foreground max-w-xl">
                Your business is up <span className="font-semibold text-emerald-600">+12.4%</span> this month.
                <span className="text-gradient-brand font-semibold"> 4 AI insights</span> need your review.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <Chip icon={<Building2 className="size-3.5" />} label="Nimbus Retail Group" />
                <Chip icon={<Store className="size-3.5" />} label="HQ — San Francisco" />
                <Chip icon={<Zap className="size-3.5" />} label="Business Health 92/100" tone="brand" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-1.5"><FileText className="size-4" /> Export brief</Button>
              <Button asChild className="gap-1.5 gradient-brand text-white border-0 hover:opacity-90">
                <Link to="/copilot"><Sparkles className="size-4" /> Ask Copilot</Link>
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ───────── Health Hero ───────── */}
      <HealthHero />

      {/* ───────── KPI grid ───────── */}
      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">Key Performance Indicators</h2>
            <p className="text-xs text-muted-foreground">Live · auto-refreshing every 60s</p>
          </div>
          <Tabs defaultValue="today"><TabsList className="h-8">
            <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
            <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
          </TabsList></Tabs>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
            : kpis.map((k, i) => {
                const Icon = KPI_ICONS[i] ?? DollarSign;
                return <KpiTile key={k.label} {...k} icon={<Icon className="size-4" />} delay={i * 0.03} />;
              })}
        </div>
      </section>

      {/* ───────── AI Insights + Sales analytics ───────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1"><AiInsightsPanel /></div>
        <div className="lg:col-span-2">
          <Section
            title="Sales Analytics"
            subtitle="Revenue vs Expenses · all channels"
            action={
              <Tabs value={salesRange} onValueChange={setSalesRange}>
                <TabsList className="h-8">
                  <TabsTrigger value="day" className="text-xs">Day</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                  <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Mini label="Daily avg" value="$24.8K" change={6.2} />
              <Mini label="Weekly" value="$184K" change={9.1} />
              <Mini label="YTD growth" value="+18.4%" change={2.3} />
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-blue)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--brand-blue)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-purple)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--brand-purple)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand-blue)" strokeWidth={2.5} fill="url(#rev)" />
                <Area type="monotone" dataKey="expenses" stroke="var(--brand-purple)" strokeWidth={2.5} fill="url(#exp)" />
              </AreaChart>
            </ResponsiveContainer>
          </Section>
        </div>
      </div>

      {/* ───────── Channels + Orders trend ───────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Revenue by Channel" subtitle="Current month mix" className="lg:col-span-1">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={channelData} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={3}>
                {channelData.map((c) => <Cell key={c.name} fill={c.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {channelData.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: c.color }} /> {c.name}</span>
                <span className="font-semibold tabular-nums">{c.value}%</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Orders — 14 day trend" subtitle="Across all stores and channels" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ordersTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
              <Bar dataKey="orders" fill="var(--brand-blue)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* ───────── Business Operations widgets ───────── */}
      <Section title="Business Operations" subtitle="Real-time status across departments" noCard className="">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {operationsWidgets.map((w, i) => (
            <motion.div key={w.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-4 border-border/60 hover:shadow-elegant transition group">
                <div className="flex items-start justify-between">
                  <div className="text-xs font-medium text-muted-foreground">{w.label}</div>
                  <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{w.count}</div>
                <div className="mt-2"><Progress value={w.progress} className="h-1.5" /></div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">{w.status}</div>
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ───────── Branch Performance + Inventory Alerts ───────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Branch Performance" subtitle="Revenue & profit — current month ($K)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={branchPerformance} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="branch" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
              <Bar dataKey="revenue" fill="var(--brand-blue)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="profit" fill="var(--brand-purple)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
            {branchPerformance.map((b) => (
              <div key={b.branch} className="text-center">
                <div className="text-[10px] text-muted-foreground truncate">{b.branch}</div>
                <div className={cn("text-xs font-bold", b.growth >= 10 ? "text-emerald-600" : "text-amber-600")}>
                  +{b.growth}%
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Inventory Alerts" subtitle="Below safety stock" className="lg:col-span-1"
          action={<Button variant="ghost" size="sm" className="text-xs">Reorder all</Button>}>
          <div className="space-y-2.5">
            {inventoryAlerts.map((a) => (
              <div key={a.sku} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition">
                <div className={cn("size-9 rounded-lg grid place-items-center shrink-0",
                  a.status === "critical" && "bg-rose-500/10 text-rose-600",
                  a.status === "warn" && "bg-amber-500/10 text-amber-600",
                  a.status === "info" && "bg-blue-500/10 text-blue-600")}>
                  <Package className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{a.name}</div>
                  <div className="text-[10px] text-muted-foreground">{a.sku} · {a.level} units</div>
                </div>
                <div className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                  a.status === "critical" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600")}>
                  {a.daysLeft}d
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ───────── HR Summary + Marketplace ───────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="HR Summary" subtitle={`${hrSummary.total} employees · payroll: ${hrSummary.payrollStatus}`}>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <Mini label="Present" value={String(hrSummary.present)} change={0.8} />
            <Mini label="On leave" value={String(hrSummary.onLeave)} change={-1.2} />
            <Mini label="Remote" value={String(hrSummary.remote)} change={4.5} />
            <Mini label="Requests" value={String(hrSummary.leaveRequests)} change={2.1} />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={hrSummary.departments} dataKey="value" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {hrSummary.departments.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-[11px] w-36">
              {hrSummary.departments.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="size-2 rounded-full shrink-0" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Top performers</div>
            <div className="space-y-1.5">
              {hrSummary.topPerformers.map((p) => (
                <div key={p.name} className="flex items-center gap-2.5 text-xs">
                  <Avatar className="size-6"><AvatarFallback className="text-[9px] bg-muted">{p.name.split(" ").map(w => w[0]).join("")}</AvatarFallback></Avatar>
                  <span className="font-medium flex-1 truncate">{p.name}</span>
                  <span className="text-muted-foreground">{p.dept}</span>
                  <span className="font-bold text-emerald-600 tabular-nums">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Marketplace Summary" subtitle={`${marketplaceSummary.vendors} vendors · ★ ${marketplaceSummary.rating}`}>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <Mini label="Orders" value={marketplaceSummary.orders.toLocaleString()} change={21.8} />
            <Mini label="Revenue" value={fmt(marketplaceSummary.revenue)} change={18.4} />
            <Mini label="Returns" value={String(marketplaceSummary.returns)} change={-4.1} />
            <Mini label="Cancels" value={String(marketplaceSummary.cancelled)} change={-2.4} />
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={marketplaceSummary.weekly} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="orders" stroke="var(--brand-cyan)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="revenue" stroke="var(--brand-purple)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 pt-3 border-t">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Top sellers</div>
            <div className="space-y-1.5">
              {marketplaceSummary.topSellers.slice(0, 4).map((s) => (
                <div key={s.vendor} className="flex items-center gap-2 text-xs">
                  <div className="size-6 rounded bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-purple)] grid place-items-center text-white text-[9px] font-bold">
                    {s.vendor[0]}
                  </div>
                  <span className="font-medium flex-1 truncate">{s.vendor}</span>
                  <span className="text-muted-foreground tabular-nums">{s.orders} ord</span>
                  <span className="font-bold tabular-nums">{fmt(s.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* ───────── Financial Overview ───────── */}
      <Section title="Financial Overview" subtitle="Income · Cash · Receivables · Payables">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <FinTile label="Income (MTD)" value={fmt(financialOverview.income)} change={12.4} tone="green" />
          <FinTile label="Expenses (MTD)" value={fmt(financialOverview.expenses)} change={4.1} tone="purple" />
          <FinTile label="Net Profit" value={fmt(financialOverview.profit)} change={18.4} tone="blue" />
          <FinTile label="Cash Balance" value={fmt(financialOverview.cash)} change={3.2} tone="cyan" />
          <FinTile label="GST Collected" value={fmt(financialOverview.gst)} change={6.8} tone="amber" />
          <FinTile label="TDS Deducted" value={fmt(financialOverview.tds)} change={2.1} tone="amber" />
          <FinTile label="Receivables" value={fmt(financialOverview.receivables)} change={-3.2} tone="blue" />
          <FinTile label="Payables" value={fmt(financialOverview.payables)} change={-6.4} tone="purple" />
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Cash flow — 12 months ($K)</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={financialOverview.cashFlow} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="inflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--brand-green)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--brand-green)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.7 0.18 25)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="oklch(0.7 0.18 25)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="inflow" stroke="var(--brand-green)" strokeWidth={2.5} fill="url(#inflow)" />
            <Area type="monotone" dataKey="outflow" stroke="oklch(0.7 0.18 25)" strokeWidth={2.5} fill="url(#outflow)" />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      {/* ───────── AI Forecast ───────── */}
      <Section title="AI Forecast" subtitle="Predictive analytics for next 30 days" noCard>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {aiForecast.map((f, i) => (
            <motion.div key={f.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
              <Card className="relative overflow-hidden p-4 border-border/60 bg-gradient-to-br from-primary/[0.04] to-transparent hover:shadow-elegant transition">
                <div className="absolute top-2 right-2 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {f.confidence}%
                </div>
                <div className="size-7 rounded-lg gradient-brand grid place-items-center text-white mb-2">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="text-[11px] text-muted-foreground">{f.label}</div>
                <div className="text-lg font-bold tabular-nums mt-0.5">{f.value}</div>
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5">
                  <ArrowUpRight className="size-3" /> {f.change}%
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ───────── Activity + Notifications + Calendar ───────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Recent Activity" subtitle="Across your team & systems"
          action={<Button variant="ghost" size="sm" className="text-xs">View all</Button>}>
          <div className="relative space-y-0">
            {recentActivity.map((a, i) => (
              <div key={a.id} className="relative flex items-start gap-3 py-2.5">
                {i < recentActivity.length - 1 && (
                  <div className="absolute left-[15px] top-9 bottom-0 w-px bg-border" />
                )}
                <div className={cn("size-8 rounded-full grid place-items-center shrink-0 relative z-10 ring-4 ring-background",
                  a.type === "win" && "bg-emerald-500/10 text-emerald-600",
                  a.type === "approval" && "bg-blue-500/10 text-blue-600",
                  a.type === "alert" && "bg-amber-500/10 text-amber-600",
                  a.type === "info" && "bg-violet-500/10 text-violet-600")}>
                  {a.type === "win" ? <Trophy className="size-4" /> :
                   a.type === "approval" ? <CheckCircle2 className="size-4" /> :
                   a.type === "alert" ? <AlertTriangle className="size-4" /> :
                   <Info className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    <span className="font-semibold">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.action}</span>{" "}
                    <span className="font-medium">{a.target}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Notifications" subtitle={`${notifications.filter(n => n.unread).length} unread`}
          action={<Button variant="ghost" size="sm" className="text-xs gap-1"><Bell className="size-3.5" /> Mark all</Button>}>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className={cn("p-3 rounded-lg border-l-4 border border-border/60", NOTIF_TONES[n.tone])}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-semibold">{n.title}</div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{n.time}</div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{n.body}</div>
                {n.unread && <div className="mt-1.5"><span className="inline-block size-1.5 rounded-full bg-primary" /></div>}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Calendar" subtitle="Upcoming this week"
          action={<Button variant="ghost" size="sm" className="text-xs">Open</Button>}>
          <div className="space-y-2">
            {calendarEvents.map((e, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition">
                <div className={cn("flex flex-col items-center justify-center size-12 rounded-lg shrink-0 text-[10px] font-bold uppercase",
                  e.tone === "blue" && "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]",
                  e.tone === "purple" && "bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]",
                  e.tone === "amber" && "bg-amber-500/10 text-amber-600",
                  e.tone === "green" && "bg-emerald-500/10 text-emerald-600")}>
                  <div className="text-[9px] opacity-80">{e.date}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{e.title}</div>
                  <div className="text-[10px] text-muted-foreground">{e.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ───────── Quick Actions ───────── */}
      <Section title="Smart Quick Actions" subtitle="Jump into common workflows" noCard>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {QUICK_ACTIONS.map((a, i) => (
            <motion.button
              key={a.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              whileHover={{ y: -3 }}
              className="flex flex-col items-start gap-3 p-4 rounded-xl border border-border/60 bg-card hover:shadow-elegant transition text-left"
            >
              <div className={cn("size-10 rounded-lg grid place-items-center", QA_TONES[a.tone])}>
                <a.icon className="size-5" />
              </div>
              <div>
                <div className="text-xs font-semibold">{a.label}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                  Launch <ArrowRight className="size-2.5" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* ───────── AI Copilot Preview ───────── */}
      <Card className="relative overflow-hidden p-6 lg:p-8 border-border/60">
        <div className="absolute inset-0 gradient-brand opacity-[0.06]" />
        <div className="absolute -top-20 -right-20 size-64 rounded-full bg-[var(--brand-purple)]/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 items-end">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-8 rounded-lg gradient-brand grid place-items-center text-white shadow-elegant">
                <Sparkles className="size-4" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-gradient-brand">BusinessOS AI</div>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Ask anything about your business</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Sales, inventory, finance, people — get instant AI answers with sources.
            </p>
            <div className="mt-4 flex items-center gap-2 p-2 rounded-xl border bg-background/60 backdrop-blur shadow-elegant">
              <Sparkles className="size-4 text-primary ml-2 shrink-0" />
              <Input
                placeholder="Ask BusinessOS AI…"
                className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-9"
              />
              <Button asChild size="sm" className="gradient-brand text-white border-0 hover:opacity-90 gap-1">
                <Link to="/copilot">Ask <Send className="size-3" /></Link>
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestedPrompts.slice(0, 5).map((p) => (
                <Link
                  key={p.title}
                  to="/copilot"
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-background/60 hover:bg-muted transition"
                >
                  <span className="mr-1">{p.icon}</span>{p.title}
                </Link>
              ))}
            </div>
          </div>
          <Button asChild variant="outline" className="gap-1.5 self-start lg:self-end">
            <Link to="/copilot">Open Full Copilot <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
} as const;

function Chip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: "brand" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      tone === "brand"
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-border bg-background/60",
    )}>
      {icon}{label}
    </span>
  );
}

function Mini({ label, value, change }: { label: string; value: string; change: number }) {
  const up = change >= 0;
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="text-sm font-bold tabular-nums mt-0.5">{value}</div>
      <div className={cn("text-[10px] font-semibold", up ? "text-emerald-600" : "text-rose-600")}>
        {up ? "+" : ""}{change}%
      </div>
    </div>
  );
}

function FinTile({ label, value, change, tone }: { label: string; value: string; change: number; tone: string }) {
  const up = change >= 0;
  return (
    <Card className="p-3.5 border-border/60 hover:shadow-elegant transition">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className={cn("size-6 rounded grid place-items-center", QA_TONES[tone])}>
          <DollarSign className="size-3" />
        </div>
      </div>
      <div className="text-xl font-bold tabular-nums mt-1">{value}</div>
      <div className={cn("text-[11px] font-semibold mt-0.5", up ? "text-emerald-600" : "text-rose-600")}>
        {up ? "▲" : "▼"} {Math.abs(change)}%
      </div>
    </Card>
  );
}

function HealthHero() {
  const score = 92;
  const data = [{ name: "score", value: score, fill: "url(#hg)" }];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <Card className="relative overflow-hidden border-border/60 p-6 lg:p-8">
        <div className="absolute inset-0 gradient-brand opacity-[0.04]" />
        <div className="relative grid lg:grid-cols-[auto_1fr] gap-8 items-center">
          <div className="flex items-center gap-6">
            <div className="relative size-40">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="78%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
                  <defs>
                    <linearGradient id="hg" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-blue)" />
                      <stop offset="100%" stopColor="var(--brand-purple)" />
                    </linearGradient>
                  </defs>
                  <RadialBar background={{ fill: "var(--muted)" }} dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-4xl font-bold tabular-nums">{score}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">/ 100 Health</div>
                </div>
              </div>
            </div>
            <div className="max-w-xs">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded">
                <TrendingUp className="size-3" /> Excellent
              </div>
              <div className="text-xl font-bold mt-2 leading-tight">Your business is performing exceptionally well.</div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Revenue increased by <span className="font-semibold text-foreground">14%</span> this month.
                Two branches require inventory replenishment.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">View breakdown <ArrowRight className="size-3.5" /></Button>
                <Button size="sm" className="gap-1.5 text-xs gradient-brand text-white border-0 hover:opacity-90">
                  <Sparkles className="size-3.5" /> Get AI advice
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3.5">
            {healthBreakdown.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground truncate">{s.label}</span>
                  <span className="font-bold tabular-nums">{s.score}</span>
                </div>
                <Progress value={s.score} className="h-1.5" />
                <div className="mt-0.5 text-[10px] text-muted-foreground">{s.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

void Legend;
