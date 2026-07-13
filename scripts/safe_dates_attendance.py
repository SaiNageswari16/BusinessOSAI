import os

target = os.path.join("frontend", "src", "components", "hrms", "AttendanceManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

helper_block = """
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
};

const formatTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
"""

last_import = 'import { Input } from "../ui/input";'
new_import_block = last_import + helper_block

content = content.replace(last_import, new_import_block)

# Replacements
content = content.replace("new Date(c.date).toLocaleDateString()", "formatDate(c.date)")
content = content.replace("new Date(log.timestamp).toLocaleTimeString()", "formatTime(log.timestamp)")
content = content.replace("log.check_in ? new Date(log.check_in).toLocaleTimeString() : \"—\"", "formatTime(log.check_in)")
content = content.replace("att.check_in ? new Date(att.check_in).toLocaleTimeString() : \"—\"", "formatTime(att.check_in)")
content = content.replace("att.check_out ? new Date(att.check_out).toLocaleTimeString() : \"—\"", "formatTime(att.check_out)")

with open(target, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(content)

print("Updated AttendanceManagement.tsx with safe date/time functions")
