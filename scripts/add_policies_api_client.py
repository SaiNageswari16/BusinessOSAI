import os

target = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# Append TS Interfaces for LeavePolicy and PayGrade
interfaces_target = """export interface LeaveBalance {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: string;
  total_days: number;
  used_days: number;
  balance: number;
  employee_name?: string;
}"""

interfaces_block = interfaces_target + """

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
}"""

line_ending = "\r\n" if "\r\n" in content else "\n"
content = content.replace(interfaces_target.replace("\n", line_ending), interfaces_block.replace("\n", line_ending))

# Append methods inside leavesApi in api-client.ts
old_leaves_api = """export const leavesApi = {
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
  listPolicies: () =>
    request<LeavePolicy[]>("GET", "/hrms/leaves/policies"),
  createPolicy: (data: Record<string, unknown>) =>
    request<LeavePolicy>("POST", "/hrms/leaves/policies", data),
  get: (id: string) => request<LeaveRequest>("GET", `/hrms/leaves/${id}`),
  create: (data: Record<string, unknown>) =>
    request<LeaveRequest>("POST", "/hrms/leaves", data),
  approve: (id: string) => request<LeaveRequest>("PATCH", `/hrms/leaves/${id}/review`, { status: "Approved" }),
  reject: (id: string, reason?: string) =>
    request<LeaveRequest>("PATCH", `/hrms/leaves/${id}/review`, { status: "Rejected" }),
};"""

# Append methods inside payrollApi in api-client.ts
old_payroll_api = """export const payrollApi = {
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

new_payroll_api = """export const payrollApi = {
  listPayslips: (employeeId?: string) =>
    request<Payslip[]>("GET", "/hrms/payslips", undefined, {
      employee_id: employeeId,
    }),
  listSalaryStructures: () =>
    request<SalaryStructure[]>("GET", "/hrms/salary-structures"),
  createSalaryStructure: (data: Record<string, unknown>) =>
    request<SalaryStructure>("POST", "/hrms/salary-structures", data),
  listPayGrades: () =>
    request<PayGrade[]>("GET", "/hrms/payroll/grades"),
  createPayGrade: (data: Record<string, unknown>) =>
    request<PayGrade>("POST", "/hrms/payroll/grades", data),
  generatePayslip: (data: Record<string, unknown>) =>
    request<Payslip[]>("POST", "/hrms/payslips/process", data),
};"""

content = content.replace(old_leaves_api.replace("\n", line_ending), new_leaves_api.replace("\n", line_ending))
content = content.replace(old_payroll_api.replace("\n", line_ending), new_payroll_api.replace("\n", line_ending))

with open(target, "w", encoding="utf-8", newline=line_ending) as f:
    f.write(content)

print("Updated api-client.ts with policy methods and interfaces successfully")
