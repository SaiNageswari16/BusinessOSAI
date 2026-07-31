import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowRight, Banknote, Boxes, Building2,
  CalendarCheck, ChevronRight, DollarSign, FileText, Package,
  ShoppingBag, ShoppingCart, Sparkles, Store, TrendingUp,
  UserPlus, Users, Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { useI18n } from "@/contexts/i18n-context";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { AiInsightsPanel } from "@/components/dashboard/ai-insights-panel";
import { Section } from "@/components/dashboard/section";
import {
  kpis, healthBreakdown, revenueData, channelData, ordersTrend, recentActivity,
  notifications, inventoryAlerts, operationsWidgets, branchPerformance, calendarEvents,
} from "@/data/mock";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const KPI_ICONS = [
  DollarSign, ShoppingCart, Package, Users, UserPlus, Boxes,
  Package, Wallet, Store, TrendingUp, Banknote, Wallet,
];

const QUICK_ACTIONS = [
  { label: "Generate Invoice", icon: FileText, tone: "blue", to: "/accounting" },
  { label: "Create PO", icon: ShoppingBag, tone: "purple", to: "/procurement" },
  { label: "Add Product", icon: Package, tone: "cyan", to: "/inventory" },
  { label: "Register Employee", icon: UserPlus, tone: "green", to: "/hrms" },
  { label: "Approve Leave", icon: CalendarCheck, tone: "amber", to: "/hrms" },
  { label: "View Inventory", icon: Boxes, tone: "blue", to: "/inventory" },
  { label: "Open Marketplace", icon: Store, tone: "purple", to: "/marketplace" },
  { label: "Run Payroll", icon: Banknote, tone: "green", to: "/hrms" },
];

const QA_TONES: Record<string, string> = {
  blue:   "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]",
  purple: "bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]",
  cyan:   "bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)]",
  green:  "bg-emerald-500/10 text-emerald-600",
  amber:  "bg-amber-500/10 text-amber-600",
};

const NOTIF_TONES: Record<string, string> = {
  warn:    "border-l-amber-500 bg-amber-500/[0.04]",
  success: "border-l-emerald-500 bg-emerald-500/[0.04]",
  info:    "border-l-blue-500 bg-blue-500/[0.04]",
};

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--card)",
  borderColor: "var(--border)",
  borderRadius: "8px",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

const kpiTranslationMap: Record<string, string> = {
  "Total Revenue": "kpi.total_revenue",
  "Net Sales": "kpi.net_sales",
  "Active Orders": "kpi.active_orders",
  "Total Products": "kpi.total_products",
  "Active Customers": "kpi.active_customers",
  "Total Staff": "kpi.total_staff",
  "Low Stock Items": "kpi.low_stock",
  "Cash Balance": "kpi.cash_balance",
};

const qaTranslationMap: Record<string, string> = {
  "Generate Invoice": "qa.generate_invoice",
  "Create PO": "qa.create_po",
  "Add Product": "qa.add_product",
  "Register Employee": "qa.register_employee",
  "Approve Leave": "qa.approve_leave",
  "View Inventory": "qa.view_inventory",
  "Open Marketplace": "qa.open_marketplace",
  "Run Payroll": "qa.run_payroll",
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000     ? `$${(n / 1_000).toFixed(0)}K`     : `$${n}`;

function Dashboard() {
  const { user } = useAuth();
  const { tenant: company } = useTenant();
  const { language, t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [salesRange, setSalesRange] = useState("month");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const hour = new Date().getHours();
  const greeting = language === "ar" 
    ? (hour < 12 ? "صباح الخير" : "مساء الخير")
    : (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  
  const today = useMemo(() =>
    new Date().toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), [language]);
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const isPlatformAdmin = user?.tenantSlug === "system" && user?.isTenantOwner;

  return (
    <div className="px-4 lg:px-6 py-4 space-y-5 w-full max-w-full">

      {/* ── Welcome Banner ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 text-white p-5 shadow-sm">
          
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <svg width="100%" height="100%" viewBox="0 0 1440 200" preserveAspectRatio="none">
              <ellipse cx="720" cy="100" rx="400" ry="100" fill="#ffffff" opacity="0.05" filter="blur(40px)" />
              <path d="M-100,150 C300,-50 600,250 1540,50" fill="none" stroke="#ffffff" strokeWidth="6" opacity="0.05" filter="blur(4px)" />
              <path d="M-100,100 C400,-20 800,250 1540,80" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.07" />
              <path d="M-100,180 C500,0 900,200 1540,40" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.1" />
            </svg>
          </div>
          
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-blue-50 font-medium">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-white shadow-sm">
                  <span className="size-1.5 rounded-full bg-blue-300" />
                  {t("banner.live_badge", "Live Workspace Updates")}
                </span>
                {isPlatformAdmin ? (
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-white">
                    Platform Admin Console
                  </span>
                ) : (
                  <span>{company?.name ?? "IOTRONCS Retail"} {language === "ar" ? "مكان العمل" : "Workspace"}</span>
                )}
                <span>· {today}</span>
              </div>

              <h1 className="text-2xl font-bold mt-2 tracking-tight">
                {greeting}, {firstName} 👋
              </h1>
              <p className="text-blue-50/90 mt-1 text-sm max-w-xl">
                {t("banner.subtitle", "Here is what is happening across your business today in the UAE region.")}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button variant="outline" className="gap-1.5 bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white transition-colors">
                <FileText className="size-4" /> {language === "ar" ? "تصدير التقرير" : "Export brief"}
              </Button>
              <Button asChild className="gap-1.5 bg-white text-blue-700 hover:bg-white/90 shadow-sm border-0 transition-colors">
                <Link to="/copilot">
                  <Sparkles className="size-4" /> {language === "ar" ? "اسأل الذكاء الاصطناعي" : "Ask Antigravity AI"}
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── KPI Grid ── */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {language === "ar" ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators"}
            </h2>
          </div>
          <Tabs defaultValue="month">
            <TabsList className="h-8">
              <TabsTrigger value="today" className="text-xs">{language === "ar" ? "اليوم" : "Today"}</TabsTrigger>
              <TabsTrigger value="week"  className="text-xs">{language === "ar" ? "الأسبوع" : "Week"}</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">{language === "ar" ? "الشهر" : "Month"}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : kpis.slice(0, 8).map((k, i) => {
                const Icon = KPI_ICONS[i] ?? DollarSign;
                const translatedLabel = t(kpiTranslationMap[k.label] || k.label, k.label);
                return (
                  <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <KpiTile {...k} label={translatedLabel} icon={<Icon className="size-4" />} delay={0} />
                  </motion.div>
                );
              })}
        </div>
      </section>

      {/* ── AI Insights + Quick Actions ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AiInsightsPanel />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            {t("qa.title", "Quick Actions")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action, i) => {
              const translatedQaLabel = t(qaTranslationMap[action.label] || action.label, action.label);
              return (
                <Link key={i} to={action.to}>
                  <div className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-card hover:bg-muted/30 hover:border-primary/30 transition-all cursor-pointer h-full">
                    <div className={`size-10 rounded-xl grid place-items-center transition-transform group-hover:scale-110 ${QA_TONES[action.tone]}`}>
                      <action.icon className="size-5" />
                    </div>
                    <span className="text-[11px] font-bold text-center leading-tight">{translatedQaLabel}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Revenue Chart ── */}
      <Section
        title="Revenue vs Expenses"
        subtitle="Financial performance this year"
        action={
          <Tabs value={salesRange} onValueChange={setSalesRange}>
            <TabsList className="h-8">
              <TabsTrigger value="week"  className="text-xs">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
              <TabsTrigger value="year"  className="text-xs">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--brand-blue)"   stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--brand-blue)"   stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--brand-purple)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--brand-purple)" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" name="Revenue"  dataKey="revenue"  stroke="var(--brand-blue)"   strokeWidth={2.5} fill="url(#rev)" />
            <Area type="monotone" name="Expenses" dataKey="expenses" stroke="var(--brand-purple)" strokeWidth={2.5} fill="url(#exp)" />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      {/* ── Channels + Orders Trend ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Revenue by Channel" subtitle="Current month mix">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={channelData} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={3}>
                {channelData.map((c) => <Cell key={c.name} fill={c.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {channelData.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
                <span className="font-semibold tabular-nums">{c.value}%</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Orders — 14-day Trend" subtitle="Across all stores and channels" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={160}>
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

      {/* ── Operations Status ── */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Business Operations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {operationsWidgets.map((w, i) => (
            <motion.div key={w.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-4 border-border/60 hover:shadow-md transition group cursor-pointer">
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
      </section>

      {/* ── Branch Performance + Inventory Alerts ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Branch Performance" subtitle="Revenue & profit — current month" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={branchPerformance} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="branch" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar name="Revenue" dataKey="revenue" fill="var(--brand-blue)"   radius={[6, 6, 0, 0]} />
              <Bar name="Profit"  dataKey="profit"  fill="var(--brand-purple)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
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

        <Section title="Inventory Alerts" subtitle="Items below safety stock"
          action={<Button variant="ghost" size="sm" className="text-xs">Reorder all</Button>}>
          <div className="space-y-2.5 mt-2">
            {inventoryAlerts.map((a) => (
              <div key={a.sku} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition cursor-pointer">
                <div className={cn("size-9 rounded-lg grid place-items-center shrink-0",
                  a.status === "critical" && "bg-rose-500/10 text-rose-600",
                  a.status === "warn"     && "bg-amber-500/10 text-amber-600",
                  a.status === "info"     && "bg-blue-500/10 text-blue-600"
                )}>
                  <AlertTriangle className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{a.name}</div>
                  <div className="text-[10px] text-muted-foreground">{a.sku} · {a.daysLeft}d left</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-rose-500">{a.level} units</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{a.status}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Activity + Notifications + Upcoming ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Section title="Recent Activity" subtitle="Across all modules" className="lg:col-span-1">
          <div className="relative mt-4 pl-4 before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-border">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="relative mb-5 last:mb-0">
                <div className="absolute -left-[21px] size-5 rounded-full border-2 border-background bg-muted grid place-items-center">
                  <div className="size-1.5 rounded-full bg-primary" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-foreground mb-0.5">{activity.who} {activity.action}</div>
                  <div className="text-muted-foreground mb-1">{activity.target}</div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/80">
                    <span>{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4 text-xs h-8">View full audit log</Button>
        </Section>

        <Section title="Notifications" action={<Button variant="ghost" size="sm" className="text-xs text-primary">Mark all read</Button>}>
          <div className="space-y-3 mt-2">
            {notifications.map((n) => (
              <div key={n.id} className={cn("p-3 rounded-lg border-l-2 text-sm", NOTIF_TONES[n.tone])}>
                <div className="font-semibold text-foreground">{n.title}</div>
                <div className="text-muted-foreground text-xs mt-1">{n.body}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-2 font-mono">{n.time}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Upcoming Events" subtitle="Meetings and deadlines">
          <div className="space-y-3 mt-2">
            {calendarEvents.map((event, idx) => (
              <div key={idx} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition cursor-pointer">
                <div className="flex flex-col items-center justify-center min-w-14 bg-muted/50 rounded p-1 text-center">
                  <span className="text-sm font-bold leading-none">{event.date}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold">{event.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{event.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Business Health Score ── */}
      <Card className="p-6 lg:p-8 border-border/60 overflow-hidden relative">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-[var(--brand-blue)]/5 to-transparent pointer-events-none" />
        <div className="relative grid lg:grid-cols-[auto_1fr] gap-8 items-center">
          <div className="flex items-center gap-6">
            <div className="relative size-40">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="78%" outerRadius="100%"
                  data={[{ name: "Health", value: 92, fill: "url(#hg)" }]}
                  startAngle={90} endAngle={-270}
                >
                  <defs>
                    <linearGradient id="hg" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%"   stopColor="var(--brand-blue)"   />
                      <stop offset="100%" stopColor="var(--brand-purple)" />
                    </linearGradient>
                  </defs>
                  <RadialBar background={{ fill: "var(--muted)" }} dataKey="value" cornerRadius={20} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-4xl font-bold tabular-nums">92</div>
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
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  View breakdown <ArrowRight className="size-3.5" />
                </Button>
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

      {/* Recharts Legend void to suppress unused import warning */}
      {false && <Line />}
      {void Legend}
    </div>
  );
}
