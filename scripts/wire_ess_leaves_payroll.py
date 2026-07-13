import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeSelfService.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

line_ending = "\r\n" if "\r\n" in content else "\n"

# 1. Add leavesApi, payrollApi to imports in EmployeeSelfService.tsx
old_imports = 'import { employeesApi, attendanceApi, Employee, AttendanceRecord, EmployeeDocument } from "../../lib/api-client";'
new_imports = 'import { employeesApi, attendanceApi, leavesApi, payrollApi, Employee, AttendanceRecord, EmployeeDocument, LeaveRequest, LeaveBalance, Payslip } from "../../lib/api-client";'

content = content.replace(old_imports, new_imports)

# 2. Add state hooks for leaves and payroll inside component
old_states = """  const [emp, setEmp] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);"""

new_states = """  const [emp, setEmp] = useState<Employee | null>(null);
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
  const [reason, setReason] = useState("");"""

content = content.replace(old_states, new_states)

# 3. Update loadMe to call live leave and payroll endpoints
old_load_me = """  const loadMe = useCallback(async () => {
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
    } catch (err: any) {
      setError(err.message || "Failed to load self service data");
    } finally {
      setLoading(false);
    }
  }, []);"""

new_load_me = """  const loadMe = useCallback(async () => {
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
  }, []);"""

content = content.replace(old_load_me, new_load_me)

# 4. Add apply leave handler function
face_scan_handler_fns_end = """            // Create log entry in face recognition database
            await attendanceApi.createFaceLog({
              employee_id: emp.id,
              confidence: 99.4,
              location: "Web Portal Terminal",
              action: isCheckOut ? "Check-Out" : "Check-In",
              status: "Verified"
            });

            loadMe();
          } catch (err: any) {
            alert("Punch failed: " + err.message);
          }

          // Close modal after showing success screen
          setTimeout(() => {
            setFaceModalOpen(false);
            setCameraActive(false);
            setScanSuccess(false);
          }, 1500);
        }
      }, 200);
    }, 1000);
  };"""

apply_leave_fn_block = face_scan_handler_fns_end + """

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
  };"""

content = content.replace(face_scan_handler_fns_end, apply_leave_fn_block)

# 5. Overwrite Render: ess_leaves
old_ess_leaves_render = """  // ─── Render: My Leaves Tab ──────────────────────────────────────
  if (tab === "ess_leaves") {
    const balances = [
      { type: "Annual Leave", total: 18, used: 4, balance: 14, color: "bg-indigo-500" },
      { type: "Sick Leave", total: 12, used: 1, balance: 11, color: "bg-rose-500" },
      { type: "Casual Leave", total: 6, used: 2, balance: 4, color: "bg-amber-500" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Leaves</h1>
            <p className="text-sm text-muted-foreground">Your leave balances and entitlement stats.</p>
          </div>
          <Button className="gradient-brand text-white border-0">Apply Leave Request</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {balances.map((l, i) => (
            <motion.div key={l.type} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-panel p-6 rounded-xl border hover:shadow-sm transition-shadow">
              <h3 className="font-bold text-foreground text-sm uppercase tracking-wider mb-4">{l.type}</h3>
              <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                <div><p className="text-muted-foreground text-xs">Total</p><p className="font-bold text-lg text-foreground">{l.total}</p></div>
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
  }"""

new_ess_leaves_render = """  // ─── Render: My Leaves Tab ──────────────────────────────────────
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
  }"""

content = content.replace(old_ess_leaves_render.replace("\n", line_ending), new_ess_leaves_render.replace("\n", line_ending))

# 6. Overwrite Render: ess_payroll
old_ess_payroll_render = """  // ─── Render: My Payroll Tab ──────────────────────────────────────
  if (tab === "ess_payroll") {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Payroll & Payslips</h1>
          <p className="text-sm text-muted-foreground">Download compensation letters and monthly payslips.</p>
        </div>
        <div className="glass-panel p-6 rounded-xl border">
          <h3 className="font-bold text-foreground mb-4">Current Compensation Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Basic Monthly Salary", value: emp?.basic_salary ? `$${emp.basic_salary.toLocaleString()}` : "Not Configured", color: "text-foreground" },
              { label: "Provident Fund / Deduction", value: emp?.basic_salary ? "-$350" : "—", color: "text-red-500" },
              { label: "Net Payout Estimate", value: emp?.basic_salary ? `$${(emp.basic_salary - 350).toLocaleString()}` : "—", color: "text-emerald-500 font-bold" },
            ].map(s => (
              <div key={s.label} className="p-4 bg-muted/40 rounded-xl border">
                <p className="text-xs text-muted-foreground mb-1 uppercase font-bold">{s.label}</p>
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }"""

new_ess_payroll_render = """  // ─── Render: My Payroll Tab ──────────────────────────────────────
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
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">${ps.allowances.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-red-400">-${ps.deductions.toLocaleString()}</td>
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
  }"""

content = content.replace(old_ess_payroll_render.replace("\n", line_ending), new_ess_payroll_render.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Successfully wired EmployeeSelfService.tsx leaves & payroll tabs with live API endpoints")
