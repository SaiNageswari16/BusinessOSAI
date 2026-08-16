import { useState, useEffect } from "react";
import { inventoryApi, type Warehouse } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Warehouse as WarehouseIcon, Users, Loader2, X, Trash2, Eye, Pencil, Copy, Box, MapPin, Building, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";

const WAREHOUSE_TYPES = ["Distribution Center", "Fulfillment Center", "Cold Storage", "Retail Store", "Transit Hub", "Dark Store"];
const TEMP_CONTROLS = ["Ambient", "Temperature-Controlled", "Cold Chain", "Frozen", "Deep Freeze"];

const defaultForm = {
  name: "", warehouse_type: "Distribution Center", capacity: "",
  address: "", manager_name: "", employees: 0,
  temperature_control: "Ambient", status: "Active",
};

export function Warehouses() {
    const { currency, formatCurrency } = useCurrency();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newWh = await inventoryApi.createWarehouse({ ...formData });
      setWarehouses(prev => [newWh, ...prev]);
      setIsModalOpen(false);
      setFormData(defaultForm);
    } catch (error) {
      console.error("Failed to create warehouse:", error);
      alert("Failed to create warehouse. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this warehouse? This cannot be undone.")) return;
    try {
      await inventoryApi.deleteWarehouse(id);
      setWarehouses(prev => prev.filter(w => w.id !== id));
    } catch {
      alert("Failed to delete warehouse.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Warehouses</h2>
          <p className="text-sm text-muted-foreground">Manage distribution centers, hubs, and stores.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Add Warehouse
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : warehouses.length === 0 ? (
        <div className="text-center p-12 border rounded-xl bg-muted/20">
          <WarehouseIcon className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No warehouses found</h3>
          <p className="text-muted-foreground mb-4">Click 'Add Warehouse' to create your first storage facility.</p>
          <Button onClick={() => setIsModalOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-2" /> Create First Warehouse
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((wh) => (
            <Card key={wh.id} className="p-6 relative overflow-hidden group">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-lg bg-blue-500/10 text-blue-600 grid place-items-center shrink-0">
                    <WarehouseIcon className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{wh.name}</h3>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mt-1 block">{wh.warehouse_type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => alert(`Warehouse: ${wh.name}\nType: ${wh.warehouse_type}\nCapacity: ${wh.capacity || '-'}\nTemperature: ${wh.temperature_control || '-'}\nManager: ${wh.manager_name || '-'}\nStaff: ${wh.employees ?? 0}\nAddress: ${wh.address || '-'}\nStatus: ${wh.status}`)}
                    className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                    title="View details"
                  >
                    <Eye className="size-4" />
                  </button>
                  <button
                    onClick={() => alert("Edit warehouse form coming soon — use the existing backend mutation if needed.")}
                    className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                    title="Edit"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={async () => {
                      const dup = { ...wh };
                      // @ts-ignore
                      delete dup.id; delete dup.created_at; delete dup.updated_at; delete dup.locations;
                      try {
                        const created = await inventoryApi.createWarehouse(dup);
                        setWarehouses(prev => [created, ...prev]);
                      } catch { alert("Duplicate failed."); }
                    }}
                    className="h-8 w-8 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 inline-flex items-center justify-center transition"
                    title="Duplicate"
                  >
                    <Copy className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    className="h-8 w-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 inline-flex items-center justify-center transition"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold">Capacity</div>
                  <div className="text-sm font-bold">{wh.capacity || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold">Temperature</div>
                  <div className="text-sm font-bold text-primary">{wh.temperature_control || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold">Manager</div>
                  <div className="text-sm font-bold">{wh.manager_name || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1"><Users className="size-3" /> Staff</div>
                  <div className="text-sm font-bold">{wh.employees ?? 0}</div>
                </div>
              </div>
              {wh.address && <p className="text-xs text-muted-foreground mb-4 truncate">{wh.address}</p>}
              
              <div className="flex justify-between items-center pt-4 border-t">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  wh.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                }`}>
                  {wh.status}
                </span>
                <Button variant="outline" size="sm">View Details</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE WAREHOUSE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-5xl h-[70vh] flex flex-col overflow-hidden">
              
              {/* Header */}
              <div className="p-6 border-b flex items-center justify-between shrink-0 bg-white">
                <h2 className="text-xl font-bold tracking-tight">Create New Warehouse</h2>
                <button type="button" onClick={() => { setIsModalOpen(false); setFormData(defaultForm); setActiveModalTab("basic"); }} className="p-1.5 rounded-lg hover:bg-muted"><X className="size-5" /></button>
              </div>
              
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-72 bg-slate-50 border-r flex flex-col overflow-y-auto shrink-0 p-4">
                  <div className="space-y-2 flex-1">
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
                          className={`w-full text-left p-3 rounded-xl flex gap-3 transition-colors ${
                            isActive ? "bg-indigo-50 border border-indigo-100" : "hover:bg-muted border border-transparent"
                          }`}
                        >
                          <div className={`shrink-0 p-2 rounded-lg ${isActive ? "bg-indigo-100 text-indigo-700" : "bg-white border text-slate-500"}`}>
                            <Icon className="size-5" />
                          </div>
                          <div>
                            <div className={`text-sm font-semibold ${isActive ? "text-indigo-900" : "text-slate-700"}`}>{tab.label}</div>
                            <div className={`text-xs ${isActive ? "text-indigo-600" : "text-slate-500"}`}>{tab.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3">
                    <ShieldCheck className="size-5 text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-indigo-900 mb-1">Security</div>
                      <div className="text-xs text-indigo-700 leading-relaxed">Warehouses control access to stock items. Ensure details are correct.</div>
                    </div>
                  </div>
                </div>

                {/* Form Area */}
                <form id="warehouse-form" onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-white">
                  <div className="flex-1 overflow-y-auto p-8">
                    
                    {activeModalTab === "basic" && (
                      <div className="space-y-6 max-w-2xl">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Basic Details</h3>
                          <p className="text-sm text-slate-500 mb-6">Enter core information about the warehouse.</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-1.5">Warehouse Name <span className="text-red-500">*</span></label>
                          <input required type="text" name="name" value={formData.name} onChange={handleInputChange}
                            className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. Mumbai Central Hub" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Type <span className="text-red-500">*</span></label>
                            <select name="warehouse_type" value={formData.warehouse_type} onChange={handleInputChange}
                              className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                              {WAREHOUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Status <span className="text-red-500">*</span></label>
                            <select name="status" value={formData.status} onChange={handleInputChange}
                              className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Under Maintenance">Under Maintenance</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeModalTab === "capacity" && (
                      <div className="space-y-6 max-w-2xl">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Capacity & Environment</h3>
                          <p className="text-sm text-slate-500 mb-6">Set storage capacity and climate settings.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Capacity (sqft)</label>
                            <input type="text" name="capacity" value={formData.capacity} onChange={handleInputChange}
                              className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              placeholder="e.g. 50,000 sqft" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Temperature Control</label>
                            <select name="temperature_control" value={formData.temperature_control} onChange={handleInputChange}
                              className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all">
                              {TEMP_CONTROLS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeModalTab === "management" && (
                      <div className="space-y-6 max-w-2xl">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">Management & Location</h3>
                          <p className="text-sm text-slate-500 mb-6">Assign managers and specific locations.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Manager Name</label>
                            <input type="text" name="manager_name" value={formData.manager_name} onChange={handleInputChange}
                              className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              placeholder="e.g. Ravi Kumar" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Staff Count</label>
                            <input type="number" name="employees" value={formData.employees} onChange={handleInputChange} min={0}
                              className="w-full h-11 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-1.5">Address</label>
                          <textarea name="address" value={formData.address} onChange={handleInputChange} rows={3}
                            className="w-full p-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                            placeholder="e.g. 123 Industrial Area, Mumbai - 400001" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="p-5 border-t bg-slate-50 flex items-center justify-between shrink-0">
                    <Button type="button" variant="outline" className="h-11 px-6 rounded-xl font-semibold bg-white hover:bg-slate-100" onClick={() => { setIsModalOpen(false); setFormData(defaultForm); setActiveModalTab("basic"); }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="h-11 px-6 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all border-0">
                      {isSubmitting ? "Creating..." : "Create Warehouse"}
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
