import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Phone, MapPin, Building, Star, CreditCard, History, Box, FileText, Ticket, MessageSquare, BrainCircuit, Wallet, Award, Activity } from "lucide-react";
import type { Customer } from "@/data/mockCrmData";
import { useCrmData } from "@/hooks/useCrmData";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

interface CustomerProfileProps {
  customer: Customer;
  onClose: () => void;
}

export function CustomerProfile({ customer, onClose }: CustomerProfileProps) {
    const { currency, formatCurrency } = useCurrency();
  const { mockCustomers } = useCrmData();
  const [activeTab, setActiveTab] = useState("Overview");

  const tabs = [
    { id: "Overview", icon: Activity },
    { id: "Purchases", icon: Box },
    { id: "Wallet & Loyalty", icon: Wallet },
    { id: "Support", icon: Ticket },
    { id: "Documents", icon: FileText },
    { id: "AI Insights", icon: BrainCircuit },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full max-w-4xl h-full bg-background border-l border-border/50 shadow-2xl flex flex-col"
      >
        <div className="flex justify-between items-center p-6 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-4">
            <img src={customer.photo} alt={customer.name} className="size-16 rounded-xl shadow-sm border border-border/50" />
            <div>
              <h2 className="text-2xl font-bold text-foreground">{customer.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium px-2 py-0.5 bg-background border border-border/50 rounded-md text-muted-foreground">{customer.id}</span>
                <span className="text-sm font-medium px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-md">{customer.status}</span>
                <span className="text-sm font-medium px-2 py-0.5 bg-indigo-500/10 text-indigo-600 rounded-md">{customer.segment}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-accent rounded-full transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex px-6 border-b border-border/50 overflow-x-auto hide-scrollbar bg-muted/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <tab.icon className="size-4" />
              {tab.id}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "Overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel p-5 rounded-xl border border-border/50 space-y-4">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Building className="size-4 text-primary" /> Contact Details
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <Mail className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Email</p>
                            <p className="font-medium text-foreground">{customer.email}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Phone className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Phone</p>
                            <p className="font-medium text-foreground">{customer.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Address</p>
                            <p className="font-medium text-foreground">{customer.address}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel p-5 rounded-xl border border-border/50 space-y-4">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <CreditCard className="size-4 text-primary" /> Financials
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Credit Limit</p>
                          <p className="font-bold text-lg">{currency.symbol}{customer.creditLimit.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Outstanding</p>
                          <p className="font-bold text-lg text-amber-600">{currency.symbol}{customer.outstandingAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Purchases</p>
                          <p className="font-bold text-lg">{customer.totalPurchases.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Purchase</p>
                          <p className="font-medium text-sm mt-1">{new Date(customer.lastPurchase).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-5 rounded-xl border border-border/50">
                    <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                      <History className="size-4 text-primary" /> Recent Activity Timeline
                    </h3>
                    <div className="space-y-4">
                      {[
                        { title: "Invoice Paid", date: "Today, 10:30 AM", desc: "Paid $1,250 via Credit Card" },
                        { title: "Support Ticket Resolved", date: "Yesterday, 2:15 PM", desc: "Issue with delivery resolved" },
                        { title: "Order Placed", date: "Jul 12, 09:00 AM", desc: "Order #ORD-10293 for 15 items" },
                      ].map((act, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="size-2 rounded-full bg-primary mt-1.5" />
                            {i !== 2 && <div className="w-px h-full bg-border mt-2" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{act.title}</p>
                            <p className="text-xs text-muted-foreground mb-1">{act.date}</p>
                            <p className="text-sm text-muted-foreground">{act.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "AI Insights" && (
                <div className="space-y-6">
                  <div className="p-6 rounded-xl border border-primary/20 bg-primary/5 flex gap-4">
                    <BrainCircuit className="size-8 text-primary shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-2">Antigravity AI Customer Analysis</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Based on {customer.name}'s purchase history and behavior over the last 12 months, 
                        the AI has identified key patterns and recommendations to maximize customer lifetime value.
                      </p>
                      <div className="space-y-3">
                        <div className="bg-background rounded-lg p-3 border border-border flex gap-3 items-start">
                          <Star className="size-5 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-sm">Upsell Opportunity Detected</p>
                            <p className="text-xs text-muted-foreground mt-1">Customer frequently exceeds current plan limits. High probability (94%) to accept Platinum upgrade offer if bundled with priority support.</p>
                          </div>
                        </div>
                        <div className="bg-background rounded-lg p-3 border border-border flex gap-3 items-start">
                          <Activity className="size-5 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-sm">Purchase Pattern Shift</p>
                            <p className="text-xs text-muted-foreground mt-1">Ordering frequency has increased by 15% in the last quarter. Recommend assigning a dedicated account manager.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Placeholders for other tabs */}
              {(activeTab !== "Overview" && activeTab !== "AI Insights") && (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
                  <Box className="size-8 mb-2 opacity-20" />
                  <p>Detailed {activeTab.toLowerCase()} data would be displayed here.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
