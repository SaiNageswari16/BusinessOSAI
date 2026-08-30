import { useState, useEffect } from "react";
import { inventoryApi, type StorageLocation, type Warehouse } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Loader2, Inbox, MapPin, Search, Filter, Trash2, Eye, Pencil } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCurrency } from "@/hooks/use-currency";

const STATUS_STYLE: Record<string, string> = {
  Available: "bg-emerald-500/10 text-emerald-600",
  Occupied:  "bg-blue-500/10 text-blue-600",
  Reserved:  "bg-amber-500/10 text-amber-600",
  Blocked:   "bg-rose-500/10 text-rose-600",
};

export function Bins() {
    const { currency, formatCurrency } = useCurrency();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [locs, whs] = await Promise.all([
        inventoryApi.getStorageLocations(),
        inventoryApi.getWarehouses(),
      ]);
      setLocations(locs);
      setWarehouses(whs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const whName = (id: string) => warehouses.find(w => w.id === id)?.name || "Unknown";

  const deleteLoc = async (id: string) => {
    if (!confirm("Delete this bin?")) return;
    try {
      await inventoryApi.deleteStorageLocation(id);
      setLocations(prev => prev.filter(l => l.id !== id));
    } catch {
      alert("Failed to delete bin.");
    }
  };

  const allZones: string[] = Array.from(new Set(locations.map(l => l.zone).filter(Boolean) as string[])).sort();

  const filtered = locations.filter(loc => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (loc.barcode || "").toLowerCase().includes(q) ||
      (loc.bin || "").toLowerCase().includes(q) ||
      (loc.rack || "").toLowerCase().includes(q);
    const matchWh = !filterWarehouse || loc.warehouse_id === filterWarehouse;
    const matchZone = !filterZone || loc.zone === filterZone;
    const matchStatus = !filterStatus || loc.status === filterStatus;
    return matchSearch && matchWh && matchZone && matchStatus;
  });

  // Only show bins (rows with a bin value)
  const bins = filtered.filter(l => l.bin);

  // KPIs
  const totalBins = locations.filter(l => l.bin).length;
  const available = locations.filter(l => l.bin && l.status === "Available").length;
  const utilization = totalBins ? Math.round(((totalBins - available) / totalBins) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bins</h2>
        <p className="text-sm text-muted-foreground">Granular bin-level inventory addresses. Each bin is a unique storage micro-location.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : totalBins === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <Inbox className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No bins found</h3>
          <p className="text-muted-foreground mb-4">Add a storage location with a bin value to start tracking at bin level.</p>
          <Link
            to="/inventory"
            search={{ tab: "storage_locations" }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary/90"
          >
            <MapPin className="size-4" /> Add Storage Location
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Bins</div>
              <div className="text-2xl font-bold mt-1">{totalBins}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Available</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{available}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Utilization</div>
              <div className="text-2xl font-bold mt-1">{utilization}%</div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${utilization}%` }} />
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search bin, rack, barcode..."
                className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border bg-card"
              />
            </div>
            <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)} className="h-9 px-3 text-sm rounded-lg border bg-card">
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={filterZone} onChange={e => setFilterZone(e.target.value)} className="h-9 px-3 text-sm rounded-lg border bg-card">
              <option value="">All Zones</option>
              {allZones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 px-3 text-sm rounded-lg border bg-card">
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Reserved">Reserved</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Bin</th>
                  <th className="px-6 py-3">Warehouse</th>
                  <th className="px-6 py-3">Zone</th>
                  <th className="px-6 py-3">Hierarchy</th>
                  <th className="px-6 py-3">Barcode</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bins.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No bins match your filters.</td></tr>
                ) : bins.map((loc) => (
                  <tr key={loc.id} className="hover:bg-muted/30 group">
                    <td className="px-6 py-3 font-mono font-bold text-primary">{loc.bin}</td>
                    <td className="px-6 py-3 font-medium">{whName(loc.warehouse_id)}</td>
                    <td className="px-6 py-3">{loc.zone || '-'}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                      {[loc.aisle, loc.rack, loc.shelf].filter(Boolean).join(' / ') || '-'}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">{loc.barcode || '-'}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[loc.status] || 'bg-muted'}`}>
                        {loc.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => alert(`Bin: ${loc.bin}\nWarehouse: ${whName(loc.warehouse_id)}\nZone: ${loc.zone || '-'}\nRack: ${loc.rack || '-'}\nShelf: ${loc.shelf || '-'}\nStatus: ${loc.status}\nBarcode: ${loc.barcode || '-'}`)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                          title="View bin details"
                        >
                          <Eye className="size-4" />
                        </button>
                        <button
                          onClick={() => alert("Edit bin — open the Storage Locations tab to edit the full record.")}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                          title="Edit bin"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => deleteLoc(loc.id)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 inline-flex items-center justify-center transition"
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
