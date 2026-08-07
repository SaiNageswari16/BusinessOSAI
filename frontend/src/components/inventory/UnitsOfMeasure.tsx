import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Scale, Archive, Edit2, X } from "lucide-react";
import { inventoryApi, InventoryUOM } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function UnitsOfMeasure() {
  const [search, setSearch] = useState("");
  const [uoms, setUoms] = useState<InventoryUOM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const defaultForm = { name: "", abbreviation: "", description: "", status: "active" };
  const [formData, setFormData] = useState(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getUOMs();
      const items = Array.isArray(res) ? res : (res?.items || []);
      setUoms(items);

    } catch (error) {
      console.error("Failed to load UOMs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = uoms.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.abbreviation || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await inventoryApi.updateUOM(editingId, formData);
        toast.success("UOM updated");
      } else {
        await inventoryApi.createUOM(formData);
        toast.success("UOM created");
      }
      setIsModalOpen(false);
      setFormData(defaultForm);
      setEditingId(null);
      await loadData();
    } catch (error: any) {
      toast.error("Failed: " + (error.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this UOM?")) return;
    try {
      await inventoryApi.deleteUOM(id);
      toast.success("UOM deleted");
      await loadData();
    } catch (err: any) {
      toast.error("Failed: " + (err.detail || err.message));
    }
  };

  const openCreate = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (uom: InventoryUOM) => {
    setFormData({
      name: uom.name,
      abbreviation: uom.abbreviation,
      description: uom.description || "",
      status: uom.status || "active",
    });
    setEditingId(uom.id);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Units of Measure (UoM)</h2>
          <p className="text-sm text-muted-foreground">Manage measurement units.</p>
        </div>
        <Button onClick={openCreate} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Add UoM
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
          placeholder="Search units..."
        />
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading units...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-lg">
          <Scale className="size-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-medium">No units found</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Add UoM" to create your first unit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((uom) => (
            <Card key={uom.id} className="p-6 relative group overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Scale className="size-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg leading-tight truncate">{uom.name}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                      {uom.abbreviation}
                    </span>
                  </div>
                  {uom.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{uom.description}</p>}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t flex justify-between items-center">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  uom.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  {uom.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openEdit(uom)}>
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleDelete(uom.id)}>
                    <Archive className="size-4" />
                  </Button>
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
                  <Scale className="w-5 h-5 text-indigo-600" />
                  {editingId ? "Edit Unit of Measure" : "Add Unit of Measure"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name *</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="e.g. Kilogram" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Abbreviation *</label>
                  <input required type="text" name="abbreviation" value={formData.abbreviation} onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="e.g. kg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="status" checked={formData.status === 'active'}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.checked ? 'active' : 'inactive' }))}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                  <label htmlFor="status" className="text-sm font-medium text-slate-700">Active</label>
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