import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Trash2, Loader2, X, ClipboardCheck } from "lucide-react";
import { inventoryApi, CycleCount, Warehouse } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface AuditItemInput {
  product_id: string;
  system_quantity: number;
  counted_quantity: number;
  variance: number;
}

export function PhysicalStockAudit() {
    const { currency, formatCurrency } = useCurrency();
  const [audits, setAudits] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({ count_number: "", location: "", auditor: "", status: "In Progress", notes: "" });
  const [items, setItems] = useState<AuditItemInput[]>([{ product_id: "", system_quantity: 0, counted_quantity: 0, variance: 0 }]);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getCycleCounts();
      setAudits(res);
    } catch (error) {
      console.error("Failed to fetch Audits:", error);
      toast.error("Failed to load audits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudits(); }, []);

  const openCreate = () => {
    setForm({ count_number: "", location: "", auditor: "", status: "In Progress", notes: "Full Physical Audit" });
    setItems([{ product_id: "", system_quantity: 0, counted_quantity: 0, variance: 0 }]);
    setIsModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: "", system_quantity: 0, counted_quantity: 0, variance: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof AuditItemInput, value: string | number) => {
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
    if (!form.count_number) { toast.error("Audit reference is required"); return; }
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
      toast.success("Audit scheduled");
      setIsModalOpen(false);
      fetchAudits();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Cancel this audit?")) return;
    try {
      await inventoryApi.deleteCycleCount(id);
      toast.success("Cancelled");
      fetchAudits();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = audits.filter((a) =>
    !search || a.count_number.toLowerCase().includes(search.toLowerCase()) || (a.location || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Physical Stock Audit</h2>
          <p className="text-sm text-muted-foreground">Manage wall-to-wall physical inventory counts and variance.</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Schedule Audit</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search audits..." />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto min-h-[300px] relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          )}
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold sticky top-0">
              <tr>
                <th className="px-6 py-4">Audit Reference</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Auditor</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No Audits Scheduled.</td></tr>
              )}
              {filtered.map((audit) => (
                <tr key={audit.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold">Physical Audit</div>
                    <div className="font-mono text-xs text-primary font-medium">{audit.count_number}</div>
                  </td>
                  <td className="px-6 py-4 font-medium">{audit.location || "All"}</td>
                  <td className="px-6 py-4">{audit.auditor || "-"}</td>
                  <td className="px-6 py-4">{audit.items?.length || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      audit.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                    }`}>{audit.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    {audit.status === "Completed" ? (
                      <Button variant="ghost" size="sm" className="text-emerald-500">Report</Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-primary">Start Count</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(audit.id)} className="h-8 w-8 text-rose-500">
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
                <h3 className="text-xl font-bold text-slate-900">Schedule Physical Audit</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Audit Reference *</label>
                    <input required type="text" value={form.count_number} onChange={(e) => setForm({ ...form, count_number: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500" placeholder="AUD-2026-Q4" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lead Auditor</label>
                    <input type="text" value={form.auditor} onChange={(e) => setForm({ ...form, auditor: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500" placeholder="Lead auditor name" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                  <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. Mumbai Central Hub" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Audit Items</label>
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
                    <button type="button" onClick={addItem} className="text-xs font-semibold text-purple-600">+ Add item row</button>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg">
                    {isSubmitting ? "Saving..." : "Schedule Audit"}
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
