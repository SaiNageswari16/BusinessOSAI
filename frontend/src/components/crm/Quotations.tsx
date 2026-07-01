import React from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, FileCheck, Printer, FileText, Send, Building, Calendar, DollarSign, ExternalLink } from "lucide-react";

export function Quotations() {
  const quotations = [
    { id: "QT-2601", customer: "Acme Corp", date: "2026-07-01", validUntil: "2026-07-15", amount: 15400, status: "Draft", items: 4 },
    { id: "QT-2602", customer: "TechNova Solutions", date: "2026-06-28", validUntil: "2026-07-12", amount: 45000, status: "Sent", items: 12 },
    { id: "QT-2603", customer: "Global Trade LLC", date: "2026-06-25", validUntil: "2026-07-10", amount: 8500, status: "Approved", items: 2 },
    { id: "QT-2604", customer: "Sarah Jenkins", date: "2026-06-20", validUntil: "2026-07-05", amount: 1250, status: "Rejected", items: 1 },
    { id: "QT-2605", customer: "Davis Retail", date: "2026-06-15", validUntil: "2026-06-30", amount: 24000, status: "Converted", items: 8 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
          <p className="text-sm text-muted-foreground">Create, manage, and track professional sales quotations.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Create Quotation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Draft Quotes", value: "12", amount: "$45,200", color: "text-slate-500", bg: "bg-slate-500/10" },
          { label: "Sent Quotes", value: "24", amount: "$184,500", color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Approved Quotes", value: "8", amount: "$64,000", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Converted to Orders", value: "145", amount: "$1.2M", color: "text-indigo-500", bg: "bg-indigo-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50">
            <div className="flex justify-between items-start mb-2">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <div className={`px-2 py-1 rounded-md text-xs font-bold ${stat.bg} ${stat.color}`}>
                {stat.value}
              </div>
            </div>
            <h3 className="text-2xl font-bold text-foreground">{stat.amount}</h3>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search quotations..."
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
                <th className="px-6 py-4">Quote ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Valid Until</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {quotations.map((quote, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={quote.id} 
                  className="hover:bg-muted/50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <FileCheck className="size-4 text-primary" /> {quote.id}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{quote.items} Items</p>
                  </td>
                  <td className="px-6 py-4 font-medium flex items-center gap-2 mt-2">
                    <Building className="size-4 text-muted-foreground" /> {quote.customer}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(quote.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground flex items-center gap-2 mt-2">
                    <Calendar className="size-4" /> {new Date(quote.validUntil).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-bold text-foreground text-right">
                    ${quote.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      quote.status === 'Draft' ? 'bg-slate-500/10 text-slate-600' :
                      quote.status === 'Sent' ? 'bg-blue-500/10 text-blue-600' :
                      quote.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' :
                      quote.status === 'Rejected' ? 'bg-red-500/10 text-red-600' :
                      'bg-indigo-500/10 text-indigo-600'
                    }`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="Send Email">
                        <Send className="size-4" />
                      </button>
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="Download PDF">
                        <FileText className="size-4" />
                      </button>
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="Print">
                        <Printer className="size-4" />
                      </button>
                      <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors" title="View Details">
                        <ExternalLink className="size-4" />
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
