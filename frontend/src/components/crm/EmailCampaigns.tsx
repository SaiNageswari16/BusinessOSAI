import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Send, Eye, MousePointer, Users, Mail, Play, Pause, MoreHorizontal, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const campaigns = [
  { id: "EC-1001", name: "Summer Sale 2026", status: "Sent", recipients: 12500, opens: 4250, clicks: 1200, date: "2026-06-28", subject: "🔥 Biggest Sale of the Year!" },
  { id: "EC-1002", name: "Welcome New Customers", status: "Active", recipients: 845, opens: 620, clicks: 380, date: "2026-07-01", subject: "Welcome to BusinessOS Family 🎉" },
  { id: "EC-1003", name: "Loyalty Points Expiry Reminder", status: "Draft", recipients: 2300, opens: 0, clicks: 0, date: "2026-07-05", subject: "⏰ Your points expire soon!" },
  { id: "EC-1004", name: "Q2 Newsletter", status: "Sent", recipients: 18400, opens: 7200, clicks: 2100, date: "2026-06-15", subject: "Q2 Business Update & New Features" },
  { id: "EC-1005", name: "VIP Member Exclusive Offer", status: "Paused", recipients: 450, opens: 310, clicks: 95, date: "2026-06-20", subject: "💎 VIP Exclusive: 25% Off Everything" },
];

const templates = [
  { name: "Promotional", preview: "Bold layout for sales and offers" },
  { name: "Newsletter", preview: "Clean layout for updates" },
  { name: "Transactional", preview: "Simple, high deliverability" },
  { name: "Win-Back", preview: "Re-engage inactive customers" },
];

export function EmailCampaigns() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "templates">("campaigns");

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Campaigns</h1>
          <p className="text-sm text-muted-foreground">Design, send, and analyze email marketing campaigns at scale.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sent (30d)", value: "245,400", icon: Send, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Avg Open Rate", value: "34.2%", icon: Eye, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Avg Click Rate", value: "12.8%", icon: MousePointer, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Active Subscribers", value: "18,430", icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${stat.bg} shrink-0`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-xl font-bold text-foreground">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-border/50">
        {(["campaigns", "templates"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "campaigns" && (
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input type="text" placeholder="Search campaigns..." className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
              <Filter className="size-4" /> Filter
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Campaign Name</th>
                  <th className="px-6 py-4">Subject Line</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Recipients</th>
                  <th className="px-6 py-4 text-right">Open Rate</th>
                  <th className="px-6 py-4 text-right">Click Rate</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {campaigns.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="hover:bg-muted/50 transition-colors group cursor-pointer">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground flex items-center gap-2"><Mail className="size-4 text-primary" /> {c.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.id} · {c.date}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{c.subject}</td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit",
                        c.status === "Sent" ? "bg-emerald-500/10 text-emerald-600" :
                        c.status === "Active" ? "bg-blue-500/10 text-blue-600" :
                        c.status === "Draft" ? "bg-slate-500/10 text-slate-600" :
                        "bg-amber-500/10 text-amber-600"
                      )}>
                        <div className="size-1.5 rounded-full bg-current" />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{c.recipients.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={c.opens ? "font-semibold text-amber-600" : "text-muted-foreground"}>
                        {c.opens ? `${((c.opens / c.recipients) * 100).toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={c.clicks ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
                        {c.clicks ? `${((c.clicks / c.recipients) * 100).toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {c.status === "Active" ? <button className="p-1.5 hover:bg-accent rounded-md"><Pause className="size-4 text-muted-foreground" /></button> : null}
                        {c.status === "Paused" || c.status === "Draft" ? <button className="p-1.5 hover:bg-accent rounded-md"><Play className="size-4 text-muted-foreground" /></button> : null}
                        <button className="p-1.5 hover:bg-accent rounded-md"><MoreHorizontal className="size-4 text-muted-foreground" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {templates.map((tpl, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
              className="glass-panel rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all cursor-pointer group"
            >
              <div className="h-32 bg-gradient-to-br from-primary/10 via-primary/5 to-background flex items-center justify-center">
                <Mail className="size-10 text-primary/30 group-hover:text-primary/60 transition-colors" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-foreground mb-1">{tpl.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{tpl.preview}</p>
                <button className="w-full py-2 bg-background border border-border hover:bg-accent transition-colors rounded-lg text-sm font-medium">Use Template</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
