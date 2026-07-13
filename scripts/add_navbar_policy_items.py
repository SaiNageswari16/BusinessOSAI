import os

target = os.path.join("frontend", "src", "components", "layout", "app-navbar.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add Leave Schemes link
old_leave_subitems = """      subItems: [
        { to: "/hrms?tab=leave_requests", label: "Leave Requests", icon: Calendar },
        { to: "/hrms?tab=leave_calendar", label: "Leave Calendar", icon: CalendarClock },
        { to: "/hrms?tab=leave_balance", label: "Leave Balance", icon: Calculator },
        { to: "/hrms?tab=approvals", label: "Approvals", icon: ShieldCheck },"""

new_leave_subitems = """      subItems: [
        { to: "/hrms?tab=leave_requests", label: "Leave Requests", icon: Calendar },
        { to: "/hrms?tab=leave_calendar", label: "Leave Calendar", icon: CalendarClock },
        { to: "/hrms?tab=leave_balance", label: "Leave Balance", icon: Calculator },
        { to: "/hrms?tab=leave_policies", label: "Leave Schemes", icon: BookOpen },
        { to: "/hrms?tab=approvals", label: "Approvals", icon: ShieldCheck },"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(old_leave_subitems.replace("\n", line_ending), new_leave_subitems.replace("\n", line_ending))

# 2. Add Pay Grades link
old_payroll_subitems = """      subItems: [
        { to: "/hrms?tab=salary_structure", label: "Salary Structure", icon: Calculator },
        { to: "/hrms?tab=payroll_processing", label: "Payroll Processing", icon: Clock },"""

new_payroll_subitems = """      subItems: [
        { to: "/hrms?tab=salary_structure", label: "Salary Structure", icon: Calculator },
        { to: "/hrms?tab=pay_grades", label: "Pay Grades", icon: Briefcase },
        { to: "/hrms?tab=payroll_processing", label: "Payroll Processing", icon: Clock },"""

content = content.replace(old_payroll_subitems.replace("\n", line_ending), new_payroll_subitems.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Successfully added Leave Schemes and Pay Grades links to app-navbar.tsx")
