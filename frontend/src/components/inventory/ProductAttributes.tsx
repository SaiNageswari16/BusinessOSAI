import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, SlidersHorizontal, Edit2, Trash2, X, Tag } from "lucide-react";
import { inventoryApi, ProductAttribute } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const MODULE_PRESETS = ["General", "Apparel", "Electronics", "Grocery", "Furniture", "Footwear", "Beauty", "Automotive"];

export function ProductAttributes() {
  const [data, setData] = useState<ProductAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", module: "General", optionsText: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductAttributes();
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ name: "", module: "General", optionsText: "" });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (attr: ProductAttribute) => {
    setForm({
      name: attr.name,
      module: attr.module,
      optionsText: (attr.options || []).join(", "),
    });
    setEditingId(attr.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const options = form.optionsText.split(",").map(o => o.trim()).filter(Boolean);
      const payload = { name: form.name, module: form.module, options };
      if (editingId) {
        await inventoryApi.updateProductAttribute(editingId, payload);
        toast.success("Attribute updated");
      } else {
        await inventoryApi.createProductAttribute(payload);
        toast.success("Attribute created");
      }
      setIsModalOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this attribute?")) return;
    try {
      await inventoryApi.deleteProductAttribute(id);
      toast.success("Attribute deleted");
      await loadData();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Attributes</h2>
          <p className="text-sm text-muted-foreground">Define master attributes (Color, Size, etc.) used to build product variants.</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Create Attribute
        </Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading attributes...</div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg">
          <SlidersHorizontal className="size-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No attributes yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create attributes like "Color" or "Size" to drive product variants.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((attr) => (
            <Card key={attr.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-600 grid place-items-center shrink-0">
                    <SlidersHorizontal className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg leading-tight truncate">{attr.name}</h3>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded mt-1 inline-block uppercase font-semibold">
                      {attr.module}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEdit(attr)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(attr.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 border">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">
                  Options ({attr.options.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {attr.options.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No options</span>
                  ) : (
                    attr.options.map((opt, i) => (
                      <span key={i} className="text-xs bg-background border px-2.5 py-1 rounded-full font-medium shadow-sm flex items-center gap-1">
                        <Tag className="size-3 text-primary" />
                        {opt}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
                  {editingId ? "Edit Attribute" : "Create Attribute"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attribute Name *</label>
                  <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="e.g. Color, Size, Material" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Module</label>
                  <select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white">
                    {MODULE_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Options (comma-separated)</label>
                  <textarea value={form.optionsText} onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="e.g. Red, Blue, Green, Yellow" />
                  <p className="text-[10px] text-muted-foreground mt-1">Separate each option with a comma.</p>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg">
                    {isSubmitting ? 'Saving...' : (editingId ? 'Update' : 'Create')}
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