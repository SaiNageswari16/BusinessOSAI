import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { BarChart3, Package, ShieldCheck, Truck, XCircle, AlertCircle, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { inventoryApi } from "../../lib/api-client";

export function StockOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getOperationsOverview();
      setData(res);
    } catch (error) {
      console.error("Failed to fetch overview:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Overview</h2>
          <p className="text-sm text-muted-foreground">Enterprise dashboard for real-time inventory visibility.</p>
        </div>
        <Button variant="outline" onClick={fetchOverview} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Sync Data
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="p-5 border-t-4 border-t-primary">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-primary/10 grid place-items-center"><Package className="size-4 text-primary" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Available</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">{data.available.toLocaleString()}</h3>
          <p className="text-[10px] text-emerald-500 font-medium mt-1">+12% from last month</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-blue-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-blue-500/10 grid place-items-center"><ShieldCheck className="size-4 text-blue-500" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Reserved</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">{data.reserved.toLocaleString()}</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Pending SO dispatch</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-rose-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-rose-500/10 grid place-items-center"><XCircle className="size-4 text-rose-500" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Damaged</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">{data.damaged.toLocaleString()}</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Awaiting write-off</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-amber-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-amber-500/10 grid place-items-center"><Truck className="size-4 text-amber-500" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Transit</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">{data.transit.toLocaleString()}</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Incoming GRN / Transfer</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-purple-500">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-8 rounded bg-purple-500/10 grid place-items-center"><AlertCircle className="size-4 text-purple-500" /></div>
            <span className="text-sm font-semibold text-muted-foreground">Expired</span>
          </div>
          <h3 className="text-2xl font-bold font-mono">{data.expired.toLocaleString()}</h3>
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
            {Object.entries(data.valuation).map(([name, valData]: [string, any], i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-sm font-bold font-mono">{valData.value}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${valData.pct}%` }}></div>
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
            
            <div className="space-y-4">
              <div className="bg-indigo-50 border-l-4 border-l-indigo-600 rounded-r-lg p-4">
                <div className="flex items-center gap-2 text-indigo-700 font-bold mb-1 text-sm">
                  <Sparkles className="size-4" /> Recommendation
                </div>
                <div className="text-sm font-medium text-slate-800">
                  AI recommends transferring 500 units of 'Wireless Headphones' to Warehouse B to prevent stockout.
                </div>
                <Button size="sm" className="mt-3 bg-indigo-600 text-white hover:bg-indigo-700 h-8">
                  Initiate Transfer
                </Button>
              </div>
            </div>
          </div>
          <Button className="w-full mt-4 gradient-brand border-0">Ask AI</Button>
        </Card>
      </div>
    </div>
  );
}
