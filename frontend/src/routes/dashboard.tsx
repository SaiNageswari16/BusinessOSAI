import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getAccessToken, getPlatformToken } from "@/lib/auth-tokens";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChefHat,
  Download,
  IndianRupee,
  Plus,
  Receipt,
  Sparkles,
  Users,
  UtensilsCrossed,
  Armchair,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { revenueByType, salesSeries } from "@/data/business";
import {
  getLiveAiInsights,
  useInventory,
  useOrders,
  useReservations,
  useSettings,
  useTables,
} from "@/services/orderService";
import { orderTotal } from "@/lib/billing";
import { compactMoney, minsAgo, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "RestaurantOS — Executive Dashboard" },
      {
        name: "description",
        content: "Live sales, orders, kitchen, tables and AI insights for your restaurant.",
      },
    ],
  }),
  component: Dashboard,
});

type Range = keyof typeof salesSeries;
const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

const topItems = [
  { name: "Chicken Biryani", qty: 86, revenue: 24080 },
  { name: "Paneer Tikka", qty: 54, revenue: 12960 },
  { name: "Butter Naan", qty: 212, revenue: 12720 },
  { name: "Masala Dosa", qty: 61, revenue: 9150 },
  { name: "Cold Coffee", qty: 58, revenue: 8120 },
];

function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!getAccessToken() && !getPlatformToken()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const [range, setRange] = useState<Range>("Today");
  const [period, setPeriod] = useState("today");
  const orders = useOrders();
  const tables = useTables();
  const inventory = useInventory();
  const reservations = useReservations();
  const settings = useSettings();
  const aiInsights = getLiveAiInsights();

  const occupied = tables.filter((t) => ["Occupied", "Billing"].includes(t.status)).length;
  const low = inventory.filter((i) => i.stock / i.par < 0.4);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Dynamic live revenue calculation
  const dynamicSales = useMemo(() => {
    const sum = orders
      .filter((o) => o.paid || o.status === "Completed")
      .reduce((acc, o) => acc + o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), 0);
    return 142850 + sum;
  }, [orders]);

  const totalOrdersCount = 428 + (orders.length > 11 ? orders.length - 11 : 0);
  const avgOrderVal = Math.round(dynamicSales / (totalOrdersCount || 1));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={`${settings.name} · ${settings.currentBranch}`}
        title={`${greet}, ${settings.manager}`}
        description="Here's how service is running right now across all operations."
        actions={
          <>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() =>
                toast.success("Report exported", { description: "sunrise-daily-report.pdf" })
              }
            >
              <Download /> Export report
            </Button>
            <Button asChild>
              <Link to="/pos">
                <Plus /> Create order
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Today's sales"
          value={money(dynamicSales)}
          delta={12.8}
          sub="vs last Wed"
          icon={<IndianRupee />}
        />
        <KpiCard label="Orders" value={String(totalOrdersCount)} delta={8.4} icon={<Receipt />} />
        <KpiCard
          label="Avg order value"
          value={money(avgOrderVal)}
          delta={5.2}
          icon={<UtensilsCrossed />}
        />
        <KpiCard
          label="Table occupancy"
          value={`${Math.round((occupied / tables.length) * 100)}%`}
          delta={9.1}
          sub={`${occupied}/${tables.length} tables`}
          icon={<Armchair />}
        />
        <KpiCard
          label="Kitchen orders"
          value={`${orders.filter((o) => ["New", "Preparing"].includes(o.status)).length + 58}`}
          sub={`${orders.filter((o) => o.status === "Preparing").length + 9} preparing`}
          icon={<ChefHat />}
        />
        <KpiCard label="Customer visits" value="286" delta={14.3} icon={<Users />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Sales overview"
          action={
            <div className="flex rounded-md border p-0.5">
              {(Object.keys(salesSeries) as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs",
                    r === range
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={salesSeries[range]} margin={{ left: -8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  yAxisId="r"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                  tickFormatter={compactMoney}
                />
                <YAxis
                  yAxisId="o"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, n) => (n === "revenue" ? money(v) : v)}
                />
                <Area
                  yAxisId="r"
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#rev)"
                />
                <Area
                  yAxisId="o"
                  type="monotone"
                  dataKey="orders"
                  stroke="var(--chart-2)"
                  strokeWidth={1.5}
                  fill="transparent"
                  strokeDasharray="4 3"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Revenue by order type">
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={revenueByType}
                  dataKey="value"
                  nameKey="type"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={2}
                  stroke="none"
                >
                  {revenueByType.map((_, i) => (
                    <Cell key={i} fill={pieColors[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {revenueByType.map((r, i) => (
              <li key={r.type} className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: pieColors[i] }} />
                {r.type}
                <span className="ml-auto tabular font-medium">{money(r.value)}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular">
                  {Math.round((r.value / 142850) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Table occupancy"
          action={
            <Link to="/operations" className="text-xs text-primary hover:underline">
              Floor view
            </Link>
          }
        >
          <div className="grid grid-cols-4 gap-2">
            {tables.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "rounded-md border px-2 py-2 text-center",
                  t.status === "Occupied" && "border-info/40 bg-info/8",
                  t.status === "Billing" && "border-warning/40 bg-warning/10",
                  t.status === "Reserved" && "border-ai/30 bg-ai/8",
                  t.status === "Cleaning" && "bg-muted",
                )}
              >
                <div className="text-xs font-semibold">{t.id}</div>
                <div className="text-[10px] text-muted-foreground">{t.status}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Kitchen performance"
          action={
            <Link to="/kitchen" className="text-xs text-primary hover:underline">
              Open KDS
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Avg prep" value="13.4m" />
            <Stat label="On-time" value="91%" tone="text-success" />
            <Stat label="Delayed" value="3" tone="text-critical" />
          </div>
          <div className="mt-4 h-36">
            <ResponsiveContainer>
              <BarChart
                data={[
                  { s: "Tandoor", m: 9 },
                  { s: "Main", m: 14 },
                  { s: "Biryani", m: 16 },
                  { s: "Bev", m: 4 },
                  { s: "Dessert", m: 3 },
                ]}
                margin={{ left: -24 }}
              >
                <XAxis
                  dataKey="s"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => `${v} min`}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar dataKey="m" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Sparkles className="size-4 text-ai" /> AI business insights
            </span>
          }
          action={
            <Link to="/ai" className="text-xs text-ai hover:underline">
              View AI insights
            </Link>
          }
        >
          <ul className="space-y-3">
            {aiInsights.slice(0, 3).map((a) => (
              <li key={a.id} className="border-l-2 border-ai/50 pl-3">
                <div className="eyebrow text-ai">{a.kind}</div>
                <p className="mt-0.5 text-sm">{a.text}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Recent orders"
          action={
            <Link to="/orders" className="text-xs text-primary hover:underline">
              All orders
            </Link>
          }
          bodyClass="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="font-medium">Customer</th>
                  <th className="font-medium">Type</th>
                  <th className="font-medium">Time</th>
                  <th className="text-right font-medium">Amount</th>
                  <th className="px-4 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 7).map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium">{o.id}</td>
                    <td>{o.customer}</td>
                    <td className="text-muted-foreground">
                      {o.type}
                      {o.table ? ` · ${o.table}` : ""}
                    </td>
                    <td className="text-muted-foreground tabular">{minsAgo(o.createdAt)}m ago</td>
                    <td className="text-right tabular font-medium">{money(orderTotal(o.lines))}</td>
                    <td className="px-4 text-right">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="grid gap-4">
          <Panel title="Top selling items">
            <ul className="space-y-2.5">
              {topItems.map((t, i) => (
                <li key={t.name} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-xs text-muted-foreground tabular">{i + 1}</span>
                  <span className="flex-1">{t.name}</span>
                  <span className="text-xs text-muted-foreground tabular">{t.qty} sold</span>
                  <span className="w-16 text-right tabular font-medium">
                    {compactMoney(t.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            title="Low stock alerts"
            action={
              <Link to="/inventory" className="text-xs text-primary hover:underline">
                Inventory
              </Link>
            }
          >
            <ul className="space-y-2.5">
              {low.map((i) => (
                <li key={i.id} className="text-sm">
                  <div className="flex justify-between">
                    <span>{i.name}</span>
                    <span className="tabular text-muted-foreground">
                      {i.stock}/{i.par} {i.unit}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        i.stock / i.par < 0.25 ? "bg-critical" : "bg-warning",
                      )}
                      style={{ width: `${(i.stock / i.par) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel
        title="Reservations today"
        action={
          <Link to="/reservations" className="text-xs text-primary hover:underline">
            Manage
          </Link>
        }
        bodyClass="p-0"
      >
        <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {reservations.slice(0, 4).map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-4">
              <div className="font-mono text-sm font-semibold tabular">{r.time}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.guests} guests{r.table ? ` · ${r.table}` : ""}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
      </Panel>
    </PageContainer>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md bg-surface py-2">
      <div className={cn("text-lg font-semibold tabular", tone)}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
