import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { PiggyBank, Receipt, TrendingUp, PieChart as PieIcon, Loader2 } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function CostAnalysis() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchCostData = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getCostAnalysis();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load cost analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostData();
  }, []);

  const totalCost = data?.total_procurement_cost || 0;
  const estimatedTax = totalCost * 0.18; // Default 18% standard GST baseline

  return (
    <div className="space-y-6 text-foreground">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <PiggyBank className="text-primary size-6" /> Cost Analysis
        </h2>
        <p className="text-sm text-muted-foreground">Detailed breakdown of purchase costs, tax allocations, and cost-saving metrics.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Analyzing cost ledger...
        </div>
      ) : !data ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No cost ledger transactions logged to compute cost analysis.
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <PiggyBank className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Total Purchase Cost</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">₹{totalCost.toLocaleString("en-IN")}</div>
              </div>
            </Card>

            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center">
                <Receipt className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Estimated Tax Paid</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">₹{estimatedTax.toLocaleString("en-IN")}</div>
              </div>
            </Card>

            <Card className="p-6 bg-card border shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-green-500/10 text-green-600 grid place-items-center">
                <TrendingUp className="size-6" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase">Cost Efficiency Rate</div>
                <div className="text-3xl font-bold font-mono tracking-tighter mt-1">94.8%</div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cost Trend Chart */}
            <Card className="p-6 bg-card border shadow-sm lg:col-span-2 space-y-4">
              <h3 className="font-bold text-base">Cost & Tax Trends (YTD Timeline)</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.cost_trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                    <XAxis dataKey="month" tick={{ fill: "currentColor", fontSize: 10 }} />
                    <YAxis tick={{ fill: "currentColor", fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
                      labelClassName="font-bold text-foreground text-xs"
                    />
                    <Area type="monotone" dataKey="purchase_cost" name="Purchase Cost" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorCost)" />
                    <Area type="monotone" dataKey="tax_amount" name="Tax Amount" stroke="#f43f5e" fill="none" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Category Cost Distribution */}
            <Card className="p-6 bg-card border shadow-sm space-y-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <PieIcon className="size-5 text-primary" /> Cost by Category
              </h3>
              <div className="space-y-4 mt-6">
                {data.category_costs && data.category_costs.map((item: any, idx: number) => {
                  const pct = totalCost > 0 ? (item.value / totalCost) * 100 : 25; // Default if total is zero
                  return (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold">{item.category}</span>
                        <span className="font-bold font-mono text-muted-foreground">
                          ₹{item.value.toLocaleString("en-IN")} ({Math.round(pct)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div 
                          className="bg-primary h-1.5 rounded-full" 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
