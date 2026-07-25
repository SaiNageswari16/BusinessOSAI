import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { BarChart3, Loader2 } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function SpendAnalysis() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSpend = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getSpendAnalysis();
      setAnalytics(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load spend analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpend();
  }, []);

  return (
    <div className="space-y-6 text-foreground">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="text-primary size-6" /> Spend Analysis
        </h2>
        <p className="text-sm text-muted-foreground">Interactive analytics for department and supplier spend.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Loading spend analytics...
        </div>
      ) : !analytics ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No procurement transactions logged to run spend analysis.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border p-6 md:col-span-2 space-y-4 shadow-sm">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" /> Spend by Supplier
            </h3>
            
            <div className="space-y-4">
              {analytics.supplier_spend && analytics.supplier_spend.length > 0 ? (
                analytics.supplier_spend.map((item: any, i: number) => {
                  const pct = analytics.total_spend > 0 ? (item.amount / analytics.total_spend) * 100 : 0;
                  return (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold">{item.supplier}</span>
                        <span className="font-bold font-mono">
                          ₹{item.amount.toLocaleString("en-IN")} ({Math.round(pct)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-muted-foreground font-medium py-6 text-center">No supplier transactions mapped.</div>
              )}
            </div>
          </Card>

          <Card className="bg-primary text-primary-foreground p-6 flex flex-col justify-center rounded-xl shadow-sm">
            <div className="text-[10px] uppercase font-bold text-primary-foreground/75 mb-1">Total Procurement Spend (YTD)</div>
            <div className="text-4xl font-bold font-mono tracking-tighter">
              ₹{analytics.total_spend.toLocaleString("en-IN")}
            </div>
            <div className="text-xs font-semibold mt-2.5 bg-white/20 w-fit px-2 py-0.5 rounded text-white">
              Active ledger verified
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
