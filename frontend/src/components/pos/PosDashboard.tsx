import React from "react";
import { 
  CreditCard, DollarSign, Package, ShoppingCart, 
  TrendingUp, Users, AlertTriangle, ArrowRightLeft,
  Clock, Zap, CheckCircle2, ChevronRight, Store, RotateCcw
} from "lucide-react";
import { posDashboardStats, posTransactions, posSession, posStore } from "../../data/pos-mock";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

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
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-full">
      {/* Header section with Store / Shift Details */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">POS Dashboard</h1>
          <p className="text-slate-500 mt-1">
            {posStore.name} ({posStore.branch}) &mdash; Register: {posSession.registerId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Shift Open: {posSession.cashier}
          </div>
          <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition-all active:scale-95 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Open POS
          </button>
        </div>
      </div>

      {/* AI Business Score Widget */}
      <div className="relative rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-pink-500/20 blur-xl"></div>
        <div className="relative bg-white/90 backdrop-blur-xl rounded-[15px] p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <Zap className="h-7 w-7 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                AI Business Score: <span className="text-emerald-600">94/100</span>
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                Store performance is <strong>14% higher</strong> than usual for a weekday morning. 
                AI predicts a surge in walk-ins between 1:00 PM and 3:00 PM. Make sure 2 registers are active.
              </p>
            </div>
          </div>
          <button className="text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
            View Insights
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard 
          title="Today's Revenue" 
          value={formatCurrency(posDashboardStats.todayRevenue)}
          trend="+12.5%" 
          isPositive={true}
          icon={DollarSign}
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard 
          title="Total Orders" 
          value={posDashboardStats.todayOrders.toString()}
          trend="+5.2%" 
          isPositive={true}
          icon={ShoppingCart}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard 
          title="Average Bill" 
          value={formatCurrency(posDashboardStats.avgBill)}
          trend="-1.4%" 
          isPositive={false}
          icon={CreditCard}
          color="bg-purple-100 text-purple-600"
        />
        <StatCard 
          title="Returns & Refunds" 
          value={formatCurrency(posDashboardStats.refunds)}
          trend={posDashboardStats.returns.toString() + " items"} 
          isPositive={false}
          icon={RotateCcw}
          color="bg-orange-100 text-orange-600"
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
              <span className="bg-rose-100 text-rose-700 text-xs px-2 py-1 rounded-full font-bold">3 items</span>
            </h3>
            <div className="space-y-4">
              <StockAlertItem name="LG 4K Smart TV 55\" stock={8} />
              <StockAlertItem name="Sony WH-1000XM5" stock={12} />
              <StockAlertItem name="Ceramic Dinner Set" stock={22} />
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
                  {posTransactions.slice(0, 8).map((trx) => (
                    <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{trx.id}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(trx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-slate-700">{trx.customerName}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium uppercase tracking-wide">
                          {trx.paymentMethod}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        {formatCurrency(trx.total)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {trx.status === "Completed" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded-full text-xs font-medium">
                            <RotateCcw className="w-3 h-3" /> Refunded
                          </span>
                        )}
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
