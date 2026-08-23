import { useRef, useState, useEffect } from "react";
import { Button } from "../ui/button";
import { 
  Search, Plus, FolderTree, Edit2, Archive, X, Upload, Download, 
  Layers, ArrowUpDown, ChevronRight, CheckCircle2, Trash2
} from "lucide-react";
import { inventoryApi, InventoryCategory } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

export function Categories() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "", category_code: "", description: "", parent_id: "", status: "active"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const defaultFormData = { name: "", category_code: "", description: "", parent_id: "", status: "active" };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await inventoryApi.getCategories();
      const items = Array.isArray(res) ? res : (res?.items || []);
      setCategories(items);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = categories.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || (c.category_code && c.category_code.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "All Status" || (statusFilter === "Active" ? c.status === "active" : c.status !== "active");
    return matchesSearch && matchesStatus;
  });

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
      const payload = {
        ...formData,
        parent_id: formData.parent_id || null
      };

      if (editingId) {
        await inventoryApi.updateCategory(editingId, payload);
      } else {
        await inventoryApi.createCategory(payload);
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData(defaultFormData);
      await loadData();
    } catch (error) {
      console.error("Failed to save category:", error);
      alert("Failed to save category.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    if (categories.length === 0) {
      alert("No categories to export.");
      return;
    }
    const exportData = categories.map(c => ({
      "Category Code": c.category_code || "",
      "Category Name": c.name,
      "Description": c.description || "",
      "Status": c.status === "active" ? "Active" : "Inactive"
    }));
    
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `categories_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results: any) => {
          try {
            const parsed = results.data as any[];
            let count = 0;
            for (const row of parsed) {
              const name = row['Category Name'] || row['name'] || row['Name'];
              if (name) {
                await inventoryApi.createCategory({
                  name,
                  category_code: row['Category Code'] || row['category_code'] || '',
                  description: row['Description'] || row['description'] || '',
                  status: (row['Status'] || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active'
                });
                count++;
              }
            }
            alert(`Successfully imported ${count} categories!`);
            await loadData();
          } catch (err) {
            console.error(err);
            alert("Error importing CSV file.");
          } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        },
        error: () => {
          setIsImporting(false);
          alert("Failed to parse CSV file.");
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      });
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data: any[] = XLSX.utils.sheet_to_json(ws);
          let count = 0;
          for (const row of data) {
            const name = row['Category Name'] || row['name'] || row['Name'];
            if (name) {
              await inventoryApi.createCategory({
                name,
                category_code: row['Category Code'] || row['category_code'] || '',
                description: row['Description'] || row['description'] || '',
                status: (row['Status'] || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active'
              });
              count++;
            }
          }
          alert(`Successfully imported ${count} categories!`);
          await loadData();
        } catch (err) {
          console.error(err);
          alert("Error importing Excel file.");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setIsImporting(false);
      alert("Unsupported file format. Please upload a .csv or .xlsx file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEdit = (category: InventoryCategory) => {
    setFormData({
      name: category.name,
      category_code: category.category_code || "",
      description: category.description || "",
      parent_id: category.parent_id || "",
      status: category.status || "active"
    });
    setEditingId(category.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await inventoryApi.deleteCategory(id);
      await loadData();
    } catch (err: any) {
      alert("Failed to delete category: " + (err.detail || err.message));
    }
  };

  const openCreateModal = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openCreateSubModal = (parentId: string) => {
    setFormData({ ...defaultFormData, parent_id: parentId });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(`ARE YOU SURE YOU WANT TO DELETE ALL ${categories.length} CATEGORIES? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await inventoryApi.deleteAllCategories();
      alert(res.message || "All categories deleted successfully!");
      loadData();
    } catch (error) {
      console.error("Failed to delete categories:", error);
      alert("Failed to delete all categories");
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-none">
              Categories & Sub-categories
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
              {categories.length} Total
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-normal">
            Manage product category hierarchies, parent groups, and nested sub-categories.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" ref={fileInputRef} onChange={handleImport} className="hidden" />
          <Button 
            variant="outline" 
            size="sm"
            className="h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting}
          >
            <Upload className="size-3.5 mr-1.5 text-slate-500" /> {isImporting ? "Importing..." : "Import File"}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-200 rounded-lg shadow-2xs"
            onClick={handleExport}
          >
            <Download className="size-3.5 mr-1.5 text-slate-500" /> Export
          </Button>
          {categories.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDeleteAll} 
              className="h-9 text-xs font-semibold text-rose-700 hover:bg-rose-50 border-rose-200 rounded-lg shadow-2xs"
            >
              <Trash2 className="size-3.5 mr-1.5 text-rose-600" /> Delete All
            </Button>
          )}
          <Button 
            size="sm"
            onClick={openCreateModal} 
            className="h-9 px-3.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="size-4 mr-1.5" /> Add Category
          </Button>
        </div>
      </div>

      {/* ── Search & Filters Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories by name or code..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50/80 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All Status">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* ── Categories Columns & Rows Table ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80">
          <div className="size-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading categories...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-14 border border-dashed rounded-2xl bg-slate-50/50">
          <FolderTree className="size-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-800">No categories found</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Click 'Add Category' to create your first product category.</p>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg h-9">
            <Plus className="size-4 mr-1.5" /> Add Category
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
                  <th className="py-3 px-4">Category Name & Hierarchy</th>
                  <th className="py-3 px-4">Category Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Sub-Categories</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((category) => {
                  const subCats = categories.filter(c => c.parent_id === category.id);
                  const isParent = !category.parent_id;
                  const parentName = category.parent_id ? categories.find(p => p.id === category.parent_id)?.name : null;

                  return (
                    <tr 
                      key={category.id} 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => handleEdit(category)}
                    >
                      {/* Name & Hierarchy */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "size-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border",
                            isParent ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-purple-50 text-purple-600 border-purple-100"
                          )}>
                            <FolderTree className="size-4.5" />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-[13px] leading-snug group-hover:text-blue-600 transition-colors">
                              {category.name}
                            </div>
                            <div className="inline-flex items-center gap-1 text-[10.5px] font-semibold mt-0.5">
                              {isParent ? (
                                <span className="px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-[9.5px]">
                                  Main Category
                                </span>
                              ) : (
                                <span className="px-2 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 font-bold text-[9.5px]">
                                  Sub of {parentName || "Parent"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 text-xs">
                        {category.category_code || "—"}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate font-medium">
                        {category.description || "No description provided"}
                      </td>

                      {/* Sub-Categories */}
                      <td className="py-3.5 px-4">
                        {isParent ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                              {subCats.length} Sub-items
                            </span>
                            {subCats.slice(0, 2).map(s => (
                              <span key={s.id} className="text-[10.5px] bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded text-slate-600 truncate max-w-[100px]">
                                {s.name}
                              </span>
                            ))}
                            {subCats.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-bold">+{subCats.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold",
                          category.status === "active" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80" 
                            : "bg-rose-50 text-rose-700 border border-rose-200/80"
                        )}>
                          <span className={cn(
                            "size-1.5 rounded-full",
                            category.status === "active" ? "bg-emerald-500" : "bg-rose-500"
                          )} />
                          {category.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {isParent && (
                            <button
                              onClick={() => openCreateSubModal(category.id)}
                              className="h-8 px-2 rounded-lg text-blue-600 bg-blue-50/80 hover:bg-blue-100 text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                              title="Add Sub-category"
                            >
                              <Plus className="size-3" /> Sub-item
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(category)}
                            className="size-8 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
                            className="size-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                            title="Delete Category"
                          >
                            <Archive className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Showing {filtered.length} of {categories.length} categories</span>
            <span className="font-semibold text-slate-700">Click any row to edit specifications</span>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <FolderTree className="w-5 h-5 text-blue-600" />
                  {editingId ? "Edit Category" : "Add New Category"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category Name <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Beverages, Electronics"
                    className="w-full h-10 px-3 text-xs bg-slate-50/80 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category Code</label>
                  <input
                    type="text"
                    name="category_code"
                    value={formData.category_code}
                    onChange={handleInputChange}
                    placeholder="e.g. CAT-BEV-001"
                    className="w-full h-10 px-3 text-xs font-mono bg-slate-50/80 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parent Category (Optional)</label>
                  <select
                    name="parent_id"
                    value={formData.parent_id}
                    onChange={handleInputChange}
                    className="w-full h-10 px-3 text-xs bg-slate-50/80 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  >
                    <option value="">None (Top-Level Category)</option>
                    {categories.filter(c => !c.parent_id && c.id !== editingId).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Brief description of this category..."
                    className="w-full p-3 text-xs bg-slate-50/80 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-medium"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="status"
                    name="status"
                    checked={formData.status === 'active'}
                    onChange={handleInputChange}
                    className="size-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="status" className="text-xs font-bold text-slate-700 cursor-pointer">Active Category</label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {isSubmitting ? "Saving..." : editingId ? "Update Category" : "Create Category"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
