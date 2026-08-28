import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Search, Plus, Edit2, Archive, X, Download, Columns, ChevronLeft, ChevronRight, MoreVertical, RotateCcw, ListOrdered, CheckCircle2, XCircle, Cuboid } from "lucide-react";
import { inventoryApi, InventoryUOM } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

export function UnitsOfMeasure() {
    const { currency, formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [uoms, setUoms] = useState<InventoryUOM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [baseUnitFilter, setBaseUnitFilter] = useState("All");

  // Selection & Pagination
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const defaultForm = { 
    name: "", abbreviation: "", description: "", status: "active", 
    unit_type: "Count", base_unit: false, conversion_rate: 1, unit_symbol: "" 
  };
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

  // Filter logic
  const filtered = uoms.filter(u => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.abbreviation.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "All Status" && (statusFilter === "Active" ? u.status !== "active" : u.status === "active")) return false;
    if (typeFilter !== "All Types" && u.unit_type !== typeFilter) return false;
    if (baseUnitFilter !== "All" && (baseUnitFilter === "Yes" ? !u.base_unit : u.base_unit)) return false;
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("All Status");
    setTypeFilter("All Types");
    setBaseUnitFilter("All");
    setCurrentPage(1);
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginated.map(u => u.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} units?`)) return;
    try {
      for (const id of selectedIds) {
        await inventoryApi.deleteUOM(id);
      }
      setSelectedIds([]);
      toast.success("Units deleted successfully");
      await loadData();
    } catch (error) {
      toast.error("Failed to delete some units");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    
    if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
      if (name === 'status') finalValue = finalValue ? 'active' : 'inactive';
    } else if (type === 'radio') {
      if (name === 'base_unit') finalValue = value === 'true';
      if (name === 'status') finalValue = value;
    } else if (type === 'number') {
      finalValue = parseFloat(value);
    }
    
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await inventoryApi.updateUOM(editingId, formData);
        toast.success("Unit updated successfully");
      } else {
        await inventoryApi.createUOM(formData);
        toast.success("Unit created successfully");
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(defaultForm);
      await loadData();
    } catch (error) {
      console.error("Failed to save UOM:", error);
      toast.error("Failed to save unit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (uom: InventoryUOM) => {
    setFormData({
      name: uom.name,
      abbreviation: uom.abbreviation,
      description: uom.description || "",
      status: uom.status || "active",
      unit_type: uom.unit_type || "Count",
      base_unit: uom.base_unit || false,
      conversion_rate: uom.conversion_rate || 1,
      unit_symbol: uom.unit_symbol || ""
    });
    setEditingId(uom.id);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Metrics
  const activeCount = uoms.filter(u => u.status === 'active').length;
  const baseCount = uoms.filter(u => u.base_unit).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Units of Measure (UoM)</h2>
          <p className="text-sm text-muted-foreground">Manage and organize measurement units used across your inventory.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-slate-200 bg-white">
            <Download className="size-4 mr-2" /> Import Units
          </Button>
          <Button 
            variant="outline" 
            className={`border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-opacity ${selectedIds.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={handleDeleteSelected}
          >
            <Archive className="size-4 mr-2" /> Delete Selected
          </Button>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white border-0">
            <Plus className="size-4 mr-2" /> Add Unit
          </Button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <ListOrdered className="size-6 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Total Units</p>
            <p className="text-2xl font-bold text-slate-900">{uoms.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="size-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Active Units</p>
            <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
            <XCircle className="size-6 text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Inactive Units</p>
            <p className="text-2xl font-bold text-slate-900">{uoms.length - activeCount}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
            <Cuboid className="size-6 text-purple-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Base Units</p>
            <p className="text-2xl font-bold text-slate-900">{baseCount}</p>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-white focus:ring-1 focus:ring-blue-500 outline-none shadow-sm" 
            placeholder="Search unit name or code..." 
          />
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Status</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-10 px-3 py-2 text-sm rounded-lg border bg-white outline-none focus:ring-1 focus:ring-blue-500 shadow-sm min-w-[140px]">
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Unit Type</span>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-10 px-3 py-2 text-sm rounded-lg border bg-white outline-none focus:ring-1 focus:ring-blue-500 shadow-sm min-w-[140px]">
            <option>All Types</option>
            <option>Count</option>
            <option>Weight</option>
            <option>Volume</option>
            <option>Length</option>
            <option>Packaging</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Base Unit</span>
          <select value={baseUnitFilter} onChange={e => setBaseUnitFilter(e.target.value)} className="h-10 px-3 py-2 text-sm rounded-lg border bg-white outline-none focus:ring-1 focus:ring-blue-500 shadow-sm min-w-[140px]">
            <option>All</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </div>

        <div className="flex flex-col gap-1 justify-end h-full mt-4">
          <Button variant="ghost" onClick={handleClearFilters} className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 h-10 border border-teal-100 bg-teal-50/50">
            <RotateCcw className="size-4 mr-2" /> Clear Filters
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden">
        {/* Table Header Tools */}
        <div className="p-4 border-b flex justify-end items-center bg-white">
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
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="p-4 w-12 text-center">
                  <input type="checkbox" checked={selectedIds.length === paginated.length && paginated.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                </th>
                <th className="px-6 py-4 font-bold">Unit Name</th>
                <th className="px-6 py-4 font-bold">Unit Code</th>
                <th className="px-6 py-4 font-bold">Unit Type</th>
                <th className="px-6 py-4 font-bold">Base Unit</th>
                <th className="px-6 py-4 font-bold">Conversion Rate</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Used In Products</th>
                <th className="px-6 py-4 font-bold">Created On</th>
                <th className="px-6 py-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Loading units...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No units found.</td></tr>
              ) : (
                paginated.map((uom) => (
                  <tr key={uom.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(uom.id)} 
                        onChange={() => toggleSelect(uom.id)} 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{uom.name}</td>
                    <td className="px-6 py-4 font-semibold text-blue-600 bg-blue-50/30">
                      {uom.abbreviation}
                    </td>
                    <td className="px-6 py-4">
                      {uom.unit_type ? (
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${
                          uom.unit_type === 'Count' ? 'bg-blue-50 text-blue-600' :
                          uom.unit_type === 'Weight' ? 'bg-purple-50 text-purple-600' :
                          uom.unit_type === 'Volume' ? 'bg-orange-50 text-orange-600' :
                          uom.unit_type === 'Length' ? 'bg-indigo-50 text-indigo-600' :
                          uom.unit_type === 'Packaging' ? 'bg-teal-50 text-teal-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {uom.unit_type}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-sm ${uom.base_unit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {uom.base_unit ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {uom.conversion_rate} {(!uom.base_unit && uom.unit_symbol) ? uom.unit_symbol : ''}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-sm ${uom.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                        {uom.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {uom.products_count?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {formatDate(uom.created_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEdit(uom)}>
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
                  className="border-slate-200 rounded-md text-xs h-8 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="size-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button 
                    key={i} 
                    variant={currentPage === i + 1 ? "default" : "outline"}
                    className={`h-8 w-8 ${currentPage === i + 1 ? 'bg-teal-600 hover:bg-teal-700 border-0' : 'bg-white'}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT SLIDE-OUT PANEL */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" 
            />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingId ? "Edit Unit" : "Add New Unit"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-white hover:shadow-sm rounded-full transition-all"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form id="uom-form" onSubmit={handleSubmit} className="space-y-6">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Unit Name <span className="text-rose-500">*</span></label>
                      <input required type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Kilograms" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Unit Code <span className="text-rose-500">*</span></label>
                      <input required type="text" name="abbreviation" value={formData.abbreviation} onChange={handleInputChange} placeholder="e.g., KG" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm uppercase" />
                      <p className="text-[10px] text-slate-500 mt-1">Short code for the unit</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Unit Type <span className="text-rose-500">*</span></label>
                    <select required name="unit_type" value={formData.unit_type} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm bg-white">
                      <option value="Count">Count</option>
                      <option value="Weight">Weight</option>
                      <option value="Volume">Volume</option>
                      <option value="Length">Length</option>
                      <option value="Packaging">Packaging</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Choose the type of measurement</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Base Unit</label>
                    <div className="flex gap-4 items-center">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="base_unit" value="true" checked={formData.base_unit === true} onChange={handleInputChange} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="font-semibold text-slate-700">Yes (Base Unit)</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="base_unit" value="false" checked={formData.base_unit === false} onChange={handleInputChange} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="font-semibold text-slate-700">No</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">Base unit is the primary unit for conversion</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Conversion Rate <span className="text-rose-500">*</span></label>
                    <input required type="number" step="0.000001" name="conversion_rate" value={formData.conversion_rate} onChange={handleInputChange} placeholder="e.g., 1" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm" />
                    <div className="mt-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                      <div className="mt-0.5"><div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-600 font-bold">i</div></div>
                      <p className="text-xs text-blue-800">
                        Enter how this unit converts to its base unit.<br/>
                        <span className="font-semibold">Example: 1 KG = 1000 G (Conversion rate for G is 0.001)</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Unit Symbol</label>
                    <input type="text" name="unit_symbol" value={formData.unit_symbol} onChange={handleInputChange} placeholder="e.g., kg, pcs, m" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm" />
                    <p className="text-[10px] text-slate-500 mt-1">Symbol used in displays and documents</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Description</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} placeholder="Enter description (optional)" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm resize-none"></textarea>
                    <p className="text-[10px] text-slate-500 mt-1">Additional information about this unit</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Status</label>
                    <div className="flex gap-4 items-center">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="status" value="active" checked={formData.status === 'active'} onChange={handleInputChange} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="font-semibold text-slate-700">Active</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="status" value="inactive" checked={formData.status === 'inactive'} onChange={handleInputChange} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="font-semibold text-slate-700">Inactive</span>
                      </label>
                    </div>
                  </div>

                </form>
              </div>

              <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm">Cancel</button>
                <button type="submit" form="uom-form" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 rounded-lg transition-all">
                  {isSubmitting ? 'Saving...' : 'Save Unit'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}