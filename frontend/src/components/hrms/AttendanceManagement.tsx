import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Clock, CheckCircle, AlertTriangle, XCircle, Fingerprint, Camera, MapPin, RefreshCw, Loader2, Play, AlertCircle, Trash2, Calendar as CalendarIcon, LayoutList, SlidersHorizontal, Shield, Globe, LocateFixed, Building2, Check, Sparkles, Navigation, Settings, Users, Search, UserCheck, Layers, CheckSquare, QrCode, Briefcase, Filter, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { attendanceApi, attendanceSchemesApi, employeesApi, departmentsApi, teamsApi, AttendanceRecord, BiometricDevice, FaceRecognitionLog, AttendanceCorrection, HrmsDashboardStats, Employee, Department, Team, workCalendarsApi, AttendanceSettings, AttendanceScheme, EmployeeAttendanceSchemeAssignment } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCurrency } from "@/hooks/use-currency";
import { AttendanceCalendarView } from "./AttendanceCalendarView";
import { ShiftRosterCalendar } from "./ShiftRosterCalendar";

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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
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

  // Attendance Schemes & Multi-Scheme Assignment State
  const [schemes, setSchemes] = useState<AttendanceScheme[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string | null>(null);
  const [empSearchQuery, setEmpSearchQuery] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("");
  const [empTeamFilter, setEmpTeamFilter] = useState("");
  const [newSchemeDialogOpen, setNewSchemeDialogOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<AttendanceScheme | null>(null);
  
  // Scheme form configuration state
  const [schemeForm, setSchemeForm] = useState({
    name: "General Regular Shift",
    code: "SCH-REG",
    description: "Standard morning shift schedule",
    shift_start_time: "09:00",
    shift_end_time: "18:00",
    grace_period_minutes: 15,
    half_day_hours: 4.0,
    full_day_hours: 8.0,
    overtime_allowed: true,
    overtime_min_minutes: 60,
    working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"] as string[],
    latitude: 17.372998,
    longitude: 78.521062,
    geofence_radius_meters: 100,
    enforce_geofence: true,
    allowed_punch_methods: ["GPS", "Biometric", "Face", "Web", "QR"] as string[],
    ip_whitelist: "",
    is_default: false
  });

  // Employee Multi-Scheme Assignment Map: empId -> { is_assigned, is_primary, days_of_week, effective_from, effective_to }
  const [assignmentMap, setAssignmentMap] = useState<Record<string, { is_assigned: boolean; is_primary: boolean; days_of_week: string[]; effective_from?: string; effective_to?: string }>>({});

  // Employee Multi-Scheme Details Modal
  const [selectedEmpForSchemeDetail, setSelectedEmpForSchemeDetail] = useState<Employee | null>(null);
  const [empAssignedSchemes, setEmpAssignedSchemes] = useState<EmployeeAttendanceSchemeAssignment[]>([]);
  const [loadingEmpSchemes, setLoadingEmpSchemes] = useState(false);

  const [settings, setSettings] = useState<AttendanceSettings>({
    branch_name: "Warangal",
    latitude: 17.372998,
    longitude: 78.521062,
    geofence_radius_meters: 50,
    enforce_geofence: true,
    allowed_punch_methods: ["GPS", "Biometric", "Face", "Web"],
    shift_start_time: "09:00",
    shift_end_time: "18:00",
    grace_period_minutes: 15,
    half_day_hours: 4.0,
    ip_whitelist: "",
    assigned_employee_ids: [],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState("");

  // View Mode: Table vs Interactive Monthly Calendar Grid
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>("");

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

  // Manual / Custom punch dialog state
  const [manualPunchDialogOpen, setManualPunchDialogOpen] = useState(false);
  const [manualPunchForm, setManualPunchForm] = useState({
    employee_id: "",
    date: new Date().toISOString().split("T")[0],
    check_in: "09:00",
    check_out: "18:00",
    method: "Manual",
    status: "Present",
    notes: "Direct administrative timesheet record"
  });

  // Biometric simulation & device states
  const [bioSimDialogOpen, setBioSimDialogOpen] = useState(false);
  const [bioSimForm, setBioSimForm] = useState({
    employee_id: "",
    device_id: "",
    action: "Check-In",
    punch_type: "Fingerprint"
  });
  const [addDeviceDialogOpen, setAddDeviceDialogOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    device_code: "",
    location: "",
    model: "ZKTeco SilkBio-101TC",
    enrolled_employees: 0,
    status: "Online"
  });

  // GPS punch simulator states
  const [gpsPunchDialogOpen, setGpsPunchDialogOpen] = useState(false);
  const [gpsPunchForm, setGpsPunchForm] = useState({
    employee_id: "",
    preset: "San Francisco HQ (100 Innovation Blvd)",
    latitude: 37.7749,
    longitude: -122.4194,
    action: "Check-In",
    notes: "Geofence verified corporate radius punch"
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

  const loadSettings = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [res, schemesRes, empRes, deptsRes, teamsRes] = await Promise.all([
        attendanceApi.getSettings(),
        attendanceSchemesApi.list().catch(() => []),
        employeesApi.list(1, 200).catch(() => ({ items: [] })),
        departmentsApi.list(1, 100).catch(() => ({ items: [] })),
        teamsApi.list(1, 100).catch(() => ({ items: [] })),
      ]);

      if (empRes?.items) {
        setEmployees(empRes.items);
      }
      if (deptsRes?.items) {
        setDepartments(deptsRes.items);
      }
      if (teamsRes?.items) {
        setTeams(teamsRes.items);
      }
      if (schemesRes && schemesRes.length > 0) {
        setSchemes(schemesRes);
        const activeScheme = schemesRes.find((s: AttendanceScheme) => s.id === selectedSchemeId) || schemesRes[0];
        if (activeScheme) {
          setSelectedSchemeId(activeScheme.id);
          populateSchemeData(activeScheme, empRes?.items || []);
        }
      }
      if (res) {
        setSettings(res);
      }
    } catch (e: any) {
      console.error("Failed to load attendance settings", e);
    } finally {
      setLoading(false);
    }
  }, [selectedSchemeId]);

  const populateSchemeData = (sch: AttendanceScheme, empList: Employee[]) => {
    setSchemeForm({
      name: sch.name,
      code: sch.code || "",
      description: sch.description || "",
      shift_start_time: sch.shift_start_time || "09:00",
      shift_end_time: sch.shift_end_time || "18:00",
      grace_period_minutes: sch.grace_period_minutes ?? 15,
      half_day_hours: sch.half_day_hours ?? 4.0,
      full_day_hours: sch.full_day_hours ?? 8.0,
      overtime_allowed: sch.overtime_allowed ?? true,
      overtime_min_minutes: sch.overtime_min_minutes ?? 60,
      working_days: sch.working_days && sch.working_days.length > 0 ? sch.working_days : ["Mon", "Tue", "Wed", "Thu", "Fri"],
      latitude: sch.latitude ?? 17.372998,
      longitude: sch.longitude ?? 78.521062,
      geofence_radius_meters: sch.geofence_radius_meters ?? 100,
      enforce_geofence: sch.enforce_geofence ?? true,
      allowed_punch_methods: sch.allowed_punch_methods || ["GPS", "Biometric", "Face", "Web", "QR"],
      ip_whitelist: sch.ip_whitelist || "",
      is_default: sch.is_default ?? false
    });

    // Populate assignment mapping
    const map: Record<string, { is_assigned: boolean; is_primary: boolean; days_of_week: string[]; effective_from?: string; effective_to?: string }> = {};
    const assignedIds = new Set(sch.assigned_employee_ids || []);

    empList.forEach(emp => {
      const isAssigned = assignedIds.has(emp.id);
      map[emp.id] = {
        is_assigned: isAssigned,
        is_primary: true, // Default to primary regular shift
        days_of_week: sch.working_days || ["Mon", "Tue", "Wed", "Thu", "Fri"]
      };
    });
    setAssignmentMap(map);
  };

  const handleSelectScheme = (sch: AttendanceScheme) => {
    setSelectedSchemeId(sch.id);
    populateSchemeData(sch, employees);
  };

  const handleToggleEmployeeAssignment = (empId: string) => {
    setAssignmentMap(prev => {
      const current = prev[empId] || { is_assigned: false, is_primary: true, days_of_week: schemeForm.working_days };
      return {
        ...prev,
        [empId]: {
          ...current,
          is_assigned: !current.is_assigned
        }
      };
    });
  };

  const handleToggleEmployeePrimary = (empId: string) => {
    setAssignmentMap(prev => {
      const current = prev[empId] || { is_assigned: true, is_primary: true, days_of_week: schemeForm.working_days };
      return {
        ...prev,
        [empId]: {
          ...current,
          is_primary: !current.is_primary
        }
      };
    });
  };

  const handleSelectAllEmployees = () => {
    setAssignmentMap(prev => {
      const next = { ...prev };
      employees.forEach(emp => {
        next[emp.id] = {
          ...(next[emp.id] || { is_primary: true, days_of_week: schemeForm.working_days }),
          is_assigned: true
        };
      });
      return next;
    });
  };

  const handleDeselectAllEmployees = () => {
    setAssignmentMap(prev => {
      const next = { ...prev };
      employees.forEach(emp => {
        if (next[emp.id]) {
          next[emp.id].is_assigned = false;
        }
      });
      return next;
    });
  };

  const handleAssignDepartment = (deptId: string) => {
    if (!deptId) return;
    const deptEmps = employees.filter(e => e.department_id === deptId);
    setAssignmentMap(prev => {
      const next = { ...prev };
      deptEmps.forEach(emp => {
        next[emp.id] = {
          ...(next[emp.id] || { is_primary: true, days_of_week: schemeForm.working_days }),
          is_assigned: true
        };
      });
      return next;
    });
  };

  const handleAssignTeam = (teamId: string) => {
    if (!teamId) return;
    const targetTeam = teams.find(t => t.id === teamId);
    if (!targetTeam) return;
    const teamEmpIds = new Set(targetTeam.member_employee_ids || []);
    if (targetTeam.lead_employee_id) teamEmpIds.add(targetTeam.lead_employee_id);

    const teamEmps = employees.filter(e => 
      teamEmpIds.has(e.id) || 
      (e.user_id && targetTeam.lead_user_id === e.user_id) || 
      targetTeam.lead_user_id === e.id || 
      (e as any).team_id === teamId
    );
    setAssignmentMap(prev => {
      const next = { ...prev };
      teamEmps.forEach(emp => {
        next[emp.id] = {
          ...(next[emp.id] || { is_primary: true, days_of_week: schemeForm.working_days }),
          is_assigned: true
        };
      });
      return next;
    });
  };

  const getDeptName = (deptId?: string | null) => {
    if (!deptId) return null;
    return departments.find(d => d.id === deptId)?.name || null;
  };

  const getEmpTeams = (empItem: Employee) => {
    return teams.filter(t => 
      t.member_employee_ids?.includes(empItem.id) || 
      t.lead_employee_id === empItem.id ||
      (empItem.user_id && t.lead_user_id === empItem.user_id) ||
      t.lead_user_id === empItem.id ||
      (empItem as any).team_id === t.id
    );
  };

  const handleOpenCreateSchemeModal = () => {
    setEditingScheme(null);
    setSchemeForm({
      name: "",
      code: "",
      description: "",
      shift_start_time: "09:00",
      shift_end_time: "18:00",
      grace_period_minutes: 15,
      half_day_hours: 4.0,
      full_day_hours: 8.0,
      overtime_allowed: true,
      overtime_min_minutes: 60,
      working_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      latitude: 17.372998,
      longitude: 78.521062,
      geofence_radius_meters: 100,
      enforce_geofence: true,
      allowed_punch_methods: ["GPS", "Biometric", "Face", "Web", "QR"],
      ip_whitelist: "",
      is_default: false
    });
    setNewSchemeDialogOpen(true);
  };

  const handleCreateNewScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schemeForm.name.trim()) return;
    try {
      const created = await attendanceSchemesApi.create({
        name: schemeForm.name.trim(),
        code: schemeForm.code.trim() || undefined,
        description: schemeForm.description || undefined,
        shift_start_time: schemeForm.shift_start_time,
        shift_end_time: schemeForm.shift_end_time,
        grace_period_minutes: schemeForm.grace_period_minutes,
        half_day_hours: schemeForm.half_day_hours,
        full_day_hours: schemeForm.full_day_hours,
        overtime_allowed: schemeForm.overtime_allowed,
        overtime_min_minutes: schemeForm.overtime_min_minutes,
        working_days: schemeForm.working_days,
        latitude: schemeForm.latitude,
        longitude: schemeForm.longitude,
        geofence_radius_meters: schemeForm.geofence_radius_meters,
        enforce_geofence: schemeForm.enforce_geofence,
        allowed_punch_methods: schemeForm.allowed_punch_methods,
        ip_whitelist: schemeForm.ip_whitelist || undefined,
        is_default: schemeForm.is_default
      });
      setNewSchemeDialogOpen(false);
      setSettingsSuccess(`Created new Attendance Scheme '${created.name}'!`);
      const refreshed = await attendanceSchemesApi.list().catch(() => []);
      setSchemes(refreshed);
      setSelectedSchemeId(created.id);
      populateSchemeData(created, employees);
    } catch (err: any) {
      alert("Failed to create scheme: " + (err.message || "Unknown error"));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess("");
    try {
      if (!selectedSchemeId) {
        throw new Error("No attendance scheme selected");
      }

      // 1. Update Scheme Details
      await attendanceSchemesApi.update(selectedSchemeId, {
        name: schemeForm.name,
        code: schemeForm.code,
        description: schemeForm.description,
        shift_start_time: schemeForm.shift_start_time,
        shift_end_time: schemeForm.shift_end_time,
        grace_period_minutes: schemeForm.grace_period_minutes,
        half_day_hours: schemeForm.half_day_hours,
        full_day_hours: schemeForm.full_day_hours,
        overtime_allowed: schemeForm.overtime_allowed,
        overtime_min_minutes: schemeForm.overtime_min_minutes,
        working_days: schemeForm.working_days,
        latitude: schemeForm.latitude,
        longitude: schemeForm.longitude,
        geofence_radius_meters: schemeForm.geofence_radius_meters,
        enforce_geofence: schemeForm.enforce_geofence,
        allowed_punch_methods: schemeForm.allowed_punch_methods,
        ip_whitelist: schemeForm.ip_whitelist,
        is_default: schemeForm.is_default
      });

      // 2. Multi-Scheme Employee Assignments
      const activeAssignments = Object.entries(assignmentMap)
        .filter(([_, config]) => config.is_assigned)
        .map(([empId, config]) => ({
          employee_id: empId,
          is_primary: config.is_primary,
          days_of_week: config.days_of_week,
          effective_from: config.effective_from,
          effective_to: config.effective_to
        }));

      const assignRes = await attendanceSchemesApi.assign(selectedSchemeId, {
        employee_assignments: activeAssignments
      });

      setSettingsSuccess(`Scheme '${schemeForm.name}' updated with ${assignRes.assigned_count} employee multi-scheme assignment(s)!`);
      const refreshedSchemes = await attendanceSchemesApi.list().catch(() => []);
      setSchemes(refreshedSchemes);
      setTimeout(() => setSettingsSuccess(""), 6000);
    } catch (err: any) {
      alert("Failed to save scheme: " + (err.message || "Unknown error"));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteScheme = async (schemeId: string, schemeName: string) => {
    if (!window.confirm(`Are you sure you want to delete Attendance Scheme '${schemeName}'? This will remove all assigned employee rotation schedules for this scheme.`)) return;
    try {
      await attendanceSchemesApi.delete(schemeId);
      setSettingsSuccess(`Attendance Scheme '${schemeName}' deleted.`);
      const refreshed = await attendanceSchemesApi.list().catch(() => []);
      setSchemes(refreshed);
      if (refreshed.length > 0) {
        setSelectedSchemeId(refreshed[0].id);
        populateSchemeData(refreshed[0], employees);
      }
    } catch (err: any) {
      alert("Failed to delete scheme: " + (err.message || "Unknown error"));
    }
  };

  const handleOpenEmployeeSchemes = async (emp: Employee) => {
    setSelectedEmpForSchemeDetail(emp);
    setLoadingEmpSchemes(true);
    try {
      const res = await attendanceSchemesApi.getEmployeeSchemes(emp.id);
      setEmpAssignedSchemes(res.schemes || []);
    } catch (err) {
      console.error("Failed to load employee schemes", err);
      setEmpAssignedSchemes([]);
    } finally {
      setLoadingEmpSchemes(false);
    }
  };

  const handleDetectSettingsGps = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSchemeForm(s => ({
            ...s,
            latitude: parseFloat(pos.coords.latitude.toFixed(6)),
            longitude: parseFloat(pos.coords.longitude.toFixed(6)),
          }));
          alert(`GPS Coordinates detected accurately (±${Math.round(pos.coords.accuracy)}m accuracy): ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        },
        (err) => {
          alert("Location access denied or unavailable: " + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  useEffect(() => {
    if (tab === "daily_attendance" || tab === "gps_attendance") {
      loadDailyAttendance();
    } else if (tab === "attendance_settings") {
      loadSettings();
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
  }, [tab, loadDailyAttendance, loadSettings, loadShiftsData, loadBiometric, loadFaceLogs, loadCorrections]);

  // Load employees, departments, and teams list for filters and simulators
  const loadEmployeesList = useCallback(async () => {
    try {
      const [empRes, deptsRes, teamsRes] = await Promise.all([
        employeesApi.list(1, 200).catch(() => ({ items: [] })),
        departmentsApi.list(1, 100).catch(() => ({ items: [] })),
        teamsApi.list(1, 100).catch(() => ({ items: [] })),
      ]);
      if (empRes?.items) setEmployees(empRes.items);
      if (deptsRes?.items) setDepartments(deptsRes.items);
      if (teamsRes?.items) setTeams(teamsRes.items);
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

  // Manual / Custom punch handler
  const handleManualPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPunchForm.employee_id) {
      alert("Please select an employee profile.");
      return;
    }
    setLoading(true);
    try {
      const checkInIso = manualPunchForm.check_in ? `${manualPunchForm.date}T${manualPunchForm.check_in}:00` : undefined;
      const checkOutIso = manualPunchForm.check_out ? `${manualPunchForm.date}T${manualPunchForm.check_out}:00` : undefined;
      
      await attendanceApi.create({
        employee_id: manualPunchForm.employee_id,
        date: manualPunchForm.date,
        check_in: checkInIso,
        check_out: checkOutIso,
        method: manualPunchForm.method,
        status: manualPunchForm.status,
        notes: manualPunchForm.notes
      });
      setManualPunchDialogOpen(false);
      await loadDailyAttendance();
      alert("Attendance record punched and verified successfully!");
    } catch (err: any) {
      alert("Failed to punch attendance: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Simulate Biometric Punch
  const handleSimulateBiometric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bioSimForm.employee_id || !bioSimForm.device_id) {
      alert("Please choose both an employee and a biometric scanner device.");
      return;
    }
    setLoading(true);
    try {
      const dev = biometricDevices.find(d => d.id === bioSimForm.device_id);
      const devName = dev ? `${dev.location} (${dev.device_code})` : "Biometric Gateway";
      const isOut = bioSimForm.action === "Check-Out";

      if (isOut) {
        await attendanceApi.checkOut({
          employee_id: bioSimForm.employee_id,
          notes: `Verified ${bioSimForm.punch_type} scan at ${devName}`
        });
      } else {
        await attendanceApi.checkIn({
          employee_id: bioSimForm.employee_id,
          method: "Biometric",
          notes: `Verified ${bioSimForm.punch_type} punch at ${devName}`
        });
      }
      setBioSimDialogOpen(false);
      await loadDailyAttendance();
      await loadBiometric();
      alert(`Biometric ${bioSimForm.action} verified & clocked successfully via ${devName}!`);
    } catch (err: any) {
      alert("Biometric punch simulation failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add Biometric Device
  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceForm.device_code || !deviceForm.location) return;
    setLoading(true);
    try {
      await attendanceApi.createBiometric({
        device_code: deviceForm.device_code,
        location: deviceForm.location,
        model: deviceForm.model,
        enrolled_employees: Number(deviceForm.enrolled_employees) || 0,
        status: deviceForm.status
      });
      setAddDeviceDialogOpen(false);
      setDeviceForm({ device_code: "", location: "", model: "ZKTeco SilkBio-101TC", enrolled_employees: 0, status: "Online" });
      await loadBiometric();
    } catch (err: any) {
      alert("Failed to create biometric device: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Biometric Device
  const handleDeleteDevice = async (id: string) => {
    if (!confirm("Are you sure you want to remove this biometric terminal?")) return;
    try {
      await attendanceApi.deleteBiometric(id);
      await loadBiometric();
    } catch (err: any) {
      alert("Failed to delete biometric device: " + err.message);
    }
  };

  // Simulate GPS Geofence Punch
  const handleSimulateGpsPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpsPunchForm.employee_id) {
      alert("Please select an employee profile.");
      return;
    }
    setLoading(true);
    try {
      const isOut = gpsPunchForm.action === "Check-Out";
      if (isOut) {
        await attendanceApi.checkOut({
          employee_id: gpsPunchForm.employee_id,
          latitude: gpsPunchForm.latitude,
          longitude: gpsPunchForm.longitude,
          notes: `${gpsPunchForm.preset} • ${gpsPunchForm.notes}`
        });
      } else {
        await attendanceApi.checkIn({
          employee_id: gpsPunchForm.employee_id,
          latitude: gpsPunchForm.latitude,
          longitude: gpsPunchForm.longitude,
          method: "GPS",
          notes: `${gpsPunchForm.preset} • ${gpsPunchForm.notes}`
        });
      }
      setGpsPunchDialogOpen(false);
      await loadDailyAttendance();
      alert(`GPS Geofenced ${gpsPunchForm.action} verified & recorded successfully!`);
    } catch (err: any) {
      alert("GPS punch failed: " + err.message);
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
            <p className="text-xs text-muted-foreground">Fingerprint, access turnstiles, and RFID keycard hardware terminals.</p>
          </div>
          <div className="flex gap-2">
            <Button
              className="h-8 text-xs font-semibold gradient-brand text-white border-0"
              onClick={() => setBioSimDialogOpen(true)}
            >
              <Fingerprint className="size-3.5 mr-1.5" /> Biometric Terminal Check-In
            </Button>
            <Button
              variant="outline"
              className="h-8 text-xs font-semibold"
              onClick={() => setAddDeviceDialogOpen(true)}
            >
              <Plus className="size-3.5 mr-1.5" /> Add Terminal
            </Button>
            <Button className="h-8 text-xs font-semibold" variant="secondary" onClick={handleSyncBiometric} disabled={syncingBiometrics}>
              {syncingBiometrics ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5" />}
              Sync Active Devices
            </Button>
          </div>
        </div>

        {loading && biometricDevices.length === 0 && <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {biometricDevices.map((device, i) => (
            <motion.div key={device.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={`glass-panel p-6 rounded-xl border ${device.status === "Online" ? "border-emerald-500/25 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary/10 rounded-xl"><Fingerprint className="size-6 text-primary" /></div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${device.status === "Online" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                    {device.status}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-7 p-0 text-muted-foreground hover:text-red-500"
                    onClick={() => handleDeleteDevice(device.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
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

        {/* ─── SIMULATE BIOMETRIC PUNCH DIALOG ───────────────────────── */}
        {bioSimDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Fingerprint className="size-5 text-indigo-500" /> Simulate Biometric Terminal Punch
                </h3>
                <button onClick={() => setBioSimDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>
              <form onSubmit={handleSimulateBiometric} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee Profile</label>
                  <select
                    value={bioSimForm.employee_id}
                    onChange={e => setBioSimForm(p => ({ ...p, employee_id: e.target.value }))}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Biometric Device Terminal</label>
                  <select
                    value={bioSimForm.device_id}
                    onChange={e => setBioSimForm(p => ({ ...p, device_id: e.target.value }))}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    required
                  >
                    <option value="">-- Select Terminal Scanner --</option>
                    {biometricDevices.map(d => (
                      <option key={d.id} value={d.id}>{d.location} [{d.device_code} - {d.model}]</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Punch Action</label>
                    <select
                      value={bioSimForm.action}
                      onChange={e => setBioSimForm(p => ({ ...p, action: e.target.value }))}
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    >
                      <option>Check-In</option>
                      <option>Check-Out</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Scan Technology</label>
                    <select
                      value={bioSimForm.punch_type}
                      onChange={e => setBioSimForm(p => ({ ...p, punch_type: e.target.value }))}
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    >
                      <option>Fingerprint (500 DPI Optical)</option>
                      <option>RFID / NFC Smart Keycard</option>
                      <option>Iris Scanner</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setBioSimDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Fingerprint className="size-4 mr-1.5" />}
                    Punch Biometric
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* ─── ADD BIOMETRIC DEVICE DIALOG ───────────────────────────── */}
        {addDeviceDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Plus className="size-5 text-primary" /> Register Biometric Terminal
                </h3>
                <button onClick={() => setAddDeviceDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>
              <form onSubmit={handleCreateDevice} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Device Code / Terminal ID</label>
                  <Input
                    placeholder="e.g. BIO-05 or GATE-SOUTH"
                    value={deviceForm.device_code}
                    onChange={e => setDeviceForm(p => ({ ...p, device_code: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Physical Location / Gate</label>
                  <Input
                    placeholder="e.g. Floor 4 R&D Lab Entrance"
                    value={deviceForm.location}
                    onChange={e => setDeviceForm(p => ({ ...p, location: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Terminal Model</label>
                    <Input
                      placeholder="e.g. ZKTeco SilkBio-101TC"
                      value={deviceForm.model}
                      onChange={e => setDeviceForm(p => ({ ...p, model: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Enrolled Count</label>
                    <Input
                      type="number"
                      value={deviceForm.enrolled_employees}
                      onChange={e => setDeviceForm(p => ({ ...p, enrolled_employees: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Device Status</label>
                  <select
                    value={deviceForm.status}
                    onChange={e => setDeviceForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  >
                    <option>Online</option>
                    <option>Offline</option>
                    <option>Maintenance</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setAddDeviceDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
                    Register Terminal
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
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
              <Camera className="size-3.5 mr-1.5" /> Face Scanner Verification
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

        {/* Admin Face scanner match dialog */}
        {faceSimDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-card border p-6 space-y-4 shadow-2xl">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Camera className="size-5 text-primary" /> Entrance Face Verification
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
                    Verify Check-In
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Attendance Settings & Multi-Scheme Management ────
  if (tab === "attendance_settings") {
    const assignedCount = Object.values(assignmentMap).filter(v => v.is_assigned).length;

    const filteredEmployees = employees.filter(e => {
      const q = empSearchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_code?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q);

      const matchesDept = !empDeptFilter || e.department_id === empDeptFilter;

      const targetTeam = teams.find(t => t.id === empTeamFilter);
      const matchesTeam = !empTeamFilter || (
        targetTeam?.member_employee_ids?.includes(e.id) ||
        targetTeam?.lead_employee_id === e.id ||
        (e.user_id && targetTeam?.lead_user_id === e.user_id) ||
        targetTeam?.lead_user_id === e.id ||
        (e as any).team_id === empTeamFilter
      );

      return matchesSearch && matchesDept && matchesTeam;
    });

    const activeScheme = schemes.find(s => s.id === selectedSchemeId) || schemes[0];

    const selectedDeptObj = departments.find(d => d.id === empDeptFilter);
    const selectedTeamObj = teams.find(t => t.id === empTeamFilter);

    const handleAssignFiltered = () => {
      setAssignmentMap(prev => {
        const next = { ...prev };
        filteredEmployees.forEach(emp => {
          next[emp.id] = {
            ...(next[emp.id] || { is_primary: true, days_of_week: schemeForm.working_days }),
            is_assigned: true
          };
        });
        return next;
      });
    };

    const handleDeselectFiltered = () => {
      setAssignmentMap(prev => {
        const next = { ...prev };
        filteredEmployees.forEach(emp => {
          if (next[emp.id]) {
            next[emp.id].is_assigned = false;
          }
        });
        return next;
      });
    };

    return (
      <div className="space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Attendance Schemes & Multi-Shift Rotations</h2>
            <p className="text-xs text-muted-foreground">Configure shift timings, grace thresholds, overtime policies, GPS perimeter fences, and assign rotational schemes by department, team, or employee.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenCreateSchemeModal}
              className="text-xs font-semibold"
            >
              <Plus className="size-3.5 mr-1.5 text-primary" /> + Create New Scheme
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDetectSettingsGps}
              className="text-xs font-semibold"
            >
              <LocateFixed className="size-3.5 mr-1.5 text-primary" /> Auto-Detect GPS
            </Button>
            <Button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="gradient-brand text-white border-0 text-xs font-semibold h-9 px-4 shadow-md"
            >
              {savingSettings ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Check className="size-3.5 mr-1.5" />}
              Save Scheme & Multi-Assignments
            </Button>
          </div>
        </div>

        {/* ─── Schemes Selector Ribbon ─── */}
        <div className="p-3.5 bg-muted/40 rounded-2xl border flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mr-1">
              <Layers className="size-4 text-primary" />
              <span>Available Schemes:</span>
            </div>
            {schemes.map(sch => {
              const isSelected = selectedSchemeId === sch.id;
              return (
                <button
                  key={sch.id}
                  type="button"
                  onClick={() => handleSelectScheme(sch)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected 
                      ? "bg-card text-foreground shadow-sm border border-primary/50 font-bold" 
                      : "bg-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground border border-transparent"
                  }`}
                >
                  <Clock className={`size-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{sch.name}</span>
                  {sch.is_default && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-600 font-bold">Default</span>
                  )}
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-primary/10 text-primary font-mono">
                    {sch.shift_start_time || "09:00"} - {sch.shift_end_time || "18:00"}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-muted text-muted-foreground">
                    {sch.assigned_employees_count || 0} Assigned
                  </span>
                </button>
              );
            })}
            {schemes.length === 0 && (
              <span className="text-xs text-muted-foreground italic">No schemes configured. Click "+ Create New Scheme" to get started.</span>
            )}
          </div>

          {activeScheme && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteScheme(activeScheme.id, activeScheme.name)}
              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 text-xs h-7 px-2"
            >
              <Trash2 className="size-3.5 mr-1" /> Delete Scheme
            </Button>
          )}
        </div>

        {settingsSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="size-4" />
            {settingsSuccess}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Scheme Details, Timings, Overtime & Geofencing */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Scheme Metadata & Working Days */}
            <Card className="p-6 space-y-5 glass-panel">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Scheme Configuration</h3>
                    <p className="text-xs text-muted-foreground">Scheme title, identifying code, and scheduled working days.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_default_check"
                    checked={schemeForm.is_default}
                    onChange={e => setSchemeForm(p => ({ ...p, is_default: e.target.checked }))}
                    className="accent-primary"
                  />
                  <label htmlFor="is_default_check" className="text-xs font-bold text-foreground cursor-pointer">
                    Primary Default Scheme
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Scheme Name *</label>
                  <Input
                    value={schemeForm.name}
                    onChange={e => setSchemeForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Regular Day Shift (9am - 6pm)"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Scheme Code</label>
                  <Input
                    value={schemeForm.code}
                    onChange={e => setSchemeForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. SCH-REG-01"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Description / Scope</label>
                <Input
                  value={schemeForm.description}
                  onChange={e => setSchemeForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Applicable for Headquarters and Engineering Team regular hours"
                />
              </div>

              {/* Working Days Selector */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <label className="text-xs font-bold text-muted-foreground uppercase">Working Days in Cycle</label>
                <div className="flex flex-wrap gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                    const isSelected = schemeForm.working_days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setSchemeForm(p => ({
                            ...p,
                            working_days: isSelected
                              ? p.working_days.filter(d => d !== day)
                              : [...p.working_days, day]
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white border-primary shadow-xs"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Shift Timings, Half-Day & Overtime Rules */}
            <Card className="p-6 space-y-5 glass-panel">
              <div className="flex items-center gap-3 border-b pb-4">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Shift Timings & Calculation Rules</h3>
                  <p className="text-xs text-muted-foreground">Standard working window, grace period before marking late, and overtime calculation rules.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Shift Start Time</label>
                  <Input
                    type="time"
                    value={schemeForm.shift_start_time}
                    onChange={e => setSchemeForm(p => ({ ...p, shift_start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Shift End Time</label>
                  <Input
                    type="time"
                    value={schemeForm.shift_end_time}
                    onChange={e => setSchemeForm(p => ({ ...p, shift_end_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Grace Period (Mins)</label>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    value={schemeForm.grace_period_minutes}
                    onChange={e => setSchemeForm(p => ({ ...p, grace_period_minutes: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Minimum Half-Day Threshold (Hours)</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="1"
                    max="12"
                    value={schemeForm.half_day_hours}
                    onChange={e => setSchemeForm(p => ({ ...p, half_day_hours: parseFloat(e.target.value) || 4.0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Full-Day Working Hours</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="4"
                    max="16"
                    value={schemeForm.full_day_hours}
                    onChange={e => setSchemeForm(p => ({ ...p, full_day_hours: parseFloat(e.target.value) || 8.0 }))}
                  />
                </div>
              </div>

              {/* Overtime Policy Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between p-3 rounded-xl border bg-background/50">
                  <div>
                    <label className="text-xs font-bold text-foreground">Allow Overtime (OT)</label>
                    <p className="text-[10px] text-muted-foreground">Calculate extra hours beyond full-day shift</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={schemeForm.overtime_allowed}
                    onChange={e => setSchemeForm(p => ({ ...p, overtime_allowed: e.target.checked }))}
                    className="accent-primary size-4"
                  />
                </div>
                {schemeForm.overtime_allowed && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Min. OT Threshold (Minutes)</label>
                    <Input
                      type="number"
                      min="15"
                      max="300"
                      step="15"
                      value={schemeForm.overtime_min_minutes}
                      onChange={e => setSchemeForm(p => ({ ...p, overtime_min_minutes: parseInt(e.target.value) || 60 }))}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* GPS Geofencing Perimeter & IP Whitelist */}
            <Card className="p-6 space-y-5 glass-panel">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                    <MapPin className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Scheme Geofence & Office Perimeter</h3>
                    <p className="text-xs text-muted-foreground">Define coordinates and allowable distance radius for GPS punches.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">Strict Geofence:</span>
                  <button
                    type="button"
                    onClick={() => setSchemeForm(p => ({ ...p, enforce_geofence: !p.enforce_geofence }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${schemeForm.enforce_geofence ? 'bg-emerald-500' : 'bg-muted'}`}
                  >
                    <span className={`inline-block size-4 transform rounded-full bg-white transition-transform ${schemeForm.enforce_geofence ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-muted-foreground uppercase">GPS Latitude</label>
                    <span className="text-[10px] text-muted-foreground">Degrees N/S</span>
                  </div>
                  <Input
                    type="number"
                    step="0.000001"
                    value={schemeForm.latitude}
                    onChange={e => setSchemeForm(p => ({ ...p, latitude: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-muted-foreground uppercase">GPS Longitude</label>
                    <span className="text-[10px] text-muted-foreground">Degrees E/W</span>
                  </div>
                  <Input
                    type="number"
                    step="0.000001"
                    value={schemeForm.longitude}
                    onChange={e => setSchemeForm(p => ({ ...p, longitude: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-muted-foreground uppercase">
                    Permitted Check-In Radius: <span className="text-primary font-bold text-sm">{schemeForm.geofence_radius_meters} meters</span>
                  </label>
                  <div className="flex gap-1 flex-wrap">
                    {[50, 100, 250, 500, 1000, 2000].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSchemeForm(p => ({ ...p, geofence_radius_meters: r }))}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${schemeForm.geofence_radius_meters === r ? "bg-primary text-white border-primary" : "bg-secondary text-muted-foreground hover:bg-muted"}`}
                      >
                        {r}m
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min="20"
                  max="2000"
                  step="10"
                  value={schemeForm.geofence_radius_meters}
                  onChange={e => setSchemeForm(p => ({ ...p, geofence_radius_meters: parseInt(e.target.value) || 50 }))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* IP Whitelist */}
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Office Wi-Fi / VPN IP Whitelist (Optional)</label>
                  <span className="text-[10px] text-muted-foreground">Comma-separated IPs</span>
                </div>
                <Input
                  value={schemeForm.ip_whitelist}
                  onChange={e => setSchemeForm(p => ({ ...p, ip_whitelist: e.target.value }))}
                  placeholder="e.g. 192.168.1.1, 49.204.10.22, 10.0.0.0/24"
                />
              </div>
            </Card>
          </div>

          {/* Right Column: Multi-Scheme Dynamic Assignment & Channels */}
          <div className="space-y-6">
            
            {/* Multi-Scheme Dynamic Employee Assignment Card */}
            <Card className="p-6 space-y-4 glass-panel border-primary/20">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Multi-Scheme Assignment</h3>
                    <p className="text-[11px] text-muted-foreground">
                      <strong className="text-primary font-bold">{assignedCount}</strong> of {employees.length} employees assigned
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="xs" onClick={handleSelectAllEmployees} className="text-[10px] h-6 px-2">Assign All</Button>
                  <Button type="button" variant="ghost" size="xs" onClick={handleDeselectAllEmployees} className="text-[10px] h-6 px-2 text-muted-foreground">Clear All</Button>
                </div>
              </div>

              {/* Search, Department & Team Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={empSearchQuery}
                    onChange={e => setEmpSearchQuery(e.target.value)}
                    placeholder="Search name, code, or email..."
                    className="pl-8 text-xs h-8"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={empDeptFilter}
                    onChange={e => {
                      const dId = e.target.value;
                      setEmpDeptFilter(dId);
                      if (dId && empTeamFilter) {
                        const tObj = teams.find(t => t.id === empTeamFilter);
                        if (tObj && tObj.department_id && tObj.department_id !== dId) {
                          setEmpTeamFilter("");
                        }
                      }
                    }}
                    className="h-8 px-2 text-xs rounded-md border bg-background text-foreground"
                  >
                    <option value="">🏢 All Departments ({departments.length})</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} {dept.code ? `(${dept.code})` : ""}
                      </option>
                    ))}
                  </select>

                  <select
                    value={empTeamFilter}
                    onChange={e => {
                      const tId = e.target.value;
                      setEmpTeamFilter(tId);
                      if (tId) {
                        const tObj = teams.find(t => t.id === tId);
                        if (tObj?.department_id) {
                          setEmpDeptFilter(tObj.department_id);
                        }
                      }
                    }}
                    className="h-8 px-2 text-xs rounded-md border bg-background text-foreground"
                  >
                    <option value="">👥 All Teams ({teams.length})</option>
                    {teams.map(team => {
                      const parentDept = departments.find(d => d.id === team.department_id);
                      return (
                        <option key={team.id} value={team.id}>
                          {team.name} {parentDept ? `• ${parentDept.name}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Quick Batch Assignment Toolbar */}
                <div className="flex items-center justify-between gap-1 pt-1 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {(empDeptFilter || empTeamFilter || empSearchQuery) && (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={handleAssignFiltered}
                          className="text-[10px] h-6 px-2 text-primary font-bold"
                        >
                          + Assign Filtered ({filteredEmployees.length})
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={handleDeselectFiltered}
                          className="text-[10px] h-6 px-1.5 text-muted-foreground"
                        >
                          Unassign Filtered
                        </Button>
                      </>
                    )}

                    {selectedDeptObj && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleAssignDepartment(selectedDeptObj.id)}
                        className="text-[10px] h-6 px-2 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                        title={`Assign all employees in ${selectedDeptObj.name}`}
                      >
                        + All {selectedDeptObj.name}
                      </Button>
                    )}

                    {selectedTeamObj && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleAssignTeam(selectedTeamObj.id)}
                        className="text-[10px] h-6 px-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        title={`Assign all employees in ${selectedTeamObj.name}`}
                      >
                        + All {selectedTeamObj.name}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Employee Assignment List with Department/Team badges & Primary toggle */}
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredEmployees.map(empItem => {
                  const assignment = assignmentMap[empItem.id] || { is_assigned: false, is_primary: true, days_of_week: schemeForm.working_days };
                  const isAssigned = assignment.is_assigned;
                  const isPrimary = assignment.is_primary;
                  const deptName = getDeptName(empItem.department_id);
                  const empTeamList = getEmpTeams(empItem);

                  return (
                    <div
                      key={empItem.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col gap-2 text-xs ${
                        isAssigned ? "bg-primary/5 border-primary/40" : "bg-card/60 hover:bg-muted/40 border-border/60 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          onClick={() => handleToggleEmployeeAssignment(empItem.id)}
                          className="flex items-center gap-2.5 truncate flex-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {}}
                            className="accent-primary"
                          />
                          <div className="size-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {empItem.full_name?.charAt(0) || "E"}
                          </div>
                          <div className="truncate">
                            <p className="truncate text-xs font-bold leading-none text-foreground">{empItem.full_name}</p>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className="text-[10px] text-muted-foreground font-mono">{empItem.employee_code}</span>
                              {deptName && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-secondary text-foreground font-semibold">
                                  {deptName}
                                </span>
                              )}
                              {empTeamList.map(t => (
                                <span key={t.id} className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold">
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Multi-Scheme Detail trigger button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEmployeeSchemes(empItem)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline shrink-0 cursor-pointer"
                          title="View all assigned schemes for this employee"
                        >
                          All Schemes
                        </button>
                      </div>

                      {/* Primary vs Secondary Shift toggle */}
                      {isAssigned && (
                        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px]">
                          <span className="text-muted-foreground font-medium">Assignment Type:</span>
                          <button
                            type="button"
                            onClick={() => handleToggleEmployeePrimary(empItem.id)}
                            className={`px-2 py-0.5 rounded-full font-bold transition-all cursor-pointer ${
                              isPrimary
                                ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                                : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                            }`}
                          >
                            {isPrimary ? "★ Primary Shift" : "⟳ Secondary / Rotational"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">No employees match filters.</p>
                )}
              </div>
            </Card>

            {/* Allowed Punch Channels */}
            <Card className="p-6 space-y-4 glass-panel">
              <div className="flex items-center gap-2.5 border-b pb-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <Shield className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Allowed Punch Channels</h3>
                  <p className="text-[11px] text-muted-foreground">Authorized check-in mechanisms for this scheme.</p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { id: "GPS", label: "GPS Mobile & Web Geofencing", desc: "Verifies location coordinates within radius", icon: MapPin },
                  { id: "Biometric", label: "Biometric Hardware Gate", desc: "Physical fingerprint & NFC badge readers", icon: Fingerprint },
                  { id: "Face", label: "AI Facial Recognition Tablet", desc: "Front desk facial scanner kiosks", icon: Camera },
                  { id: "Web", label: "Web ESS Portal & WFH", desc: "Browser 1-click self-service check-in", icon: Globe },
                  { id: "QR", label: "Dynamic QR Code Terminal", desc: "Rotating QR scan on employee mobile app", icon: QrCode },
                ].map(method => {
                  const IconComp = method.icon;
                  const isChecked = schemeForm.allowed_punch_methods.includes(method.id);
                  return (
                    <div
                      key={method.id}
                      onClick={() => {
                        const current = schemeForm.allowed_punch_methods;
                        const next = isChecked
                          ? current.filter(m => m !== method.id)
                          : [...current, method.id];
                        setSchemeForm(p => ({ ...p, allowed_punch_methods: next }));
                      }}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${isChecked ? "bg-primary/5 border-primary/40" : "bg-background border-border/60 opacity-60"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                          <IconComp className="size-3.5 text-primary" /> {method.label}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{method.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full gradient-brand text-white border-0 font-semibold h-10 text-xs shadow-md"
                >
                  {savingSettings ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-2" />}
                  Save Scheme & Multi-Assignments ({assignedCount} Employees)
                </Button>
              </div>
            </Card>
          </div>
        </form>

        {/* ─── Create New Scheme Modal ─── */}
        {newSchemeDialogOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="size-5 text-primary" />
                  <h3 className="font-bold text-base text-foreground">Create Attendance Scheme</h3>
                </div>
                <button type="button" onClick={() => setNewSchemeDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>

              <form onSubmit={handleCreateNewScheme} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Scheme Name *</label>
                    <Input
                      value={schemeForm.name}
                      onChange={e => setSchemeForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Night Shift Operations"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Scheme Code</label>
                    <Input
                      value={schemeForm.code}
                      onChange={e => setSchemeForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. SCH-NIGHT"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Shift Start</label>
                    <Input
                      type="time"
                      value={schemeForm.shift_start_time}
                      onChange={e => setSchemeForm(p => ({ ...p, shift_start_time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Shift End</label>
                    <Input
                      type="time"
                      value={schemeForm.shift_end_time}
                      onChange={e => setSchemeForm(p => ({ ...p, shift_end_time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Grace Period (Mins)</label>
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={schemeForm.grace_period_minutes}
                      onChange={e => setSchemeForm(p => ({ ...p, grace_period_minutes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Full-Day Working Hours</label>
                    <Input
                      type="number"
                      step="0.5"
                      min="4"
                      max="16"
                      value={schemeForm.full_day_hours}
                      onChange={e => setSchemeForm(p => ({ ...p, full_day_hours: parseFloat(e.target.value) || 8.0 }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
                  <Input
                    value={schemeForm.description}
                    onChange={e => setSchemeForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="e.g. Rotational 2nd shift for 24/7 ops"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="modal_is_default"
                    checked={schemeForm.is_default}
                    onChange={e => setSchemeForm(p => ({ ...p, is_default: e.target.checked }))}
                    className="accent-primary"
                  />
                  <label htmlFor="modal_is_default" className="text-xs font-semibold text-foreground cursor-pointer">
                    Set as Primary Default Scheme for new hires
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewSchemeDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="gradient-brand text-white border-0 font-semibold">
                    Create Scheme
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Employee Assigned Schemes Inspector Modal ─── */}
        {selectedEmpForSchemeDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                    {selectedEmpForSchemeDetail.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">{selectedEmpForSchemeDetail.full_name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{selectedEmpForSchemeDetail.employee_code}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedEmpForSchemeDetail(null)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Active Multi-Scheme Rotations</h4>
                {loadingEmpSchemes ? (
                  <div className="py-6 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
                ) : empAssignedSchemes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">No schemes assigned to this employee yet.</p>
                ) : (
                  <div className="space-y-2">
                    {empAssignedSchemes.map((item, idx) => (
                      <div key={idx} className="p-3 bg-muted/30 rounded-xl border flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <span>{item.scheme_name || "Attendance Scheme"}</span>
                            {item.is_primary && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-500/10 text-indigo-600 font-bold">Primary</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {item.shift_start_time} - {item.shift_end_time}
                          </p>
                        </div>
                        {item.days_of_week && item.days_of_week.length > 0 && (
                          <div className="flex gap-0.5">
                            {item.days_of_week.map(d => (
                              <span key={d} className="px-1 py-0.5 rounded text-[8px] font-bold bg-background border">
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedEmpForSchemeDetail(null)}>
                  Close
                </Button>
              </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">GPS / Geofenced Attendance</h2>
            <p className="text-xs text-muted-foreground">Geofenced coordinates recorded for field or remote staff with live perimeter verification.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/hrms?tab=attendance_settings"
              className="inline-flex items-center justify-center px-3 h-8 text-xs font-semibold rounded-md border bg-background hover:bg-muted text-foreground transition-colors"
            >
              <SlidersHorizontal className="size-3.5 mr-1.5 text-primary" /> Geofence Settings & GPS Portal
            </a>
            <Button
              className="h-8 text-xs font-semibold gradient-brand text-white border-0"
              onClick={() => setGpsPunchDialogOpen(true)}
            >
              <MapPin className="size-3.5 mr-1.5" /> Record GPS Geofence Punch
            </Button>
          </div>
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

        {/* ─── SIMULATE GPS PUNCH DIALOG ─────────────────────────────── */}
        {gpsPunchDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <MapPin className="size-5 text-emerald-500" /> Simulate GPS Geofenced Punch
                </h3>
                <button onClick={() => setGpsPunchDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="size-5" />
                </button>
              </div>
              <form onSubmit={handleSimulateGpsPunch} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee Profile</label>
                  <select
                    value={gpsPunchForm.employee_id}
                    onChange={e => setGpsPunchForm(p => ({ ...p, employee_id: e.target.value }))}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Office Location Geofence Preset</label>
                  <select
                    value={gpsPunchForm.preset}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.includes("HQ")) {
                        setGpsPunchForm(p => ({ ...p, preset: val, latitude: 37.7749, longitude: -122.4194 }));
                      } else if (val.includes("Oakland")) {
                        setGpsPunchForm(p => ({ ...p, preset: val, latitude: 37.8044, longitude: -122.2712 }));
                      } else if (val.includes("WFH")) {
                        setGpsPunchForm(p => ({ ...p, preset: val, latitude: 37.7833, longitude: -122.4167 }));
                      } else {
                        setGpsPunchForm(p => ({ ...p, preset: val }));
                      }
                    }}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  >
                    <option value="San Francisco HQ (100 Innovation Blvd - Within 150m Geofence)">San Francisco HQ (Within 150m Geofence - Verified)</option>
                    <option value="Oakland Logistics Center (Within 200m Geofence)">Oakland Logistics Center (Within 200m Geofence - Verified)</option>
                    <option value="Remote Home Office (WFH Verified IP & Coordinates)">Remote Home Office (WFH Verified IP & Coordinates)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Coordinates</span>
                  <button
                    type="button"
                    onClick={() => {
                      if ("geolocation" in navigator) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setGpsPunchForm(p => ({
                              ...p,
                              latitude: parseFloat(pos.coords.latitude.toFixed(6)),
                              longitude: parseFloat(pos.coords.longitude.toFixed(6)),
                              preset: `Device Real-time GPS (±${Math.round(pos.coords.accuracy)}m)`
                            }));
                          },
                          (err) => {
                            alert("Location access denied or unavailable: " + err.message);
                          },
                          { enableHighAccuracy: true, timeout: 10000 }
                        );
                      } else {
                        alert("Geolocation is not supported by your browser.");
                      }
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="size-3" /> Detect Device Live GPS
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Latitude</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={gpsPunchForm.latitude}
                      onChange={e => setGpsPunchForm(p => ({ ...p, latitude: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Longitude</label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={gpsPunchForm.longitude}
                      onChange={e => setGpsPunchForm(p => ({ ...p, longitude: parseFloat(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Action</label>
                    <select
                      value={gpsPunchForm.action}
                      onChange={e => setGpsPunchForm(p => ({ ...p, action: e.target.value }))}
                      className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                    >
                      <option>Check-In</option>
                      <option>Check-Out</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Radius Status</label>
                    <div className="h-10 px-3 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 rounded-md text-xs font-bold border border-emerald-500/20">
                      <CheckCircle className="size-3.5" /> Inside Allowed Geofence
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setGpsPunchDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <MapPin className="size-4 mr-1.5" />}
                    Punch GPS
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
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
        <ShiftRosterCalendar
          employees={employees}
          workCalendars={workCalendars}
          onAddShift={(cal) => {
            setSelectedCalendar(cal);
            setShiftDialogOpen(true);
          }}
          onNewCalendar={() => setCalendarDialogOpen(true)}
          onDeleteCalendar={handleDeleteCalendar}
          onDeleteShift={handleDeleteShift}
        />

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Daily Attendance</h2>
          <p className="text-xs text-muted-foreground">Timesheets log summary, interactive calendar grid, manual administrative punches, and WFH tracking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Table vs Calendar View Switcher */}
          <div className="flex items-center gap-1 p-0.5 bg-muted/50 border border-border rounded-lg">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="size-3.5" />
              Table View
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "calendar"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarIcon className="size-3.5" />
              Calendar View
            </button>
          </div>

          <Button
            className="h-8 text-xs font-semibold gradient-brand text-white border-0"
            onClick={() => setManualPunchDialogOpen(true)}
          >
            <Plus className="size-3.5 mr-1.5" /> Manual Punch / Mark Date
          </Button>
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

      {!loading && viewMode === "calendar" && (
        <AttendanceCalendarView
          attendanceRecords={attendance}
          employees={employees}
          selectedEmployeeId={selectedEmpFilter}
          onSelectEmployee={setSelectedEmpFilter}
          onMarkAttendanceDate={(dateStr, empId) => {
            setManualPunchForm(p => ({
              ...p,
              date: dateStr,
              employee_id: empId || p.employee_id || (employees[0]?.id ?? ""),
            }));
            setManualPunchDialogOpen(true);
          }}
        />
      )}

      {!loading && viewMode === "table" && (
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
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No attendance records generated yet.</td></tr>
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

      {/* ─── MANUAL PUNCH / ADJUSTMENT DIALOG ───────────────────────── */}
      {manualPunchDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <Clock className="size-5 text-primary" /> Manual Timesheet Punch / Adjustment
              </h3>
              <button onClick={() => setManualPunchDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                <XCircle className="size-5" />
              </button>
            </div>
            <form onSubmit={handleManualPunch} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Choose Employee Profile *</label>
                <select
                  value={manualPunchForm.employee_id}
                  onChange={e => setManualPunchForm(p => ({ ...p, employee_id: e.target.value }))}
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Timesheet Date</label>
                  <Input
                    type="date"
                    value={manualPunchForm.date}
                    onChange={e => setManualPunchForm(p => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Attendance Status</label>
                  <select
                    value={manualPunchForm.status}
                    onChange={e => setManualPunchForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                  >
                    <option>Present</option>
                    <option>Late</option>
                    <option>Half Day</option>
                    <option>Absent</option>
                    <option>On Leave</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Check In Time</label>
                  <Input
                    type="time"
                    value={manualPunchForm.check_in}
                    onChange={e => setManualPunchForm(p => ({ ...p, check_in: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Check Out Time</label>
                  <Input
                    type="time"
                    value={manualPunchForm.check_out}
                    onChange={e => setManualPunchForm(p => ({ ...p, check_out: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Punch Method</label>
                <select
                  value={manualPunchForm.method}
                  onChange={e => setManualPunchForm(p => ({ ...p, method: e.target.value }))}
                  className="w-full h-10 px-3 text-sm rounded-md border bg-background"
                >
                  <option value="Manual">Manual Entry (HR Verified)</option>
                  <option value="Biometric">Biometric Fingerprint Terminal</option>
                  <option value="Face">Facial Recognition Turnstile</option>
                  <option value="GPS">GPS Geofenced Remote</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Administrative Notes / Reason</label>
                <Input
                  placeholder="e.g. Regularized by HR Manager"
                  value={manualPunchForm.notes}
                  onChange={e => setManualPunchForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setManualPunchDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
                  Save Attendance
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
