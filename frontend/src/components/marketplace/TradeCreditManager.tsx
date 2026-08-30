import React, { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Search, Filter, ShieldCheck, AlertTriangle, CheckCircle2, Clock, DollarSign, Building2, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

export function TradeCreditManager() {
  const { currency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: credits, isLoading } = useQuery({
    queryKey: ["marketplace-trade-credits"],
    queryFn: () => marketplaceApi.getTradeCredits(),
    staleTime: 30000,
  });

  const filtered = (credits || []).filter((c: any) =>
    c.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.buyer_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 shrink-0">
              <CreditCard className="size-4" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">B2B Trade Credit & Payment Terms</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 pl-10.5">Manage wholesale buyer credit lines, Net 30/60/90 repayment schedules, and aging dunning.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search wholesale accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Wholesale Account</th>
                <th className="px-6 py-4">Account ID</th>
                <th className="px-6 py-4 text-right">Credit Limit</th>
                <th className="px-6 py-4 text-right">Utilized Balance</th>
                <th className="px-6 py-4 text-right">Available Credit</th>
                <th className="px-6 py-4 text-center">Payment Terms</th>
                <th className="px-6 py-4 text-right">Overdue</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 font-medium">
              {filtered.map((c: any) => (
                <tr key={c.buyer_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground text-sm">{c.buyer_name}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">{c.buyer_id}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                    {currency.symbol}{c.credit_limit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-700">
                    {currency.symbol}{c.used_credit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-purple-700 text-sm">
                    {currency.symbol}{c.available_credit.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <Clock className="size-3" /> {c.payment_terms}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold">
                    {c.overdue > 0 ? (
                      <span className="text-rose-600 font-black">{currency.symbol}{c.overdue.toLocaleString()}</span>
                    ) : (
                      <span className="text-emerald-600">₹0.00</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                      c.status === "Active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-50 text-amber-600 border-amber-200"
                    )}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
