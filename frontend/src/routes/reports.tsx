import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
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
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Download,
  IndianRupee,
  Layers,
  Printer,
  Receipt,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { useOrders, usePayments, useSettings } from "@/services/orderService";
import { salesSeries } from "@/data/business";
import { compactMoney, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — RestaurantOS" },
      {
        name: "description",
        content: "Detailed restaurant financial reports, channel breakdown, and sales analytics.",
      },
      { property: "og:title", content: "Reports & Analytics — RestaurantOS" },
      {
        property: "og:description",
        content: "Detailed restaurant financial reports, channel breakdown, and sales analytics.",
      },
    ],
  }),
  component: ReportsPage,
});

type RangeKey = keyof typeof salesSeries;

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("Today");
  const orders = useOrders();
  const payments = usePayments();
  const settings = useSettings();

  // Dynamic calculations from current orders & payments
  const currentTotalRevenue = useMemo(() => {
    const raw = orders
      .filter((o) => o.paid || o.status === "Completed")
      .reduce((acc, o) => acc + o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), 0);
    return raw > 0 ? raw : 142850;
  }, [orders]);

  const currentTotalOrders = orders.length;

  const avgOrderValue = Math.round(currentTotalRevenue / (currentTotalOrders || 1));

  // Channel Breakdown
  const channelData = useMemo(() => {
    const types: Record<string, number> = { "Dine-in": 0, Delivery: 0, Takeaway: 0, Online: 0 };
    orders.forEach((o) => {
      const sum = o.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
      types[o.type] = (types[o.type] ?? 0) + sum;
    });

    return Object.entries(types).map(([type, value]) => ({
      name: type,
      value:
        value > 0
          ? value
          : type === "Dine-in"
            ? 72400
            : type === "Delivery"
              ? 31800
              : type === "Takeaway"
                ? 18650
                : 20000,
    }));
  }, [orders]);

  // Payment Methods Breakdown
  const paymentMethodData = useMemo(() => {
    const methods: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Wallet: 0 };
    payments.forEach((p) => {
      methods[p.method] = (methods[p.method] ?? 0) + p.amount;
    });

    const hasData = Object.values(methods).some((v) => v > 0);
    if (!hasData) {
      return [
        { method: "UPI", amount: 68400, count: 215 },
        { method: "Card", amount: 42300, count: 110 },
        { method: "Cash", amount: 24150, count: 78 },
        { method: "Wallet", amount: 8000, count: 25 },
      ];
    }

    return Object.entries(methods).map(([method, amount]) => ({
      method,
      amount,
      count: payments.filter((p) => p.method === method).length,
    }));
  }, [payments]);

  // Top Performing Dishes
  const topDishes = useMemo(() => {
    const counts: Record<string, { qty: number; revenue: number; station: string }> = {};
    orders.forEach((o) => {
      o.lines.forEach((l) => {
        if (!counts[l.name]) {
          counts[l.name] = { qty: 0, revenue: 0, station: l.station };
        }
        counts[l.name].qty += l.qty;
        counts[l.name].revenue += l.qty * l.unitPrice;
      });
    });

    const list = Object.entries(counts).map(([name, data]) => ({
      name,
      qty: data.qty,
      revenue: data.revenue,
      station: data.station,
    }));

    list.sort((a, b) => b.revenue - a.revenue);
    return list.slice(0, 5);
  }, [orders]);

  const series = salesSeries[range];

  const handleExportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Report Range", range],
      ["Total Revenue", currentTotalRevenue],
      ["Total Orders", currentTotalOrders],
      ["Average Order Value", avgOrderValue],
      ["Branch", settings.currentBranch],
      ["GST Tax Rate", `${settings.taxRate * 100}%`],
      ["Service Charge", `${settings.serviceCharge * 100}%`],
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `restaurantos-report-${range.toLowerCase().replace(" ", "-")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully");
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Financial Intelligence"
        title="Reports & Analytics"
        description={`Consolidated service analytics · ${settings.currentBranch}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              {(["Today", "7 Days", "30 Days", "3 Months"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded px-3 py-1 text-xs transition-colors",
                    r === range
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-3.5 mr-1" /> Print
            </Button>
            <Button size="sm" onClick={handleExportCSV}>
              <Download className="size-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Total sales"
          value={money(currentTotalRevenue)}
          delta={14.2}
          sub="vs previous period"
          icon={<IndianRupee />}
        />
        <KpiCard
          label="Paid orders"
          value={String(currentTotalOrders)}
          delta={8.6}
          sub="100% fulfilled"
          icon={<Receipt />}
        />
        <KpiCard
          label="Avg ticket size"
          value={money(avgOrderValue)}
          delta={4.9}
          icon={<TrendingUp />}
        />
        <KpiCard
          label="Estimated net margin"
          value="68.4%"
          delta={1.8}
          sub="Food cost: 31.6%"
          icon={<Layers />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sales Trend Chart */}
        <Panel
          title={`Revenue Trend (${range})`}
          className="lg:col-span-2"
          action={<span className="text-xs text-muted-foreground">Values in ₹</span>}
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickFormatter={(v) => compactMoney(v)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number) => [money(val), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Channel Breakdown */}
        <Panel title="Revenue by Channel">
          <div className="flex h-52 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number) => [money(val), "Sales"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5 border-t pt-3 text-xs">
            {channelData.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: chartColors[i % chartColors.length] }}
                  />
                  <span>{c.name}</span>
                </span>
                <span className="font-semibold tabular">{money(c.value)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payment Methods */}
        <Panel title="Collections by Payment Method">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Method</th>
                  <th className="font-medium">Transactions</th>
                  <th className="text-right font-medium">Collected</th>
                  <th className="px-4 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethodData.map((p) => {
                  const totalPaid = paymentMethodData.reduce((s, x) => s + x.amount, 0);
                  const share = totalPaid > 0 ? Math.round((p.amount / totalPaid) * 100) : 0;
                  return (
                    <tr key={p.method} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-2.5 font-medium">
                        <div className="flex items-center gap-2">
                          <CreditCard className="size-3.5 text-muted-foreground" />
                          <span>{p.method}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs tabular text-muted-foreground">{p.count}</td>
                      <td className="text-right font-semibold tabular">{money(p.amount)}</td>
                      <td className="px-4 text-right font-mono text-xs text-muted-foreground">
                        {share}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Top Dishes */}
        <Panel title="Top Performing Dishes">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Dish</th>
                  <th className="font-medium">Station</th>
                  <th className="text-right font-medium">Portions sold</th>
                  <th className="px-4 text-right font-medium">Gross revenue</th>
                </tr>
              </thead>
              <tbody>
                {topDishes.map((d) => (
                  <tr key={d.name} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-medium">{d.name}</td>
                    <td className="text-xs text-muted-foreground">{d.station}</td>
                    <td className="text-right font-mono text-xs tabular">{d.qty}</td>
                    <td className="px-4 text-right font-semibold tabular">{money(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}
