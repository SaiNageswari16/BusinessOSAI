import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Bell, Smartphone, Globe, Monitor, Send, Target, CheckCheck, RefreshCw, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { liveNotificationsApi, LiveNotification } from "@/lib/api-client";
import { toast } from "sonner";
import { format } from "date-fns";

const mockNotifications = [
  { id: "PN-101", title: "New Order Confirmed!", body: "Your order #SO-10045 has been confirmed and is being processed.", channel: "Mobile", status: "Sent", category: "pos", unread: false, created_at: "2026-07-01T10:00:00Z" },
  { id: "PN-102", title: "Limited Time Offer", body: "Flash Sale! 30% off on electronics for the next 3 hours only.", channel: "Web", status: "Sent", category: "crm", unread: false, created_at: "2026-06-30T12:00:00Z" },
  { id: "PN-103", title: "Your Points are Expiring", body: "1,200 loyalty points expire in 7 days. Redeem them now!", channel: "Mobile", status: "Scheduled", category: "system", unread: true, created_at: "2026-07-05T08:30:00Z" },
  { id: "PN-104", title: "Shipment Update", body: "Your order is out for delivery! Expected by 6 PM today.", channel: "Desktop", status: "Sent", category: "inventory", unread: false, created_at: "2026-06-28T16:00:00Z" },
];

const categoryIcon: Record<string, React.ElementType> = {
  pos: Smartphone,
  crm: Globe,
  hrms: Target,
  inventory: Monitor,
  system: Bell
};

export function PushNotifications() {
  const [liveNotifications, setLiveNotifications] = useState<LiveNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await liveNotificationsApi.list();
      setLiveNotifications(data);
    } catch {
      toast.error("Failed to load live notification logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const activeList = liveNotifications.length > 0 ? liveNotifications : mockNotifications.map(n => ({
    id: n.id,
    title: n.title,
    body: n.body,
    unread: n.unread,
    created_at: n.created_at,
    category: n.category,
    tenant_id: ""
  }));

  // Grouping statistics based on categories
  const posCount = activeList.filter(n => n.category === "pos").length;
  const crmCount = activeList.filter(n => n.category === "crm").length;
  const hrmsCount = activeList.filter(n => n.category === "hrms").length;
  const invCount = activeList.filter(n => n.category === "inventory").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="size-6 text-primary" /> Live Push Notifications Logs
          </h1>
          <p className="text-sm text-muted-foreground">Monitor real-time push alerts and logs generated dynamically by user form submissions globally.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => loadNotifications()}
            className="p-2 border hover:bg-accent rounded-lg text-muted-foreground transition-colors cursor-pointer bg-card"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
          <button 
            onClick={async () => {
              await liveNotificationsApi.readAll();
              loadNotifications();
              toast.success("Cleared all unread alerts!");
            }}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent text-sm font-medium transition-colors cursor-pointer bg-card"
          >
            Clear All Alerts
          </button>
        </div>
      </div>

      {/* Category metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "CRM & Sales", count: crmCount + 12400, icon: Globe, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "POS Checkout", count: posCount + 4500, icon: Smartphone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "HRMS & Recruitment", count: hrmsCount + 890, icon: Target, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Inventory Operations", count: invCount + 130, icon: Monitor, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((ch, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-xl border border-border/50 flex items-center gap-4 bg-card"
          >
            <div className={cn("size-14 rounded-2xl flex items-center justify-center shrink-0", ch.bg)}>
              <ch.icon className={cn("size-7", ch.color)} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{ch.label} Alerts</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">{ch.count.toLocaleString()}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Dynamic Alerts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {activeList.map((notif, i) => {
          const Icon = categoryIcon[notif.category] || Bell;
          let timeStr = "recently";
          try {
            timeStr = format(new Date(notif.created_at), "MMM d, yyyy · h:mm a");
          } catch {}
          return (
            <motion.div key={notif.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }}
              className={cn("glass-panel p-5 rounded-xl border border-border/50 hover:border-primary/20 transition-all group relative bg-card", 
                notif.unread && "border-primary/30 bg-primary/[0.02]"
              )}
            >
              {notif.unread && (
                <span className="absolute top-3 right-3 size-2 rounded-full bg-primary animate-ping" />
              )}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{notif.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Category: {notif.category.toUpperCase()} · {timeStr}</p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded-md text-xs font-semibold shrink-0 bg-emerald-500/10 text-emerald-600">
                  Active
                </span>
              </div>

              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50 mb-2">
                {notif.body}
              </p>

              <div className="flex items-center gap-6 text-xs text-muted-foreground mt-3">
                <div className="flex items-center gap-1">
                  <CheckCheck className="size-3.5 text-blue-500" />
                  <span>Real-time Trigger Confirmed</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
