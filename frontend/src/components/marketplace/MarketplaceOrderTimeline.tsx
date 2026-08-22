import React, { useState } from "react";
import { motion } from "framer-motion";
import { History, CheckCircle2, Clock, Truck, Package, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderTimelineStep {
  stepName: string;
  timestamp: string;
  details: string;
  completed: boolean;
}

interface OrderTimeline {
  orderId: string;
  customerName: string;
  vendorName: string;
  totalAmount: number;
  currentStatus: string;
  steps: OrderTimelineStep[];
}

export function MarketplaceOrderTimeline() {
  const [searchTerm, setSearchTerm] = useState("");

  const [timelines, setTimelines] = useState<OrderTimeline[]>([
    {
      orderId: "ORD-8825",
      customerName: "David Miller",
      vendorName: "Apex Tech Solutions",
      totalAmount: 189.99,
      currentStatus: "In Transit",
      steps: [
        { stepName: "Order Placed & Payment Verified", timestamp: "2026-08-15 08:30", details: "Payment via Stripe Credit Card confirmed.", completed: true },
        { stepName: "Vendor Order Acceptance", timestamp: "2026-08-15 08:45", details: "Apex Tech Solutions accepted fulfillment.", completed: true },
        { stepName: "Dispatched from Regional Hub", timestamp: "2026-08-15 11:20", details: "Handed over to Express Freight Logistics.", completed: true },
        { stepName: "Out for Final Delivery", timestamp: "Pending", details: "Driver assigned for doorstep delivery.", completed: false },
        { stepName: "Delivered & Buyer Confirmation", timestamp: "Pending", details: "Final delivery confirmation code verification.", completed: false },
      ],
    },
  ]);

  const filtered = timelines.filter(t =>
    t.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Order Lifecycle Timeline & Audit Trail</h1>
          <p className="text-sm text-muted-foreground">Step-by-step order progression from buyer placement to vendor dispatch and doorstep delivery.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {filtered.map((t) => (
          <div key={t.orderId} className="glass-panel p-6 rounded-xl border border-border/50 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-border/40">
              <div>
                <h3 className="text-lg font-bold text-foreground font-mono">{t.orderId}</h3>
                <p className="text-xs text-muted-foreground">Customer: <strong className="text-foreground">{t.customerName}</strong> • Vendor: <strong className="text-primary">{t.vendorName}</strong></p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-sky-500/10 text-sky-600 border border-sky-500/20">
                  {t.currentStatus}
                </span>
                <p className="text-lg font-extrabold text-foreground font-mono mt-1">${t.totalAmount.toFixed(2)}</p>
              </div>
            </div>

            {/* Stepper */}
            <div className="space-y-4 relative pl-6 border-l-2 border-border/60">
              {t.steps.map((step, idx) => (
                <div key={idx} className="relative space-y-1">
                  <div className={cn("absolute -left-[31px] top-0.5 size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    step.completed ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground border border-border"
                  )}>
                    {step.completed ? "✓" : idx + 1}
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground text-sm">{step.stepName}</span>
                    <span className="font-mono text-muted-foreground text-[11px]">{step.timestamp}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.details}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
