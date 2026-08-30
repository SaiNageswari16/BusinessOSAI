import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, TrendingUp, TrendingDown, BarChart3, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { budgetsApi, Budget } from "@/lib/api-client";
import { fmt } from "@/components/accounting/utils";
import { useCurrency } from "@/hooks/use-currency";

interface Props { tab?: string; }

interface BudgetRecord {
  id: string;
  name: string;
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variance_pct: number;
  status: string;
}

function mapBudgetToRecord(b: Budget): BudgetRecord {
  return {
    id: b.id,
    name: b.name,
    category: "General",
    budgeted: b.budgeted_amount,
    actual: b.actual_amount,
    variance: b.variance,
    variance_pct: 0,
    status: b.status || "Draft",
  };
}

const statusStyle = (s: string) => {
  switch (s) {
    case "On Track": return "bg-emerald-500/10 text-emerald-500";
    case "Over Budget": return "bg-red-500/10 text-red-500";
    case "Under Utilized": return "bg-amber-500/10 text-amber-500";
    case "Active": return "bg-blue-500/10 text-blue-500";
    case "Approved": return "bg-emerald-500/10 text-emerald-500";
    case "Draft": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

// ─── Modal: Create Budget ────────────────────────────────────────────────
function BudgetFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (budget: Partial<BudgetRecord>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    budgeted: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await budgetsApi.createBudget({
        name: form.name,
        category: "General",
        budgeted_amount: form.budgeted,
        status: "Active",
      });
      toast.success("Budget created successfully!");
      onSaved(mapBudgetToRecord(created));
      onClose();
    } catch {
      toast.error("Failed to create budget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">Create Department Budget</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Budget Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none" placeholder="Q3 Marketing Campaign" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Budgeted Amount (INR) *</label>
            <input type="number" step="any" value={form.budgeted} onChange={e => setForm(p => ({ ...p, budgeted: parseFloat(e.target.value) || 0 }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-semibold" placeholder="0.00" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Budget
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Budgets Component ──────────────────────────────────────────────
export function Budgets({ tab = "budgets" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const res = await budgetsApi.listBudgets({ page_size: 200 });
      const mapped = (res.items || []).map(mapBudgetToRecord);
      setBudgets(mapped);
    } catch {
      toast.error("Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (["budgets", "forecasts", "cost_allocation", "financial_planning"].includes(tab)) {
      loadBudgets();
    }
  }, [tab]);

  const handleAddBudget = (newB: Partial<BudgetRecord>) => {
    setBudgets(p => [{ ...newB, id: newB.id || Date.now().toString() } as BudgetRecord, ...p]);
  };

  interface ForecastQuarter {
    label: string;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
  }
  interface CostAllocItem {
    code: string;
    name: string;
    budgeted: number;
    actual: number;
    totalCost: number;
    pct: number;
    count: number;
  }
  interface PlanGoal {
    goal: string;
    target: string;
    current: string;
    progress: number;
    status: string;
  }

  // Derived: quarterly projection from budget data
  const forecastData = useMemo<ForecastQuarter[]>(() => {
    if (!budgets.length) return [];
    // Split budgets into 4 equal-ish quarters for projection
    const perQuarter = Math.max(1, Math.round(budgets.length / 4));
    const quarters: ForecastQuarter[] = [];
    const qLabels = ["Q1", "Q2", "Q3", "Q4"];
    for (let i = 0; i < 4; i++) {
      const slice = budgets.slice(i * perQuarter, (i + 1) * perQuarter);
      const qBudgeted = slice.reduce((s, b) => s + b.budgeted, 0);
      const qActual = slice.reduce((s, b) => s + b.actual, 0);
      quarters.push({
        label: `${qLabels[i]} 2026`,
        revenue: qBudgeted,
        expenses: qActual,
        profit: qBudgeted - qActual,
        margin: qBudgeted > 0 ? Number(((qBudgeted - qActual) / qBudgeted * 100).toFixed(1)) : 0,
      });
    }
    return quarters;
  }, [budgets]);

  // Derived: cost allocation by category
  const costAllocData = useMemo<CostAllocItem[]>(() => {
    const byCategory = new Map<string, { budgeted: number; actual: number; count: number }>();
    for (const b of budgets) {
      const cat = b.category || "Uncategorized";
      if (!byCategory.has(cat)) byCategory.set(cat, { budgeted: 0, actual: 0, count: 0 });
      const c = byCategory.get(cat)!;
      c.budgeted += b.budgeted;
      c.actual += b.actual;
      c.count += 1;
    }
    const totalBudgeted = budgets.reduce((s, b) => s + b.budgeted, 0);
    return Array.from(byCategory.entries()).map(([name, v], i) => ({
      code: `CC-${String(i + 1).padStart(3, "0")}`,
      name,
      budgeted: v.budgeted,
      actual: v.actual,
      totalCost: v.actual,
      pct: totalBudgeted > 0 ? Math.round((v.actual / totalBudgeted) * 100) : 0,
      count: v.count,
    }));
  }, [budgets]);

  // Derived: financial planning goals from budget performance
  const planData = useMemo<PlanGoal[]>(() => {
    if (!budgets.length) return [];
    const totalBudgeted = budgets.reduce((s, b) => s + b.budgeted, 0);
    const totalActual = budgets.reduce((s, b) => s + b.actual, 0);
    const utilization = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0;
    const overBudget = budgets.filter(b => b.actual > b.budgeted).length;

    return [
      { goal: "Stay within Budget", target: "100% within limit", current: `${100 - utilization}% headroom`, progress: Math.max(0, 100 - utilization), status: utilization <= 100 ? "On Track" : "At Risk" },
      { goal: "Reduce Variance", target: "< 5% variance", current: `${Math.round(budgets.reduce((s, b) => s + Math.abs(b.variance_pct || 0), 0) / budgets.length)}% avg`, progress: Math.max(0, 100 - Math.round(budgets.reduce((s, b) => s + Math.abs(b.variance_pct || 0), 0) / budgets.length)), status: "At Risk" },
      { goal: "Budget Utilization", target: "85–100%", current: `${utilization}%`, progress: utilization, status: utilization <= 100 && utilization >= 85 ? "On Track" : utilization > 100 ? "Over Budget" : "Under Utilized" },
      { goal: "Budgets Active", target: "All periods", current: `${budgets.filter(b => b.status === "Active" || b.status === "Approved").length} active`, progress: Math.round((budgets.filter(b => b.status === "Active" || b.status === "Approved").length / budgets.length) * 100), status: "On Track" },
    ];
  }, [budgets]);

  if (tab === "forecasts") {
    const totalBudgeted = forecastData.reduce((s, q) => s + q.revenue, 0);
    const totalProfit = forecastData.reduce((s, q) => s + q.profit, 0);
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Financial Forecasts</h1><p className="text-sm text-muted-foreground">Projections derived from current budget data across quarters.</p></div>
          <button onClick={loadBudgets} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><TrendingUp className="size-4" /> Refresh</button>
        </div>
        {forecastData.length === 0 && <div className="text-center text-muted-foreground py-8">Create budgets to see projections.</div>}
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {forecastData.map((f, i) => (
            <motion.div key={f.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel rounded-xl border border-border/50 p-5 space-y-2">
              <p className="text-xs text-muted-foreground uppercase font-semibold">{f.label}</p>
              <p className={`text-2xl font-bold ${f.profit >= 0 ? "text-foreground" : "text-red-500"}`}>{fmt(f.profit)}</p>
              <p className={`text-sm font-medium ${f.profit >= 0 ? "text-emerald-500" : "text-red-400"}`}>{f.margin}% margin</p>
              <div className="pt-2 border-t border-border/30 text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span>Revenue</span><span className="text-emerald-500 font-semibold">{fmt(f.revenue)}</span></div>
                <div className="flex justify-between"><span>Expenses</span><span className="text-red-400 font-semibold">{fmt(f.expenses)}</span></div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 font-medium">Period</th>
                  <th className="px-6 py-4 text-right font-medium">Projected Revenue</th>
                  <th className="px-6 py-4 text-right font-medium">Projected Expenses</th>
                  <th className="px-6 py-4 text-right font-medium">Projected Profit</th>
                  <th className="px-6 py-4 text-right font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {forecastData.map((f, i) => (
                  <motion.tr key={f.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{f.label}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-500">{fmt(f.revenue)}</td>
                    <td className="px-6 py-4 text-right font-medium text-red-400">{fmt(f.expenses)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${f.profit >= 0 ? "text-foreground" : "text-red-500"}`}>{fmt(f.profit)}</td>
                    <td className={`px-6 py-4 text-right ${f.margin >= 0 ? "text-blue-400" : "text-red-400"} font-semibold`}>{f.margin}%</td>
                  </motion.tr>
                ))}
                {forecastData.length > 0 && (
                  <tr className="bg-muted/20 border-t border-border/50 font-bold text-sm">
                    <td className="px-6 py-4">FY Total</td>
                    <td className="px-6 py-4 text-right text-emerald-500">{fmt(totalBudgeted)}</td>
                    <td className="px-6 py-4 text-right text-red-400">{fmt(budgets.reduce((s, b) => s + b.actual, 0))}</td>
                    <td className="px-6 py-4 text-right text-foreground">{fmt(totalProfit)}</td>
                    <td className="px-6 py-4 text-right">{totalBudgeted > 0 ? ((totalProfit / totalBudgeted) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "cost_allocation") {
    const totalCost = costAllocData.reduce((s, a) => s + a.totalCost, 0);
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Cost Allocation</h1><p className="text-sm text-muted-foreground">Budget spend distribution by cost category.</p></div>
          <button onClick={loadBudgets} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><BarChart3 className="size-4" /> Refresh</button>
        </div>
        {costAllocData.length === 0 && <div className="text-center text-muted-foreground py-8">Create budgets to see cost allocation.</div>}
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 font-medium">Cost Center</th>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 text-right font-medium">Budgeted</th>
                  <th className="px-6 py-4 text-right font-medium">Actual</th>
                  <th className="px-6 py-4 text-right font-medium">Total Cost</th>
                  <th className="px-6 py-4 font-medium">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {costAllocData.map((a, i) => (
                  <motion.tr key={a.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{a.name}</td>
                    <td className="px-6 py-4 font-mono text-primary text-xs">{a.code}</td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">{fmt(a.budgeted)}</td>
                    <td className="px-6 py-4 text-right text-amber-500">{fmt(a.actual)}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{fmt(a.totalCost)}</td>
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
        {/* Summary */}
        {costAllocData.length > 0 && (
          <div className="flex gap-6 text-sm">
            <span className="text-muted-foreground">Total Budgeted: <span className="text-foreground font-semibold">{fmt(costAllocData.reduce((s, a) => s + a.budgeted, 0))}</span></span>
            <span className="text-muted-foreground">Total Actual: <span className="text-foreground font-semibold">{fmt(totalCost)}</span></span>
            <span className="text-muted-foreground">Cost Centers: <span className="text-foreground font-semibold">{costAllocData.length}</span></span>
          </div>
        )}
      </div>
    );
  }

  if (tab === "financial_planning") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Financial Planning</h1><p className="text-sm text-muted-foreground">Strategic KPIs derived from your budget performance.</p></div>
          <button onClick={loadBudgets} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><BarChart3 className="size-4" /> Refresh</button>
        </div>
        {planData.length === 0 && <div className="text-center text-muted-foreground py-8">Create budgets to see planning metrics.</div>}
        <div className="space-y-4">
          {planData.map((goal, i) => {
            const gs = goal.status === "Achieved" ? "bg-blue-500/10 text-blue-500" : goal.status === "On Track" ? "bg-emerald-500/10 text-emerald-500" : goal.status === "Over Budget" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500";
            const barColor = goal.status === "Achieved" || goal.status === "On Track" ? "bg-emerald-500" : goal.status === "Over Budget" ? "bg-red-500" : "bg-amber-500";
            return (
              <motion.div key={goal.goal} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-panel p-6 rounded-xl border border-border/50">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-foreground">{goal.goal}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${gs}`}>{goal.status}</span>
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

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading budgets…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground font-bold">Budgets</h1><p className="text-sm text-muted-foreground">Department-wise budget vs. actual trackers.</p></div>
        <button onClick={() => setShowBudgetModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Create Budget</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map((budget, i) => {
          const utilization = Math.round((budget.actual / budget.budgeted) * 100) || 0;
          const isOver = budget.actual > budget.budgeted;
          return (
            <motion.div key={budget.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="font-semibold text-foreground text-sm">{budget.name}</h3><p className="text-xs text-muted-foreground">{budget.category}</p></div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle(budget.status)}`}>{budget.status}</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Budgeted</span><span className="font-semibold text-foreground">{fmt(budget.budgeted)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Actual</span><span className={`font-semibold ${isOver ? "text-red-500" : "text-foreground"}`}>{fmt(budget.actual)}</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${isOver ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{utilization}% utilized</span>
                  <span className={`font-semibold flex items-center gap-1 ${budget.variance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {budget.variance >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {budget.variance >= 0 ? "+" : ""}{fmt(budget.variance)} variance
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
        {budgets.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8">No budgets found.</div>
        )}
      </div>
      {showBudgetModal && (
        <BudgetFormModal onClose={() => setShowBudgetModal(false)} onSaved={handleAddBudget} />
      )}
    </div>
  );
}
