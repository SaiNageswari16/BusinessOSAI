import { useState, useEffect } from "react";
import { inventoryApi, type StorageLocation, type Warehouse } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, MapPin, Loader2, Search, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";

const ZONES = ["Receiving", "Storage", "Pick & Pack", "Dispatch", "Returns", "Quarantine", "Cold Storage", "Hazmat"];
const STATUSES = ["Available", "Occupied", "Reserved", "Blocked"];

const defaultForm = {
  warehouse_id: "", zone: "Storage", aisle: "", rack: "", shelf: "", bin: "", level: "",
  barcode: "", status: "Available",
};

export function StorageLocations() {
    const { currency, formatCurrency } = useCurrency();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [locationsData, warehousesData] = await Promise.all([
        inventoryApi.getStorageLocations(),
        inventoryApi.getWarehouses()
      ]);
      setLocations(locationsData);
      setWarehouses(warehousesData);
      // Pre-select first warehouse in form
      if (warehousesData.length > 0) {
        setFormData(prev => ({ ...prev, warehouse_id: warehousesData[0].id }));
      }
    } catch (error) {
      console.error("Failed to fetch storage locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWarehouseName = (id: string) => {
    const wh = warehouses.find(w => w.id === id);
    return wh ? wh.name : "Unknown Warehouse";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenModal = () => {
    if (warehouses.length === 0) {
      alert("Please create a Warehouse first before adding locations.");
      return;
    }
    setFormData({ ...defaultForm, warehouse_id: warehouses[0].id });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouse_id) {
      alert("Please select a warehouse.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { warehouse_id, ...rest } = formData;
      const newLoc = await inventoryApi.createStorageLocation(warehouse_id, rest);
      setLocations(prev => [newLoc, ...prev]);
      setIsModalOpen(false);
      setFormData({ ...defaultForm, warehouse_id: warehouses[0].id });
    } catch (error) {
      console.error("Failed to create storage location:", error);
      alert("Failed to create storage location. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this storage location?")) return;
    try {
      await inventoryApi.deleteStorageLocation(id);
      setLocations(prev => prev.filter(l => l.id !== id));
    } catch {
      alert("Failed to delete location.");
    }
  };

  const filtered = locations.filter(loc => {
    const matchesSearch = !search || (loc.barcode || "").toLowerCase().includes(search.toLowerCase()) || (loc.zone || "").toLowerCase().includes(search.toLowerCase());
    const matchesWarehouse = !filterWarehouse || loc.warehouse_id === filterWarehouse;
    return matchesSearch && matchesWarehouse;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Storage Locations</h2>
          <p className="text-sm text-muted-foreground">Manage precise warehouse storage hierarchy: Zone → Aisle → Rack → Shelf → Bin.</p>
        </div>
        <Button onClick={handleOpenModal} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Add Location
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search by barcode or zone..."
          />
        </div>
        <select
          value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)}
          className="h-10 px-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
        >
          <option value="">All Warehouses</option>
          {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Location Barcode</th>
              <th className="px-6 py-4">Warehouse</th>
              <th className="px-6 py-4">Zone</th>
              <th className="px-6 py-4">Aisle / Rack / Shelf / Bin</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  {locations.length === 0
                    ? "No storage locations found. Click 'Add Location' to create one."
                    : "No locations match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((loc) => (
                <tr key={loc.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" /> {loc.barcode || '-'}
                  </td>
                  <td className="px-6 py-4 font-medium">{getWarehouseName(loc.warehouse_id)}</td>
                  <td className="px-6 py-4">{loc.zone || '-'}</td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {[loc.aisle, loc.rack, loc.shelf, loc.bin].filter(Boolean).join(' / ') || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      loc.status === 'Available' ? 'bg-emerald-500/10 text-emerald-600'
                      : loc.status === 'Occupied' ? 'bg-blue-500/10 text-blue-600'
                      : loc.status === 'Reserved' ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-rose-500/10 text-rose-600'
                    }`}>
                      {loc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(loc.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE LOCATION MODAL */}
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
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-600" /> Add Storage Location
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <form id="location-form" onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Parent Warehouse *</label>
                      <select required name="warehouse_id" value={formData.warehouse_id} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">Select Warehouse...</option>
                        {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Zone *</label>
                      <select required name="zone" value={formData.zone} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                      <select name="status" value={formData.status} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aisle</label>
                      <input type="text" name="aisle" value={formData.aisle} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. A1" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rack</label>
                      <input type="text" name="rack" value={formData.rack} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. R3" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Shelf</label>
                      <input type="text" name="shelf" value={formData.shelf} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. S2" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bin</label>
                      <input type="text" name="bin" value={formData.bin} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. B001" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Level</label>
                      <input type="text" name="level" value={formData.level} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. L1" />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location Barcode</label>
                      <input type="text" name="barcode" value={formData.barcode} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        placeholder="e.g. LOC-A1-R3-S2-B001 (auto-generated if empty)" />
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" form="location-form" disabled={isSubmitting}
                  className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-2">
                  {isSubmitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : 'Add Location'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
