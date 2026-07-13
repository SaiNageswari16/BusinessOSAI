import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FileText, CreditCard, Clock, Calendar, Bell, CheckSquare, Loader2, MapPin, Fingerprint, Camera, User } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { employeesApi, attendanceApi, leavesApi, payrollApi, Employee, AttendanceRecord, EmployeeDocument, LeaveRequest, LeaveBalance, Payslip } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
const formatDate = (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString(undefined, options);
};

const formatTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};


interface Props { tab?: string; }

const attStatusStyle = (s: string) => {
  switch (s?.toLowerCase()) {
    case "present": return "bg-emerald-500/10 text-emerald-500";
    case "late": return "bg-amber-500/10 text-amber-500";
    case "absent": return "bg-red-500/10 text-red-500";
    case "half day": return "bg-blue-500/10 text-blue-500";
    case "on leave": return "bg-purple-500/10 text-purple-500";
    default: return "bg-muted text-muted-foreground";
  }
};

export function EmployeeSelfService({ tab = "ess_attendance" }: Props) {
  const { user } = useAuth();
  
  const [emp, setEmp] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  
  // My Leaves & Payroll states
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [myBalances, setMyBalances] = useState<LeaveBalance[]>([]);
  const [myPayslips, setMyPayslips] = useState<Payslip[]>([]);

  // Apply Leave form states
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("Annual");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [daysRequested, setDaysRequested] = useState("1");
  const [reason, setReason] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMe = useCallback(async () => {
    setLoading(true); setError("");
    try {
      // 1. Get my employee profile
      const myEmp = await employeesApi.getMe();
      setEmp(myEmp);
      
      // 2. Fetch my attendance history
      const attRes = await attendanceApi.list(1, 30, myEmp.id);
      setAttendance(attRes.items);

      // 3. Fetch my documents
      const docsRes = await employeesApi.listDocuments(myEmp.id);
      setDocuments(docsRes);

      // 4. Fetch my leaves
      const leavesRes = await leavesApi.list(1, 50, myEmp.id);
      setMyLeaves(leavesRes.items || []);

      // 5. Fetch my leave balances
      const balancesRes = await leavesApi.listBalances(myEmp.id);
      setMyBalances(balancesRes || []);

      // 6. Fetch my payslips
      const slipsRes = await payrollApi.listPayslips(myEmp.id);
      setMyPayslips(slipsRes || []);
    } catch (err: any) {
      setError(err.message || "Failed to load self service data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Geolocation clock in
  const handleClockIn = async () => {
    if (!emp) return;
    setLoading(true);
    try {
      let lat = 37.7749, lng = -122.4194;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await attendanceApi.checkIn({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, notes: "WFH Check-In via Geolocation", method: "GPS" });
            loadMe();
          },
          async () => {
            await attendanceApi.checkIn({ latitude: lat, longitude: lng, notes: "WFH Check-In via Web Punch", method: "Manual" });
            loadMe();
          }
        );
      } else {
        await attendanceApi.checkIn({ latitude: lat, longitude: lng, notes: "WFH Check-In via Web Punch", method: "Manual" });
        loadMe();
      }
    } catch (e: any) {
      alert("Clock-in failed: " + e.message);
      setLoading(false);
    }
  };

  // Clock out
  const handleClockOut = async () => {
    if (!emp) return;
    setLoading(true);
    try {
      let lat = 37.7749, lng = -122.4194;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await attendanceApi.checkOut({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, notes: "WFH Check-Out via Geolocation" });
            loadMe();
          },
          async () => {
            await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: "WFH Check-Out via Web Punch" });
            loadMe();
          }
        );
      } else {
        await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: "WFH Check-Out via Web Punch" });
        loadMe();
      }
    } catch (e: any) {
      alert("Clock-out failed: " + e.message);
      setLoading(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return;
    try {
      await leavesApi.create({
        leave_type: leaveType,
        from_date: fromDate,
        to_date: toDate,
        days_requested: parseInt(daysRequested) || 1,
        reason: reason || ""
      });
      setLeaveDialogOpen(false);
      setReason("");
      loadMe();
    } catch (err: any) {
      alert("Failed to submit leave: " + err.message);
    }
  };

  // Find today's check-in status
  const todayStr = new Date().toISOString().split("T")[0];
  const todayRecord = attendance.find(r => r.date === todayStr);

  // ─── Render: My Leaves Tab ──────────────────────────────────────
  if (tab === "ess_leaves") {
    const leaveColor = (t: string) => {
      if (t === "Annual") return "bg-indigo-500";
      if (t === "Sick") return "bg-rose-500";
      return "bg-amber-500";
    };
    const leaveStatusColor = (s: string) => {
      if (s === "Approved") return "bg-emerald-500/10 text-emerald-500";
      if (s === "Pending") return "bg-amber-500/10 text-amber-500";
      return "bg-red-500/10 text-red-500";
    };
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Leaves</h1>
            <p className="text-sm text-muted-foreground">Your leave balances and entitlement stats.</p>
          </div>
          <Button onClick={() => setLeaveDialogOpen(true)} className="gradient-brand text-white border-0">Apply Leave Request</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {myBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground italic col-span-3">No leave entitlement assigned.</p>
          ) : myBalances.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border hover:shadow-sm transition-shadow">
              <h3 className="font-bold text-foreground text-sm uppercase tracking-wider mb-4">{l.leave_type} Leave</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                <div><p className="text-muted-foreground text-xs">Total</p><p className="font-bold text-lg text-foreground">{l.total_days}</p></div>
                <div><p className="text-muted-foreground text-xs">Used</p><p className="font-bold text-lg text-amber-500">{l.used_days}</p></div>
                <div><p className="text-muted-foreground text-xs">Balance</p><p className="font-bold text-lg text-emerald-500">{l.balance}</p></div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${leaveColor(l.leave_type)}`} style={{ width: `${(l.used_days / (l.total_days || 1)) * 100}%` }} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Leave History List */}
        <div className="glass-panel p-6 rounded-xl border">
          <h3 className="font-bold text-foreground mb-4">Leave Application History</h3>
          <div className="divide-y space-y-3">
            {myLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">No leave applications submitted yet.</p>
            ) : myLeaves.map(req => (
              <div key={req.id} className="flex justify-between items-center py-2 text-xs">
                <div>
                  <p className="font-semibold text-foreground text-sm">{req.leave_type} Leave</p>
                  <p className="text-muted-foreground mt-0.5">{req.from_date} → {req.to_date} ({req.days_requested} days)</p>
                  {req.reason && <p className="text-muted-foreground italic mt-0.5">Reason: {req.reason}</p>}
                </div>
                <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${leaveStatusColor(req.status)}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Dialog */}
        {leaveDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-foreground">Apply Leave Request</h3>
              <form onSubmit={handleApplyLeave} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Leave Type</label>
                  <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option>Annual</option>
                    <option>Sick</option>
                    <option>Casual</option>
                    <option>Maternity</option>
                    <option>Unpaid</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">From</label>
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase">To</label>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Total Days Requested</label>
                  <input type="number" min="1" value={daysRequested} onChange={e => setDaysRequested(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Reason</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe leave reason..." className="w-full p-3 text-sm rounded-md border bg-background h-20 resize-none" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setLeaveDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm">Submit Request</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: My Payroll Tab ──────────────────────────────────────
  if (tab === "ess_payroll") {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Payroll & Payslips</h1>
          <p className="text-sm text-muted-foreground">Download compensation details and monthly payslips.</p>
        </div>
        <div className="glass-panel p-6 rounded-xl border">
          <h3 className="font-bold text-foreground mb-4">Current Compensation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Basic Monthly Salary", value: emp?.basic_salary ? `$${emp.basic_salary.toLocaleString()}` : "Not Configured", color: "text-foreground" },
              { label: "Designation Mapped", value: emp ? emp.status : "—", color: "text-primary" },
              { label: "Employment Type", value: emp ? emp.employment_type : "—", color: "text-emerald-500 font-bold" },
            ].map(s => (
              <div key={s.label} className="p-4 bg-muted/40 rounded-xl border">
                <p className="text-xs text-muted-foreground mb-1 uppercase font-bold">{s.label}</p>
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payslips table */}
        <div className="glass-panel p-6 rounded-xl border">
          <h3 className="font-bold text-foreground mb-4">Monthly Payslips</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 text-right font-medium">Basic Pay</th>
                  <th className="px-6 py-3 text-right font-medium">Allowances</th>
                  <th className="px-6 py-3 text-right font-medium">Deductions</th>
                  <th className="px-6 py-3 text-right font-medium text-emerald-500">Net Paid</th>
                  <th className="px-6 py-3 text-center font-medium">Status</th>
                  <th className="px-6 py-3 text-center font-medium">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {myPayslips.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-6 text-center text-muted-foreground italic">No payslips issued yet.</td></tr>
                ) : myPayslips.map(ps => (
                  <tr key={ps.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{ps.year}-{ps.month.toString().padStart(2, '0')}</td>
                    <td className="px-6 py-4 text-right font-mono">${ps.basic_salary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">${(ps.hra + ps.other_allowances).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-red-400">-${(ps.pf_deduction + ps.esi_deduction + ps.tds_deduction + ps.other_deductions).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-500">${ps.net_salary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ps.status === "Paid" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                        {ps.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <a href={ps.pdf_url || "#"} className="text-primary hover:underline text-xs font-bold" download>Download PDF</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: My Documents Tab ────────────────────────────────────
  if (tab === "ess_documents") {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Documents</h1>
          <p className="text-sm text-muted-foreground">Compliance contracts, agreements, and HR policy sign-offs.</p>
        </div>
        <div className="space-y-3">
          {loading && <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>}
          {!loading && documents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded border text-center">No documents have been uploaded for you yet.</p>
          ) : documents.map((doc, i) => (
            <motion.div key={doc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-panel p-4 rounded-xl border flex justify-between items-center hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><FileText className="size-5" /></div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{doc.document_name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono">Uploaded: {formatDate(doc.upload_date)} • Type: {doc.document_type}</p>
                </div>
              </div>
              <a href={doc.file_path} target="_blank" rel="noreferrer" className="text-xs text-primary font-semibold hover:underline">Download</a>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: My Tasks Tab ────────────────────────────────────────
  if (tab === "ess_tasks") {
    const tasks = [
      { task: "Update Work Profile Details", due: "2026-07-20", priority: "High", status: "Pending" },
      { task: "Complete Compliance Form Sign-off", due: "2026-07-25", priority: "Medium", status: "Pending" },
      { task: "H1 Feedback Questionnaire", due: "2026-07-15", priority: "Low", status: "Done" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Tasks</h1>
          <p className="text-sm text-muted-foreground">Tasks assigned to you by the HR team.</p>
        </div>
        <div className="space-y-3">
          {tasks.map((t, i) => (
            <motion.div key={t.task} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`glass-panel p-4 rounded-xl border flex justify-between items-center ${t.status === "Done" ? "opacity-60 bg-muted/20" : "bg-card"}`}>
              <div className="flex items-center gap-3">
                <div className={`size-5 rounded flex items-center justify-center border ${t.status === "Done" ? "bg-emerald-500 border-emerald-500" : "border-muted"}`}>
                  {t.status === "Done" && <span className="size-2 bg-white rounded-full" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${t.status === "Done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.task}</p>
                  <p className="text-[10px] text-muted-foreground">Due Date: {t.due}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${t.priority === "High" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>{t.priority}</span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: Announcements Tab ───────────────────────────────────
  if (tab === "ess_announcements") {
    const announcements = [
      { id: 1, title: "Q3 2026 Strategy All-Hands Meeting", date: "2026-07-01", category: "Event", body: "Join us on July 15 for our corporate strategy meeting. Details and links have been sent via email." },
      { id: 2, title: "Wellness Program: Gym Allowance", date: "2026-06-28", category: "Benefit", body: "Active full-time team members are eligible for up to $50 monthly gym reimbursement starting this quarter." },
    ];
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground">Official policy announcements and announcements.</p>
        </div>
        <div className="space-y-4">
          {announcements.map((ann, i) => (
            <motion.div key={ann.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-panel p-5 rounded-xl border">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary mt-0.5"><Bell className="size-4" /></div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-foreground text-sm">{ann.title}</h4>
                    <span className="px-2 py-0.5 bg-secondary text-[10px] rounded uppercase font-bold">{ann.category}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{ann.date}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ann.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: My Attendance (Default) ─────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hello, {emp?.full_name || user?.name || "Employee"}!</h1>
          <p className="text-sm text-muted-foreground">
            {emp ? `${emp.employment_type} • Code: ${emp.employee_code}` : "Loading self service details..."}
          </p>
        </div>

        {emp && (
          <div className="flex gap-2">
            {!todayRecord?.check_in ? (
              <Button className="gradient-brand text-white border-0 h-10 px-6 font-semibold" onClick={handleClockIn} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4 mr-2" />}
                Clock In
              </Button>
            ) : !todayRecord?.check_out ? (
              <Button className="bg-red-600 hover:bg-red-700 text-white border-0 h-10 px-6 font-semibold" onClick={handleClockOut} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4 mr-2" />}
                Clock Out
              </Button>
            ) : (
              <span className="px-4 py-2 bg-emerald-500/10 text-emerald-600 font-semibold border rounded-lg text-sm">
                Completed Today
              </span>
            )}
          </div>
        )}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {emp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-5 md:col-span-1 border bg-card relative overflow-hidden flex flex-col justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Today's Presence</p>
              <h3 className="text-2xl font-black mb-1">
                {todayRecord ? todayRecord.status : "Not Clocked In"}
              </h3>
              <p className="text-xs text-muted-foreground">Punch Method: {todayRecord?.method || "N/A"}</p>
            </div>
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">In Time</p>
                <p className="font-mono font-bold">{formatTime(todayRecord?.check_in)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Out Time</p>
                <p className="font-mono font-bold">{formatTime(todayRecord?.check_out)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 md:col-span-2 border bg-card">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Clock className="size-4 text-primary animate-spin" /> Recent Attendance History</h3>
            {loading && attendance.length === 0 ? (
              <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">No timesheet records recorded in database yet.</p>
            ) : (
              <div className="divide-y max-h-48 overflow-y-auto space-y-2">
                {attendance.map(record => (
                  <div key={record.id} className="flex justify-between items-center py-2 text-xs">
                    <div>
                      <p className="font-semibold">{formatDate(record.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                      <p className="text-muted-foreground text-[10px]">Punch Method: {record.method}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {record.hours_worked && <span className="font-mono text-muted-foreground">{record.hours_worked} hrs</span>}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${attStatusStyle(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
