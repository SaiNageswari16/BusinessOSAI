import { useState, useEffect, useMemo } from "react";
import { inventoryApi, type Warehouse } from "../../lib/api-client";
import { Button } from "../ui/button";
import { 
  Plus, Warehouse as WarehouseIcon, Users, Loader2, X, Trash2, Eye, 
  Pencil, Copy, Box, MapPin, Search, Filter, ArrowUpDown, ChevronRight,
  ShieldCheck, Thermometer, Building2, CheckCircle2, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const WAREHOUSE_TYPES = ["All Types", "Distribution Center", "Fulfillment Center", "Cold Storage", "Retail Store", "Transit Hub", "Dark Store"];
const TEMP_CONTROLS = ["Ambient", "Temperature-Controlled", "Cold Chain", "Frozen", "Deep Freeze"];

const defaultForm = {
  name: "", warehouse_type: "Distribution Center", capacity: "",
  address: "", manager_name: "", employees: 0,
  temperature_control: "Ambient", status: "Active",
};

export function Warehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sortField, setSortField] = useState<"name" | "capacity" | "employees">("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [viewingWarehouse, setViewingWarehouse] = useState<Warehouse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [activeModalTab, setActiveModalTab] = useState("basic");

  useEffect(() => { fetchWarehouses(); }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getWarehouses();
      setWarehouses(data);
    } catch (error) {
      console.error("Failed to fetch warehouses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "number" ? Number(value) : value }));
  };

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setFormData(defaultForm);
    setActiveModalTab("basic");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormData({
      name: wh.name || "",
      warehouse_type: wh.warehouse_type || "Distribution Center",
      capacity: wh.capacity ? String(wh.capacity) : "",
      address: wh.address || "",
      manager_name: wh.manager_name || "",
      employees: wh.employees || 0,
      temperature_control: wh.temperature_control || "Ambient",
      status: wh.status || "Active",
    });
    setActiveModalTab("basic");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingWarehouse) {
        // @ts-ignore
        const updated = await inventoryApi.createWarehouse({ ...formData });
        setWarehouses(prev => prev.map(w => w.id === editingWarehouse.id ? { ...w, ...formData } : w));
      } else {
        const newWh = await inventoryApi.createWarehouse({ ...formData });
        setWarehouses(prev => [newWh, ...prev]);
      }
      setIsModalOpen(false);
      setEditingWarehouse(null);
      setFormData(defaultForm);
    } catch (error) {
      console.error("Failed to save warehouse:", error);
      alert("Failed to save warehouse. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this warehouse? This cannot be undone.")) return;
    try {
      await inventoryApi.deleteWarehouse(id);
      setWarehouses(prev => prev.filter(w => w.id !== id));
      if (viewingWarehouse?.id === id) setViewingWarehouse(null);
    } catch {
      alert("Failed to delete warehouse.");
    }
  };

  const handleDuplicate = async (wh: Warehouse) => {
    const dup = { ...wh, name: `${wh.name} (Copy)` };
    // @ts-ignore
    delete dup.id; delete dup.created_at; delete dup.updated_at; delete dup.locations;
    try {
      const created = await inventoryApi.createWarehouse(dup);
      setWarehouses(prev => [created, ...prev]);
    } catch { 
      alert("Duplicate failed."); 
    }
  };

  // Filter and Sort
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(wh => {
      const matchesSearch = 
        wh.name?.toLowerCase().includes(search.toLowerCase()) ||
        wh.warehouse_type?.toLowerCase().includes(search.toLowerCase()) ||
        wh.manager_name?.toLowerCase().includes(search.toLowerCase()) ||
        wh.address?.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = typeFilter === "All Types" || wh.warehouse_type === typeFilter;
      const matchesStatus = statusFilter === "All Status" || wh.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    }).sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [warehouses, search, typeFilter, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: "name" | "capacity" | "employees") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-none">
              Warehouses
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
              {warehouses.length} Facilities
            </span>
          </div>
          <p className="text-[13px] font-medium text-slate-500 mt-1.5 leading-normal">
            Manage distribution centers, fulfillment hubs, retail stores, and cold chains.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm"
            onClick={handleOpenCreate} 
            className="h-9 px-3.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="size-4 mr-1.5" /> Add Warehouse
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
            placeholder="Search warehouses by name, type, manager, or address..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50/80 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 px-2.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {WAREHOUSE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="All Status">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Under Maintenance">Under Maintenance</option>
          </select>
        </div>
      </div>

      {/* ── Warehouses Columns & Rows Table ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="size-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading warehouse facilities...</p>
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <div className="text-center p-14 border border-dashed rounded-2xl bg-slate-50/50">
          <WarehouseIcon className="size-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-800">No warehouses matched your criteria</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">Try clearing filters or add a new warehouse facility.</p>
          <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg h-9">
            <Plus className="size-4 mr-1.5" /> Add Warehouse
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 select-none">
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => toggleSort("name")}>
                    <div className="flex items-center gap-1.5">
                      <span>Warehouse Name & Type</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => toggleSort("capacity")}>
                    <div className="flex items-center gap-1.5">
                      <span>Capacity</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Temperature Control</th>
                  <th className="py-3 px-4">Manager & Address</th>
                  <th className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors" onClick={() => toggleSort("employees")}>
                    <div className="flex items-center gap-1.5">
                      <span>Staff</span>
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredWarehouses.map((wh) => (
                  <tr 
                    key={wh.id} 
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => setViewingWarehouse(wh)}
                  >
                    {/* Warehouse Name & Type */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                          <WarehouseIcon className="size-4.5" />
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-[13px] leading-snug group-hover:text-blue-600 transition-colors">
                            {wh.name}
                          </div>
                          <div className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold uppercase text-[9.5px]">
                              {wh.warehouse_type || "Facility"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Capacity */}
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {wh.capacity ? (
                        <span>{wh.capacity}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>

                    {/* Temperature Control */}
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold",
                        wh.temperature_control?.includes("Cold") || wh.temperature_control?.includes("Frozen")
                          ? "bg-cyan-50 text-cyan-700 border border-cyan-200/80"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                      )}>
                        <Thermometer className="size-3" />
                        {wh.temperature_control || "Ambient"}
                      </span>
                    </td>

                    {/* Manager & Address */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-bold text-slate-800 truncate">{wh.manager_name || "Unassigned"}</div>
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{wh.address || "No address specified"}</span>
                      </div>
                    </td>

                    {/* Staff Count */}
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1 text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                        <Users className="size-3 text-slate-500" />
                        <span>{wh.employees ?? 0}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold",
                        wh.status === "Active" 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80" 
                          : wh.status === "Inactive"
                          ? "bg-amber-50 text-amber-700 border border-amber-200/80"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      )}>
                        <span className={cn(
                          "size-1.5 rounded-full",
                          wh.status === "Active" ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        {wh.status || "Active"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingWarehouse(wh)}
                          className="size-8 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition cursor-pointer"
                          title="View Warehouse Details"
                        >
                          <Eye className="size-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(wh)}
                          className="size-8 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center transition cursor-pointer"
                          title="Edit Warehouse"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(wh)}
                          className="size-8 rounded-lg text-slate-500 hover:bg-purple-50 hover:text-purple-600 flex items-center justify-center transition cursor-pointer"
                          title="Duplicate Warehouse"
                        >
                          <Copy className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(wh.id)}
                          className="size-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                          title="Delete Warehouse"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Showing {filteredWarehouses.length} of {warehouses.length} warehouse facilities</span>
            <span className="font-semibold text-slate-700">Click any row to view full specifications</span>
          </div>
        </div>
      )}

      {/* ── VIEW WAREHOUSE DETAILS MODAL ── */}
      <AnimatePresence>
        {viewingWarehouse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <WarehouseIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 leading-tight">{viewingWarehouse.name}</h3>
                    <span className="text-[11px] text-slate-500 font-semibold">{viewingWarehouse.warehouse_type}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingWarehouse(null)} 
                  className="size-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10.5px] font-extrabold text-slate-400 uppercase">Capacity</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">{viewingWarehouse.capacity || "Not specified"}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10.5px] font-extrabold text-slate-400 uppercase">Temperature Control</div>
                    <div className="text-sm font-black text-blue-600 mt-0.5">{viewingWarehouse.temperature_control || "Ambient"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10.5px] font-extrabold text-slate-400 uppercase">Manager</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{viewingWarehouse.manager_name || "Unassigned"}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10.5px] font-extrabold text-slate-400 uppercase">Staff Count</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">{viewingWarehouse.employees ?? 0} Employees</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10.5px] font-extrabold text-slate-400 uppercase">Address / Location</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">{viewingWarehouse.address || "No address provided."}</div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500">Operational Status</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {viewingWarehouse.status || "Active"}
                  </span>
                </div>
              </div>

              <div className="p-4 border-t bg-slate-50 flex items-center justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const target = viewingWarehouse;
                    setViewingWarehouse(null);
                    handleOpenEdit(target);
                  }}
                  className="text-xs font-bold"
                >
                  <Pencil className="size-3.5 mr-1" /> Edit
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setViewingWarehouse(null)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREATE / EDIT WAREHOUSE MODAL ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-4xl h-[70vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <WarehouseIcon className="size-4.5" />
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">
                    {editingWarehouse ? "Edit Warehouse" : "Create New Warehouse"}
                  </h2>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setIsModalOpen(false); setEditingWarehouse(null); setFormData(defaultForm); setActiveModalTab("basic"); }} 
                  className="p-1.5 rounded-lg hover:bg-muted cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
              
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-slate-50 border-r flex flex-col overflow-y-auto shrink-0 p-4">
                  <div className="space-y-1.5 flex-1">
                    {[
                      { id: "basic", label: "Basic Details", desc: "Name, Type, Status", icon: WarehouseIcon },
                      { id: "capacity", label: "Capacity & Environment", desc: "Size, Temperature", icon: Box },
                      { id: "management", label: "Management & Location", desc: "Manager, Staff, Address", icon: Users }
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeModalTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveModalTab(tab.id)}
                          className={cn(
                            "w-full text-left p-2.5 rounded-xl flex gap-3 transition-colors cursor-pointer",
                            isActive ? "bg-blue-50 border border-blue-200 text-blue-900" : "hover:bg-slate-100 border border-transparent text-slate-700"
                          )}
                        >
                          <div className={cn(
                            "shrink-0 p-2 rounded-lg",
                            isActive ? "bg-blue-600 text-white" : "bg-white border text-slate-500"
                          )}>
                            <Icon className="size-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold leading-tight">{tab.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{tab.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form Area */}
                <form id="warehouse-form" onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-white">
                  <div className="flex-1 overflow-y-auto p-6">
                    {activeModalTab === "basic" && (
                      <div className="space-y-5 max-w-xl">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Basic Details</h3>
                          <p className="text-xs text-slate-500 mb-4">Enter core identity information about the storage facility.</p>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Warehouse Name <span className="text-red-500">*</span></label>
                          <input 
                            required 
                            type="text" 
                            name="name" 
                            value={formData.name} 
                            onChange={handleInputChange}
                            className="w-full h-10 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                            placeholder="e.g. Mumbai Central Fulfillment Hub" 
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">Warehouse Type <span className="text-red-500">*</span></label>
                            <select 
                              name="warehouse_type" 
                              value={formData.warehouse_type} 
                              onChange={handleInputChange}
                              className="w-full h-10 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                            >
                              {WAREHOUSE_TYPES.filter(t => t !== "All Types").map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">Operational Status <span className="text-red-500">*</span></label>
                            <select 
                              name="status" 
                              value={formData.status} 
                              onChange={handleInputChange}
                              className="w-full h-10 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                            >
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Under Maintenance">Under Maintenance</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeModalTab === "capacity" && (
                      <div className="space-y-5 max-w-xl">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Capacity & Environment</h3>
                          <p className="text-xs text-slate-500 mb-4">Set storage capacity and climate settings.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">Capacity (sqft / pallet)</label>
                            <input 
                              type="text" 
                              name="capacity" 
                              value={formData.capacity} 
                              onChange={handleInputChange}
                              className="w-full h-10 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                              placeholder="e.g. 50,000 sqft" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">Temperature Control</label>
                            <select 
                              name="temperature_control" 
                              value={formData.temperature_control} 
                              onChange={handleInputChange}
                              className="w-full h-10 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                            >
                              {TEMP_CONTROLS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeModalTab === "management" && (
                      <div className="space-y-5 max-w-xl">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">Management & Location</h3>
                          <p className="text-xs text-slate-500 mb-4">Assign warehouse manager, staff count, and physical address.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">Manager Name</label>
                            <input 
                              type="text" 
                              name="manager_name" 
                              value={formData.manager_name} 
                              onChange={handleInputChange}
                              className="w-full h-10 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                              placeholder="e.g. Ravi Kumar" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">Staff Count</label>
                            <input 
                              type="number" 
                              name="employees" 
                              value={formData.employees} 
                              onChange={handleInputChange} 
                              min={0}
                              className="w-full h-10 px-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold" 
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">Physical Address</label>
                          <textarea 
                            name="address" 
                            value={formData.address} 
                            onChange={handleInputChange} 
                            rows={3}
                            className="w-full p-3 text-xs rounded-xl border bg-background focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-medium"
                            placeholder="e.g. Plot 42, Logistics Park, Mumbai - 400001" 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="p-4 border-t bg-slate-50 flex items-center justify-between shrink-0">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="font-semibold bg-white hover:bg-slate-100" 
                      onClick={() => { setIsModalOpen(false); setEditingWarehouse(null); setFormData(defaultForm); setActiveModalTab("basic"); }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      size="sm"
                      disabled={isSubmitting} 
                      className="font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all border-0 cursor-pointer"
                    >
                      {isSubmitting ? "Saving..." : (editingWarehouse ? "Save Changes" : "Create Warehouse")}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
