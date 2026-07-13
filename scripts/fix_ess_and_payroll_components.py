import os

# 1. Fix EmployeeSelfService.tsx (Add handleApplyLeave and compute payslip allowances/deductions)
ess_file = os.path.join("frontend", "src", "components", "hrms", "EmployeeSelfService.tsx")
with open(ess_file, "r", encoding="utf-8") as f:
    ess_content = f.read()

# Add handleApplyLeave
old_clockout_end = """    } catch (e: any) {
      alert("Clock-out failed: " + e.message);
      setLoading(false);
    }
  };

  // Find today's check-in status"""

new_clockout_end = """    } catch (e: any) {
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

  // Find today's check-in status"""

line_ending = "\r\n" if "\r\n" in ess_content else "\n"
ess_content = ess_content.replace(old_clockout_end.replace("\n", line_ending), new_clockout_end.replace("\n", line_ending))

# Fix Payslip properties
old_payslip_row = """                  <tr key={ps.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{ps.year}-{ps.month.toString().padStart(2, '0')}</td>
                    <td className="px-6 py-4 text-right font-mono">${ps.basic_salary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">${ps.allowances.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-red-400">-${ps.deductions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-500">${ps.net_salary.toLocaleString()}</td>"""

new_payslip_row = """                  <tr key={ps.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{ps.year}-{ps.month.toString().padStart(2, '0')}</td>
                    <td className="px-6 py-4 text-right font-mono">${ps.basic_salary.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">${(ps.hra + ps.other_allowances).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono text-red-400">-${(ps.pf_deduction + ps.esi_deduction + ps.tds_deduction + ps.other_deductions).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-500">${ps.net_salary.toLocaleString()}</td>"""

ess_content = ess_content.replace(old_payslip_row.replace("\n", line_ending), new_payslip_row.replace("\n", line_ending))

with open(ess_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(ess_content)


# 2. Fix LeaveManagement.tsx (Import Button, add department/employee name mapping)
leave_file = os.path.join("frontend", "src", "components", "hrms", "LeaveManagement.tsx")
with open(leave_file, "r", encoding="utf-8") as f:
    leave_content = f.read()

# Add Button import
old_leave_imports = """import { Plus, Calendar, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { leavesApi, LeaveRequest, LeaveBalance, LeavePolicy } from "../../lib/api-client";
import { BookOpen, FileText } from "lucide-react";"""

new_leave_imports = """import { Plus, Calendar, CheckCircle, Clock, XCircle, Loader2, BookOpen, FileText } from "lucide-react";
import { leavesApi, LeaveRequest, LeaveBalance, LeavePolicy } from "../../lib/api-client";
import { Button } from "../ui/button";"""

leave_content = leave_content.replace(old_leave_imports.replace("\n", line_ending), new_leave_imports.replace("\n", line_ending))

# Replace table td reading req.employee_name and req.department
old_leave_table_td = """                    <td className="px-6 py-4 font-medium text-primary">{req.id.substring(0, 8)}</td>
                    <td className="px-6 py-4"><p className="font-medium text-foreground">{req.employee_name}</p><p className="text-xs text-muted-foreground">{req.department}</p></td>"""

new_leave_table_td = """                    <td className="px-6 py-4 font-medium text-primary">{req.id.substring(0, 8)}</td>
                    <td className="px-6 py-4"><p className="font-medium text-foreground">{req.employee_name || "Unassigned"}</p><p className="text-xs text-muted-foreground">{req.department || "General"}</p></td>"""

leave_content = leave_content.replace(old_leave_table_td.replace("\n", line_ending), new_leave_table_td.replace("\n", line_ending))

# Replace the calendar render mapping that checks event.employee_name
old_calendar_event_name = """                <div>
                  <p className="font-semibold">{event.employee_name}</p>"""

new_calendar_event_name = """                <div>
                  <p className="font-semibold">{event.employee_name || "Unassigned"}</p>"""

leave_content = leave_content.replace(old_calendar_event_name.replace("\n", line_ending), new_calendar_event_name.replace("\n", line_ending))

with open(leave_file, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(leave_content)


# 3. Fix PayrollManagement.tsx (Remove duplicate codes)
payroll_file = os.path.join("frontend", "src", "components", "hrms", "PayrollManagement.tsx")
with open(payroll_file, "r", encoding="utf-8") as f:
    payroll_content = f.read()

# Let's read lines 50 to 120 of PayrollManagement.tsx to locate the duplicate handler and state declarations
# Let's inspect the code of PayrollManagement.tsx using a python block to find where it is duplicated
print("Corrected EmployeeSelfService.tsx and LeaveManagement.tsx. Now repairing duplicates in PayrollManagement.tsx...")
