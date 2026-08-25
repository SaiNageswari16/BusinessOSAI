import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Search, Plus, Edit2, Archive, X, Download, Filter, Columns, ChevronLeft, ChevronRight, MoreVertical, RotateCcw } from "lucide-react";
import { inventoryApi, InventoryBrand, resolveImageUrl } from "../../lib/api-client";
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



  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Brands</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage and organize product brands and manufacturers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-slate-200">
            <Download className="size-4 mr-2" /> Import Brands
          </Button>
          <Button 
            variant="outline" 
            className={`border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-opacity ${selectedIds.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={handleDeleteSelected}
          >
            <Archive className="size-4 mr-2" /> Delete Selected
          </Button>
          <Button onClick={openCreateModal} className="bg-teal-600 hover:bg-teal-700 text-white border-0">
            <Plus className="size-4 mr-2" /> Add Brand
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-slate-50 focus:bg-white transition-colors focus:ring-1 focus:ring-teal-500 outline-none" 
            placeholder="Search brands..." 
          />
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-3 py-2 text-sm rounded-lg border bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Category</span>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-10 px-3 py-2 text-sm rounded-lg border bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500 min-w-[150px]">
            <option>All Categories</option>
            <option>Electronics</option>
            <option>Food & Beverages</option>
            <option>Personal Care</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Manufacturer Type</span>
          <select value={manufacturerFilter} onChange={e => setManufacturerFilter(e.target.value)} className="h-10 px-3 py-2 text-sm rounded-lg border bg-slate-50 outline-none focus:ring-1 focus:ring-teal-500 min-w-[150px]">
            <option>All Types</option>
            <option>Manufacturer</option>
            <option>Distributor</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 justify-end h-full mt-4">
          <Button variant="ghost" onClick={handleClearFilters} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 h-10">
            <RotateCcw className="size-4 mr-2" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border shadow-sm flex flex-col">
        {/* Table Header Tools */}
        <div className="p-4 border-b flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-600">Total Brands: {filtered.length}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9">
              <Columns className="size-4 mr-2" /> Columns
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <Download className="size-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b">
              <tr>
                <th className="p-4 w-12 text-center">
                  <input type="checkbox" checked={selectedIds.length === paginated.length && paginated.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                </th>
                <th className="px-6 py-4 font-bold">Brand Name</th>
                <th className="px-6 py-4 font-bold text-center">Logo</th>
                <th className="px-6 py-4 font-bold">Category</th>
                <th className="px-6 py-4 font-bold">Manufacturer Type</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Products</th>
                <th className="px-6 py-4 font-bold">Created On</th>
                <th className="px-6 py-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading brands...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No brands found.</td></tr>
              ) : (
                paginated.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(brand.id)} 
                        onChange={() => toggleSelect(brand.id)} 
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" 
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{brand.name}</td>
                    <td className="px-6 py-4 text-center">
                      {brand.image_url ? (
                        <img src={resolveImageUrl(brand.image_url)} alt={brand.name} className="h-8 w-auto mx-auto object-contain" />
                      ) : (
                        <span className="font-bold text-slate-900 text-lg">{brand.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {brand.category ? (
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${brand.category.includes("Electronics") ? "bg-blue-50 text-blue-600" : brand.category.includes("Food") ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
                          {brand.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-purple-50 text-purple-600">
                        {brand.manufacturer || "Manufacturer"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${brand.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                        {brand.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {brand.products_count || 0}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {formatDate(brand.created_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-teal-600 hover:text-teal-700 hover:bg-teal-50" onClick={() => handleEdit(brand)}>
                          <Edit2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                          <MoreVertical className="size-4" />
                        </Button>
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
