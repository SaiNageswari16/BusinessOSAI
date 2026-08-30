import React, { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, Plus, Search, Filter, Layers, DollarSign, Check, X, ArrowRight, Sparkles, Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function B2BPricingRules() {
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [moq, setMoq] = useState(10);
  const [buyerGroup, setBuyerGroup] = useState("Wholesale Distributor");
  const [tiers, setTiers] = useState([
    { min_qty: 10, max_qty: 49, unit_price: 150.0, discount_percent: 10.0 },
    { min_qty: 50, max_qty: 199, unit_price: 135.0, discount_percent: 20.0 },
    { min_qty: 200, max_qty: null as any, unit_price: 120.0, discount_percent: 30.0 },
  ]);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["marketplace-pricing-rules"],
    queryFn: () => marketplaceApi.getPricingRules(),
    staleTime: 30000,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => marketplaceApi.createPricingRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-pricing-rules"] });
      toast.success("B2B Tiered Pricing Rule created!");
      setIsAddOpen(false);
    },
  });

  const filtered = (rules || []).filter((r: any) =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 shrink-0">
              <Calculator className="size-4" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">B2B Tiered Pricing & MOQ Rules</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 pl-10.5">Configure volume price ladders, wholesale margin discounts, and minimum order quantities.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pricing brackets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="size-4" /> + Create Pricing Rule
          </button>
        </div>
      </div>

      {/* ── Rule Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((rule: any) => (
          <div key={rule.id} className="bg-card border rounded-2xl p-5 shadow-xs space-y-4 hover:border-purple-500/30 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                  {rule.id}
                </span>
                <h3 className="text-base font-bold text-foreground mt-1">{rule.name}</h3>
                <p className="text-xs text-muted-foreground">Category: {rule.category} · Target: {rule.buyer_group}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                MOQ: {rule.moq} units
              </span>
            </div>

            {/* Price Ladder Table */}
            <div className="bg-slate-50 border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/80 border-b text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Quantity Tier</th>
                    <th className="px-3 py-2 text-right">Wholesale Rate</th>
                    <th className="px-3 py-2 text-right">Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-slate-700">
                  {rule.tiers?.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-purple-50/50">
                      <td className="px-3 py-2 font-mono">
                        {t.min_qty} {t.max_qty ? `– ${t.max_qty}` : "+"} units
                      </td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">
                        {currency.symbol}{t.unit_price.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-bold">
                        {t.discount_percent}% OFF
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add Rule Modal ── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calculator className="size-5 text-purple-700" /> New Volume Pricing Ladder
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate({ name, category, moq: Number(moq), buyer_group: buyerGroup, tiers });
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-xs font-semibold">Rule Title</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. FMCG Master Carton Volume Discount"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                  >
                    <option>Electronics</option>
                    <option>Food & Beverage</option>
                    <option>Groceries</option>
                    <option>Fashion</option>
                    <option>Packaging</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold">Minimum Order Quantity (MOQ)</label>
                  <input
                    type="number"
                    value={moq}
                    onChange={(e) => setMoq(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-bold shadow-xs cursor-pointer">
                  Save Pricing Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
