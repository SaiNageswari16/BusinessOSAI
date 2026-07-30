import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Wrench, Edit2, Trash2, X, Package } from "lucide-react";
import { inventoryApi, ProductKit } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface KitItemInput {
  component_name: string;
  quantity: number;
}

const KIT_TYPES = ["Assembly", "Phantom", "Service", "Post"];

export function ProductKits() {
  const [data, setData] = useState<ProductKit[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", sku: "", kit_type: "Assembly", description: "" });
  const [items, setItems] = useState<KitItemInput[]>([{ component_name: "", quantity: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductKits();
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ name: "", sku: "", kit_type: "Assembly", description: "" });
    setItems([{ component_name: "", quantity: 1 }]);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (kit: ProductKit) => {
    setForm({ name: kit.name, sku: kit.sku || "", kit_type: kit.kit_type, description: kit.description || "" });
    setItems(
      (kit.items || []).map((i) => ({ component_name: i.component_name, quantity: i.quantity }))
    );
    if (items.length === 0) setItems([{ component_name: "", quantity: 1 }]);
    setEditingId(kit.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || items.some(i => !i.component_name.trim())) { toast.error("Add at least one component."); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        kit_type: form.kit_type,
        description: form.description || undefined,
        items: items.filter(i => i.component_name.trim()).map(i => ({ component_name: i.component_name, quantity: i.quantity })),
      };
      if (editingId) {
        await inventoryApi.updateProductKit(editingId, payload);
        toast.success("Kit updated");
      } else {
        await inventoryApi.createProductKit(payload);
        toast.success("Kit created");
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
    if (!confirm("Delete this kit?")) return;
    try {
      await inventoryApi.deleteProductKit(id);
      toast.success("Kit deleted");
      await loadData();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = data.filter(k => k.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Kits (BOM)</h2>
          <p className="text-sm text-muted-foreground">Bill-of-Materials kits (used in manufacturing).</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Create Kit
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search kits..." />
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading kits...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg">
          <Wrench className="size-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No kits yet</p>
          <p className="text-xs text-muted-foreground mt-1">Kits are Bill-of-Materials for manufacturing (e.g. "Desktop Computer").</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((kit) => (
            <Card key={kit.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-lg bg-purple-500/10 text-purple-600 grid place-items-center shrink-0">
                    <Wrench className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg leading-tight truncate">{kit.name}</h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{kit.sku}</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEdit(kit)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(kit.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 border mb-4">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">BOM Components ({kit.items.length})</div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {kit.items.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No components</span>
                  ) : (
                    kit.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Package className="size-3 text-purple-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{item.component_name}</div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">x{item.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full font-bold uppercase">
                  {kit.kit_type}
                </span>
                {kit.description && (
                  <span className="text-xs text-muted-foreground truncate max-w-[60%]">{kit.description}</span>
                )}
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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-100 z-10">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-purple-600" />
                  {editingId ? "Edit Kit" : "Create Kit"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kit Name *</label>
                    <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                      placeholder="e.g. Desktop Computer" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SKU *</label>
                    <input required type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kit Type</label>
                  <select value={form.kit_type} onChange={(e) => setForm({ ...form, kit_type: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white">
                    {KIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">BOM Components</label>
                    <button type="button" onClick={() => setItems([...items, { component_name: "", quantity: 1 }])}
                      className="text-xs font-semibold text-purple-600 hover:text-purple-500">
                      + Add Component
                    </button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input type="text" value={item.component_name}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[i] = { ...updated[i], component_name: e.target.value };
                              setItems(updated);
                            }}
                            placeholder="Component name (e.g. Laptop)"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                        </div>
                        <div className="w-24">
                          <input type="number" min={1} value={item.quantity}
                            onChange={(e) => {
                              const updated = [...items];
                              updated[i] = { ...updated[i], quantity: parseInt(e.target.value) || 1 };
                              setItems(updated);
                            }}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="Qty" />
                        </div>
                        {items.length > 1 && (
                          <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}
                            className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className="px-8 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg">
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