import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, TrendingUp, TrendingDown, BarChart3, Layers, X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props { tab?: string; }

interface BudgetRecord {
  id: string;
  name: string;
  department: string;
  fiscalYear: string;
  budgeted: number;
  actual: number;
  variance: number;
  status: string;
}

interface ForecastRecord {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  confidence: string;
}

interface CostAllocation {
  costCenter: string;
  code: string;
  directCosts: number;
  allocatedOverhead: number;
  totalCost: number;
  pct: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

// ─── Modal: Create Budget ────────────────────────────────────────────────
function BudgetFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (budget: Partial<BudgetRecord>) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    department: "Sales",
    fiscalYear: "2026",
    budgeted: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSaved({
        id: `BGT-2026-${Math.floor(100 + Math.random() * 900)}`,
        name: form.name,
        department: form.department,
        fiscalYear: form.fiscalYear,
        budgeted: form.budgeted,
        actual: 0,
        variance: form.budgeted,
        status: "On Track"
      });
      toast.success("Budget created successfully!");
      setSaving(false);
      onClose();
    }, 400);
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
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Q3 Marketing Campaign" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Department *</label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none">
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="IT & Engineering">IT & Engineering</option>
                <option value="HR & Admin">HR & Admin</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Fiscal Year *</label>
              <input value={form.fiscalYear} onChange={e => setForm(p => ({ ...p, fiscalYear: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-mono" />
            </div>
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

// ─── Modal: Update Forecast ──────────────────────────────────────────────
function ForecastFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (forecast: ForecastRecord) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    period: "Q3 2026",
    revenue: 0,
    expenses: 0,
    confidence: "High",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      onSaved({
        period: form.period,
        revenue: form.revenue,
        expenses: form.expenses,
        profit: form.revenue - form.expenses,
        confidence: form.confidence,
      });
      toast.success("Forecast updated successfully!");
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground font-semibold">Update Profit Forecast</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Filing Period *</label>
            <input value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none" placeholder="Q3 2026 (Forecast)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Projected Revenue *</label>
              <input type="number" value={form.revenue} onChange={e => setForm(p => ({ ...p, revenue: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-semibold text-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Projected Expenses *</label>
              <input type="number" value={form.expenses} onChange={e => setForm(p => ({ ...p, expenses: parseFloat(e.target.value) || 0 }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-semibold text-red-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Confidence Level *</label>
            <select value={form.confidence} onChange={e => setForm(p => ({ ...p, confidence: e.target.value }))} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none">
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
              Update Forecast
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Budgets Component ──────────────────────────────────────────────
export function Budgets({ tab = "budgets" }: Props) {
  const [budgets, setBudgets] = useState<BudgetRecord[]>([
    { id: "BGT-01", name: "FY 2026 Marketing", department: "Marketing", fiscalYear: "2026", budgeted: 250000, actual: 235500, variance: 14500, status: "On Track" },
    { id: "BGT-02", name: "FY 2026 Sales & Ops", department: "Sales", fiscalYear: "2026", budgeted: 450000, actual: 480000, variance: -30000, status: "Over Budget" },
    { id: "BGT-03", name: "FY 2026 Tech & R&D", department: "IT & Engineering", fiscalYear: "2026", budgeted: 600000, actual: 410000, variance: 190000, status: "Under Utilized" },
    { id: "BGT-04", name: "FY 2026 Administration", department: "HR & Admin", fiscalYear: "2026", budgeted: 150000, actual: 142000, variance: 8000, status: "On Track" },
  ]);
  const [forecasts, setForecasts] = useState<ForecastRecord[]>([
    { period: "Q3 2026 (Jul–Sep)", revenue: 4200000, expenses: 2600000, profit: 1600000, confidence: "High" },
    { period: "Q4 2026 (Oct–Dec)", revenue: 5100000, expenses: 2900000, profit: 2200000, confidence: "Medium" },
    { period: "FY 2026 Total", revenue: 16800000, expenses: 9800000, profit: 7000000, confidence: "High" },
  ]);
  const [allocations, setAllocations] = useState<CostAllocation[]>([
    { costCenter: "Sales", code: "CC-001", directCosts: 820000, allocatedOverhead: 185000, totalCost: 1005000, pct: 28 },
    { costCenter: "Marketing", code: "CC-002", directCosts: 390000, allocatedOverhead: 92000, totalCost: 482000, pct: 13 },
    { costCenter: "IT & Engineering", code: "CC-003", directCosts: 310000, allocatedOverhead: 115000, totalCost: 425000, pct: 12 },
    { costCenter: "HR & Administration", code: "CC-004", directCosts: 2180000, allocatedOverhead: 75000, totalCost: 2255000, pct: 63 },
    { costCenter: "Operations", code: "CC-005", directCosts: 875000, allocatedOverhead: 210000, totalCost: 1085000, pct: 30 },
  ]);

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showForecastModal, setShowForecastModal] = useState(false);

  const handleAddBudget = (newB: Partial<BudgetRecord>) => {
    setBudgets(p => [newB as BudgetRecord, ...p]);
  };

  const handleAddForecast = (newF: ForecastRecord) => {
    setForecasts(p => [newF, ...p]);
  };

  if (tab === "forecasts") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Financial Forecasts</h1><p className="text-sm text-muted-foreground">Projections for future periods.</p></div>
          <button onClick={() => setShowForecastModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><TrendingUp className="size-4" /> Update Forecast</button>
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
                    <motion.tr key={f.period} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{f.period}</td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-500">{fmt(f.revenue)}</td>
                      <td className="px-6 py-4 text-right font-medium text-red-400">{fmt(f.expenses)}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">{fmt(f.profit)}</td>
                      <td className="px-6 py-4 text-right text-blue-400">{margin}%</td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${confStyle}`}>{f.confidence}</span></td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <AnimatePresence>
          {showForecastModal && (
            <ForecastFormModal onClose={() => setShowForecastModal(false)} onSaved={handleAddForecast} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (tab === "cost_allocation") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Cost Allocation</h1><p className="text-sm text-muted-foreground">Direct costs and overhead allocations by cost center.</p></div>
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
                  <motion.tr key={a.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{a.costCenter}</td>
                    <td className="px-6 py-4 font-mono text-primary text-xs">{a.code}</td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">{fmt(a.directCosts)}</td>
                    <td className="px-6 py-4 text-right text-amber-500">{fmt(a.allocatedOverhead)}</td>
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
      </div>
    );
  }

  if (tab === "financial_planning") {
    const goals = [
      { goal: "Achieve 45% Gross Margin", target: "₹7.56 Cr", current: "₹6.3 Cr", progress: 83, status: "On Track" },
      { goal: "Reduce OPEX Ratio to 30%", target: "30%", current: "34%", progress: 70, status: "At Risk" },
      { goal: "Grow Revenue by 25% YoY", target: "₹18.1 Cr", current: "₹14.5 Cr", progress: 65, status: "On Track" },
      { goal: "Maintain Cash Runway 12+ months", target: "12 months", current: "14.8 months", progress: 100, status: "Achieved" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground font-bold">Financial Planning</h1><p className="text-sm text-muted-foreground">Strategic financial KPI metrics.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><BarChart3 className="size-4" /> Update Plan</button>
        </div>
        <div className="space-y-4">
          {goals.map((goal, i) => {
            const statusStyle = goal.status === "Achieved" ? "bg-blue-500/10 text-blue-500" : goal.status === "On Track" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500";
            const barColor = goal.status === "Achieved" ? "bg-blue-500" : goal.status === "On Track" ? "bg-emerald-500" : "bg-red-500";
            return (
              <motion.div key={goal.goal} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-panel p-6 rounded-xl border border-border/50">
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
        <div><h1 className="text-2xl font-bold text-foreground font-bold">Budgets</h1><p className="text-sm text-muted-foreground">Department-wise budget vs. actual trackers.</p></div>
        <button onClick={() => setShowBudgetModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Create Budget</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.map((budget, i) => {
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
      </div>
      <AnimatePresence>
        {showBudgetModal && (
          <BudgetFormModal onClose={() => setShowBudgetModal(false)} onSaved={handleAddBudget} />
        )}
      </AnimatePresence>
    </div>
  );
}
