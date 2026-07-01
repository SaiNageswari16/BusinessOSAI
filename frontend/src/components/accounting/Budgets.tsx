import React from "react";
import { motion } from "framer-motion";
import { Plus, TrendingUp, TrendingDown, BarChart3, Layers } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

export function Budgets({ tab = "budgets" }: Props) {
  const { mockBudgets } = useAccountingData();

  if (tab === "forecasts") {
    const forecasts = [
      { period: "Q3 2026 (Jul–Sep)", revenue: 4200000, expenses: 2600000, profit: 1600000, confidence: "High" },
      { period: "Q4 2026 (Oct–Dec)", revenue: 5100000, expenses: 2900000, profit: 2200000, confidence: "Medium" },
      { period: "FY 2026 Total", revenue: 16800000, expenses: 9800000, profit: 7000000, confidence: "High" },
      { period: "FY 2027 Projection", revenue: 20500000, expenses: 11500000, profit: 9000000, confidence: "Low" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Financial Forecasts</h1><p className="text-sm text-muted-foreground">Revenue, expense, and profit projections for future periods.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><TrendingUp className="size-4" /> Update Forecast</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Period</th>
                  <th className="px-6 py-4 text-right font-medium">Projected Revenue</th>
                  <th className="px-6 py-4 text-right font-medium">Projected Expenses</th>
                  <th className="px-6 py-4 text-right font-medium">Projected Profit</th>
                  <th className="px-6 py-4 text-right font-medium">Margin %</th>
                  <th className="px-6 py-4 text-center font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.map((f, i) => {
                  const margin = Math.round((f.profit / f.revenue) * 100);
                  const confStyle = f.confidence === "High" ? "bg-emerald-500/10 text-emerald-500" : f.confidence === "Medium" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground";
                  return (
                    <motion.tr key={f.period} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{f.period}</td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-500">${f.revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-medium text-red-400">${f.expenses.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">${f.profit.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-blue-400">{margin}%</td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${confStyle}`}>{f.confidence}</span></td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "cost_allocation") {
    const allocations = [
      { costCenter: "Sales", code: "CC-001", directCosts: 820000, allocatedOverhead: 185000, totalCost: 1005000, pct: 28 },
      { costCenter: "Marketing", code: "CC-002", directCosts: 390000, allocatedOverhead: 92000, totalCost: 482000, pct: 13 },
      { costCenter: "IT & Engineering", code: "CC-003", directCosts: 310000, allocatedOverhead: 115000, totalCost: 425000, pct: 12 },
      { costCenter: "HR & Administration", code: "CC-004", directCosts: 2180000, allocatedOverhead: 75000, totalCost: 2255000, pct: 63 },
      { costCenter: "Operations", code: "CC-005", directCosts: 875000, allocatedOverhead: 210000, totalCost: 1085000, pct: 30 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Cost Allocation</h1><p className="text-sm text-muted-foreground">Direct costs and overhead allocation by cost center.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Layers className="size-4" /> Reallocate</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Cost Center</th>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 text-right font-medium">Direct Costs</th>
                  <th className="px-6 py-4 text-right font-medium">Allocated OH</th>
                  <th className="px-6 py-4 text-right font-medium">Total Cost</th>
                  <th className="px-6 py-4 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a, i) => (
                  <motion.tr key={a.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{a.costCenter}</td>
                    <td className="px-6 py-4 font-mono text-primary text-xs">{a.code}</td>
                    <td className="px-6 py-4 text-right">${a.directCosts.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-amber-500">${a.allocatedOverhead.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">${a.totalCost.toLocaleString()}</td>
                    <td className="px-6 py-4 w-36">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${a.pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{a.pct}% of total</p>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "financial_planning") {
    const goals = [
      { goal: "Achieve 45% Gross Margin", target: "$7.56M", current: "$6.3M", progress: 83, status: "On Track" },
      { goal: "Reduce OPEX Ratio to 30%", target: "30%", current: "34%", progress: 70, status: "At Risk" },
      { goal: "Grow Revenue by 25% YoY", target: "$18.1M", current: "$14.5M (H1)", progress: 65, status: "On Track" },
      { goal: "Maintain Cash Runway 12+ months", target: "12 months", current: "14.8 months", progress: 100, status: "Achieved" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Financial Planning</h1><p className="text-sm text-muted-foreground">FY 2026 financial goals and strategic KPI tracking.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><BarChart3 className="size-4" /> Update Plan</button>
        </div>
        <div className="space-y-4">
          {goals.map((goal, i) => {
            const statusStyle = goal.status === "Achieved" ? "bg-blue-500/10 text-blue-500" : goal.status === "On Track" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500";
            const barColor = goal.status === "Achieved" ? "bg-blue-500" : goal.status === "On Track" ? "bg-emerald-500" : "bg-red-500";
            return (
              <motion.div key={goal.goal} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="glass-panel p-6 rounded-xl border border-border/50">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-foreground">{goal.goal}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle}`}>{goal.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div><p className="text-muted-foreground text-xs">Target</p><p className="font-semibold text-foreground">{goal.target}</p></div>
                  <div><p className="text-muted-foreground text-xs">Current</p><p className="font-semibold text-foreground">{goal.current}</p></div>
                  <div><p className="text-muted-foreground text-xs">Progress</p><p className="font-semibold text-foreground">{goal.progress}%</p></div>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(goal.progress, 100)}%` }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: budgets (dept budget cards)
  const statusStyle = (s: string) => {
    switch (s) {
      case "On Track": return "bg-emerald-500/10 text-emerald-500";
      case "Over Budget": return "bg-red-500/10 text-red-500";
      case "Under Utilized": return "bg-amber-500/10 text-amber-500";
      default: return "bg-muted text-muted-foreground";
    }
  };
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Budgets</h1><p className="text-sm text-muted-foreground">Department-wise budget vs. actual for FY 2026.</p></div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Create Budget</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockBudgets.map((budget, i) => {
          const utilization = Math.round((budget.actual / budget.budgeted) * 100);
          const isOver = budget.actual > budget.budgeted;
          return (
            <motion.div key={budget.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="font-semibold text-foreground text-sm">{budget.name}</h3><p className="text-xs text-muted-foreground">{budget.department} · FY {budget.fiscalYear}</p></div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(budget.status)}`}>{budget.status}</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Budgeted</span><span className="font-medium">${budget.budgeted.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Actual</span><span className={`font-medium ${isOver ? "text-red-500" : "text-foreground"}`}>${budget.actual.toLocaleString()}</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${isOver ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{utilization}% utilized</span>
                  <span className={`font-semibold flex items-center gap-1 ${budget.variance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {budget.variance >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {budget.variance >= 0 ? "+" : ""}${budget.variance.toLocaleString()} variance
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
