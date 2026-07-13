import os

target = os.path.join("frontend", "src", "components", "layout", "app-navbar.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

line_ending = "\r\n" if "\r\n" in content else "\n"

# Define the targets to replace
replacements = [
    (
        """    { 
      to: "/hrms?tab=employees", 
      label: "Employee Management", 
      icon: Users,""",
        """    { 
      to: "/hrms?tab=employees", 
      label: "Employee Management", 
      icon: Users,
      permission: "manage:users","""
    ),
    (
        """    { 
      to: "/hrms?tab=daily_attendance", 
      label: "Attendance", 
      icon: Clock,""",
        """    { 
      to: "/hrms?tab=daily_attendance", 
      label: "Attendance", 
      icon: Clock,
      permission: "manage:users","""
    ),
    (
        """    { 
      to: "/hrms?tab=leave_requests", 
      label: "Leave", 
      icon: Calendar,""",
        """    { 
      to: "/hrms?tab=leave_requests", 
      label: "Leave", 
      icon: Calendar,
      permission: "manage:users","""
    ),
    (
        """    { 
      to: "/hrms?tab=salary_structure", 
      label: "Payroll", 
      icon: CreditCard,""",
        """    { 
      to: "/hrms?tab=salary_structure", 
      label: "Payroll", 
      icon: CreditCard,
      permission: "manage:users","""
    ),
    (
        """    { 
      to: "/hrms?tab=job_openings", 
      label: "Recruitment", 
      icon: Briefcase,""",
        """    { 
      to: "/hrms?tab=job_openings", 
      label: "Recruitment", 
      icon: Briefcase,
      permission: "manage:users","""
    ),
    (
        """    { 
      to: "/hrms?tab=goals", 
      label: "Performance", 
      icon: Target,""",
        """    { 
      to: "/hrms?tab=goals", 
      label: "Performance", 
      icon: Target,
      permission: "manage:users","""
    ),
    (
        """    { 
      to: "/hrms?tab=training", 
      label: "Learning", 
      icon: BrainCircuit,""",
        """    { 
      to: "/hrms?tab=training", 
      label: "Learning", 
      icon: BrainCircuit,
      permission: "manage:users","""
    ),
    (
        """    { 
      to: "/hrms?tab=resignation", 
      label: "Exit Management", 
      icon: ArrowRightLeft,""",
        """    { 
      to: "/hrms?tab=resignation", 
      label: "Exit Management", 
      icon: ArrowRightLeft,
      permission: "manage:users","""
    ),
    (
        """    { 
      to: "/hrms?tab=attendance_analytics", 
      label: "HR Intelligence", 
      icon: BrainCircuit,""",
        """    { 
      to: "/hrms?tab=attendance_analytics", 
      label: "HR Intelligence", 
      icon: BrainCircuit,
      permission: "manage:users","""
    )
]

for old_str, new_str in replacements:
    content = content.replace(old_str.replace("\n", line_ending), new_str.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Successfully injected item-level manage:users permissions to HRMS navigation menu!")
