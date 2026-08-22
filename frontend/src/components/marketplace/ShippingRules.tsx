import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sliders, DollarSign, Scale, Map, Search, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShippingRule {
  id: string;
  name: string;
  zone: string;
  weightMinKg: number;
  weightMaxKg: number;
  baseRate: number;
  perKgRate: number;
  freeShippingMinOrder: number;
  status: "Active" | "Inactive";
}

export function ShippingRules() {
  const [rules, setRules] = useState<ShippingRule[]>([
    {
      id: "SHIP-101",
      name: "Standard Ground National Shipping Rate",
      zone: "National (All Regions)",
      weightMinKg: 0,
      weightMaxKg: 10,
      baseRate: 9.99,
      perKgRate: 1.50,
      freeShippingMinOrder: 150.00,
      status: "Active",
    },
    {
      id: "SHIP-102",
      name: "Heavy Industrial Freight Freight Matrix",
      zone: "National Freight",
      weightMinKg: 10,
      weightMaxKg: 200,
      baseRate: 45.00,
      perKgRate: 2.20,
      freeShippingMinOrder: 500.00,
      status: "Active",
    },
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Shipping Cost Rules & Weight Slabs</h1>
          <p className="text-sm text-muted-foreground">Manage weight-based shipping tariffs, regional slabs, and free shipping order thresholds.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rules.map((r) => (
          <div key={r.id} className="glass-panel p-5 rounded-xl border border-border/50 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  {r.zone}
                </span>
                <h3 className="font-bold text-foreground text-base">{r.name}</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {r.status}
              </span>
            </div>

            <div className="bg-background/50 p-3 rounded-lg border border-border/40 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Weight Slab:</span>
                <span className="font-mono text-foreground font-semibold">{r.weightMinKg} kg – {r.weightMaxKg} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Rate / Extra Per Kg:</span>
                <span className="font-mono text-foreground font-semibold">${r.baseRate.toFixed(2)} + (${r.perKgRate.toFixed(2)} / kg)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Free Shipping Threshold:</span>
                <span className="font-bold text-emerald-500 font-mono">Orders ≥ ${r.freeShippingMinOrder.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
