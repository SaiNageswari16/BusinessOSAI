import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Clock, CheckCircle, AlertTriangle, XCircle, Fingerprint, Camera, MapPin, RefreshCw, Loader2, Play, AlertCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { attendanceApi, employeesApi, AttendanceRecord, BiometricDevice, FaceRecognitionLog, AttendanceCorrection, HrmsDashboardStats, Employee, workCalendarsApi } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCurrency } from "@/hooks/use-currency";

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


interface Props { tab?: string; }

const attStatusStyle = (s: string) => {
  switch (s?.toLowerCase()) {
    case "present": return "bg-emerald-500/10 text-emerald-500";
    case "late": return "bg-amber-500/10 text-amber-500";
    case "absent": return "bg-red-500/10 text-red-500";
    case "half day": return "bg-blue-500/10 text-blue-500";
    case "on leave": return "bg-purple-500/10 text-purple-500";
    default: return "bg-muted text-muted-foreground";
  }
};

const methodIcon = (m: string | null | undefined) => {
  switch (m?.toLowerCase()) {
    case "biometric": return <Fingerprint className="size-3.5" />;
    case "face": return <Camera className="size-3.5" />;
    case "gps": return <MapPin className="size-3.5" />;
    default: return <Clock className="size-3.5" />;
  }
};

export function AttendanceManagement({ tab = "daily_attendance" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  const { user } = useAuth();
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
  const [simulatingMatch, setSimulatingMatch] = useState(false);
  const [stats, setStats] = useState<HrmsDashboardStats | null>(null);
  const [biometricDevices, setBiometricDevices] = useState<BiometricDevice[]>([]);
  const [faceLogs, setFaceLogs] = useState<FaceRecognitionLog[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);

  // Dialogs & Actions
  const [syncingBiometrics, setSyncingBiometrics] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);

  // New correction request form
  const [correctionForm, setCorrectionForm] = useState({
    date: new Date().toISOString().split("T")[0],
    original_status: "Absent",
    corrected_status: "Present",
    reason: "",
    original_check_in: "",
    original_check_out: "",
    corrected_check_in: "",
    corrected_check_out: "",
  });

  // Shift & Calendars states
  const [workCalendars, setWorkCalendars] = useState<any[]>([]);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<any | null>(null);
  
  const [shiftForm, setShiftForm] = useState({
    name: "",
    startTime: "09:00",
    endTime: "18:00"
  });

  const [calendarForm, setCalendarForm] = useState({
    name: "",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"]
  });

  const loadShiftsData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await workCalendarsApi.list(1, 50);
      setWorkCalendars(res.items || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load shift calendars");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDailyAttendance = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const attRes = await attendanceApi.list(1, 100);
      setAttendance(attRes.items);
      const statsRes = await attendanceApi.getStats();
      setStats(statsRes);
    } catch (e: any) {
      setError(e.message || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBiometric = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await attendanceApi.listBiometric();
      setBiometricDevices(res);
    } catch (e: any) {
      setError(e.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFaceLogs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await attendanceApi.listFaceLogs();
      setFaceLogs(res);
    } catch (e: any) {
      setError(e.message || "Failed to load face logs");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCorrections = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await attendanceApi.listCorrections();
      setCorrections(res);
    } catch (e: any) {
      setError(e.message || "Failed to load corrections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "daily_attendance" || tab === "gps_attendance") {
      loadDailyAttendance();
    } else if (tab === "shift_attendance") {
      loadDailyAttendance();
      loadShiftsData();
    } else if (tab === "biometric") {
      loadBiometric();
    } else if (tab === "face_recognition") {
      loadFaceLogs();
    } else if (tab === "attendance_corrections") {
      loadCorrections();
    }
  }, [tab, loadDailyAttendance, loadShiftsData, loadBiometric, loadFaceLogs, loadCorrections]);

  // Load employees list for face simulator dropdown
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
  };

  // Clock in trigger
  const handleClockIn = async () => {
    setLoading(true);
    try {
      let lat = 37.7749, lng = -122.4194; // fallback SF
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await attendanceApi.checkIn({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, notes: "Clock-In via Web App GPS", method: "GPS" });
            loadDailyAttendance();
          },
          async () => {
            await attendanceApi.checkIn({ latitude: lat, longitude: lng, notes: "Clock-In via Web App Manual", method: "Manual" });
            loadDailyAttendance();
          }
        );
      } else {
        await attendanceApi.checkIn({ latitude: lat, longitude: lng, notes: "Clock-In via Web App Manual", method: "Manual" });
        loadDailyAttendance();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Clock out trigger
  const handleClockOut = async () => {
    setLoading(true);
    try {
      let lat = 37.7749, lng = -122.4194; // fallback SF
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await attendanceApi.checkOut({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, notes: "Clock-Out via Web App GPS" });
            loadDailyAttendance();
          },
          async () => {
            await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: "Clock-Out via Web App Manual" });
            loadDailyAttendance();
          }
        );
      } else {
        await attendanceApi.checkOut({ latitude: lat, longitude: lng, notes: "Clock-Out via Web App Manual" });
        loadDailyAttendance();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Review Correction
  const handleReviewCorrection = async (id: string, newStatus: "Approved" | "Rejected") => {
    setReviewingId(id);
    try {
      await attendanceApi.reviewCorrection(id, newStatus);
      loadCorrections();
    } catch (e: any) {
      alert("Failed to review correction: " + e.message);
    } finally {
      setReviewingId(null);
    }
  };

  // Submit Correction Request
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await attendanceApi.createCorrection({
        date: correctionForm.date,
        original_status: correctionForm.original_status,
        corrected_status: correctionForm.corrected_status,
        reason: correctionForm.reason,
        original_check_in: correctionForm.original_check_in ? new Date(correctionForm.date + "T" + correctionForm.original_check_in).toISOString() : null,
        original_check_out: correctionForm.original_check_out ? new Date(correctionForm.date + "T" + correctionForm.original_check_out).toISOString() : null,
        corrected_check_in: correctionForm.corrected_check_in ? new Date(correctionForm.date + "T" + correctionForm.corrected_check_in).toISOString() : null,
        corrected_check_out: correctionForm.corrected_check_out ? new Date(correctionForm.date + "T" + correctionForm.corrected_check_out).toISOString() : null,
      });
      setCorrectionDialogOpen(false);
      setCorrectionForm({
        date: new Date().toISOString().split("T")[0],
        original_status: "Absent",
        corrected_status: "Present",
        reason: "",
        original_check_in: "",
        original_check_out: "",
        corrected_check_in: "",
        corrected_check_out: "",
      });
      loadCorrections();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render: Biometric Devices ──────────────────────────────────
  if (tab === "biometric") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Biometric Devices</h2>
            <p className="text-xs text-muted-foreground">Fingerprint, access turnstile, and keycard scanners.</p>
          </div>
          <Button className="h-8 text-xs font-semibold gradient-brand text-white border-0" onClick={handleSyncBiometric} disabled={syncingBiometrics}>
            {syncingBiometrics ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5" />}
            Sync Active Devices
          </Button>
        </div>

        {loading && biometricDevices.length === 0 && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {biometricDevices.map((device, i) => (
            <motion.div key={device.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`glass-panel p-6 rounded-xl border ${device.status === "Online" ? "border-emerald-500/25 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary/10 rounded-xl"><Fingerprint className="size-6 text-primary" /></div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${device.status === "Online" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                  {device.status}
                </span>
              </div>
              <h3 className="font-bold text-foreground text-base leading-tight mb-1">{device.location}</h3>
              <p className="text-xs text-muted-foreground">Model: {device.model} • Code: {device.device_code}</p>
              <div className="grid grid-cols-2 gap-3 text-xs border-t pt-4 mt-4">
                <div>
                  <p className="text-muted-foreground">Enrolled Profiles</p>
                  <p className="font-bold text-foreground">{device.enrolled_employees} Employees</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Sync Timestamp</p>
                  <p className="font-medium text-foreground">{device.last_sync ? new Date(device.last_sync).toLocaleString() : "Never synced"}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: Face Recognition Logs ──────────────────────────────
  if (tab === "face_recognition") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Face Recognition Logs</h2>
            <p className="text-xs text-muted-foreground">Live matching metrics from tablet entrance cameras.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setFaceSimDialogOpen(true)} className="gradient-brand text-white border-0 h-8 text-xs font-semibold">
              <Camera className="size-3.5 mr-1.5" /> Simulate Face Match
            </Button>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold animate-pulse">
              <span className="size-2 rounded-full bg-emerald-500" /> Active Feed
            </span>
          </div>
        </div>

        {loading && faceLogs.length === 0 && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Event Time</th>
                  <th className="px-6 py-4">Employee Match</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4 text-right">Confidence Score</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {faceLogs.length === 0 && !loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No face logs recorded today.</td></tr>
                ) : faceLogs.map((log, i) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">{formatTime(log.timestamp)}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{log.employee_name}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{log.location}</td>
                    <td className="px-6 py-4"><span className="px-2 py-0.5 bg-secondary text-xs rounded font-bold uppercase">{log.action}</span></td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-500">{log.confidence}%</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${log.status === "Verified" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Face scanner match simulator dialog (moved inside the parent div wrapper) */}
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
      </div>
    );
  }

  // ─── Render: GPS Attendance ─────────────────────────────────────
  if (tab === "gps_attendance") {
    // Show entries containing latitude and longitude values
    const gpsRecords = attendance.filter(r => r.latitude || r.longitude);
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">GPS / Geofenced Attendance</h2>
          <p className="text-xs text-muted-foreground">Geofenced coordinates recorded for field or remote WFH staff.</p>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gpsRecords.length === 0 && !loading ? (
            <p className="col-span-2 text-center py-12 text-muted-foreground">No GPS attendance logs recorded today.</p>
          ) : gpsRecords.map((log, i) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-panel p-5 rounded-xl border flex justify-between items-center hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-green-500/10 rounded-lg text-green-500"><MapPin className="size-5" /></div>
                <div>
                  <p className="font-semibold text-foreground">{log.employee_name} <span className="text-xs text-muted-foreground">({log.employee_code})</span></p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">Lat: {log.latitude} , Lng: {log.longitude}</p>
                  {log.notes && <p className="text-[10px] text-muted-foreground italic mt-1">"{log.notes}"</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-xs">{formatTime(log.check_in)}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${attStatusStyle(log.status)}`}>{log.status}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: Shift Attendance ───────────────────────────────────
  if (tab === "shift_attendance") {
    const handleCreateCalendar = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!calendarForm.name.trim()) return;
      try {
        await workCalendarsApi.create({
          name: calendarForm.name,
          calendar_type: "shift",
          working_days: calendarForm.workingDays,
          shifts: []
        });
        setCalendarDialogOpen(false);
        setCalendarForm({ name: "", workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"] });
        loadShiftsData();
      } catch (err: any) {
        alert("Failed to create calendar: " + err.message);
      }
    };

    const handleAddShift = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCalendar || !shiftForm.name.trim()) return;
      try {
        const updatedShifts = [...(selectedCalendar.shifts || [])];
        updatedShifts.push({
          name: shiftForm.name,
          start_time: shiftForm.startTime,
          end_time: shiftForm.endTime
        });
        await workCalendarsApi.update(selectedCalendar.id, {
          shifts: updatedShifts
        });
        setShiftDialogOpen(false);
        setShiftForm({ name: "", startTime: "09:00", endTime: "18:00" });
        setSelectedCalendar(null);
        loadShiftsData();
      } catch (err: any) {
        alert("Failed to add shift: " + err.message);
      }
    };

    const handleDeleteShift = async (cal: any, index: number) => {
      if (!confirm("Are you sure you want to delete this shift?")) return;
      try {
        const updatedShifts = [...(cal.shifts || [])];
        updatedShifts.splice(index, 1);
        await workCalendarsApi.update(cal.id, {
          shifts: updatedShifts
        });
        loadShiftsData();
      } catch (err: any) {
        alert("Failed to delete shift: " + err.message);
      }
    };

    const handleDeleteCalendar = async (id: string) => {
      if (!confirm("Are you sure you want to delete this shift calendar?")) return;
      try {
        await workCalendarsApi.delete(id);
        loadShiftsData();
      } catch (err: any) {
        alert("Failed to delete calendar: " + err.message);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Shift & Calendars Configuration</h2>
            <p className="text-xs text-muted-foreground">Manage active work calendars, day schedules, and shift timings.</p>
          </div>
          <Button 
            className="h-8 text-xs font-semibold gradient-brand text-white border-0" 
            onClick={() => setCalendarDialogOpen(true)}
          >
            <Plus className="size-3.5 mr-1.5" /> New Shift Calendar
          </Button>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

        {!loading && workCalendars.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center glass-panel rounded-xl border border-border/50 bg-muted/10">
            <Clock className="size-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="font-semibold text-foreground text-lg mb-1">No Shift Calendars Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Add a work calendar to organize and assign shift timings for your employees.
            </p>
            <Button className="gradient-brand text-white border-0" onClick={() => setCalendarDialogOpen(true)}>
              Initialize Calendar
            </Button>
          </div>
        )}

        {!loading && workCalendars.map((cal) => (
          <motion.div 
            key={cal.id} 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 rounded-xl border border-border/50 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-foreground text-lg mb-1">{cal.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Days: {cal.working_days?.join(", ") || "None"} | Type: {cal.calendar_type}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs bg-transparent"
                  onClick={() => {
                    setSelectedCalendar(cal);
                    setShiftDialogOpen(true);
                  }}
                >
                  <Plus className="size-3.5 mr-1" /> Add Shift
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs"
                  onClick={() => handleDeleteCalendar(cal.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Shifts</p>
              {(!cal.shifts || cal.shifts.length === 0) ? (
                <p className="text-sm text-muted-foreground italic">No shifts configured. Click 'Add Shift' to insert one.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cal.shifts.map((shift: any, sIdx: number) => (
                    <div 
                      key={sIdx} 
                      className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-md"><Clock className="size-4 text-primary" /></div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{shift.name}</p>
                          <p className="text-xs text-muted-foreground">{shift.start_time} - {shift.end_time}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-muted-foreground hover:text-red-500 p-1 h-auto"
                        onClick={() => handleDeleteShift(cal, sIdx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Modal: New Shift Calendar */}
        {calendarDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md p-6 rounded-xl border bg-card text-card-foreground shadow-lg space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">New Shift Calendar</h3>
                <button onClick={() => setCalendarDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>
              <form onSubmit={handleCreateCalendar} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Calendar Name</label>
                  <Input 
                    placeholder="e.g. Standard Rotating Shifts" 
                    value={calendarForm.name} 
                    onChange={e => setCalendarForm({ ...calendarForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Working Days</label>
                  <div className="flex flex-wrap gap-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                      const active = calendarForm.workingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            active 
                              ? "bg-primary border-primary text-white" 
                              : "bg-muted border-border/50 text-muted-foreground"
                          }`}
                          onClick={() => {
                            const next = active 
                              ? calendarForm.workingDays.filter(d => d !== day)
                              : [...calendarForm.workingDays, day];
                            setCalendarForm({ ...calendarForm, workingDays: next });
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setCalendarDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="gradient-brand text-white border-0">Create Calendar</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal: Add Shift */}
        {shiftDialogOpen && selectedCalendar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md p-6 rounded-xl border bg-card text-card-foreground shadow-lg space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Add Shift to {selectedCalendar.name}</h3>
                <button onClick={() => setShiftDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>
              <form onSubmit={handleAddShift} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Shift Name</label>
                  <Input 
                    placeholder="e.g. Night Shift" 
                    value={shiftForm.name} 
                    onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Start Time</label>
                    <Input 
                      type="time" 
                      value={shiftForm.startTime} 
                      onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">End Time</label>
                    <Input 
                      type="time" 
                      value={shiftForm.endTime} 
                      onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShiftDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="gradient-brand text-white border-0">Add Shift</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Attendance Corrections ──────────────────────────────
  if (tab === "attendance_corrections") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Attendance Corrections</h2>
            <p className="text-xs text-muted-foreground">Manage VPN proof records, missed logs, or clocking adjustments.</p>
          </div>
          <Button className="h-8 text-xs font-semibold gradient-brand text-white border-0" onClick={() => setCorrectionDialogOpen(true)}>
            <Plus className="size-3.5 mr-1.5" /> Request Correction
          </Button>
        </div>

        {loading && corrections.length === 0 && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

        <div className="space-y-4">
          {corrections.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-panel p-5 rounded-xl border border-border/60 hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground">Request</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.status === "Approved" ? "bg-emerald-500/10 text-emerald-500" : c.status === "Pending" ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"}`}>
                      {c.status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-foreground text-sm">{c.employee_name} <span className="font-normal text-muted-foreground">· Date: {formatDate(c.date)}</span></h4>
                  <p className="text-xs text-muted-foreground">
                    Adjustment: <span className="line-through text-red-500">{c.original_status}</span> &rarr; <span className="text-emerald-600 font-bold">{c.corrected_status}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 bg-muted/40 p-2 rounded border">Reason: {c.reason}</p>
                </div>

                {c.status === "Pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
                      onClick={() => handleReviewCorrection(c.id, "Approved")} disabled={reviewingId === c.id}>
                      {reviewingId === c.id ? <Loader2 className="size-3 animate-spin" /> : "Approve"}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-500/20 hover:bg-red-500/10"
                      onClick={() => handleReviewCorrection(c.id, "Rejected")} disabled={reviewingId === c.id}>
                      {reviewingId === c.id ? <Loader2 className="size-3 animate-spin" /> : "Reject"}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── REQUEST CORRECTION DIALOG ─────────────────────────────── */}
        {correctionDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-md p-6 shadow-2xl">
              <h3 className="text-lg font-bold mb-4">Request Attendance Correction</h3>
              <form onSubmit={handleSubmitCorrection} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Date of Discrepancy</label>
                  <Input type="date" value={correctionForm.date} onChange={e => setCorrectionForm(p => ({ ...p, date: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Original Status</label>
                    <select value={correctionForm.original_status} onChange={e => setCorrectionForm(p => ({ ...p, original_status: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option>Absent</option>
                      <option>Late</option>
                      <option>Present</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Corrected Status</label>
                    <select value={correctionForm.corrected_status} onChange={e => setCorrectionForm(p => ({ ...p, corrected_status: e.target.value }))} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                      <option>Present</option>
                      <option>Late</option>
                      <option>Half Day</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Corrected Check In</label>
                    <Input type="time" value={correctionForm.corrected_check_in} onChange={e => setCorrectionForm(p => ({ ...p, corrected_check_in: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Corrected Check Out</label>
                    <Input type="time" value={correctionForm.corrected_check_out} onChange={e => setCorrectionForm(p => ({ ...p, corrected_check_out: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Reason / Proof</label>
                  <textarea value={correctionForm.reason} onChange={e => setCorrectionForm(p => ({ ...p, reason: e.target.value }))} rows={3}
                    className="w-full px-3 py-2 text-sm rounded-md border bg-background resize-none focus:outline-none"
                    placeholder="e.g. Forgot to scan biometric at entry turnstile..." required />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCorrectionDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 gradient-brand text-white border-0">Submit Request</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Daily Attendance (Default) ─────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Daily Attendance</h2>
          <p className="text-xs text-muted-foreground">Timesheets log summary for today.</p>
        </div>
        {(() => {
          const activeRole = user?.roles.find(r => r.id === user?.activeRoleId);
          const isAdmin = activeRole ? (activeRole.name.toLowerCase().includes("admin") || activeRole.name.toLowerCase().includes("hr")) : user?.isTenantOwner;
          if (!isAdmin) return null;
          return (
            <div className="flex gap-2">
              <Button variant="outline" className="h-8 text-xs font-semibold border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10" onClick={handleClockIn}>
                WFH Clock In
              </Button>
              <Button variant="outline" className="h-8 text-xs font-semibold border-red-500/20 text-red-600 hover:bg-red-500/10" onClick={handleClockOut}>
                WFH Clock Out
              </Button>
            </div>
          );
        })()}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Present Today", value: stats.total_employees - stats.on_leave, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Absent", value: 0, color: "text-red-500", bg: "bg-red-500/10" },
            { label: "On Leave", value: stats.on_leave, color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "Avg Attendance", value: `${stats.avg_attendance}%`, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Total Profiles", value: stats.total_employees, color: "text-foreground", bg: "bg-muted/40" },
          ].map((s, i) => (
            <div key={s.label} className={`glass-panel p-4 rounded-xl border text-center ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading && attendance.length === 0 && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

      {!loading && (
        <div className="glass-panel rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4 text-center">Hours Worked</th>
                  <th className="px-6 py-4">Punch Method</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attendance.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No attendance records generated yet.</td></tr>
                ) : attendance.map((att) => (
                  <tr key={att.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground leading-tight">{att.employee_name}</p>
                      <p className="text-[10px] text-muted-foreground">{att.employee_code}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{formatTime(att.check_in)}</td>
                    <td className="px-6 py-4 font-mono text-xs">{formatTime(att.check_out)}</td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">{att.hours_worked ? `${att.hours_worked} hrs` : "—"}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-secondary text-xs font-semibold capitalize">
                        {methodIcon(att.method)} <span className="ml-0.5">{att.method}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${attStatusStyle(att.status)}`}>{att.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-700 hover:bg-red-500/10" onClick={() => handleDeleteRecord(att.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
