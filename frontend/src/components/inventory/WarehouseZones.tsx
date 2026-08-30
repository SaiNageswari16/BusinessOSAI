import { useState, useEffect } from "react";
import { inventoryApi, type StorageLocation, type Warehouse } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Grid, Loader2, ChevronRight, Package, MapPin, Eye, Box, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCurrency } from "@/hooks/use-currency";

const ZONE_META: Record<string, { color: string; bg: string; description: string }> = {
  "Receiving":     { color: "text-sky-600",     bg: "bg-sky-500/10",     description: "Inbound staging & quality check" },
  "Storage":       { color: "text-emerald-600", bg: "bg-emerald-500/10", description: "General long-term storage" },
  "Pick & Pack":   { color: "text-indigo-600",  bg: "bg-indigo-500/10",  description: "Pick faces & packing area" },
  "Dispatch":      { color: "text-amber-600",   bg: "bg-amber-500/10",   description: "Outbound shipping dock" },
  "Returns":       { color: "text-rose-600",    bg: "bg-rose-500/10",    description: "Reverse logistics & inspection" },
  "Quarantine":    { color: "text-red-700",     bg: "bg-red-500/10",     description: "On-hold inventory" },
  "Cold Storage":  { color: "text-cyan-600",    bg: "bg-cyan-500/10",    description: "Temperature-controlled" },
  "Hazmat":        { color: "text-orange-600",  bg: "bg-orange-500/10",  description: "Hazardous materials" },
};

export function WarehouseZones() {
    const { currency, formatCurrency } = useCurrency();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Derive zones per warehouse from storage locations.
  const zones = new Map<string, { zone: string; warehouse: string; warehouseId: string; count: number; available: number; racks: Set<string> }>();
  for (const loc of locations) {
    if (!loc.zone) continue;
    const key = `${loc.warehouse_id}::${loc.zone}`;
    const existing = zones.get(key);
    if (existing) {
      existing.count++;
      if (loc.status === "Available") existing.available++;
      if (loc.rack) existing.racks.add(loc.rack);
    } else {
      zones.set(key, {
        zone: loc.zone,
        warehouse: warehouses.find(w => w.id === loc.warehouse_id)?.name || "Unknown",
        warehouseId: loc.warehouse_id,
        count: 1,
        available: loc.status === "Available" ? 1 : 0,
        racks: new Set(loc.rack ? [loc.rack] : []),
      });
    }
  }
  const zoneRows = Array.from(zones.values()).sort((a, b) => a.warehouse.localeCompare(b.warehouse) || a.zone.localeCompare(b.zone));

  // Group zones by warehouse for header cards
  const byWarehouse = new Map<string, { name: string; count: number; racks: number }>();
  for (const z of zoneRows) {
    const e = byWarehouse.get(z.warehouseId);
    if (e) {
      e.count++;
      e.racks += z.racks.size;
    } else {
      byWarehouse.set(z.warehouseId, { name: z.warehouse, count: 1, racks: z.racks.size });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Warehouse Zones</h2>
        <p className="text-sm text-muted-foreground">Define logical processing zones (Receiving, Put-away, Picking, Dispatch).</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : zoneRows.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <Grid className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No zones defined yet</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Zones are derived from your storage locations. Add locations with a Zone to start grouping inventory.
          </p>
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
          {/* Summary: per warehouse */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from(byWarehouse.entries()).map(([whId, info]) => (
              <Card key={whId} className="p-4">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Warehouse</div>
                <div className="text-lg font-bold mt-1">{info.name}</div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Zones</div>
                    <div className="text-sm font-bold">{info.count}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Racks</div>
                    <div className="text-sm font-bold">{info.racks}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Zones table by warehouse */}
          <Card className="overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Warehouse</th>
                  <th className="px-6 py-3">Zone</th>
                  <th className="px-6 py-3">Purpose</th>
                  <th className="px-6 py-3 text-right">Locations</th>
                  <th className="px-6 py-3 text-right">Available</th>
                  <th className="px-6 py-3 text-right">Racks</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {zoneRows.map((z, i) => {
                  const meta = ZONE_META[z.zone] || { color: "text-slate-600", bg: "bg-slate-500/10", description: "Custom zone" };
                  return (
                    <tr key={`${z.warehouseId}-${z.zone}-${i}`} className="hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium">{z.warehouse}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.bg} ${meta.color}`}>
                          <Package className="size-3" /> {z.zone}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground text-xs">{meta.description}</td>
                      <td className="px-6 py-3 text-right font-mono font-bold">{z.count}</td>
                      <td className="px-6 py-3 text-right">
                        <span className="font-mono text-emerald-600 font-bold">{z.available}</span>
                        <span className="text-muted-foreground text-xs"> / {z.count}</span>
                      </td>
                      <td className="px-6 py-3 text-right font-mono">{z.racks.size}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to="/inventory"
                            search={{ tab: "storage_locations" }}
                            className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                            title="Add location in this zone"
                          >
                            <Plus className="size-4" />
                          </Link>
                          <Link
                            to="/inventory"
                            search={{ tab: "racks" }}
                            className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                            title="View racks"
                          >
                            <Eye className="size-4" />
                          </Link>
                          <Link
                            to="/inventory"
                            search={{ tab: "bins" }}
                            className="h-8 w-8 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center transition"
                            title="View bins"
                          >
                            <Box className="size-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
