import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, ArrowRight, Truck, MapPin } from "lucide-react";

export function StockTransfer() {
  const data = [
    { id: 1, ref: "TR-2026-0012", date: "Today", from: "Mumbai Central Hub", to: "Pune Buffer", items: 45, status: "In Transit" },
    { id: 2, ref: "TR-2026-0011", date: "Yesterday", from: "Delhi Cold Storage", to: "Bengaluru E-com", items: 120, status: "Completed" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Transfer</h2>
          <p className="text-sm text-muted-foreground">Move inventory between warehouses and store branches.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Transfer</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((tr) => (
          <Card key={tr.id} className="p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="font-bold text-lg text-primary">{tr.ref}</div>
                <div className="text-xs text-muted-foreground">{tr.date} • {tr.items} items</div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                tr.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
              }`}>
                {tr.status === 'In Transit' && <Truck className="size-3" />}
                {tr.status}
              </span>
            </div>

            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-dashed">
              <div className="flex-1">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Source</div>
                <div className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="size-3 text-rose-500" /> {tr.from}</div>
              </div>
              <div className="bg-background rounded-full p-2 border shadow-sm">
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Destination</div>
                <div className="text-sm font-semibold flex items-center justify-end gap-1.5"><MapPin className="size-3 text-emerald-500" /> {tr.to}</div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm">Print DC</Button>
              <Button variant="default" size="sm">Receive Stock</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
