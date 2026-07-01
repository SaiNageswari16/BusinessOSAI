import React from "react";
import { motion } from "framer-motion";
import { Plus, Clock, CheckCircle, AlertTriangle, XCircle, Fingerprint, Camera, MapPin, RefreshCw } from "lucide-react";
import { useHrmsData } from "@/hooks/useHrmsData";

interface Props { tab?: string; }

const attStatusStyle = (s: string) => {
  switch (s) {
    case "Present": return "bg-emerald-500/10 text-emerald-500";
    case "Late": return "bg-amber-500/10 text-amber-500";
    case "Absent": return "bg-red-500/10 text-red-500";
    case "Half Day": return "bg-blue-500/10 text-blue-500";
    case "On Leave": return "bg-purple-500/10 text-purple-500";
    default: return "bg-muted text-muted-foreground";
  }
};

const methodIcon = (m: string) => {
  switch (m) {
    case "Biometric": return <Fingerprint className="size-3" />;
    case "Face": return <Camera className="size-3" />;
    case "GPS": return <MapPin className="size-3" />;
    default: return <Clock className="size-3" />;
  }
};

export function AttendanceManagement({ tab = "daily_attendance" }: Props) {
  const { mockAttendance } = useHrmsData();

  if (tab === "biometric") {
    const devices = [
      { id: "BIO-01", location: "Main Entrance – SF HQ", model: "ZKTeco F22", employees: 94, lastSync: "2026-07-01 09:05", status: "Online" },
      { id: "BIO-02", location: "Warehouse Gate – Oakland", model: "Suprema BioEntry W2", employees: 30, lastSync: "2026-07-01 07:58", status: "Online" },
      { id: "BIO-03", location: "Server Room – Data Center", model: "ZKTeco SpeedFace V5L", employees: 8, lastSync: "2026-07-01 08:45", status: "Online" },
      { id: "BIO-04", location: "Back Office – Floor 3", model: "Anviz W1", employees: 22, lastSync: "2026-06-30 18:00", status: "Offline" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Biometric Devices</h1><p className="text-sm text-muted-foreground">Fingerprint and biometric device status across all locations.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><RefreshCw className="size-4" /> Sync All</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`glass-panel p-6 rounded-xl border ${d.status === "Online" ? "border-emerald-500/20" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-500/10 rounded-xl"><Fingerprint className="size-6 text-indigo-500" /></div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${d.status === "Online" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>{d.status}</span>
              </div>
              <h3 className="font-semibold text-foreground mb-1">{d.location}</h3>
              <p className="text-xs text-muted-foreground mb-4">Model: {d.model}</p>
              <div className="grid grid-cols-2 gap-3 text-sm border-t border-border/50 pt-4">
                <div><p className="text-muted-foreground text-xs">Enrolled</p><p className="font-bold">{d.employees} emp.</p></div>
                <div><p className="text-muted-foreground text-xs">Last Sync</p><p className="font-medium">{d.lastSync}</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "face_recognition") {
    const logs = [
      { id: "FR-001", employee: "Sarah Mitchell", time: "09:45:12", confidence: 98.2, location: "Main Entrance", action: "Check-In", status: "Verified" },
      { id: "FR-002", employee: "Kevin Park", time: "08:55:04", confidence: 99.1, location: "Main Entrance", action: "Check-In", status: "Verified" },
      { id: "FR-003", employee: "Unknown", time: "11:22:40", confidence: 42.0, location: "Back Office", action: "Check-In", status: "Failed" },
      { id: "FR-004", employee: "Aisha Patel", time: "10:00:31", confidence: 96.8, location: "Remote Login", action: "Check-In", status: "Verified" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Face Recognition Logs</h1><p className="text-sm text-muted-foreground">Real-time face recognition attendance events for today.</p></div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg text-sm font-medium">
            <div className="size-2 bg-emerald-500 rounded-full animate-pulse" /> Live
          </div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Event ID</th>
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 text-right font-medium">Confidence</th>
                  <th className="px-6 py-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-primary">{log.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{log.employee}</td>
                    <td className="px-6 py-4 font-mono text-sm">{log.time}</td>
                    <td className="px-6 py-4 text-muted-foreground">{log.location}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded text-xs">{log.action}</span></td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${log.confidence >= 90 ? "text-emerald-500" : "text-red-500"}`}>{log.confidence}%</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${log.status === "Verified" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>{log.status}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "gps_attendance") {
    const gpsLogs = [
      { employee: "Kevin Park", checkIn: "08:55", location: "Austin, TX (Home Office)", lat: "30.2672", lng: "-97.7431", distance: "0.1 km from registered", status: "Present" },
      { employee: "Aisha Patel", checkIn: "10:00", location: "New York, NY (Home Office)", lat: "40.7128", lng: "-74.0060", distance: "0.4 km from registered", status: "Present" },
      { employee: "Linda Torres", checkIn: "09:10", location: "SF Retail Store #2", lat: "37.7749", lng: "-122.4194", distance: "0.0 km from registered", status: "Present" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">GPS Attendance</h1><p className="text-sm text-muted-foreground">Location-verified check-ins for remote and field employees.</p></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[{ label: "GPS Check-Ins Today", value: 3 }, { label: "Within Geo-Fence", value: 3 }, { label: "Outside Zone", value: 0 }].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50">
              <p className="text-xs text-muted-foreground mb-2">{s.label}</p>
              <p className="text-3xl font-bold text-foreground">{s.value}</p>
            </motion.div>
          ))}
        </div>
        <div className="space-y-3">
          {gpsLogs.map((log, i) => (
            <motion.div key={log.employee} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border border-border/50 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-green-500/10 rounded-lg"><MapPin className="size-5 text-green-500" /></div>
                <div>
                  <p className="font-semibold text-foreground">{log.employee}</p>
                  <p className="text-xs text-muted-foreground">{log.location}</p>
                  <p className="text-xs text-muted-foreground">Lat {log.lat}, Lng {log.lng} · {log.distance}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold">{log.checkIn}</p>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-xs">{log.status}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "shift_attendance") {
    const shifts = [
      { shift: "Morning Shift", time: "07:00 – 15:00", employees: 30, present: 28, absent: 1, late: 1 },
      { shift: "General Shift", time: "09:00 – 18:00", employees: 74, present: 68, absent: 3, late: 3 },
      { shift: "Evening Shift", time: "15:00 – 23:00", employees: 12, present: 11, absent: 0, late: 1 },
      { shift: "Night Shift", time: "23:00 – 07:00", employees: 8, present: 8, absent: 0, late: 0 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Shift Attendance</h1><p className="text-sm text-muted-foreground">Attendance summary broken down by shift for today.</p></div>
        </div>
        <div className="space-y-4">
          {shifts.map((s, i) => (
            <motion.div key={s.shift} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{s.shift}</h3>
                  <p className="text-sm text-muted-foreground">{s.time} · {s.employees} employees</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-500">{Math.round(s.present / s.employees * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Attendance</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-emerald-500/10 rounded-lg"><p className="text-xs text-muted-foreground">Present</p><p className="font-bold text-emerald-500 text-xl">{s.present}</p></div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg"><p className="text-xs text-muted-foreground">Absent</p><p className="font-bold text-red-500 text-xl">{s.absent}</p></div>
                <div className="text-center p-3 bg-amber-500/10 rounded-lg"><p className="text-xs text-muted-foreground">Late</p><p className="font-bold text-amber-500 text-xl">{s.late}</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "attendance_corrections") {
    const corrections = [
      { id: "COR-001", employee: "Priya Sharma", date: "2026-06-28", original: "Absent", corrected: "Present (WFH)", reason: "System error – VPN log available", submittedBy: "Priya Sharma", status: "Approved" },
      { id: "COR-002", employee: "Marcus Johnson", date: "2026-06-30", original: "Check-Out: 18:00", corrected: "Check-Out: 20:30", reason: "Forgot to punch out – overtime confirmed by manager", submittedBy: "Marcus Johnson", status: "Pending" },
      { id: "COR-003", employee: "Linda Torres", date: "2026-06-25", original: "Late", corrected: "Present", reason: "Traffic delay – documented", submittedBy: "James Thompson", status: "Rejected" },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Attendance Corrections</h1><p className="text-sm text-muted-foreground">Requests to correct missed check-ins and attendance errors.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> New Correction</button>
        </div>
        <div className="space-y-4">
          {corrections.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm text-primary">{c.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === "Approved" ? "bg-emerald-500/10 text-emerald-500" : c.status === "Pending" ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"}`}>{c.status}</span>
                  </div>
                  <p className="font-semibold text-foreground">{c.employee} <span className="font-normal text-muted-foreground text-sm">· {c.date}</span></p>
                  <p className="text-sm text-muted-foreground mt-1">Change: <span className="line-through text-red-400">{c.original}</span> → <span className="text-emerald-500 font-medium">{c.corrected}</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Reason: {c.reason}</p>
                </div>
                {c.status === "Pending" && (
                  <div className="flex gap-2 ml-4">
                    <button className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs hover:bg-emerald-600">Approve</button>
                    <button className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20">Reject</button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Default: daily_attendance
  const summary = { present: 7, absent: 1, late: 1, halfDay: 1, onLeave: 1 };
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Daily Attendance</h1><p className="text-sm text-muted-foreground">Attendance overview for July 1, 2026.</p></div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Manual Entry</button>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Present", value: summary.present, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Absent", value: summary.absent, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Late", value: summary.late, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Half Day", value: summary.halfDay, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "On Leave", value: summary.onLeave, color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`glass-panel p-5 rounded-xl border border-border/50 ${s.bg} text-center`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Check In</th>
                <th className="px-6 py-4 font-medium">Check Out</th>
                <th className="px-6 py-4 text-center font-medium">Hours</th>
                <th className="px-6 py-4 font-medium">Method</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockAttendance.map((att, i) => (
                <motion.tr key={att.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-foreground">{att.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{att.employeeId}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm">{att.checkIn || "—"}</td>
                  <td className="px-6 py-4 font-mono text-sm">{att.checkOut || "—"}</td>
                  <td className="px-6 py-4 text-center font-medium">{att.hoursWorked > 0 ? `${att.hoursWorked}h` : "—"}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/50 rounded-md text-xs">
                      {methodIcon(att.method)} {att.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${attStatusStyle(att.status)}`}>{att.status}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
