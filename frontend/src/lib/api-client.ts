/**
 * BusinessOS AI — Central API Client
 * All backend API calls go through this module.
 * Auth token is injected from localStorage (set by AuthProvider).
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://127.0.0.1:8000/api/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  detail: string | { msg: string }[];
  status: number;
}

// ─── Org Entity Types ─────────────────────────────────────────────────────────

export interface Company {
  id: string;
  tenant_id: string;
  name: string;
  legal_name: string;
  company_type: string | null;
  gst_number: string | null;
  pan_number: string | null;
  registration_number: string | null;
  industry: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  default_currency_code: string;
  timezone: string;
  language: string;
  financial_year_start_month: number;
  tax_config_label: string | null;
  plan: string | null;
  logo_initials: string | null;
  established_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  company_id: string;
  region_id: string | null;
  zone_id: string | null;
  code: string;
  name: string;
  manager_user_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  has_warehouse: boolean;
  working_hours: string | null;
  opening_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  tenant_id: string;
  company_id: string;
  branch_id: string | null;
  parent_id: string | null;
  name: string;
  code: string;
  head_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Designation {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  level: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Region {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  code: string;
  country: string | null;
  manager_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Zone {
  id: string;
  tenant_id: string;
  region_id: string;
  name: string;
  manager_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  tenant_id: string;
  department_id: string;
  branch_id: string | null;
  name: string;
  lead_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessUnit {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  head_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── Financial Types ──────────────────────────────────────────────────────────

export interface FiscalYear {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Currency {
  id: string;
  tenant_id: string;
  code: string;
  symbol: string;
  exchange_rate: number;
  decimal_places: number;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TaxConfiguration {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  tax_type: string;
  rate_percent: number;
  components: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTerm {
  id: string;
  tenant_id: string;
  name: string;
  days: number;
  credit_limit: number | null;
  late_fee_percent: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CostCenter {
  id: string;
  tenant_id: string;
  department_id: string;
  code: string;
  name: string;
  budget_amount: number;
  expense_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface NumberSeries {
  id: string;
  tenant_id: string;
  company_id: string;
  module_name: string;
  prefix: string;
  current_number: number;
  padding: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── Audit Types ──────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
}

// ─── HRMS Types ───────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  tenant_id: string;
  user_id: string | null;
  company_id: string;
  branch_id: string | null;
  department_id: string | null;
  designation_id: string | null;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  date_of_joining: string | null;
  employment_type: string;
  gender: string | null;
  marital_status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bank_account: string | null;
  ifsc_code: string | null;
  pan_number: string | null;
  aadhar_number: string | null;
  basic_salary: number | null;
  status: string;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
  temporary_password?: string;
}

export interface AttendanceRecord {
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
}

export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string | null;
  department?: string | null;
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
}

export interface Payslip {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string | null;
  employee_code?: string | null;
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
}

// ─── HTTP Core ────────────────────────────────────────────────────────────────

function getToken(): string | null {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

async function parseError(res: Response): Promise<string> {
  let detail = res.statusText;
  try {
    const json = await res.json();
    if (typeof json.detail === "string") detail = json.detail;
    else if (Array.isArray(json.detail))
      detail = (json.detail as { msg: string }[]).map((i) => i.msg).join(", ");
    else if (json.message) detail = json.message as string;
  } catch {
    /* ignore */
  }
  return detail;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined | null>,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Automatically attach tenant impersonation header for Platform Owner
  try {
    const storedTenant = localStorage.getItem("bos-tenant");
    if (storedTenant) {
      const parsed = JSON.parse(storedTenant);
      const targetTenantId = parsed.raw?.tenant_id || parsed.tenant_id || parsed.id;
      if (targetTenantId) {
        headers["X-Impersonate-Tenant"] = targetTenantId;
      }
    }
  } catch {
    // ignore
  }

  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("bos-auth");
      window.location.href = "/login";
    }
    const msg = await parseError(res);
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── ERP — Companies ──────────────────────────────────────────────────────────

export const companiesApi = {
  list: (page = 1, pageSize = 20, search?: string) =>
    request<PaginatedResponse<Company>>("GET", "/erp/companies", undefined, {
      page,
      page_size: pageSize,
      search,
    }),
  get: (id: string) => request<Company>("GET", `/erp/companies/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Company>("POST", "/erp/companies", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Company>("PATCH", `/erp/companies/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/companies/${id}`),
};

// ─── ERP — Branches ───────────────────────────────────────────────────────────

export const branchesApi = {
  list: (page = 1, pageSize = 20, search?: string, companyId?: string) =>
    request<PaginatedResponse<Branch>>("GET", "/erp/branches", undefined, {
      page,
      page_size: pageSize,
      search,
      company_id: companyId,
    }),
  get: (id: string) => request<Branch>("GET", `/erp/branches/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Branch>("POST", "/erp/branches", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Branch>("PATCH", `/erp/branches/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/branches/${id}`),
};

// ─── ERP — Departments ────────────────────────────────────────────────────────

export const departmentsApi = {
  list: (page = 1, pageSize = 50, companyId?: string) =>
    request<PaginatedResponse<Department>>("GET", "/erp/departments", undefined, {
      page,
      page_size: pageSize,
      company_id: companyId,
    }),
  get: (id: string) => request<Department>("GET", `/erp/departments/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Department>("POST", "/erp/departments", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Department>("PATCH", `/erp/departments/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/departments/${id}`),
};

// ─── ERP — Designations ───────────────────────────────────────────────────────

export const designationsApi = {
  list: (page = 1, pageSize = 50, companyId?: string) =>
    request<PaginatedResponse<Designation>>("GET", "/erp/designations", undefined, {
      page,
      page_size: pageSize,
      company_id: companyId,
    }),
  get: (id: string) => request<Designation>("GET", `/erp/designations/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Designation>("POST", "/erp/designations", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Designation>("PATCH", `/erp/designations/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/designations/${id}`),
};

// ─── ERP — Regions ────────────────────────────────────────────────────────────

export const regionsApi = {
  list: (page = 1, pageSize = 50, companyId?: string) =>
    request<PaginatedResponse<Region>>("GET", "/erp/regions", undefined, {
      page,
      page_size: pageSize,
      company_id: companyId,
    }),
  get: (id: string) => request<Region>("GET", `/erp/regions/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Region>("POST", "/erp/regions", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Region>("PATCH", `/erp/regions/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/regions/${id}`),
};

// ─── ERP — Zones ──────────────────────────────────────────────────────────────

export const zonesApi = {
  list: (page = 1, pageSize = 50, regionId?: string) =>
    request<PaginatedResponse<Zone>>("GET", "/erp/zones", undefined, {
      page,
      page_size: pageSize,
      region_id: regionId,
    }),
  get: (id: string) => request<Zone>("GET", `/erp/zones/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Zone>("POST", "/erp/zones", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Zone>("PATCH", `/erp/zones/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/zones/${id}`),
};

// ─── ERP — Teams ──────────────────────────────────────────────────────────────

export const teamsApi = {
  list: (page = 1, pageSize = 50, departmentId?: string) =>
    request<PaginatedResponse<Team>>("GET", "/erp/teams", undefined, {
      page,
      page_size: pageSize,
      department_id: departmentId,
    }),
  get: (id: string) => request<Team>("GET", `/erp/teams/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Team>("POST", "/erp/teams", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Team>("PATCH", `/erp/teams/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/teams/${id}`),
};

// ─── ERP — Business Units ─────────────────────────────────────────────────────

export const businessUnitsApi = {
  list: (page = 1, pageSize = 50, companyId?: string) =>
    request<PaginatedResponse<BusinessUnit>>("GET", "/erp/business-units", undefined, {
      page,
      page_size: pageSize,
      company_id: companyId,
    }),
  get: (id: string) => request<BusinessUnit>("GET", `/erp/business-units/${id}`),
  create: (data: Record<string, unknown>) =>
    request<BusinessUnit>("POST", "/erp/business-units", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<BusinessUnit>("PATCH", `/erp/business-units/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/business-units/${id}`),
};

// ─── Financial — Fiscal Years ─────────────────────────────────────────────────

export const fiscalYearsApi = {
  list: (page = 1, pageSize = 20, companyId?: string) =>
    request<PaginatedResponse<FiscalYear>>("GET", "/erp/fiscal-years", undefined, {
      page,
      page_size: pageSize,
      company_id: companyId,
    }),
  get: (id: string) => request<FiscalYear>("GET", `/erp/fiscal-years/${id}`),
  create: (data: Record<string, unknown>) =>
    request<FiscalYear>("POST", "/erp/fiscal-years", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<FiscalYear>("PATCH", `/erp/fiscal-years/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/fiscal-years/${id}`),
};

// ─── Financial — Currencies ───────────────────────────────────────────────────

export const currenciesApi = {
  list: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<Currency>>("GET", "/erp/currencies", undefined, {
      page,
      page_size: pageSize,
    }),
  get: (id: string) => request<Currency>("GET", `/erp/currencies/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Currency>("POST", "/erp/currencies", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Currency>("PATCH", `/erp/currencies/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/currencies/${id}`),
};

// ─── Financial — Tax Configurations ──────────────────────────────────────────

export const taxConfigurationsApi = {
  list: (page = 1, pageSize = 50, companyId?: string) =>
    request<PaginatedResponse<TaxConfiguration>>("GET", "/erp/tax-configurations", undefined, {
      page,
      page_size: pageSize,
      company_id: companyId,
    }),
  get: (id: string) => request<TaxConfiguration>("GET", `/erp/tax-configurations/${id}`),
  create: (data: Record<string, unknown>) =>
    request<TaxConfiguration>("POST", "/erp/tax-configurations", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<TaxConfiguration>("PATCH", `/erp/tax-configurations/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/tax-configurations/${id}`),
};

// ─── Financial — Payment Terms ────────────────────────────────────────────────

export const paymentTermsApi = {
  list: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<PaymentTerm>>("GET", "/erp/payment-terms", undefined, {
      page,
      page_size: pageSize,
    }),
  get: (id: string) => request<PaymentTerm>("GET", `/erp/payment-terms/${id}`),
  create: (data: Record<string, unknown>) =>
    request<PaymentTerm>("POST", "/erp/payment-terms", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<PaymentTerm>("PATCH", `/erp/payment-terms/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/payment-terms/${id}`),
};

// ─── Financial — Cost Centers ─────────────────────────────────────────────────

export const costCentersApi = {
  list: (page = 1, pageSize = 50, departmentId?: string) =>
    request<PaginatedResponse<CostCenter>>("GET", "/erp/cost-centers", undefined, {
      page,
      page_size: pageSize,
      department_id: departmentId,
    }),
  get: (id: string) => request<CostCenter>("GET", `/erp/cost-centers/${id}`),
  create: (data: Record<string, unknown>) =>
    request<CostCenter>("POST", "/erp/cost-centers", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<CostCenter>("PATCH", `/erp/cost-centers/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/cost-centers/${id}`),
};

// ─── Financial — Number Series ────────────────────────────────────────────────

export const numberSeriesApi = {
  list: (page = 1, pageSize = 50, companyId?: string) =>
    request<PaginatedResponse<NumberSeries>>("GET", "/erp/number-series", undefined, {
      page,
      page_size: pageSize,
      company_id: companyId,
    }),
  get: (id: string) => request<NumberSeries>("GET", `/erp/number-series/${id}`),
  create: (data: Record<string, unknown>) =>
    request<NumberSeries>("POST", "/erp/number-series", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<NumberSeries>("PATCH", `/erp/number-series/${id}`, data),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogsApi = {
  list: (
    page = 1,
    pageSize = 50,
    filters?: {
      module?: string;
      action?: string;
      entity_type?: string;
      user_id?: string;
    },
  ) =>
    request<PaginatedResponse<AuditLog>>("GET", "/erp/audit-logs", undefined, {
      page,
      page_size: pageSize,
      ...filters,
    }),
};

// ─── HRMS — Employees ─────────────────────────────────────────────────────────

export const employeesApi = {
  list: (page = 1, pageSize = 20, search?: string, companyId?: string, departmentId?: string, status?: string) =>
    request<PaginatedResponse<Employee>>("GET", "/hrms/employees", undefined, {
      page,
      page_size: pageSize,
      search,
      company_id: companyId,
      department_id: departmentId,
      status,
    }),
  getMe: () => request<Employee>("GET", "/hrms/employees/me"),
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
};

// ─── HRMS — Attendance ────────────────────────────────────────────────────────

export const attendanceApi = {
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
};

// ─── HRMS — Leaves ────────────────────────────────────────────────────────────

export const leavesApi = {
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
};

// ─── HRMS — Payroll ───────────────────────────────────────────────────────────

export const payrollApi = {
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
};

// ─── HRMS — Recruitment ──────────────────────────────────────────────────────

export interface JobOpening {
  id: string;
  tenant_id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  experience: string;
  openings: number;
  applicants_count: number;
  posted_date: string;
  status: string;
  description: string;
  threshold_score: number;
  portals: string[];
  criteria: string;
  created_at: string;
  updated_at: string;
}

export interface Applicant {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  job_id: string;
  job_title: string;
  applied_date: string;
  experience: string;
  rating: number;
  stage: "Applied" | "Screening" | "Interview" | "Offer" | "Hired" | "Rejected";
  source: string;
  match_score: number;
  resume_text: string | null;
  expected_salary?: number;
  proposed_salary?: number;
  notes_json?: { author: string; date: string; text: string }[];
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: string;
  tenant_id: string;
  applicant_id: string;
  candidate: string;
  job_title: string;
  interviewer_name: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  mode: string;
  meeting_link: string | null;
  status: "Scheduled" | "Completed" | "Cancelled";
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  tenant_id: string;
  applicant_id: string;
  candidate: string;
  role: string;
  ctc: number;
  offer_date: string;
  expiry_date: string;
  joining_date: string;
  signer_name: string;
  status: "Awaiting Acceptance" | "Accepted" | "Declined";
  email_sent: boolean;
  custom_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  task: string;
  assignedTo: string;
  status: "Pending" | "In Progress" | "Done";
}

export interface Onboarding {
  id: string;
  tenant_id: string;
  applicant_id: string;
  new_hire: string;
  role: string;
  start_date: string;
  progress: number;
  tasks_json: OnboardingTask[];
  created_at: string;
  updated_at: string;
}

export const recruitmentApi = {
  // Job Openings
  listJobs: (status?: string, search?: string, page = 1, pageSize = 50) =>
    request<PaginatedResponse<JobOpening>>("GET", "/hrms/recruitment/jobs", undefined, {
      status, search, page, page_size: pageSize
    }),
  createJob: (data: Record<string, unknown>) =>
    request<JobOpening>("POST", "/hrms/recruitment/jobs", data),
  generateJd: (prompt: string) =>
    request<{ title: string; department: string; criteria: string; description: string; threshold_score: number }>(
      "POST",
      "/hrms/recruitment/jobs/generate-jd",
      { prompt }
    ),
  updateJob: (id: string, data: Record<string, unknown>) =>
    request<JobOpening>("PATCH", `/hrms/recruitment/jobs/${id}`, data),
  deleteJob: (id: string) =>
    request<void>("DELETE", `/hrms/recruitment/jobs/${id}`),

  // Applicants
  listApplicants: (jobId?: string, stage?: string, source?: string, search?: string, page = 1, pageSize = 50) =>
    request<PaginatedResponse<Applicant>>("GET", "/hrms/recruitment/applicants", undefined, {
      job_id: jobId, stage, source, search, page, page_size: pageSize
    }),
  applyJob: (jobId: string, data: Record<string, unknown>) =>
    request<Applicant>("POST", `/hrms/recruitment/jobs/${jobId}/apply`, data),
  updateApplicant: (id: string, data: Record<string, unknown>) =>
    request<Applicant>("PATCH", `/hrms/recruitment/applicants/${id}`, data),
  addApplicantNote: (id: string, text: string) =>
    request<Applicant>("POST", `/hrms/recruitment/applicants/${id}/notes`, { text }),

  // Interviews
  listInterviews: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<Interview>>("GET", "/hrms/recruitment/interviews", undefined, {
      page, page_size: pageSize
    }),
  checkOverlap: (interviewer: string, date: string, time: string, duration: number) =>
    request<{ conflict: boolean; candidate?: string; time?: string; duration?: number; detail?: string }>(
      "GET",
      "/hrms/recruitment/interviews/check-overlap",
      undefined,
      { interviewer, date, time, duration }
    ),
  scheduleInterview: (data: Record<string, unknown>) =>
    request<Interview>("POST", "/hrms/recruitment/interviews", data),
  updateInterview: (id: string, data: Record<string, unknown>) =>
    request<Interview>("PATCH", `/hrms/recruitment/interviews/${id}`, data),

  // Offers
  listOffers: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<Offer>>("GET", "/hrms/recruitment/offers", undefined, {
      page, page_size: pageSize
    }),
  createOffer: (data: Record<string, unknown>) =>
    request<Offer>("POST", "/hrms/recruitment/offers", data),
  sendOfferEmail: (id: string) =>
    request<{ status: string; message: string }>("POST", `/hrms/recruitment/offers/${id}/send-email`),
  updateOfferStatus: (id: string, data: Record<string, unknown>) =>
    request<Offer>("PATCH", `/hrms/recruitment/offers/${id}`, data),

  // Onboardings
  listOnboardings: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<Onboarding>>("GET", "/hrms/recruitment/onboarding", undefined, {
      page, page_size: pageSize
    }),
  createOnboarding: (data: Record<string, unknown>) =>
    request<Onboarding>("POST", "/hrms/recruitment/onboarding", data),
  updateOnboarding: (id: string, data: Record<string, unknown>) =>
    request<Onboarding>("PATCH", `/hrms/recruitment/onboarding/${id}`, data),
  deleteOnboarding: (id: string) =>
    request<void>("DELETE", `/hrms/recruitment/onboarding/${id}`),
};


export interface PerformanceGoal {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  employee_name: string;
  title: string;
  description: string | null;
  target_date: string;
  status: "Not Started" | "On Track" | "At Risk" | "Completed";
  weight: number;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface PerformanceKpi {
  id: string;
  tenant_id: string;
  metric: string;
  target: string;
  current: string;
  unit: string;
  achievement: number;
}

export interface PerformanceAppraisal {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  period: string;
  self_score: number;
  manager_score: number;
  final_score: number;
  rating: string;
  reviewer: string;
  status: "Pending" | "In Progress" | "Completed";
  created_at: string;
  updated_at: string;
}

export interface PerformanceIncentive {
  id: string;
  tenant_id: string;
  employee_name: string;
  department: string;
  type: string;
  basis: string;
  amount: number;
  status: "Pending" | "Approved" | "Paid";
}

export interface LearningCourse {
  id: string;
  tenant_id: string;
  title: string;
  category: string;
  instructor: string;
  duration: string;
  enrolled: number;
  completion: number;
  status: string;
}

export interface LearningCertificate {
  id: string;
  tenant_id: string;
  employee_name: string;
  cert_name: string;
  issuer: string;
  issued_date: string;
  expiry_date: string;
  status: string;
}

export interface LearningAssessment {
  id: string;
  tenant_id: string;
  title: string;
  course_name: string;
  due_date: string;
  participants: number;
  avg_score: number;
  status: string;
}


export const performanceApi = {
  listGoals: (employeeId?: string, status?: string, page = 1, pageSize = 50) =>
    request<PaginatedResponse<PerformanceGoal>>("GET", "/hrms/performance/goals", undefined, {
      employee_id: employeeId, status, page, page_size: pageSize
    }),
  createGoal: (data: Record<string, unknown>) =>
    request<PerformanceGoal>("POST", "/hrms/performance/goals", data),
  updateGoal: (id: string, data: Record<string, unknown>) =>
    request<PerformanceGoal>("PATCH", `/hrms/performance/goals/${id}`, data),

  listKpis: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<PerformanceKpi>>("GET", "/hrms/performance/kpis", undefined, {
      page, page_size: pageSize
    }),
  createKpi: (data: Record<string, unknown>) =>
    request<PerformanceKpi>("POST", "/hrms/performance/kpis", data),

  listAppraisals: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<PerformanceAppraisal>>("GET", "/hrms/performance/appraisals", undefined, {
      page, page_size: pageSize
    }),
  createAppraisal: (data: Record<string, unknown>) =>
    request<PerformanceAppraisal>("POST", "/hrms/performance/appraisals", data),
  updateAppraisal: (id: string, data: Record<string, unknown>) =>
    request<PerformanceAppraisal>("PATCH", `/hrms/performance/appraisals/${id}`, data),

  listIncentives: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<PerformanceIncentive>>("GET", "/hrms/performance/incentives", undefined, {
      page, page_size: pageSize
    }),
  createIncentive: (data: Record<string, unknown>) =>
    request<PerformanceIncentive>("POST", "/hrms/performance/incentives", data),
};

export const learningApi = {
  listCourses: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<LearningCourse>>("GET", "/hrms/learning/courses", undefined, {
      page, page_size: pageSize
    }),
  createCourse: (data: Record<string, unknown>) =>
    request<LearningCourse>("POST", "/hrms/learning/courses", data),

  listCertificates: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<LearningCertificate>>("GET", "/hrms/learning/certificates", undefined, {
      page, page_size: pageSize
    }),
  createCertificate: (data: Record<string, unknown>) =>
    request<LearningCertificate>("POST", "/hrms/learning/certificates", data),

  listAssessments: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<LearningAssessment>>("GET", "/hrms/learning/assessments", undefined, {
      page, page_size: pageSize
    }),
  createAssessment: (data: Record<string, unknown>) =>
    request<LearningAssessment>("POST", "/hrms/learning/assessments", data),
};

export interface AttendanceDeptStats {
  dept: string;
  rate: number;
}

export interface AttendanceMethodStats {
  method: string;
  count: number;
  pct: number;
  color: string;
}

export interface AttendanceAnalytics {
  avg_attendance: number;
  today_presence: number;
  chronic_absentees: number;
  late_arrivals: number;
  dept_rates: AttendanceDeptStats[];
  method_rates: AttendanceMethodStats[];
}

export interface DeptPayrollCost {
  dept: string;
  headcount: number;
  totalPayroll: number;
  avgSalary: number;
  yoyChange: number;
}

export interface PayrollAnalytics {
  monthly_payroll: number;
  highest_dept: string;
  growth_yoy: string;
  dept_costs: DeptPayrollCost[];
}

export interface AtRiskEmployee {
  name: string;
  dept: string;
  riskScore: number;
  factors: string[];
  risk: "High" | "Medium";
}

export interface AttritionPrediction {
  at_risk: AtRiskEmployee[];
}

export interface ShiftOptimizationItem {
  shift: string;
  employees: number;
  optimal: number;
  coverage: number;
  efficiency: number;
}

export interface ShiftOptimization {
  shifts: ShiftOptimizationItem[];
}

export interface ProductivityItem {
  name: string;
  dept: string;
  score: number;
  trend: "up" | "down" | "stable";
  tasks: number;
  output: string;
}

export interface ProductivityScore {
  scores: ProductivityItem[];
}

export interface TrainingRecommendationItem {
  employee: string;
  dept: string;
  skill: string;
  reason: string;
  priority: "High" | "Medium";
}

export interface TrainingRecommendation {
  recommendations: TrainingRecommendationItem[];
}

export const intelligenceApi = {
  getAttendanceAnalytics: () =>
    request<AttendanceAnalytics>("GET", "/hrms/intelligence/attendance-analytics"),
  getPayrollAnalytics: () =>
    request<PayrollAnalytics>("GET", "/hrms/intelligence/payroll-analytics"),
  getAttritionPrediction: () =>
    request<AttritionPrediction>("GET", "/hrms/intelligence/attrition-risk"),
  getShiftOptimization: () =>
    request<ShiftOptimization>("GET", "/hrms/intelligence/shift-optimization"),
  getProductivityScore: () =>
    request<ProductivityScore>("GET", "/hrms/intelligence/productivity-score"),
  getTrainingRecommendation: () =>
    request<TrainingRecommendation>("GET", "/hrms/intelligence/training-recommendation"),
};


export interface ExitResignation {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  resign_date: string;
  last_working_day: string;
  reason: string;
  status: "Pending" | "Accepted" | "Rejected" | "Completed";
}

export interface ExitClearanceTask {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  task: string;
  status: "Pending" | "In Progress" | "Done";
  assigned_to: string;
}

export interface ExitFinalSettlement {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  last_working_day: string;
  components_json: { item: string; amount: number }[];
}

export interface ExitExperienceLetter {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  designation: string;
  from_date: string;
  to_date: string;
  issued_on: string;
  status: "Pending" | "Issued";
}

export const exitApi = {
  listResignations: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<ExitResignation>>("GET", "/hrms/exit/resignations", undefined, {
      page, page_size: pageSize
    }),
  createResignation: (data: Record<string, unknown>) =>
    request<ExitResignation>("POST", "/hrms/exit/resignations", data),
  updateResignation: (id: string, data: Record<string, unknown>) =>
    request<ExitResignation>("PATCH", `/hrms/exit/resignations/${id}`, data),

  listClearance: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<ExitClearanceTask>>("GET", "/hrms/exit/clearance", undefined, {
      page, page_size: pageSize
    }),
  createClearance: (data: Record<string, unknown>) =>
    request<ExitClearanceTask>("POST", "/hrms/exit/clearance", data),
  updateClearance: (id: string, data: Record<string, unknown>) =>
    request<ExitClearanceTask>("PATCH", `/hrms/exit/clearance/${id}`, data),

  listSettlements: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<ExitFinalSettlement>>("GET", "/hrms/exit/settlements", undefined, {
      page, page_size: pageSize
    }),
  createSettlement: (data: Record<string, unknown>) =>
    request<ExitFinalSettlement>("POST", "/hrms/exit/settlements", data),

  listExperienceLetters: (page = 1, pageSize = 50) =>
    request<PaginatedResponse<ExitExperienceLetter>>("GET", "/hrms/exit/experience-letters", undefined, {
      page, page_size: pageSize
    }),
  createExperienceLetter: (data: Record<string, unknown>) =>
    request<ExitExperienceLetter>("POST", "/hrms/exit/experience-letters", data),
  updateExperienceLetter: (id: string, data: Record<string, unknown>) =>
    request<ExitExperienceLetter>("PATCH", `/hrms/exit/experience-letters/${id}`, data),
};


// ─── Workflow Engine Types ────────────────────────────────────────────────────



// ─── Workflow Engine Types ────────────────────────────────────────────────────

export interface ApprovalWorkflow {
  id: string;
  tenant_id: string;
  company_id: string | null;
  name: string;
  module: string;
  description: string | null;
  steps: Record<string, unknown>[] | null;
  is_active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  event: string;
  channel: string;
  subject: string | null;
  body: string | null;
  variables: string[] | null;
  is_active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplate {
  id: string;
  tenant_id: string;
  name: string;
  document_type: string;
  format: string;
  description: string | null;
  template_content: string | null;
  variables: string[] | null;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  module: string;
  trigger_event: string;
  conditions: Record<string, unknown> | null;
  actions: Record<string, unknown>[] | null;
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CustomField {
  id: string;
  tenant_id: string;
  entity_type: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  options: string[] | null;
  default_value: string | null;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── Master Data Types ────────────────────────────────────────────────────────

export interface GeographyCountry {
  id: string;
  tenant_id: string;
  name: string;
  iso_code: string;
  phone_code: string | null;
  currency_code: string | null;
  states: Record<string, unknown>[] | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ERPLocation {
  id: string;
  tenant_id: string;
  company_id: string | null;
  branch_id: string | null;
  code: string;
  name: string;
  location_type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WorkCalendar {
  id: string;
  tenant_id: string;
  company_id: string | null;
  name: string;
  calendar_type: string;
  working_days: string[] | null;
  shifts: Record<string, unknown>[] | null;
  holidays: Record<string, unknown>[] | null;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  tenant_id: string;
  name: string;
  entity_type: string;
  color: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── System Types ─────────────────────────────────────────────────────────────

export interface SystemSetting {
  id: string;
  tenant_id: string;
  key: string;
  value: string | null;
  category: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemHealthService {
  name: string;
  status: string;
  latency_ms: number | null;
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  python_version: string;
  database: { status: string; latency_ms: number };
  tenant: { id: string; total_audit_logs: number };
  services: SystemHealthService[];
}

// ─── Workflow Engine API ──────────────────────────────────────────────────────

export const approvalWorkflowsApi = {
  list: (page = 1, pageSize = 20, search?: string, module?: string) =>
    request<PaginatedResponse<ApprovalWorkflow>>("GET", "/erp/approval-workflows", undefined, {
      page, page_size: pageSize, search, module,
    }),
  get: (id: string) => request<ApprovalWorkflow>("GET", `/erp/approval-workflows/${id}`),
  create: (data: Record<string, unknown>) =>
    request<ApprovalWorkflow>("POST", "/erp/approval-workflows", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<ApprovalWorkflow>("PATCH", `/erp/approval-workflows/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/approval-workflows/${id}`),
};

export const notificationTemplatesApi = {
  list: (page = 1, pageSize = 20, search?: string, channel?: string) =>
    request<PaginatedResponse<NotificationTemplate>>("GET", "/erp/notification-templates", undefined, {
      page, page_size: pageSize, search, channel,
    }),
  get: (id: string) => request<NotificationTemplate>("GET", `/erp/notification-templates/${id}`),
  create: (data: Record<string, unknown>) =>
    request<NotificationTemplate>("POST", "/erp/notification-templates", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<NotificationTemplate>("PATCH", `/erp/notification-templates/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/notification-templates/${id}`),
};

export const documentTemplatesApi = {
  list: (page = 1, pageSize = 20, search?: string, documentType?: string) =>
    request<PaginatedResponse<DocumentTemplate>>("GET", "/erp/document-templates", undefined, {
      page, page_size: pageSize, search, document_type: documentType,
    }),
  get: (id: string) => request<DocumentTemplate>("GET", `/erp/document-templates/${id}`),
  create: (data: Record<string, unknown>) =>
    request<DocumentTemplate>("POST", "/erp/document-templates", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<DocumentTemplate>("PATCH", `/erp/document-templates/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/document-templates/${id}`),
};

export const automationRulesApi = {
  list: (page = 1, pageSize = 20, search?: string, module?: string) =>
    request<PaginatedResponse<AutomationRule>>("GET", "/erp/automation-rules", undefined, {
      page, page_size: pageSize, search, module,
    }),
  get: (id: string) => request<AutomationRule>("GET", `/erp/automation-rules/${id}`),
  create: (data: Record<string, unknown>) =>
    request<AutomationRule>("POST", "/erp/automation-rules", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<AutomationRule>("PATCH", `/erp/automation-rules/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/automation-rules/${id}`),
};

export const customFieldsApi = {
  list: (page = 1, pageSize = 50, search?: string, entityType?: string) =>
    request<PaginatedResponse<CustomField>>("GET", "/erp/custom-fields", undefined, {
      page, page_size: pageSize, search, entity_type: entityType,
    }),
  get: (id: string) => request<CustomField>("GET", `/erp/custom-fields/${id}`),
  create: (data: Record<string, unknown>) =>
    request<CustomField>("POST", "/erp/custom-fields", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<CustomField>("PATCH", `/erp/custom-fields/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/custom-fields/${id}`),
};

// ─── Master Data API ──────────────────────────────────────────────────────────

export const geographyApi = {
  list: (page = 1, pageSize = 50, search?: string) =>
    request<PaginatedResponse<GeographyCountry>>("GET", "/erp/geography", undefined, {
      page, page_size: pageSize, search,
    }),
  get: (id: string) => request<GeographyCountry>("GET", `/erp/geography/${id}`),
  create: (data: Record<string, unknown>) =>
    request<GeographyCountry>("POST", "/erp/geography", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<GeographyCountry>("PATCH", `/erp/geography/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/geography/${id}`),
};

export const locationsApi = {
  list: (page = 1, pageSize = 20, search?: string, companyId?: string, locationType?: string) =>
    request<PaginatedResponse<ERPLocation>>("GET", "/erp/locations", undefined, {
      page, page_size: pageSize, search, company_id: companyId, location_type: locationType,
    }),
  get: (id: string) => request<ERPLocation>("GET", `/erp/locations/${id}`),
  create: (data: Record<string, unknown>) =>
    request<ERPLocation>("POST", "/erp/locations", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<ERPLocation>("PATCH", `/erp/locations/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/locations/${id}`),
};

export const workCalendarsApi = {
  list: (page = 1, pageSize = 20, search?: string, companyId?: string) =>
    request<PaginatedResponse<WorkCalendar>>("GET", "/erp/work-calendars", undefined, {
      page, page_size: pageSize, search, company_id: companyId,
    }),
  get: (id: string) => request<WorkCalendar>("GET", `/erp/work-calendars/${id}`),
  create: (data: Record<string, unknown>) =>
    request<WorkCalendar>("POST", "/erp/work-calendars", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<WorkCalendar>("PATCH", `/erp/work-calendars/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/work-calendars/${id}`),
};

export const tagsApi = {
  list: (page = 1, pageSize = 50, search?: string, entityType?: string) =>
    request<PaginatedResponse<Tag>>("GET", "/erp/tags", undefined, {
      page, page_size: pageSize, search, entity_type: entityType,
    }),
  get: (id: string) => request<Tag>("GET", `/erp/tags/${id}`),
  create: (data: Record<string, unknown>) =>
    request<Tag>("POST", "/erp/tags", data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Tag>("PATCH", `/erp/tags/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/erp/tags/${id}`),
};

// ─── System Administration API ────────────────────────────────────────────────

export const systemSettingsApi = {
  list: (category?: string) =>
    request<SystemSetting[]>("GET", "/erp/system-settings", undefined, { category }),
  batchUpdate: (settings: { key: string; value: string | null; category?: string; description?: string; is_public?: boolean }[]) =>
    request<SystemSetting[]>("PATCH", "/erp/system-settings", { settings }),
  upsert: (key: string, data: { value: string | null; category?: string; description?: string; is_public?: boolean }) =>
    request<SystemSetting>("PUT", `/erp/system-settings/${key}`, { key, ...data }),
};

export const systemHealthApi = {
  get: () => request<SystemHealth>("GET", "/erp/system-health"),
};

export const errorLogsApi = {
  list: (page = 1, pageSize = 20, module?: string) =>
    request<PaginatedResponse<Record<string, unknown>>>("GET", "/erp/error-logs", undefined, {
      page, page_size: pageSize, module,
    }),
};

export const backupApi = {
  getStatus: () => request<Record<string, unknown>>("GET", "/erp/backup-status"),
};

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

export interface SalaryStructure {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name?: string;
  designation?: string;
  department?: string;
  basic_salary: number;
  hra: number;
  other_allowances: number;
  pf_deduction: number;
  esi_deduction: number;
  tds_deduction: number;
  other_deductions: number;
  created_at?: string;
  updated_at?: string;
}
