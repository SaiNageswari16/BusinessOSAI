import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, ShoppingCart, Mail, Phone, Ticket, Package, CreditCard, RotateCcw, Activity, MessageSquare, Filter } from "lucide-react";
import { useCrmData } from "@/hooks/useCrmData";
import { cn } from "@/lib/utils";

const timelineEvents = [
  { id: 1, type: "purchase", title: "Purchased 8 items", desc: "Order #SO-10045 — $24,500", date: "2026-07-01 10:30", icon: ShoppingCart, color: "bg-emerald-500" },
  { id: 2, type: "email", title: "Email Campaign Opened", desc: "Summer Sale Promotion 2026", date: "2026-07-01 09:15", icon: Mail, color: "bg-blue-500" },
  { id: 3, type: "ticket", title: "Support Ticket Raised", desc: "TK-901: Login Issue — High Priority", date: "2026-07-01 08:30", icon: Ticket, color: "bg-red-500" },
  { id: 4, type: "payment", title: "Invoice Paid", desc: "INV-4920 — $8,500 via Bank Transfer", date: "2026-06-30 14:20", icon: CreditCard, color: "bg-indigo-500" },
  { id: 5, type: "call", title: "Sales Call Logged", desc: "Discussed Q3 renewal. 25 min call.", date: "2026-06-29 11:45", icon: Phone, color: "bg-purple-500" },
  { id: 6, type: "order", title: "New Order Placed via POS", desc: "Order #SO-10039 — $1,200", date: "2026-06-28 16:00", icon: Package, color: "bg-amber-500" },
  { id: 7, type: "return", title: "Return Requested", desc: "RET-901 — 2 items, Damaged", date: "2026-06-25 13:10", icon: RotateCcw, color: "bg-orange-500" },
  { id: 8, type: "activity", title: "Customer Portal Login", desc: "Logged in from 192.168.1.1 (Chrome)", date: "2026-06-24 09:00", icon: Activity, color: "bg-slate-500" },
];

const filterTypes = ["All", "Purchases", "Payments", "Support", "Communication", "Returns"];

export function CustomerTimeline({ tab = "activity_timeline" }: { tab?: string }) {
  const { mockCustomers } = useCrmData();
  const [selectedCustomer, setSelectedCustomer] = useState(mockCustomers[0]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEvents = timelineEvents.filter(e => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Purchases") return ["purchase", "order"].includes(e.type);
    if (activeFilter === "Payments") return e.type === "payment";
    if (activeFilter === "Support") return e.type === "ticket";
    if (activeFilter === "Communication") return ["email", "call"].includes(e.type);
    if (activeFilter === "Returns") return e.type === "return";
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Timeline</h1>
        <p className="text-sm text-muted-foreground">360° interaction history — purchases, calls, emails, support, payments, and more.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Customer Selector */}
        <div className="lg:col-span-1 glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find customer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {mockCustomers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(customer => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-accent/50",
                  selectedCustomer.id === customer.id ? "bg-primary/5 border-l-2 border-primary" : ""
                )}
              >
                <img src={customer.photo} alt={customer.name} className="size-9 rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{customer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{customer.id}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3 space-y-6">
          {/* Customer header */}
          <div className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
            <img src={selectedCustomer.photo} alt={selectedCustomer.name} className="size-14 rounded-xl shadow-sm border border-border/50" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">{selectedCustomer.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedCustomer.email} · {selectedCustomer.phone}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={cn("text-xs font-semibold px-2 py-1 rounded-md", selectedCustomer.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600')}>{selectedCustomer.status}</span>
              <span className="text-xs font-semibold px-2 py-1 bg-indigo-500/10 text-indigo-600 rounded-md">{selectedCustomer.membership}</span>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {filterTypes.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  activeFilter === f ? "bg-primary text-primary-foreground shadow-md" : "bg-background border border-border hover:bg-accent text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Timeline events */}
          <div className="relative">
            <div className="absolute left-7 top-0 bottom-0 w-px bg-border/50" />
            <div className="space-y-0">
              {filteredEvents.map((event, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  key={event.id}
                  className="flex gap-6 relative group pb-6 last:pb-0"
                >
                  <div className={cn("size-[30px] rounded-full flex items-center justify-center text-white shrink-0 relative z-10 shadow-md mt-1", event.color)}>
                    <event.icon className="size-3.5" />
                  </div>
                  <div className="flex-1 glass-panel p-4 rounded-xl border border-border/50 hover:border-primary/20 transition-colors hover:shadow-sm">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{event.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{event.desc}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 bg-muted/50 px-2 py-1 rounded-md">{event.date}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
