import React from "react";
import { motion } from "framer-motion";
import { FileText, CreditCard, Clock, Calendar, Bell, CheckSquare } from "lucide-react";
import { useHrmsData } from "@/hooks/useHrmsData";

interface Props { tab?: string; }

// ESS is scoped to a single logged-in employee — using EMP-001 as demo
const currentEmp = { id: "EMP-001", name: "James Thompson", department: "Sales", designation: "Senior Sales Manager" };

export function EmployeeSelfService({ tab = "ess_attendance" }: Props) {
  const { mockAttendance, mockLeaveBalances, mockPayslips } = useHrmsData();

  if (tab === "ess_leaves") {
    const myLeaveBalance = mockLeaveBalances[0];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">My Leaves</h1><p className="text-sm text-muted-foreground">Your leave balance and recent applications, {currentEmp.name}.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Calendar className="size-4" /> Apply Leave</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { type: "Annual", ...myLeaveBalance.annual, color: "bg-blue-500" },
            { type: "Sick", ...myLeaveBalance.sick, color: "bg-red-400" },
            { type: "Casual", ...myLeaveBalance.casual, color: "bg-purple-500" },
          ].map((l, i) => (
            <motion.div key={l.type} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <h3 className="font-semibold text-foreground mb-4">{l.type} Leave</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                <div><p className="text-muted-foreground text-xs">Total</p><p className="font-bold text-lg">{l.total}</p></div>
                <div><p className="text-muted-foreground text-xs">Used</p><p className="font-bold text-lg text-amber-500">{l.used}</p></div>
                <div><p className="text-muted-foreground text-xs">Balance</p><p className="font-bold text-lg text-emerald-500">{l.balance}</p></div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${l.color}`} style={{ width: `${(l.used / l.total) * 100}%` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "ess_payroll") {
    const myPayslips = mockPayslips.filter(p => p.employeeId === currentEmp.id);
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">My Payroll</h1><p className="text-sm text-muted-foreground">Your salary and payslip history, {currentEmp.name}.</p></div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Latest Payslip — June 2026</h3>
          {myPayslips[0] && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Gross Salary", value: `$${myPayslips[0].grossSalary.toLocaleString()}`, color: "text-foreground" },
                { label: "Total Deductions", value: `-$${myPayslips[0].deductions.toLocaleString()}`, color: "text-red-400" },
                { label: "Net Pay", value: `$${myPayslips[0].netSalary.toLocaleString()}`, color: "text-emerald-500" },
              ].map(s => (
                <div key={s.label} className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr><th className="px-6 py-4 font-medium">Month</th><th className="px-6 py-4 text-right font-medium">Gross</th><th className="px-6 py-4 text-right font-medium">Net Pay</th><th className="px-6 py-4 font-medium">Pay Date</th><th className="px-6 py-4 text-center font-medium">Status</th><th className="px-6 py-4 text-center font-medium">Action</th></tr>
              </thead>
              <tbody>
                {myPayslips.map((ps, i) => (
                  <motion.tr key={ps.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{ps.month}</td>
                    <td className="px-6 py-4 text-right">${ps.grossSalary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">${ps.netSalary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-muted-foreground">{ps.payDate}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${ps.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{ps.status}</span></td>
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

  if (tab === "ess_documents") {
    const myDocs = [
      { name: "Employment Contract", date: "2021-03-15", type: "PDF", size: "248 KB" },
      { name: "NDA Agreement", date: "2021-03-15", type: "PDF", size: "142 KB" },
      { name: "Payslip – June 2026", date: "2026-06-30", type: "PDF", size: "68 KB" },
      { name: "Payslip – May 2026", date: "2026-05-31", type: "PDF", size: "68 KB" },
      { name: "Form 16 – FY2025", date: "2025-06-15", type: "PDF", size: "320 KB" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">My Documents</h1><p className="text-sm text-muted-foreground">Personal documents and HR letters.</p></div>
        <div className="space-y-3">
          {myDocs.map((doc, i) => (
            <motion.div key={doc.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-4 rounded-xl border border-border/50 flex justify-between items-center hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg"><FileText className="size-5 text-red-500" /></div>
                <div><p className="font-medium text-foreground">{doc.name}</p><p className="text-xs text-muted-foreground">{doc.type} · {doc.size} · {doc.date}</p></div>
              </div>
              <button className="text-primary text-sm hover:underline">Download</button>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "ess_tasks") {
    const tasks = [
      { task: "Complete H1 2026 Self-Assessment", due: "2026-07-10", priority: "High", status: "Pending" },
      { task: "Submit Q3 Goals to Manager", due: "2026-07-07", priority: "High", status: "Pending" },
      { task: "Complete GDPR Compliance Training", due: "2026-07-15", priority: "Medium", status: "In Progress" },
      { task: "Update Emergency Contact Info", due: "2026-07-01", priority: "Low", status: "Done" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">My Tasks</h1><p className="text-sm text-muted-foreground">HR-assigned tasks and pending actions.</p></div>
        <div className="space-y-3">
          {tasks.map((t, i) => (
            <motion.div key={t.task} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`glass-panel p-5 rounded-xl border ${t.status === "Done" ? "border-border/30 opacity-60" : "border-border/50"}`}>
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className={`size-5 rounded flex items-center justify-center mt-0.5 flex-shrink-0 ${t.status === "Done" ? "bg-emerald-500" : "border-2 border-muted"}`}>
                    {t.status === "Done" && <CheckSquare className="size-3 text-white" />}
                  </div>
                  <div>
                    <p className={`font-medium ${t.status === "Done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.task}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Due: {t.due}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-3 ${t.priority === "High" ? "bg-red-500/10 text-red-500" : t.priority === "Medium" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>{t.priority}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "ess_announcements") {
    const announcements = [
      { id: 1, title: "Q3 2026 Company All-Hands Meeting", date: "2026-07-01", category: "Event", body: "Join us on July 15 for our quarterly all-hands. CEO will present Q2 results and H2 roadmap. All employees are expected to attend." },
      { id: 2, title: "Updated Leave Policy Effective Aug 1", date: "2026-07-01", category: "Policy", body: "We are updating our leave encashment policy. Please review the updated HR handbook. Key change: Annual leave encashment limit increased to 10 days per year." },
      { id: 3, title: "New Wellness Benefit: Gym Reimbursement", date: "2026-06-28", category: "Benefits", body: "Starting August, all full-time employees can claim up to $50/month for gym memberships. Submit receipts via the ESS portal." },
    ];
    return (
      <div className="p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-foreground">Announcements</h1><p className="text-sm text-muted-foreground">Company-wide updates and HR communications.</p></div>
        <div className="space-y-4">
          {announcements.map((ann, i) => (
            <motion.div key={ann.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0 mt-0.5"><Bell className="size-4 text-primary" /></div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{ann.title}</h3>
                    <span className="px-2 py-0.5 bg-secondary/50 rounded text-xs">{ann.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{ann.date}</p>
                  <p className="text-sm text-muted-foreground">{ann.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Default: ess_attendance (my attendance)
  const myAttendance = mockAttendance.filter(a => a.employeeId === currentEmp.id);
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">My Attendance</h1><p className="text-sm text-muted-foreground">Your personal attendance log for today and recent days.</p></div>
      <div className="glass-panel p-6 rounded-xl border border-border/50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-foreground">Today — July 1, 2026</h3>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-sm font-medium">Present</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-muted/30 rounded-lg text-center"><p className="text-xs text-muted-foreground mb-1">Check In</p><p className="font-mono text-xl font-bold text-foreground">09:02</p></div>
          <div className="p-4 bg-muted/30 rounded-lg text-center"><p className="text-xs text-muted-foreground mb-1">Check Out</p><p className="font-mono text-xl font-bold text-foreground">18:15</p></div>
          <div className="p-4 bg-primary/10 rounded-lg text-center"><p className="text-xs text-muted-foreground mb-1">Hours Worked</p><p className="font-mono text-xl font-bold text-primary">9.2h</p></div>
        </div>
      </div>
      <div className="glass-panel p-6 rounded-xl border border-border/50">
        <h3 className="font-semibold text-foreground mb-4">Monthly Summary — June 2026</h3>
        <div className="grid grid-cols-4 gap-3 text-center text-sm">
          {[{ label: "Working Days", value: 22 }, { label: "Present", value: 20 }, { label: "Leaves", value: 1 }, { label: "Late", value: 1 }].map(s => (
            <div key={s.label} className="p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
