import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Layers, Edit2, Trash2, X } from "lucide-react";
import { inventoryApi, ProductVariant } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

interface VariantAttributeInput {
  name: string;
  value: string;
}

export function ProductVariants() {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<ProductVariant[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    product_id: "",
    variant_name: "",
    sku: "",
    barcode: "",
    additional_price: 0,
    stock_override: 0,
  });
  const [attrs, setAttrs] = useState<VariantAttributeInput[]>([{ name: "", value: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getProductVariants();
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ product_id: "", variant_name: "", sku: "", barcode: "", additional_price: 0, stock_override: 0 });
    setAttrs([{ name: "", value: "" }]);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (variant: ProductVariant) => {
    setForm({
      product_id: variant.product_id,
      variant_name: variant.variant_name,
      sku: variant.sku,
      barcode: variant.barcode || "",
      additional_price: variant.additional_price || 0,
      stock_override: variant.stock_override || 0,
    });
    setAttrs(
      Object.entries(variant.attributes || {}).map(([name, value]) => ({ name, value: String(value) }))
    );
    if (attrs.length === 0) setAttrs([{ name: "", value: "" }]);
    setEditingId(variant.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id) { toast.error("Please select a product."); return; }
    setIsSubmitting(true);
    try {
      const attributes: Record<string, string> = {};
      attrs.forEach(a => {
        if (a.name.trim() && a.value.trim()) attributes[a.name.trim()] = a.value.trim();
      });
      const payload = {
        product_id: form.product_id,
        variant_name: form.variant_name,
        sku: form.sku,
        barcode: form.barcode || undefined,
        attributes,
        additional_price: Number(form.additional_price) || 0,
        stock_override: Number(form.stock_override) || 0,
      };
      if (editingId) {
        await inventoryApi.updateProductVariant(editingId, payload);
        toast.success("Variant updated");
      } else {
        await inventoryApi.createProductVariant(payload);
        toast.success("Variant created");
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
    if (!confirm("Delete this variant?")) return;
    try {
      await inventoryApi.deleteProductVariant(id);
      toast.success("Variant deleted");
      await loadData();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = data.filter(v =>
    v.variant_name.toLowerCase().includes(search.toLowerCase()) ||
    (v.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Variants</h2>
          <p className="text-sm text-muted-foreground">Specific SKUs generated from product attributes (e.g. "Red Small").</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Create Variant
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search variants..."
        />
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading variants...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg">
          <Layers className="size-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No variants yet</p>
          <p className="text-xs text-muted-foreground mt-1">Variants are SKUs derived from products + attributes (Color, Size, etc).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((variant) => (
            <Card key={variant.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-lg bg-indigo-500/10 text-indigo-600 grid place-items-center shrink-0">
                    <Layers className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg leading-tight truncate">{variant.variant_name}</h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{variant.sku}</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEdit(variant)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(variant.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 border mb-4">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Attributes</div>
                <div className="space-y-2">
                  {Object.keys(variant.attributes || {}).length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No attributes set</span>
                  ) : (
                    Object.entries(variant.attributes).map(([key, val], i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="font-medium text-muted-foreground">{key}</span>
                        <span className="font-semibold">{String(val)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Additional Price</div>
                  <div className="font-bold text-emerald-600">+{currency.symbol}{variant.additional_price}</div>
                </div>
                {variant.stock_override != null && (
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Stock</div>
                    <div className="font-bold">{variant.stock_override}</div>
                  </div>
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
                  <Layers className="w-5 h-5 text-indigo-600" />
                  {editingId ? "Edit Variant" : "Create Variant"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Parent Product *</label>
                  <ProductPicker value={form.product_id} onChange={(id) => setForm({ ...form, product_id: id })} placeholder="Search product to attach variant…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Variant Name *</label>
                    <input required type="text" value={form.variant_name} onChange={(e) => setForm({ ...form, variant_name: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="e.g. Red Small" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SKU *</label>
                    <input required type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                      placeholder="e.g. TSHIRT-RED-S" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Barcode</label>
                  <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                    placeholder="EAN/UPC (optional)" />
                </div>

                <div className="border-t pt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attribute Selections</label>
                  <div className="space-y-2">
                    {attrs.map((a, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={a.name} onChange={(e) => setAttrs(attrs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          placeholder="Attribute (e.g. Color)"
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <input type="text" value={a.value} onChange={(e) => setAttrs(attrs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                          placeholder="Value (e.g. Red)"
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                        {attrs.length > 1 && (
                          <button type="button" onClick={() => setAttrs(attrs.filter((_, j) => j !== i))}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAttrs([...attrs, { name: "", value: "" }])}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 mt-2">
                    + Add attribute row
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t pt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Additional Price ({currency.symbol})</label>
                    <input type="number" step="0.01" value={form.additional_price} onChange={(e) => setForm({ ...form, additional_price: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stock Override</label>
                    <input type="number" value={form.stock_override} onChange={(e) => setForm({ ...form, stock_override: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
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