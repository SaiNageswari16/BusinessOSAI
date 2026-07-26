import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, FolderTree, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props { tab?: string; }

interface AssetRecord {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  bookValue: number;
  depreciationRate: number;
  depreciationMethod: string;
  status: string;
  location: string;
  custodian: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

const statusStyle = (s: string) => {
  const status = s.toLowerCase();
  switch (status) {
    case "active": return "bg-emerald-500/10 text-emerald-500";
    case "disposed": return "bg-muted text-muted-foreground";
    case "under maintenance": case "maintenance": return "bg-amber-500/10 text-amber-500";
    default: return "bg-muted text-muted-foreground";
  }
};

// ─── Modal: Add Asset ────────────────────────────────────────────────────
function AssetFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (asset: Partial<AssetRecord>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "IT Equipment",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchaseCost: 0,
    depreciationRate: 20,
    depreciationMethod: "WDV",
    location: "Main Branch",
    custodian: "IT Department",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSaved({
        id: `AST-2026-${Math.floor(100 + Math.random() * 900)}`,
        name: form.name,
        category: form.category,
        purchaseDate: form.purchaseDate,
        purchaseCost: form.purchaseCost,
        bookValue: form.purchaseCost,
        depreciationRate: form.depreciationRate,
        depreciationMethod: form.depreciationMethod,
        status: "Active",
        location: form.location,
        custodian: form.custodian,
      });
      toast.success("Fixed Asset added successfully!");
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">Add Capital Asset</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Asset Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="MacBook Pro 16 Inch" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Category *</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="Real Estate">Real Estate</option>
                <option value="Vehicles">Vehicles</option>
                <option value="IT Equipment">IT Equipment</option>
                <option value="Plant & Machinery">Plant & Machinery</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Purchase Date *</label>
              <input type="date" value={form.purchaseDate} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Purchase Cost *</label>
              <input type="number" step="any" value={form.purchaseCost} onChange={e => setForm(p => ({ ...p, purchaseCost: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Depreciation Rate (%) *</label>
              <input type="number" value={form.depreciationRate} onChange={e => setForm(p => ({ ...p, depreciationRate: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Dep. Method *</label>
              <select value={form.depreciationMethod} onChange={e => setForm(p => ({ ...p, depreciationMethod: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="SLM">Straight Line (SLM)</option>
                <option value="WDV">Written Down Value (WDV)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Custodian</label>
              <input value={form.custodian} onChange={e => setForm(p => ({ ...p, custodian: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="IT Department" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Asset
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main FixedAssets Component ───────────────────────────────────────────
export function FixedAssets({ tab = "assets" }: Props) {
  const [assets, setAssets] = useState<AssetRecord[]>([
    { id: "AST-2026-001", name: "Corporate Headquarters", category: "Real Estate", purchaseDate: "2026-01-10", purchaseCost: 5000000, bookValue: 4100000, depreciationRate: 5, depreciationMethod: "SLM", status: "Active", location: "Mumbai HQ", custodian: "Facilities Mgmt" },
    { id: "AST-2026-002", name: "Delivery Truck (Tata Ace)", category: "Vehicles", purchaseDate: "2026-02-15", purchaseCost: 150000, bookValue: 120000, depreciationRate: 20, depreciationMethod: "WDV", status: "Active", location: "Main Warehouse", custodian: "Operations" },
    { id: "AST-2026-003", name: "Dell PowerEdge Server Rack", category: "IT Equipment", purchaseDate: "2026-03-01", purchaseCost: 85000, bookValue: 68000, depreciationRate: 25, depreciationMethod: "WDV", status: "Active", location: "Server Room", custodian: "IT Department" },
    { id: "AST-2026-004", name: "Automatic Packing Line", category: "Plant & Machinery", purchaseDate: "2026-04-12", purchaseCost: 220000, bookValue: 198000, depreciationRate: 10, depreciationMethod: "SLM", status: "Active", location: "Main Warehouse", custodian: "Warehouse Team" },
  ]);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddAsset = (newAsset: Partial<AssetRecord>) => {
    setAssets(p => [newAsset as AssetRecord, ...p]);
  };

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
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Asset Categories</h1><p className="text-sm text-muted-foreground">Group fixed assets by category with depreciation policies.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Category</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat, i) => (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-500/10 rounded-xl"><FolderTree className="size-5 text-indigo-500" /></div>
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">{cat.count} assets</span>
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-1">{cat.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">Depreciation: {cat.depRate}</p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50 text-sm">
                <div><p className="text-muted-foreground text-xs mb-1">Total Cost</p><p className="font-semibold">{fmt(cat.totalCost)}</p></div>
                <div><p className="text-muted-foreground text-xs mb-1">Book Value</p><p className="font-semibold text-emerald-500">{fmt(cat.totalBookValue)}</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "depreciation") {
    const schedule = assets.filter(a => a.status.toLowerCase() === "active").map(a => {
      const annualDep = a.depreciationMethod === "SLM"
        ? Math.round(a.purchaseCost * a.depreciationRate / 100)
        : Math.round(a.bookValue * a.depreciationRate / 100);
      return { ...a, annualDep, monthlyDep: Math.round(annualDep / 12), accumulatedDep: a.purchaseCost - a.bookValue };
    });
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Depreciation Schedule</h1><p className="text-sm text-muted-foreground">Annual and monthly depreciation calculations.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80"><Download className="size-4" /> Export Schedule</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Asset Name</th>
                <th className="px-6 py-4 font-medium">Method</th>
                <th className="px-6 py-4 text-right font-medium">Purchase Cost</th>
                <th className="px-6 py-4 text-right font-medium">Book Value</th>
                <th className="px-6 py-4 text-right font-medium">Accum. Dep.</th>
                <th className="px-6 py-4 text-right font-medium">Annual Dep.</th>
                <th className="px-6 py-4 text-right font-medium">Monthly Dep.</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((asset, i) => (
                <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{asset.name}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-md text-xs">{asset.depreciationMethod}</span></td>
                  <td className="px-6 py-4 text-right">{fmt(asset.purchaseCost)}</td>
                  <td className="px-6 py-4 text-right font-medium text-emerald-500">{fmt(asset.bookValue)}</td>
                  <td className="px-6 py-4 text-right text-red-400">{fmt(asset.accumulatedDep)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-amber-500">{fmt(asset.annualDep)}</td>
                  <td className="px-6 py-4 text-right text-muted-foreground">{fmt(asset.monthlyDep)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Default: Assets list
  const totalCost = assets.reduce((s, a) => s + a.purchaseCost, 0);
  const totalBookValue = assets.reduce((s, a) => s + a.bookValue, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-bold">Fixed Assets</h1>
          <p className="text-sm text-muted-foreground">Capital Asset Register — track value and lifetime depreciation.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{ label: "Total Cost", value: fmt(totalCost), color: "text-blue-500" }, { label: "Book Value", value: fmt(totalBookValue), color: "text-emerald-500" }, { label: "Accum. Depreciation", value: fmt(totalCost - totalBookValue), color: "text-amber-500" }].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-panel p-5 rounded-xl border border-border/50">
            <p className="text-xs font-semibold text-muted-foreground mb-1">{s.label}</p>
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
                <th className="px-6 py-4 text-center font-medium">Method</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset, i) => (
                <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{asset.id}</td>
                  <td className="px-6 py-4 font-medium">{asset.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{asset.category}</td>
                  <td className="px-6 py-4 text-muted-foreground">{asset.purchaseDate}</td>
                  <td className="px-6 py-4 text-right font-semibold text-foreground">{fmt(asset.purchaseCost)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-500">{fmt(asset.bookValue)}</td>
                  <td className="px-6 py-4 text-center"><span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded text-[10px] font-semibold">{asset.depreciationMethod}</span></td>
                  <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle(asset.status)}`}>{asset.status}</span></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AssetFormModal onClose={() => setShowAddModal(false)} onSaved={handleAddAsset} />
        )}
      </AnimatePresence>
    </div>
  );
}
