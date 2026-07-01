import React from "react";
import { motion } from "framer-motion";
import { Plus, Target, TrendingUp, TrendingDown, Star, BarChart3, Gift } from "lucide-react";
import { useHrmsData } from "@/hooks/useHrmsData";

interface Props { tab?: string; }

const goalStatusStyle = (s: string) => {
  const m: Record<string, string> = { "On Track": "bg-emerald-500/10 text-emerald-500", "At Risk": "bg-red-500/10 text-red-500", "Completed": "bg-blue-500/10 text-blue-500", "Not Started": "bg-muted text-muted-foreground" };
  return m[s] || "bg-muted text-muted-foreground";
};

const ratingStyle = (r: string) => {
  const m: Record<string, string> = { "Outstanding": "bg-blue-500/10 text-blue-500", "Exceeds Expectations": "bg-emerald-500/10 text-emerald-500", "Meets Expectations": "bg-amber-500/10 text-amber-500", "Needs Improvement": "bg-red-500/10 text-red-500" };
  return m[r] || "bg-muted text-muted-foreground";
};

export function PerformanceManagement({ tab = "goals" }: Props) {
  const { mockGoals, mockAppraisals } = useHrmsData();

  if (tab === "kpis") {
    const kpis = [
      { metric: "Monthly Revenue per Sales Rep", target: "$110K", current: "$98K", unit: "Sales", achievement: 89 },
      { metric: "Customer Satisfaction (CSAT)", target: "4.5 / 5", current: "4.3 / 5", unit: "CX", achievement: 96 },
      { metric: "Ticket Resolution Rate", target: "95%", current: "92%", unit: "Support", achievement: 97 },
      { metric: "Sprint Velocity", target: "48 pts", current: "51 pts", unit: "Engineering", achievement: 106 },
      { metric: "Lead Conversion Rate", target: "12%", current: "9.8%", unit: "Sales", achievement: 82 },
      { metric: "Warehouse Dispatch Accuracy", target: "99%", current: "98.5%", unit: "Operations", achievement: 99 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">KPIs</h1><p className="text-sm text-muted-foreground">Key Performance Indicators across departments — Q2 2026.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><BarChart3 className="size-4" /> Add KPI</button>
        </div>
        <div className="space-y-3">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.metric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-foreground">{kpi.metric}</p>
                  <p className="text-xs text-muted-foreground">{kpi.unit}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${kpi.achievement >= 100 ? "text-blue-500" : kpi.achievement >= 90 ? "text-emerald-500" : kpi.achievement >= 80 ? "text-amber-500" : "text-red-500"}`}>{kpi.achievement}%</p>
                  <p className="text-xs text-muted-foreground">achieved</p>
                </div>
              </div>
              <div className="flex gap-4 text-sm mb-2">
                <span className="text-muted-foreground">Target: <span className="font-medium text-foreground">{kpi.target}</span></span>
                <span className="text-muted-foreground">Current: <span className="font-medium text-foreground">{kpi.current}</span></span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${kpi.achievement >= 100 ? "bg-blue-500" : kpi.achievement >= 90 ? "bg-emerald-500" : kpi.achievement >= 80 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(kpi.achievement, 100)}%` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "appraisals") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Appraisals</h1><p className="text-sm text-muted-foreground">H1 2026 performance appraisal results and ratings.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Start Appraisal</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Period</th>
                  <th className="px-6 py-4 text-center font-medium">Self Score</th>
                  <th className="px-6 py-4 text-center font-medium">Manager Score</th>
                  <th className="px-6 py-4 text-center font-medium">Final Score</th>
                  <th className="px-6 py-4 font-medium">Rating</th>
                  <th className="px-6 py-4 font-medium">Reviewer</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockAppraisals.map((apr, i) => (
                  <motion.tr key={apr.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4"><p className="font-medium text-foreground">{apr.employeeName}</p><p className="text-xs text-muted-foreground">{apr.department}</p></td>
                    <td className="px-6 py-4 text-muted-foreground">{apr.period}</td>
                    <td className="px-6 py-4 text-center">{apr.selfScore > 0 ? `${apr.selfScore}/100` : "—"}</td>
                    <td className="px-6 py-4 text-center">{apr.managerScore > 0 ? `${apr.managerScore}/100` : "—"}</td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">{apr.finalScore > 0 ? `${apr.finalScore}/100` : "—"}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-medium ${ratingStyle(apr.rating)}`}>{apr.rating}</span></td>
                    <td className="px-6 py-4 text-muted-foreground">{apr.reviewer}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${apr.status === "Completed" ? "bg-emerald-500/10 text-emerald-500" : apr.status === "In Progress" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>{apr.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "performance_reviews") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Performance Reviews</h1><p className="text-sm text-muted-foreground">360-degree review feedback and manager notes.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> New Review</button>
        </div>
        <div className="space-y-4">
          {mockAppraisals.filter(a => a.status === "Completed").map((apr, i) => (
            <motion.div key={apr.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{apr.employeeName}</h3>
                  <p className="text-sm text-muted-foreground">{apr.department} · {apr.period} · Reviewed by {apr.reviewer}</p>
                </div>
                <div className="text-right">
                  <div className="flex gap-0.5 justify-end mb-1">
                    {Array.from({ length: 5 }, (_, idx) => (
                      <Star key={idx} className={`size-4 ${idx < Math.round(apr.finalScore / 20) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${ratingStyle(apr.rating)}`}>{apr.rating}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-muted/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Self Score</p><p className="font-bold text-foreground text-xl">{apr.selfScore}</p></div>
                <div className="text-center p-3 bg-muted/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Manager Score</p><p className="font-bold text-foreground text-xl">{apr.managerScore}</p></div>
                <div className="text-center p-3 bg-primary/10 rounded-lg"><p className="text-xs text-primary mb-1">Final Score</p><p className="font-bold text-primary text-xl">{apr.finalScore}</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "incentives") {
    const incentives = [
      { id: "INC-001", employee: "James Thompson", department: "Sales", type: "Q2 Incentive", basis: "120% of quota achieved", amount: 18000, status: "Approved" },
      { id: "INC-002", employee: "Daniel Roberts", department: "Operations", type: "Excellence Award", basis: "Cycle time reduced by 20%", amount: 5000, status: "Paid" },
      { id: "INC-003", employee: "Sarah Mitchell", department: "Marketing", type: "Campaign Bonus", basis: "3 campaigns launched on time", amount: 12000, status: "Pending" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Incentives</h1><p className="text-sm text-muted-foreground">Performance-linked incentives and recognition awards.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Gift className="size-4" /> Award Incentive</button>
        </div>
        <div className="space-y-4">
          {incentives.map((inc, i) => (
            <motion.div key={inc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="px-2 py-0.5 bg-secondary/50 rounded text-xs">{inc.type}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inc.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : inc.status === "Approved" ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"}`}>{inc.status}</span>
                </div>
                <p className="font-semibold text-foreground">{inc.employee} <span className="font-normal text-muted-foreground">· {inc.department}</span></p>
                <p className="text-sm text-muted-foreground">{inc.basis}</p>
              </div>
              <p className="text-2xl font-bold text-emerald-500">${inc.amount.toLocaleString()}</p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Default: goals
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Goals (OKRs)</h1><p className="text-sm text-muted-foreground">Employee goal tracking for Q3 2026.</p></div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Set Goal</button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "On Track", count: mockGoals.filter(g => g.status === "On Track").length, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "At Risk", count: mockGoals.filter(g => g.status === "At Risk").length, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Completed", count: mockGoals.filter(g => g.status === "Completed").length, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Not Started", count: mockGoals.filter(g => g.status === "Not Started").length, color: "text-muted-foreground", bg: "bg-muted/50" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`glass-panel p-5 rounded-xl border border-border/50 text-center ${s.bg}`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>
      <div className="space-y-4">
        {mockGoals.map((goal, i) => (
          <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-5 rounded-xl border border-border/50">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-foreground">{goal.title}</p>
                <p className="text-xs text-muted-foreground">{goal.employeeName} · {goal.department} · Due: {goal.dueDate}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-3 ${goalStatusStyle(goal.status)}`}>{goal.status}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${goal.status === "Completed" ? "bg-blue-500" : goal.status === "On Track" ? "bg-emerald-500" : goal.status === "At Risk" ? "bg-red-500" : "bg-muted-foreground/30"}`}
                  style={{ width: `${goal.progress}%` }} />
              </div>
              <span className="text-sm font-bold text-foreground w-12 text-right">{goal.progress}%</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
