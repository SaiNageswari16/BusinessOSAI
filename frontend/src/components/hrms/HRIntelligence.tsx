import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Brain, Users, ShieldCheck, FileCheck, ChevronRight } from "lucide-react";
import { 
  intelligenceApi, 
  AttendanceAnalytics, 
  PayrollAnalytics, 
  AttritionPrediction, 
  ShiftOptimization, 
  ProductivityScore, 
  TrainingRecommendation 
} from "../../lib/api-client";

interface Props { tab?: string; }

export function HRIntelligence({ tab = "attendance_analytics" }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [attendance, setAttendance] = useState<AttendanceAnalytics | null>(null);
  const [payroll, setPayroll] = useState<PayrollAnalytics | null>(null);
  const [attrition, setAttrition] = useState<AttritionPrediction | null>(null);
  const [shift, setShift] = useState<ShiftOptimization | null>(null);
  const [productivity, setProductivity] = useState<ProductivityScore | null>(null);
  const [training, setTraining] = useState<TrainingRecommendation | null>(null);

  useEffect(() => {
    async function loadTabMetrics() {
      setLoading(true);
      setError("");
      try {
        if (tab === "attendance_analytics") {
          const res = await intelligenceApi.getAttendanceAnalytics();
          setAttendance(res);
        } else if (tab === "payroll_analytics") {
          const res = await intelligenceApi.getPayrollAnalytics();
          setPayroll(res);
        } else if (tab === "attrition_prediction") {
          const res = await intelligenceApi.getAttritionPrediction();
          setAttrition(res);
        } else if (tab === "shift_optimization") {
          const res = await intelligenceApi.getShiftOptimization();
          setShift(res);
        } else if (tab === "productivity_score") {
          const res = await intelligenceApi.getProductivityScore();
          setProductivity(res);
        } else if (tab === "training_recommendation") {
          const res = await intelligenceApi.getTrainingRecommendation();
          setTraining(res);
        }
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Failed to query analytics engine.");
      } finally {
        setLoading(false);
      }
    }
    loadTabMetrics();
  }, [tab]);

  if (loading) {
    return (
      <div className="p-12 flex justify-center items-center h-64 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-semibold">Running predictive models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 font-sans">
        <div className="glass-panel p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
          <AlertTriangle className="size-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground text-base mb-1">Analytics Query Failure</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Payroll Analytics ──────────────────────────────────────────────────
  if (tab === "payroll_analytics" && payroll) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll Analytics</h1>
          <p className="text-sm text-muted-foreground">Department-wise payroll cost analysis and YoY trends.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Monthly Payroll", value: `$${(payroll.monthly_payroll).toLocaleString()}`, color: "text-blue-500" },
            { label: "Highest Avg Salary Dept", value: payroll.highest_dept, color: "text-foreground" },
            { label: "YoY Payroll Growth", value: payroll.growth_yoy, color: "text-emerald-500" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Department</th>
                  <th className="px-6 py-4 text-center font-medium">Headcount</th>
                  <th className="px-6 py-4 text-right font-medium">Total Monthly Payroll</th>
                  <th className="px-6 py-4 text-right font-medium">Avg Salary</th>
                  <th className="px-6 py-4 text-right font-medium">YoY Change</th>
                  <th className="px-6 py-4 font-medium">Cost Share</th>
                </tr>
              </thead>
              <tbody>
                {payroll.dept_costs.map((dept, i) => {
                  const totalAll = payroll.dept_costs.reduce((s, d) => s + d.totalPayroll, 0);
                  const share = totalAll > 0 ? Math.round((dept.totalPayroll / totalAll) * 100) : 0;
                  return (
                    <motion.tr key={dept.dept} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{dept.dept}</td>
                      <td className="px-6 py-4 text-center">{dept.headcount}</td>
                      <td className="px-6 py-4 text-right">${dept.totalPayroll.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">${Math.round(dept.avgSalary).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-emerald-500 flex items-center justify-end gap-1"><TrendingUp className="size-3" />+{dept.yoyChange}%</span>
                      </td>
                      <td className="px-6 py-4 w-32">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${share}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{share}%</p>
                      </td>
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

  // ─── Attrition Prediction ─────────────────────────────────────────────
  if (tab === "attrition_prediction" && attrition) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attrition Prediction</h1>
          <p className="text-sm text-muted-foreground">AI-driven early warning system for employee flight risk.</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600 font-sans">
          ⚡ AI Model trained on tenure, performance, engagement, and compensation data. Scores are risk indicators.
        </div>
        <div className="space-y-4">
          {attrition.at_risk.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-xl border border-border/50 bg-muted/10">
              <ShieldCheck className="size-12 text-emerald-500 mb-4 opacity-75" />
              <h3 className="font-semibold text-foreground text-lg mb-1">Excellent Retention Outlook</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No active employees flagged as attrition flight risks.
              </p>
            </div>
          ) : (
            attrition.at_risk.map((emp, i) => (
              <motion.div key={emp.name} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`glass-panel p-6 rounded-xl border ${emp.risk === "High" ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{emp.name}</h3>
                    <p className="text-sm text-muted-foreground">{emp.dept}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${emp.risk === "High" ? "text-red-500" : "text-amber-500"}`}>{emp.riskScore}%</p>
                    <p className="text-xs text-muted-foreground">Risk Score</p>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full ${emp.risk === "High" ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${emp.riskScore}%` }} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk Factors</p>
                  {emp.factors.map(f => (
                    <div key={f} className="flex items-start gap-2 text-sm"><AlertTriangle className="size-3 text-amber-500 flex-shrink-0 mt-0.5" /><span className="text-muted-foreground">{f}</span></div>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ─── Shift Optimization ────────────────────────────────────────────────
  if (tab === "shift_optimization" && shift) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shift Optimization</h1>
          <p className="text-sm text-muted-foreground">AI-recommended staffing levels by shift to maximize coverage efficiency.</p>
        </div>
        <div className="space-y-4">
          {shift.shifts.map((s, i) => (
            <motion.div key={s.shift} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-foreground">{s.shift}</h3>
                <div className="flex gap-4 text-sm font-sans">
                  <span className="text-muted-foreground">Current Staff: <span className="font-bold text-foreground">{s.employees}</span></span>
                  <span className="text-muted-foreground">Optimal: <span className={`font-bold ${s.employees < s.optimal ? "text-red-500" : s.employees > s.optimal ? "text-amber-500" : "text-emerald-500"}`}>{s.optimal}</span></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Coverage Ratio</span><span className={s.coverage >= 100 ? "text-emerald-500" : "text-red-500"}>{s.coverage}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.coverage >= 100 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(s.coverage, 100)}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Target Efficiency</span><span>{s.efficiency}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.efficiency}%` }} /></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Productivity Score ───────────────────────────────────────────────
  if (tab === "productivity_score" && productivity) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Productivity Score</h1>
          <p className="text-sm text-muted-foreground">Composite productivity scores based on completed OKRs, tasks, and attendance.</p>
        </div>
        <div className="space-y-3">
          {productivity.scores.map((emp, i) => (
            <motion.div key={emp.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
              <div className="size-10 rounded-xl bg-gradient-to-br from-primary/80 to-purple-500/80 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {emp.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <p className="font-semibold text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted-foreground font-sans">{emp.dept} · {emp.tasks} active tasks · {emp.output}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {emp.trend === "up" ? <TrendingUp className="size-4 text-emerald-500" /> : emp.trend === "down" ? <TrendingDown className="size-4 text-red-500" /> : <Activity className="size-4 text-muted-foreground" />}
                    <span className={`text-xl font-bold ${emp.score >= 90 ? "text-emerald-500" : emp.score >= 80 ? "text-blue-500" : "text-amber-500"}`}>{emp.score}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${emp.score >= 90 ? "bg-emerald-500" : emp.score >= 80 ? "bg-blue-500" : "bg-amber-500"}`} style={{ width: `${emp.score}%` }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Training Recommendation ──────────────────────────────────────────
  if (tab === "training_recommendation" && training) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Training Recommendations</h1>
          <p className="text-sm text-muted-foreground">AI-powered learning suggestions based on skill gaps and appraisal objectives.</p>
        </div>
        <div className="space-y-4">
          {training.recommendations.map((rec, i) => (
            <motion.div key={rec.employee} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg flex-shrink-0 mt-0.5"><Brain className="size-5 text-purple-500" /></div>
                  <div>
                    <p className="font-semibold text-foreground">{rec.employee} <span className="font-normal text-muted-foreground text-sm">· {rec.dept}</span></p>
                    <p className="text-primary font-medium text-sm mt-0.5">{rec.skill}</p>
                    <p className="text-sm text-muted-foreground mt-1 font-sans">{rec.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${rec.priority === "High" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>{rec.priority}</span>
                  <button className="px-3 py-1.5 gradient-brand text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">Enroll</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Attendance Analytics (Default Tab) ────────────────────────────────
  const defaultAttendance = attendance || {
    avg_attendance: 94.0,
    today_presence: 93.0,
    chronic_absentees: 2,
    late_arrivals: 6,
    dept_rates: [
      { dept: "Engineering", rate: 96 },
      { dept: "Sales", rate: 91 },
      { dept: "Operations", rate: 97 },
      { dept: "Marketing", rate: 94 },
    ],
    method_rates: [
      { method: "Biometric", count: 8, pct: 60, color: "bg-indigo-500" },
      { method: "GPS (Remote)", count: 3, pct: 20, color: "bg-green-500" },
      { method: "Face Recognition", count: 1, pct: 10, color: "bg-blue-500" },
      { method: "Manual", count: 1, pct: 10, color: "bg-amber-500" },
    ]
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance Analytics</h1>
        <p className="text-sm text-muted-foreground">Attendance trends and tracking patterns across the organization.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Attendance (MTD)", value: `${defaultAttendance.avg_attendance}%`, color: "text-emerald-500" },
          { label: "Today's Presence", value: `${defaultAttendance.today_presence}%`, color: "text-blue-500" },
          { label: "Chronic Absentees", value: defaultAttendance.chronic_absentees, color: "text-red-500" },
          { label: "Late Arrivals (MTD)", value: defaultAttendance.late_arrivals, color: "text-amber-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-5 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Attendance by Department</h3>
          <div className="space-y-3">
            {defaultAttendance.dept_rates.map(d => (
              <div key={d.dept} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-muted-foreground">{d.dept}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${d.rate >= 95 ? "bg-emerald-500" : d.rate >= 90 ? "bg-blue-500" : "bg-amber-500"}`} style={{ width: `${d.rate}%` }} />
                </div>
                <span className="font-semibold text-foreground w-12 text-right">{d.rate}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Check-in Method Breakdown</h3>
          <div className="space-y-4">
            {defaultAttendance.method_rates.map(m => (
              <div key={m.method}>
                <div className="flex justify-between text-sm text-muted-foreground mb-1"><span>{m.method}</span><span>{m.count} emp · {m.pct}%</span></div>
                <div className="h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
