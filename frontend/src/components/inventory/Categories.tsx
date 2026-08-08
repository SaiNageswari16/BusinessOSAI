import { useRef, useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, FolderTree, Edit2, ChevronDown, Archive, X, Upload, Download } from "lucide-react";
import { inventoryApi, InventoryCategory } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export function Categories() {
  const [search, setSearch] = useState("");
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

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    const processData = async (rows: any[]) => {
      try {
        if (rows.length === 0) {
          alert("The file is empty.");
          return;
        }

        const getVal = (row: any, possibleKeys: string[]) => {
          for (const k of possibleKeys) {
            if (row[k] !== undefined && row[k] !== null) return row[k].toString().trim();
          }
          return "";
        };

        const newCats = [];
        for (const row of rows) {
          const name = getVal(row, ["Category Name", "Name", "Category"]);
          if (!name) continue;

          newCats.push({
            name,
            category_code: getVal(row, ["Category Code", "Code", "ID"]) || undefined,
            description: getVal(row, ["Description", "Desc"]),
            status: getVal(row, ["Status"]).toLowerCase() === 'inactive' ? 'inactive' : 'active'
          });
        }

        if (newCats.length > 0) {
          const res = await inventoryApi.bulkCreateCategories(newCats);
          alert(`Import complete! Created ${res.created_count} categories. Skipped ${res.skipped_count} duplicates.\n\nErrors:\n${res.errors.join('\\n')}`);
          await loadData();
        } else {
          alert("No valid categories found to import. Check your headers.");
        }
      } catch (error: any) {
        console.error("Import failed:", error);
        alert("Import failed: " + (error.detail || error.message || "Unknown error"));
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim().replace(/^[\u200B\u200C\u200D\u20FE\uFEFF]/, ""),
        complete: (results: any) => processData(results.data),
        error: (error: any) => {
          setIsImporting(false);
          alert("Failed to parse CSV: " + error.message);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      });
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
          processData(data);
        } catch (error: any) {
          setIsImporting(false);
          alert("Failed to parse Excel file: " + error.message);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categories & Sub-categories</h2>
          <p className="text-sm text-muted-foreground">Manage product category hierarchies (Parent Categories & Sub-categories).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" ref={fileInputRef} onChange={handleImport} className="hidden" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="size-4 mr-2" />
            {isImporting ? "Importing..." : "Import File"}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4 mr-2" />
            Export
          </Button>
          {categories.length > 0 && (
            <Button variant="destructive" onClick={handleDeleteAll} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
              <Archive className="size-4 mr-2" /> Delete All Categories
            </Button>
          )}
          <Button onClick={openCreateModal} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Category</Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search categories & sub-categories..." 
          />
        </div>
      </div>

      <div className="space-y-4 max-w-4xl">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading categories...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No categories found.</div>
        ) : (
          (() => {
            // Group parent & sub-categories
            const parentCats = filtered.filter(c => !c.parent_id);
            const orphanSubCats = filtered.filter(c => c.parent_id && !filtered.some(p => p.id === c.parent_id));
            const displayParents = parentCats.length > 0 ? parentCats : filtered;

            return (
              <div className="space-y-3">
                {displayParents.map((category) => {
                  const subCats = categories.filter(c => c.parent_id === category.id);
                  return (
                    <Card key={category.id} className="p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <FolderTree className="size-5 text-indigo-600" />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900">{category.name}</h3>
                              {category.parent_id && (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                                  Sub-category of {categories.find(p => p.id === category.parent_id)?.name || "Parent"}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">{category.category_code || 'N/A'}</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${category.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                            {category.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => handleDelete(category.id)}><Archive className="size-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-slate-100" onClick={() => handleEdit(category)}><Edit2 className="size-4" /></Button>
                        </div>
                      </div>

                      {/* Sub-categories nested under Parent */}
                      {subCats.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 pl-6 space-y-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Sub-Categories ({subCats.length}):</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {subCats.map(sub => (
                              <div key={sub.id} className="flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-xs">
                                <span className="font-semibold text-slate-800">{sub.name}</span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleEdit(sub)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 className="size-3" /></button>
                                  <button onClick={() => handleDelete(sub.id)} className="p-1 text-slate-400 hover:text-rose-600"><Archive className="size-3" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            );
          })()
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
                  <FolderTree className="w-5 h-5 text-indigo-600" />
                  {editingId ? "Edit Category" : "Add Category"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 overflow-y-auto">
                <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name *</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category Code</label>
                    <input type="text" name="category_code" value={formData.category_code} onChange={handleInputChange} placeholder="Leave blank to auto-generate" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono placeholder:font-sans" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Parent Category (Optional)</label>
                    <select name="parent_id" value={formData.parent_id} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white">
                      <option value="">None (Top-Level Category)</option>
                      {categories.filter(c => c.id !== editingId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
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
                <button type="submit" form="category-form" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-all">
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
