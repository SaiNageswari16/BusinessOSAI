import React from "react";
import { motion } from "framer-motion";
import { Plus, Download, CheckCircle, AlertTriangle, FolderTree, BarChart3 } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

const statusStyle = (s: string) => {
  switch (s) {
    case "Active": return "bg-emerald-500/10 text-emerald-500";
    case "Disposed": return "bg-muted text-muted-foreground";
    case "Under Maintenance": return "bg-amber-500/10 text-amber-500";
    default: return "bg-muted text-muted-foreground";
  }
};

export function FixedAssets({ tab = "assets" }: Props) {
  const { mockFixedAssets } = useAccountingData();

  if (tab === "asset_categories") {
    const categories = [
      { id: "CAT-01", name: "Real Estate", count: 1, totalCost: 5000000, totalBookValue: 4100000, depRate: "5% SLM" },
      { id: "CAT-02", name: "Vehicles", count: 5, totalCost: 850000, totalBookValue: 510000, depRate: "20% WDV" },
      { id: "CAT-03", name: "IT Equipment", count: 21, totalCost: 415000, totalBookValue: 268000, depRate: "25–33% WDV" },
      { id: "CAT-04", name: "Plant & Machinery", count: 2, totalCost: 255000, totalBookValue: 108000, depRate: "10–15% SLM" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Asset Categories</h1><p className="text-sm text-muted-foreground">Group fixed assets by category with depreciation policies.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Category</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat, i) => (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-500/10 rounded-xl"><FolderTree className="size-5 text-indigo-500" /></div>
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">{cat.count} assets</span>
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-1">{cat.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">Depreciation: {cat.depRate}</p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50 text-sm">
                <div><p className="text-muted-foreground text-xs mb-1">Total Cost</p><p className="font-semibold">${cat.totalCost.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs mb-1">Book Value</p><p className="font-semibold text-emerald-500">${cat.totalBookValue.toLocaleString()}</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "depreciation") {
    const schedule = mockFixedAssets.filter(a => a.status === "Active").map(a => {
      const annualDep = a.depreciationMethod === "SLM"
        ? Math.round(a.purchaseCost * a.depreciationRate / 100)
        : Math.round(a.bookValue * a.depreciationRate / 100);
      return { ...a, annualDep, monthlyDep: Math.round(annualDep / 12), accumulatedDep: a.purchaseCost - a.bookValue };
    });
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Depreciation Schedule</h1><p className="text-sm text-muted-foreground">Annual and monthly depreciation for all active assets.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80"><Download className="size-4" /> Export Schedule</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Annual Depreciation (FY2026)", value: `$${schedule.reduce((s, a) => s + a.annualDep, 0).toLocaleString()}`, color: "text-amber-500" },
            { label: "Monthly Charge", value: `$${Math.round(schedule.reduce((s, a) => s + a.annualDep, 0) / 12).toLocaleString()}`, color: "text-blue-500" },
            { label: "Total Accumulated Dep.", value: `$${schedule.reduce((s, a) => s + a.accumulatedDep, 0).toLocaleString()}`, color: "text-red-400" },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Asset</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 text-right font-medium">Cost</th>
                  <th className="px-6 py-4 text-right font-medium">Book Value</th>
                  <th className="px-6 py-4 text-right font-medium">Accum. Dep.</th>
                  <th className="px-6 py-4 text-right font-medium">Annual Dep.</th>
                  <th className="px-6 py-4 text-right font-medium">Monthly Dep.</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((asset, i) => (
                  <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{asset.name}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-md text-xs">{asset.depreciationMethod}</span></td>
                    <td className="px-6 py-4 text-right">${asset.purchaseCost.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-500">${asset.bookValue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-400">${asset.accumulatedDep.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-semibold text-amber-500">${asset.annualDep.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">${asset.monthlyDep.toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "asset_register") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Asset Register</h1><p className="text-sm text-muted-foreground">Complete register of all company assets with locations and custodians.</p></div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80"><Download className="size-4" /> Export Register</button>
            <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Asset</button>
          </div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Asset ID</th>
                  <th className="px-6 py-4 font-medium">Asset Name</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Custodian</th>
                  <th className="px-6 py-4 text-right font-medium">Book Value</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockFixedAssets.map((asset, i) => {
                  const locations = ["Head Office, San Francisco", "Fleet – Bay Area", "Data Center, San Jose", "Warehouse, Oakland", "Retail Stores (All)", "Warehouse, Oakland"];
                  const custodians = ["Facilities Mgmt", "Operations", "IT Department", "Warehouse Team", "Retail Operations", "Warehouse Team"];
                  return (
                    <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-primary">{asset.id}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{asset.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{asset.category}</td>
                      <td className="px-6 py-4 text-muted-foreground">{locations[i]}</td>
                      <td className="px-6 py-4 text-muted-foreground">{custodians[i]}</td>
                      <td className="px-6 py-4 text-right font-semibold text-emerald-500">${asset.bookValue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(asset.status)}`}>{asset.status}</span></td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: fixed_assets list
  const totalCost = mockFixedAssets.reduce((s, a) => s + a.purchaseCost, 0);
  const totalBookValue = mockFixedAssets.reduce((s, a) => s + a.bookValue, 0);
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Fixed Assets</h1><p className="text-sm text-muted-foreground">Track all capital assets, depreciation, and book values.</p></div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80"><Download className="size-4" /> Export</button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Asset</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Purchase Cost", value: `$${(totalCost / 1000000).toFixed(2)}M`, color: "text-blue-500" },
          { label: "Current Book Value", value: `$${(totalBookValue / 1000000).toFixed(2)}M`, color: "text-emerald-500" },
          { label: "Total Depreciated", value: `$${((totalCost - totalBookValue) / 1000).toFixed(0)}K`, color: "text-amber-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-5 rounded-xl border border-border/50">
            <p className={`text-xs font-medium uppercase tracking-wider ${s.color} mb-2`}>{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </motion.div>
        ))}
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Asset Name</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Purchase Date</th>
                <th className="px-6 py-4 text-right font-medium">Cost</th>
                <th className="px-6 py-4 text-right font-medium">Book Value</th>
                <th className="px-6 py-4 text-center font-medium">Dep. Rate</th>
                <th className="px-6 py-4 text-center font-medium">Method</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockFixedAssets.map((asset, i) => (
                <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{asset.id}</td>
                  <td className="px-6 py-4 font-medium">{asset.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{asset.category}</td>
                  <td className="px-6 py-4 text-muted-foreground">{asset.purchaseDate}</td>
                  <td className="px-6 py-4 text-right">${asset.purchaseCost.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-medium text-emerald-500">${asset.bookValue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">{asset.depreciationRate}%</td>
                  <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-md text-xs">{asset.depreciationMethod}</span></td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(asset.status)}`}>{asset.status}</span></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
