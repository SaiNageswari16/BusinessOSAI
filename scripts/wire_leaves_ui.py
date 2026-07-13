import os

target = os.path.join("frontend", "src", "components", "hrms", "LeaveManagement.tsx")

leaves_ui_code = """import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Calendar, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { leavesApi, LeaveRequest, LeaveBalance } from "../../lib/api-client";

interface Props { tab?: string; }

const leaveStatusStyle = (s: string) => {
  if (s === "Approved") return "bg-emerald-500/10 text-emerald-500";
  if (s === "Pending") return "bg-amber-500/10 text-amber-500";
  return "bg-red-500/10 text-red-500";
};

const leaveTypeColor = (t: string) => {
  const map: Record<string, string> = { Annual: "bg-blue-500/10 text-blue-500", Sick: "bg-red-500/10 text-red-400", Casual: "bg-purple-500/10 text-purple-500", Maternity: "bg-pink-500/10 text-pink-500", Unpaid: "bg-muted text-muted-foreground" };
  return map[t] || "bg-muted text-muted-foreground";
};

export function LeaveManagement({ tab = "leave_requests" }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLeavesData = useCallback(async () => {
    setLoading(true);
    try {
      const reqsRes = await leavesApi.list(1, 100);
      setRequests(reqsRes.items || []);
      const balsRes = await leavesApi.listBalances();
      setBalances(balsRes || []);
    } catch (e) {
      console.error("Failed to load leaves data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeavesData();
  }, [loadLeavesData]);

  const handleReview = async (id: string, approve: boolean) => {
    try {
      if (approve) {
        await leavesApi.approve(id);
      } else {
        await leavesApi.reject(id);
      }
      loadLeavesData();
    } catch (e: any) {
      alert("Failed to review: " + e.message);
    }
  };

  if (tab === "leave_calendar") {
    const calendarEvents = requests.filter(l => l.status === "Approved").map(l => ({ ...l, color: l.leave_type === "Maternity" ? "bg-pink-500/20 border-pink-500/40 text-pink-600" : "bg-blue-500/20 border-blue-500/40 text-blue-600" }));
    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dates = Array.from({ length: 31 }, (_, i) => i + 1);
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Leave Calendar</h1><p className="text-sm text-muted-foreground">Team leave overview for July 2026.</p></div>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Approved Leaves — July 2026</h3>
          {loading && <div className="flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}
          <div className="space-y-3">
            {!loading && calendarEvents.length === 0 && <p className="text-sm text-muted-foreground italic">No approved leaves scheduled this month.</p>}
            {!loading && calendarEvents.map((event, i) => (
              <motion.div key={event.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-lg border ${event.color} flex justify-between items-center`}>
                <div>
                  <p className="font-semibold">{event.employee_name}</p>
                  <p className="text-sm">{event.leave_type} Leave · {event.from_date} to {event.to_date}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl">{event.days_requested}</p>
                  <p className="text-xs">days</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <h3 className="font-semibold text-foreground mb-4">Department Leave Heat Map — July</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
            {weekDays.map(d => <div key={d} className="py-1 font-medium">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dates.map(d => {
              const hasLeave = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(d);
              return (
                <div key={d} className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-all ${hasLeave ? "bg-blue-500/20 text-blue-600 border border-blue-500/30" : "bg-muted/30 text-muted-foreground"}`}>
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (tab === "leave_balance") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Leave Balance</h1><p className="text-sm text-muted-foreground">Remaining leave entitlements per employee for FY 2026.</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
            {!loading && (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">Employee</th>
                    <th className="px-6 py-4 font-medium text-center">Leave Type</th>
                    <th className="px-6 py-4 text-center font-medium">Total Entitled</th>
                    <th className="px-6 py-4 text-center font-medium">Used Days</th>
                    <th className="px-6 py-4 text-center font-medium text-emerald-600">Balance Left</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No leave balances set yet.</td></tr>
                  ) : balances.map((bal, i) => (
                    <motion.tr key={bal.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{bal.employee_name}</td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${leaveTypeColor(bal.leave_type)}`}>{bal.leave_type}</span></td>
                      <td className="px-6 py-4 text-center text-muted-foreground">{bal.total_days} days</td>
                      <td className="px-6 py-4 text-center text-amber-500">{bal.used_days} days</td>
                      <td className="px-6 py-4 text-center font-bold text-emerald-500">{bal.balance} days</td>
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

  if (tab === "approvals") {
    const pending = requests.filter(l => l.status === "Pending");
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Leave Approvals</h1><p className="text-sm text-muted-foreground">Pending leave requests awaiting your approval.</p></div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-sm font-medium">
            <Clock className="size-4" /> {pending.length} pending
          </div>
        </div>
        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
        {!loading && pending.length === 0 ? (
          <div className="glass-panel p-8 text-center text-muted-foreground rounded-xl border">No pending leave requests found.</div>
        ) : pending.map((req, i) => (
          <motion.div key={req.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-xs text-muted-foreground">ID: {req.id.substring(0, 8)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${leaveTypeColor(req.leave_type)}`}>{req.leave_type}</span>
                </div>
                <p className="font-semibold text-foreground text-lg">{req.employee_name} <span className="font-normal text-muted-foreground text-sm">· {req.department}</span></p>
                <p className="text-sm text-muted-foreground mt-1">{req.from_date} → {req.to_date} ({req.days_requested} day{req.days_requested > 1 ? "s" : ""})</p>
                <p className="text-sm text-muted-foreground">Reason: {req.reason || "N/A"}</p>
                <p className="text-xs text-muted-foreground mt-1">Applied: {new Date(req.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
              <button onClick={() => handleReview(req.id, true)} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2"><CheckCircle className="size-4" /> Approve</button>
              <button onClick={() => handleReview(req.id, false)} className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center gap-2"><XCircle className="size-4" /> Reject</button>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // Default: leave_requests
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Leave Requests</h1><p className="text-sm text-muted-foreground">All employee leave applications and their current status.</p></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending", value: requests.filter(l => l.status === "Pending").length, color: "text-amber-500" },
          { label: "Approved", value: requests.filter(l => l.status === "Approved").length, color: "text-emerald-500" },
          { label: "Rejected", value: requests.filter(l => l.status === "Rejected").length, color: "text-red-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-5 rounded-xl border border-border/50 text-center">
            <p className={`text-4xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          {loading && <div className="flex justify-center py-8"><Loader2 className="size-8 animate-spin text-primary" /></div>}
          {!loading && (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">From</th>
                  <th className="px-6 py-4 font-medium">To</th>
                  <th className="px-6 py-4 text-center font-medium">Days</th>
                  <th className="px-6 py-4 font-medium">Applied On</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No leave requests found.</td></tr>
                ) : requests.map((req, i) => (
                  <motion.tr key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary">{req.id.substring(0, 8)}</td>
                    <td className="px-6 py-4"><p className="font-medium text-foreground">{req.employee_name}</p><p className="text-xs text-muted-foreground">{req.department}</p></td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-xs font-medium ${leaveTypeColor(req.leave_type)}`}>{req.leave_type}</span></td>
                    <td className="px-6 py-4 text-muted-foreground">{req.from_date}</td>
                    <td className="px-6 py-4 text-muted-foreground">{req.to_date}</td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">{req.days_requested}</td>
                    <td className="px-6 py-4 text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${leaveStatusStyle(req.status)}`}>{req.status}</span></td>
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
"""

with open(target, "w", encoding="utf-8", newline="\n") as f:
    f.write(leaves_ui_code)

print("Successfully wired LeaveManagement.tsx with live API endpoints")
