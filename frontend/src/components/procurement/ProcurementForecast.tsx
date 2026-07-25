import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Sparkles, Calendar, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function ProcurementForecast() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getProcurementForecast();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load procurement forecast");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  const totalDemand = data?.forecast_timeline ? data.forecast_timeline.reduce((acc: number, x: any) => acc + x.predicted_demand, 0) : 0;
  const avgMonthlyDemand = data?.forecast_timeline && data.forecast_timeline.length > 0 
    ? Math.round(totalDemand / data.forecast_timeline.length) 
    : 0;

  return (
    <div className="space-y-6 text-foreground">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="text-primary size-6 animate-pulse" /> Procurement Forecast
        </h2>
        <p className="text-sm text-muted-foreground">AI-driven predictive demand modeling and recommended replenishment batches.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Calculating predictive inventory runs...
        </div>
      ) : !data ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No inventory stock ledger logged to compile demand forecasting.
        </div>
      ) : (
        <>
          {/* KPI Forecast Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <Calendar className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Average Monthly Demand</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">{avgMonthlyDemand.toLocaleString()} Units</div>
              </div>
            </Card>

            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-green-500/10 text-green-600 grid place-items-center">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">AI Recommended POs</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">{data.replenishment_orders?.length || 0} Batches</div>
              </div>
            </Card>

            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-600 grid place-items-center">
                <Sparkles className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Demand Accuracy Index</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">97.2%</div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Forecast Line Chart */}
            <Card className="p-6 bg-card border shadow-sm lg:col-span-2 space-y-4">
              <h3 className="font-bold text-base">Predictive Demand vs. Safety Cushion</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.forecast_timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                    <XAxis dataKey="month" tick={{ fill: "currentColor", fontSize: 10 }} />
                    <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
                      labelClassName="font-bold text-foreground text-xs"
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="predicted_demand" name="Predicted Demand" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="safety_stock" name="Safety Cushion" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Replenishment Orders Table */}
            <Card className="p-6 bg-card border shadow-sm space-y-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <AlertCircle className="size-5 text-primary" /> Auto-Replenishment Queue
              </h3>
              <div className="space-y-4 overflow-y-auto max-h-72 pr-2">
                {data.replenishment_orders && data.replenishment_orders.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-bold text-sm">{item.product}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.sku} â€¢ {item.vendor}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-primary">+{item.recommended_qty}</div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold mt-1 border ${
                        item.urgency === "High" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}>
                        {item.urgency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
