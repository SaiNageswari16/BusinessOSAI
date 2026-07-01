import React from "react";
import { motion } from "framer-motion";
import { Plus, Download, CheckCircle, Clock, XCircle, Plane, Building, Activity } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

const statusStyle = (s: string) => {
  switch (s) {
    case "Approved": return "bg-emerald-500/10 text-emerald-500";
    case "Pending": return "bg-amber-500/10 text-amber-500";
    case "Rejected": return "bg-red-500/10 text-red-500";
    default: return "bg-muted text-muted-foreground";
  }
};
const StatusIcon = ({ s }: { s: string }) => {
  if (s === "Approved") return <CheckCircle className="size-3" />;
  if (s === "Rejected") return <XCircle className="size-3" />;
  return <Clock className="size-3" />;
};

export function ExpenseClaims({ tab = "claims" }: Props) {
  const { mockExpenseClaims } = useAccountingData();

  if (tab === "approvals") {
    const pending = mockExpenseClaims.filter(e => e.status === "Pending");
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Expense Approvals</h1><p className="text-sm text-muted-foreground">Pending expense claims awaiting your approval.</p></div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-sm font-medium">
            <Clock className="size-4" /> {pending.length} pending
          </div>
        </div>
        {pending.length === 0 ? (
          <div className="glass-panel p-12 rounded-xl border border-border/50 flex flex-col items-center justify-center text-center">
            <CheckCircle className="size-12 text-emerald-500 mb-4" />
            <h3 className="font-semibold text-foreground">All caught up!</h3>
            <p className="text-sm text-muted-foreground">No pending expense approvals.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((claim, i) => (
              <motion.div key={claim.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="glass-panel p-6 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm font-semibold text-foreground">{claim.id}</span>
                      <span className="px-2 py-0.5 bg-secondary/60 rounded text-xs text-muted-foreground">{claim.category}</span>
                    </div>
                    <p className="font-semibold text-foreground">{claim.employee} <span className="text-muted-foreground font-normal text-sm">· {claim.department}</span></p>
                    <p className="text-sm text-muted-foreground mt-1">{claim.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Submitted: {claim.date}</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground">${claim.amount.toLocaleString()}</p>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                  <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">Approve</button>
                  <button className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors">Reject</button>
                  <button className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm hover:bg-muted/80">Request Info</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (tab === "travel") {
    const travelClaims = mockExpenseClaims.filter(e => e.category === "Travel");
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Travel Expenses</h1><p className="text-sm text-muted-foreground">All business travel reimbursements and advance requests.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plane className="size-4" /> New Travel Claim</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Travel YTD", value: "$3,340", color: "text-blue-500" },
            { label: "Approved", value: "$1,240", color: "text-emerald-500" },
            { label: "Pending", value: "$2,100", color: "text-amber-500" },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {travelClaims.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{c.id}</td>
                    <td className="px-6 py-4"><p className="font-medium">{c.employee}</p><p className="text-xs text-muted-foreground">{c.department}</p></td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">{c.description}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.date}</td>
                    <td className="px-6 py-4 text-right font-semibold">${c.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle(c.status)}`}>
                        <StatusIcon s={c.status} /> {c.status}
                      </span>
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

  if (tab === "office_expenses") {
    const officeClaims = mockExpenseClaims.filter(e => ["Office Supplies", "Software", "Entertainment"].includes(e.category));
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Office Expenses</h1><p className="text-sm text-muted-foreground">Office supplies, software subscriptions, and entertainment.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Building className="size-4" /> New Claim</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {officeClaims.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{c.id}</td>
                    <td className="px-6 py-4 font-medium">{c.employee}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded-md text-xs">{c.category}</span></td>
                    <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate">{c.description}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.date}</td>
                    <td className="px-6 py-4 text-right font-semibold">${c.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle(c.status)}`}>
                        <StatusIcon s={c.status} /> {c.status}
                      </span>
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

  if (tab === "operational_expenses") {
    const opex = [
      { id: "OPEX-001", category: "Rent", description: "Q3 2026 Head Office Lease", amount: 48000, period: "Jul–Sep 2026", approvedBy: "CFO", status: "Approved" },
      { id: "OPEX-002", category: "Utilities", description: "Electricity, water & internet", amount: 12000, period: "June 2026", approvedBy: "Finance", status: "Approved" },
      { id: "OPEX-003", category: "Insurance", description: "Annual business insurance renewal", amount: 24000, period: "FY2026", approvedBy: "CFO", status: "Approved" },
      { id: "OPEX-004", category: "Maintenance", description: "Office HVAC servicing", amount: 3200, period: "July 2026", approvedBy: "Facilities", status: "Pending" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Operational Expenses</h1><p className="text-sm text-muted-foreground">Rent, utilities, insurance, and recurring business costs.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Activity className="size-4" /> Add OpEx</button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Period</th>
                  <th className="px-6 py-4 font-medium">Approved By</th>
                  <th className="px-6 py-4 text-right font-medium">Amount</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {opex.map((e, i) => (
                  <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{e.id}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded-md text-xs">{e.category}</span></td>
                    <td className="px-6 py-4 text-muted-foreground">{e.description}</td>
                    <td className="px-6 py-4 text-muted-foreground">{e.period}</td>
                    <td className="px-6 py-4 text-muted-foreground">{e.approvedBy}</td>
                    <td className="px-6 py-4 text-right font-semibold">${e.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle(e.status)}`}>
                        <StatusIcon s={e.status} /> {e.status}
                      </span>
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

  // Default: expense_claims
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Expense Claims</h1><p className="text-sm text-muted-foreground">Review and approve employee expense submissions.</p></div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50 hover:bg-muted/80"><Download className="size-4" /> Export</button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> New Claim</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending Approval", value: mockExpenseClaims.filter(e => e.status === "Pending").length, color: "text-amber-500" },
          { label: "Approved This Month", value: mockExpenseClaims.filter(e => e.status === "Approved").length, color: "text-emerald-500" },
          { label: "Rejected", value: mockExpenseClaims.filter(e => e.status === "Rejected").length, color: "text-red-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-5 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">ID</th>
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Department</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 text-right font-medium">Amount</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockExpenseClaims.map((claim, i) => (
                <motion.tr key={claim.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{claim.id}</td>
                  <td className="px-6 py-4 font-medium">{claim.employee}</td>
                  <td className="px-6 py-4 text-muted-foreground">{claim.department}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded-md text-xs">{claim.category}</span></td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[180px] truncate">{claim.description}</td>
                  <td className="px-6 py-4 text-muted-foreground">{claim.date}</td>
                  <td className="px-6 py-4 text-right font-semibold">${claim.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle(claim.status)}`}>
                      <StatusIcon s={claim.status} /> {claim.status}
                    </span>
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
