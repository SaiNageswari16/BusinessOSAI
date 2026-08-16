import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, FolderTree, X, Save, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { fixedAssetsApi, FixedAsset, FixedAssetCategory, downloadCsv } from "@/lib/api-client";
import { fmt, statusStyle } from "@/components/accounting/utils";
import { useCurrency } from "@/hooks/use-currency";

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

function mapBackendAsset(a: FixedAsset): AssetRecord {
  const depRate = a.useful_life_years ? Math.round((1 / a.useful_life_years) * 100) : 10;
  return {
    id: a.asset_number || a.id.slice(0, 12),
    name: a.name,
    category: "General",
    purchaseDate: a.purchase_date,
    purchaseCost: a.purchase_cost,
    bookValue: a.book_value,
    depreciationRate: depRate,
    depreciationMethod: a.depreciation_method,
    status: a.status,
    location: a.location || "—",
    custodian: "—",
  };
}

// ─── Modal: Add Asset ────────────────────────────────────────────────────
function AssetFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (asset: Partial<AssetRecord>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchase_cost: 0,
    useful_life_years: 5,
    depreciation_method: "SLM",
    location: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await fixedAssetsApi.createAsset({
        name: form.name,
        purchase_date: form.purchaseDate,
        purchase_cost: form.purchase_cost,
        useful_life_years: form.useful_life_years,
        depreciation_method: form.depreciation_method,
        location: form.location || "Main Office",
        status: "active",
      });
      toast.success("Fixed Asset created successfully!");
      onSaved({ ...mapBackendAsset(created), id: created.asset_number || created.id.slice(0, 12) });
      onClose();
    } catch {
      toast.error("Failed to create asset");
    } finally {
      setSaving(false);
    }
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
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Purchase Date *</label>
              <input type="date" value={form.purchaseDate} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Purchase Cost *</label>
              <input type="number" step="any" value={form.purchase_cost} onChange={e => setForm(p => ({ ...p, purchase_cost: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Useful Life (years)</label>
              <input type="number" value={form.useful_life_years} onChange={e => setForm(p => ({ ...p, useful_life_years: parseInt(e.target.value) || 5 }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Dep. Method *</label>
              <select value={form.depreciation_method} onChange={e => setForm(p => ({ ...p, depreciation_method: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="SLM">Straight Line (SLM)</option>
                <option value="WDV">Written Down Value (WDV)</option>
                <option value="Units">Units of Production</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Location</label>
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Main Office" />
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

// ─── Modal: Add Category ─────────────────────────────────────────────────
function CategoryFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", useful_life_years: 5, depreciation_method: "straight_line", salvage_value_percent: 10 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fixedAssetsApi.createCategory({ ...form, status: "active" });
      toast.success("Category created!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">Add Asset Category</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Category Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="IT Equipment" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Category description…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Useful Life (years)</label>
              <input type="number" value={form.useful_life_years} onChange={e => setForm(p => ({ ...p, useful_life_years: parseInt(e.target.value) || 5 }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Depreciation Method</label>
              <select value={form.depreciation_method} onChange={e => setForm(p => ({ ...p, depreciation_method: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Salvage Value (%)</label>
              <input type="number" value={form.salvage_value_percent} onChange={e => setForm(p => ({ ...p, salvage_value_percent: parseFloat(e.target.value) || 0 }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Category
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main FixedAssets Component ───────────────────────────────────────────
export function FixedAssets({ tab = "fixed_assets" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [categories, setCategories] = useState<FixedAssetCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [catLoading, setCatLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [search, setSearch] = useState("");

  const loadAssets = async () => {
    setLoading(true);
    try {
      const res = await fixedAssetsApi.listAssets({ page_size: 100, search });
      const mapped = (res.items || []).map(mapBackendAsset);
      setAssets(mapped);
    } catch {
      toast.error("Failed to load fixed assets");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    setCatLoading(true);
    try {
      const data = await fixedAssetsApi.listCategories();
      setCategories(data);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setCatLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "fixed_assets" || tab === "asset_register") loadAssets();
    if (tab === "asset_categories") loadCategories();
  }, [tab, search]);

  const handleAddAsset = (newAsset: Partial<AssetRecord>) => {
    setAssets(p => [newAsset as AssetRecord, ...p]);
  };

  // ─── Asset Categories ───────────────────────────────────────────────────
  if (tab === "asset_categories") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Asset Categories</h1>
            <p className="text-sm text-muted-foreground">Group fixed assets by category with depreciation policies.</p>
          </div>
          <button onClick={() => setShowCatModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Category
          </button>
        </div>
        {catLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading categories…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.length === 0 ? (
              <div className="col-span-2 text-center text-muted-foreground py-12">No categories yet. Create one to get started.</div>
            ) : categories.map((cat, i) => (
              <motion.div key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-500/10 rounded-xl"><FolderTree className="size-5 text-indigo-500" /></div>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">{cat.status}</span>
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-1">{cat.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{cat.description || "No description"}</p>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50 text-sm">
                  <div><p className="text-muted-foreground text-xs mb-1">Depreciation</p><p className="font-semibold">{cat.depreciation_method.replace(/_/g, " ")}</p></div>
                  <div><p className="text-muted-foreground text-xs mb-1">Salvage %</p><p className="font-semibold">{cat.salvage_value_percent}%</p></div>
                  <div><p className="text-muted-foreground text-xs mb-1">Useful Life</p><p className="font-semibold">{cat.useful_life_years} years</p></div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        <AnimatePresence>
          {showCatModal && <CategoryFormModal onClose={() => setShowCatModal(false)} onSaved={loadCategories} />}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Depreciation ───────────────────────────────────────────────────────
  if (tab === "depreciation") {
    const schedule = assets.filter(a => a.status.toLowerCase() === "active").map(a => {
      const annualDep = a.depreciationMethod === "SLM"
        ? Math.round(a.purchaseCost * a.depreciationRate / 100)
        : Math.round(a.bookValue * a.depreciationRate / 100);
      return { ...a, annualDep, monthlyDep: Math.round(annualDep / 12), accumulatedDep: a.purchaseCost - a.bookValue };
    });

    const handleExport = () => {
      const rows = schedule.map(a => [a.name, a.depreciationMethod, a.purchaseCost, a.bookValue, a.accumulatedDep, a.annualDep, a.monthlyDep]);
      downloadCsv("depreciation_schedule.csv", ["Asset Name", "Method", "Purchase Cost", "Book Value", "Accum. Dep.", "Annual Dep.", "Monthly Dep."], rows);
      toast.success("Schedule exported");
    };

    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Depreciation Schedule</h1>
            <p className="text-sm text-muted-foreground">Annual and monthly depreciation calculations.</p>
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80"><Download className="size-4" /> Export Schedule</button>
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

  // ─── Asset Register ─────────────────────────────────────────────────────
  if (tab === "asset_register") {
    const total = useMemo(() => assets.reduce((s, a) => ({ cost: s.cost + a.purchaseCost, bv: s.bv + a.bookValue }), { cost: 0, bv: 0 }), [assets]);

    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Asset Register</h1>
          <p className="text-sm text-muted-foreground">Complete register of all capital assets with current book values.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Assets", value: assets.length, color: "text-blue-500" },
            { label: "Total Cost", value: fmt(total.cost), color: "text-blue-500" },
            { label: "Total Book Value", value: fmt(total.bv), color: "text-emerald-500" },
          ].map((s, i) => (
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
                  <th className="px-6 py-4 font-medium">Asset #</th>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 text-right font-medium">Cost</th>
                  <th className="px-6 py-4 text-right font-medium">Accum. Dep.</th>
                  <th className="px-6 py-4 text-right font-medium">Book Value</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : assets.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No assets found.</td></tr>
                ) : assets.map((asset, i) => (
                  <motion.tr key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{asset.id}</td>
                    <td className="px-6 py-4 font-medium">{asset.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{asset.location}</td>
                    <td className="px-6 py-4 text-right font-semibold">{fmt(asset.purchaseCost)}</td>
                    <td className="px-6 py-4 text-right text-red-400">{fmt(asset.purchaseCost - asset.bookValue)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-500">{fmt(asset.bookValue)}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle(asset.status)}`}>{asset.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: Assets list
  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading assets…</div>;
  }

  const totalCost = assets.reduce((s, a) => s + a.purchaseCost, 0);
  const totalBookValue = assets.reduce((s, a) => s + a.bookValue, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fixed Assets</h1>
          <p className="text-sm text-muted-foreground">Capital Asset Register — track value and lifetime depreciation.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…"
              className="pl-9 pr-3 h-9 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 w-56" />
          </div>
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
