import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Image as ImageIcon, UploadCloud, Trash2, X, Package, Edit2, ImagePlus, Link as LinkIcon } from "lucide-react";
import { inventoryApi, ProductImage, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

export function ProductImages() {
    const { currency, formatCurrency } = useCurrency();
  const [data, setData] = useState<ProductImage[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    product_id: "",
    image_url: "",
    is_primary: false,
    display_order: 0,
    uploadFile: null as File | null,
    uploadMode: "url" as "url" | "file",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [imgs, prods] = await Promise.all([
        inventoryApi.getProductImages(),
        inventoryApi.getProducts({ page_size: 200 }).catch(() => ({ items: [] as InventoryProduct[] })),
      ]);
      setData(imgs);
      setProducts(prods.items || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const productById = useMemo(() => {
    const m = new Map<string, InventoryProduct>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const openCreate = () => {
    setForm({ product_id: "", image_url: "", is_primary: false, display_order: 0, uploadFile: null, uploadMode: "url" });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (img: ProductImage) => {
    setForm({
      product_id: img.product_id,
      image_url: img.image_url,
      is_primary: img.is_primary,
      display_order: img.display_order,
      uploadFile: null,
      uploadMode: "url",
    });
    setEditingId(img.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id) { toast.error("Please pick a product."); return; }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await inventoryApi.updateProductImage(editingId, {
          product_id: form.product_id,
          image_url: form.image_url,
          is_primary: form.is_primary,
          display_order: form.display_order,
        });
        toast.success("Image updated");
      } else if (form.uploadMode === "file" && form.uploadFile) {
        await inventoryApi.uploadProductImageFile(form.product_id, form.uploadFile);
        toast.success("Image uploaded");
      } else {
        if (!form.image_url) { toast.error("Provide an image URL or file."); setIsSubmitting(false); return; }
        await inventoryApi.createProductImage({
          product_id: form.product_id,
          image_url: form.image_url,
          is_primary: form.is_primary,
          display_order: form.display_order,
        });
        toast.success("Image added");
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
    if (!confirm("Delete this image?")) return;
    try {
      await inventoryApi.deleteProductImage(id);
      toast.success("Image deleted");
      await loadData();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    }
  };

  const filtered = data.filter((img) => {
    const p = productById.get(img.product_id);
    const q = search.toLowerCase();
    return !q || (p?.name || "").toLowerCase().includes(q) || img.image_url.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product Images</h2>
          <p className="text-sm text-muted-foreground">Manage product images — upload files or paste URLs.</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0">
          <UploadCloud className="size-4 mr-2" /> Add Image
        </Button>
      </div>

      <div className="relative max-w-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 px-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search by product name or URL..." />
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading images...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg">
          <ImageIcon className="size-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No images yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload product photos or paste image URLs to start your media library.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((img) => {
            const product = productById.get(img.product_id);
            return (
              <Card key={img.id} className="overflow-hidden group relative hover:shadow-md transition-shadow">
                <div className="aspect-square bg-muted relative">
                  <img src={img.image_url} alt={product?.name || "Product"} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => openEdit(img)}>
                      <Edit2 className="size-4" />
                    </Button>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(img.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {img.is_primary && (
                      <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded shadow-sm font-bold uppercase">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <span className="text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                      #{img.display_order}
                    </span>
                  </div>
                </div>
                <div className="p-3 border-t">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="size-3.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{product?.name || "Unknown product"}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{product?.sku || img.product_id.slice(0, 8)}</div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
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
                  <ImagePlus className="w-5 h-5 text-indigo-600" />
                  {editingId ? "Edit Image" : "Add Product Image"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product *</label>
                  <ProductPicker value={form.product_id} onChange={(id) => setForm({ ...form, product_id: id })} placeholder="Search product…" />
                </div>

                {!editingId && (
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button type="button" onClick={() => setForm({ ...form, uploadMode: "url" })}
                      className={`flex-1 text-xs font-semibold py-2 rounded-md transition ${form.uploadMode === "url" ? "bg-white shadow" : "text-muted-foreground"}`}>
                      <LinkIcon className="size-3.5 inline mr-1" /> Paste URL
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, uploadMode: "file" })}
                      className={`flex-1 text-xs font-semibold py-2 rounded-md transition ${form.uploadMode === "file" ? "bg-white shadow" : "text-muted-foreground"}`}>
                      <UploadCloud className="size-3.5 inline mr-1" /> Upload File
                    </button>
                  </div>
                )}

                {form.uploadMode === "url" || editingId ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Image URL</label>
                    <input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="https://example.com/photo.jpg" />
                    {form.image_url && (
                      <img src={form.image_url} alt="Preview" className="mt-2 max-h-32 rounded-lg border object-contain bg-muted" />
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Image File</label>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(e) => setForm({ ...form, uploadFile: e.target.files?.[0] || null })}
                      className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:font-semibold file:cursor-pointer cursor-pointer border border-slate-200 rounded-lg" />
                    {form.uploadFile && (
                      <p className="text-xs text-muted-foreground mt-1">Selected: {form.uploadFile.name} ({(form.uploadFile.size / 1024).toFixed(0)} KB)</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Order</label>
                    <input type="number" min={0} value={form.display_order}
                      onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-lg bg-background w-full cursor-pointer">
                      <input type="checkbox" checked={form.is_primary}
                        onChange={(e) => setForm({ ...form, is_primary: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                      <span className="text-xs font-semibold">Primary image</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg">
                    {isSubmitting ? 'Saving...' : (editingId ? 'Update' : 'Save')}
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