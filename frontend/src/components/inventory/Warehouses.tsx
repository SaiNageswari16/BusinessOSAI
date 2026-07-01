import { inventoryWarehouses } from "../../data/inventory-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Warehouse as WarehouseIcon, MapPin, Users } from "lucide-react";

export function Warehouses() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Warehouses</h2>
          <p className="text-sm text-muted-foreground">Manage distribution centers, hubs, and stores.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Warehouse</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventoryWarehouses.map((wh) => (
          <Card key={wh.id} className="p-6 relative overflow-hidden">
            <div className="flex items-start gap-4 mb-6">
              <div className="size-12 rounded-lg bg-blue-500/10 text-blue-600 grid place-items-center shrink-0">
                <WarehouseIcon className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{wh.name}</h3>
                <span className="text-[10px] uppercase font-bold text-muted-foreground mt-1 block">{wh.type}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Capacity</div>
                <div className="text-sm font-bold">{wh.capacity}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Utilization</div>
                <div className="text-sm font-bold text-primary">{wh.utilization}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold">Manager</div>
                <div className="text-sm font-bold">{wh.manager}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1"><Users className="size-3" /> Staff</div>
                <div className="text-sm font-bold">{wh.employees}</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                {wh.status}
              </span>
              <Button variant="outline" size="sm">View Details</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
