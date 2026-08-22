import React, { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, DollarSign, Percent, Shield, Sliders, Plus, Search, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingRule {
  id: string;
  name: string;
  category: string;
  ruleType: "Platform Markup" | "Minimum Advertised Price (MAP)" | "Volume Tier Discount" | "Price Floor";
  value: string;
  vendorScope: string;
  status: "Active" | "Inactive";
}

export function MarketplacePricingRules() {
  const [searchTerm, setSearchTerm] = useState("");

  const [rules, setRules] = useState<PricingRule[]>([
    {
      id: "RULE-501",
      name: "Electronics Minimum Advertised Price (MAP) Protection",
      category: "Electronics & Computing",
      ruleType: "Minimum Advertised Price (MAP)",
      value: "Max 15% below MRP",
      vendorScope: "All Electronics Vendors",
      status: "Active",
    },
    {
      id: "RULE-502",
      name: "Standard Marketplace Platform Take-Rate Markup",
      category: "All Categories",
      ruleType: "Platform Markup",
      value: "8.5% Commission Markup",
      vendorScope: "Global",
      status: "Active",
    },
    {
      id: "RULE-503",
      name: "Bulk B2B Wholesale Quantity Tier Rule",
      category: "Industrial Tools & Machinery",
      ruleType: "Volume Tier Discount",
      value: "5% off 10+ units / 12% off 50+ units",
      vendorScope: "Verified Industrial Distributors",
      status: "Active",
    },
  ]);

  const filtered = rules.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Pricing Rules & Price Controls</h1>
          <p className="text-sm text-muted-foreground">Manage minimum advertised price (MAP), platform markups, volume discount tiers, and price floors.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pricing rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((rule, i) => (
          <motion.div
            key={rule.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 space-y-4 hover:border-primary/20 transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  {rule.ruleType}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {rule.status}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-base leading-snug">{rule.name}</h3>
              <p className="text-xs text-muted-foreground">Scope: <strong className="text-foreground">{rule.vendorScope}</strong></p>
            </div>

            <div className="bg-background/50 p-3 rounded-lg border border-border/40 text-xs space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase">Rule Enforcement Formula</span>
              <p className="font-bold text-primary font-mono text-sm">{rule.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
