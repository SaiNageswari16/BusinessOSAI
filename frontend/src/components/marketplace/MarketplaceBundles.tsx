import React, { useState } from "react";
import { motion } from "framer-motion";
import { PackagePlus, Package, DollarSign, Tag, Sparkles, Search, Plus, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductBundle {
  id: string;
  title: string;
  itemsIncluded: string[];
  combinedRegularPrice: number;
  bundlePrice: number;
  savingsPercentage: number;
  salesCount: number;
  status: "Active" | "Draft";
}

export function MarketplaceBundles() {
  const [searchTerm, setSearchTerm] = useState("");

  const [bundles, setBundles] = useState<ProductBundle[]>([
    {
      id: "BDL-301",
      title: "Executive Workstation Essentials Combo",
      itemsIncluded: [
        "Ultra HD Smart LED Monitor 32-Inch",
        "Ergonomic Executive Office Chair",
        "Wireless Mechanical Keyboard RGB"
      ],
      combinedRegularPrice: 588.99,
      bundlePrice: 499.00,
      savingsPercentage: 15,
      salesCount: 184,
      status: "Active",
    },
    {
      id: "BDL-302",
      title: "Industrial Workshop Power Package",
      itemsIncluded: [
        "Precision Industrial Tool Set 120-Piece",
        "Heavy-Duty Hydraulic Jack 5-Ton",
        "Safety Helmet & Goggles Kit"
      ],
      combinedRegularPrice: 420.00,
      bundlePrice: 349.99,
      savingsPercentage: 17,
      salesCount: 92,
      status: "Active",
    },
  ]);

  const filtered = bundles.filter(b =>
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.itemsIncluded.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Product Bundles & Combo Kits</h1>
          <p className="text-sm text-muted-foreground">Create multi-item product bundles, set package discounts, and boost average order value.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search bundles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((bdl, i) => (
          <motion.div
            key={bdl.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-6 rounded-xl border border-border/50 space-y-4 hover:border-primary/20 transition-all"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Save {bdl.savingsPercentage}%
                </span>
                <h3 className="font-bold text-foreground text-lg">{bdl.title}</h3>
              </div>
              <div className="text-right">
                <span className="text-xs line-through text-muted-foreground font-mono">${bdl.combinedRegularPrice.toFixed(2)}</span>
                <p className="text-xl font-extrabold text-primary font-mono">${bdl.bundlePrice.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-background/50 p-4 rounded-lg border border-border/40 space-y-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider block">Items Included ({bdl.itemsIncluded.length}):</span>
              <ul className="space-y-1.5 text-xs text-foreground">
                {bdl.itemsIncluded.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Package className="size-3.5 text-primary flex-shrink-0" />
                    <span className="truncate">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
              <span>Total Bundles Sold: <strong className="text-foreground font-mono">{bdl.salesCount}</strong></span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {bdl.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
