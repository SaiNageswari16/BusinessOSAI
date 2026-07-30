import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, History, Trash2, Loader2, ArrowRightLeft, X } from "lucide-react";
import { inventoryApi, Warehouse, StockMovement as StockMovementType } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function StockMovement() {
  const [movements, setMovements] = useState<StockMovementType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    movement_number: "",
    product_id: "",
    source_location: "",
    destination_location: "",
    quantity: 0,
    notes: "",
    status: "Completed",
  });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [m, w] = await Promise.all([
        inventoryApi.getStockMovements(),
        inventoryApi.getWarehouses().catch(() => []),
      ]);
      setMovements(m);
      setWarehouses(w);
    } catch (error) {
      console.error("Failed to fetch stock movements:", error);
      toast.error("Failed to load Stock Movements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setForm({ movement_number: "", product_id: "", source_location: "", destination_location: "", quantity: 0, notes: "", status: "Completed" });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.movement_number || !form.product_id || !form.source_location || !form.destination_location) {
      toast.error("Fill all required fields"); return;
    }
    setIsSubmitting(true);
    try {
      await inventoryApi.createStockMovement({
        movement_number: form.movement_number,
        product_id: form.product_id,
        source_location: form.source_location,
        destination_location: form.destination_location,
        quantity: form.quantity,
        notes: form.notes || undefined,
        status: form.status,
      });
      toast.success("Stock Movement recorded");
      setIsModalOpen(false);
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this movement?")) return;
    try {
      await inventoryApi.deleteStockMovement(id);
      toast.success("Deleted");
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = movements.filter((m) =>
    !search || m.movement_number.toLowerCase().includes(search.toLowerCase()) ||
    m.source_location.toLowerCase().includes(search.toLowerCase()) ||
    m.destination_location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Movement</h2>
          <p className="text-sm text-muted-foreground">Comprehensive timeline of all inventory transactions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><History className="size-4 mr-2" /> Export Ledger</Button>
          <Button onClick={openCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Movement</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search by movement # or location..." />
      </div>

      <Card className="p-0 overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Movement #</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">From / To</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No Stock Movements found.</td></tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold">{m.movement_number}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 bg-blue-500/10 w-fit px-2 py-1 rounded text-blue-600 font-semibold text-xs">
                      <ArrowRightLeft className="size-3" /> Transfer
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="font-mono font-bold text-base text-emerald-500">{m.quantity}</span></td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                    {m.source_location} &rarr; {m.destination_location}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} className="h-8 w-8 text-rose-500">
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-100 z-10">
                <h3 className="text-xl font-bold text-slate-900">New Stock Movement</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Movement # *</label>
                    <input required type="text" value={form.movement_number} onChange={(e) => setForm({ ...form, movement_number: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="MOV-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantity *</label>
                    <input required type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product *</label>
                  <ProductPicker value={form.product_id} onChange={(id) => setForm({ ...form, product_id: id })} placeholder="Select product..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Source Warehouse *</label>
                    <select required value={form.source_location} onChange={(e) => setForm({ ...form, source_location: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="">Select source</option>
                      {warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Destination Warehouse *</label>
                    <select required value={form.destination_location} onChange={(e) => setForm({ ...form, destination_location: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="">Select destination</option>
                      {warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    <option value="In Transit">In Transit</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
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
