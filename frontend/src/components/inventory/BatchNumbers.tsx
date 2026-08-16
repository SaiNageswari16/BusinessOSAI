import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Search, Filter, Hash, Edit2, Trash2, X, Loader2,
  Package, CalendarClock, Plus, AlertTriangle, Boxes, FlaskConical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type InventoryBatch, type Warehouse, type InventoryProduct as Product } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

const STATUS_OPTS = ["Active", "Quarantined", "Expired", "Consumed"];

function isExpired(b: InventoryBatch): boolean {
  if (!b.expiry_date) return false;
  return new Date(b.expiry_date) < new Date();
}

function statusBadgeClass(b: InventoryBatch): string {
  if (isExpired(b)) return "bg-rose-500/10 text-rose-600";
  if (b.status === "Quarantined") return "bg-amber-500/10 text-amber-600";
  if (b.status === "Consumed") return "bg-slate-500/10 text-slate-600";
  if (b.status === "Active") return "bg-emerald-500/10 text-emerald-600";
  return "bg-slate-500/10 text-slate-500";
}

function BatchModal({
  batch, warehouses, products, onClose, onSave, saving,
}: {
  batch: Partial<InventoryBatch> | null;
  warehouses: Warehouse[];
  products: Product[];
  onClose: () => void;
  onSave: (b: Partial<InventoryBatch>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<InventoryBatch>>(batch || {
    batch_number: "",
    product_name: "",
    sku: "",
    warehouse_name: "",
    supplier: "",
    quantity: 0,
    remaining_quantity: 0,
    manufacturing_date: null,
    expiry_date: null,
    notes: "",
    status: "Active",
  });
  const isEditing = !!batch?.id;
  const set = (k: keyof InventoryBatch, v: any) => setForm(p => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batch_number) return alert("Batch number is required");
    onSave(form);
  };

  const onSelectProduct = (productId: string) => {
    const p = products.find(x => x.id === productId);
    if (p) {
      setForm(f => ({ ...f, product_id: productId, product_name: p.name, sku: (p as any).sku ?? f.sku }));
    } else {
      set("product_id", productId || null);
    }
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
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-xl font-bold text-slate-900">{isEditing ? "Edit" : "New"} Batch</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form id="batch-form" onSubmit={submit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Batch Number *</label>
              <input required type="text" value={form.batch_number || ""} onChange={e => set("batch_number", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="BATCH-2026-001" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product</label>
              <select value={form.product_id || ""} onChange={e => onSelectProduct(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">— Free-form —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product Name (display)</label>
              <input type="text" value={form.product_name || ""} onChange={e => set("product_name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SKU</label>
              <input type="text" value={form.sku || ""} onChange={e => set("sku", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Supplier</label>
              <input type="text" value={form.supplier || ""} onChange={e => set("supplier", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantity</label>
              <input type="number" min={0} value={form.quantity ?? 0} onChange={e => set("quantity", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remaining Quantity</label>
              <input type="number" min={0} value={form.remaining_quantity ?? 0} onChange={e => set("remaining_quantity", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
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

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
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
          <button type="submit" form="batch-form" disabled={saving}
            className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? "Update" : "Create"} Batch
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function BatchNumbers({ onSelectForTrace }: { onSelectForTrace?: (id: string) => void }) {
    const { currency, formatCurrency } = useCurrency();
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InventoryBatch> | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [b, w, p] = await Promise.all([
        inventoryApi.getBatches(),
        inventoryApi.getWarehouses(),
        inventoryApi.getProducts({ page_size: 200 }),
      ]);
      setBatches(b);
      setWarehouses(w);
      setProducts(p.items ?? []);
    } catch (e: any) {
      setError(e?.detail ?? "Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter(b => {
      if (statusFilter === "Expired" ? !isExpired(b) : b.status !== statusFilter) {
        if (statusFilter) return false;
      }
      if (!q) return true;
      return b.batch_number.toLowerCase().includes(q)
        || (b.product_name || "").toLowerCase().includes(q)
        || (b.warehouse_name || "").toLowerCase().includes(q)
        || (b.sku || "").toLowerCase().includes(q);
    });
  }, [batches, search, statusFilter]);

  const stats = useMemo(() => ({
    total: batches.length,
    active: batches.filter(b => b.status === "Active" && !isExpired(b)).length,
    expiringSoon: batches.filter(b => {
      if (!b.expiry_date) return false;
      const days = (new Date(b.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    }).length,
    expired: batches.filter(isExpired).length,
    totalQty: batches.reduce((s, b) => s + b.quantity, 0),
  }), [batches]);

  const handleSave = async (b: Partial<InventoryBatch>) => {
    try {
      setSaving(true);
      if (b.id) {
        const updated = await inventoryApi.updateBatch(b.id, b);
        setBatches(prev => prev.map(x => x.id === b.id ? updated : x));
      } else {
        const created = await inventoryApi.createBatch(b as Record<string, unknown>);
        setBatches(prev => [created, ...prev]);
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
    if (!confirm("Delete this batch? Linked traceability events will be removed.")) return;
    try {
      await inventoryApi.deleteBatch(id);
      setBatches(prev => prev.filter(b => b.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e?.detail ?? e?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Batch Numbers</h2>
          <p className="text-sm text-muted-foreground">Track inventory lots, manufacturing runs, and expiry cohorts.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> New Batch
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button onClick={load} className="ml-3 underline">Retry</button>
        </div>
      )}

      {!loading && batches.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Boxes className="size-3" /> Total</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><FlaskConical className="size-3" /> Active</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><CalendarClock className="size-3" /> Expiring ≤30d</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.expiringSoon}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><AlertTriangle className="size-3" /> Expired</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">{stats.expired}</div>
          </Card>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search batch, product, SKU..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-3 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30">
          <option value="">All Status</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="Expired">Auto-Expired</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <Package className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No batches {search || statusFilter ? "match this filter" : "yet"}</h3>
          <p className="text-muted-foreground mb-4">Create a batch to track inventory lots, manufacturing runs, and expiry cohorts.</p>
          <Button onClick={() => setModalOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-2" /> Create First Batch
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Batch Number</th>
                <th className="px-6 py-4">Mfg Date</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Warehouse</th>
                <th className="px-6 py-4 text-right">Qty / Remaining</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(batch => (
                <tr key={batch.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-bold">{batch.product_name || "—"}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => onSelectForTrace?.(batch.id)}
                      className="font-mono font-bold text-primary hover:underline flex items-center gap-2">
                      <Hash className="size-4" /> {batch.batch_number}
                    </button>
                    {batch.sku && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">SKU {batch.sku}</div>}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium">{batch.manufacturing_date || "—"}</td>
                  <td className="px-6 py-4 text-xs font-semibold flex items-center gap-1 mt-0.5">
                    {batch.expiry_date ? <>
                      <CalendarClock className={`size-3 ${isExpired(batch) ? "text-rose-500" : "text-amber-500"}`} /> {batch.expiry_date}
                    </> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium">{batch.warehouse_name || "—"}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold">
                    {batch.quantity}
                    {batch.remaining_quantity !== batch.quantity && (
                      <span className="text-muted-foreground font-normal text-xs"> / {batch.remaining_quantity}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(batch)}`}>
                      {isExpired(batch) && !batch.status.startsWith("Expired") ? "Expired" : batch.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onSelectForTrace?.(batch.id)}
                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 inline-flex items-center justify-center transition"
                        title="View Traceability">
                        <FlaskConical className="size-4" />
                      </button>
                      <button onClick={() => { setEditing(batch); setModalOpen(true); }}
                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                        title="Edit">
                        <Edit2 className="size-4" />
                      </button>
                      <button onClick={() => handleDelete(batch.id)}
                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 inline-flex items-center justify-center transition"
                        title="Delete">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <AnimatePresence>
        {modalOpen && (
          <BatchModal batch={editing} warehouses={warehouses} products={products}
            onClose={() => { setModalOpen(false); setEditing(null); }}
            onSave={handleSave} saving={saving} />
        )}
      </AnimatePresence>
    </div>
  );
}
