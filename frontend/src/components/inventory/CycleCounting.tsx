import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Trash2, Loader2, X, RotateCw } from "lucide-react";
import { inventoryApi, CycleCount } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface CycleItemInput {
  product_id: string;
  system_quantity: number;
  counted_quantity: number;
  variance: number;
}

export function CycleCounting() {
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({ count_number: "", location: "", auditor: "", status: "In Progress", notes: "" });
  const [items, setItems] = useState<CycleItemInput[]>([{ product_id: "", system_quantity: 0, counted_quantity: 0, variance: 0 }]);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getCycleCounts();
      setCounts(res);
    } catch (error) {
      console.error("Failed to fetch Cycle Counts:", error);
      toast.error("Failed to load cycle counts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCounts(); }, []);

  const openCreate = () => {
    setForm({ count_number: "", location: "", auditor: "", status: "In Progress", notes: "" });
    setItems([{ product_id: "", system_quantity: 0, counted_quantity: 0, variance: 0 }]);
    setIsModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: "", system_quantity: 0, counted_quantity: 0, variance: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof CycleItemInput, value: string | number) => {
    setItems(items.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, [field]: value };
      if (field === "counted_quantity" && it.system_quantity !== undefined) {
        next.variance = (typeof value === "number" ? value : parseInt(String(value)) || 0) - it.system_quantity;
      }
      if (field === "system_quantity" && it.counted_quantity !== undefined) {
        next.variance = it.counted_quantity - (typeof value === "number" ? value : parseInt(String(value)) || 0);
      }
      return next;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.count_number) { toast.error("Count number is required"); return; }
    setIsSubmitting(true);
    try {
      await inventoryApi.createCycleCount({
        count_number: form.count_number,
        location: form.location || undefined,
        auditor: form.auditor || undefined,
        notes: form.notes || undefined,
        status: form.status,
        items: items.filter((it) => it.product_id).map((it) => ({
          product_id: it.product_id,
          system_quantity: it.system_quantity || 0,
          counted_quantity: it.counted_quantity || 0,
          variance: it.variance || 0,
        })),
      });
      toast.success("Cycle Count created");
      setIsModalOpen(false);
      fetchCounts();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cycle count?")) return;
    try {
      await inventoryApi.deleteCycleCount(id);
      toast.success("Deleted");
      fetchCounts();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = counts.filter((c) =>
    !search || c.count_number.toLowerCase().includes(search.toLowerCase()) || (c.location || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cycle Counting</h2>
          <p className="text-sm text-muted-foreground">Automate perpetual inventory counting schedules.</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Schedule</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search count schedules..." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        {filtered.length === 0 && !loading && (
          <div className="col-span-full text-center text-muted-foreground py-12">No cycle count schedules found.</div>
        )}
        {filtered.map((cycle) => (
          <Card key={cycle.id} className="p-6 border-t-4 border-t-primary">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <RotateCw className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold">{cycle.count_number}</h3>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">{cycle.location || "All Locations"}</div>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                cycle.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
              }`}>{cycle.status}</span>
            </div>

            <div className="bg-muted/40 p-3 rounded-lg border border-dashed mb-4 flex justify-between items-center">
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Auditor</div>
                <div className="text-sm font-bold mt-1">{cycle.auditor || "Unassigned"}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground font-semibold">Items</div>
                <div className="text-sm font-bold mt-1">{cycle.items?.length || 0}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-[10px] text-muted-foreground">
                {cycle.notes ? cycle.notes.slice(0, 60) + (cycle.notes.length > 60 ? "..." : "") : ""}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">Manage</Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(cycle.id)} className="h-8 w-8 text-rose-500">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-100 z-10">
                <h3 className="text-xl font-bold text-slate-900">New Cycle Count</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Count # *</label>
                    <input required type="text" value={form.count_number} onChange={(e) => setForm({ ...form, count_number: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="CC-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Auditor</label>
                    <input type="text" value={form.auditor} onChange={(e) => setForm({ ...form, auditor: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Auditor name" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                  <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Warehouse or zone" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Count Items</label>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="grid grid-cols-4 gap-2">
                        <input type="text" value={item.product_id} onChange={(e) => updateItem(i, "product_id", e.target.value)}
                          placeholder="Product ID" className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none col-span-2" />
                        <input type="number" value={item.system_quantity} onChange={(e) => updateItem(i, "system_quantity", parseInt(e.target.value) || 0)}
                          placeholder="System Qty" className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
                        <input type="number" value={item.counted_quantity} onChange={(e) => updateItem(i, "counted_quantity", parseInt(e.target.value) || 0)}
                          placeholder="Counted Qty" className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
                      </div>
                    ))}
                    <button type="button" onClick={addItem} className="text-xs font-semibold text-indigo-600">+ Add item row</button>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg">
                    {isSubmitting ? "Saving..." : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
