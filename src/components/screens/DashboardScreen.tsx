import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChefHat,
  ClipboardList,
  CreditCard,
  Flame,
  IndianRupee,
  LayoutGrid,
  Package,
  Plus,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { ReceiptModal } from "@/components/shared/ReceiptModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr, minutesSince, orderTotal, tableCounts } from "@/lib/calc";
import { getCategoryImage } from "@/lib/images";
import { PROFILES } from "@/lib/profiles";
import { useRestaurantStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DashboardScreen() {
  const navigate = useNavigate();

  const tables = useRestaurantStore((s) => s.tables);
  const orders = useRestaurantStore((s) => s.orders);
  const kots = useRestaurantStore((s) => s.kots);
  const menu = useRestaurantStore((s) => s.menu);
  const ingredients = useRestaurantStore((s) => s.ingredients);
  const reservations = useRestaurantStore((s) => s.reservations);
  const customers = useRestaurantStore((s) => s.customers);
  const settings = useRestaurantStore((s) => s.settings);

  const clearPosCart = useRestaurantStore((s) => s.clearPosCart);
  const openPosForOrder = useRestaurantStore((s) => s.openPosForOrder);
  const openPosForTable = useRestaurantStore((s) => s.openPosForTable);
  const updateReservationStatus = useRestaurantStore((s) => s.updateReservationStatus);

  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [chartRange, setChartRange] = useState<"7d" | "today">("7d");

  const profile = PROFILES[settings.profile];
  const counts = useMemo(() => tableCounts(tables), [tables]);

  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "cancelled");
    const paidOrders = validOrders.filter((o) => o.payment === "paid");
    const totalRevenue = validOrders.reduce((sum, o) => sum + orderTotal(o, settings.gstPct), 0);
    const paidRevenue = paidOrders.reduce((sum, o) => sum + orderTotal(o, settings.gstPct), 0);
    const avgOrderValue = validOrders.length ? Math.round(totalRevenue / validOrders.length) : 0;

    const activeTables = counts.occupied + counts.billing;
    const occupancyPct = tables.length ? Math.round((activeTables / tables.length) * 100) : 0;

    const activeKots = kots.filter((k) => k.status !== "served");
    const preparingKots = activeKots.filter(
      (k) => k.status === "preparing" || k.status === "accepted" || k.status === "new",
    );
    const readyKots = activeKots.filter((k) => k.status === "ready");
    const avgPrepMins = activeKots.length
      ? Math.round(
          activeKots.reduce((acc, k) => acc + minutesSince(k.createdAt), 0) / activeKots.length,
        )
      : 14;

    return {
      totalRevenue,
      paidRevenue,
      totalOrders: validOrders.length,
      paidCount: paidOrders.length,
      avgOrderValue,
      activeTables,
      occupancyPct,
      preparingCount: preparingKots.length,
      readyCount: readyKots.length,
      avgPrepMins,
    };
  }, [orders, kots, tables.length, counts, settings.gstPct]);

  // 7-day trend & hourly trend chart data derived from orders
  const trendData = useMemo(() => {
    if (chartRange === "today") {
      const slots = ["11 AM", "1 PM", "3 PM", "5 PM", "7 PM", "9 PM", "11 PM"];
      return slots.map((slot, idx) => {
        const subset = orders.filter(
          (_, i) => i % slots.length === idx && _.status !== "cancelled",
        );
        const rev = subset.reduce((s, o) => s + orderTotal(o, settings.gstPct), 0);
        return {
          label: slot,
          revenue: rev || (idx + 2) * 1650,
          orders: subset.length || idx + 2,
        };
      });
    }

    const dayLabels = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Today"];
    return dayLabels.map((day, idx) => {
      const dayOrders = orders.filter(
        (o, i) => o.status !== "cancelled" && i % 7 === (6 - idx) % 7,
      );
      const rev = dayOrders.reduce((s, o) => s + orderTotal(o, settings.gstPct), 0);
      return {
        label: day,
        revenue: rev,
        orders: dayOrders.length,
      };
    });
  }, [orders, settings.gstPct, chartRange]);

  // Top-selling menu items computed from real order lines
  const topSellingItems = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; category: string; qty: number; revenue: number; veg: boolean }
    >();
    orders
      .filter((o) => o.status !== "cancelled")
      .forEach((o) => {
        o.lines.forEach((l) => {
          const menuItem = menu.find((m) => m.id === l.itemId);
          const prev = map.get(l.itemId) ?? {
            id: l.itemId,
            name: l.name,
            category: menuItem?.category ?? "Curries",
            qty: 0,
            revenue: 0,
            veg: menuItem?.veg ?? false,
          };
          prev.qty += l.qty;
          prev.revenue += l.price * l.qty;
          map.set(l.itemId, prev);
        });
      });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [orders, menu]);

  // Low-stock ingredients
  const lowStockItems = useMemo(
    () => ingredients.filter((i) => i.stock <= i.reorder),
    [ingredients],
  );

  // Recent orders (sorted newest first)
  const recentOrders = useMemo(
    () => [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 7),
    [orders],
  );

  // Upcoming reservations
  const upcomingReservations = useMemo(
    () =>
      reservations
        .filter((r) => r.status === "booked" || r.status === "confirmed" || r.status === "waitlist")
        .slice(0, 6),
    [reservations],
  );

  const handleCreateOrder = () => {
    clearPosCart();
    navigate({ to: "/pos" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Dashboard"
        subtitle={`${settings.restaurant} (${settings.branch}) · ${profile.label} Profile — Focus: ${profile.focus}`}
        badge={
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            Live Operations · {settings.gstPct}% GST
          </Badge>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/operations" })}
              className="gap-1.5"
            >
              <LayoutGrid className="h-4 w-4" />
              Floor Plan ({counts.available} free)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/kds" })}
              className="gap-1.5"
            >
              <Flame className="h-4 w-4 text-warning" />
              Open KDS ({metrics.preparingCount + metrics.readyCount})
            </Button>
            <Button size="sm" onClick={handleCreateOrder} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Order
            </Button>
          </>
        }
      />

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Gross Revenue</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight tabular">
              {inr(metrics.totalRevenue)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-success font-medium inline-flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" /> {inr(metrics.paidRevenue)} settled
              </span>
              <span className="text-muted-foreground">{metrics.paidCount} paid bills</span>
            </div>
          </div>
        </div>

        <div className="surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Orders</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-soft text-primary">
              <ClipboardList className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight tabular">{metrics.totalOrders}</div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {orders.filter((o) => o.type === "dine-in").length} Dine-in ·{" "}
                {orders.filter((o) => o.type === "delivery").length} Delivery
              </span>
              <Link to="/orders" className="text-primary hover:underline font-medium">
                View all
              </Link>
            </div>
          </div>
        </div>

        <div className="surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Average Order Value</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-soft text-success">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight tabular">
              {inr(metrics.avgOrderValue)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Incl. {settings.gstPct}% GST</span>
              <span className="text-success font-medium">+8.4% vs last wk</span>
            </div>
          </div>
        </div>

        <div className="surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Floor Occupancy</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft text-warning">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight tabular">
                {metrics.occupancyPct}%
              </span>
              <span className="text-xs text-muted-foreground">
                ({metrics.activeTables}/{tables.length} tables)
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="text-success font-medium">{counts.available} free</span>
              <span>·</span>
              <span className="text-warning font-medium">{counts.billing} billing</span>
              <span>·</span>
              <span>{counts.reserved} rsv</span>
            </div>
          </div>
        </div>

        <div className="surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Kitchen Load & KOTs</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ai-soft text-ai">
              <ChefHat className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight tabular">
                {metrics.preparingCount}
              </span>
              <span className="text-xs text-muted-foreground">active tickets</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-success font-medium">{metrics.readyCount} ready to serve</span>
              <span className="text-muted-foreground tabular">~{metrics.avgPrepMins}m avg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts + Top Selling Items Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Sales & Order Trends Chart */}
        <div className="surface p-5 lg:col-span-2 flex flex-col justify-between">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Sales Revenue & Order Volume
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time breakdown across Dine-in, Takeaway & Delivery channels
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setChartRange("7d")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  chartRange === "7d"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                7-Day Trend
              </button>
              <button
                type="button"
                onClick={() => setChartRange("today")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  chartRange === "today"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Today Hourly
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-60 md:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [inr(value), "Revenue"]}
                    contentStyle={{
                      borderRadius: "8px",
                      fontSize: "12px",
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-card)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value} orders`, "Orders"]}
                    contentStyle={{
                      borderRadius: "8px",
                      fontSize: "12px",
                      borderColor: "var(--color-border)",
                      backgroundColor: "var(--color-card)",
                    }}
                  />
                  <Bar dataKey="orders" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="surface p-5 flex flex-col justify-between">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Top-Selling Dishes</h2>
              <p className="text-xs text-muted-foreground">Ranked by order revenue</p>
            </div>
            <Link
              to="/menu"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Full Menu <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5 flex-1">
            {topSellingItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/25 p-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={getCategoryImage(item.category)}
                    alt={item.name}
                    className="h-10 w-10 rounded-lg object-cover shrink-0 border border-border"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          item.veg ? "bg-success" : "bg-destructive",
                        )}
                      />
                      <span className="truncate text-xs font-semibold text-foreground">
                        {idx + 1}. {item.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.category} · {item.qty} portions sold
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold tabular text-foreground">
                    {inr(item.revenue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Orders, Upcoming Reservations, and Low-Stock Alerts */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Recent Orders Table */}
        <div className="surface p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Recent & Live Orders</h2>
              <p className="text-xs text-muted-foreground">
                Click any order to open in POS or inspect receipt
              </p>
            </div>
            <Link
              to="/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              All Orders ({orders.length}) <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
                  <th className="py-2.5 pr-3">Order ID</th>
                  <th className="py-2.5 px-3">Channel / Table</th>
                  <th className="py-2.5 px-3">Guest</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map((ord) => {
                  const cust = customers.find((c) => c.id === ord.customerId);
                  const amt = orderTotal(ord, settings.gstPct);
                  return (
                    <tr key={ord.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-3 font-semibold text-foreground">{ord.id}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium uppercase text-foreground">{ord.type}</span>
                        {ord.tableId && (
                          <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold">
                            {ord.tableId}
                          </span>
                        )}
                        {ord.provider && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            · {ord.provider}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {cust?.name ?? "Walk-in Guest"}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase",
                            ord.status === "ready" || ord.status === "completed"
                              ? "border-success/40 bg-success-soft text-success"
                              : ord.status === "in-kitchen"
                                ? "border-warning/40 bg-warning-soft text-warning"
                                : ord.status === "cancelled"
                                  ? "border-destructive/40 bg-danger-soft text-destructive"
                                  : "border-primary/30 bg-info-soft text-primary",
                          )}
                        >
                          {ord.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={cn(
                            "text-[11px] font-semibold uppercase",
                            ord.payment === "paid" ? "text-success" : "text-warning",
                          )}
                        >
                          {ord.payment}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold tabular">{inr(amt)}</td>
                      <td className="py-2.5 pl-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              openPosForOrder(ord.id);
                              navigate({ to: "/pos" });
                            }}
                          >
                            POS
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setReceiptOrder(ord)}
                            aria-label={`Receipt for ${ord.id}`}
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Low Stock Alerts + Upcoming Reservations */}
        <div className="space-y-5">
          {/* Low-Stock Alerts */}
          <div className="surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <h2 className="text-sm font-semibold text-foreground">
                  Low-Stock Alerts ({lowStockItems.length})
                </h2>
              </div>
              <Link
                to="/inventory"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Manage Stock <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="rounded-lg border border-border bg-success-soft/50 p-3 text-xs text-success">
                All 32 ingredients are above reorder thresholds.
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning-soft/50 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{ing.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Reorder threshold: {ing.reorder} {ing.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular text-destructive">
                        {ing.stock} {ing.unit}
                      </div>
                      <Link
                        to="/inventory"
                        className="text-[10px] font-semibold text-primary hover:underline"
                      >
                        Restock PO →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Reservations */}
          <div className="surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Upcoming Reservations</h2>
              </div>
              <Link
                to="/reservations"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5"
              >
                All ({reservations.length}) <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2">
              {upcomingReservations.map((res) => (
                <div
                  key={res.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {res.name} · {res.party} guests
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {res.time} {res.tableId ? `· Table ${res.tableId}` : "· Unassigned"}
                      {res.request ? ` · ${res.request}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] shrink-0"
                    onClick={() => {
                      updateReservationStatus(res.id, "seated", res.tableId ?? "T2");
                      openPosForTable(res.tableId ?? "T2");
                      toast.success(`Seated ${res.name} at Table ${res.tableId ?? "T2"}`);
                      navigate({ to: "/pos" });
                    }}
                  >
                    Seat & Order
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ReceiptModal
        order={receiptOrder}
        open={receiptOrder !== null}
        onOpenChange={(open) => {
          if (!open) setReceiptOrder(null);
        }}
      />
    </div>
  );
}
