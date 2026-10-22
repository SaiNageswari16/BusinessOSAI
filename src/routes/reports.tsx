import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Calendar,
  CreditCard,
  Download,
  IndianRupee,
  Package,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
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
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, orderTotal, totals } from "@/lib/calc";
import { CATEGORIES } from "@/lib/seed";
import { useRestaurantStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({
  component: ReportsScreen,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function ReportsScreen() {
  const orders = useRestaurantStore((s) => s.orders);
  const menu = useRestaurantStore((s) => s.menu);
  const ingredients = useRestaurantStore((s) => s.ingredients);
  const suppliers = useRestaurantStore((s) => s.suppliers);
  const settings = useRestaurantStore((s) => s.settings);

  const [dateRange, setDateRange] = useState<"today" | "7d" | "30d" | "all">("7d");

  const filteredOrders = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateRange === "today"
        ? now - 86400000
        : dateRange === "7d"
          ? now - 7 * 86400000
          : dateRange === "30d"
            ? now - 30 * 86400000
            : 0;
    return orders.filter((o) => o.status !== "cancelled" && o.createdAt >= cutoff);
  }, [orders, dateRange]);

  const summary = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let gst = 0;
    let netTotal = 0;
    filteredOrders.forEach((o) => {
      const b = totals(o.lines, o.discountPct, settings.gstPct);
      subtotal += b.subtotal;
      discount += b.discount;
      gst += b.gst;
      netTotal += b.total;
    });
    const avgOrder = filteredOrders.length ? Math.round(netTotal / filteredOrders.length) : 0;
    return { subtotal, discount, gst, netTotal, avgOrder, count: filteredOrders.length };
  }, [filteredOrders, settings.gstPct]);

  // Channel Revenue Data
  const channelData = useMemo(() => {
    const types = ["dine-in", "takeaway", "delivery"] as const;
    return types.map((t) => {
      const sub = filteredOrders.filter((o) => o.type === t);
      const rev = sub.reduce((s, o) => s + orderTotal(o, settings.gstPct), 0);
      return { name: t.toUpperCase(), orders: sub.length, revenue: rev };
    });
  }, [filteredOrders, settings.gstPct]);

  // Payment Method Breakdown
  const paymentData = useMemo(() => {
    const map = new Map<string, { method: string; count: number; amount: number }>();
    filteredOrders.forEach((o) => {
      const method = o.payment === "paid" ? (o.paymentMethod ?? "UPI") : "Unpaid / Pending";
      const prev = map.get(method) ?? { method, count: 0, amount: 0 };
      prev.count += 1;
      prev.amount += orderTotal(o, settings.gstPct);
      map.set(method, prev);
    });
    return Array.from(map.values());
  }, [filteredOrders, settings.gstPct]);

  // Category & Menu Performance
  const categoryPerformance = useMemo(() => {
    return CATEGORIES.map((cat) => {
      let qty = 0;
      let revenue = 0;
      filteredOrders.forEach((o) => {
        o.lines.forEach((l) => {
          const item = menu.find((m) => m.id === l.itemId);
          if (item?.category === cat) {
            qty += l.qty;
            revenue += l.price * l.qty;
          }
        });
      });
      return { category: cat, qty, revenue };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, menu]);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Reports"
        title="Business Intelligence & Financial Reports"
        subtitle="Audit GST tax collections, channel revenue, menu item velocity, payment modes, and inventory valuation"
        actions={
          <>
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
              {(
                [
                  { id: "today", label: "Today" },
                  { id: "7d", label: "Last 7 Days" },
                  { id: "30d", label: "30 Days" },
                  { id: "all", label: "All Time" },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setDateRange(r.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium",
                    dateRange === r.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.success("Exported CSV financial & GST summary report")}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      {/* Top Financial KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">Gross Sales (Incl. GST)</div>
          <div className="mt-1.5 text-2xl font-bold tabular">{inr(summary.netTotal)}</div>
          <div className="mt-1 text-[11px] text-success font-medium">
            {summary.count} completed/active orders
          </div>
        </div>
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">Net Taxable Sales</div>
          <div className="mt-1.5 text-2xl font-bold tabular">
            {inr(summary.subtotal - summary.discount)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Before {settings.gstPct}% GST
          </div>
        </div>
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">Total GST Collected</div>
          <div className="mt-1.5 text-2xl font-bold tabular text-primary">{inr(summary.gst)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            CGST + SGST ({settings.gstPct}%)
          </div>
        </div>
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">Promotional Discounts</div>
          <div className="mt-1.5 text-2xl font-bold tabular text-warning">
            {inr(summary.discount)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Max policy: {settings.maxDiscountPct}%
          </div>
        </div>
        <div className="surface p-4">
          <div className="text-xs text-muted-foreground">Average Ticket Size</div>
          <div className="mt-1.5 text-2xl font-bold tabular">{inr(summary.avgOrder)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Per order average</div>
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales & Order Trends</TabsTrigger>
          <TabsTrigger value="menu">Menu Performance</TabsTrigger>
          <TabsTrigger value="payments">Payment Summaries</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Valuation</TabsTrigger>
        </TabsList>

        {/* TAB 1: SALES & ORDER TRENDS */}
        <TabsContent value="sales">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="surface p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Revenue by Service Channel</h3>
                <p className="text-xs text-muted-foreground">
                  Comparison across Dine-In, Takeaway, and Delivery
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => inr(v)} />
                    <Bar dataKey="revenue" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Category Revenue Share</h3>
                <p className="text-xs text-muted-foreground">Top contributing kitchen categories</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="category" type="category" width={85} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => inr(v)} />
                    <Bar dataKey="revenue" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: MENU PERFORMANCE */}
        <TabsContent value="menu">
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-3 text-right">Portions Sold</th>
                    <th className="py-3 px-3 text-right">Gross Revenue</th>
                    <th className="py-3 px-4 text-right">Revenue Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryPerformance.map((row) => {
                    const share = summary.subtotal
                      ? Math.round((row.revenue / summary.subtotal) * 100)
                      : 0;
                    return (
                      <tr key={row.category} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-bold text-foreground">{row.category}</td>
                        <td className="py-3 px-3 text-right tabular">{row.qty}</td>
                        <td className="py-3 px-3 text-right font-bold tabular">
                          {inr(row.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right tabular">{share}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: PAYMENT SUMMARIES */}
        <TabsContent value="payments">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="surface p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">Settlement Mode Breakdown</h3>
              <div className="divide-y divide-border">
                {paymentData.map((p) => (
                  <div key={p.method} className="flex items-center justify-between py-3 text-xs">
                    <div>
                      <div className="font-bold text-foreground">{p.method}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.count} transactions
                      </div>
                    </div>
                    <div className="text-sm font-extrabold tabular">{inr(p.amount)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface p-5 flex flex-col justify-between">
              <h3 className="text-sm font-bold text-foreground">Payment Distribution Chart</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      dataKey="amount"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => entry.method}
                    >
                      {paymentData.map((entry, idx) => (
                        <Cell key={entry.method} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => inr(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: INVENTORY REPORTS */}
        <TabsContent value="inventory">
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase">
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Tracked SKUs</th>
                    <th className="py-3 px-3 text-right">Low-Stock SKUs</th>
                    <th className="py-3 px-4 text-right">Stock Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {suppliers.map((sup) => {
                    const ings = ingredients.filter((i) => i.supplierId === sup.id);
                    const low = ings.filter((i) => i.stock <= i.reorder).length;
                    const val = ings.reduce((s, i) => s + i.stock * i.cost, 0);
                    return (
                      <tr key={sup.id} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-bold">{sup.name}</td>
                        <td className="py-3 px-3 text-muted-foreground">{sup.category}</td>
                        <td className="py-3 px-3 text-right tabular">{ings.length}</td>
                        <td className="py-3 px-3 text-right tabular text-destructive font-semibold">
                          {low}
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular">{inr(val)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
