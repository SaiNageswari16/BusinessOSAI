import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, FileDown, Trash2, Loader2, X } from "lucide-react";
import { inventoryApi, GoodsIssue } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface IssueItemInput {
  product_id: string;
  quantity_issued: number;
}

export function GoodsIssue() {
  const [issues, setIssues] = useState<GoodsIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({ issue_number: "", recipient: "", reference_number: "", notes: "" });
  const [items, setItems] = useState<IssueItemInput[]>([{ product_id: "", quantity_issued: 0 }]);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getGoodsIssues();
      setIssues(res);
    } catch (error) {
      console.error("Failed to fetch Goods Issues:", error);
      toast.error("Failed to load Goods Issues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const openCreate = () => {
    setForm({ issue_number: "", recipient: "", reference_number: "", notes: "" });
    setItems([{ product_id: "", quantity_issued: 0 }]);
    setIsModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: "", quantity_issued: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof IssueItemInput, value: string | number) => {
    setItems(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.issue_number.trim()) { toast.error("Issue number is required"); return; }
    if (items.some((it) => !it.product_id)) { toast.error("Select a product for each item"); return; }
    setIsSubmitting(true);
    try {
      await inventoryApi.createGoodsIssue({
        issue_number: form.issue_number,
        recipient: form.recipient || undefined,
        reference_number: form.reference_number || undefined,
        notes: form.notes || undefined,
        status: "Completed",
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity_issued: it.quantity_issued || 0,
        })),
      });
      toast.success("Goods Issue created");
      setIsModalOpen(false);
      fetchIssues();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Goods Issue?")) return;
    try {
      await inventoryApi.deleteGoodsIssue(id);
      toast.success("Deleted");
      fetchIssues();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = issues.filter((gi) =>
    !search || gi.issue_number.toLowerCase().includes(search.toLowerCase()) ||
    (gi.recipient || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Goods Issue</h2>
          <p className="text-sm text-muted-foreground">Issue stock from the warehouse for sales, consumption, or transfers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><FileDown className="size-4 mr-2" /> Export</Button>
          <Button onClick={openCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Goods Issue</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search by Issue # or Recipient..." />
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
                <th className="px-6 py-4">Issue #</th>
                <th className="px-6 py-4">Recipient & Ref</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No Goods Issues found.</td></tr>
              )}
              {filtered.map((gi) => (
                <tr key={gi.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-bold">{gi.issue_number}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{gi.recipient || "-"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{gi.reference_number || "-"}</div>
                  </td>
                  <td className="px-6 py-4 font-bold">{gi.items?.length || 0} items</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      gi.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    }`}>{gi.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(gi.id)} className="h-8 w-8 text-rose-500">
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
                <h3 className="text-xl font-bold text-slate-900">New Goods Issue</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Issue # *</label>
                    <input required type="text" value={form.issue_number} onChange={(e) => setForm({ ...form, issue_number: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="GI-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sales Order / Ref #</label>
                    <input type="text" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="SO-1002" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recipient</label>
                  <input type="text" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Recipient name" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Optional notes" />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Items</label>
                    <button type="button" onClick={addItem} className="text-xs font-semibold text-indigo-600">+ Add Item</button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <ProductPicker value={item.product_id} onChange={(id) => updateItem(i, "product_id", id)} placeholder="Select product..." />
                        </div>
                        <div className="w-20">
                          <input type="number" min={0} value={item.quantity_issued}
                            onChange={(e) => updateItem(i, "quantity_issued", parseInt(e.target.value) || 0)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Qty" />
                        </div>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(i)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg">
                    {isSubmitting ? "Creating..." : "Create Issue"}
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
