import os

target = os.path.join("frontend", "src", "components", "hrms", "AttendanceManagement.tsx")

with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update lucide-react imports to add Trash2
old_lucide = 'import { Plus, Clock, CheckCircle, AlertTriangle, XCircle, Fingerprint, Camera, MapPin, RefreshCw, Loader2, Play, AlertCircle } from "lucide-react";'
new_lucide = 'import { Plus, Clock, CheckCircle, AlertTriangle, XCircle, Fingerprint, Camera, MapPin, RefreshCw, Loader2, Play, AlertCircle, Trash2 } from "lucide-react";'

content = content.replace(old_lucide, new_lucide)

# 2. Update api-client imports to import employeesApi, Employee
old_api_imports = 'import { attendanceApi, AttendanceRecord, BiometricDevice, FaceRecognitionLog, AttendanceCorrection, HrmsDashboardStats } from "../../lib/api-client";'
new_api_imports = 'import { attendanceApi, employeesApi, AttendanceRecord, BiometricDevice, FaceRecognitionLog, AttendanceCorrection, HrmsDashboardStats, Employee } from "../../lib/api-client";'

content = content.replace(old_api_imports, new_api_imports)

# 3. Add simulator state hooks inside AttendanceManagement component
old_states_start = """export function AttendanceManagement({ tab = "daily_attendance" }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);"""

new_states_start = """export function AttendanceManagement({ tab = "daily_attendance" }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Data States
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  
  // Admin face simulator states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [faceSimDialogOpen, setFaceSimDialogOpen] = useState(false);
  const [simEmpId, setSimEmpId] = useState("");
  const [simAction, setSimAction] = useState("Check-In");
  const [simConfidence, setSimConfidence] = useState("98.5");
  const [simLocation, setSimLocation] = useState("Entrance Lobby Tablet");
  const [simulatingMatch, setSimulatingMatch] = useState(false);"""

content = content.replace(old_states_start, new_states_start)

# 4. Add loadEmployeesList, handleDeleteRecord, and handleSimulateFaceMatch functions
old_sync_biometric = """  // Sync Biometrics trigger
  const handleSyncBiometric = async () => {
    setSyncingBiometrics(true);
    try {
      await attendanceApi.syncBiometric();
      await loadBiometric();
    } catch (e: any) {
      alert("Sync failed: " + e.message);
    } finally {
      setSyncingBiometrics(false);
    }
  };"""

additional_handlers = """  // Load employees list for face simulator dropdown
  const loadEmployeesList = useCallback(async () => {
    try {
      const res = await employeesApi.list(1, 100);
      setEmployees(res.items || []);
    } catch (e) {
      console.error("Failed to load employees for simulator", e);
    }
  }, []);

  useEffect(() => {
    loadEmployeesList();
  }, [loadEmployeesList]);

  // Sync Biometrics trigger
  const handleSyncBiometric = async () => {
    setSyncingBiometrics(true);
    try {
      await attendanceApi.syncBiometric();
      await loadBiometric();
    } catch (e: any) {
      alert("Sync failed: " + e.message);
    } finally {
      setSyncingBiometrics(false);
    }
  };

  // Delete attendance record to allow re-clocking in for testing
  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this daily attendance record? This will allow the employee to clock in again.")) return;
    try {
      await attendanceApi.delete(id);
      loadDailyAttendance();
    } catch (err: any) {
      alert("Failed to delete record: " + err.message);
    }
  };

  // Simulate Face recognition scanner match
  const handleSimulateFaceMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simEmpId) return;
    setSimulatingMatch(true);
    try {
      const conf = parseFloat(simConfidence) || 98.5;
      const isOut = simAction === "Check-Out";
      
      // 1. Create matching face log entry
      await attendanceApi.createFaceLog({
        employee_id: simEmpId,
        confidence: conf,
        location: simLocation,
        action: simAction,
        status: "Verified"
      });

      // 2. Punch attendance
      if (isOut) {
        await attendanceApi.checkOut({
          employee_id: simEmpId,
          latitude: 37.7749,
          longitude: -122.4194,
          notes: `Verified Face ID checkout at ${simLocation}`
        });
      } else {
        await attendanceApi.checkIn({
          employee_id: simEmpId,
          latitude: 37.7749,
          longitude: -122.4194,
          method: "Face",
          notes: `Verified Face ID scan match at ${simLocation}`
        });
      }

      setFaceSimDialogOpen(false);
      loadFaceLogs();
      loadDailyAttendance();
      alert("Face recognition check-in simulated successfully!");
    } catch (err: any) {
      alert("Simulation failed: " + err.message);
    } finally {
      setSimulatingMatch(false);
    }
  };"""

content = content.replace(old_sync_biometric, additional_handlers)

# 5. Add "Simulate Face Scanner" button in face_recognition tab header next to active feed badge
old_face_logs_header = """        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Face Recognition Logs</h1>
            <p className="text-sm text-muted-foreground">Live matching metrics from tablet entrance cameras.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold animate-pulse">
            <span className="size-2 rounded-full bg-emerald-500" /> Active Feed
          </span>
        </div>"""

new_face_logs_header = """        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Face Recognition Logs</h1>
            <p className="text-sm text-muted-foreground">Live matching metrics from tablet entrance cameras.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setFaceSimDialogOpen(true)} className="gradient-brand text-white border-0 h-9 font-medium">
              <Camera className="size-4 mr-1.5" /> Simulate Face Match
            </Button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold animate-pulse">
              <span className="size-2 rounded-full bg-emerald-500" /> Active Feed
            </span>
          </div>
        </div>"""

content = content.replace(old_face_logs_header, new_face_logs_header)

# 6. Add face log simulator dialog modal code to the end of the face logs section or view return
# We will insert it at the end of the `if (tab === "face_recognition")` block
# Let's inspect where that block ends (line 345):
# `    );`
# `  }`
# `  // ─── Render: GPS Attendance ─────────────────────────────────────`
target_face_tab_end = """        </div>
      </div>
    );
  }

  // ─── Render: GPS Attendance ─────────────────────────────────────"""

replacement_face_tab_end = """        </div>
      </div>

      {/* Admin Face scanner match simulator dialog */}
      {faceSimDialogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Camera className="size-5 text-primary" /> Simulate Entrance Face Match
            </h3>
            <form onSubmit={handleSimulateFaceMatch} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee Profile</label>
                <select value={simEmpId} onChange={e => setSimEmpId(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required>
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Action</label>
                  <select value={simAction} onChange={e => setSimAction(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                    <option>Check-In</option>
                    <option>Check-Out</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Confidence Score</label>
                  <input type="number" min="80" max="100" step="0.1" value={simConfidence} onChange={e => setSimConfidence(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Scanner Location</label>
                <input type="text" value={simLocation} onChange={e => setSimLocation(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background" required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setFaceSimDialogOpen(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md text-sm flex items-center gap-1.5" disabled={simulatingMatch}>
                  {simulatingMatch ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                  Simulate Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    );
  }

  // ─── Render: GPS Attendance ─────────────────────────────────────"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(target_face_tab_end.replace("\n", line_ending), replacement_face_tab_end.replace("\n", line_ending))

# 7. Add Delete Column to the Daily Attendance table
old_thead = """                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>"""

new_thead = """                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>"""

old_tbody_tr = """                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${attStatusStyle(att.status)}`}>{att.status}</span>
                    </td>
                  </tr>"""

new_tbody_tr = """                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${attStatusStyle(att.status)}`}>{att.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-700 hover:bg-red-500/10" onClick={() => handleDeleteRecord(att.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>"""

content = content.replace(old_thead.replace("\n", line_ending), new_thead.replace("\n", line_ending))
content = content.replace(old_tbody_tr.replace("\n", line_ending), new_tbody_tr.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Wired AttendanceManagement.tsx with delete logs and admin simulated face scanner matching successfully")
