import { useState, useEffect } from "react";
import { inventoryApi, type StorageLocation, type Warehouse } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Loader2, Package, MapPin, Filter, Eye, Box, Pencil, Trash2, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCurrency } from "@/hooks/use-currency";

export function Racks() {
    const { currency, formatCurrency } = useCurrency();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterZone, setFilterZone] = useState("");

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  const whName = (id: string) => warehouses.find(w => w.id === id)?.name || "Unknown";

  const allZones: string[] = Array.from(new Set(locations.map(l => l.zone).filter(Boolean) as string[])).sort();

  const rackMap = new Map<string, { warehouseId: string; warehouse: string; zone: string; rack: string; shelves: Set<string>; bins: number; total: number; available: number }>();
  for (const loc of locations) {
    if (filterZone && loc.zone !== filterZone) continue;
    const key = `${loc.warehouse_id}::${loc.zone}::${loc.rack}`;
    const existing = rackMap.get(key);
    if (existing) {
      existing.total++;
      if (loc.status === "Available") existing.available++;
      if (loc.shelf) existing.shelves.add(loc.shelf);
      existing.bins++;
    } else {
      rackMap.set(key, {
        warehouseId: loc.warehouse_id,
        warehouse: whName(loc.warehouse_id),
        zone: loc.zone || "Unknown",
        rack: loc.rack || "N/A",
        shelves: new Set(loc.shelf ? [loc.shelf] : []),
        bins: 1,
        total: 1,
        available: loc.status === "Available" ? 1 : 0,
      });
    }
  }
  const rackRows = Array.from(rackMap.values()).sort((a, b) =>
    a.warehouse.localeCompare(b.warehouse) || a.zone.localeCompare(b.zone) || a.rack.localeCompare(b.rack)
  );

  const totalLocs = locations.length;
  const totalRacks = rackRows.length;
  const totalAvailable = locations.filter(l => l.status === "Available").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Racks</h2>
        <p className="text-sm text-muted-foreground">Manage rack-level inventory grouping within warehouse zones.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : rackRows.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <Package className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No racks found</h3>
          <p className="text-muted-foreground mb-4">Racks are derived from storage locations that have a rack value.</p>
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
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Locations</div>
              <div className="text-2xl font-bold mt-1">{totalLocs}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Total Racks</div>
              <div className="text-2xl font-bold mt-1">{totalRacks}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Available</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{totalAvailable}</div>
            </Card>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <select
              value={filterZone}
              onChange={e => setFilterZone(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-card"
            >
              <option value="">All Zones</option>
              {allZones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Warehouse</th>
                  <th className="px-6 py-3">Zone</th>
                  <th className="px-6 py-3">Rack</th>
                  <th className="px-6 py-3 text-right">Locations</th>
                  <th className="px-6 py-3 text-right">Available</th>
                  <th className="px-6 py-3 text-right">Shelves</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rackRows.map((r, i) => (
                  <tr key={`${r.warehouseId}-${r.zone}-${r.rack}-${i}`} className="hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">{r.warehouse}</td>
                    <td className="px-6 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted">{r.zone}</span></td>
                    <td className="px-6 py-3 font-mono font-bold">{r.rack}</td>
                    <td className="px-6 py-3 text-right font-mono">{r.total}</td>
                    <td className="px-6 py-3 text-right">
                      <span className="font-mono text-emerald-600 font-bold">{r.available}</span>
                    </td>
                    <td className="px-6 py-3 text-right">{r.shelves.size}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => alert(`Rack ${r.rack}\nWarehouse: ${r.warehouse}\nZone: ${r.zone}\nLocations: ${r.total}\nAvailable: ${r.available}\nShelves: ${r.shelves.size}`)}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                          title="View rack details"
                        >
                          <Eye className="size-4" />
                        </button>
                        <Link
                          to="/inventory"
                          search={{ tab: "storage_locations" }}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 inline-flex items-center justify-center transition"
                          title="Add location in this rack"
                        >
                          <Plus className="size-4" />
                        </Link>
                        <Link
                          to="/inventory"
                          search={{ tab: "bins" }}
                          className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                          title="View bins in this rack"
                        >
                          <Box className="size-4" />
                        </Link>
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
