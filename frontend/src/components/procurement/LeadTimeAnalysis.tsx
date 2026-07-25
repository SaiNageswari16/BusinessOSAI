import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Clock, Truck, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function LeadTimeAnalysis() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getLeadTimeAnalysis();
      setData(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load lead time analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const avgLeadDays = data.length > 0 ? (data.reduce((acc, x) => acc + x.average_lead_days, 0) / data.length).toFixed(1) : "0.0";
  const avgOnTime = data.length > 0 ? (data.reduce((acc, x) => acc + x.on_time_delivery_rate, 0) / data.length).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 text-foreground">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Clock className="text-primary size-6" /> Lead Time Analysis
        </h2>
        <p className="text-sm text-muted-foreground">Monitor and optimize supplier transit times and fulfillment rates.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Analyzing vendor transit logs...
        </div>
      ) : data.length === 0 ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No supplier transactions logged to compute lead time analytics.
        </div>
      ) : (
        <>
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <Clock className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Average Lead Time</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">{avgLeadDays} Days</div>
              </div>
            </Card>

            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-green-500/10 text-green-600 grid place-items-center">
                <Truck className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">On-Time Fulfillment</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">{avgOnTime}%</div>
              </div>
            </Card>

            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center">
                <TrendingUp className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Monitored Suppliers</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">{data.length} Vendors</div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <Card className="p-6 bg-card border shadow-sm lg:col-span-2 space-y-4">
              <h3 className="font-bold text-base">Average Lead Time by Vendor (Days)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                    <XAxis dataKey="vendor" tick={{ fill: "currentColor", fontSize: 10 }} />
                    <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
                      labelClassName="font-bold text-foreground text-xs"
                    />
                    <Bar dataKey="average_lead_days" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Vendor List / Performance Table */}
            <Card className="p-6 bg-card border shadow-sm space-y-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" /> Supplier Reliability Index
              </h3>
              <div className="space-y-4 overflow-y-auto max-h-72 pr-2">
                {data.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-bold text-sm">{item.vendor}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Fulfillment cycle</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold">{item.average_lead_days}d lead</div>
                      <div className={`text-xs font-semibold mt-0.5 ${
                        item.on_time_delivery_rate >= 95 ? "text-green-600" : item.on_time_delivery_rate >= 90 ? "text-amber-500" : "text-rose-500"
                      }`}>
                        {item.on_time_delivery_rate}% on-time
                      </div>
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
