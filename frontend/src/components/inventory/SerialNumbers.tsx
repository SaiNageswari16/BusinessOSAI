import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Search, Barcode, Edit2, Trash2, X, Loader2, Plus,
  Package, AlertTriangle, ShieldCheck, RotateCcw, Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type InventorySerial, type Warehouse } from "../../lib/api-client";

const STATUS_STYLES: Record<string, string> = {
  "In Stock":     "bg-emerald-500/10 text-emerald-600",
  "Reserved":     "bg-indigo-500/10 text-indigo-600",
  "Sold":         "bg-blue-500/10 text-blue-600",
  "In Transit":   "bg-amber-500/10 text-amber-600",
  "Returned":     "bg-violet-500/10 text-violet-600",
  "Damaged":      "bg-rose-500/10 text-rose-600",
  "Written-off":  "bg-slate-500/10 text-slate-600",
};

const STATUS_OPTS = Object.keys(STATUS_STYLES);

const STATUS_ICONS: Record<string, any> = {
  "In Stock": Package, "Reserved": ShieldCheck, "Sold": Package,
  "In Transit": AlertTriangle, "Returned": RotateCcw, "Damaged": Wrench, "Written-off": Trash2,
};

function SerialModal({
  serial, warehouses, onClose, onSave, saving,
}: {
  serial: Partial<InventorySerial> | null;
  warehouses: Warehouse[];
  onClose: () => void;
  onSave: (s: Partial<InventorySerial>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<InventorySerial>>(serial || {
    serial_number: "", product_name: "", warehouse_name: "",
    manufacturing_date: null, expiry_date: null, notes: "", status: "In Stock",
  });
  const isEditing = !!serial?.id;
  const set = (k: keyof InventorySerial, v: any) => setForm(p => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serial_number) return alert("Serial number is required");
    onSave(form);
  };

  const onSelectWarehouse = (warehouseId: string) => {
    const w = warehouses.find(x => x.id === warehouseId);
    setForm(f => ({ ...f, warehouse_id: warehouseId || null, warehouse_name: w?.name || f.warehouse_name }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-xl font-bold text-slate-900">{isEditing ? "Edit" : "New"} Serial Number</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form id="serial-form" onSubmit={submit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Serial Number *</label>
              <input required type="text" value={form.serial_number || ""} onChange={e => set("serial_number", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="SN-2026-0001" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product Name</label>
              <input type="text" value={form.product_name || ""} onChange={e => set("product_name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Warehouse</label>
              <select value={form.warehouse_id || ""} onChange={e => onSelectWarehouse(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">— Select —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Manufacturing Date</label>
              <input type="date" value={form.manufacturing_date || ""} onChange={e => set("manufacturing_date", e.target.value || null)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expiry Date</label>
              <input type="date" value={form.expiry_date || ""} onChange={e => set("expiry_date", e.target.value || null)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
              <textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="serial-form" disabled={saving}
            className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? "Update" : "Create"} Serial
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function SerialNumbers() {
  const [serials, setSerials] = useState<InventorySerial[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InventorySerial> | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, w] = await Promise.all([
        inventoryApi.getSerials(),
        inventoryApi.getWarehouses(),
      ]);
      setSerials(s);
      setWarehouses(w);
    } catch (e: any) {
      setError(e?.detail ?? "Failed to load serials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return serials.filter(s => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return s.serial_number.toLowerCase().includes(q)
        || (s.product_name || "").toLowerCase().includes(q)
        || (s.warehouse_name || "").toLowerCase().includes(q);
    });
  }, [serials, search, statusFilter]);

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    serials.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
    return {
      total: serials.length,
      inStock: byStatus["In Stock"] || 0,
      sold: byStatus["Sold"] || 0,
      transit: byStatus["In Transit"] || 0,
    };
  }, [serials]);

  const handleSave = async (s: Partial<InventorySerial>) => {
    try {
      setSaving(true);
      if (s.id) {
        const updated = await inventoryApi.updateSerial(s.id, s);
        setSerials(prev => prev.map(x => x.id === s.id ? updated : x));
      } else {
        const created = await inventoryApi.createSerial(s as Record<string, unknown>);
        setSerials(prev => [created, ...prev]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: any) {
      alert(`Save failed: ${e?.detail ?? e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this serial number?")) return;
    try {
      await inventoryApi.deleteSerial(id);
      setSerials(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e?.detail ?? e?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Serial Numbers</h2>
          <p className="text-sm text-muted-foreground">Trace individual high-value items for warranty and compliance.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> New Serial
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button onClick={load} className="ml-3 underline">Retry</button>
        </div>
      )}

      {!loading && serials.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Serials</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">In Stock</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.inStock}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Sold</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.sold}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">In Transit</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.transit}</div>
          </Card>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search serial number, product, warehouse..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30">
          <option value="">All Status</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <Barcode className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No serial numbers {search || statusFilter ? "match this filter" : "yet"}</h3>
          <p className="text-muted-foreground mb-4">Register serial numbers for individual high-value items.</p>
          <Button onClick={() => setModalOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-2" /> Create First Serial
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Batch Number</th>
                <th className="px-6 py-4">Serial Number</th>
                <th className="px-6 py-4">Mfg Date</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Warehouse</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(serial => {
                const Icon = STATUS_ICONS[serial.status] || Package;
                return (
                  <tr key={serial.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-bold">{serial.product_name || "—"}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">—</td>
                    <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2">
                      <Barcode className="size-4" /> {serial.serial_number}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">{serial.manufacturing_date || "—"}</td>
                    <td className="px-6 py-4 text-xs font-medium">{serial.expiry_date || "—"}</td>
                    <td className="px-6 py-4 text-xs font-medium">{serial.warehouse_name || "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[serial.status] || "bg-slate-100 text-slate-600"}`}>
                        <Icon className="size-3" /> {serial.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(serial); setModalOpen(true); }}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                          title="Edit">
                          <Edit2 className="size-4" />
                        </button>
                        <button onClick={() => handleDelete(serial.id)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 inline-flex items-center justify-center transition"
                          title="Delete">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <AnimatePresence>
        {modalOpen && (
          <SerialModal serial={editing} warehouses={warehouses}
            onClose={() => { setModalOpen(false); setEditing(null); }}
            onSave={handleSave} saving={saving} />
        )}
      </AnimatePresence>
    </div>
  );
}
