import React from "react";
import { motion } from "framer-motion";
import { Store, TrendingUp, Package, DollarSign, Clock, Users, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertTriangle, Wallet } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";

export function VendorDashboard() {
  const navigate = useNavigate();
  const { currency, formatCurrency } = useCurrency();

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["marketplace-stats"],
    queryFn: () => marketplaceApi.getStats(),
    staleTime: 15000,
  });

  const currentStats = statsData || {
    totalVendors: 0,
    activeVendors: 0,
    pendingApprovals: 0,
    totalProducts: 0,
    monthlyGMV: 0,
    monthlyOrders: 0,
    totalRevenue: 0,
    totalPayouts: 0,
  };

  const stats = [
    { label: "Total Vendors", value: currentStats.totalVendors?.toLocaleString() || "0", change: "+100%", up: true, icon: Store, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Active Vendors", value: currentStats.activeVendors?.toLocaleString() || "0", change: "Verified", up: true, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Pending KYC", value: currentStats.pendingApprovals?.toLocaleString() || "0", change: currentStats.pendingApprovals > 0 ? "Action Required" : "All Clear", up: currentStats.pendingApprovals === 0, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Total Catalog Items", value: currentStats.totalProducts?.toLocaleString() || "0", change: "Omnichannel Master", up: true, icon: Package, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Marketplace Overview</h2>
        <p className="text-xs text-muted-foreground">Monitor multi-vendor performance, catalog inventory, and settlement disbursements.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-panel p-5 rounded-xl border border-border/50 relative overflow-hidden group bg-card shadow-xs"
          >
            <div className={`absolute -right-4 -bottom-4 size-24 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity ${stat.bg}`} />
            
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`size-5 ${stat.color}`} />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${stat.up ? "text-emerald-600" : "text-amber-600"}`}>
                {stat.change}
              </span>
            </div>
            
            <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-border/50 bg-card shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Gross Merchandise Value (GMV)</h2>
              <p className="text-xs text-muted-foreground">Total order volume processed across storefront and vendor orders.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-purple-700">
                {currency.symbol}{Number(currentStats.monthlyGMV || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-3 p-4 bg-muted/20 rounded-xl border border-border/40">
            {[35, 50, 45, 65, 70, 85, 100].map((h, i) => (
              <div key={i} className="w-full flex flex-col items-center gap-2 group relative">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.05 + 0.2 }}
                  className="w-full bg-purple-600/30 hover:bg-purple-600/60 rounded-t-lg transition-colors relative"
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white px-2 py-1 rounded shadow-sm text-xs whitespace-nowrap z-10">
                    {currency.symbol}{((Number(currentStats.monthlyGMV || 0) * (h / 100))).toFixed(0)}
                  </div>
                </motion.div>
                <span className="text-[11px] text-muted-foreground">Period {i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-6 bg-card shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" /> Pending Actions
            </h2>
            <div className="space-y-3">
              {[
                { title: "Vendor KYC Approvals", count: currentStats.pendingApprovals || 0, color: "text-amber-500", bg: "bg-amber-500/10", tab: "vendor_kyc" },
                { title: "Omnichannel Products", count: currentStats.totalProducts || 0, color: "text-purple-500", bg: "bg-purple-500/10", tab: "marketplace_products" },
                { title: "Settlements & Payouts", count: currentStats.totalPayouts > 0 ? "Active" : "Settled", color: "text-emerald-500", bg: "bg-emerald-500/10", tab: "vendor_wallet" },
              ].map((action, i) => (
                <div
                  key={i}
                  onClick={() => navigate({ to: "/marketplace", search: { tab: action.tab } as any })}
                  className="flex justify-between items-center p-3 bg-background border border-border rounded-xl hover:border-purple-500/30 hover:bg-muted/40 transition-all cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-8 rounded-lg flex items-center justify-center font-bold text-xs ${action.bg} ${action.color}`}>
                      {action.count}
                    </div>
                    <span className="text-xs font-bold text-foreground">{action.title}</span>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-border/50">
            <h3 className="text-sm font-bold text-foreground mb-3">Platform Health & SLAs</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-muted-foreground">Active Merchant Ratio</span>
                  <span className="text-emerald-600">
                    {currentStats.totalVendors > 0 ? Math.round((currentStats.activeVendors / currentStats.totalVendors) * 100) : 100}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${currentStats.totalVendors > 0 ? (currentStats.activeVendors / currentStats.totalVendors) * 100 : 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-muted-foreground">Order Delivery Compliance</span>
                  <span className="text-blue-600">99.2%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[99.2%] rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
