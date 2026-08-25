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
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Product Variants</h2>
          <p className="text-sm text-muted-foreground mt-1">Specific SKUs generated from product attributes (e.g. "Red Small").</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Create Variant
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search variants..."
        />
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground text-xs">Loading variants...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg">
          <Layers className="size-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground font-semibold">No variants yet</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Variants are SKUs derived from products + attributes (Color, Size, etc).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((variant) => (
            <Card key={variant.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-600 grid place-items-center shrink-0">
                    <Layers className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{variant.variant_name}</h3>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{variant.sku}</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => openEdit(variant)}>
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(variant.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs border-t pt-2.5">
                {variant.barcode && (
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>Barcode:</span>
                    <span className="font-mono">{variant.barcode}</span>
                  </div>
                )}
                {variant.attributes && Object.keys(variant.attributes).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(variant.attributes).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-muted text-[10px] font-medium text-foreground">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1 border-t mt-2 text-xs">
                  <span>Additional Price:</span>
                  <span className="text-emerald-600 font-bold">{currency.symbol}{Number(variant.additional_price || 0).toFixed(2)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border"
            >
              <div className="p-4 border-b flex justify-between items-center bg-muted/30">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Layers className="size-4 text-primary" />
                  {editingId ? 'Edit Product Variant' : 'Create Product Variant'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Parent Product *</label>
                  <ProductPicker value={form.product_id} onChange={(id) => setForm({ ...form, product_id: id })} placeholder="Search product to attach variant…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Variant Name *</label>
                    <input required type="text" value={form.variant_name} onChange={(e) => setForm({ ...form, variant_name: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none text-xs"
                      placeholder="e.g. Red Small" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">SKU *</label>
                    <input required type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none text-xs font-mono"
                      placeholder="e.g. TSHIRT-RED-S" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Barcode</label>
                  <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none text-xs font-mono"
                    placeholder="EAN/UPC (optional)" />
                </div>

                <div className="border-t pt-3">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Attribute Selections</label>
                  <div className="space-y-1.5">
                    {attrs.map((a, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={a.name} onChange={(e) => setAttrs(attrs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          placeholder="Attribute (e.g. Color)"
                          className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" />
                        <input type="text" value={a.value} onChange={(e) => setAttrs(attrs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                          placeholder="Value (e.g. Red)"
                          className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" />
                        {attrs.length > 1 && (
                          <button type="button" onClick={() => setAttrs(attrs.filter((_, j) => j !== i))}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAttrs([...attrs, { name: "", value: "" }])}
                    className="text-xs font-semibold text-primary hover:underline mt-1.5">
                    + Add attribute row
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Additional Price ({currency.symbol})</label>
                    <input type="number" step="0.01" value={form.additional_price} onChange={(e) => setForm({ ...form, additional_price: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Stock Override</label>
                    <input type="number" value={form.stock_override} onChange={(e) => setForm({ ...form, stock_override: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none text-xs" />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-lg">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-semibold text-white gradient-brand disabled:opacity-50 rounded-lg">
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