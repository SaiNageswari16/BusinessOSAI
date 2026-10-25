import React, { useState, useEffect } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  Users,
  Clock,
  Compass,
  Calendar,
  DollarSign,
  FileText,
  UserCheck,
  TrendingUp,
  GraduationCap,
  Smartphone,
  LogOut,
  BrainCircuit,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { EmployeeManagement } from "./EmployeeManagement";
import { AttendanceManagement } from "./AttendanceManagement";
import { EmployeeRouteMapStudio } from "./EmployeeRouteMapStudio";
import { LeaveManagement } from "./LeaveManagement";
import { PayrollManagement } from "./PayrollManagement";
import { PayslipTemplateStudio } from "./PayslipTemplateStudio";
import { RecruitmentManagement } from "./RecruitmentManagement";
import { PerformanceManagement } from "./PerformanceManagement";
import { LearningManagement } from "./LearningManagement";
import { EmployeeSelfService } from "./EmployeeSelfService";
import { ExitManagement } from "./ExitManagement";
import { HRIntelligence } from "./HRIntelligence";

export interface StudioTab {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  defaultSubtab: string;
  subtabs: { id: string; label: string }[];
  component: React.ElementType;
}

export const HRMS_STUDIOS: StudioTab[] = [
  {
    id: "employees",
    label: "Employees",
    icon: Users,
    defaultSubtab: "employees",
    subtabs: [
      { id: "employees", label: "Staff Directory" },
      { id: "departments", label: "Departments" },
      { id: "designations", label: "Designations" },
      { id: "teams", label: "Teams" },
      { id: "org_chart", label: "Organization Chart" },
      { id: "documents", label: "KYC Vault" },
    ],
    component: EmployeeManagement,
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: Clock,
    defaultSubtab: "daily_attendance",
    subtabs: [
      { id: "daily_attendance", label: "Daily Attendance" },
      { id: "attendance_settings", label: "Shift Schemes & Rules" },
      { id: "biometric", label: "Biometric Hardware" },
      { id: "face_recognition", label: "Face Recognition" },
      { id: "gps_attendance", label: "GPS Geofencing" },
      { id: "attendance_corrections", label: "Correction Requests" },
    ],
    component: AttendanceManagement,
  },
  {
    id: "travel_routes",
    label: "Field Radar",
    icon: Compass,
    badge: "GPS Live",
    defaultSubtab: "travel_routes",
    subtabs: [
      { id: "travel_routes", label: "Live Field Radar" },
      { id: "travel_route_map", label: "Shift Trail Replay" },
      { id: "field_tracking", label: "Battery & Disconnects" },
    ],
    component: EmployeeRouteMapStudio,
  },
  {
    id: "leaves",
    label: "Leaves",
    icon: Calendar,
    defaultSubtab: "leave_requests",
    subtabs: [
      { id: "leave_requests", label: "Applications" },
      { id: "leave_balance", label: "Employee Balances" },
      { id: "leave_calendar", label: "Team Leave Calendar" },
      { id: "leave_policies", label: "Leave Policies" },
      { id: "approvals", label: "Manager Approvals" },
    ],
    component: LeaveManagement,
  },
  {
    id: "payroll",
    label: "Payroll",
    icon: DollarSign,
    defaultSubtab: "payroll_processing",
    subtabs: [
      { id: "payroll_processing", label: "Monthly Run" },
      { id: "salary_structure", label: "Salary Structures" },
      { id: "pay_grades", label: "Pay Grades" },
      { id: "payslips", label: "Payslip Registry" },
      { id: "loans", label: "Loans & Advances" },
      { id: "bonuses", label: "Bonuses & Statutory" },
      { id: "commissions", label: "Sales Commissions" },
    ],
    component: PayrollManagement,
  },
  {
    id: "payslip_templates",
    label: "Payslip Studio",
    icon: FileText,
    badge: "Designer",
    defaultSubtab: "payslip_templates",
    subtabs: [{ id: "payslip_templates", label: "Template Visual Designer" }],
    component: PayslipTemplateStudio,
  },
  {
    id: "recruitment",
    label: "Recruitment & ATS",
    icon: UserCheck,
    badge: "ATS",
    defaultSubtab: "job_openings",
    subtabs: [
      { id: "job_openings", label: "Job Openings" },
      { id: "applicants", label: "Candidate Kanban" },
      { id: "interviews", label: "Interview Rounds" },
      { id: "offer_letters", label: "Offer Studio & e-Sign" },
      { id: "onboarding", label: "Onboarding Checklist" },
    ],
    component: RecruitmentManagement,
  },
  {
    id: "performance",
    label: "Performance",
    icon: TrendingUp,
    defaultSubtab: "goals",
    subtabs: [
      { id: "goals", label: "Goals & OKRs" },
      { id: "kpis", label: "KPI Metric Tracker" },
      { id: "appraisals", label: "Appraisal Cycles" },
      { id: "incentives", label: "Performance Incentives" },
    ],
    component: PerformanceManagement,
  },
  {
    id: "learning",
    label: "LMS & Training",
    icon: GraduationCap,
    defaultSubtab: "courses",
    subtabs: [
      { id: "courses", label: "Course Catalog" },
      { id: "certificates", label: "Certifications" },
      { id: "assessments", label: "Skill Assessments" },
    ],
    component: LearningManagement,
  },
  {
    id: "ess",
    label: "Employee Portal",
    icon: Smartphone,
    badge: "ESS",
    defaultSubtab: "my_profile",
    subtabs: [
      { id: "my_profile", label: "My Profile" },
      { id: "my_attendance", label: "My Attendance" },
      { id: "apply_leave", label: "Apply Leave" },
      { id: "my_payslips", label: "My Payslips" },
      { id: "ess_documents", label: "My Letters & KYC" },
      { id: "team_summary", label: "My Team Overview" },
    ],
    component: EmployeeSelfService,
  },
  {
    id: "exit",
    label: "Exit Management",
    icon: LogOut,
    defaultSubtab: "resignation",
    subtabs: [
      { id: "resignation", label: "Resignations" },
      { id: "clearance", label: "Departmental Clearance" },
      { id: "final_settlement", label: "Full & Final Settlement" },
      { id: "experience_letter", label: "Relieving Letters" },
    ],
    component: ExitManagement,
  },
  {
    id: "intelligence",
    label: "HR Intelligence",
    icon: BrainCircuit,
    badge: "AI",
    defaultSubtab: "attrition_prediction",
    subtabs: [
      { id: "attrition_prediction", label: "AI Attrition Forecast" },
      { id: "attendance_analytics", label: "Attendance Heatmap" },
      { id: "payroll_analytics", label: "Payroll Budget Analytics" },
      { id: "productivity_score", label: "Workforce Velocity" },
      { id: "shift_optimization", label: "Smart Shift Optimizer" },
      { id: "training_recommendation", label: "Skill Gap Advisor" },
    ],
    component: HRIntelligence,
  },
];

export function HrmsStudioSuite() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;

  const getInitialTab = () => {
    if (searchStr.includes("tab=")) {
      const params = new URLSearchParams(searchStr);
      const tabParam = params.get("tab") || "";
      for (const s of HRMS_STUDIOS) {
        if (s.id === tabParam || s.subtabs.some((st) => st.id === tabParam)) {
          return { studioId: s.id, subtabId: tabParam };
        }
      }
    }
    return { studioId: "employees", subtabId: "employees" };
  };

  const [activeStudioId, setActiveStudioId] = useState(getInitialTab().studioId);
  const [activeSubtabId, setActiveSubtabId] = useState(getInitialTab().subtabId);

  useEffect(() => {
    if (searchStr.includes("tab=")) {
      const params = new URLSearchParams(searchStr);
      const tabParam = params.get("tab") || "";
      for (const s of HRMS_STUDIOS) {
        if (s.id === tabParam || s.subtabs.some((st) => st.id === tabParam)) {
          setActiveStudioId(s.id);
          setActiveSubtabId(tabParam);
          break;
        }
      }
    }
  }, [searchStr]);

  const currentStudio =
    HRMS_STUDIOS.find((s) => s.id === activeStudioId) || HRMS_STUDIOS[0];

  const handleStudioSelect = (studio: StudioTab) => {
    setActiveStudioId(studio.id);
    setActiveSubtabId(studio.defaultSubtab);
    // Push tab parameter to URL for bookmarking without page refresh
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", studio.defaultSubtab);
      window.history.pushState({}, "", url.toString());
    }
  };

  const handleSubtabSelect = (subtabId: string) => {
    setActiveSubtabId(subtabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", subtabId);
      window.history.pushState({}, "", url.toString());
    }
  };

  const ActiveComponent = currentStudio.component;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Top Studio Selector Ribbon */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md px-4 py-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            {HRMS_STUDIOS.map((studio) => {
              const Icon = studio.icon;
              const isActive = studio.id === activeStudioId;
              return (
                <button
                  key={studio.id}
                  onClick={() => handleStudioSelect(studio)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 relative",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{studio.label}</span>
                  {studio.badge && (
                    <span
                      className={cn(
                        "ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider",
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {studio.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap pl-2 border-l border-border">
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="font-semibold text-foreground">RestaurantOS HRMS Suite</span>
          </div>
        </div>

        {/* Sub-Tabs Ribbon */}
        {currentStudio.subtabs && currentStudio.subtabs.length > 1 && (
          <div className="flex items-center gap-1 pt-2.5 mt-2 border-t border-border/50 overflow-x-auto no-scrollbar">
            {currentStudio.subtabs.map((subtab) => {
              const isSubActive = subtab.id === activeSubtabId;
              return (
                <button
                  key={subtab.id}
                  onClick={() => handleSubtabSelect(subtab.id)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    isSubActive
                      ? "bg-secondary text-secondary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  {subtab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Studio Viewport */}
      <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
        <StudioErrorBoundary studioName={currentStudio.label}>
          <ActiveComponent tab={activeSubtabId} subtab={activeSubtabId} />
        </StudioErrorBoundary>
      </main>
    </div>
  );
}

class StudioErrorBoundary extends React.Component<
  { studioName: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[HRMS Studio Error: ${this.props.studioName}]`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 rounded-2xl bg-destructive/10 border border-destructive/20 text-center space-y-4">
          <h2 className="text-xl font-bold text-destructive">
            {this.props.studioName} Encountered an Issue
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto font-mono">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
          >
            Reload Studio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
