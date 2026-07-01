import React from "react";
import { motion } from "framer-motion";
import { Plus, FileText, Shield, Calculator, Award } from "lucide-react";

interface Props { tab?: string; }

const resignations = [
  { id: "RES-001", employee: "Aisha Patel", department: "Engineering", designation: "UX Designer", resignDate: "2026-07-01", lastWorkingDay: "2026-07-15", reason: "Personal relocation", status: "Accepted" },
  { id: "RES-002", employee: "Linda Torres", department: "Sales", designation: "Sales Representative", resignDate: "2026-06-15", lastWorkingDay: "2026-06-30", reason: "Higher opportunity", status: "Completed" },
];

export function ExitManagement({ tab = "resignation" }: Props) {

  if (tab === "clearance") {
    const clearanceTasks = [
      { dept: "IT", task: "Laptop & Access Card returned", status: "Pending", assignedTo: "IT Team" },
      { dept: "Finance", task: "Expense settlements cleared", status: "Done", assignedTo: "Finance" },
      { dept: "HR", task: "Exit interview completed", status: "Done", assignedTo: "Priya Sharma" },
      { dept: "Admin", task: "Office ID deactivated", status: "Pending", assignedTo: "Admin" },
      { dept: "Manager", task: "KT (Knowledge Transfer) signed off", status: "In Progress", assignedTo: "Alex Rivera" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Clearance</h1><p className="text-sm text-muted-foreground">Exit clearance checklist for departing employees.</p></div>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <div className="flex justify-between items-center mb-4">
            <div><h3 className="font-semibold text-foreground">Aisha Patel — UX Designer</h3><p className="text-sm text-muted-foreground">Last working day: July 15, 2026</p></div>
            <div className="text-right"><p className="text-3xl font-bold text-primary">40%</p><p className="text-xs text-muted-foreground">Cleared</p></div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
            <div className="h-full bg-primary rounded-full" style={{ width: "40%" }} />
          </div>
          <div className="space-y-3">
            {clearanceTasks.map((t, i) => (
              <div key={t.task} className="flex items-center gap-3 text-sm">
                <div className={`size-5 rounded-full flex items-center justify-center flex-shrink-0 ${t.status === "Done" ? "bg-emerald-500" : t.status === "In Progress" ? "bg-amber-500" : "border-2 border-muted"}`}>
                  {t.status === "Done" && <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`flex-1 ${t.status === "Done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.task}</span>
                <span className="text-xs text-muted-foreground">{t.dept} · {t.assignedTo}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${t.status === "Done" ? "bg-emerald-500/10 text-emerald-500" : t.status === "In Progress" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "final_settlement") {
    const settlement = {
      employee: "Linda Torres", lastWorkingDay: "2026-06-30",
      components: [
        { item: "Salary for June (30 days)", amount: 3500 },
        { item: "Leave Encashment (3 days unused)", amount: 485 },
        { item: "Gratuity", amount: 2800 },
        { item: "Bonus (pro-rated)", amount: 1500 },
        { item: "PF Settlement", amount: 8400 },
        { item: "TDS Deduction (Final)", amount: -1200 },
        { item: "Notice Period Recovery (waived)", amount: 0 },
      ]
    };
    const total = settlement.components.reduce((s, c) => s + c.amount, 0);
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Final Settlement</h1><p className="text-sm text-muted-foreground">Full & final settlement calculation for departing employees.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Calculator className="size-4" /> Generate F&F</button>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <div className="flex justify-between items-center mb-6">
            <div><h3 className="font-semibold text-foreground text-lg">{settlement.employee}</h3><p className="text-sm text-muted-foreground">Last Working Day: {settlement.lastWorkingDay}</p></div>
          </div>
          <div className="divide-y divide-border/40">
            {settlement.components.map((comp, i) => (
              <div key={comp.item} className="flex justify-between py-3 text-sm">
                <span className="text-muted-foreground">{comp.item}</span>
                <span className={`font-medium ${comp.amount < 0 ? "text-red-400" : "text-foreground"}`}>
                  {comp.amount !== 0 ? (comp.amount < 0 ? `-$${Math.abs(comp.amount).toLocaleString()}` : `$${comp.amount.toLocaleString()}`) : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4 mt-2 border-t-2 border-primary/30">
            <span className="font-bold text-foreground text-lg">Total Settlement</span>
            <span className="text-2xl font-bold text-primary">${total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "experience_letter") {
    const letters = [
      { employee: "Linda Torres", designation: "Sales Representative", from: "2023-09-01", to: "2026-06-30", issuedOn: "2026-07-01", status: "Issued" },
      { employee: "Aisha Patel", designation: "UX Designer", from: "2024-01-15", to: "2026-07-15", issuedOn: "—", status: "Pending" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Experience Letters</h1><p className="text-sm text-muted-foreground">Issue and track experience and relieving letters.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Award className="size-4" /> Issue Letter</button>
        </div>
        <div className="space-y-4">
          {letters.map((l, i) => (
            <motion.div key={l.employee} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50 flex justify-between items-center">
              <div>
                <p className="font-semibold text-foreground text-lg">{l.employee}</p>
                <p className="text-sm text-muted-foreground">{l.designation}</p>
                <p className="text-sm text-muted-foreground">Tenure: {l.from} to {l.to}</p>
                {l.issuedOn !== "—" && <p className="text-xs text-muted-foreground">Issued: {l.issuedOn}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${l.status === "Issued" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{l.status}</span>
                {l.status === "Issued" && <button className="text-primary text-sm hover:underline">Download PDF</button>}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Default: resignation
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Resignations</h1><p className="text-sm text-muted-foreground">Employee resignation requests and exit management.</p></div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Record Resignation</button>
      </div>
      <div className="space-y-4">
        {resignations.map((res, i) => (
          <motion.div key={res.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-xl border border-border/50">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm text-primary">{res.id}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${res.status === "Completed" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>{res.status}</span>
                </div>
                <p className="font-semibold text-foreground text-lg">{res.employee}</p>
                <p className="text-sm text-muted-foreground">{res.designation} · {res.department}</p>
                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Resignation Date</p><p className="font-medium">{res.resignDate}</p></div>
                  <div><p className="text-muted-foreground text-xs">Last Working Day</p><p className="font-medium">{res.lastWorkingDay}</p></div>
                  <div><p className="text-muted-foreground text-xs">Reason</p><p className="font-medium">{res.reason}</p></div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button className="px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs">View Details</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
