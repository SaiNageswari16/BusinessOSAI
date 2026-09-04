import { apiClient } from './apiClient';

export interface EmployeeItem {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  initials: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  reporting_manager: string;
  joined_date: string;
  employment_type: string;
  status: string;
  salary: number;
  avatar: string;
  skills: string[];
  gym_branch: string;
  emergency_contact: string;
  created_at?: string;
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  description: string;
  head_name: string;
  is_active: boolean;
  employee_count: number;
}

export interface DesignationItem {
  id: string;
  title: string;
  department: string;
  level: string;
  description: string;
  employee_count: number;
}

export interface TeamItem {
  id: string;
  name: string;
  department: string;
  lead_name: string;
  description: string;
}

export interface DocumentItem {
  id: string;
  employee_id: string;
  employee_name: string;
  title: string;
  doc_type: string;
  file_size: string;
  status: string;
  uploaded_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  initials: string;
  designation: string;
  department: string;
  date: string;
  check_in: string;
  check_out: string;
  status: string;
  work_hours: number;
  notes: string;
}

export interface LeaveItem {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  approved_by: string;
  applied_on: string;
}

export interface PayrollItem {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  initials: string;
  designation: string;
  department: string;
  month: string;
  year: number;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  status: string;
  payment_method: string;
  payment_date: string;
}

export interface RecruitmentJobItem {
  id: string;
  title: string;
  department: string;
  openings: number;
  job_type: string;
  experience: string;
  salary_range: string;
  status: string;
  posted_date: string;
  applicant_count: number;
}

export interface ApplicantItem {
  id: string;
  job_id?: string;
  job_title: string;
  department: string;
  name: string;
  email: string;
  phone: string;
  stage: string;
  experience_years: number;
  rating: number;
  applied_date: string;
}

export interface RecruitmentOverview {
  jobs: RecruitmentJobItem[];
  applicants: ApplicantItem[];
  total_openings: number;
  total_applicants: number;
}

export interface PerformanceItem {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  initials: string;
  designation: string;
  department: string;
  review_period: string;
  score: number;
  kpi_ratings: Array<{
    kpi: string;
    target: string;
    achieved: string;
    score: number;
  }>;
  feedback: string;
  reviewer: string;
  status: string;
}

export interface ExitItem {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  initials: string;
  designation: string;
  department: string;
  resignation_date: string;
  last_working_day: string;
  reason: string;
  handover_status: string;
  settlement_status: string;
  status: string;
}

export const hrmsApi = {
  // Employees
  getEmployees: (params?: { department?: string; status?: string; search?: string }) =>
    apiClient.get<EmployeeItem[]>('/hrms/employees', { params }),
  createEmployee: (payload: Partial<EmployeeItem>) =>
    apiClient.post<{ message: string; id: string; code: string }>('/hrms/employees', payload),
  updateEmployee: (empId: string, payload: Partial<EmployeeItem>) =>
    apiClient.put<{ message: string }>(`/hrms/employees/${empId}`, payload),
  deleteEmployee: (empId: string) =>
    apiClient.delete<{ message: string }>(`/hrms/employees/${empId}`),

  // Organization
  getDepartments: () => apiClient.get<DepartmentItem[]>('/hrms/departments'),
  getDesignations: () => apiClient.get<DesignationItem[]>('/hrms/designations'),
  getTeams: () => apiClient.get<TeamItem[]>('/hrms/teams'),
  getDocuments: (employee_id?: string) =>
    apiClient.get<DocumentItem[]>('/hrms/documents', { params: { employee_id } }),

  // Attendance
  getAttendance: (date?: string) =>
    apiClient.get<AttendanceRecord[]>('/hrms/attendance', { params: { date } }),
  recordPunch: (payload: { employee_id: string; action: 'CHECK_IN' | 'CHECK_OUT'; note?: string }) =>
    apiClient.post<{ message: string }>('/hrms/attendance/punch', payload),

  // Leave
  getLeaves: () => apiClient.get<LeaveItem[]>('/hrms/leaves'),
  applyLeave: (payload: { employee_id: string; leave_type: string; start_date: string; end_date: string; reason: string }) =>
    apiClient.post<{ message: string; id: string }>('/hrms/leaves', payload),
  updateLeaveStatus: (leaveId: string, payload: { status: string; reviewer?: string }) =>
    apiClient.put<{ message: string }>(`/hrms/leaves/${leaveId}/action`, payload),

  // Payroll
  getPayroll: (month?: string, year?: number) =>
    apiClient.get<PayrollItem[]>('/hrms/payroll', { params: { month, year } }),
  processPayout: (payrollId: string, payload: { status: string }) =>
    apiClient.put<{ message: string }>(`/hrms/payroll/${payrollId}/payout`, payload),

  // Recruitment
  getRecruitment: () => apiClient.get<RecruitmentOverview>('/hrms/recruitment'),
  updateApplicantStage: (applicantId: string, stage: string) =>
    apiClient.put<{ message: string }>(`/hrms/recruitment/applicants/${applicantId}/stage`, { stage }),

  // Performance
  getPerformance: () => apiClient.get<PerformanceItem[]>('/hrms/performance'),

  // Exit
  getExitRequests: () => apiClient.get<ExitItem[]>('/hrms/exit'),
  updateExitStatus: (exitId: string, payload: { status?: string; handover_status?: string; settlement_status?: string }) =>
    apiClient.put<{ message: string }>(`/hrms/exit/${exitId}`, payload),
};
