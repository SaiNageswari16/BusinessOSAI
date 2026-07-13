import os

target = os.path.join("frontend", "src", "components", "hrms", "AttendanceManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update header row
old_thead = """                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4 text-center">Hours Worked</th>
                  <th className="px-6 py-4">Punch Method</th>
                  <th className="px-6 py-4 text-center">Status</th>"""

new_thead = """                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4 text-center">Hours Worked</th>
                  <th className="px-6 py-4">Punch Method</th>
                  <th className="px-6 py-4">IP Address</th>
                  <th className="px-6 py-4 text-center">Status</th>"""

# 2. Update empty state
old_empty = '<tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No attendance records generated yet.</td></tr>'
new_empty = '<tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No attendance records generated yet.</td></tr>'

# 3. Update body row
old_tbody = """                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-secondary text-xs font-semibold capitalize">
                        {methodIcon(att.method)} <span className="ml-0.5">{att.method}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${attStatusStyle(att.status)}`}>{att.status}</span>
                    </td>"""

new_tbody = """                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-secondary text-xs font-semibold capitalize">
                        {methodIcon(att.method)} <span className="ml-0.5">{att.method}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{att.ip_address || "—"}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${attStatusStyle(att.status)}`}>{att.status}</span>
                    </td>"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(old_thead.replace("\n", line_ending), new_thead.replace("\n", line_ending))
content = content.replace(old_empty, new_empty)
content = content.replace(old_tbody.replace("\n", line_ending), new_tbody.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated AttendanceManagement.tsx with IP Address column successfully")
