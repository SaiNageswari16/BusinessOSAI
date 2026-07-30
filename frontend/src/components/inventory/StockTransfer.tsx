import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Trash2, Loader2, X } from "lucide-react";
import { inventoryApi, StockMovement, Warehouse } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function StockTransfer() {
  const [transfers, setTransfers] = useState<StockMovement[]>([]);
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
    status: "In Transit",
  });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [m, w] = await Promise.all([
        inventoryApi.getStockMovements(),
        inventoryApi.getWarehouses().catch(() => []),
      ]);
      // Show only transfers (those with "In Transit" or "Transfer" in status)
      setTransfers(m);
      setWarehouses(w);
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
      toast.error("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setForm({ movement_number: "", product_id: "", source_location: "", destination_location: "", quantity: 0, notes: "", status: "In Transit" });
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
      toast.success("Stock Transfer created");
      setIsModalOpen(false);
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transfer?")) return;
    try {
      await inventoryApi.deleteStockMovement(id);
      toast.success("Deleted");
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = transfers.filter((t) =>
    !search || t.movement_number.toLowerCase().includes(search.toLowerCase()) ||
    t.source_location.toLowerCase().includes(search.toLowerCase()) ||
    t.destination_location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Transfer</h2>
          <p className="text-sm text-muted-foreground">Move inventory between warehouses and store branches.</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Transfer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search transfers..." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-xl">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        {filtered.length === 0 && !loading && (
          <div className="col-span-full text-center text-muted-foreground py-12">No Stock Transfers found. Create one to get started.</div>
        )}
        {filtered.map((tr) => (
          <Card key={tr.id} className="p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="font-bold text-lg text-primary">{tr.movement_number}</div>
                <div className="text-xs text-muted-foreground">{tr.quantity} items</div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                tr.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
              }`}>{tr.status}</span>
            </div>

            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
              <div className="flex-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Source</div>
                <div className="text-sm font-semibold">{tr.source_location}</div>
              </div>
              <div className="bg-background rounded-full p-2 border shadow-sm">
                <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
              <div className="flex-1 text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Destination</div>
                <div className="text-sm font-semibold">{tr.destination_location}</div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="icon" onClick={() => handleDelete(tr.id)} className="h-8 w-8 text-rose-500">
                <Trash2 className="size-4" />
              </Button>
              <Button variant="outline" size="sm">Print DC</Button>
              <Button size="sm">Receive Stock</Button>
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
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-100 z-10">
                <h3 className="text-xl font-bold text-slate-900">New Stock Transfer</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transfer # *</label>
                    <input required type="text" value={form.movement_number} onChange={(e) => setForm({ ...form, movement_number: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="TR-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantity *</label>
                    <input required type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product *</label>
                  <ProductPicker value={form.product_id} onChange={(id) => setForm({ ...form, product_id: id })} placeholder="Select product..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From Warehouse *</label>
                    <select required value={form.source_location} onChange={(e) => setForm({ ...form, source_location: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Select source</option>
                      {warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">To Warehouse *</label>
                    <select required value={form.destination_location} onChange={(e) => setForm({ ...form, destination_location: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="">Select destination</option>
                      {warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    <option value="In Transit">In Transit</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg">
                    {isSubmitting ? "Saving..." : "Create Transfer"}
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
