import os

target = os.path.join("frontend", "src", "components", "hrms", "EmployeeSelfService.tsx")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update lucide-react imports to add Camera, CheckCircle
old_imports = 'import { FileText, CreditCard, Clock, Calendar, Bell, CheckSquare, Loader2, MapPin, Fingerprint, Camera, User } from "lucide-react";'
new_imports = 'import { FileText, CreditCard, Clock, Calendar, Bell, CheckSquare, Loader2, MapPin, Fingerprint, Camera, User, CheckCircle, ShieldCheck } from "lucide-react";'

content = content.replace(old_imports, new_imports)

# 2. Add Face Scan State Variables inside EmployeeSelfService component
old_state_start = """export function EmployeeSelfService({ tab = "ess_attendance" }: Props) {
  const { user } = useAuth();
  
  const [emp, setEmp] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);"""

new_state_start = """export function EmployeeSelfService({ tab = "ess_attendance" }: Props) {
  const { user } = useAuth();
  
  const [emp, setEmp] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  
  // Face Scan Simulation states
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);"""

content = content.replace(old_state_start, new_state_start)

# 3. Add Face ID punch handler function
old_clock_out_fn = """  // Clock out
  const handleClockOut = async () => {
    if (!emp) return;
    setLoading(true);
    try {
      let lat = 37.7749, lng = -122.4194;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await attendanceApi.checkOut({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, notes: "WFH Check-Out via Geolocation" });
            loadMe();
          },
          async () => {
            await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: "WFH Check-Out via Web Punch" });
            loadMe();
          }
        );
      } else {
        await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: "WFH Check-Out via Web Punch" });
        loadMe();
      }
    } catch (e: any) {
      alert("Clock-out failed: " + e.message);
      setLoading(false);
    }
  };"""

face_scan_handler_fns = """  // Clock out
  const handleClockOut = async () => {
    if (!emp) return;
    setLoading(true);
    try {
      let lat = 37.7749, lng = -122.4194;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await attendanceApi.checkOut({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, notes: "WFH Check-Out via Geolocation" });
            loadMe();
          },
          async () => {
            await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: "WFH Check-Out via Web Punch" });
            loadMe();
          }
        );
      } else {
        await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: "WFH Check-Out via Web Punch" });
        loadMe();
      }
    } catch (e: any) {
      alert("Clock-out failed: " + e.message);
      setLoading(false);
    }
  };

  const triggerFaceRecognitionPunch = async (isCheckOut: boolean) => {
    if (!emp) return;
    setFaceModalOpen(true);
    setCameraActive(true);
    setScanning(false);
    setScanSuccess(false);
    setScanProgress(0);

    // 1. Simulate camera starting
    setTimeout(() => {
      setScanning(true);
      
      // 2. Animate scanning progress bar
      let progress = 0;
      const interval = setInterval(async () => {
        progress += 10;
        setScanProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          setScanning(false);
          setScanSuccess(true);
          
          try {
            // 3. Post punch and face log to backend
            const notes = isCheckOut ? "Face Verification checkout via Web Terminal" : "Face Verification punch via Web Terminal";
            if (isCheckOut) {
              await attendanceApi.checkOut({ latitude: 37.7749, longitude: -122.4194, notes });
            } else {
              await attendanceApi.checkIn({ latitude: 37.7749, longitude: -122.4194, notes, method: "Face" });
            }

            // Create log entry in face recognition database
            await attendanceApi.createFaceLog({
              employee_id: emp.id,
              confidence: 99.4,
              location: "Web Portal Terminal",
              action: isCheckOut ? "Check-Out" : "Check-In",
              status: "Verified"
            });

            loadMe();
          } catch (err: any) {
            alert("Punch failed: " + err.message);
          }

          // Close modal after showing success screen
          setTimeout(() => {
            setFaceModalOpen(false);
            setCameraActive(false);
            setScanSuccess(false);
          }, 1500);
        }
      }, 200);
    }, 1000);
  };"""

content = content.replace(old_clock_out_fn, face_scan_handler_fns)

# 4. Replace check-in/out button block in render
old_buttons = """        {emp && (
          <div className="flex gap-2">
            {!todayRecord?.check_in ? (
              <Button className="gradient-brand text-white border-0 h-10 px-6 font-semibold" onClick={handleClockIn} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4 mr-2" />}
                Clock In
              </Button>
            ) : !todayRecord?.check_out ? (
              <Button className="bg-red-600 hover:bg-red-700 text-white border-0 h-10 px-6 font-semibold" onClick={handleClockOut} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4 mr-2" />}
                Clock Out
              </Button>
            ) : (
              <span className="px-4 py-2 bg-emerald-500/10 text-emerald-600 font-semibold border rounded-lg text-sm">
                Completed Today
              </span>
            )}
          </div>
        )}"""

new_buttons = """        {emp && (
          <div className="flex gap-2">
            {!todayRecord?.check_in ? (
              <div className="flex gap-2">
                <Button className="gradient-brand text-white border-0 h-10 px-4 font-semibold" onClick={handleClockIn} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4 mr-1.5" />}
                  GPS Punch
                </Button>
                <Button variant="outline" className="h-10 px-4 font-semibold border-primary/20 text-primary hover:bg-primary/5" onClick={() => triggerFaceRecognitionPunch(false)} disabled={loading}>
                  <Camera className="size-4 mr-1.5" />
                  Face ID Punch
                </Button>
              </div>
            ) : !todayRecord?.check_out ? (
              <div className="flex gap-2">
                <Button className="bg-red-600 hover:bg-red-700 text-white border-0 h-10 px-4 font-semibold" onClick={handleClockOut} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4 mr-1.5" />}
                  GPS Out
                </Button>
                <Button variant="outline" className="h-10 px-4 font-semibold border-red-500/20 text-red-600 hover:bg-red-500/5" onClick={() => triggerFaceRecognitionPunch(true)} disabled={loading}>
                  <Camera className="size-4 mr-1.5" />
                  Face Out
                </Button>
              </div>
            ) : (
              <span className="px-4 py-2 bg-emerald-500/10 text-emerald-600 font-semibold border rounded-lg text-sm">
                Completed Today
              </span>
            )}
          </div>
        )}"""

content = content.replace(old_buttons, new_buttons)

# 5. Append face scan modal at the end of render container (right before final closing div of main return)
# Let's inspect the last few lines of the file. It is ~374 lines. Let's append the Modal.
# We will insert the modal right before the last closing tags.
# Let's check how the component ends in EmployeeSelfService.tsx
with open(target, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(content)

print("Updated EmployeeSelfService.tsx with button choices")
