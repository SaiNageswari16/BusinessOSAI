import os

target = os.path.join("frontend", "src", "components", "hrms", "PayrollManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

line_ending = "\r\n" if "\r\n" in content else "\n"

# Add Button import
old_imports = """import { payrollApi, employeesApi, designationsApi, SalaryStructure, Payslip, Employee, PayGrade, Designation } from "../../lib/api-client";
import { Briefcase, Settings } from "lucide-react";"""

new_imports = """import { payrollApi, employeesApi, designationsApi, SalaryStructure, Payslip, Employee, PayGrade, Designation } from "../../lib/api-client";
import { Briefcase, Settings } from "lucide-react";
import { Button } from "../ui/button";"""

content = content.replace(old_imports.replace("\n", line_ending), new_imports.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Added Button import to PayrollManagement.tsx successfully")
