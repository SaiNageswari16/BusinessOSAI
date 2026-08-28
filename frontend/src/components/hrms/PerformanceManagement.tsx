import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Target, TrendingUp, TrendingDown, Star, BarChart3, Gift, Calendar, CheckSquare, Sparkles, User, Award, XCircle, FileCheck, ChevronRight, AlertTriangle } from "lucide-react";
import { performanceApi, employeesApi, PerformanceGoal, PerformanceKpi, PerformanceAppraisal, PerformanceIncentive, Employee } from "../../lib/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useCurrency } from "@/hooks/use-currency";

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
    const { currency, formatCurrency } = useCurrency();
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [kpis, setKpis] = useState<PerformanceKpi[]>([]);
  const [appraisals, setAppraisals] = useState<PerformanceAppraisal[]>([]);
  const [incentives, setIncentives] = useState<PerformanceIncentive[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals state
  const [goalOpen, setGoalOpen] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [appraisalOpen, setAppraisalOpen] = useState(false);
  const [incentiveOpen, setIncentiveOpen] = useState(false);

  // Forms state
  const [goalForm, setGoalForm] = useState({
    employeeId: "",
    title: "",
    description: "",
    targetDate: "",
    weight: 20,
    progress: 0,
    status: "Not Started"
  });

  const [kpiForm, setKpiForm] = useState({
    metric: "",
    target: "",
    current: "",
    unit: "",
    achievement: 0
  });

  const [appraisalForm, setAppraisalForm] = useState({
    employeeId: "",
    period: "H1 2026",
    selfScore: 80,
    managerScore: 85,
    finalScore: 83,
    rating: "Meets Expectations",
    reviewer: "Alex Rivera",
    status: "Pending"
  });

  const [incentiveForm, setIncentiveForm] = useState({
    employeeName: "",
    department: "Sales",
    type: "Q2 Incentive",
    basis: "",
    amount: 1000,
    status: "Approved"
  });

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [gRes, kRes, aRes, iRes, eRes] = await Promise.all([
        performanceApi.listGoals(),
        performanceApi.listKpis(),
        performanceApi.listAppraisals(),
        performanceApi.listIncentives(),
        employeesApi.list(1, 100)
      ]);
      setGoals(gRes.items);
      setKpis(kRes.items);
      setAppraisals(aRes.items);
      setIncentives(iRes.items);
      setEmployees(eRes.items);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load database pipelines.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  // Handle OKR Goal Submission
  const handleSetGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.employeeId || !goalForm.title || !goalForm.targetDate) {
      showNotification("Please fill in all required fields.", "error");
      return;
    }
    const emp = employees.find(x => x.id === goalForm.employeeId);
    try {
      await performanceApi.createGoal({
        employee_id: goalForm.employeeId,
        employee_name: emp ? emp.full_name : "Employee",
        title: goalForm.title,
        description: goalForm.description,
        target_date: goalForm.targetDate,
        weight: Number(goalForm.weight),
        progress: Number(goalForm.progress),
        status: goalForm.status
      });
      showNotification("Goal target successfully registered.");
      setGoalOpen(false);
      setGoalForm({ employeeId: "", title: "", description: "", targetDate: "", weight: 20, progress: 0, status: "Not Started" });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to save Goal", "error");
    }
  };

  // Inline Goal Progress updates
  const handleUpdateProgress = async (id: string, newProgress: number) => {
    let newStatus = "Not Started";
    if (newProgress >= 100) newStatus = "Completed";
    else if (newProgress > 60) newStatus = "On Track";
    else if (newProgress > 0) newStatus = "At Risk";

    try {
      await performanceApi.updateGoal(id, {
        progress: newProgress,
        status: newStatus
      });
      showNotification("Goal progress saved.");
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to update progress", "error");
    }
  };

  // Handle KPI submission
  const handleCreateKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kpiForm.metric || !kpiForm.target || !kpiForm.unit) {
      showNotification("Please fill in all fields.", "error");
      return;
    }
    try {
      const achievement = kpiForm.current && kpiForm.target 
        ? Math.round((parseFloat(kpiForm.current.replace(/[^0-9.]/g, '')) / parseFloat(kpiForm.target.replace(/[^0-9.]/g, ''))) * 100)
        : 0;

      await performanceApi.createKpi({
        metric: kpiForm.metric,
        target: kpiForm.target,
        current: kpiForm.current,
        unit: kpiForm.unit,
        achievement: isNaN(achievement) ? 80 : Math.min(achievement, 150)
      });
      showNotification("KPI Metric created.");
      setKpiOpen(false);
      setKpiForm({ metric: "", target: "", current: "", unit: "", achievement: 0 });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to save KPI", "error");
    }
  };

  // Handle Appraisal
  const handleCreateAppraisal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appraisalForm.employeeId || !appraisalForm.reviewer) {
      showNotification("Please select employee and reviewer.", "error");
      return;
    }
    const emp = employees.find(x => x.id === appraisalForm.employeeId);
    try {
      await performanceApi.createAppraisal({
        employee_id: appraisalForm.employeeId,
        employee_name: emp ? emp.full_name : "Employee",
        department: emp?.department_id ? "Operations" : "Engineering",
        period: appraisalForm.period,
        self_score: Number(appraisalForm.selfScore),
        manager_score: Number(appraisalForm.managerScore),
        final_score: Number(appraisalForm.finalScore),
        rating: appraisalForm.rating,
        reviewer: appraisalForm.reviewer,
        status: appraisalForm.status
      });
      showNotification("Appraisal performance log submitted.");
      setAppraisalOpen(false);
      setAppraisalForm({ employeeId: "", period: "H1 2026", selfScore: 80, managerScore: 85, finalScore: 83, rating: "Meets Expectations", reviewer: "Alex Rivera", status: "Pending" });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to start appraisal", "error");
    }
  };

  // Handle Incentive
  const handleCreateIncentive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incentiveForm.employeeName || !incentiveForm.basis) {
      showNotification("Please fill in basis and select employee.", "error");
      return;
    }
    try {
      await performanceApi.createIncentive({
        employee_name: incentiveForm.employeeName,
        department: incentiveForm.department,
        type: incentiveForm.type,
        basis: incentiveForm.basis,
        amount: Number(incentiveForm.amount),
        status: incentiveForm.status
      });
      showNotification("Incentive award processed successfully.");
      setIncentiveOpen(false);
      setIncentiveForm({ employeeName: "", department: "Sales", type: "Q2 Incentive", basis: "", amount: 1000, status: "Approved" });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Failed to process award", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Contacting database pipelines...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertTriangle className="size-12 text-red-500 mx-auto" />
        <p className="text-red-500 font-medium">{error}</p>
        <Button onClick={loadData}>Retry Connection</Button>
      </div>
    );
  }

  // KPIs
  if (tab === "kpis") {
    return (
      <div className="space-y-6">
        {notification && (
          <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg text-white font-sans text-xs shadow-lg z-50 ${notification.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {notification.message}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">KPIs</h2>
            <p className="text-xs text-muted-foreground">Key Performance Indicators across departments — Q2 2026.</p>
          </div>
          <button onClick={() => setKpiOpen(true)} className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <BarChart3 className="size-3.5" /> Add KPI
          </button>
        </div>

        <div className="space-y-3">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-foreground">{kpi.metric}</p>
                  <p className="text-xs text-muted-foreground">{kpi.unit}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${kpi.achievement >= 100 ? "text-blue-500" : kpi.achievement >= 90 ? "text-emerald-500" : kpi.achievement >= 80 ? "text-amber-500" : "text-red-500"}`}>{kpi.achievement}%</p>
                  <p className="text-xs text-muted-foreground font-semibold">achieved</p>
                </div>
              </div>
              <div className="flex gap-4 text-sm mb-2">
                <span className="text-muted-foreground text-xs font-semibold">Target: <span className="font-bold text-foreground">{kpi.target}</span></span>
                <span className="text-muted-foreground text-xs font-semibold">Current: <span className="font-bold text-foreground">{kpi.current}</span></span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${kpi.achievement >= 100 ? "bg-blue-500" : kpi.achievement >= 90 ? "bg-emerald-500" : kpi.achievement >= 80 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(kpi.achievement, 100)}%` }} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add KPI Modal */}
        <AnimatePresence>
          {kpiOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">Configure KPI Target</h3>
                  <button onClick={() => setKpiOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleCreateKpi} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Metric Title</label>
                    <Input value={kpiForm.metric} onChange={(e) => setKpiForm({...kpiForm, metric: e.target.value})} placeholder="e.g. Sales Conversion Rate" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Target Value</label>
                      <Input value={kpiForm.target} onChange={(e) => setKpiForm({...kpiForm, target: e.target.value})} placeholder="e.g. 15%" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Current Value</label>
                      <Input value={kpiForm.current} onChange={(e) => setKpiForm({...kpiForm, current: e.target.value})} placeholder="e.g. 12%" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Department unit</label>
                    <Input value={kpiForm.unit} onChange={(e) => setKpiForm({...kpiForm, unit: e.target.value})} placeholder="e.g. Sales, QA, Engineering" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setKpiOpen(false)}>Cancel</Button>
                    <Button type="submit">Add KPI</Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Appraisals
  if (tab === "appraisals") {
    return (
      <div className="space-y-6">
        {notification && (
          <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg text-white font-sans text-xs shadow-lg z-50 ${notification.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {notification.message}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Appraisals</h2>
            <p className="text-xs text-muted-foreground">H1 2026 performance appraisal results and ratings.</p>
          </div>
          <button onClick={() => setAppraisalOpen(true)} className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-3.5" /> Start Appraisal
          </button>
        </div>

        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Period</th>
                  <th className="px-6 py-4 text-center font-semibold">Self Score</th>
                  <th className="px-6 py-4 text-center font-semibold">Manager Score</th>
                  <th className="px-6 py-4 text-center font-semibold">Final Score</th>
                  <th className="px-6 py-4 font-semibold">Rating</th>
                  <th className="px-6 py-4 font-semibold">Reviewer</th>
                  <th className="px-6 py-4 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {appraisals.map((apr, i) => (
                  <motion.tr key={apr.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4"><p className="font-semibold text-foreground">{apr.employee_name}</p><p className="text-xs text-muted-foreground">{apr.department}</p></td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">{apr.period}</td>
                    <td className="px-6 py-4 text-center">{apr.self_score > 0 ? `${apr.self_score}/100` : "—"}</td>
                    <td className="px-6 py-4 text-center">{apr.manager_score > 0 ? `${apr.manager_score}/100` : "—"}</td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">{apr.final_score > 0 ? `${apr.final_score}/100` : "—"}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-bold ${ratingStyle(apr.rating)}`}>{apr.rating}</span></td>
                    <td className="px-6 py-4 text-muted-foreground font-medium">{apr.reviewer}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${apr.status === "Completed" ? "bg-emerald-500/10 text-emerald-500" : apr.status === "In Progress" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>{apr.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Start Appraisal Modal */}
        <AnimatePresence>
          {appraisalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">Initiate Performance Appraisal</h3>
                  <button onClick={() => setAppraisalOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleCreateAppraisal} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Select Employee</label>
                    <select value={appraisalForm.employeeId} onChange={(e) => setAppraisalForm({...appraisalForm, employeeId: e.target.value})}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                      <option value="">Choose employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Self Score</label>
                      <Input type="number" min="0" max="100" value={appraisalForm.selfScore} onChange={(e) => setAppraisalForm({...appraisalForm, selfScore: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Mgr Score</label>
                      <Input type="number" min="0" max="100" value={appraisalForm.managerScore} onChange={(e) => setAppraisalForm({...appraisalForm, managerScore: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Final Score</label>
                      <Input type="number" min="0" max="100" value={appraisalForm.finalScore} onChange={(e) => setAppraisalForm({...appraisalForm, finalScore: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Rating Designation</label>
                      <select value={appraisalForm.rating} onChange={(e) => setAppraisalForm({...appraisalForm, rating: e.target.value})}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                        <option value="Outstanding">Outstanding</option>
                        <option value="Exceeds Expectations">Exceeds Expectations</option>
                        <option value="Meets Expectations">Meets Expectations</option>
                        <option value="Needs Improvement">Needs Improvement</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Reviewer Name</label>
                      <select value={appraisalForm.reviewer} onChange={(e) => setAppraisalForm({...appraisalForm, reviewer: e.target.value})}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.full_name}>{emp.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Period</label>
                    <Input value={appraisalForm.period} onChange={(e) => setAppraisalForm({...appraisalForm, period: e.target.value})} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setAppraisalOpen(false)}>Cancel</Button>
                    <Button type="submit">Submit Appraisal</Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Performance Reviews (Completed appraisals)
  if (tab === "performance_reviews") {
    const completedAppraisals = appraisals.filter(a => a.status === "Completed");

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Performance Reviews</h2>
            <p className="text-xs text-muted-foreground">360-degree review feedback and manager notes.</p>
          </div>
        </div>
        <div className="space-y-4">
          {completedAppraisals.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-xl border border-border/50 bg-muted/10">
              <FileCheck className="size-12 text-muted-foreground mb-4 opacity-55" />
              <h3 className="font-semibold text-foreground text-lg mb-1">No Completed Performance Reviews</h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                Completed employee appraisals and 360-degree manager evaluations will be displayed here once finalized.
              </p>
              <a href="/hrms?tab=appraisals" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Go to Appraisals page to start a new review <ChevronRight className="size-3" />
              </a>
            </div>
          ) : (
            completedAppraisals.map((apr, i) => (
              <motion.div key={apr.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="glass-panel p-6 rounded-xl border border-border/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{apr.employee_name}</h3>
                    <p className="text-sm text-muted-foreground">{apr.department} · {apr.period} · Reviewed by {apr.reviewer}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex gap-0.5 justify-end mb-1">
                      {Array.from({ length: 5 }, (_, idx) => (
                        <Star key={idx} className={`size-4 ${idx < Math.round(apr.final_score / 20) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${ratingStyle(apr.rating)}`}>{apr.rating}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-3 bg-muted/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Self Score</p><p className="font-bold text-foreground text-xl">{apr.self_score}</p></div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg"><p className="text-xs text-muted-foreground mb-1">Manager Score</p><p className="font-bold text-foreground text-xl">{apr.manager_score}</p></div>
                  <div className="text-center p-3 bg-primary/10 rounded-lg"><p className="text-xs text-primary mb-1 font-bold">Final Score</p><p className="font-bold text-primary text-xl">{apr.final_score}</p></div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Incentives
  if (tab === "incentives") {
    return (
      <div className="space-y-6">
        {notification && (
          <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg text-white font-sans text-xs shadow-lg z-50 ${notification.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
            {notification.message}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Incentives</h2>
            <p className="text-xs text-muted-foreground">Performance-linked incentives and recognition awards.</p>
          </div>
          <button onClick={() => setIncentiveOpen(true)} className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity">
            <Gift className="size-3.5" /> Award Incentive
          </button>
        </div>

        <div className="space-y-4">
          {incentives.map((inc, i) => (
            <motion.div key={inc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="px-2 py-0.5 bg-secondary/50 rounded text-xs text-foreground font-semibold">{inc.type}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${inc.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : inc.status === "Approved" ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"}`}>{inc.status}</span>
                </div>
                <p className="font-bold text-foreground">{inc.employee_name} <span className="font-normal text-muted-foreground">· {inc.department}</span></p>
                <p className="text-xs text-muted-foreground font-semibold">{inc.basis}</p>
              </div>
              <p className="text-2xl font-bold text-emerald-500">{currency.symbol}{inc.amount.toLocaleString()}</p>
            </motion.div>
          ))}
        </div>

        {/* Award Incentive Modal */}
        <AnimatePresence>
          {incentiveOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">Award Employee Incentive</h3>
                  <button onClick={() => setIncentiveOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleCreateIncentive} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Select Employee</label>
                    <select value={incentiveForm.employeeName} onChange={(e) => {
                      const emp = employees.find(x => x.full_name === e.target.value);
                      setIncentiveForm({...incentiveForm, employeeName: e.target.value, department: emp?.department_id ? "Operations" : "Sales"});
                    }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                      <option value="">Choose employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.full_name}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Award Type</label>
                      <select value={incentiveForm.type} onChange={(e) => setIncentiveForm({...incentiveForm, type: e.target.value})}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                        <option value="Q2 Incentive">Q2 Incentive</option>
                        <option value="Excellence Award">Excellence Award</option>
                        <option value="Campaign Bonus">Campaign Bonus</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Amount ({currency.symbol})</label>
                      <Input type="number" value={incentiveForm.amount} onChange={(e) => setIncentiveForm({...incentiveForm, amount: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Basis / Reason</label>
                    <Input value={incentiveForm.basis} onChange={(e) => setIncentiveForm({...incentiveForm, basis: e.target.value})} placeholder="e.g. 120% of sales quota achieved" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIncentiveOpen(false)}>Cancel</Button>
                    <Button type="submit">Award Bonus</Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Default: goals
  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg text-white font-sans text-xs shadow-lg z-50 ${notification.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
          {notification.message}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Goals (OKRs)</h2>
          <p className="text-xs text-muted-foreground">Employee goal tracking for Q3 2026.</p>
        </div>
        <button onClick={() => setGoalOpen(true)} className="flex items-center gap-1.5 px-3 h-8 gradient-brand text-white rounded-lg text-xs font-semibold shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-3.5" /> Set Goal
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "On Track", count: goals.filter(g => g.status === "On Track").length, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "At Risk", count: goals.filter(g => g.status === "At Risk").length, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Completed", count: goals.filter(g => g.status === "Completed").length, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Not Started", count: goals.filter(g => g.status === "Not Started").length, color: "text-muted-foreground", bg: "bg-muted/50" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`glass-panel p-5 rounded-xl border border-border/50 text-center ${s.bg}`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        {goals.map((goal, i) => (
          <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-6 rounded-xl border border-border/50 flex flex-col space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${goalStatusStyle(goal.status)}`}>{goal.status}</span>
                <h3 className="font-bold text-foreground text-lg">{goal.title}</h3>
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1"><User className="size-3.5" /> Assigned: {goal.employee_name} · Due: {new Date(goal.target_date).toLocaleDateString()}</p>
              </div>
              <span className="text-xs font-bold bg-muted/40 p-2 border border-border rounded-lg text-muted-foreground">Weight: {goal.weight}%</span>
            </div>

            <p className="text-xs text-muted-foreground font-medium leading-relaxed">{goal.description || "No description provided."}</p>

            <div className="space-y-2 pt-2 border-t border-border/40">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Progress Completion</span>
                <span className="text-primary">{goal.progress}%</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${goal.progress}%` }} />
              </div>
              
              {/* Progress Slider updater */}
              {goal.status !== "Completed" && (
                <div className="flex items-center gap-3 pt-2">
                  <label className="text-[10px] text-muted-foreground font-bold">Update Progress:</label>
                  <input type="range" min="0" max="100" value={goal.progress}
                    onChange={(e) => handleUpdateProgress(goal.id, Number(e.target.value))}
                    className="w-32 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Set Goal Modal */}
      <AnimatePresence>
        {goalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4 font-sans text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <h3 className="text-base font-bold text-foreground">Configure Goal Objective</h3>
                <button onClick={() => setGoalOpen(false)}><XCircle className="size-5 text-muted-foreground" /></button>
              </div>
              <form onSubmit={handleSetGoal} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Select Employee</label>
                  <select value={goalForm.employeeId} onChange={(e) => setGoalForm({...goalForm, employeeId: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none">
                    <option value="">Choose employee...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Goal Objective Title</label>
                  <Input value={goalForm.title} onChange={(e) => setGoalForm({...goalForm, title: e.target.value})} placeholder="e.g. Optimize platform core API latency" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Detailed Description</label>
                  <Textarea value={goalForm.description} onChange={(e) => setGoalForm({...goalForm, description: e.target.value})} placeholder="Provide key metrics or expectations..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Target Date</label>
                    <Input type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm({...goalForm, targetDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">OKR Weight (%)</label>
                    <Input type="number" min="0" max="100" value={goalForm.weight} onChange={(e) => setGoalForm({...goalForm, weight: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setGoalOpen(false)}>Cancel</Button>
                  <Button type="submit">Establish Goal</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
