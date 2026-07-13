import os

target = os.path.join("frontend", "src", "routes", "_app.hrms.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add leave_policies mapping
old_leave_map = """  // Leave
  leave_requests:  LeaveManagement,
  leave_calendar:  LeaveManagement,
  leave_balance:   LeaveManagement,
  approvals:       LeaveManagement,"""

new_leave_map = """  // Leave
  leave_requests:  LeaveManagement,
  leave_calendar:  LeaveManagement,
  leave_balance:   LeaveManagement,
  leave_policies:  LeaveManagement,
  approvals:       LeaveManagement,"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(old_leave_map.replace("\n", line_ending), new_leave_map.replace("\n", line_ending))

# 2. Add pay_grades mapping
old_payroll_map = """  // Payroll
  salary_structure:   PayrollManagement,
  payroll_processing: PayrollManagement,"""

new_payroll_map = """  // Payroll
  salary_structure:   PayrollManagement,
  pay_grades:         PayrollManagement,
  payroll_processing: PayrollManagement,"""

content = content.replace(old_payroll_map.replace("\n", line_ending), new_payroll_map.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Successfully added leave_policies and pay_grades tab route mappings to _app.hrms.tsx")
