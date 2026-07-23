import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Tags, Edit2, Globe, Archive, X } from "lucide-react";
import { inventoryApi, InventoryBrand } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";

export function Brands() {
  const [search, setSearch] = useState("");
  const [brands, setBrands] = useState<InventoryBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "", description: "", manufacturer: "", status: "active"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultFormData = { name: "", description: "", manufacturer: "", status: "active" };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getBrands();
      setBrands(res.items || []);
    } catch (error) {
      console.error("Failed to load brands:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked ? 'active' : 'inactive' : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await inventoryApi.updateBrand(editingId, formData);
      } else {
        await inventoryApi.createBrand(formData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(defaultFormData);
      await loadData();
    } catch (error) {
      console.error("Failed to save brand:", error);
      alert("Failed to save brand.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (brand: InventoryBrand) => {
    setFormData({
      name: brand.name,
      description: brand.description || "",
      manufacturer: brand.manufacturer || "",
      status: brand.status || "active"
    });
    setEditingId(brand.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this brand?")) return;
    try {
      await inventoryApi.deleteBrand(id);
      await loadData();
    } catch (err: any) {
      alert("Failed to delete brand: " + (err.detail || err.message));
    }
  };

  const openCreateModal = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Brands</h2>
          <p className="text-sm text-muted-foreground">Manage product brands and manufacturers.</p>
        </div>
        <Button onClick={openCreateModal} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Brand</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search brands..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading brands...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No brands found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((brand) => (
            <Card key={brand.id} className="p-6 hover:shadow-md transition-shadow group overflow-hidden relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
              <div className="flex justify-between items-start mb-4">
                <div className="size-12 rounded-xl bg-background border shadow-sm grid place-items-center">
                  <Tags className="size-6 text-primary" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleDelete(brand.id)}><Archive className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEdit(brand)}><Edit2 className="size-4" /></Button>
                </div>
              </div>
              <h3 className="font-bold text-lg">{brand.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{brand.description || "No description"}</p>
              
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Globe className="size-3.5" /> {brand.manufacturer || "N/A"}
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  brand.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  {brand.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Tags className="w-5 h-5 text-indigo-600" />
                  {editingId ? "Edit Brand" : "Add Brand"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 overflow-y-auto">
                <form id="brand-form" onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Brand Name *</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Manufacturer / Origin</label>
                    <input type="text" name="manufacturer" value={formData.manufacturer} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"></textarea>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <input type="checkbox" name="status" id="status" checked={formData.status === 'active'} onChange={(e) => setFormData(prev => ({...prev, status: e.target.checked ? 'active' : 'inactive'}))} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <label htmlFor="status" className="text-sm font-medium text-slate-700">Active</label>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" form="brand-form" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-all">
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
