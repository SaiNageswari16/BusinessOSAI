import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Activity, Clock, ShieldCheck, Truck, RefreshCw } from "lucide-react";

export function SupplierPerformance() {
  const stats = [
    { label: "Delivery Accuracy", value: "98.5%", icon: Truck, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Quality Score", value: "94.2%", icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Avg Response Time", value: "2.4 hrs", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Return Rate", value: "1.2%", icon: RefreshCw, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Supplier Performance</h2>
          <p className="text-sm text-muted-foreground">Monitor KPIs like delivery accuracy, quality, and returns.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s, i) => (
          <Card key={i} className="p-5 flex items-center gap-4 border-t-4" style={{ borderTopColor: 'var(--border)' }}>
            <div className={`size-12 rounded-xl grid place-items-center ${s.bg}`}>
              <s.icon className={`size-6 ${s.color}`} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold">{s.label}</div>
              <div className="text-2xl font-bold font-mono">{s.value}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 min-h-[300px] flex items-center justify-center border-dashed bg-muted/20">
        <div className="text-center">
          <Activity className="size-10 text-muted-foreground mx-auto mb-3 opacity-20" />
          <h3 className="font-bold">Historical Performance Dashboard</h3>
          <p className="text-sm text-muted-foreground mt-1">Interactive charts will load here based on 6 months of procurement data.</p>
        </div>
      </Card>
    </div>
  );
}
