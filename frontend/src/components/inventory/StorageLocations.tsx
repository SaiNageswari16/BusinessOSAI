import { inventoryLocations } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, MapPin, Search, Filter } from "lucide-react";

export function StorageLocations() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Storage Locations</h2>
          <p className="text-sm text-muted-foreground">Manage precise warehouse storage hierarchy.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Location</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Location Barcode</th>
              <th className="px-6 py-4">Warehouse</th>
              <th className="px-6 py-4">Zone</th>
              <th className="px-6 py-4">Aisle / Rack / Bin</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {inventoryLocations.map((loc) => (
              <tr key={loc.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-primary flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /> {loc.barcode}</td>
                <td className="px-6 py-4 font-medium">{loc.warehouseId}</td>
                <td className="px-6 py-4">{loc.zone}</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{loc.aisle} / {loc.rack} / {loc.bin}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    loc.status === 'Available' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {loc.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
