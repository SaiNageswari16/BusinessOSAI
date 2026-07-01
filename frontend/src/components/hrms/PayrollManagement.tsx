import React from "react";
import { motion } from "framer-motion";
import { Plus, Download, FileText, CreditCard, DollarSign, Shield } from "lucide-react";
import { useHrmsData } from "@/hooks/useHrmsData";

interface Props { tab?: string; }

const payslipStatusStyle = (s: string) => {
  if (s === "Paid") return "bg-emerald-500/10 text-emerald-500";
  if (s === "Processing") return "bg-amber-500/10 text-amber-500";
  return "bg-muted text-muted-foreground";
};

export function PayrollManagement({ tab = "salary_structure" }: Props) {
  const { mockSalaryStructures, mockPayslips } = useHrmsData();

  if (tab === "payroll_processing") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Payroll Processing</h1><p className="text-sm text-muted-foreground">Process and finalize payroll for July 2026.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><CreditCard className="size-4" /> Process Payroll</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Payroll (July)", value: "$1,250,000", color: "text-blue-500" },
            { label: "Employees to Process", value: "124", color: "text-foreground" },
            { label: "Pay Date", value: "July 31, 2026", color: "text-emerald-500" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50 space-y-4">
          <h3 className="font-semibold text-foreground">Processing Checklist</h3>
          {[
            { step: "Attendance data finalized", done: true },
            { step: "Leave deductions applied", done: true },
            { step: "Overtime calculated", done: true },
            { step: "TDS / PF / ESI computed", done: true },
            { step: "Payroll approved by CFO", done: false },
            { step: "Bank transfer initiated", done: false },
            { step: "Payslips distributed", done: false },
          ].map((item, i) => (
            <div key={item.step} className="flex items-center gap-3 text-sm">
              <div className={`size-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? "bg-emerald-500 text-white" : "border-2 border-muted"}`}>
                {item.done && <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className={item.done ? "text-foreground line-through text-muted-foreground" : "text-foreground font-medium"}>{item.step}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "pf") {
    const pfData = mockSalaryStructures.map(s => ({
      ...s,
      employeeContribution: s.pf,
      employerContribution: Math.round(s.pf * 1.0),
      totalPF: s.pf * 2,
    }));
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Provident Fund (PF)</h1><p className="text-sm text-muted-foreground">Employee and employer PF contributions for June 2026.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80"><Download className="size-4" /> Export ECR</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
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
                {pfData.map((emp, i) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{emp.name}</td>
                    <td className="px-6 py-4 text-right">${emp.basic.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-blue-500">${emp.employeeContribution.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-indigo-500">${emp.employerContribution.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">${emp.totalPF.toLocaleString()}</td>
                  </motion.tr>
                ))}
                <tr className="bg-muted/30 font-semibold border-t border-border/50">
                  <td className="px-6 py-4">Total</td>
                  <td className="px-6 py-4 text-right"></td>
                  <td className="px-6 py-4 text-right text-blue-500">${pfData.reduce((s, e) => s + e.employeeContribution, 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-indigo-500">${pfData.reduce((s, e) => s + e.employerContribution, 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-foreground">${pfData.reduce((s, e) => s + e.totalPF, 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "esi") {
    const esiData = mockSalaryStructures.map(s => ({ ...s, employeeESI: s.esi, employerESI: Math.round(s.grossSalary * 0.0325) }));
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">ESI (Employee State Insurance)</h1><p className="text-sm text-muted-foreground">ESI contributions — Employee 0.75% · Employer 3.25%.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50"><Download className="size-4" /> ESI Return</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 text-right font-medium">Gross Salary</th>
                  <th className="px-6 py-4 text-right font-medium">Employee ESI (0.75%)</th>
                  <th className="px-6 py-4 text-right font-medium">Employer ESI (3.25%)</th>
                  <th className="px-6 py-4 text-right font-medium">Total ESI</th>
                </tr>
              </thead>
              <tbody>
                {esiData.map((emp, i) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{emp.name}</td>
                    <td className="px-6 py-4 text-right">${emp.grossSalary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-orange-500">${emp.employeeESI.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-amber-500">${emp.employerESI.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold">${(emp.employeeESI + emp.employerESI).toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
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
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50"><Download className="size-4" /> Form 24Q</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Department</th>
                  <th className="px-6 py-4 text-right font-medium">Annual Taxable Income</th>
                  <th className="px-6 py-4 text-right font-medium">Monthly TDS</th>
                  <th className="px-6 py-4 text-right font-medium">YTD TDS Deducted</th>
                </tr>
              </thead>
              <tbody>
                {mockSalaryStructures.map((emp, i) => (
                  <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{emp.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{emp.department}</td>
                    <td className="px-6 py-4 text-right">${(emp.grossSalary * 12).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-medium text-red-400">${emp.tds.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold">${(emp.tds * 6).toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
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
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><FileText className="size-4" /> Generate All</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Payslip ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Month</th>
                  <th className="px-6 py-4 text-right font-medium">Gross</th>
                  <th className="px-6 py-4 text-right font-medium">Deductions</th>
                  <th className="px-6 py-4 text-right font-medium">Net Pay</th>
                  <th className="px-6 py-4 font-medium">Pay Date</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                  <th className="px-6 py-4 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {mockPayslips.map((ps, i) => (
                  <motion.tr key={ps.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-primary">{ps.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{ps.employeeName}</td>
                    <td className="px-6 py-4 text-muted-foreground">{ps.month}</td>
                    <td className="px-6 py-4 text-right">${ps.grossSalary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-red-400">-${ps.deductions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">${ps.netSalary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-muted-foreground">{ps.payDate}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${payslipStatusStyle(ps.status)}`}>{ps.status}</span></td>
                    <td className="px-6 py-4 text-center"><button className="text-primary text-sm hover:underline">Download</button></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "loans") {
    const loans = [
      { id: "LOAN-001", employee: "Daniel Roberts", amount: 50000, disbursed: "2026-01-01", emi: 4500, tenure: "12 months", outstanding: 27000, status: "Active" },
      { id: "LOAN-002", employee: "Ravi Kumar", amount: 20000, disbursed: "2026-03-01", emi: 2100, tenure: "10 months", outstanding: 14700, status: "Active" },
      { id: "LOAN-003", employee: "Linda Torres", amount: 10000, disbursed: "2025-06-01", emi: 900, tenure: "12 months", outstanding: 0, status: "Closed" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Employee Loans</h1><p className="text-sm text-muted-foreground">Salary advances and company loans issued to employees.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Issue Loan</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Loan ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-right font-medium">Monthly EMI</th>
                  <th className="px-6 py-4 font-medium">Disbursed</th>
                  <th className="px-6 py-4 text-right font-medium">Outstanding</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan, i) => (
                  <motion.tr key={loan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary">{loan.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{loan.employee}</td>
                    <td className="px-6 py-4 text-right">${loan.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-amber-500">${loan.emi.toLocaleString()}</td>
                    <td className="px-6 py-4 text-muted-foreground">{loan.disbursed}</td>
                    <td className="px-6 py-4 text-right font-bold">{loan.outstanding > 0 ? `$${loan.outstanding.toLocaleString()}` : "Nil"}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${loan.status === "Active" ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"}`}>{loan.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "advances") {
    const advances = [
      { id: "ADV-001", employee: "James Thompson", amount: 5000, requestDate: "2026-06-25", reason: "Medical emergency", recovery: "2 installments", status: "Approved" },
      { id: "ADV-002", employee: "Kevin Park", amount: 3000, requestDate: "2026-07-01", reason: "Relocation expenses", recovery: "1 installment", status: "Pending" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Salary Advances</h1><p className="text-sm text-muted-foreground">Short-term advance requests against monthly salary.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> New Advance</button>
        </div>
        <div className="space-y-4">
          {advances.map((adv, i) => (
            <motion.div key={adv.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1"><span className="font-mono text-sm text-primary">{adv.id}</span></div>
                  <p className="font-semibold text-foreground text-lg">{adv.employee}</p>
                  <p className="text-sm text-muted-foreground">Reason: {adv.reason}</p>
                  <p className="text-sm text-muted-foreground">Recovery: {adv.recovery} · Requested: {adv.requestDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">${adv.amount.toLocaleString()}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${adv.status === "Approved" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{adv.status}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "bonuses") {
    const bonuses = [
      { id: "BON-001", employee: "James Thompson", department: "Sales", type: "Performance Bonus", amount: 12000, period: "H1 2026", status: "Paid" },
      { id: "BON-002", employee: "Sarah Mitchell", department: "Marketing", type: "Performance Bonus", amount: 15000, period: "H1 2026", status: "Paid" },
      { id: "BON-003", employee: "Kevin Park", department: "Engineering", type: "Retention Bonus", amount: 20000, period: "FY 2026", status: "Processing" },
      { id: "BON-004", employee: "Daniel Roberts", department: "Operations", type: "Spot Award", amount: 3000, period: "June 2026", status: "Paid" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Bonuses</h1><p className="text-sm text-muted-foreground">Performance bonuses, retention awards, and spot recognitions.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Award Bonus</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th><th className="px-6 py-4 font-medium">Employee</th><th className="px-6 py-4 font-medium">Type</th><th className="px-6 py-4 font-medium">Period</th><th className="px-6 py-4 text-right font-medium">Amount</th><th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bonuses.map((b, i) => (
                  <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-primary font-medium">{b.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{b.employee}<p className="text-xs text-muted-foreground">{b.department}</p></td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded text-xs">{b.type}</span></td>
                    <td className="px-6 py-4 text-muted-foreground">{b.period}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">${b.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${b.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{b.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "commissions") {
    const commissions = [
      { id: "COM-001", employee: "James Thompson", role: "Sales Manager", revenue: 820000, rate: 3.5, earned: 28700, period: "June 2026", status: "Paid" },
      { id: "COM-002", employee: "Emily Wang", role: "Account Executive", revenue: 310000, rate: 2.5, earned: 7750, period: "June 2026", status: "Paid" },
      { id: "COM-003", employee: "Linda Torres", role: "Sales Rep", revenue: 95000, rate: 2.0, earned: 1900, period: "June 2026", status: "Pending" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Sales Commissions</h1><p className="text-sm text-muted-foreground">Commission calculations based on revenue generated.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><DollarSign className="size-4" /> Run Commission</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th><th className="px-6 py-4 font-medium">Employee</th><th className="px-6 py-4 text-right font-medium">Revenue</th><th className="px-6 py-4 text-center font-medium">Rate</th><th className="px-6 py-4 text-right font-medium">Commission</th><th className="px-6 py-4 font-medium">Period</th><th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-primary font-medium">{c.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{c.employee}<p className="text-xs text-muted-foreground">{c.role}</p></td>
                    <td className="px-6 py-4 text-right">${c.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">{c.rate}%</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">${c.earned.toLocaleString()}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.period}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{c.status}</span></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: salary_structure
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Salary Structure</h1><p className="text-sm text-muted-foreground">Compensation breakdown — gross earnings, deductions, and net pay.</p></div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm border border-border/50 hover:bg-muted/80 transition-colors"><Download className="size-4" /> Export</button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Structure</button>
        </div>
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
            <tr>
              <th className="px-5 py-4 font-medium">Employee</th>
              <th className="px-5 py-4 text-right font-medium">Basic</th>
              <th className="px-5 py-4 text-right font-medium">HRA</th>
              <th className="px-5 py-4 text-right font-medium">Transport</th>
              <th className="px-5 py-4 text-right font-medium">Medical</th>
              <th className="px-5 py-4 text-right font-medium">Bonus</th>
              <th className="px-5 py-4 text-right font-medium">Gross</th>
              <th className="px-5 py-4 text-right font-medium text-red-400">Deductions</th>
              <th className="px-5 py-4 text-right font-medium text-emerald-500">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {mockSalaryStructures.map((emp, i) => (
              <motion.tr key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-4 font-medium text-foreground">{emp.name}<p className="text-xs text-muted-foreground">{emp.department}</p></td>
                <td className="px-5 py-4 text-right">${emp.basic.toLocaleString()}</td>
                <td className="px-5 py-4 text-right">${emp.hra.toLocaleString()}</td>
                <td className="px-5 py-4 text-right">${emp.transport.toLocaleString()}</td>
                <td className="px-5 py-4 text-right">${emp.medical.toLocaleString()}</td>
                <td className="px-5 py-4 text-right">${emp.bonus.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-semibold">${emp.grossSalary.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-red-400">-${(emp.pf + emp.esi + emp.tds).toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-bold text-emerald-500">${emp.netSalary.toLocaleString()}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
