import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, PackageCheck, Edit2, Trash2, X, ShoppingCart } from "lucide-react";
import { inventoryApi, ProductBundle } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface BundleItemInput {
  product_id: string;
  product_name?: string;
  quantity: number;
}

export function ProductBundles() {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<ProductBundle[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", sku: "", description: "", price: 0 });
  const [items, setItems] = useState<BundleItemInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductBundles();
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ name: "", sku: "", description: "", price: 0 });
    setItems([{ product_id: "", quantity: 1 }]);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (bundle: ProductBundle) => {
    setForm({ name: bundle.name, sku: bundle.sku || "", description: bundle.description || "", price: bundle.price });
    setItems(
      (bundle.items || []).map((i) => ({ product_id: i.product_id, product_name: i.product_id, quantity: i.quantity }))
    );
    if (items.length === 0) setItems([{ product_id: "", quantity: 1 }]);
    setEditingId(bundle.id);
    setIsModalOpen(true);
  };

  const addItemRow = () => setItems([...items, { product_id: "", quantity: 1 }]);
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: "product_id" | "product_name" | "quantity", value: string | number) => {
    setItems(items.map((it, i) => i === index ? { ...it, [field]: value } : it));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || items.some(i => !i.product_id)) { toast.error("Add at least one item."); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        description: form.description,
        price: Number(form.price) || 0,
        items: items.filter(i => i.product_id).map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      };
      if (editingId) {
        await inventoryApi.updateProductBundle(editingId, payload);
        toast.success("Bundle updated");
      } else {
        await inventoryApi.createProductBundle(payload);
        toast.success("Bundle created");
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
    if (!confirm("Delete this bundle?")) return;
    try {
      await inventoryApi.deleteProductBundle(id);
      toast.success("Bundle deleted");
      await loadData();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = data.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Bundles</h2>
          <p className="text-sm text-muted-foreground">Group multiple products into a sellable bundle package.</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Create Bundle
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search bundles..." />
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading bundles...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg">
          <PackageCheck className="size-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No bundles yet</p>
          <p className="text-xs text-muted-foreground mt-1">Bundle related products together (e.g. "Laptop Kit" = laptop + bag + charger).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((bundle) => (
            <Card key={bundle.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                    <PackageCheck className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg leading-tight truncate">{bundle.name}</h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{bundle.sku}</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEdit(bundle)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(bundle.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 border mb-4">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">
                  Items ({bundle.items.length})
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {bundle.items.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No items</span>
                  ) : (
                    bundle.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="truncate max-w-[60%] text-muted-foreground">…{item.product_id.slice(-6)}</span>
                        <span className="font-semibold">x{item.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 border-t flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Bundle Price</span>
                <span className="font-bold text-emerald-600">{currency.symbol}{bundle.price.toFixed(2)}</span>
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
                  <PackageCheck className="w-5 h-5 text-emerald-600" />
                  {editingId ? "Edit Bundle" : "Create Bundle"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bundle Name *</label>
                    <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="e.g. Laptop Kit" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SKU *</label>
                    <input required type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bundle Price ({currency.symbol})</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Bundle Items</label>
                    <button type="button" onClick={addItemRow}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-500">
                      + Add Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <ProductPicker
                            value={item.product_id}
                            onChange={(id) => updateItem(i, "product_id", id)}
                            placeholder="Select product..."
                          />
                        </div>
                        <div className="w-24">
                          <input type="number" min={1} value={item.quantity}
                            onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="Qty" />
                        </div>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItemRow(i)}
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
                    className="px-8 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg">
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