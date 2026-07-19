import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, ShoppingCart, Mail, Phone, Ticket, CreditCard, RotateCcw, Activity, Filter, User } from "lucide-react";
import { crmCustomersApi, crmTicketsApi, crmSalesOrdersApi, crmQuotationsApi, type CrmCustomer } from "@/lib/api-client";
import { useTenant } from "@/contexts/tenant-context";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  desc: string;
  date: string;
  icon: React.ComponentType<any>;
  color: string;
}

const filterTypes = ["All", "Purchases", "Support", "Quotations"];

export function CustomerTimeline() {
  const { tenant } = useTenant();
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // 1. Fetch Customers
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const res = await crmCustomersApi.list(1, 100);
        const list = res?.items ?? [];
        setCustomers(list);
        if (list.length > 0) {
          setSelectedCustomer(list[0]);
        } else {
          setSelectedCustomer(null);
        }
      } catch (err) {
        console.error("Failed to load customer list:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [tenant.id]);

  // 2. Fetch Customer Timeline events (Orders, Tickets, Quotations)
  useEffect(() => {
    if (!selectedCustomer) {
      setTimelineEvents([]);
      return;
    }

    const fetchTimeline = async () => {
      setLoadingTimeline(true);
      try {
        const [orders, tickets, quotations] = await Promise.all([
          crmSalesOrdersApi.list(),
          crmTicketsApi.list(),
          crmQuotationsApi.list(),
        ]);

        const events: TimelineEvent[] = [];

        // Add Sales Orders
        (orders || [])
          .filter((o) => o.customer_id === selectedCustomer.id)
          .forEach((o) => {
            events.push({
              id: `order-${o.id}`,
              type: "purchase",
              title: `Sales Order Created: #${o.order_number}`,
              desc: `Total: ₹${o.total.toLocaleString()} — Status: ${o.status} (${o.payment_status})`,
              date: new Date(o.created_at).toLocaleString(),
              icon: ShoppingCart,
              color: "bg-emerald-500",
            });
          });

        // Add Support Tickets
        (tickets || [])
          .filter((t) => t.customer_id === selectedCustomer.id)
          .forEach((t) => {
            events.push({
              id: `ticket-${t.id}`,
              type: "support",
              title: `Support Ticket Raised: ${t.subject}`,
              desc: `Category: ${t.category} — Priority: ${t.priority} (${t.status})`,
              date: new Date(t.created_at).toLocaleString(),
              icon: Ticket,
              color: "bg-red-500",
            });
          });

        // Add Quotations
        (quotations || [])
          .filter((q) => q.customer_id === selectedCustomer.id)
          .forEach((q) => {
            events.push({
              id: `quote-${q.id}`,
              type: "quotation",
              title: `Quotation Sent: #${q.quote_number}`,
              desc: `Total: ₹${q.total.toLocaleString()} — Status: ${q.status}`,
              date: new Date(q.created_at).toLocaleString(),
              icon: CreditCard,
              color: "bg-blue-500",
            });
          });

        // Sort events chronologically (newest first)
        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTimelineEvents(events);
      } catch (err) {
        console.error("Failed to load customer timeline events:", err);
      } finally {
        setLoadingTimeline(false);
      }
    };

    fetchTimeline();
  }, [selectedCustomer]);

  const filteredEvents = timelineEvents.filter((e) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Purchases") return e.type === "purchase";
    if (activeFilter === "Support") return e.type === "support";
    if (activeFilter === "Quotations") return e.type === "quotation";
    return true;
  });

  const displayedCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading Customer Directory…</div>;
  }

  if (customers.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <User className="size-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="font-semibold text-lg">No Customers Found</p>
        <p className="text-sm mt-1">Please add customer accounts under Customer Management to view history timeline.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Timeline</h1>
        <p className="text-sm text-muted-foreground">360° interaction history — orders, support tickets, quotations, and case history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Customer Selector */}
        <div className="lg:col-span-1 glass-panel rounded-xl border border-border/50 overflow-hidden bg-card">
          <div className="p-4 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
              />
            </div>
          </div>
          <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
            {displayedCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-accent/50",
                  selectedCustomer?.id === customer.id ? "bg-primary/5 border-l-2 border-primary" : ""
                )}
              >
                <div className="size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
                  {customer.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-foreground truncate">{customer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{customer.company_name || "Retail Client"}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3 space-y-6">
          {/* Customer header */}
          {selectedCustomer && (
            <div className="glass-panel p-5 rounded-xl border border-border/50 flex flex-wrap items-center gap-4 bg-card">
              <div className="size-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center font-bold text-2xl text-primary">
                {selectedCustomer.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">{selectedCustomer.name}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {selectedCustomer.email || "No Email"} · {selectedCustomer.phone || "No Phone"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-md", selectedCustomer.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600')}>
                  {selectedCustomer.status}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded-md">
                  {selectedCustomer.customer_type}
                </span>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar bg-card p-2 rounded-lg border">
            {filterTypes.map((f) => (
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
          <div className="relative bg-card p-6 rounded-xl border">
            <div className="absolute left-[29px] top-6 bottom-6 w-px bg-border/80" />
            <div className="space-y-6">
              {loadingTimeline ? (
                <div className="text-center py-6 text-muted-foreground">Loading interactive history…</div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No events recorded in chosen filter.</div>
              ) : (
                filteredEvents.map((event, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={event.id}
                    className="flex gap-6 relative group"
                  >
                    <div className={cn("size-[30px] rounded-full flex items-center justify-center text-white shrink-0 relative z-10 shadow-sm mt-1", event.color)}>
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
