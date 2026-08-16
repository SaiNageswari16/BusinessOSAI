import React from "react";
import {
  CreditCard, DollarSign, Package, ShoppingCart,
  TrendingUp, Users, AlertTriangle, ArrowRightLeft,
  Clock, Zap, CheckCircle2, ChevronRight, Store, RotateCcw
} from "lucide-react";
import { posSession, posStore } from "../../lib/pos-fallback";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

import { formatCurrency } from "../../lib/utils";
import { posApi } from "../../lib/pos-api";
import { workspaceApi } from "../../lib/workspace-api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "../../contexts/auth-context";

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="p-10 text-red-500 font-mono whitespace-pre-wrap">{this.state.error?.stack || this.state.error?.toString()}</div>;
    return this.props.children;
  }
}

export function PosDashboard() {
  return <ErrorBoundary><PosDashboardInner /></ErrorBoundary>;
}

function PosDashboardInner() {
  const { user } = useAuth();
  
  const { data: workspaceData } = useQuery({
    queryKey: ["current-workspace"],
    queryFn: workspaceApi.getCurrentWorkspace,
    staleTime: Infinity,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["pos-daily-summary"],
    queryFn: posApi.getDailySummary,
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: historyData, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ["pos-transactions-history"],
    queryFn: () => posApi.getTransactionHistory(6),
    refetchInterval: 30000,
  });

  const { data: widgetsData } = useQuery({
    queryKey: ["dashboard-widgets"],
    queryFn: workspaceApi.getDashboardWidgets,
    refetchInterval: 60000,
  });

  const todayRevenue = summaryData?.total_revenue || 0;
  const todayOrders = summaryData?.transactions_count || 0;
  const totalReturns = summaryData?.total_returns || 0;
  const avgBill = todayOrders > 0 ? todayRevenue / todayOrders : 0;

  const displayTransactions = historyData || [];
  const displayInventoryAlerts = widgetsData?.inventoryAlerts || [];

  if (historyError) {
    return (
      <div className="p-8 text-rose-500 font-bold text-xl">
        Error loading transactions: {(historyError as any).detail || (historyError as any).message || JSON.stringify(historyError)}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-full">
      {/* Header section with Store / Shift Details */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">POS Dashboard</h1>
          <p className="text-slate-500 mt-1">
            {workspaceData?.name || "Store HQ"} &mdash; Register: REG-01
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Shift Open: {user?.name || "Cashier"}
          </div>
          <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition-all active:scale-95 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Open POS
          </button>
        </div>
      </div>

      {/* Hourly Sales Graph */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Today's Hourly Sales Trend</h3>
        {summaryData?.hourly_sales && summaryData.hourly_sales.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summaryData.hourly_sales} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No hourly sales data available for today yet.
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(todayRevenue)}
          trend="Live"
          isPositive={true}
          icon={DollarSign}
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Total Orders"
          value={todayOrders.toString()}
          trend="Live"
          isPositive={true}
          icon={ShoppingCart}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Average Bill"
          value={formatCurrency(avgBill)}
          trend="Live"
          isPositive={true}
          icon={CreditCard}
          color="bg-purple-100 text-purple-600"
        />
        <StatCard
          title="Returns & Refunds"
          value={formatCurrency(totalReturns)}
          trend="Live"
          isPositive={false}
          icon={RotateCcw}
          color="bg-rose-100 text-rose-600"
        />
      </div>

      {/* Quick Actions & Recent Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Quick Actions Panel */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <ActionBtn label="Open POS" icon={ShoppingCart} color="bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100" />
              <ActionBtn label="Hold Orders" icon={Clock} color="bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100" />
              <ActionBtn label="Returns" icon={ArrowRightLeft} color="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" />
              <ActionBtn label="Cash In/Out" icon={DollarSign} color="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" />
              <ActionBtn label="Print Z-Report" icon={Store} color="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100" />
              <ActionBtn label="Close Shift" icon={AlertTriangle} color="bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
              Low Stock Alerts
              <span className="bg-rose-100 text-rose-700 text-xs px-2 py-1 rounded-full font-bold">{displayInventoryAlerts.length} items</span>
            </h3>
            <div className="space-y-4">
              {displayInventoryAlerts.slice(0, 3).map((a: any) => (
                <StockAlertItem key={a.sku} name={a.name} stock={a.level} />
              ))}
              {displayInventoryAlerts.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-4">No critical stock alerts.</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Recent Transactions</h3>
              <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Receipt No</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {displayTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No recent transactions found.
                    </td>
                  </tr>
                )}
                {displayTransactions.slice(0, 5).map((tx: any) => (
                  <tr key={tx.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-900">
                        {tx.receipt_number || (tx.id?.length > 18 ? tx.id.substring(0, 8) + '...' : tx.id)}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-slate-600">
                      {tx.created_at ? format(new Date(tx.created_at), 'hh:mm a') : format(new Date(tx.date || new Date()), 'hh:mm a')}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-slate-900">
                      {tx.customer?.name || tx.customerName || "Walk-in"}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {tx.payments?.[0]?.payment_method || tx.paymentMethod || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-right font-bold text-slate-900">
                      {formatCurrency(tx.total_amount || tx.total || 0)}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${(tx.status || 'completed').toLowerCase() === "completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : (tx.status || 'completed').toLowerCase() === "refunded"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {(tx.status || 'completed').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Components
function StatCard({ title, value, trend, isPositive, icon: Icon, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between group hover:border-indigo-200 transition-colors cursor-default">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className={`font-medium flex items-center gap-1 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
          {trend}
        </span>
        <span className="text-slate-400">vs yesterday</span>
      </div>
    </div>
  );
}

function ActionBtn({ label, icon: Icon, color }: any) {
  return (
    <button className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all active:scale-95 ${color}`}>
      <Icon className="w-6 h-6" />
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function StockAlertItem({ name, stock }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
      <span className="text-sm font-medium text-slate-700">{name}</span>
      <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded-md">
        {stock} left
      </span>
    </div>
  );
}
