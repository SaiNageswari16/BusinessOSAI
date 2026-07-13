import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeSelfService.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

helper_block = """
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
"""

last_import = 'import { Button } from "../ui/button";'
new_import_block = last_import + helper_block

content = content.replace(last_import, new_import_block)

# Replacements
content = content.replace("new Date(doc.upload_date).toLocaleDateString()", "formatDate(doc.upload_date)")
content = content.replace("new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })", "formatDate(record.date, { weekday: 'short', month: 'short', day: 'numeric' })")
content = content.replace("todayRecord?.check_in ? new Date(todayRecord.check_in).toLocaleTimeString() : \"—\"", "formatTime(todayRecord?.check_in)")
content = content.replace("todayRecord?.check_out ? new Date(todayRecord.check_out).toLocaleTimeString() : \"—\"", "formatTime(todayRecord?.check_out)")

with open(target, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(content)

print("Updated EmployeeSelfService.tsx with safe date/time functions")
