import os

target = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace AttendanceRecord interface
old_att_interface = """export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  hours_worked: number | null;
  overtime_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}"""

new_att_interface = """export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  hours_worked: number | null;
  overtime_hours: number | null;
  notes: string | null;
  latitude?: number | null;
  longitude?: number | null;
  method?: string | null;
  created_at: string;
  updated_at: string;
}"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(old_att_interface.replace("\n", line_ending), new_att_interface.replace("\n", line_ending))

# 2. Replace LeaveRequest interface
old_leave_interface = """export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  days_requested: number;
  reason: string | null;
  created_at: string;
  updated_at: string;
}"""

new_leave_interface = """export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string;
  department?: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  days_requested: number;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}"""

content = content.replace(old_leave_interface.replace("\n", line_ending), new_leave_interface.replace("\n", line_ending))

# 3. Replace Payslip interface to add pdf_url
old_payslip_interface = """export interface Payslip {
  id: string;
  tenant_id: string;
  employee_id: string;
  month: number;
  year: number;
  basic_salary: number;
  hra: number;
  other_allowances: number;
  pf_deduction: number;
  esi_deduction: number;
  tds_deduction: number;
  other_deductions: number;
  gross_salary: number;
  net_salary: number;
  status: string;
  created_at: string;
  updated_at: string;
}"""

new_payslip_interface = """export interface Payslip {
  id: string;
  tenant_id: string;
  employee_id: string;
  month: number;
  year: number;
  basic_salary: number;
  hra: number;
  other_allowances: number;
  pf_deduction: number;
  esi_deduction: number;
  tds_deduction: number;
  other_deductions: number;
  gross_salary: number;
  net_salary: number;
  status: string;
  pdf_url?: string | null;
  created_at: string;
  updated_at: string;
}"""

content = content.replace(old_payslip_interface.replace("\n", line_ending), new_payslip_interface.replace("\n", line_ending))

# 4. Replace attendanceApi methods
old_attendance_api = """export const attendanceApi = {
  list: (page = 1, pageSize = 50, employeeId?: string, dateFrom?: string, dateTo?: string) =>
    request<PaginatedResponse<AttendanceRecord>>("GET", "/hrms/attendance", undefined, {
      page,
      page_size: pageSize,
      employee_id: employeeId,
      date_from: dateFrom,
      date_to: dateTo,
    }),
  create: (data: Record<string, unknown>) =>
    request<AttendanceRecord>("POST", "/hrms/attendance", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<AttendanceRecord>("PATCH", `/hrms/attendance/${id}`, data),
  checkIn: (data: { latitude?: number; longitude?: number; notes?: string; method: string }) =>
    request<AttendanceRecord>("POST", "/hrms/attendance/check-in", data),
  checkOut: (data: { latitude?: number; longitude?: number; notes?: string }) =>
    request<AttendanceRecord>("POST", "/hrms/attendance/check-out", data),
  delete: (id: string) =>
    request<any>("DELETE", `/hrms/attendance/${id}`),
  getStats: () =>
    request<HrmsDashboardStats>("GET", "/hrms/attendance/stats"),
  listBiometric: () =>
    request<BiometricDevice[]>("GET", "/hrms/attendance/biometric"),
  syncBiometric: () =>
    request<{ message: string }>("POST", "/hrms/attendance/biometric/sync"),
  listFaceLogs: () =>
    request<FaceRecognitionLog[]>("GET", "/hrms/attendance/face-logs"),
  listCorrections: () =>
    request<AttendanceCorrection[]>("GET", "/hrms/attendance/corrections"),
  createCorrection: (data: Record<string, unknown>) =>
    request<AttendanceCorrection>("POST", "/hrms/attendance/corrections", data),
  reviewCorrection: (id: string, status: string) =>
    request<AttendanceCorrection>("PATCH", `/hrms/attendance/corrections/${id}/review`, { status }),
};"""

new_attendance_api = """export const attendanceApi = {
  list: (page = 1, pageSize = 50, employeeId?: string, dateFrom?: string, dateTo?: string) =>
    request<PaginatedResponse<AttendanceRecord>>("GET", "/hrms/attendance", undefined, {
      page,
      page_size: pageSize,
      employee_id: employeeId,
      date_from: dateFrom,
      date_to: dateTo,
    }),
  create: (data: Record<string, unknown>) =>
    request<AttendanceRecord>("POST", "/hrms/attendance", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<AttendanceRecord>("PATCH", `/hrms/attendance/${id}`, data),
  checkIn: (data: { employee_id?: string; latitude?: number; longitude?: number; notes?: string; method: string }) =>
    request<AttendanceRecord>("POST", "/hrms/attendance/check-in", data),
  checkOut: (data: { employee_id?: string; latitude?: number; longitude?: number; notes?: string }) =>
    request<AttendanceRecord>("POST", "/hrms/attendance/check-out", data),
  delete: (id: string) =>
    request<any>("DELETE", `/hrms/attendance/${id}`),
  getStats: () =>
    request<HrmsDashboardStats>("GET", "/hrms/attendance/stats"),
  listBiometric: () =>
    request<BiometricDevice[]>("GET", "/hrms/attendance/biometric"),
  syncBiometric: () =>
    request<{ message: string }>("POST", "/hrms/attendance/biometric/sync"),
  listFaceLogs: () =>
    request<FaceRecognitionLog[]>("GET", "/hrms/attendance/face-logs"),
  createFaceLog: (data: { employee_id: string; confidence: number; location: string; action: string; status: string }) =>
    request<FaceRecognitionLog>("POST", "/hrms/attendance/face-logs", data),
  listCorrections: () =>
    request<AttendanceCorrection[]>("GET", "/hrms/attendance/corrections"),
  createCorrection: (data: Record<string, unknown>) =>
    request<AttendanceCorrection>("POST", "/hrms/attendance/corrections", data),
  reviewCorrection: (id: string, status: string) =>
    request<AttendanceCorrection>("PATCH", `/hrms/attendance/corrections/${id}/review`, { status }),
};"""

content = content.replace(old_attendance_api.replace("\n", line_ending), new_attendance_api.replace("\n", line_ending))

# 5. Append missing interfaces at the end
interfaces_block = """
export interface LeaveBalance {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string;
  leave_type: string;
  total_days: number;
  used_days: number;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface LeavePolicy {
  id: string;
  tenant_id: string;
  name: string;
  leave_type: string;
  entitled_days: number;
  applicable_to: string;
  created_at: string;
  updated_at: string;
}

export interface PayGrade {
  id: string;
  tenant_id: string;
  name: string;
  designation_id: string;
  designation_name?: string;
  basic_salary: number;
  hra: number;
  other_allowances: number;
  pf_deduction: number;
  esi_deduction: number;
  tds_deduction: number;
  created_at: string;
  updated_at: string;
}
"""

if "export interface LeaveBalance" not in content:
    content += interfaces_block.replace("\n", line_ending)

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Successfully fixed schemas and APIs in frontend api-client.ts")
