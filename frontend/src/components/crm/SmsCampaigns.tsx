import React from "react";
import { motion } from "framer-motion";
import { Plus, Send, MessageSquare, CheckCheck, Clock, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

const smsCampaigns = [
  { id: "SMS-501", name: "Flash Sale Alert", type: "Marketing", recipients: 8450, delivered: 8201, status: "Sent", date: "2026-07-01", message: "🔥 Flash Sale! Get 30% off all items for the next 4 hours..." },
  { id: "SMS-502", name: "OTP — Order Verification", type: "OTP", recipients: 1, delivered: 1, status: "Sent", date: "2026-07-01", message: "Your LazyMonkeyAI verification code is 847291. Valid for 5 mins." },
  { id: "SMS-503", name: "Delivery Confirmation", type: "Transactional", recipients: 342, delivered: 340, status: "Sent", date: "2026-06-30", message: "Your order SO-10039 has been delivered. Thank you for shopping!" },
  { id: "SMS-504", name: "Loyalty Points Expiry", type: "Marketing", recipients: 2300, delivered: 0, status: "Scheduled", date: "2026-07-05", message: "⏰ Reminder: Your 1,200 loyalty points expire on July 15th." },
  { id: "SMS-505", name: "Abandoned Cart Reminder", type: "Marketing", recipients: 1200, delivered: 0, status: "Draft", date: "2026-07-10", message: "Hey! You left something in your cart. Complete your purchase now." },
];

export function SmsCampaigns() {
    const { currency, formatCurrency } = useCurrency();
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SMS Campaigns</h1>
          <p className="text-sm text-muted-foreground">Send targeted marketing, OTP, and transactional SMS messages.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Create SMS
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Messages Sent (30d)", value: "1.2M", icon: Send, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Delivery Rate", value: "98.6%", icon: CheckCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Avg Response Rate", value: "8.4%", icon: MessageSquare, color: "text-amber-500", bg: "bg-amber-500/10" },
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

      <div className="flex items-center gap-4 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input type="text" placeholder="Search SMS campaigns..." className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {["All", "Marketing", "OTP", "Transactional"].map(type => (
            <button key={type} className="px-3 py-2 bg-background/50 border border-border rounded-lg text-sm font-medium hover:bg-accent whitespace-nowrap transition-colors">
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {smsCampaigns.map((campaign, i) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="glass-panel p-5 rounded-xl border border-border/50 hover:border-primary/20 transition-all group cursor-pointer"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{campaign.id} · {campaign.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("px-2 py-1 rounded-md text-xs font-semibold",
                  campaign.type === "OTP" ? "bg-indigo-500/10 text-indigo-600" :
                  campaign.type === "Transactional" ? "bg-blue-500/10 text-blue-600" :
                  "bg-amber-500/10 text-amber-600"
                )}>
                  {campaign.type}
                </span>
                <span className={cn("px-2 py-1 rounded-md text-xs font-semibold",
                  campaign.status === "Sent" ? "bg-emerald-500/10 text-emerald-600" :
                  campaign.status === "Scheduled" ? "bg-blue-500/10 text-blue-600" :
                  "bg-slate-500/10 text-slate-600"
                )}>
                  {campaign.status}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 mb-4 line-clamp-2 font-mono text-xs">
              "{campaign.message}"
            </p>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Send className="size-3.5" />
                <span className="font-semibold text-foreground">{campaign.recipients.toLocaleString()}</span>
                <span>Recipients</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCheck className="size-3.5 text-emerald-500" />
                <span className="font-semibold text-foreground">{campaign.delivered.toLocaleString()}</span>
                <span>Delivered</span>
              </div>
              {campaign.status === "Scheduled" && (
                <div className="flex items-center gap-1.5 text-blue-500 ml-auto">
                  <Clock className="size-3.5" />
                  <span className="text-xs font-medium">Scheduled {campaign.date}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
