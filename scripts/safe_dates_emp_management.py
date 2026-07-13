import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# Helper block to insert right after imports
helper_block = """
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
};
"""

# Apply helper block insertion after the last import line
last_import = 'import { Card } from "../ui/card";'
new_import_block = last_import + helper_block

content = content.replace(last_import, new_import_block)

# Replace the Date instantiations with the safe function
content = content.replace("new Date(doc.upload_date).toLocaleDateString()", "formatDate(doc.upload_date)")
content = content.replace("new Date(emp.date_of_joining).toLocaleDateString()", "formatDate(emp.date_of_joining)")
content = content.replace('new Date(emp.date_of_joining ?? "").toLocaleDateString()', "formatDate(emp.date_of_joining)")

# Let's save it
with open(target, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(content)

print("Updated EmployeeManagement.tsx with safe date functions")
