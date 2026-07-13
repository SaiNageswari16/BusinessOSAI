import os

target = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update employeesApi block
old_employees_api = """export const employeesApi = {
  list: (page = 1, pageSize = 20, search?: string, companyId?: string, departmentId?: string) =>
    request<PaginatedResponse<Employee>>("GET", "/hrms/employees", undefined, {
      page,
      page_size: pageSize,
      search,
      company_id: companyId,
      department_id: departmentId,
    }),
  get: (id: string) => request<Employee>("GET", `/hrms/employees/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Employee>("POST", "/hrms/employees", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Employee>("PATCH", `/hrms/employees/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/hrms/employees/${id}`),
};"""

new_employees_api = """export const employeesApi = {
  list: (page = 1, pageSize = 20, search?: string, companyId?: string, departmentId?: string, status?: string) =>
    request<PaginatedResponse<Employee>>("GET", "/hrms/employees", undefined, {
      page,
      page_size: pageSize,
      search,
      company_id: companyId,
      department_id: departmentId,
      status,
    }),
  get: (id: string) => request<Employee>("GET", `/hrms/employees/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Employee>("POST", "/hrms/employees", data),
  bulkCreate: (employees: Record<string, unknown>[]) =>
    request<{ message: string; created_count: number; skipped_count: number; errors: string[] }>("POST", "/hrms/employees/bulk", { employees }),
  update: (id: string, data: Record<string, unknown>) =>
    request<Employee>("PATCH", `/hrms/employees/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/hrms/employees/${id}`),
  listDocuments: (empId: string) =>
    request<EmployeeDocument[]>("GET", `/hrms/employees/${empId}/documents`),
  createDocument: (empId: string, data: Record<string, unknown>) =>
    request<EmployeeDocument>("POST", `/hrms/employees/${empId}/documents`, data),
};"""

# 2. Update attendanceApi block
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
  checkIn: (data: { latitude?: number; longitude?: number; notes?: string; method: string }) =>
    request<AttendanceRecord>("POST", "/hrms/attendance/check-in", data),
  checkOut: (data: { latitude?: number; longitude?: number; notes?: string }) =>
    request<AttendanceRecord>("POST", "/hrms/attendance/check-out", data),
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

# 3. Types to append at the end
new_types = """
// ─── Extended HRMS Types ──────────────────────────────────────────────────────

export interface EmployeeDocument {
  id: string;
  tenant_id: string;
  employee_id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  upload_date: string;
  expiry_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BiometricDevice {
  id: string;
  tenant_id: string;
  device_code: string;
  location: string;
  model: string;
  enrolled_employees: number;
  last_sync: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FaceRecognitionLog {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  employee_name: string | null;
  timestamp: string;
  confidence: number;
  location: string;
  action: string;
  status: string;
  created_at: string;
}

export interface AttendanceCorrection {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string | null;
  date: string;
  original_status: string;
  original_check_in: string | null;
  original_check_out: string | null;
  corrected_status: string;
  corrected_check_in: string | null;
  corrected_check_out: string | null;
  reason: string;
  status: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HrmsDashboardStats {
  total_employees: number;
  active_employees: number;
  on_leave: number;
  new_joinees: number;
  avg_attendance: number;
  attrition_rate: number;
}
"""

line_ending = "\r\n" if "\r\n" in content else "\n"

# Apply replacements
if old_employees_api.replace("\r\n", "\n") in content.replace("\r\n", "\n"):
    content = content.replace(old_employees_api.replace("\n", line_ending), new_employees_api.replace("\n", line_ending))
if old_attendance_api.replace("\r\n", "\n") in content.replace("\r\n", "\n"):
    content = content.replace(old_attendance_api.replace("\n", line_ending), new_attendance_api.replace("\n", line_ending))

# Append types
content += new_types.replace("\n", line_ending)

with open(target, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("Updated api-client.ts successfully with HRMS APIs")
