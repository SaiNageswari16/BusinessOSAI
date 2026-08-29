import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  CheckCircle2, AlertCircle, Plus, User, MapPin, Fingerprint, Camera,
  Sparkles, Filter, Check, X, ShieldAlert, Sun, Moon
} from "lucide-react";
import { type AttendanceRecord, type Employee } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

interface Props {
  attendanceRecords: AttendanceRecord[];
  employees?: Employee[];
  selectedEmployeeId?: string;
  onSelectEmployee?: (empId: string) => void;
  onMarkAttendanceDate?: (dateStr: string, empId?: string) => void;
  isEssMode?: boolean; // If true, viewing personal attendance for employee
  currentEmployee?: Employee | null;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string; icon: string }> = {
  Present: { label: "Present", badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", dotClass: "bg-emerald-500", icon: "✓" },
  Late: { label: "Late", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", dotClass: "bg-amber-500", icon: "!" },
  Absent: { label: "Absent", badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", dotClass: "bg-red-500", icon: "✕" },
  "Half Day": { label: "Half Day", badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", dotClass: "bg-blue-500", icon: "½" },
  "On Leave": { label: "On Leave", badgeClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30", dotClass: "bg-purple-500", icon: "L" },
  Holiday: { label: "Holiday", badgeClass: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30", dotClass: "bg-teal-500", icon: "★" },
  Weekend: { label: "Weekend", badgeClass: "bg-muted text-muted-foreground border-border/50", dotClass: "bg-muted-foreground/50", icon: "W" },
};

export function AttendanceCalendarView({
  attendanceRecords,
  employees = [],
  selectedEmployeeId = "",
  onSelectEmployee,
  onMarkAttendanceDate,
  isEssMode = false,
  currentEmployee,
}: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  // Filter records by selected employee if in Admin mode
  const filteredRecords = useMemo(() => {
    if (isEssMode) return attendanceRecords;
    if (!selectedEmployeeId) return attendanceRecords;
    return attendanceRecords.filter((r) => r.employee_id === selectedEmployeeId);
  }, [attendanceRecords, selectedEmployeeId, isEssMode]);

  // Build calendar matrix
  const { calendarDays, stats } = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
      records: AttendanceRecord[];
    }> = [];

    const todayStr = new Date().toISOString().split("T")[0];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, totalDaysPrevMonth - i);
      const dateStr = d.toISOString().split("T")[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const recs = filteredRecords.filter((r) => r.date === dateStr);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend,
        records: recs,
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const recs = filteredRecords.filter((r) => r.date === dateStr);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend,
        records: recs,
      });
    }

    // Next month padding to fill a full grid of 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = d.toISOString().split("T")[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const recs = filteredRecords.filter((r) => r.date === dateStr);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend,
        records: recs,
      });
    }

    // Compute month stats
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let totalHours = 0;

    filteredRecords.forEach((r) => {
      const rDate = new Date(r.date);
      if (rDate.getFullYear() === year && rDate.getMonth() === month) {
        if (r.status === "Present") presentCount++;
        else if (r.status === "Late") lateCount++;
        else if (r.status === "Absent") absentCount++;
        else if (r.status === "Half Day") halfDayCount++;
        else if (r.status === "On Leave") leaveCount++;
        if (r.hours_worked) totalHours += Number(r.hours_worked);
      }
    });

    return {
      calendarDays: days,
      stats: {
        presentCount,
        lateCount,
        absentCount,
        halfDayCount,
        leaveCount,
        totalHours: Math.round(totalHours * 10) / 10,
        workingDays: totalDaysInMonth - 8, // rough approximation
      },
    };
  }, [year, month, filteredRecords]);

  return (
    <div className="space-y-4">
      {/* Top Controls & Month Navigator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
            <CalendarIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              {monthName} {year}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isEssMode
                ? `Personal Timesheet Calendar for ${currentEmployee?.full_name || "Employee"}`
                : selectedEmployeeId
                ? `Filtered for employee: ${employees.find((e) => e.id === selectedEmployeeId)?.full_name || "Selected"}`
                : "Company-Wide Attendance Calendar Overview"}
            </p>
          </div>
        </div>

        {/* Action buttons & employee filter */}
        <div className="flex flex-wrap items-center gap-2">
          {!isEssMode && employees.length > 0 && onSelectEmployee && (
            <div className="flex items-center gap-1.5">
              <User className="size-3.5 text-muted-foreground" />
              <select
                value={selectedEmployeeId}
                onChange={(e) => onSelectEmployee(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Employees ({employees.length})</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center border border-border rounded-lg bg-background p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Summary Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
          <p className="text-xl font-bold text-emerald-600">{stats.presentCount}</p>
          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Present</p>
        </div>
        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
          <p className="text-xl font-bold text-amber-600">{stats.lateCount}</p>
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Late Arrivals</p>
        </div>
        <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-center">
          <p className="text-xl font-bold text-blue-600">{stats.halfDayCount}</p>
          <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">Half Days</p>
        </div>
        <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 text-center">
          <p className="text-xl font-bold text-purple-600">{stats.leaveCount}</p>
          <p className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase">Leaves</p>
        </div>
        <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
          <p className="text-xl font-bold text-red-600">{stats.absentCount}</p>
          <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase">Absents</p>
        </div>
        <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-center">
          <p className="text-xl font-bold text-indigo-600">{stats.totalHours}h</p>
          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">Total Hours</p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center font-bold text-xs text-muted-foreground py-2.5">
          <span className="text-rose-500">Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span className="text-indigo-500">Sat</span>
        </div>

        {/* Days Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {calendarDays.map((dayItem, idx) => {
            const hasRecords = dayItem.records.length > 0;
            const primaryRecord = dayItem.records[0];

            let cellBg = "bg-background hover:bg-muted/30";
            if (!dayItem.isCurrentMonth) cellBg = "bg-muted/10 opacity-45";
            else if (dayItem.isToday) cellBg = "bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-inset ring-indigo-500/50";
            else if (dayItem.isWeekend) cellBg = "bg-muted/15";

            return (
              <div
                key={dayItem.dateStr + idx}
                onClick={() => {
                  if (onMarkAttendanceDate) {
                    onMarkAttendanceDate(dayItem.dateStr, selectedEmployeeId || undefined);
                  }
                }}
                className={`min-h-[105px] p-2 flex flex-col justify-between transition-all cursor-pointer group relative ${cellBg}`}
              >
                {/* Date Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`size-6 flex items-center justify-center rounded-full text-xs font-bold ${
                      dayItem.isToday
                        ? "bg-indigo-600 text-white shadow-xs"
                        : dayItem.isCurrentMonth
                        ? "text-foreground group-hover:text-indigo-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {dayItem.date.getDate()}
                  </span>

                  {dayItem.isWeekend && !hasRecords && (
                    <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase">
                      Off
                    </span>
                  )}
                </div>

                {/* Status Indicator & Badges */}
                <div className="my-auto space-y-1">
                  {hasRecords ? (
                    dayItem.records.slice(0, 2).map((rec) => {
                      const cfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.Present;
                      return (
                        <div
                          key={rec.id}
                          className={`p-1 rounded-md border text-[10px] flex flex-col gap-0.5 leading-tight ${cfg.badgeClass}`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="truncate">
                              {isEssMode ? cfg.label : rec.employee_name?.split(" ")[0] || cfg.label}
                            </span>
                            <span>{rec.hours_worked ? `${rec.hours_worked}h` : cfg.icon}</span>
                          </div>
                          {rec.check_in && (
                            <span className="text-[9px] opacity-75 font-mono">
                              {new Date(rec.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {rec.check_out && ` - ${new Date(rec.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : dayItem.isCurrentMonth && !dayItem.isWeekend && dayItem.date <= new Date() ? (
                    <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-muted-foreground font-semibold flex items-center justify-center gap-1">
                        <Plus className="size-3 text-indigo-500" />
                        Mark
                      </span>
                    </div>
                  ) : null}

                  {dayItem.records.length > 2 && (
                    <p className="text-[9px] text-muted-foreground font-bold text-center">
                      +{dayItem.records.length - 2} more
                    </p>
                  )}
                </div>

                {/* Day Footer note / method */}
                <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                  {primaryRecord?.method && (
                    <span className="capitalize font-mono opacity-80">{primaryRecord.method}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-border bg-card text-xs text-muted-foreground">
        <span className="font-bold text-foreground">Legend:</span>
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${cfg.dotClass}`} />
              <span>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
