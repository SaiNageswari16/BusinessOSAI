import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  Plus, User, Users, Sparkles, Filter, Check, X, ShieldAlert,
  Sun, Moon, Sunset, Sunrise, Coffee, Settings2, Trash2, Edit3,
  CheckCircle2, ArrowRightLeft, RefreshCw, Eye, Search, CheckSquare,
  Square, Layers, Building, ChevronDown, ChevronUp, Zap, UserCheck
} from "lucide-react";
import { type Employee, type WorkCalendar } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Props {
  employees: Employee[];
  workCalendars: any[];
  onAddShift: (calendar: any) => void;
  onNewCalendar: () => void;
  onDeleteCalendar: (id: string) => void;
  onDeleteShift: (calendar: any, index: number) => void;
}

export interface ShiftPreset {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  icon: "morning" | "general" | "evening" | "night" | "off";
}

export const DEFAULT_SHIFT_PRESETS: ShiftPreset[] = [
  {
    id: "shift-gen",
    name: "General Shift",
    code: "GEN",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    graceMinutes: 15,
    color: "#6366f1",
    bgClass: "bg-indigo-500/15 dark:bg-indigo-950/40",
    borderClass: "border-indigo-500/30",
    textClass: "text-indigo-600 dark:text-indigo-400",
    icon: "general",
  },
  {
    id: "shift-morn",
    name: "Morning Shift",
    code: "MORN",
    startTime: "06:00",
    endTime: "14:30",
    breakMinutes: 45,
    graceMinutes: 10,
    color: "#10b981",
    bgClass: "bg-emerald-500/15 dark:bg-emerald-950/40",
    borderClass: "border-emerald-500/30",
    textClass: "text-emerald-600 dark:text-emerald-400",
    icon: "morning",
  },
  {
    id: "shift-eve",
    name: "Evening Shift",
    code: "EVE",
    startTime: "14:00",
    endTime: "22:30",
    breakMinutes: 45,
    graceMinutes: 10,
    color: "#f59e0b",
    bgClass: "bg-amber-500/15 dark:bg-amber-950/40",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-600 dark:text-amber-400",
    icon: "evening",
  },
  {
    id: "shift-ngt",
    name: "Night Shift",
    code: "NGT",
    startTime: "22:00",
    endTime: "06:30",
    breakMinutes: 45,
    graceMinutes: 15,
    color: "#8b5cf6",
    bgClass: "bg-purple-500/15 dark:bg-purple-950/40",
    borderClass: "border-purple-500/30",
    textClass: "text-purple-600 dark:text-purple-400",
    icon: "night",
  },
  {
    id: "shift-off",
    name: "Weekly Off / Rest",
    code: "OFF",
    startTime: "—",
    endTime: "—",
    breakMinutes: 0,
    graceMinutes: 0,
    color: "#64748b",
    bgClass: "bg-muted/40",
    borderClass: "border-border/60",
    textClass: "text-muted-foreground",
    icon: "off",
  },
];

export function ShiftRosterCalendar({
  employees,
  workCalendars,
  onAddShift,
  onNewCalendar,
  onDeleteCalendar,
  onDeleteShift,
}: Props) {
  const [subView, setSubView] = useState<"roster" | "configs">("roster");
  const [hierarchyMode, setHierarchyMode] = useState<"flat" | "department">("flat");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  // Batch Selection State
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkShiftId, setBulkShiftId] = useState<string>("shift-gen");
  const [bulkDayScope, setBulkDayScope] = useState<"all" | "weekdays" | "weekends" | "custom">("weekdays");
  const [bulkCustomDays, setBulkCustomDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start of week
    return new Date(d.setDate(diff));
  });

  // Shift assignment state: map of `${employeeId}_${dateStr}` -> shiftId
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  // Quick shift picker dialog state (Single Cell)
  const [pickerModal, setPickerModal] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    dateStr: string;
    dayName: string;
    currentShiftId: string;
  }>({
    open: false,
    employeeId: "",
    employeeName: "",
    dateStr: "",
    dayName: "",
    currentShiftId: "shift-gen",
  });

  // Calculate 7 days for the current week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const formattedDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const isToday = dateStr === new Date().toISOString().split("T")[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      return { date: d, dateStr, dayName, formattedDate, isToday, isWeekend };
    });
  }, [currentWeekStart]);

  // Week navigation
  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(d.setDate(diff)));
  };

  // Distinct department names
  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach((e) => {
      if (e.department) depts.add(e.department);
      else depts.add("General / Operations");
    });
    return Array.from(depts);
  }, [employees]);

  // Filtered employees list by Department + Search Query
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const dept = e.department || "General / Operations";
      const matchesDept = selectedDept === "all" || dept === selectedDept;
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        e.full_name?.toLowerCase().includes(q) ||
        e.employee_code?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q);

      return matchesDept && matchesSearch;
    });
  }, [employees, selectedDept, searchQuery]);

  // Employees grouped by Department for Hierarchical View
  const groupedByDepartment = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    filteredEmployees.forEach((emp) => {
      const dept = emp.department || "General / Operations";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(emp);
    });
    return groups;
  }, [filteredEmployees]);

  // Helper to get assigned shift or default (General on weekdays, Off on weekends)
  const getShiftForCell = (employeeId: string, dateStr: string, isWeekend: boolean): ShiftPreset => {
    const key = `${employeeId}_${dateStr}`;
    const assignedId = assignments[key];
    if (assignedId) {
      const found = DEFAULT_SHIFT_PRESETS.find((s) => s.id === assignedId);
      if (found) return found;
    }
    // Default fallback
    return isWeekend ? DEFAULT_SHIFT_PRESETS[4] : DEFAULT_SHIFT_PRESETS[0];
  };

  const handleOpenShiftPicker = (employee: Employee, day: (typeof weekDays)[0]) => {
    const currentShift = getShiftForCell(employee.id, day.dateStr, day.isWeekend);
    setPickerModal({
      open: true,
      employeeId: employee.id,
      employeeName: employee.full_name,
      dateStr: day.dateStr,
      dayName: `${day.dayName}, ${day.formattedDate}`,
      currentShiftId: currentShift.id,
    });
  };

  const handleAssignShift = (shiftId: string) => {
    const key = `${pickerModal.employeeId}_${pickerModal.dateStr}`;
    setAssignments((prev) => ({ ...prev, [key]: shiftId }));
    setPickerModal((prev) => ({ ...prev, open: false }));
    toast.success(`Shift updated for ${pickerModal.employeeName}`);
  };

  // Bulk Selection Handlers
  const handleToggleSelectEmp = (empId: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmpIds.length === filteredEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredEmployees.map((e) => e.id));
    }
  };

  const handleSelectDepartmentTeam = (deptEmps: Employee[]) => {
    const deptIds = deptEmps.map((e) => e.id);
    const allSelected = deptIds.every((id) => selectedEmpIds.includes(id));
    if (allSelected) {
      setSelectedEmpIds((prev) => prev.filter((id) => !deptIds.includes(id)));
    } else {
      setSelectedEmpIds((prev) => Array.from(new Set([...prev, ...deptIds])));
    }
  };

  const handleOpenBatchAssignForTeam = (deptEmps: Employee[]) => {
    setSelectedEmpIds(deptEmps.map((e) => e.id));
    setBulkModalOpen(true);
  };

  const handleExecuteBulkAssignment = () => {
    if (selectedEmpIds.length === 0) return;

    const newAssignments = { ...assignments };
    const targetDays = weekDays.filter((d) => {
      if (bulkDayScope === "all") return true;
      if (bulkDayScope === "weekdays") return !d.isWeekend;
      if (bulkDayScope === "weekends") return d.isWeekend;
      if (bulkDayScope === "custom") return bulkCustomDays.includes(d.dayName);
      return true;
    });

    selectedEmpIds.forEach((empId) => {
      targetDays.forEach((day) => {
        newAssignments[`${empId}_${day.dateStr}`] = bulkShiftId;
      });
    });

    setAssignments(newAssignments);
    setBulkModalOpen(false);
    const shiftObj = DEFAULT_SHIFT_PRESETS.find((s) => s.id === bulkShiftId);
    toast.success(
      `⚡ Batch assigned ${shiftObj?.name || "Shift"} to ${selectedEmpIds.length} employees across ${targetDays.length} days!`
    );
  };

  // Headcount summary for current week
  const headcountStats = useMemo(() => {
    let morningTotal = 0;
    let generalTotal = 0;
    let eveningTotal = 0;
    let nightTotal = 0;
    let offTotal = 0;

    filteredEmployees.forEach((emp) => {
      weekDays.forEach((day) => {
        const s = getShiftForCell(emp.id, day.dateStr, day.isWeekend);
        if (s.id === "shift-morn") morningTotal++;
        else if (s.id === "shift-gen") generalTotal++;
        else if (s.id === "shift-eve") eveningTotal++;
        else if (s.id === "shift-ngt") nightTotal++;
        else if (s.id === "shift-off") offTotal++;
      });
    });

    return { morningTotal, generalTotal, eveningTotal, nightTotal, offTotal };
  }, [filteredEmployees, weekDays, assignments]);

  const renderShiftIcon = (type: string) => {
    switch (type) {
      case "morning":
        return <Sunrise className="size-3 text-emerald-500" />;
      case "evening":
        return <Sunset className="size-3 text-amber-500" />;
      case "night":
        return <Moon className="size-3 text-purple-500" />;
      case "off":
        return <Coffee className="size-3 text-muted-foreground" />;
      default:
        return <Sun className="size-3 text-indigo-500" />;
    }
  };

  const renderRosterTableRows = (empList: Employee[]) => {
    return empList.map((emp) => {
      const isSelected = selectedEmpIds.includes(emp.id);
      return (
        <tr key={emp.id} className={`hover:bg-muted/20 transition-colors ${isSelected ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""}`}>
          {/* Checkbox & Employee Profile */}
          <td className="px-4 py-3 border-r border-border/40">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleToggleSelectEmp(emp.id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isSelected ? (
                  <CheckSquare className="size-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Square className="size-4 text-muted-foreground/50" />
                )}
              </button>
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                {emp.full_name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-xs truncate leading-tight">
                  {emp.full_name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {emp.employee_code} • {emp.department || "General"}
                </p>
              </div>
            </div>
          </td>

          {/* 7 Weekday Shift Cells */}
          {weekDays.map((day) => {
            const shift = getShiftForCell(emp.id, day.dateStr, day.isWeekend);
            return (
              <td
                key={day.dateStr}
                onClick={() => handleOpenShiftPicker(emp, day)}
                className={`p-1.5 text-center cursor-pointer transition-all hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 border-r border-border/30 last:border-r-0 ${
                  day.isToday ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                }`}
              >
                <div
                  className={`p-2 rounded-lg border text-[11px] font-semibold transition-all hover:scale-[1.03] shadow-2xs ${shift.bgClass} ${shift.borderClass} ${shift.textClass}`}
                >
                  <div className="flex items-center justify-center gap-1 font-bold">
                    {renderShiftIcon(shift.icon)}
                    <span>{shift.code}</span>
                  </div>
                  <div className="text-[9px] opacity-80 font-mono mt-0.5 truncate">
                    {shift.startTime !== "—" ? `${shift.startTime}-${shift.endTime}` : "Rest Day"}
                  </div>
                </div>
              </td>
            );
          })}
        </tr>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-view Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="size-6 text-indigo-500" /> Shift Roster & Work Calendars
          </h2>
          <p className="text-xs text-muted-foreground">
            Visual weekly/monthly shift scheduling, batch team allocation, and hierarchical department rosters.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-0.5 bg-muted/60 border border-border rounded-xl">
            <button
              onClick={() => setSubView("roster")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                subView === "roster"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-3.5" /> Weekly Shift Roster
            </button>
            <button
              onClick={() => setSubView("configs")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                subView === "configs"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings2 className="size-3.5" /> Shift Templates & Policies
            </button>
          </div>

          <Button
            className="h-8 text-xs font-semibold gradient-brand text-white border-0"
            onClick={onNewCalendar}
          >
            <Plus className="size-3.5 mr-1" /> New Calendar
          </Button>
        </div>
      </div>

      {/* Headcount Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
              {headcountStats.generalTotal}
            </p>
            <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">General (09-18)</p>
          </div>
          <Sun className="size-6 text-indigo-500 opacity-60" />
        </div>
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {headcountStats.morningTotal}
            </p>
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Morning (06-14)</p>
          </div>
          <Sunrise className="size-6 text-emerald-500 opacity-60" />
        </div>
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400">
              {headcountStats.eveningTotal}
            </p>
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Evening (14-22)</p>
          </div>
          <Sunset className="size-6 text-amber-500 opacity-60" />
        </div>
        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-purple-600 dark:text-purple-400">
              {headcountStats.nightTotal}
            </p>
            <p className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase">Night (22-06)</p>
          </div>
          <Moon className="size-6 text-purple-500 opacity-60" />
        </div>
        <div className="p-3.5 rounded-xl border border-slate-500/20 bg-slate-500/5 flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-slate-600 dark:text-slate-400">
              {headcountStats.offTotal}
            </p>
            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase">Weekly Offs</p>
          </div>
          <Coffee className="size-6 text-slate-500 opacity-60" />
        </div>
      </div>

      {/* ─── SUB-VIEW 1: WEEKLY SHIFT ROSTER MATRIX ─────────────────── */}
      {subView === "roster" && (
        <div className="space-y-4">
          {/* Controls Bar: Search, Hierarchy Switcher, Filter & Week Navigator */}
          <div className="p-4 rounded-2xl border bg-card shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search staff by name, employee code, email, designation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View Hierarchy Mode Toggle */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground hidden sm:inline">View:</span>
                <div className="flex items-center gap-1 p-0.5 bg-muted/60 border rounded-lg">
                  <button
                    onClick={() => setHierarchyMode("flat")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      hierarchyMode === "flat"
                        ? "bg-card text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users className="size-3" /> Flat List
                  </button>
                  <button
                    onClick={() => setHierarchyMode("department")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      hierarchyMode === "department"
                        ? "bg-card text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Layers className="size-3" /> Team Hierarchy
                  </button>
                </div>
              </div>

              {/* Department Filter */}
              {departments.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Filter className="size-3.5 text-muted-foreground" />
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="h-8 px-2 text-xs rounded-lg border bg-background text-foreground"
                  >
                    <option value="all">All Departments ({employees.length})</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Week Navigator */}
              <div className="flex items-center border rounded-lg bg-background p-0.5">
                <button
                  onClick={handlePrevWeek}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Previous Week"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={handleCurrentWeek}
                  className="px-2.5 py-1 text-xs font-semibold hover:bg-muted rounded-md"
                >
                  This Week
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Next Week"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            {/* Sub-header text & result stats */}
            <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>
                Week of <strong className="text-foreground">{weekDays[0].formattedDate} – {weekDays[6].formattedDate}, {weekDays[0].date.getFullYear()}</strong>
              </span>
              <span>Showing <strong>{filteredEmployees.length}</strong> of {employees.length} staff</span>
            </div>
          </div>

          {/* Floating Batch Action Toolbar */}
          <AnimatePresence>
            {selectedEmpIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg flex flex-col sm:flex-row justify-between items-center gap-3"
              >
                <div className="flex items-center gap-2 text-xs font-bold">
                  <UserCheck className="size-4" />
                  <span>{selectedEmpIds.length} Staff Selected for Batch Scheduling</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-white text-indigo-700 hover:bg-white/90 text-xs font-bold shadow-sm h-8"
                    onClick={() => setBulkModalOpen(true)}
                  >
                    <Zap className="size-3.5 mr-1 text-amber-500 fill-amber-500" />
                    Bulk Assign Shift
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20 text-xs h-8"
                    onClick={() => setSelectedEmpIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── FLAT VIEW MATRIX TABLE ─── */}
          {hierarchyMode === "flat" && (
            <div className="glass-panel rounded-xl border border-border/60 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
                    <tr>
                      <th className="px-4 py-3.5 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-muted-foreground hover:text-foreground"
                            title="Select / Deselect All"
                          >
                            {selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0 ? (
                              <CheckSquare className="size-4 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Square className="size-4 text-muted-foreground/50" />
                            )}
                          </button>
                          <span>Employee Profile</span>
                        </div>
                      </th>
                      {weekDays.map((day) => (
                        <th
                          key={day.dateStr}
                          className={`px-3 py-3 text-center min-w-[120px] ${
                            day.isToday
                              ? "bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-600 font-black"
                              : ""
                          }`}
                        >
                          <div className="font-bold text-xs text-foreground">{day.dayName}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">{day.formattedDate}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                          No employees found matching the search or department criteria.
                        </td>
                      </tr>
                    ) : (
                      renderRosterTableRows(filteredEmployees)
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── HIERARCHICAL DEPARTMENT/TEAM VIEW ─── */}
          {hierarchyMode === "department" && (
            <div className="space-y-4">
              {Object.keys(groupedByDepartment).length === 0 ? (
                <div className="p-12 text-center glass-panel rounded-xl border text-muted-foreground">
                  No staff members match the selected filters.
                </div>
              ) : (
                Object.entries(groupedByDepartment).map(([deptName, deptEmps]) => {
                  const isCollapsed = !!collapsedDepts[deptName];
                  const allDeptSelected = deptEmps.every((e) => selectedEmpIds.includes(e.id));
                  return (
                    <div key={deptName} className="glass-panel rounded-xl border border-border/60 overflow-hidden shadow-xs">
                      {/* Department Accordion Header */}
                      <div className="p-4 bg-muted/40 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedDepts((prev) => ({ ...prev, [deptName]: !isCollapsed }))
                            }
                            className="p-1 hover:bg-muted rounded-md text-muted-foreground"
                          >
                            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                          </button>
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <Building className="size-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                              {deptName}
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                                {deptEmps.length} Staff
                              </span>
                            </h4>
                          </div>
                        </div>

                        {/* Batch Action Buttons for this Team */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] font-semibold"
                            onClick={() => handleSelectDepartmentTeam(deptEmps)}
                          >
                            {allDeptSelected ? "Deselect Team" : "Select Team"}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-[11px] font-bold gradient-brand text-white border-0"
                            onClick={() => handleOpenBatchAssignForTeam(deptEmps)}
                          >
                            <Zap className="size-3 mr-1 text-amber-300" />
                            Assign Whole Team
                          </Button>
                        </div>
                      </div>

                      {/* Department Staff Matrix Table */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead className="text-[11px] text-muted-foreground uppercase bg-muted/20 border-b">
                              <tr>
                                <th className="px-4 py-2.5 min-w-[220px]">Staff Member</th>
                                {weekDays.map((day) => (
                                  <th
                                    key={day.dateStr}
                                    className={`px-3 py-2 text-center min-w-[120px] ${
                                      day.isToday ? "bg-indigo-50/60 dark:bg-indigo-950/30 font-bold" : ""
                                    }`}
                                  >
                                    <span className="font-bold text-xs">{day.dayName}</span>{" "}
                                    <span className="text-[9px] text-muted-foreground">({day.formattedDate})</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {renderRosterTableRows(deptEmps)}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Roster Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border bg-card text-xs text-muted-foreground">
            <span className="font-bold text-foreground">Shift Legend:</span>
            <div className="flex flex-wrap items-center gap-4">
              {DEFAULT_SHIFT_PRESETS.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${s.bgClass} ${s.borderClass} ${s.textClass}`}>
                    {s.code}
                  </span>
                  <span>{s.name} ({s.startTime !== "—" ? `${s.startTime} - ${s.endTime}` : "Off"})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── SUB-VIEW 2: SHIFT TEMPLATES & CONFIGURATIONS ───────────── */}
      {subView === "configs" && (
        <div className="space-y-6">
          {/* Active Calendars List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-foreground">Active Work Calendars & Day Schedules</h3>
            </div>

            {workCalendars.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-xl border border-dashed text-muted-foreground">
                <Clock className="size-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-sm">No Work Calendars Configured</p>
                <p className="text-xs mt-1">Create a calendar to attach shift definitions.</p>
                <Button className="mt-4 gradient-brand text-white border-0 h-8 text-xs font-semibold" onClick={onNewCalendar}>
                  <Plus className="size-3.5 mr-1" /> Add Work Calendar
                </Button>
              </div>
            ) : (
              workCalendars.map((cal) => (
                <Card key={cal.id} className="p-5 border bg-card rounded-xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-foreground text-base">{cal.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        Working Days: <span className="font-semibold text-foreground">{cal.working_days?.join(", ") || "Mon, Tue, Wed, Thu, Fri"}</span> • Type: {cal.calendar_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold"
                        onClick={() => onAddShift(cal)}
                      >
                        <Plus className="size-3.5 mr-1" /> Add Shift Timing
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-500/10"
                        onClick={() => onDeleteCalendar(cal.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Shifts in this calendar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {(!cal.shifts || cal.shifts.length === 0) ? (
                      <div className="col-span-full p-4 rounded-lg bg-muted/20 border border-dashed text-center text-xs text-muted-foreground">
                        No shift timings defined in this calendar yet. Click "Add Shift Timing" to create one.
                      </div>
                    ) : (
                      cal.shifts.map((shift: any, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-xl border bg-muted/20 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              <Clock className="size-4" />
                            </div>
                            <div>
                              <p className="font-bold text-xs text-foreground">{shift.name}</p>
                              <p className="font-mono text-xs text-muted-foreground">{shift.start_time} – {shift.end_time}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => onDeleteShift(cal, idx)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Standard Shift Presets Reference */}
          <div className="space-y-3">
            <h3 className="font-bold text-base text-foreground">Standard Enterprise Shift Templates</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {DEFAULT_SHIFT_PRESETS.slice(0, 4).map((preset) => (
                <div key={preset.id} className={`p-4 rounded-xl border ${preset.bgClass} ${preset.borderClass} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-xs font-black uppercase ${preset.textClass}`}>
                      {preset.code}
                    </span>
                    {renderShiftIcon(preset.icon)}
                  </div>
                  <h4 className="font-bold text-sm text-foreground">{preset.name}</h4>
                  <div className="text-xs space-y-1 text-muted-foreground pt-1 border-t border-border/40">
                    <p className="font-mono font-semibold text-foreground">{preset.startTime} – {preset.endTime}</p>
                    <p>Break: {preset.breakMinutes} mins • Grace: {preset.graceMinutes} mins</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: SINGLE CELL SHIFT ASSIGNMENT PICKER ─────────────────── */}
      {pickerModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-md p-6 shadow-2xl space-y-4 rounded-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ArrowRightLeft className="size-4 text-indigo-500" /> Assign Shift
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assign shift for <span className="font-bold text-foreground">{pickerModal.employeeName}</span> on <span className="font-bold text-primary">{pickerModal.dayName}</span>
                </p>
              </div>
              <button
                onClick={() => setPickerModal((p) => ({ ...p, open: false }))}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Select Shift Schedule
              </label>
              <div className="space-y-2">
                {DEFAULT_SHIFT_PRESETS.map((preset) => {
                  const isSelected = pickerModal.currentShiftId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleAssignShift(preset.id)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all hover:scale-[1.01] ${
                        isSelected
                          ? `${preset.bgClass} ${preset.borderClass} ring-2 ring-indigo-500`
                          : "bg-card hover:bg-muted/30 border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-background border">{renderShiftIcon(preset.icon)}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">{preset.name}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase ${preset.textClass}`}>
                              {preset.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {preset.startTime !== "—" ? `${preset.startTime} - ${preset.endTime}` : "Full Day Off"}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="size-4 text-indigo-600 font-bold" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                className="w-full text-xs font-semibold"
                onClick={() => setPickerModal((p) => ({ ...p, open: false }))}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ─── MODAL 2: BATCH / BULK SHIFT ASSIGNMENT MODAL ─────────────────── */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-lg p-6 shadow-2xl space-y-5 rounded-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Zap className="size-5 text-amber-500 fill-amber-500" /> Batch Assign Shift
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Apply a shift schedule to <strong className="text-foreground">{selectedEmpIds.length} selected employees</strong>.
                </p>
              </div>
              <button
                onClick={() => setBulkModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Select Shift Preset */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                1. Choose Target Shift
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_SHIFT_PRESETS.map((preset) => {
                  const isSelected = bulkShiftId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setBulkShiftId(preset.id)}
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        isSelected
                          ? `${preset.bgClass} ${preset.borderClass} ring-2 ring-indigo-500 font-bold`
                          : "bg-card hover:bg-muted/30 border-border"
                      }`}
                    >
                      <div className="p-1.5 rounded-md bg-background border">{renderShiftIcon(preset.icon)}</div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-foreground">{preset.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {preset.startTime !== "—" ? `${preset.startTime} - ${preset.endTime}` : "Off Day"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select Schedule Scope / Days */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                2. Apply to Days
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "weekdays", label: "Mon – Fri (Weekdays)" },
                  { id: "all", label: "Mon – Sun (All 7 Days)" },
                  { id: "weekends", label: "Sat – Sun (Weekend)" },
                ].map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setBulkDayScope(scope.id as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all ${
                      bulkDayScope === scope.id
                        ? "bg-primary text-white border-primary"
                        : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Selected Staff Preview */}
            <div className="p-3 rounded-xl bg-muted/30 border space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-muted-foreground">Selected Staff ({selectedEmpIds.length}):</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  Week of {weekDays[0].formattedDate}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedEmpIds.map((id) => {
                  const emp = employees.find((e) => e.id === id);
                  return (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-background border text-foreground"
                    >
                      {emp?.full_name || id}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBulkModalOpen(false)}>
                Cancel
              </Button>
              <Button
                className="gradient-brand text-white border-0 font-bold"
                onClick={handleExecuteBulkAssignment}
              >
                <Zap className="size-3.5 mr-1 text-amber-300" />
                Apply Batch Shift Schedule
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
