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
  approvals:       LeaveManagement,

  // Payroll
  salary_structure:   PayrollManagement,
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

function HrmsModule() {
  const routerState = useRouterState();
  const searchStr = routerState.location.searchStr;
  const { hasPermission } = useRbac();
  
  if (!hasPermission("view:hrms")) {
    return <Unauthorized />;
  }

  let activeTab = "dashboard";
  if (searchStr.includes("tab=")) {
    const params = new URLSearchParams(searchStr);
    activeTab = params.get("tab") || "employees";
  }

  const formatTitle = (str: string) =>
    str.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const ActiveComponent = componentMap[activeTab] || (() => <ComingSoon title={formatTitle(activeTab)} />);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <main className="flex-1 overflow-y-auto relative bg-background/50">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            <ActiveComponent tab={activeTab} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
