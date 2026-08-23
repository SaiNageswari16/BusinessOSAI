import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Search, Plus, Edit2, Archive, X, Download, Filter, Columns, ChevronLeft, ChevronRight, MoreVertical, RotateCcw } from "lucide-react";
import { inventoryApi, InventoryBrand, resolveImageUrl, downloadCsv } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";

export function Brands() {
    const { currency, formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [brands, setBrands] = useState<InventoryBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [manufacturerFilter, setManufacturerFilter] = useState("All Types");

  // Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "", description: "", manufacturer: "", status: "active", category: "", image_url: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultFormData = { name: "", description: "", manufacturer: "Manufacturer", status: "active", category: "", image_url: "" };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getBrands();
      // Handle paginated response if backend sends it, else array
      const items = Array.isArray(res) ? res : (res?.items || []);
      setBrands(items);
    } catch (error) {
      console.error("Failed to load brands:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter logic
  const filtered = brands.filter(b => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "All Status" && (statusFilter === "Active" ? b.status !== "active" : b.status === "active")) return false;
    if (categoryFilter !== "All Categories" && b.category !== categoryFilter) return false;
    if (manufacturerFilter !== "All Types" && b.manufacturer !== manufacturerFilter) return false;
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("All Status");
    setCategoryFilter("All Categories");
    setManufacturerFilter("All Types");
    setCurrentPage(1);
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginated.map(b => b.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} brands?`)) return;
    try {
      // Temporary loop for multiple deletes if bulk delete not available
      for (const id of selectedIds) {
        await inventoryApi.deleteBrand(id);
      }
      setSelectedIds([]);
      await loadData();
    } catch (error) {
      alert("Failed to delete some brands");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      manufacturer: brand.manufacturer || "Manufacturer",
      category: brand.category || "",
      image_url: brand.image_url || "",
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



  const handleExport = () => {
    if (brands.length === 0) {
      alert("No brands to export.");
      return;
    }
    const headers = ["Brand Name", "Category", "Manufacturer", "Status", "Description"];
    const rows = filtered.map(b => [
      b.name,
      b.category || "",
      b.manufacturer || "",
      b.status || "active",
      b.description || ""
    ]);
    downloadCsv(`brands_export_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-none">
              Brands
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
              {brands.length} Brands
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-normal">
            Manage product brands, manufacturers, distributors, and associated product lines.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            className="h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
            onClick={handleExport}
          >
            <Download className="size-3.5 mr-1.5 text-slate-500" /> Export
          </Button>
          {selectedIds.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDeleteSelected} 
              className="h-9 text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-200 rounded-lg shadow-2xs"
            >
              <Archive className="size-3.5 mr-1.5 text-rose-600" /> Delete ({selectedIds.length})
            </Button>
          )}
          <Button 
            size="sm"
            onClick={openCreateModal} 
            className="h-9 px-3.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="size-4 mr-1.5" /> Add Brand
          </Button>
        </div>
      </div>

      {/* ── Search & Filters Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50/80 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium" 
            placeholder="Search brands by name or manufacturer..." 
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)} 
            className="h-9 px-2.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
          
          <select 
            value={categoryFilter} 
            onChange={e => setCategoryFilter(e.target.value)} 
            className="h-9 px-2.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[130px]"
          >
            <option>All Categories</option>
            <option>Electronics</option>
            <option>Food & Beverages</option>
            <option>Personal Care</option>
          </select>

          <select 
            value={manufacturerFilter} 
            onChange={e => setManufacturerFilter(e.target.value)} 
            className="h-9 px-2.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[130px]"
          >
            <option>All Types</option>
            <option>Manufacturer</option>
            <option>Distributor</option>
          </select>
        </div>
      </div>

      {/* ── Table Section ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input type="checkbox" checked={selectedIds.length === paginated.length && paginated.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </th>
                <th className="px-4 py-3">Brand Name & Logo</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Manufacturer Type</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading brands...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No brands found.</td></tr>
              ) : (
                paginated.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => handleEdit(brand)}>
                    <td className="p-3.5 text-center" onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(brand.id)} 
                        onChange={() => toggleSelect(brand.id)} 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm shrink-0 border border-slate-200/80 overflow-hidden">
                          {brand.image_url ? (
                            <img src={resolveImageUrl(brand.image_url)} alt={brand.name} className="size-full object-contain p-1" />
                          ) : (
                            <span className="text-xs font-black text-slate-700">{brand.name.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-[13px] leading-snug group-hover:text-blue-600 transition-colors">
                            {brand.name}
                          </div>
                          {brand.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{brand.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {brand.category ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                          {brand.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80">
                        {brand.manufacturer || "Manufacturer"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700">
                      {brand.products_count || 0} Products
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${brand.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-slate-100 text-slate-600'}`}>
                        <span className={`size-1.5 rounded-full ${brand.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {brand.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(brand)}
                          className="size-8 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition cursor-pointer"
                          title="Edit Brand"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(brand.id)}
                          className="size-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                          title="Delete Brand"
                        >
                          <Archive className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="p-4 border-t flex items-center justify-between text-sm text-slate-600">
            <div>
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <select 
                  value={itemsPerPage} 
                  onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="border-slate-200 rounded-md text-xs h-8 outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="size-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button 
                    key={i} 
                    variant={currentPage === i + 1 ? "default" : "outline"}
                    className={`h-8 w-8 ${currentPage === i + 1 ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  {editingId ? "Edit Brand" : "Add Brand"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <form id="brand-form" onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Brand Name *</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Logo Image URL</label>
                    <input type="text" name="image_url" value={formData.image_url} onChange={handleInputChange} placeholder="https://..." className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm">
                      <option value="">Select Category...</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Food & Beverages">Food & Beverages</option>
                      <option value="Personal Care">Personal Care</option>
                      <option value="Apparel">Apparel</option>
                      <option value="Home & Furniture">Home & Furniture</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Manufacturer Type</label>
                    <select name="manufacturer" value={formData.manufacturer} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm">
                      <option value="Manufacturer">Manufacturer</option>
                      <option value="Distributor">Distributor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 outline-none text-sm"></textarea>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <input type="checkbox" name="status" id="status" checked={formData.status === 'active'} onChange={(e) => setFormData(prev => ({...prev, status: e.target.checked ? 'active' : 'inactive'}))} className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500" />
                    <label htmlFor="status" className="text-sm font-medium text-slate-700">Active Status</label>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" form="brand-form" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-all">
                  {isSubmitting ? 'Saving...' : 'Save Brand'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
