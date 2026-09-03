import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
  UserCheck, UserPlus, Users, Zap, LayoutDashboard,
  Store, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Clock, MapPin, Activity, CheckCircle, Navigation,
  Wallet, RefreshCw, BarChart3, Radio, FileCheck,
  TrendingDown, Flame, BadgeMinus, Skull, UserX, ShoppingBag
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { useI18n } from "@/contexts/i18n-context";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspace-api";
import { inventoryApi, crmApi, employeesApi, invoicesApi } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { LazyMonkeyAiWorkspace } from "@/components/dashboard/LazyMonkeyAiWorkspace";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const WORKSPACE_TABS = [
  { id: "overview", label: "Executive Overview", icon: LayoutDashboard, permission: "view:dashboard" },
  { id: "inventory", label: "Inventory", icon: Package, permission: "view:inventory" },
  { id: "operations", label: "Operations", icon: Truck, permission: "view:procurement" },
  { id: "pos", label: "POS", icon: CreditCard, permission: "view:pos" },
  { id: "sales_crm", label: "Sales & CRM", icon: TrendingUp, permission: "view:crm" },
  { id: "marketplace", label: "Marketplace", icon: Store, permission: "view:marketplace" },
  { id: "accounting", label: "Accounting", icon: DollarSign, permission: "view:accounting" },
  { id: "hrm", label: "HRMS", icon: Users, permission: "view:hrms" },
];

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--card)",
  borderColor: "var(--border)",
  borderRadius: "8px",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

const ICON_MAP: Record<string, any> = {
  Receipt,
  UserPlus,
  ShoppingBag,
  Clock,
  UserX,
  AlertTriangle,
  Truck,
  Boxes,
  CreditCard,
  Wallet,
  Sparkles,
  CheckCircle2,
  Calendar,
  UserCheck,
  Package,
  Store,
  Navigation,
  Skull,
  FileText
};

function Dashboard() {
  const routerState = useRouterState();
  const navigate = useNavigate();
  const { hasPermission } = useRbac();
  const searchParams = new URLSearchParams(routerState.location.searchStr);

  const visibleTabs = useMemo(() => {
    return WORKSPACE_TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));
  }, [hasPermission]);

  const activeTab = searchParams.get("tab") || visibleTabs[0]?.id || "overview";

  if (activeTab === "lazymonkey_ai" || activeTab === "copilot" || activeTab === "ai") {
    return <LazyMonkeyAiWorkspace />;
  }

  const { user } = useAuth();
  const { tenant: company } = useTenant();
  const { language, t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("month");
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("month");

  const { data: productsData } = useQuery({ queryKey: ["dashboard-backend-products"], queryFn: async () => { try { return await inventoryApi.getProducts(); } catch { return []; } }, staleTime: 60000 });
  const { data: customersData } = useQuery({ queryKey: ["dashboard-backend-customers"], queryFn: async () => { try { return await crmApi.getCustomers(); } catch { return []; } }, staleTime: 60000 });
  const { data: employeesData } = useQuery({ queryKey: ["dashboard-backend-employees"], queryFn: async () => { try { const res = await employeesApi.list(); return Array.isArray(res) ? res : (res as any)?.items || []; } catch { return []; } }, staleTime: 60000 });
  const { data: invoicesData } = useQuery({ queryKey: ["dashboard-backend-invoices"], queryFn: async () => { try { const res = await invoicesApi.listInvoices(); return Array.isArray(res) ? res : (res as any)?.items || []; } catch { return []; } }, staleTime: 60000 });
  const { data: dashboardData, isLoading: kpisLoading } = useQuery({ queryKey: ["dashboard-kpis"], queryFn: workspaceApi.getDashboardKPIs });
  const { data: backendFeeds } = useQuery({ queryKey: ["dashboard-feeds"], queryFn: workspaceApi.getDashboardFeeds, staleTime: 30000 });

  useEffect(() => { setLoading(false); }, []);
  const isActuallyLoading = loading || kpisLoading;

  const hour = new Date().getHours();
  const greeting = language === "ar" ? (hour < 12 ? "صباح الخير" : "مساء الخير") : (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  const today = useMemo(() => new Date().toLocaleDateString(language === "ar" ? "ar-AE" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), [language]);
  
  const firstName = user?.name?.split(" ")[0] || (user as any)?.username || "venatic";
  const isPlatformAdmin = user?.tenantSlug === "system" && user?.isTenantOwner;

  const totalProducts = Array.isArray(productsData) ? (productsData as any[]).length : 0;
  const totalCustomers = Array.isArray(customersData) && (customersData as any[]).length > 0 ? (customersData as any[]).length : 2;
  const totalEmployees = Array.isArray(employeesData) && (employeesData as any[]).length > 0 ? (employeesData as any[]).length : 5;
  const totalInvoices = Array.isArray(invoicesData) && (invoicesData as any[]).length > 0 ? (invoicesData as any[]).length : 2;

  const baseSales = ((dashboardData as any)?.totalSales ?? 0) > 0 ? ((dashboardData as any)?.totalSales ?? 0) : 185420;
  const mult = period === "today" ? 0.05 : period === "week" ? 0.25 : period === "month" ? 1 : 12;
  const displayedSales = baseSales * mult;

  const tabConfig = useMemo(() => {
    switch (activeTab) {
      case "inventory":
        return {
          kpis: [
            { id: "val", label: "Stock Verification", value: `${currency.symbol}${(displayedSales * 2.4 / 1000000).toFixed(2)}M`, icon: Boxes, iconBg: "bg-blue-50 text-blue-600", growth: "↗ +8.4%", suffix: "vs last month" },
            { id: "inflow", label: "Stock Inflow", value: "1,250", icon: Layers, iconBg: "bg-indigo-50 text-indigo-600", growth: "↗ +12%", suffix: "units received" },
            { id: "outflow", label: "Stock Outflow", value: "840", icon: ShoppingCart, iconBg: "bg-emerald-50 text-emerald-600", growth: "↗ +6%", suffix: "units dispatched" },
            { id: "out", label: "Out of Stock", value: "0", icon: Package, iconBg: "bg-sky-50 text-sky-600", growth: "✓ 0%", suffix: "stockouts" },
            { id: "low", label: "Low Stock Limit", value: "3", icon: AlertTriangle, iconBg: "bg-orange-50 text-orange-600", growth: "⚠ Action", suffix: "needs reorder" },
            { id: "reorder", label: "Reorder Value", value: `${currency.symbol}45.2K`, icon: Receipt, iconBg: "bg-amber-50 text-amber-600", growth: "↗ Pending", suffix: "P.O. queue" },
            { id: "fast_mov", label: "Fast Moving", value: "42", icon: Flame, iconBg: "bg-orange-50 text-orange-600", growth: "↗ +8.3%", suffix: "top velocity SKUs" },
            { id: "slow_mov", label: "Slow Moving", value: "18", icon: TrendingDown, iconBg: "bg-rose-50 text-rose-600", growth: "⚠ Review", suffix: ">60 days stagnant" },
            { id: "dead_stock", label: "Dead Stock", value: "6", icon: Skull, iconBg: "bg-slate-100 text-slate-700", growth: "⚠ 0 sales", suffix: ">90 days stagnant" },
          ],
          chartTitle: "Stock Inflow vs Outflow",
          chartLine1Name: "Inflow Units",
          chartLine2Name: "Outflow Units",
          chartData: {
            week: [
              { label: "Mon", revenue: 140, expenses: 90 },
              { label: "Tue", revenue: 220, expenses: 140 },
              { label: "Wed", revenue: 190, expenses: 110 },
              { label: "Thu", revenue: 280, expenses: 160 },
              { label: "Fri", revenue: 350, expenses: 210 },
              { label: "Sat", revenue: 420, expenses: 240 },
              { label: "Sun", revenue: 380, expenses: 200 },
            ],
            month: [
              { label: "W1", revenue: 650, expenses: 380 },
              { label: "W2", revenue: 780, expenses: 490 },
              { label: "W3", revenue: 840, expenses: 540 },
              { label: "W4", revenue: 950, expenses: 620 },
            ],
            year: [
              { label: "Q1", revenue: 2400, expenses: 1500 },
              { label: "Q2", revenue: 3100, expenses: 1900 },
              { label: "Q3", revenue: 2900, expenses: 1800 },
              { label: "Q4", revenue: 3800, expenses: 2400 },
            ],
          },
          donutTitle: "Stock by Category",
          donutTotalLabel: "Total Units",
          donutTotalValue: "3,840",
          donutSegments: [
            { name: "Coffee & Tea", value: 40, count: 1536, percent: "40%", color: "#6d28d9" },
            { name: "Nuts & Snacks", value: 30, count: 1152, percent: "30%", color: "#2563eb" },
            { name: "Beverages", value: 20, count: 768, percent: "20%", color: "#10b981" },
            { name: "Packaging", value: 10, count: 384, percent: "10%", color: "#f59e0b" },
          ],
          feedTitle: "Stock Movements & Alerts",
          feedSubtitle: "Inventory audit & dispatch queue",
          feedViewAllUrl: "/inventory?tab=low_stock",
          feedItems: [
            { id: "inv-1", title: "Roasted Almonds 250G", subtitle: "Stock: 3 units left (Reorder: 10)", badge: "Reorder Now", badgeColor: "bg-rose-50 text-rose-600", meta: "Critical", icon: AlertTriangle, iconBg: "bg-rose-50 text-rose-600", navigateTo: "/inventory?tab=low_stock" },
            { id: "inv-2", title: "Arabica Beans Premium", subtitle: "Transfer #TR-881: Dubai -> Abu Dhabi", badge: "In Transit", badgeColor: "bg-blue-50 text-blue-600", meta: "500 units", icon: Truck, iconBg: "bg-blue-50 text-blue-600", navigateTo: "/inventory?tab=batches" },
            { id: "inv-3", title: "Organic Honey Jar", subtitle: "Dormant SKU • 94 days stagnant", badge: "Dead Stock", badgeColor: "bg-slate-100 text-slate-700", meta: "18 items", icon: Skull, iconBg: "bg-slate-100 text-slate-700", navigateTo: "/inventory?tab=dead_stock" },
            { id: "inv-4", title: "Cold Brew Blend 1KG", subtitle: "PO-4412 Received into Bay 3", badge: "Inflow Cleared", badgeColor: "bg-emerald-50 text-emerald-600", meta: "+250 units", icon: Package, iconBg: "bg-emerald-50 text-emerald-600", navigateTo: "/inventory?tab=bins" },
          ],
          healthLabels: { item1: "Warehouse Nodes", item1Sub: "3 Active Hubs", item2: "Scanner Service", item3: "Barcode Engine", item4: "Sync Status", item5: "Stock Accuracy" },
        };

      case "operations":
        return {
          kpis: [
            { id: "ful", label: "Fulfillment Rate", value: "98.2%", icon: CheckCircle, iconBg: "bg-blue-50 text-blue-600", growth: "↗ +1.4%", suffix: "SLA met" },
            { id: "active_del", label: "Active Deliveries", value: "14", icon: Truck, iconBg: "bg-purple-50 text-purple-600", growth: "↗ Live", suffix: "in transit" },
            { id: "disp", label: "Dispatched Today", value: "42", icon: Package, iconBg: "bg-orange-50 text-orange-600", growth: "↗ +12", suffix: "orders" },
            { id: "delay", label: "Delayed Orders", value: "2", icon: Clock, iconBg: "bg-sky-50 text-sky-600", growth: "⚠ 4.7%", suffix: "traffic delay" },
            { id: "time", label: "Avg Dispatch Time", value: "32 min", icon: Clock, iconBg: "bg-indigo-50 text-indigo-600", growth: "↗ -4.2m", suffix: "faster" },
            { id: "drivers", label: "Fleet Drivers", value: "8/10", icon: UserCheck, iconBg: "bg-emerald-50 text-emerald-600", growth: "↗ 80%", suffix: "on road" },
            { id: "deliv", label: "Delivered Today", value: "38", icon: CheckCircle2, iconBg: "bg-blue-50 text-blue-600", growth: "↗ 90.4%", suffix: "completed" },
            { id: "returns", label: "Return Requests", value: "1", icon: Receipt, iconBg: "bg-amber-50 text-amber-600", growth: "↗ 0.2%", suffix: "processed" },
          ],
          chartTitle: "Dispatched vs Delivered Trend",
          chartLine1Name: "Dispatched",
          chartLine2Name: "Delivered",
          chartData: {
            week: [
              { label: "Mon", revenue: 38, expenses: 36 },
              { label: "Tue", revenue: 45, expenses: 42 },
              { label: "Wed", revenue: 52, expenses: 50 },
              { label: "Thu", revenue: 60, expenses: 58 },
              { label: "Fri", revenue: 75, expenses: 72 },
              { label: "Sat", revenue: 80, expenses: 78 },
              { label: "Sun", revenue: 65, expenses: 64 },
            ],
            month: [
              { label: "W1", revenue: 180, expenses: 175 },
              { label: "W2", revenue: 210, expenses: 205 },
              { label: "W3", revenue: 240, expenses: 236 },
              { label: "W4", revenue: 280, expenses: 275 },
            ],
            year: [
              { label: "Q1", revenue: 800, expenses: 780 },
              { label: "Q2", revenue: 950, expenses: 935 },
              { label: "Q3", revenue: 1100, expenses: 1080 },
              { label: "Q4", revenue: 1350, expenses: 1320 },
            ],
          },
          donutTitle: "Fleet Dispatch Status",
          donutTotalLabel: "Active Fleet",
          donutTotalValue: "42",
          donutSegments: [
            { name: "Delivered", value: 65, count: 27, percent: "65%", color: "#10b981" },
            { name: "In Transit", value: 20, count: 9, percent: "20%", color: "#2563eb" },
            { name: "Out for Delivery", value: 10, count: 4, percent: "10%", color: "#6d28d9" },
            { name: "Delayed", value: 5, count: 2, percent: "5%", color: "#ef4444" },
          ],
          feedTitle: "Active Dispatches & Deliveries",
          feedSubtitle: "Live fleet telemetry & routes",
          feedViewAllUrl: "/procurement?tab=purchase_orders",
          feedItems: [
            { id: "op-1", title: "Order DEL-4482 Dispatched", subtitle: "Route 9 • Driver: Sarah M.", badge: "Out for Delivery", badgeColor: "bg-blue-50 text-blue-600", meta: "ETA 15m", icon: Truck, iconBg: "bg-blue-50 text-blue-600", navigateTo: "/procurement?tab=purchase_orders" },
            { id: "op-2", title: "Order DEL-4481 Delivered", subtitle: "Industrial Area 4 • Signed POD", badge: "Delivered", badgeColor: "bg-emerald-50 text-emerald-600", meta: "22m ago", icon: CheckCircle2, iconBg: "bg-emerald-50 text-emerald-600", navigateTo: "/procurement?tab=goods_received_notes" },
            { id: "op-3", title: "Fleet Driver Route Assigned", subtitle: "Downtown Central Express", badge: "Live GPS", badgeColor: "bg-purple-50 text-purple-700", meta: "40m ago", icon: Navigation, iconBg: "bg-purple-50 text-purple-700", navigateTo: "/procurement?tab=purchase_orders" },
            { id: "op-4", title: "Vendor GRN-0921 Verified", subtitle: "Central Receiving Dock 2", badge: "GRN Ready", badgeColor: "bg-amber-50 text-amber-600", meta: "1h ago", icon: Boxes, iconBg: "bg-amber-50 text-amber-600", navigateTo: "/procurement?tab=goods_received_notes" },
          ],
          healthLabels: { item1: "Fleet Telemetry", item1Sub: "GPS Connected", item2: "Route AI", item3: "Dispatch Queue", item4: "SLA Health", item5: "Fleet Load" },
        };

      case "pos":
        return {
          kpis: [
            { id: "pos_rev", label: "POS Revenue", value: `${currency.symbol}${((dashboardData as any)?.posRevenueToday != null && (dashboardData as any).posRevenueToday > 0 ? (dashboardData as any).posRevenueToday : 18450).toLocaleString()}`, icon: DollarSign, iconBg: "bg-blue-50 text-blue-600", growth: "↗ +16.2%", suffix: "vs yesterday" },
            { id: "pos_tx", label: "Transactions", value: String((dashboardData as any)?.posTransactionsToday || 64), icon: ShoppingCart, iconBg: "bg-purple-50 text-purple-600", growth: "↗ +12", suffix: "tickets" },
            { id: "pos_ticket", label: "Avg Ticket Size", value: `${currency.symbol}288`, icon: Receipt, iconBg: "bg-indigo-50 text-indigo-600", growth: "↗ +4.8%", suffix: "per basket" },
            { id: "pos_cash", label: "Cash in Drawer", value: `${currency.symbol}4,820`, icon: Wallet, iconBg: "bg-emerald-50 text-emerald-600", growth: "✓ Balanced", suffix: "drawer count" },
            { id: "pos_card", label: "Card / Digital", value: `${currency.symbol}13,630`, icon: CreditCard, iconBg: "bg-blue-50 text-blue-600", growth: "↗ 74%", suffix: "contactless" },
            { id: "pos_ref", label: "Refunds / Returns", value: `${currency.symbol}0.00`, icon: RefreshCw, iconBg: "bg-amber-50 text-amber-600", growth: "✓ 0%", suffix: "clean shift" },
            { id: "pos_cn", label: "Credit Notes", value: `${currency.symbol}1,240`, icon: BadgeMinus, iconBg: "bg-rose-50 text-rose-600", growth: "⚠ 3 notes", suffix: "issued today" },
            { id: "pos_reg", label: "Active Registers", value: "3/3", icon: Radio, iconBg: "bg-orange-50 text-orange-600", growth: "✓ 100%", suffix: "online" },
            { id: "pos_walkin", label: "Walk-in Clients", value: "58", icon: Users, iconBg: "bg-sky-50 text-sky-600", growth: "↗ +18%", suffix: "footfall" },
          ],
          chartTitle: "Hourly POS Sales Trend",
          chartLine1Name: "Today's Sales",
          chartLine2Name: "Yesterday's Pace",
          chartData: {
            week: [
              { label: "09:00", revenue: 1200, expenses: 900 },
              { label: "11:00", revenue: 3400, expenses: 2800 },
              { label: "13:00", revenue: 5800, expenses: 4500 },
              { label: "15:00", revenue: 4200, expenses: 3800 },
              { label: "17:00", revenue: 7600, expenses: 6200 },
              { label: "19:00", revenue: 8900, expenses: 7400 },
              { label: "21:00", revenue: 4100, expenses: 3500 },
            ],
            month: [
              { label: "W1", revenue: 42000, expenses: 35000 },
              { label: "W2", revenue: 58000, expenses: 49000 },
              { label: "W3", revenue: 64000, expenses: 54000 },
              { label: "W4", revenue: 78000, expenses: 66000 },
            ],
            year: [
              { label: "Q1", revenue: 180000, expenses: 150000 },
              { label: "Q2", revenue: 240000, expenses: 195000 },
              { label: "Q3", revenue: 260000, expenses: 220000 },
              { label: "Q4", revenue: 310000, expenses: 260000 },
            ],
          },
          donutTitle: "POS Tender Methods",
          donutTotalLabel: "Total Tender",
          donutTotalValue: "64",
          donutSegments: [
            { name: "Credit / Debit Card", value: 55, count: 35, percent: "55%", color: "#6d28d9" },
            { name: "Cash Tender", value: 25, count: 16, percent: "25%", color: "#10b981" },
            { name: "Apple / Google Pay", value: 15, count: 10, percent: "15%", color: "#2563eb" },
            { name: "Store Credit", value: 5, count: 3, percent: "5%", color: "#f59e0b" },
          ],
          feedTitle: "Transactions Details",
          feedSubtitle: "Live POS shift ticket feed",
          feedViewAllUrl: "/pos?tab=sales_history",
          feedItems: [
            { id: "pos-1", title: "Receipt REC-DW21J9Z7", subtitle: "Walk-in Customer • Register 01", badge: "Cash Paid", badgeColor: "bg-emerald-50 text-emerald-600", meta: "₹1,625.40 • 2m ago", icon: Receipt, iconBg: "bg-emerald-50 text-emerald-600", navigateTo: "/pos?tab=sales_history" },
            { id: "pos-2", title: "Receipt REC-DW21J9Z6", subtitle: "Sarah Jenkins • Terminal 02", badge: "Visa Paid", badgeColor: "bg-blue-50 text-blue-600", meta: "₹3,420.00 • 8m ago", icon: CreditCard, iconBg: "bg-blue-50 text-blue-600", navigateTo: "/pos?tab=sales_history" },
            { id: "pos-3", title: "Receipt REC-DW21J9Z5", subtitle: "Al-Noor Cafe • QR UPI Pay", badge: "Settled", badgeColor: "bg-purple-50 text-purple-700", meta: "₹8,750.00 • 25m ago", icon: Wallet, iconBg: "bg-purple-50 text-purple-700", navigateTo: "/pos?tab=sales_history" },
            { id: "pos-4", title: "Receipt REC-DW21J9Z4", subtitle: "Walk-in Customer • Register 02", badge: "Store Credit", badgeColor: "bg-amber-50 text-amber-600", meta: "₹450.00 • 1h ago", icon: Receipt, iconBg: "bg-amber-50 text-amber-600", navigateTo: "/pos?tab=sales_history" },
          ],
          healthLabels: { item1: "Terminal Sync", item1Sub: "Real-time Live", item2: "Printers Status", item3: "Payment Gateway", item4: "Drawer Float", item5: "Online Registers" },
        };

      case "sales_crm":
        return {
          kpis: [
            { id: "pipe", label: "Pipeline Value", value: `${currency.symbol}185.0K`, icon: TrendingUp, iconBg: "bg-blue-50 text-blue-600", growth: "↗ +14.2%", suffix: "weighted" },
            { id: "deals", label: "Deals Closed", value: "18", icon: ShoppingCart, iconBg: "bg-purple-50 text-purple-600", growth: "↗ +4", suffix: "this month" },
            { id: "leads", label: "Active Leads", value: "45", icon: Users, iconBg: "bg-orange-50 text-orange-600", growth: "↗ +18%", suffix: "in funnel" },
            { id: "conv", label: "Conversion Rate", value: "24.5%", icon: CheckCircle2, iconBg: "bg-sky-50 text-sky-600", growth: "↗ +2.8%", suffix: "lead to win" },
            { id: "accs", label: "Active Accounts", value: String(totalCustomers), icon: UserCheck, iconBg: "bg-indigo-50 text-indigo-600", growth: "↗ 100%", suffix: "enterprise" },
            { id: "size", label: "Avg Deal Size", value: `${currency.symbol}10.2K`, icon: DollarSign, iconBg: "bg-emerald-50 text-emerald-600", growth: "↗ +6.5%", suffix: "per contract" },
            { id: "target", label: "Quarter Target", value: "82%", icon: BarChart3, iconBg: "bg-blue-50 text-blue-600", growth: "↗ On Track", suffix: "of quota" },
            { id: "quotes", label: "Open Quotations", value: "7", icon: FileText, iconBg: "bg-amber-50 text-amber-600", growth: "↗ Review", suffix: "pending sign" },
          ],
          chartTitle: "Lead Inflow vs Deals Closed",
          chartLine1Name: "New Leads",
          chartLine2Name: "Won Deals",
          chartData: {
            week: [
              { label: "Mon", revenue: 12, expenses: 3 },
              { label: "Tue", revenue: 18, expenses: 5 },
              { label: "Wed", revenue: 15, expenses: 4 },
              { label: "Thu", revenue: 24, expenses: 7 },
              { label: "Fri", revenue: 30, expenses: 9 },
              { label: "Sat", revenue: 14, expenses: 3 },
              { label: "Sun", revenue: 10, expenses: 2 },
            ],
            month: [
              { label: "W1", revenue: 65, expenses: 14 },
              { label: "W2", revenue: 78, expenses: 19 },
              { label: "W3", revenue: 84, expenses: 22 },
              { label: "W4", revenue: 95, expenses: 26 },
            ],
            year: [
              { label: "Q1", revenue: 280, expenses: 68 },
              { label: "Q2", revenue: 340, expenses: 85 },
              { label: "Q3", revenue: 390, expenses: 96 },
              { label: "Q4", revenue: 450, expenses: 115 },
            ],
          },
          donutTitle: "Deals by Stage",
          donutTotalLabel: "Active Funnel",
          donutTotalValue: "45",
          donutSegments: [
            { name: "Qualification", value: 35, count: 16, percent: "35%", color: "#6d28d9" },
            { name: "Proposal Sent", value: 30, count: 14, percent: "30%", color: "#2563eb" },
            { name: "Negotiation", value: 20, count: 9, percent: "20%", color: "#10b981" },
            { name: "Closed Won", value: 15, count: 6, percent: "15%", color: "#f59e0b" },
          ],
          feedTitle: "Today's Leads",
          feedSubtitle: "Inbound funnel & active prospects",
          feedViewAllUrl: "/crm?tab=leads",
          feedItems: [
            { id: "crm-1", title: "Apex Logistics Corp", subtitle: "Rajesh Sharma • Enterprise AI Suite", badge: "Hot Lead", badgeColor: "bg-rose-50 text-rose-600", meta: "₹120K • 12m ago", icon: UserPlus, iconBg: "bg-rose-50 text-rose-600", navigateTo: "/crm?tab=leads" },
            { id: "crm-2", title: "Global Tech Logistics", subtitle: "Inbound Website • Multi-location ERP", badge: "New Lead", badgeColor: "bg-blue-50 text-blue-600", meta: "₹65K • 30m ago", icon: Sparkles, iconBg: "bg-blue-50 text-blue-600", navigateTo: "/crm?tab=leads" },
            { id: "crm-3", title: "Apex Retail Group", subtitle: "Quotation Q-902 Sent • Review pending", badge: "Proposal", badgeColor: "bg-purple-50 text-purple-700", meta: "₹240K • 1h ago", icon: FileText, iconBg: "bg-purple-50 text-purple-700", navigateTo: "/crm?tab=quotations" },
            { id: "crm-4", title: "TechNova Solutions", subtitle: "Discovery Call Scheduled for 3 PM", badge: "Meeting", badgeColor: "bg-amber-50 text-amber-600", meta: "Today • 2h ago", icon: Calendar, iconBg: "bg-amber-50 text-amber-600", navigateTo: "/crm?tab=leads" },
          ],
          healthLabels: { item1: "CRM Pipeline", item1Sub: "Real-time AI", item2: "Email Engine", item3: "Lead Scoring", item4: "Target Pacing", item5: "Sales Reps" },
        };

      case "marketplace":
        return {
          kpis: [
            { id: "gmv", label: "Marketplace GMV", value: `${currency.symbol}540.0K`, icon: DollarSign, iconBg: "bg-blue-50 text-blue-600", growth: "↗ +24.8%", suffix: "this month" },
            { id: "v_tot", label: "Total Vendors", value: "12", icon: Store, iconBg: "bg-purple-50 text-purple-600", growth: "↗ +12.5%", suffix: "merchants" },
            { id: "v_act", label: "Active Stores", value: "10", icon: CheckCircle, iconBg: "bg-orange-50 text-orange-600", growth: "↗ +8.2%", suffix: "selling" },
            { id: "v_ord", label: "Merchant Orders", value: "128", icon: ShoppingCart, iconBg: "bg-sky-50 text-sky-600", growth: "↗ +15.4%", suffix: "fulfilled" },
            { id: "comm", label: "Commission (10%)", value: `${currency.symbol}54.0K`, icon: Receipt, iconBg: "bg-indigo-50 text-indigo-600", growth: "↗ +22%", suffix: "platform net" },
            { id: "v_pen", label: "Pending Approvals", value: "3", icon: Clock, iconBg: "bg-emerald-50 text-emerald-600", growth: "⚠ Review", suffix: "merchants" },
            { id: "payout", label: "Vendor Payouts", value: `${currency.symbol}486.0K`, icon: Wallet, iconBg: "bg-blue-50 text-blue-600", growth: "✓ Cleared", suffix: "disbursed" },
            { id: "rating", label: "Merchant Rating", value: "4.8/5", icon: Sparkles, iconBg: "bg-amber-50 text-amber-600", growth: "★ 96%", suffix: "positive" },
          ],
          chartTitle: "Vendor GMV vs Payouts",
          chartLine1Name: "Gross GMV",
          chartLine2Name: "Vendor Payouts",
          chartData: {
            week: [
              { label: "Mon", revenue: 45000, expenses: 40500 },
              { label: "Tue", revenue: 60000, expenses: 54000 },
              { label: "Wed", revenue: 55000, expenses: 49500 },
              { label: "Thu", revenue: 75000, expenses: 67500 },
              { label: "Fri", revenue: 80000, expenses: 72000 },
              { label: "Sat", revenue: 100000, expenses: 90000 },
              { label: "Sun", revenue: 95000, expenses: 85500 },
            ],
            month: [
              { label: "W1", revenue: 110000, expenses: 99000 },
              { label: "W2", revenue: 135000, expenses: 121500 },
              { label: "W3", revenue: 145000, expenses: 130500 },
              { label: "W4", revenue: 150000, expenses: 135000 },
            ],
            year: [
              { label: "Q1", revenue: 420000, expenses: 378000 },
              { label: "Q2", revenue: 580000, expenses: 522000 },
              { label: "Q3", revenue: 650000, expenses: 585000 },
              { label: "Q4", revenue: 820000, expenses: 738000 },
            ],
          },
          donutTitle: "Orders by Merchant Category",
          donutTotalLabel: "Total GMV",
          donutTotalValue: `${currency.symbol}540K`,
          donutSegments: [
            { name: "Food & Beverage", value: 45, count: 58, percent: "45%", color: "#6d28d9" },
            { name: "Grocery & Produce", value: 25, count: 32, percent: "25%", color: "#10b981" },
            { name: "Packaging Supplies", value: 20, count: 26, percent: "20%", color: "#2563eb" },
            { name: "Electronics", value: 10, count: 12, percent: "10%", color: "#f59e0b" },
          ],
          feedTitle: "Upcoming & Online Orders",
          feedSubtitle: "Online Store & Merchant Fulfillment",
          feedViewAllUrl: "/marketplace?tab=orders",
          feedItems: [
            { id: "m-1", title: "Order #ORD-MK-9821", subtitle: "FreshMart Grocery • Online Store Order", badge: "Awaiting Dispatch", badgeColor: "bg-sky-50 text-sky-600", meta: "₹3,890.00 • Today", icon: ShoppingBag, iconBg: "bg-sky-50 text-sky-600", navigateTo: "/marketplace?tab=orders" },
            { id: "m-2", title: "Order #ORD-MK-9820", subtitle: "SpiceWorld LLC • Standard Courier", badge: "In Preparation", badgeColor: "bg-amber-50 text-amber-600", meta: "₹1,450.00 • Today", icon: Store, iconBg: "bg-amber-50 text-amber-600", navigateTo: "/marketplace?tab=orders" },
            { id: "m-3", title: "Order #ORD-MK-9819", subtitle: "Arabian Spices Co • Scheduled Dispatch", badge: "Confirmed", badgeColor: "bg-purple-50 text-purple-700", meta: "₹12,400.00 • Tomorrow", icon: Package, iconBg: "bg-purple-50 text-purple-700", navigateTo: "/marketplace?tab=orders" },
            { id: "m-4", title: "Order #ORD-MK-9818", subtitle: "Direct Online Store • Hyperlocal", badge: "Driver Assigned", badgeColor: "bg-emerald-50 text-emerald-600", meta: "₹2,180.00 • 35m ago", icon: Truck, iconBg: "bg-emerald-50 text-emerald-600", navigateTo: "/marketplace?tab=orders" },
          ],
          healthLabels: { item1: "Marketplace Core", item1Sub: "Operational", item2: "KYC Engine", item3: "Escrow Wallet", item4: "Payout Gateway", item5: "Active Merchants" },
        };

      case "accounting":
        return {
          kpis: [
            { id: "inv_pd", label: "Total Paid", value: `${currency.symbol}142.5K`, icon: CheckCircle2, iconBg: "bg-orange-50 text-orange-600", growth: "↗ 76.8%", suffix: "collected" },
            { id: "ar", label: "Accounts Receivable", value: `${currency.symbol}${((dashboardData as any)?.pendingPayments ? (Number((dashboardData as any).pendingPayments) / 1000).toFixed(1) + 'K' : '42.9K')}`, icon: Receipt, iconBg: "bg-sky-50 text-sky-600", growth: "↗ Pending", suffix: "due < 30d" },
            { id: "bills", label: "Vendor Bills", value: `${currency.symbol}38.4K`, icon: Receipt, iconBg: "bg-indigo-50 text-indigo-600", growth: "↗ -3.8%", suffix: "AP expense" },
            { id: "bill_pd", label: "Bills Paid", value: `${currency.symbol}30.0K`, icon: Wallet, iconBg: "bg-emerald-50 text-emerald-600", growth: "↗ 78%", suffix: "cleared" },
            { id: "ap", label: "Accounts Payable", value: `${currency.symbol}8.4K`, icon: Receipt, iconBg: "bg-blue-50 text-blue-600", growth: "✓ Current", suffix: "not overdue" },
            { id: "cashflow", label: "Cash Flow", value: `${currency.symbol}95.0K`, icon: TrendingUp, iconBg: "bg-amber-50 text-amber-600", growth: "↗ Positive", suffix: "bank balance" },
            { id: "profit", label: "Net Profit", value: `${currency.symbol}121.3K`, icon: DollarSign, iconBg: "bg-blue-50 text-blue-600", growth: "↗ +18.5%", suffix: "margin 65%" },
            { id: "inv_tot", label: "Total Invoiced", value: `${currency.symbol}185.4K`, icon: FileText, iconBg: "bg-purple-50 text-purple-600", growth: "↗ +12.4%", suffix: "billed" },
          ],
          chartTitle: "Income vs Expenses",
          chartLine1Name: "Gross Income",
          chartLine2Name: "Operating Expenses",
          chartData: {
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
              { label: "W1", revenue: 65000, expenses: 24000 },
              { label: "W2", revenue: 78000, expenses: 29000 },
              { label: "W3", revenue: 84000, expenses: 31000 },
              { label: "W4", revenue: 95000, expenses: 34000 },
            ],
            year: [
              { label: "Q1", revenue: 280000, expenses: 120000 },
              { label: "Q2", revenue: 340000, expenses: 145000 },
              { label: "Q3", revenue: 390000, expenses: 160000 },
              { label: "Q4", revenue: 480000, expenses: 195000 },
            ],
          },
          donutTitle: "Expense Breakdown",
          donutTotalLabel: "Total Expenses",
          donutTotalValue: `${currency.symbol}64.1K`,
          donutSegments: [
            { name: "COGS & Inventory", value: 45, count: 28845, percent: "45%", color: "#6d28d9" },
            { name: "Payroll & Salaries", value: 30, count: 19230, percent: "30%", color: "#10b981" },
            { name: "Rent & Utilities", value: 15, count: 9615, percent: "15%", color: "#2563eb" },
            { name: "Marketing & Ops", value: 10, count: 6410, percent: "10%", color: "#f59e0b" },
          ],
          feedTitle: "Payment Deadlines",
          feedSubtitle: "Vendor payables & collection due dates",
          feedViewAllUrl: "/accounting?tab=vendor_bills",
          feedItems: [
            { id: "acc-1", title: "Global Logistics LLC", subtitle: "Vendor Bill VB-1002 • Freight Clearance", badge: "Due Today", badgeColor: "bg-rose-50 text-rose-600", meta: "₹18,500.00 • Overdue", icon: AlertTriangle, iconBg: "bg-rose-50 text-rose-600", navigateTo: "/accounting?tab=vendor_bills" },
            { id: "acc-2", title: "Apex Retail Group", subtitle: "Invoice INV-0042 • Outstanding AR", badge: "Due in 2 Days", badgeColor: "bg-amber-50 text-amber-600", meta: "₹42,900.00 • Net 15", icon: Clock, iconBg: "bg-amber-50 text-amber-600", navigateTo: "/accounting?tab=invoices" },
            { id: "acc-3", title: "Arabian Packaging Supplies", subtitle: "Vendor Bill VB-0994 • Net 30 Terms", badge: "Due in 5 Days", badgeColor: "bg-blue-50 text-blue-600", meta: "₹12,400.00 • Pending", icon: FileText, iconBg: "bg-blue-50 text-blue-600", navigateTo: "/accounting?tab=vendor_bills" },
            { id: "acc-4", title: "VAT Return Statutory Deadline", subtitle: "Monthly VAT Reconciliation & Tax Filing", badge: "Statutory Filing", badgeColor: "bg-purple-50 text-purple-700", meta: "15th of Month", icon: Receipt, iconBg: "bg-purple-50 text-purple-700", navigateTo: "/accounting?tab=gst" },
          ],
          healthLabels: { item1: "Chart of Accounts", item1Sub: "Reconciled", item2: "VAT Compliance", item3: "Bank Feed", item4: "Ledger Audit", item5: "P&L Health" },
        };

      case "hrm":
        return {
          kpis: [
            { id: "hc", label: "Total Headcount", value: String((dashboardData as any)?.totalEmployees || totalEmployees || 5), icon: Users, iconBg: "bg-blue-50 text-blue-600", growth: "↗ +1", suffix: "new hire" },
            { id: "pres", label: "Present Today", value: `${(dashboardData as any)?.employeesPresent ?? totalEmployees}/${(dashboardData as any)?.totalEmployees ?? totalEmployees}`, icon: UserCheck, iconBg: "bg-purple-50 text-purple-600", growth: "✓ 100%", suffix: "attendance" },
            { id: "absent", label: "Absent Todays", value: String((dashboardData as any)?.employeesAbsent ?? 0), icon: UserX, iconBg: "bg-rose-50 text-rose-600", growth: "✓ 0%", suffix: "unplanned" },
            { id: "leave", label: "On Leave", value: "0", icon: Clock, iconBg: "bg-orange-50 text-orange-600", growth: "✓ 0%", suffix: "approved leave" },
            { id: "shifts", label: "Active Shifts", value: "2", icon: Radio, iconBg: "bg-sky-50 text-sky-600", growth: "✓ Day/Night", suffix: "roster" },
            { id: "payroll", label: "Monthly Payroll", value: `${currency.symbol}145.0K`, icon: DollarSign, iconBg: "bg-indigo-50 text-indigo-600", growth: "✓ Disbursed", suffix: "100% processed" },
            { id: "prod", label: "Productivity Score", value: "94.2%", icon: Sparkles, iconBg: "bg-emerald-50 text-emerald-600", growth: "↗ +3.5%", suffix: "high performance" },
            { id: "reqs", label: "Pending Requests", value: "1", icon: FileText, iconBg: "bg-blue-50 text-blue-600", growth: "↗ Review", suffix: "leave request" },
            { id: "attr", label: "Retention Rate", value: "98.5%", icon: Shield, iconBg: "bg-amber-50 text-amber-600", growth: "★ Low Risk", suffix: "attrition AI" },
          ],
          chartTitle: "Attendance & Workforce Trends",
          chartLine1Name: "Present Staff",
          chartLine2Name: "Average Capacity",
          chartData: {
            week: [
              { label: "Mon", revenue: 5, expenses: 5 },
              { label: "Tue", revenue: 5, expenses: 5 },
              { label: "Wed", revenue: 5, expenses: 5 },
              { label: "Thu", revenue: 5, expenses: 5 },
              { label: "Fri", revenue: 5, expenses: 5 },
              { label: "Sat", revenue: 4, expenses: 4 },
              { label: "Sun", revenue: 4, expenses: 4 },
            ],
            month: [
              { label: "W1", revenue: 5, expenses: 5 },
              { label: "W2", revenue: 5, expenses: 5 },
              { label: "W3", revenue: 5, expenses: 5 },
              { label: "W4", revenue: 5, expenses: 5 },
            ],
            year: [
              { label: "Q1", revenue: 4, expenses: 4 },
              { label: "Q2", revenue: 4, expenses: 4 },
              { label: "Q3", revenue: 5, expenses: 5 },
              { label: "Q4", revenue: 5, expenses: 5 },
            ],
          },
          donutTitle: "Workforce by Department",
          donutTotalLabel: "Staff",
          donutTotalValue: String(totalEmployees || 5),
          donutSegments: [
            { name: "Engineering", value: 40, count: 2, percent: "40%", color: "#6d28d9" },
            { name: "Operations", value: 30, count: 2, percent: "30%", color: "#10b981" },
            { name: "Sales & Marketing", value: 20, count: 1, percent: "20%", color: "#2563eb" },
            { name: "Administration", value: 10, count: 0, percent: "10%", color: "#f59e0b" },
          ],
          feedTitle: "Employee Absences & Leaves",
          feedSubtitle: "Today's absenteeism & pending leave requests",
          feedViewAllUrl: "/hrms?tab=leave_requests",
          feedItems: [
            { id: "hrm-1", title: "Vikram Malhotra", subtitle: "Engineering Dept • Medical Emergency", badge: "Absent Today", badgeColor: "bg-rose-50 text-rose-600", meta: "1 Day • Unapproved", icon: UserX, iconBg: "bg-rose-50 text-rose-600", navigateTo: "/hrms?tab=daily_attendance" },
            { id: "hrm-2", title: "Fatima Al-Sayed", subtitle: "Operations • Annual Vacation Leave", badge: "On Leave", badgeColor: "bg-amber-50 text-amber-600", meta: "Day 2 of 5 • Approved", icon: Calendar, iconBg: "bg-amber-50 text-amber-600", navigateTo: "/hrms?tab=leave_requests" },
            { id: "hrm-3", title: "Rohan Sharma", subtitle: "Sales & Marketing • Half-Day Afternoon", badge: "Half-Day", badgeColor: "bg-blue-50 text-blue-600", meta: "0.5 Day • Today", icon: Clock, iconBg: "bg-blue-50 text-blue-600", navigateTo: "/hrms?tab=leave_requests" },
            { id: "hrm-4", title: "Meera Nair", subtitle: "Finance & Accounts • WFH Remote Log", badge: "Remote Clock", badgeColor: "bg-purple-50 text-purple-700", meta: "Active • Biometric Verified", icon: UserCheck, iconBg: "bg-purple-50 text-purple-700", navigateTo: "/hrms?tab=daily_attendance" },
          ],
          healthLabels: { item1: "HRMS Database", item1Sub: "Operational", item2: "Biometric Sync", item3: "Payroll Gateway", item4: "Compliance", item5: "Active Staff" },
        };

      default: // OVERVIEW
        return {
          kpis: [
            { id: "revenue", label: "Revenue", value: `${currency.symbol}${displayedSales.toLocaleString()}`, icon: DollarSign, iconBg: "bg-blue-50 text-blue-600", growth: "↗ +12.5%", suffix: "vs last month" },
            { id: "sales", label: "Sales", value: String(Math.round(displayedSales > 0 ? displayedSales / 450 : 0)), icon: ShoppingCart, iconBg: "bg-purple-50 text-purple-600", growth: "↗ 0%", suffix: "orders" },
            { id: "orders_pending", label: "Orders Pending", value: "0", icon: Package, iconBg: "bg-orange-50 text-orange-600", growth: "↗ 0%", suffix: "to fulfill" },
            { id: "active_customers", label: "Active Customers", value: String(totalCustomers), icon: Users, iconBg: "bg-sky-50 text-sky-600", growth: "↗ 0%", suffix: "total active" },
            { id: "inventory_value", label: "Inventory Value", value: `${currency.symbol}2.74M`, icon: Boxes, iconBg: "bg-indigo-50 text-indigo-600", growth: "↗ 0%", suffix: "total holding" },
            { id: "employees_present", label: "Employees Present", value: `0/${totalEmployees}`, icon: UserCheck, iconBg: "bg-emerald-50 text-emerald-600", growth: "↗ 0%", suffix: "attendance" },
            { id: "pending_deliveries", label: "Pending Deliveries", value: "0", icon: Truck, iconBg: "bg-blue-50 text-blue-600", growth: "↗ 0%", suffix: "in transit" },
            { id: "pending_payments", label: "Pending Payments", value: `${currency.symbol}0.00`, icon: Receipt, iconBg: "bg-amber-50 text-amber-600", growth: "↗ 0%", suffix: "AR overdue" },
          ],
          chartTitle: "Revenue vs Expenses",
          chartLine1Name: "Revenue",
          chartLine2Name: "Expenses",
          chartData: {
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
              { label: "W1", revenue: 65000, expenses: 24000 },
              { label: "W2", revenue: 78000, expenses: 29000 },
              { label: "W3", revenue: 84000, expenses: 31000 },
              { label: "W4", revenue: 95000, expenses: 34000 },
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
          },
          donutTitle: "Sales by Channel",
          donutTotalLabel: "Total Sales",
          donutTotalValue: "0",
          donutSegments: [
            { name: "Direct Sales", value: 25, count: 0, percent: "0%", color: "#6d28d9" },
            { name: "Online Store", value: 25, count: 0, percent: "0%", color: "#10b981" },
            { name: "Marketplace", value: 25, count: 0, percent: "0%", color: "#f59e0b" },
            { name: "POS Sales", value: 25, count: 0, percent: "0%", color: "#8b5cf6" },
          ],
          feedTitle: "Quick Actions & Critical Feeds",
          feedSubtitle: "Direct shortcuts to active alerts",
          feedViewAllUrl: "/pos?tab=sales_history",
          feedItems: [
            { id: "act-1", title: "POS Sale #REC-0891 Cleared", subtitle: "Terminal 01 • ₹1,625.40 Cash", badge: "POS Live", badgeColor: "bg-emerald-50 text-emerald-600", meta: "2m ago", icon: Receipt, iconBg: "bg-emerald-50 text-emerald-600", navigateTo: "/pos?tab=sales_history" },
            { id: "act-2", title: "New Enterprise Lead: Apex Corp", subtitle: "Rajesh Sharma • ₹120K Deal Value", badge: "Hot Lead", badgeColor: "bg-rose-50 text-rose-600", meta: "15m ago", icon: UserPlus, iconBg: "bg-rose-50 text-rose-600", navigateTo: "/crm?tab=leads" },
            { id: "act-3", title: "Stock Reorder Alert Triggered", subtitle: "Roasted Almonds 250G below limit", badge: "Inventory", badgeColor: "bg-amber-50 text-amber-600", meta: "3 left", icon: AlertTriangle, iconBg: "bg-amber-50 text-amber-600", navigateTo: "/inventory?tab=low_stock" },
            { id: "act-4", title: "Global Logistics Bill Due Today", subtitle: "Vendor Bill VB-1002 • Net 30 Terms", badge: "Overdue", badgeColor: "bg-blue-50 text-blue-600", meta: "₹18,500", icon: Clock, iconBg: "bg-blue-50 text-blue-600", navigateTo: "/accounting?tab=vendor_bills" },
          ],
          healthLabels: { item1: "System Health", item1Sub: "Real-time system status", item2: "Server Status", item3: "Database", item4: "Backup Status", item5: "Active Users" },
        };
    }
  }, [activeTab, displayedSales, totalProducts, totalCustomers, totalEmployees, currency]);

  const activeChartData = tabConfig.chartData[chartPeriod] || tabConfig.chartData.month;

  const liveTabItems = useMemo(() => {
    const rawItems = backendFeeds?.[activeTab];
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      return rawItems.map((item: any) => ({
        ...item,
        icon: ICON_MAP[item.icon] || Package,
      }));
    }
    return tabConfig.feedItems;
  }, [backendFeeds, activeTab, tabConfig.feedItems]);

  return (
    <div className="p-3 space-y-2.5 font-sans bg-background">
      {/* ── Top Header Row with Period Selector ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {greeting}, {firstName} 👋
          </h1>
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

      {/* ── Multi-Module Workspace Dashboard Tabs (Light Purple Pill Styling) ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/40 scrollbar-hide">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                navigate({ to: "/dashboard", search: { tab: tab.id } });
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer",
                isActive
                  ? "bg-purple-500/10 text-purple-700 font-bold border border-purple-500/25 shadow-xs"
                  : "bg-slate-50/80 text-slate-600 hover:bg-purple-50/50 hover:text-purple-700 border border-slate-200/50"
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── KPI Cards Grid — auto-wraps for any number of cards ── */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {isActuallyLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-26 rounded-2xl" />
            ))
          : tabConfig.kpis.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className="h-full">
                  <Card className="bg-card border border-border/70 rounded-2xl p-3 shadow-xs hover:shadow-sm hover:border-purple-200 transition-colors flex flex-col justify-between h-full">
                    <div className="flex items-center justify-between">
                      <div className={cn("size-7.5 rounded-xl flex items-center justify-center transition-colors", k.iconBg)}>
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
                      <span className={cn(
                        "inline-flex items-center text-[10px] font-bold px-1 py-0.5 rounded",
                        k.growth.startsWith("⚠") || k.growth.startsWith("↘")
                          ? "text-rose-600 bg-rose-500/10"
                          : "text-emerald-600 bg-emerald-500/10"
                      )}>
                        {k.growth}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {k.suffix}
                      </span>
                    </div>
                  </Card>
                </div>
              );
            })}
      </div>

      {/* ── Middle Row: 3 Cards (Line Chart, Donut Chart, Activities Feed) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Card (~42% / 5 cols): Dynamic Line Chart */}
        <Card className="lg:col-span-5 bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 pb-1">
            <div>
              <h3 className="text-sm font-bold text-foreground">{tabConfig.chartTitle}</h3>
              <div className="flex items-center gap-3 text-xs mt-0.5">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="size-2 rounded-full bg-blue-600" /> {tabConfig.chartLine1Name}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="size-2 rounded-full bg-rose-500" /> {tabConfig.chartLine2Name}
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
              <LineChart data={activeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(v) => v === 0 ? "0" : `${currency.symbol}${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${v / 1000}K` : v}`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => [typeof val === 'number' ? val.toLocaleString() : val, ""]} />
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

        {/* Center Card (~33% / 4 cols): Dynamic Donut Chart */}
        <Card className="lg:col-span-4 bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="text-sm font-bold text-foreground">{tabConfig.donutTitle}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">This month summary</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-2 flex-1">
            <div className="relative size-36 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tabConfig.donutSegments}
                    dataKey="value"
                    innerRadius={44}
                    outerRadius={66}
                    paddingAngle={3}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {tabConfig.donutSegments.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] text-muted-foreground font-medium">{tabConfig.donutTotalLabel}</span>
                <span className="text-base font-bold text-foreground truncate max-w-[70px]">{tabConfig.donutTotalValue}</span>
              </div>
            </div>

            <div className="space-y-2 flex-1 min-w-0 pr-2">
              {tabConfig.donutSegments.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 truncate text-slate-700 font-medium">
                    <span className="size-2 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="text-slate-900 font-semibold shrink-0 ml-2">
                    {item.count} ({item.percent})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Right Card (~25% / 3 cols): Replaces "Recent Activities" with contextual feed & direct navigation */}
        <Card className="lg:col-span-3 bg-card border border-border/70 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div>
              <h3 className="text-sm font-bold text-foreground">{tabConfig.feedTitle}</h3>
              {tabConfig.feedSubtitle && (
                <p className="text-[10px] text-muted-foreground">{tabConfig.feedSubtitle}</p>
              )}
            </div>
            <button
              onClick={() => navigate({ to: tabConfig.feedViewAllUrl })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-800 transition-colors cursor-pointer group"
            >
              <span>View all</span>
              <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>

          <div className="space-y-2 pt-2">
            {liveTabItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate({ to: item.navigateTo })}
                  className="flex items-start gap-2.5 p-2 -mx-1.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-all border border-transparent hover:border-border/60 group"
                  title={`Open ${item.title}`}
                >
                  <div className={cn("size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-105", item.iconBg)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-foreground truncate group-hover:text-purple-700 transition-colors">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0", item.badgeColor || "bg-purple-50 text-purple-700")}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
                    {item.meta && (
                      <div className="text-[10px] font-semibold text-slate-500 mt-0.5 flex items-center justify-between">
                        <span>{item.meta}</span>
                        <span className="text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium flex items-center gap-0.5">
                          Open →
                        </span>
                      </div>
                    )}
                  </div>
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
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Shield className="size-4.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">{tabConfig.healthLabels.item1}</div>
              <div className="text-[11px] text-muted-foreground">{tabConfig.healthLabels.item1Sub}</div>
              <div className="mt-0.5">
                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600">
                  Healthy
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Server className="size-4.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">{tabConfig.healthLabels.item2}</div>
              <div className="text-xs font-bold text-foreground">Healthy</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Database className="size-4.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">{tabConfig.healthLabels.item3}</div>
              <div className="text-xs font-bold text-foreground">Healthy</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <HardDrive className="size-4.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">{tabConfig.healthLabels.item4}</div>
              <div className="text-xs font-bold text-foreground">Up to date</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="size-4.5" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground font-medium">{tabConfig.healthLabels.item5}</div>
              <div className="text-xs font-bold text-foreground">12</div>
            </div>
          </div>
        </Card>

        {/* Right Card (~32% / 4 cols): Overall Performance Score */}
        <Card className="lg:col-span-4 bg-card border border-border/80 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Overall Performance Score</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ↗ Excellent
            </span>
          </div>

          <div className="mt-2">
            <div className="flex justify-end text-xs font-extrabold text-foreground">
              92/100
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-700 via-purple-600 to-emerald-500 transition-all duration-1000"
                style={{ width: "92%" }}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
