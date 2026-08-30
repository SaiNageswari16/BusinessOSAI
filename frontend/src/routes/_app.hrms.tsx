import React from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ComingSoon } from "@/components/coming-soon";
import { useRbac } from "@/contexts/rbac-context";
import { Unauthorized } from "@/components/unauthorized";

import { EmployeeManagement } from "@/components/hrms/EmployeeManagement";
import { AttendanceManagement } from "@/components/hrms/AttendanceManagement";
import { LeaveManagement } from "@/components/hrms/LeaveManagement";
import { PayrollManagement } from "@/components/hrms/PayrollManagement";
import { RecruitmentManagement } from "@/components/hrms/RecruitmentManagement";
import { PerformanceManagement } from "@/components/hrms/PerformanceManagement";
import { LearningManagement } from "@/components/hrms/LearningManagement";
import { EmployeeSelfService } from "@/components/hrms/EmployeeSelfService";
import { ExitManagement } from "@/components/hrms/ExitManagement";
import { HRIntelligence } from "@/components/hrms/HRIntelligence";

export const Route = createFileRoute("/_app/hrms")({
  component: HrmsModule,
});

const componentMap: Record<string, React.ElementType> = {
  // Employee Management
  employees:        EmployeeManagement,
  departments:      EmployeeManagement,
  designations:     EmployeeManagement,
  teams:            EmployeeManagement,
  documents:        EmployeeManagement,
  employee_profile: EmployeeManagement,

  // Attendance
  daily_attendance:       AttendanceManagement,
  biometric:              AttendanceManagement,
  face_recognition:       AttendanceManagement,
  gps_attendance:         AttendanceManagement,
  shift_attendance:       AttendanceManagement,
  attendance_corrections: AttendanceManagement,

  // Leave
  leave_requests:  LeaveManagement,
  leave_calendar:  LeaveManagement,
  leave_balance:   LeaveManagement,
  leave_policies:  LeaveManagement,
  approvals:       LeaveManagement,

  // Payroll
  salary_structure:   PayrollManagement,
  pay_grades:         PayrollManagement,
  payroll_processing: PayrollManagement,
  pf:                 PayrollManagement,
  esi:                PayrollManagement,
  tds:                PayrollManagement,
  payslips:           PayrollManagement,
  loans:              PayrollManagement,
  advances:           PayrollManagement,
  bonuses:            PayrollManagement,
  commissions:        PayrollManagement,

  // Recruitment
  job_openings:  RecruitmentManagement,
  applicants:    RecruitmentManagement,
  interviews:    RecruitmentManagement,
  offer_letters: RecruitmentManagement,
  onboarding:    RecruitmentManagement,

  // Performance
  goals:               PerformanceManagement,
  kpis:                PerformanceManagement,
  appraisals:          PerformanceManagement,
  performance_reviews: PerformanceManagement,
  incentives:          PerformanceManagement,

  // Learning
  training:    LearningManagement,
  courses:     LearningManagement,
  certificates: LearningManagement,
  assessments: LearningManagement,

  // ESS
  ess_attendance:    EmployeeSelfService,
  ess_leaves:        EmployeeSelfService,
  ess_payroll:       EmployeeSelfService,
  ess_documents:     EmployeeSelfService,
  ess_tasks:         EmployeeSelfService,
  ess_performance:   EmployeeSelfService,
  ess_learning:      EmployeeSelfService,
  ess_announcements: EmployeeSelfService,

  // Exit Management
  resignation:      ExitManagement,
  clearance:        ExitManagement,
  final_settlement: ExitManagement,
  experience_letter: ExitManagement,

  // HR Intelligence
  attendance_analytics:     HRIntelligence,
  payroll_analytics:        HRIntelligence,
  attrition_prediction:     HRIntelligence,
  shift_optimization:       HRIntelligence,
  productivity_score:       HRIntelligence,
  training_recommendation:  HRIntelligence,
};

const tabPermissions: Record<string, string> = {
  // Employee Management
  employees:        "view:hrms_employees",
  departments:      "view:hrms_departments",
  designations:     "view:hrms_designations",
  teams:            "view:hrms_teams",
  documents:        "view:hrms_documents",
  employee_profile: "view:hrms_profiles",

  // Attendance
  daily_attendance:       "view:hrms_attendance",
  biometric:              "view:hrms_biometric",
  face_recognition:       "view:hrms_face",
  gps_attendance:         "view:hrms_gps",
  shift_attendance:       "view:hrms_shifts",
  attendance_corrections: "view:hrms_corrections",

  // Leave
  leave_requests:  "view:hrms_leaves",
  leave_calendar:  "view:hrms_leave_calendar",
  leave_balance:   "view:hrms_leave_balance",
  leave_policies:  "view:hrms_leave_policies",
  approvals:       "view:hrms_leave_approvals",

  // Payroll
  salary_structure:   "view:hrms_salary_structure",
  pay_grades:         "view:hrms_pay_grades",
  payroll_processing: "view:hrms_payroll_processing",
  pf:                 "view:hrms_pf_esi",
  esi:                "view:hrms_pf_esi",
  tds:                "view:hrms_tds",
  payslips:           "view:hrms_payslips",
  loans:              "view:hrms_loans_advances",
  advances:           "view:hrms_loans_advances",
  bonuses:            "view:hrms_bonuses_commissions",
  commissions:        "view:hrms_bonuses_commissions",

  // Recruitment
  job_openings:  "view:hrms_recruitment",
  applicants:    "view:hrms_recruitment",
  interviews:    "view:hrms_recruitment",
  offer_letters: "view:hrms_onboarding",
  onboarding:    "view:hrms_onboarding",

  // Performance
  goals:               "view:hrms_performance",
  kpis:                "view:hrms_performance",
  appraisals:          "view:hrms_performance",
  performance_reviews: "view:hrms_performance",
  incentives:          "view:hrms_performance",

  // Learning
  training:    "view:hrms_learning",
  courses:     "view:hrms_learning",
  certificates: "view:hrms_learning",
  assessments: "view:hrms_learning",

  // ESS
  ess_attendance:    "view:ess_attendance",
  ess_leaves:        "view:ess_leaves",
  ess_payroll:       "view:ess_payroll",
  ess_documents:     "view:ess_documents",
  ess_tasks:         "view:ess_tasks_announcements",
  ess_performance:   "view:ess_tasks_announcements",
  ess_learning:      "view:ess_tasks_announcements",
  ess_announcements: "view:ess_tasks_announcements",

  // Exit Management
  resignation:      "view:hrms_exit",
  clearance:        "view:hrms_exit",
  final_settlement: "view:hrms_exit",
  experience_letter: "view:hrms_exit",

  // HR Intelligence
  attendance_analytics:     "view:hrms_intelligence",
  payroll_analytics:        "view:hrms_intelligence",
  attrition_prediction:     "view:hrms_intelligence",
  shift_optimization:       "view:hrms_intelligence",
  productivity_score:       "view:hrms_intelligence",
  training_recommendation:  "view:hrms_intelligence",
};

function HrmsModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  const { hasPermission } = useRbac();
  
  if (!hasPermission("view:hrms")) {
    return <Unauthorized />;
  }

  let activeTab = "employees";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "employees";
  }

  const formatTitle = (str: string) =>
    str.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const ActiveComponent = componentMap[activeTab] || (() => <ComingSoon title={formatTitle(activeTab)} />);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 relative bg-background/50 p-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            <ComponentErrorBoundary componentName={activeTab}>
              <ActiveComponent tab={activeTab} />
            </ComponentErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

class ComponentErrorBoundary extends React.Component<
  { componentName: string; children: React.ReactNode },
  { error: Error | null; stack: string | null }
> {
  state = { error: null as Error | null, stack: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error, stack: error.stack || null };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[HRMS:ComponentErrorBoundary:${this.props.componentName}]`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 space-y-3 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl">
          <h2 className="text-lg font-bold text-red-600">Component Error: {this.props.componentName}</h2>
          <p className="text-sm text-foreground font-mono">{this.state.error.message}</p>
          <pre className="text-[10px] bg-muted p-3 rounded overflow-auto max-h-60">{this.state.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
