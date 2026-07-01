import React from "react";
import { motion } from "framer-motion";
import { Plus, Bell, Smartphone, Globe, Monitor, Send, Target, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const notifications = [
  { id: "PN-101", title: "New Order Confirmed!", body: "Your order #SO-10045 has been confirmed and is being processed.", channel: "Mobile", status: "Sent", recipients: 4520, opened: 2800, date: "2026-07-01" },
  { id: "PN-102", title: "Limited Time Offer", body: "Flash Sale! 30% off on electronics for the next 3 hours only.", channel: "Web", status: "Sent", recipients: 18400, opened: 5200, date: "2026-06-30" },
  { id: "PN-103", title: "Your Points are Expiring", body: "1,200 loyalty points expire in 7 days. Redeem them now!", channel: "Mobile", status: "Scheduled", recipients: 3200, opened: 0, date: "2026-07-05" },
  { id: "PN-104", title: "Shipment Update", body: "Your order is out for delivery! Expected by 6 PM today.", channel: "Desktop", status: "Sent", recipients: 280, opened: 195, date: "2026-06-28" },
];

const channelIcon: Record<string, React.ElementType> = {
  Mobile: Smartphone,
  Web: Globe,
  Desktop: Monitor,
};

export function PushNotifications() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Push Notifications</h1>
          <p className="text-sm text-muted-foreground">Reach customers across mobile apps, web browsers, and desktop devices.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Create Notification
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Mobile App", subscribers: "45,200", icon: Smartphone, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Web Browser", subscribers: "22,400", icon: Globe, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Desktop", subscribers: "8,900", icon: Monitor, color: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((ch, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-xl border border-border/50 flex items-center gap-4"
          >
            <div className={cn("size-14 rounded-2xl flex items-center justify-center shrink-0", ch.bg)}>
              <ch.icon className={cn("size-7", ch.color)} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{ch.label} Subscribers</p>
              <h3 className="text-2xl font-bold text-foreground">{ch.subscribers}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {notifications.map((notif, i) => {
          const Icon = channelIcon[notif.channel] || Bell;
          return (
            <motion.div key={notif.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }}
              className="glass-panel p-5 rounded-xl border border-border/50 hover:border-primary/20 transition-all group cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{notif.id} · {notif.channel} · {notif.date}</p>
                  </div>
                </div>
                <span className={cn("px-2 py-1 rounded-md text-xs font-semibold shrink-0",
                  notif.status === "Sent" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                )}>
                  {notif.status}
                </span>
              </div>

              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 mb-4 line-clamp-2">
                {notif.body}
              </p>

              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Target className="size-3.5" />
                  <span className="font-semibold text-foreground">{notif.recipients.toLocaleString()}</span>
                  <span>Sent</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCheck className="size-3.5 text-blue-500" />
                  <span className="font-semibold text-foreground">{notif.opened.toLocaleString()}</span>
                  <span>Opened</span>
                </div>
                {notif.opened > 0 && (
                  <span className="ml-auto text-xs font-semibold text-amber-600">
                    {((notif.opened / notif.recipients) * 100).toFixed(1)}% open rate
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
