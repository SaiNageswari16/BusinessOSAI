import { Card } from "../ui/card";
import { Grid } from "lucide-react";

export function WarehouseZones() {
  return <div className="p-6"><h2 className="text-2xl font-bold flex items-center gap-2"><Grid className="size-6 text-primary" /> Warehouse Zones</h2><p className="mt-4 text-muted-foreground">Define logical processing zones (Receiving, Put-away, Picking, Dispatch).</p></div>;
}
