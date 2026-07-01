import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Brain, Users } from "lucide-react";
import { useHrmsData } from "@/hooks/useHrmsData";

interface Props { tab?: string; }

export function HRIntelligence({ tab = "attendance_analytics" }: Props) {
  const { mockHrStats, mockAttendance } = useHrmsData();

  if (tab === "payroll_analytics") {
    const deptPayroll = [
      { dept: "Engineering", headcount: 22, totalPayroll: 2860000, avgSalary: 130000, yoyChange: 12 },
      { dept: "Sales", headcount: 18, totalPayroll: 1620000, avgSalary: 90000, yoyChange: 8 },
      { dept: "Operations", headcount: 30, totalPayroll: 2100000, avgSalary: 70000, yoyChange: 5 },
      { dept: "Marketing", headcount: 10, totalPayroll: 1050000, avgSalary: 105000, yoyChange: 15 },
      { dept: "Finance", headcount: 8, totalPayroll: 720000, avgSalary: 90000, yoyChange: 6 },
      { dept: "HR", headcount: 6, totalPayroll: 528000, avgSalary: 88000, yoyChange: 4 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Payroll Analytics</h1><p className="text-sm text-muted-foreground">Department-wise payroll cost analysis and YoY trends.</p></div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Monthly Payroll", value: "$1.25M", color: "text-blue-500" },
            { label: "Highest Avg Salary Dept", value: "Engineering", color: "text-foreground" },
            { label: "YoY Payroll Growth", value: "+8.5%", color: "text-emerald-500" },
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
                  <th className="px-6 py-4 text-right font-medium">Total Payroll</th>
                  <th className="px-6 py-4 text-right font-medium">Avg Salary</th>
                  <th className="px-6 py-4 text-right font-medium">YoY Change</th>
                  <th className="px-6 py-4 font-medium">Cost Share</th>
                </tr>
              </thead>
              <tbody>
                {deptPayroll.map((dept, i) => {
                  const totalAll = deptPayroll.reduce((s, d) => s + d.totalPayroll, 0);
                  const share = Math.round((dept.totalPayroll / totalAll) * 100);
                  return (
                    <motion.tr key={dept.dept} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{dept.dept}</td>
                      <td className="px-6 py-4 text-center">{dept.headcount}</td>
                      <td className="px-6 py-4 text-right">${(dept.totalPayroll / 1000).toFixed(0)}K</td>
                      <td className="px-6 py-4 text-right">${dept.avgSalary.toLocaleString()}</td>
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

  if (tab === "attrition_prediction") {
    const atRiskEmployees = [
      { name: "Kevin Park", dept: "Engineering", riskScore: 78, factors: ["6 months below market salary", "3 failed promotion applications", "High workload"], risk: "High" },
      { name: "Linda Torres", dept: "Sales", riskScore: 62, factors: ["Part-time – seeking full-time", "No career growth visible"], risk: "Medium" },
      { name: "Marcus Johnson", dept: "Finance", riskScore: 45, factors: ["Manager conflict flagged", "No raises in 2 years"], risk: "Medium" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Attrition Prediction</h1><p className="text-sm text-muted-foreground">AI-driven early warning system for employee flight risk.</p></div>
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600">
          ⚡ AI Model trained on tenure, performance, engagement, and compensation data. Scores are indicative.
        </div>
        <div className="space-y-4">
          {atRiskEmployees.map((emp, i) => (
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
          ))}
        </div>
      </div>
    );
  }

  if (tab === "shift_optimization") {
    const shifts = [
      { shift: "Morning (7AM–3PM)", employees: 30, optimal: 32, coverage: 94, efficiency: 88 },
      { shift: "General (9AM–6PM)", employees: 74, optimal: 70, coverage: 105, efficiency: 92 },
      { shift: "Evening (3PM–11PM)", employees: 12, optimal: 15, coverage: 80, efficiency: 75 },
      { shift: "Night (11PM–7AM)", employees: 8, optimal: 7, coverage: 114, efficiency: 96 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Shift Optimization</h1><p className="text-sm text-muted-foreground">AI-recommended staffing levels by shift to maximize efficiency.</p></div>
        <div className="space-y-4">
          {shifts.map((s, i) => (
            <motion.div key={s.shift} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-foreground">{s.shift}</h3>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">Current: <span className="font-bold text-foreground">{s.employees}</span></span>
                  <span className="text-muted-foreground">Optimal: <span className={`font-bold ${s.employees < s.optimal ? "text-red-500" : s.employees > s.optimal ? "text-amber-500" : "text-emerald-500"}`}>{s.optimal}</span></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Coverage</span><span className={s.coverage >= 100 ? "text-emerald-500" : "text-red-500"}>{s.coverage}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${s.coverage >= 100 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(s.coverage, 100)}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Efficiency</span><span>{s.efficiency}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.efficiency}%` }} /></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "productivity_score") {
    const scores = [
      { name: "Kevin Park", dept: "Engineering", score: 94, trend: "up", tasks: 28, output: "51 story pts" },
      { name: "Daniel Roberts", dept: "Operations", score: 91, trend: "up", tasks: 42, output: "98.5% accuracy" },
      { name: "Sarah Mitchell", dept: "Marketing", score: 88, trend: "up", tasks: 19, output: "3 campaigns" },
      { name: "James Thompson", dept: "Sales", score: 85, trend: "stable", tasks: 35, output: "$820K revenue" },
      { name: "Marcus Johnson", dept: "Finance", score: 72, trend: "down", tasks: 22, output: "Reports on time" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Productivity Score</h1><p className="text-sm text-muted-foreground">Composite productivity scores based on output, tasks, and attendance.</p></div>
        <div className="space-y-3">
          {scores.map((emp, i) => (
            <motion.div key={emp.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="glass-panel p-5 rounded-xl border border-border/50 flex items-center gap-4">
              <div className="size-10 rounded-xl bg-gradient-to-br from-primary/80 to-purple-500/80 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {emp.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <div><p className="font-semibold text-foreground">{emp.name}</p><p className="text-xs text-muted-foreground">{emp.dept} · {emp.tasks} tasks · {emp.output}</p></div>
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

  if (tab === "training_recommendation") {
    const recommendations = [
      { employee: "Marcus Johnson", dept: "Finance", skill: "Python for Financial Analysis", reason: "Low automation adoption score", priority: "High" },
      { employee: "Linda Torres", dept: "Sales", skill: "B2B Sales Techniques", reason: "Conversion rate below team avg", priority: "High" },
      { employee: "Priya Sharma", dept: "HR", skill: "HR Analytics with Power BI", reason: "Skill gap identified in appraisal", priority: "Medium" },
      { employee: "Kevin Park", dept: "Engineering", skill: "Kubernetes & Container Orchestration", reason: "Team adopting cloud-native stack", priority: "Medium" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Training Recommendations</h1><p className="text-sm text-muted-foreground">AI-powered learning suggestions based on skill gaps and performance.</p></div>
        <div className="space-y-4">
          {recommendations.map((rec, i) => (
            <motion.div key={rec.employee} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg flex-shrink-0 mt-0.5"><Brain className="size-5 text-purple-500" /></div>
                  <div>
                    <p className="font-semibold text-foreground">{rec.employee} <span className="font-normal text-muted-foreground text-sm">· {rec.dept}</span></p>
                    <p className="text-primary font-medium text-sm mt-0.5">{rec.skill}</p>
                    <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${rec.priority === "High" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>{rec.priority}</span>
                  <button className="px-3 py-1.5 gradient-brand text-white rounded-lg text-xs font-medium hover:opacity-90">Enroll</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Default: attendance_analytics
  const totalEmp = mockAttendance.length;
  const presentCount = mockAttendance.filter(a => a.status === "Present" || a.status === "Late").length;
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Attendance Analytics</h1><p className="text-sm text-muted-foreground">Attendance trends and patterns across the organization.</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Attendance (MTD)", value: `${mockHrStats.avgAttendance}%`, color: "text-emerald-500" },
          { label: "Today's Presence", value: `${Math.round(presentCount / totalEmp * 100)}%`, color: "text-blue-500" },
          { label: "Chronic Absentees", value: 3, color: "text-red-500" },
          { label: "Late Arrivals (MTD)", value: 12, color: "text-amber-500" },
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
            {[
              { dept: "Engineering", rate: 96 },
              { dept: "Sales", rate: 91 },
              { dept: "Operations", rate: 97 },
              { dept: "Marketing", rate: 94 },
              { dept: "HR", rate: 89 },
              { dept: "Finance", rate: 88 },
            ].map(d => (
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
            {[
              { method: "Biometric", count: 5, pct: 50, color: "bg-indigo-500" },
              { method: "GPS (Remote)", count: 2, pct: 20, color: "bg-green-500" },
              { method: "Face Recognition", count: 1, pct: 10, color: "bg-blue-500" },
              { method: "Manual", count: 2, pct: 20, color: "bg-amber-500" },
            ].map(m => (
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
