import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Trash2, Loader2, X, Sliders } from "lucide-react";
import { inventoryApi, StockAdjustment, Warehouse } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function StockAdjustment() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    adjustment_number: "",
    product_id: "",
    adjustment_type: "Write-Off",
    quantity_changed: 0,
    reason: "",
    status: "Completed",
  });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getStockAdjustments();
      setAdjustments(res);
    } catch (error) {
      console.error("Failed to fetch Stock Adjustments:", error);
      toast.error("Failed to load adjustments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setForm({ adjustment_number: "", product_id: "", adjustment_type: "Write-Off", quantity_changed: 0, reason: "", status: "Completed" });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.adjustment_number || !form.product_id) { toast.error("Fill required fields"); return; }
    setIsSubmitting(true);
    try {
      await inventoryApi.createStockAdjustment({
        adjustment_number: form.adjustment_number,
        product_id: form.product_id,
        adjustment_type: form.adjustment_type,
        quantity_changed: form.quantity_changed,
        reason: form.reason || undefined,
        status: form.status,
      });
      toast.success("Adjustment recorded");
      setIsModalOpen(false);
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this adjustment?")) return;
    try {
      await inventoryApi.deleteStockAdjustment(id);
      toast.success("Deleted");
      fetchAll();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = adjustments.filter((a) =>
    !search || a.adjustment_number.toLowerCase().includes(search.toLowerCase()) || a.adjustment_type.toLowerCase().includes(search.toLowerCase())
  );

  const qtyColor = (q: number) => q < 0 ? "text-rose-500" : "text-emerald-500";
  const qtyPrefix = (q: number) => q < 0 ? "" : "+";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Adjustment</h2>
          <p className="text-sm text-muted-foreground">Adjust inventory levels due to damage, loss, or auditing.</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Adjustment</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search adjustments..." />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto min-h-[300px] relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          )}
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold sticky top-0">
              <tr>
                <th className="px-6 py-4">Ref #</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Qty Change</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No Stock Adjustments found.</td></tr>
              )}
              {filtered.map((adj) => (
                <tr key={adj.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold">{adj.adjustment_number}</td>
                  <td className="px-6 py-4">
                    <span className="bg-muted px-2 py-1 rounded text-xs font-semibold">{adj.adjustment_type}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono">...</td>
                  <td className={`px-6 py-4 font-mono font-bold ${qtyColor(adj.quantity_changed)}`}>
                    {qtyPrefix(adj.quantity_changed)}{adj.quantity_changed}
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground max-w-[200px] truncate">{adj.reason || "-"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      adj.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    }`}>{adj.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(adj.id)} className="h-8 w-8 text-rose-500">
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
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-100 z-10">
                <h3 className="text-xl font-bold text-slate-900">New Stock Adjustment</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adjustment # *</label>
                    <input required type="text" value={form.adjustment_number} onChange={(e) => setForm({ ...form, adjustment_number: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ADJ-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type *</label>
                    <select value={form.adjustment_type} onChange={(e) => setForm({ ...form, adjustment_type: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="Write-Off">Write-Off (Damage/Loss)</option>
                      <option value="Found">Found (Unexpected Gain)</option>
                      <option value="Expiry">Expiry</option>
                      <option value="Correction">Correction</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product *</label>
                  <ProductPicker value={form.product_id} onChange={(id) => setForm({ ...form, product_id: id })} placeholder="Select product..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Qty Change (use -ve for reduction)</label>
                    <input required type="number" value={form.quantity_changed} onChange={(e) => setForm({ ...form, quantity_changed: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="Completed">Completed</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reason</label>
                  <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Why is this adjustment needed?" />
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
