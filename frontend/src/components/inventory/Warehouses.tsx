import { useState, useEffect } from "react";
import { inventoryApi, type Warehouse } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Warehouse as WarehouseIcon, Users, Loader2, X, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const WAREHOUSE_TYPES = ["Distribution Center", "Fulfillment Center", "Cold Storage", "Retail Store", "Transit Hub", "Dark Store"];
const TEMP_CONTROLS = ["Ambient", "Temperature-Controlled", "Cold Chain", "Frozen", "Deep Freeze"];

const defaultForm = {
  name: "", warehouse_type: "Distribution Center", capacity: "",
  address: "", manager_name: "", employees: 0,
  temperature_control: "Ambient", status: "Active",
};

export function Warehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(defaultForm);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => handleDelete(wh.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <WarehouseIcon className="w-5 h-5 text-indigo-600" /> Create New Warehouse
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <form id="warehouse-form" onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Warehouse Name *</label>
                      <input required type="text" name="name" value={formData.name} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Mumbai Central Hub" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type *</label>
                      <select name="warehouse_type" value={formData.warehouse_type} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        {WAREHOUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Temperature Control</label>
                      <select name="temperature_control" value={formData.temperature_control} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        {TEMP_CONTROLS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Capacity (sqft)</label>
                      <input type="text" name="capacity" value={formData.capacity} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. 50,000 sqft" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Staff Count</label>
                      <input type="number" name="employees" value={formData.employees} onChange={handleInputChange} min={0}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Manager Name</label>
                      <input type="text" name="manager_name" value={formData.manager_name} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Ravi Kumar" />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Address</label>
                      <input type="text" name="address" value={formData.address} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. 123 Industrial Area, Mumbai - 400001" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                      <select name="status" value={formData.status} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Under Maintenance">Under Maintenance</option>
                      </select>
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" form="warehouse-form" disabled={isSubmitting}
                  className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-2">
                  {isSubmitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : 'Create Warehouse'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
