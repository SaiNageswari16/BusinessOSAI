import React from "react";
import { motion } from "framer-motion";
import { Plus, MessageCircle, ShoppingBag, FileText, Package, CheckCheck, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const waMessages = [
  { id: "WA-201", name: "New Arrivals Catalog", type: "Catalog", recipients: 5420, read: 3200, status: "Sent", date: "2026-07-01" },
  { id: "WA-202", name: "Diwali Promo Blast", type: "Promotion", recipients: 12000, read: 8500, status: "Sent", date: "2026-06-28" },
  { id: "WA-203", name: "Invoice #INV-4920", type: "Invoice", recipients: 1, read: 1, status: "Sent", date: "2026-06-28" },
  { id: "WA-204", name: "Order Shipped Notification", type: "Order Update", recipients: 342, read: 280, status: "Sent", date: "2026-06-30" },
  { id: "WA-205", name: "Flash Sale Catalog", type: "Catalog", recipients: 8900, read: 0, status: "Scheduled", date: "2026-07-05" },
];

const typeIcon: Record<string, React.ElementType> = {
  Catalog: ShoppingBag,
  Promotion: MessageCircle,
  Invoice: FileText,
  "Order Update": Package,
};

export function WhatsappCampaigns() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Campaigns</h1>
          <p className="text-sm text-muted-foreground">Send catalogs, promotions, invoices, and order updates via WhatsApp Business API.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> New WhatsApp Message
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Messages Sent (30d)", value: "48.5K", color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Avg Read Rate", value: "82.3%", color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Conversion Rate", value: "14.5%", color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Opt-in Subscribers", value: "22,400", color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden group">
            <div className={cn("absolute -right-4 -bottom-4 size-20 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity", stat.bg)} />
            <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
            <h3 className={cn("text-2xl font-bold", stat.color)}>{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* WhatsApp message type cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["Catalog", "Promotion", "Invoice", "Order Update"].map((type, i) => {
          const Icon = typeIcon[type];
          return (
            <motion.button
              key={type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-panel p-5 rounded-xl border border-border/50 hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col items-center gap-3 text-center group"
            >
              <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <Icon className="size-6 text-emerald-600" />
              </div>
              <p className="font-semibold text-sm text-foreground">{type}</p>
              <p className="text-xs text-muted-foreground">Send WhatsApp {type.toLowerCase()}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Send className="size-4 text-emerald-500" /> Recent Campaigns
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
              <tr>
                <th className="px-6 py-3">Campaign</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Recipients</th>
                <th className="px-6 py-3 text-right">Read</th>
                <th className="px-6 py-3 text-right">Read Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {waMessages.map((msg, i) => {
                const Icon = typeIcon[msg.type] || MessageCircle;
                return (
                  <motion.tr key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{msg.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{msg.id} · {msg.date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Icon className="size-3.5 text-emerald-500" />
                        {msg.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 w-fit",
                        msg.status === "Sent" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                      )}>
                        {msg.status === "Sent" ? <CheckCheck className="size-3" /> : <Clock className="size-3" />}
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{msg.recipients.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-medium">{msg.read.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                      {msg.read ? `${((msg.read / msg.recipients) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
