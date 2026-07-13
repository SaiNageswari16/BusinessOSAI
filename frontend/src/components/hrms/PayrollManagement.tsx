import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Download, FileText, CreditCard, DollarSign, Shield, Loader2 } from "lucide-react";
import { payrollApi, employeesApi, designationsApi, SalaryStructure, Payslip, Employee, PayGrade, Designation } from "../../lib/api-client";
import { Briefcase, Settings } from "lucide-react";
import { Button } from "../ui/button";

interface Props { tab?: string; }

const payslipStatusStyle = (s: string) => {
  if (s === "Paid") return "bg-emerald-500/10 text-emerald-500";
  if (s === "Processing") return "bg-amber-500/10 text-amber-500";
  return "bg-muted text-muted-foreground";
};

export function PayrollManagement({ tab = "salary_structure" }: Props) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payGrades, setPayGrades] = useState<PayGrade[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);

  // Pay Grade form states
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [gradeName, setGradeName] = useState("");
  const [gradeDesigId, setGradeDesigId] = useState("");

  // Form states for creating structure
  const [structDialogOpen, setStructDialogOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [hra, setHra] = useState("");
  const [otherAllow, setOtherAllow] = useState("");
  const [pf, setPf] = useState("");
  const [esi, setEsi] = useState("");
  const [tds, setTds] = useState("");
  const [otherDed, setOtherDed] = useState("");

  // Process payroll states
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processEmpId, setProcessEmpId] = useState("");
  const [processMonth, setProcessMonth] = useState("7");
  const [processYear, setProcessYear] = useState("2026");

  const loadPayrollData = useCallback(async () => {
    setLoading(true);
    try {
      const structsRes = await payrollApi.listSalaryStructures();
      setStructures(structsRes || []);
      
      const slipsRes = await payrollApi.listPayslips();
      setPayslips(slipsRes || []);

      const empsRes = await employeesApi.list(1, 100);
      setEmployees(empsRes.items || []);

      const gradesRes = await payrollApi.listPayGrades();
      setPayGrades(gradesRes || []);

      const desigsRes = await designationsApi.list(1, 100);
      setDesignations(desigsRes.items || []);
    } catch (e) {
      console.error("Failed to load payroll data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayrollData();
  }, [loadPayrollData]);

  const handleCreatePayGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeName || !gradeDesigId) return;
    try {
      await payrollApi.createPayGrade({
        name: gradeName,
        designation_id: gradeDesigId,
        basic_salary: parseFloat(basicSalary) || 0,
        hra: parseFloat(hra) || 0,
        other_allowances: parseFloat(otherAllow) || 0,
        pf_deduction: parseFloat(pf) || 0,
        esi_deduction: parseFloat(esi) || 0,
        tds_deduction: parseFloat(tds) || 0,
      });
      setGradeDialogOpen(false);
      setGradeName("");
      setGradeDesigId("");
      setBasicSalary("");
      setHra("");
      setOtherAllow("");
      setPf("");
      setEsi("");
      setTds("");
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to create pay grade: " + err.message);
    }
  };

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !basicSalary) return;
    try {
      await payrollApi.createSalaryStructure({
        employee_id: selectedEmpId,
        basic_salary: parseFloat(basicSalary) || 0,
        hra: parseFloat(hra) || 0,
        other_allowances: parseFloat(otherAllow) || 0,
        pf_deduction: parseFloat(pf) || 0,
        esi_deduction: parseFloat(esi) || 0,
        tds_deduction: parseFloat(tds) || 0,
        other_deductions: parseFloat(otherDed) || 0
      });
      setStructDialogOpen(false);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to save structure: " + err.message);
    }
  };

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processEmpId) return;
    try {
      await payrollApi.generatePayslip({
        employee_id: processEmpId,
        month: parseInt(processMonth) || 7,
        year: parseInt(processYear) || 2026,
        status: "Paid"
      });
      setProcessDialogOpen(false);
      loadPayrollData();
    } catch (err: any) {
      alert("Failed to process payroll: " + err.message);
    }
  };

  if (tab === "pay_grades") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Designation Pay Grades</h1>
            <p className="text-sm text-muted-foreground">Define default salary structure templates mapped to designations.</p>
          </div>
          <Button onClick={() => setGradeDialogOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-1.5" /> Create Pay Grade
          </Button>
        </div>

        {loading && payGrades.length === 0 && (
          <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {payGrades.map((g, i) => {
            const allowances = g.hra + g.other_allowances;
            const deductions = g.pf_deduction + g.esi_deduction + g.tds_deduction;
            const net = (g.basic_salary + allowances) - deductions;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-sm transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl"><Briefcase className="size-6 text-primary" /></div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-500">
                      Mapped
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-1 leading-tight">{g.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">Designation: <span className="font-semibold text-foreground">{g.designation_name || "Unassigned"}</span></p>
                  
                  <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Basic</p><p className="font-semibold text-foreground">${g.basic_salary.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Allowances</p><p className="font-semibold text-emerald-500">+${allowances.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Deductions</p><p className="font-semibold text-red-500">-${deductions.toLocaleString()}</p></div>
                  </div>
                </div>
                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Estimated Net Payout:</span>
                  <span className="text-sm font-bold text-emerald-500">${net.toLocaleString()} / mo</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Create Pay Grade Dialog */}
        {gradeDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Briefcase className="size-5 text-primary" /> Create Pay Grade Template
              </h3>
              <form onSubmit={handleCreatePayGrade} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Grade Name *</label>
                    <input type="text" value={gradeName} onChange={e => setGradeName(e.target.value)} placeholder="e.g. Lead Dev Grade" className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Target Designation *</label>
                    <select value={gradeDesigId} onChange={e => setGradeDesigId(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                      <option value="">-- Choose Designation --</option>
                      {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Basic Salary *</label>
                    <input type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} placeholder="e.g. 5000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">HRA Allowance</label>
                    <input type="number" value={hra} onChange={e => setHra(e.target.value)} placeholder="e.g. 2000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Other Allowances</label>
                    <input type="number" value={otherAllow} onChange={e => setOtherAllow(e.target.value)} placeholder="e.g. 1000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">PF Deduction</label>
                    <input type="number" value={pf} onChange={e => setPf(e.target.value)} placeholder="e.g. 600" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">ESI Deduction</label>
                    <input type="number" value={esi} onChange={e => setEsi(e.target.value)} placeholder="37" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">TDS Deduction</label>
                    <input type="number" value={tds} onChange={e => setTds(e.target.value)} placeholder="500" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setGradeDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm">Create pay grade</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === "pay_grades") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Designation Pay Grades</h1>
            <p className="text-sm text-muted-foreground">Define default salary structure templates mapped to designations.</p>
          </div>
          <Button onClick={() => setGradeDialogOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-1.5" /> Create Pay Grade
          </Button>
        </div>

        {loading && payGrades.length === 0 && (
          <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {payGrades.map((g, i) => {
            const allowances = g.hra + g.other_allowances;
            const deductions = g.pf_deduction + g.esi_deduction + g.tds_deduction;
            const net = (g.basic_salary + allowances) - deductions;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-sm transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl"><Briefcase className="size-6 text-primary" /></div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-500">
                      Mapped
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-1 leading-tight">{g.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">Designation: <span className="font-semibold text-foreground">{g.designation_name || "Unassigned"}</span></p>
                  
                  <div className="grid grid-cols-3 gap-3 text-xs mb-4">
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Basic</p><p className="font-semibold text-foreground">${g.basic_salary.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Allowances</p><p className="font-semibold text-emerald-500">+${allowances.toLocaleString()}</p></div>
                    <div className="bg-muted/40 p-2 rounded border"><p className="text-muted-foreground uppercase font-bold text-[9px]">Deductions</p><p className="font-semibold text-red-500">-${deductions.toLocaleString()}</p></div>
                  </div>
                </div>
                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Estimated Net Payout:</span>
                  <span className="text-sm font-bold text-emerald-500">${net.toLocaleString()} / mo</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Create Pay Grade Dialog */}
        {gradeDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Briefcase className="size-5 text-primary" /> Create Pay Grade Template
              </h3>
              <form onSubmit={handleCreatePayGrade} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Grade Name *</label>
                    <input type="text" value={gradeName} onChange={e => setGradeName(e.target.value)} placeholder="e.g. Lead Dev Grade" className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Target Designation *</label>
                    <select value={gradeDesigId} onChange={e => setGradeDesigId(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                      <option value="">-- Choose Designation --</option>
                      {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Basic Salary *</label>
                    <input type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} placeholder="e.g. 5000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">HRA Allowance</label>
                    <input type="number" value={hra} onChange={e => setHra(e.target.value)} placeholder="e.g. 2000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Other Allowances</label>
                    <input type="number" value={otherAllow} onChange={e => setOtherAllow(e.target.value)} placeholder="e.g. 1000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">PF Deduction</label>
                    <input type="number" value={pf} onChange={e => setPf(e.target.value)} placeholder="e.g. 600" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">ESI Deduction</label>
                    <input type="number" value={esi} onChange={e => setEsi(e.target.value)} placeholder="37" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">TDS Deduction</label>
                    <input type="number" value={tds} onChange={e => setTds(e.target.value)} placeholder="500" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setGradeDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm">Create pay grade</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === "payroll_processing") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Payroll Processing</h1><p className="text-sm text-muted-foreground">Process and finalize payroll cycles.</p></div>
          <button onClick={() => setProcessDialogOpen(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><CreditCard className="size-4" /> Process Employee Payroll</button>
        </div>

        {/* Processing checklist */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4 md:col-span-2">
            <h3 className="font-semibold text-foreground">Payroll Checklist</h3>
            {[
              { step: "Configure salary structures for all profiles", done: structures.length >= employees.length },
              { step: "Capture and verify attendance logs", done: true },
              { step: "Calculate taxable TDS deductions", done: true },
              { step: "Disburse net salaries and print payslips", done: payslips.length > 0 },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center gap-3 text-sm">
                <div className={`size-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? "bg-emerald-500 text-white" : "border-2 border-muted"}`}>
                  {item.done && <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={item.done ? "text-foreground line-through text-muted-foreground" : "text-foreground font-medium"}>{item.step}</span>
              </div>
            ))}
          </div>
          <div className="glass-panel p-5 rounded-xl border border-border/50 text-center flex flex-col justify-center">
            <p className="text-xs text-muted-foreground mb-1">Generated Payslips</p>
            <p className="text-3xl font-extrabold text-primary">{payslips.length}</p>
          </div>
        </div>

        {/* Process Payroll Dialog */}
        {processDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-foreground">Process Payroll & Generate Payslip</h3>
              <form onSubmit={handleProcessPayroll} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee</label>
                  <select value={processEmpId} onChange={e => setProcessEmpId(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Month</label>
                    <select value={processMonth} onChange={e => setProcessMonth(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option value="5">May</option>
                      <option value="6">June</option>
                      <option value="7">July</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Year</label>
                    <select value={processYear} onChange={e => setProcessYear(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option value="2026">2026</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setProcessDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm">Run & Process</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tab === "pf") {
    const totalPF = structures.reduce((s, e) => s + e.pf_deduction * 2, 0);
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Provident Fund (PF)</h1><p className="text-sm text-muted-foreground">Employee and employer PF contributions.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 text-right font-medium">Basic Salary</th>
                    <th className="px-6 py-4 text-right font-medium">Employee PF (12%)</th>
                    <th className="px-6 py-4 text-right font-medium">Employer PF (12%)</th>
                    <th className="px-6 py-4 text-right font-medium">Total PF</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No PF logs available.</td></tr>
                  ) : structures.map((emp, i) => (
                    <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{emp.employee_name}</td>
                      <td className="px-6 py-4 text-right">${emp.basic_salary.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-blue-500">${emp.pf_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-indigo-500">${emp.pf_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">${(emp.pf_deduction * 2).toLocaleString()}</td>
                    </motion.tr>
                  ))}
                  {structures.length > 0 && (
                    <tr className="bg-muted/30 font-semibold border-t border-border/50">
                      <td className="px-6 py-4">Total ECR PF</td>
                      <td className="px-6 py-4 text-right"></td>
                      <td className="px-6 py-4 text-right text-blue-500">${structures.reduce((s, e) => s + e.pf_deduction, 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-indigo-500">${structures.reduce((s, e) => s + e.pf_deduction, 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-foreground">${totalPF.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "esi") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">ESI (Employee State Insurance)</h1><p className="text-sm text-muted-foreground">ESI contributions — Employee 0.75% · Employer 3.25%.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 text-right font-medium">ESI Deduction</th>
                    <th className="px-6 py-4 text-right font-medium">Employer Contribution</th>
                    <th className="px-6 py-4 text-right font-medium">Total State Insurance</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No ESI logs available.</td></tr>
                  ) : structures.map((emp, i) => (
                    <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{emp.employee_name}</td>
                      <td className="px-6 py-4 text-right text-orange-500">${emp.esi_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-amber-500">${(emp.esi_deduction * 4.3).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold">${(emp.esi_deduction * 5.3).toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "tds") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">TDS on Salary</h1><p className="text-sm text-muted-foreground">Tax deducted at source from employee salaries.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 font-medium">Department</th>
                    <th className="px-6 py-4 text-right font-medium">Monthly TDS</th>
                    <th className="px-6 py-4 text-right font-medium">Annualized Projections</th>
                  </tr>
                </thead>
                <tbody>
                  {structures.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No TDS records found.</td></tr>
                  ) : structures.map((emp, i) => (
                    <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">{emp.employee_name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{emp.department || "N/A"}</td>
                      <td className="px-6 py-4 text-right font-medium text-red-400">${emp.tds_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold">${(emp.tds_deduction * 12).toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "payslips") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Payslips</h1><p className="text-sm text-muted-foreground">Monthly payslip generation and distribution.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 font-medium text-center">Period</th>
                    <th className="px-6 py-4 text-right font-medium">Basic Salary</th>
                    <th className="px-6 py-4 text-right font-medium">Gross Salary</th>
                    <th className="px-6 py-4 text-right font-medium">Deductions</th>
                    <th className="px-6 py-4 text-right font-medium text-emerald-500">Net Pay</th>
                    <th className="px-6 py-4 text-center font-medium">Status</th>
                    <th className="px-6 py-4 text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No payslips generated yet.</td></tr>
                  ) : payslips.map((ps, i) => (
                    <motion.tr key={ps.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground leading-tight">{ps.employee_name}</p>
                        <p className="text-[10px] text-muted-foreground">{ps.employee_code}</p>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-muted-foreground">{ps.year}-{ps.month.toString().padStart(2, '0')}</td>
                      <td className="px-6 py-4 text-right">${ps.basic_salary.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">${ps.gross_salary.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-red-400">-${(ps.pf_deduction + ps.esi_deduction + ps.tds_deduction + ps.other_deductions).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-500">${ps.net_salary.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${payslipStatusStyle(ps.status)}`}>{ps.status}</span></td>
                      <td className="px-6 py-4 text-center"><a href={ps.pdf_url || "#"} className="text-primary hover:underline font-bold text-xs" download>Download PDF</a></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: salary_structure
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Salary Structure</h1><p className="text-sm text-muted-foreground">Salary components and allowances mapping.</p></div>
        <button onClick={() => setStructDialogOpen(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Map Employee Salary</button>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
          {!loading && (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 text-right font-medium">Basic Salary</th>
                  <th className="px-6 py-4 text-right font-medium">HRA Allowance</th>
                  <th className="px-6 py-4 text-right font-medium">Other Allowances</th>
                  <th className="px-6 py-4 text-right font-medium text-red-400">Total Deductions</th>
                  <th className="px-6 py-4 text-right font-medium text-emerald-500">Net Salary</th>
                </tr>
              </thead>
              <tbody>
                {structures.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No salary configurations mapped yet.</td></tr>
                ) : structures.map((emp, i) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{emp.employee_name}</td>
                    <td className="px-6 py-4"><p className="font-semibold text-foreground text-xs">{emp.designation}</p><p className="text-[10px] text-muted-foreground">{emp.department}</p></td>
                    <td className="px-6 py-4 text-right">${emp.basic_salary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">${emp.hra.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">${emp.other_allowances.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-400">-${(emp.pf_deduction + emp.esi_deduction + emp.tds_deduction + emp.other_deductions).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">${((emp.basic_salary + emp.hra + emp.other_allowances) - (emp.pf_deduction + emp.esi_deduction + emp.tds_deduction + emp.other_deductions)).toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Salary Structure Dialog */}
      {structDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <h3 className="font-bold text-lg text-foreground">Map Employee Salary Structure</h3>
            <form onSubmit={handleCreateStructure} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee *</label>
                <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Basic Salary *</label>
                  <input type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} placeholder="e.g. 5000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">HRA Allowance</label>
                  <input type="number" value={hra} onChange={e => setHra(e.target.value)} placeholder="e.g. 2000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Other Allowances</label>
                  <input type="number" value={otherAllow} onChange={e => setOtherAllow(e.target.value)} placeholder="e.g. 1000" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">PF Deduction (12%)</label>
                  <input type="number" value={pf} onChange={e => setPf(e.target.value)} placeholder="e.g. 600" className="w-full h-10 px-3 text-sm rounded-md border bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">ESI (0.75%)</label>
                  <input type="number" value={esi} onChange={e => setEsi(e.target.value)} placeholder="37" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">TDS Tax</label>
                  <input type="number" value={tds} onChange={e => setTds(e.target.value)} placeholder="500" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Other Ded.</label>
                  <input type="number" value={otherDed} onChange={e => setOtherDed(e.target.value)} placeholder="50" className="w-full h-10 px-2 text-xs rounded-md border bg-background" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setStructDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm">Save Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
