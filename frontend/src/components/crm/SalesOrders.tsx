import React from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, ShoppingCart, Download, Printer, Box, CreditCard, Clock, CheckCircle2, RefreshCw } from "lucide-react";

export function SalesOrders() {
  const orders = [
    { id: "SO-10045", customer: "Acme Corp", date: "2026-07-01", amount: 24500, status: "Processing", paymentStatus: "Paid", items: 12 },
    { id: "SO-10044", customer: "David Chen", date: "2026-07-01", amount: 850, status: "Shipped", paymentStatus: "Paid", items: 2 },
    { id: "SO-10043", customer: "TechNova Solutions", date: "2026-06-30", amount: 15400, status: "Pending", paymentStatus: "Unpaid", items: 5 },
    { id: "SO-10042", customer: "Global Trade LLC", date: "2026-06-28", amount: 45000, status: "Delivered", paymentStatus: "Paid", items: 45 },
    { id: "SO-10041", customer: "Sarah Jenkins", date: "2026-06-25", amount: 120, status: "Returned", paymentStatus: "Refunded", items: 1 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">Track and manage customer orders, integrated with inventory and fulfillment.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Download className="size-4" /> Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Create Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "Pending", value: "45", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Processing", value: "128", icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Shipped", value: "34", icon: ShoppingCart, color: "text-indigo-500", bg: "bg-indigo-500/10" },
          { label: "Delivered", value: "4,521", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Unpaid", value: "12", icon: CreditCard, color: "text-red-500", bg: "bg-red-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-4 rounded-xl border border-border/50 flex flex-col justify-center items-center text-center">
            <div className={`p-2 rounded-full ${stat.bg} mb-2`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search orders..."
            className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
          <Filter className="size-4" /> Filter
        </button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
              <tr>
                <th className="px-6 py-4">Order ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Fulfillment Status</th>
                <th className="px-6 py-4">Payment Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {orders.map((order, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={order.id} 
                  className="hover:bg-muted/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <Box className="size-4 text-primary" /> {order.id}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{order.items} Items</p>
                  </td>
                  <td className="px-6 py-4 font-medium">{order.customer}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(order.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-bold text-foreground text-right">
                    ${order.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 w-fit ${
                      order.status === 'Pending' ? 'bg-amber-500/10 text-amber-600' :
                      order.status === 'Processing' ? 'bg-blue-500/10 text-blue-600' :
                      order.status === 'Shipped' ? 'bg-indigo-500/10 text-indigo-600' :
                      order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-600' :
                      'bg-red-500/10 text-red-600'
                    }`}>
                      <div className="size-1.5 rounded-full bg-current" />
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      order.paymentStatus === 'Paid' ? 'text-emerald-600' :
                      order.paymentStatus === 'Unpaid' ? 'text-amber-600' :
                      'text-slate-600'
                    }`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="Download Invoice">
                        <Download className="size-4" />
                      </button>
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="Print Order">
                        <Printer className="size-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
