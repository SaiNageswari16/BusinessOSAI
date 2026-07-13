import os

target = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

old_leaves_api = """export const leavesApi = {
  list: (page = 1, pageSize = 20, employeeId?: string, status?: string) =>
    request<PaginatedResponse<LeaveRequest>>("GET", "/hrms/leaves", undefined, {
      page,
      page_size: pageSize,
      employee_id: employeeId,
      status,
    }),
  get: (id: string) => request<LeaveRequest>("GET", `/hrms/leaves/${id}`),
  create: (data: Record<string, unknown>) =>
    request<LeaveRequest>("POST", "/hrms/leaves", data),
  approve: (id: string) => request<LeaveRequest>("POST", `/hrms/leaves/${id}/approve`),
  reject: (id: string, reason?: string) =>
    request<LeaveRequest>("POST", `/hrms/leaves/${id}/reject`, { reason }),
};"""

new_leaves_api = """export const leavesApi = {
  list: (page = 1, pageSize = 20, employeeId?: string, status?: string) =>
    request<PaginatedResponse<LeaveRequest>>("GET", "/hrms/leaves", undefined, {
      page,
      page_size: pageSize,
      employee_id: employeeId,
      status_filter: status,
    }),
  listBalances: (employeeId?: string) =>
    request<LeaveBalance[]>("GET", "/hrms/leaves/balances", undefined, { employee_id: employeeId }),
  get: (id: string) => request<LeaveRequest>("GET", `/hrms/leaves/${id}`),
  create: (data: Record<string, unknown>) =>
    request<LeaveRequest>("POST", "/hrms/leaves", data),
  approve: (id: string) => request<LeaveRequest>("PATCH", `/hrms/leaves/${id}/review`, { status: "Approved" }),
  reject: (id: string, reason?: string) =>
    request<LeaveRequest>("PATCH", `/hrms/leaves/${id}/review`, { status: "Rejected" }),
};"""

old_payroll_api = """export const payrollApi = {
  listPayslips: (page = 1, pageSize = 20, employeeId?: string, year?: number, month?: number) =>
    request<PaginatedResponse<Payslip>>("GET", "/hrms/payroll/payslips", undefined, {
      page,
      page_size: pageSize,
      employee_id: employeeId,
      year,
      month,
    }),
  generatePayslip: (data: Record<string, unknown>) =>
    request<Payslip>("POST", "/hrms/payroll/payslips", data),
};"""

new_payroll_api = """export const payrollApi = {
  listPayslips: (employeeId?: string) =>
    request<Payslip[]>("GET", "/hrms/payslips", undefined, {
      employee_id: employeeId,
    }),
  listSalaryStructures: () =>
    request<SalaryStructure[]>("GET", "/hrms/salary-structures"),
  createSalaryStructure: (data: Record<string, unknown>) =>
    request<SalaryStructure>("POST", "/hrms/salary-structures", data),
  generatePayslip: (data: Record<string, unknown>) =>
    request<Payslip[]>("POST", "/hrms/payslips/process", data),
};"""

# Make sure we add SalaryStructure interface and LeaveBalance interface
# Let's inspect where Payslip is in api-client.ts (line ~314) and add them
payslip_interface_block = """export interface Payslip {
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
  employee_name?: string;
  employee_code?: string;
}"""

new_interfaces_block = payslip_interface_block + """

export interface SalaryStructure {
  id: string;
  tenant_id: string;
  employee_id: string;
  basic_salary: number;
  hra: number;
  other_allowances: number;
  pf_deduction: number;
  esi_deduction: number;
  tds_deduction: number;
  other_deductions: number;
  net_salary: number;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  designation?: string;
  department?: string;
}

export interface LeaveBalance {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: string;
  total_days: number;
  used_days: number;
  balance: number;
  employee_name?: string;
}"""

line_ending = "\r\n" if "\r\n" in content else "\n"

content = content.replace(old_leaves_api.replace("\n", line_ending), new_leaves_api.replace("\n", line_ending))
content = content.replace(old_payroll_api.replace("\n", line_ending), new_payroll_api.replace("\n", line_ending))
content = content.replace(payslip_interface_block.replace("\n", line_ending), new_interfaces_block.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Aligned frontend api-client.ts leavesApi and payrollApi successfully")
