import os

target = os.path.join("frontend", "src", "components", "hrms", "AttendanceManagement.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add useAuth import to AttendanceManagement.tsx
old_import = 'import { attendanceApi, employeesApi, AttendanceRecord, BiometricDevice, FaceRecognitionLog, AttendanceCorrection, HrmsDashboardStats, Employee } from "../../lib/api-client";'
new_import = 'import { useAuth } from "@/contexts/auth-context";\nimport { attendanceApi, employeesApi, AttendanceRecord, BiometricDevice, FaceRecognitionLog, AttendanceCorrection, HrmsDashboardStats, Employee } from "../../lib/api-client";'

content = content.replace(old_import, new_import)

# 2. Add useAuth hook inside component
old_states = """export function AttendanceManagement({ tab = "daily_attendance" }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");"""

new_states = """export function AttendanceManagement({ tab = "daily_attendance" }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");"""

content = content.replace(old_states, new_states)

# 3. Restrict buttons in render
old_buttons = """        <div className="flex gap-2">
          <Button variant="outline" className="h-9 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10" onClick={handleClockIn}>
            WFH Clock In
          </Button>
          <Button variant="outline" className="h-9 border-red-500/20 text-red-600 hover:bg-red-500/10" onClick={handleClockOut}>
            WFH Clock Out
          </Button>
        </div>"""

new_buttons = """        {user?.is_tenant_owner && (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10" onClick={handleClockIn}>
              WFH Clock In
            </Button>
            <Button variant="outline" className="h-9 border-red-500/20 text-red-600 hover:bg-red-500/10" onClick={handleClockOut}>
              WFH Clock Out
            </Button>
          </div>
        )}"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(old_buttons.replace("\n", line_ending), new_buttons.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Restricted WFH Clock buttons to tenant owner/admin only in AttendanceManagement.tsx")
