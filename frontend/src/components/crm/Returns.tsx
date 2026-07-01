import React from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, RotateCcw, Box, User, ArrowRightLeft, CheckCircle2, Clock, DollarSign } from "lucide-react";

export function Returns() {
  const returns = [
    { id: "RET-901", orderId: "SO-10045", customer: "Acme Corp", reason: "Damaged in transit", status: "Approved", action: "Replacement", amount: 1250, date: "2026-07-01" },
    { id: "RET-902", orderId: "SO-10041", customer: "Sarah Jenkins", reason: "Wrong item received", status: "Pending", action: "Refund", amount: 120, date: "2026-06-30" },
    { id: "RET-903", orderId: "SO-10022", customer: "David Chen", reason: "Not as expected", status: "Rejected", action: "None", amount: 450, date: "2026-06-28" },
    { id: "RET-904", orderId: "SO-10010", customer: "TechNova", reason: "Defective product", status: "Processed", action: "Refund", amount: 890, date: "2026-06-25" },
    { id: "RET-905", orderId: "SO-10005", customer: "Global Trade", reason: "Ordered by mistake", status: "Processed", action: "Store Credit", amount: 2100, date: "2026-06-20" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Returns & Refunds</h1>
          <p className="text-sm text-muted-foreground">Manage product returns, RMAs, and refund processing.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Create Return
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Returns", value: "24", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Approved (Awaiting Item)", value: "15", icon: RotateCcw, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Processed Refunds", value: "$12,450", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Return Rate", value: "1.2%", icon: ArrowRightLeft, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`size-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-xl font-bold text-foreground">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by ID, Order, or Customer..."
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Filter className="size-4" /> Filter
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
              <tr>
                <th className="px-6 py-4">RMA ID</th>
                <th className="px-6 py-4">Order & Customer</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Requested Action</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {returns.map((ret, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={ret.id} 
                  className="hover:bg-muted/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <RotateCcw className="size-4 text-primary" /> {ret.id}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{ret.date}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground flex items-center gap-1.5"><Box className="size-3.5" /> {ret.orderId}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><User className="size-3.5" /> {ret.customer}</p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{ret.reason}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-accent border border-border rounded-md text-xs font-medium text-foreground">
                      {ret.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-foreground text-right">
                    ${ret.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      ret.status === 'Pending' ? 'bg-amber-500/10 text-amber-600' :
                      ret.status === 'Approved' ? 'bg-blue-500/10 text-blue-600' :
                      ret.status === 'Processed' ? 'bg-emerald-500/10 text-emerald-600' :
                      'bg-red-500/10 text-red-600'
                    }`}>
                      {ret.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary hover:underline text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Review
                    </button>
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
