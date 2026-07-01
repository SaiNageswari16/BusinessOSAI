import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { BarChart3, Package, ShieldCheck, Truck, XCircle, AlertCircle, RefreshCw } from "lucide-react";

export function StockOverview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Overview</h2>
          <p className="text-sm text-muted-foreground">Enterprise dashboard for real-time inventory visibility.</p>
        </div>
        <Button variant="outline"><RefreshCw className="size-4 mr-2" /> Sync Data</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="p-5 border-t-4 border-t-primary">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-primary/10 grid place-items-center"><Package className="size-4 text-primary" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Available</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">14,245</h3>
          <p className="text-[10px] text-emerald-500 font-medium mt-1">+12% from last month</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-blue-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-blue-500/10 grid place-items-center"><ShieldCheck className="size-4 text-blue-500" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Reserved</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">1,890</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Pending SO dispatch</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-rose-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-rose-500/10 grid place-items-center"><XCircle className="size-4 text-rose-500" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Damaged</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">42</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Awaiting write-off</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-amber-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-amber-500/10 grid place-items-center"><Truck className="size-4 text-amber-500" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Transit</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">3,100</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Incoming GRN / Transfer</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-purple-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-purple-500/10 grid place-items-center"><AlertCircle className="size-4 text-purple-500" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Expired</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">18</h3>
          <p className="text-[10px] text-rose-500 font-medium mt-1">Requires disposal</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2"><BarChart3 className="size-5 text-primary" /> Stock Valuation by Warehouse</h3>
            <Button variant="ghost" size="sm">View Detailed Report</Button>
          </div>
          <div className="space-y-4">
            {[
              { name: "Mumbai Central Hub", val: "₹1,45,00,000", pct: 65 },
              { name: "Delhi Cold Storage", val: "₹45,50,000", pct: 20 },
              { name: "Bengaluru E-com", val: "₹25,80,000", pct: 11 },
              { name: "Pune Buffer", val: "₹8,90,000", pct: 4 },
            ].map((wh, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{wh.name}</span>
                  <span className="text-sm font-bold font-mono">{wh.val}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${wh.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        
        <Card className="p-6 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />
          <div>
            <h3 className="font-bold text-lg mb-2">Antigravity AI Insights</h3>
            <p className="text-sm text-muted-foreground mb-4">Real-time inventory intelligence generated from your data.</p>
            
            <div className="space-y-3">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-primary mb-1">Critical Alert</div>
                <div className="text-sm font-medium">Tata Sampann Rice stock will finish in 4 days at Delhi Cold Storage.</div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Opportunity</div>
                <div className="text-sm font-medium">Recommend transferring 500 units of Winter Wear from Mumbai to Delhi.</div>
              </div>
            </div>
          </div>
          <Button className="w-full mt-4 gradient-brand border-0">Ask AI</Button>
        </Card>
      </div>
    </div>
  );
}
