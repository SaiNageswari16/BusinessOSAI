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
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
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
}

export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
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
};

// ─── HRMS — Leaves ────────────────────────────────────────────────────────────

export const leavesApi = {
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
};

// ─── HRMS — Payroll ───────────────────────────────────────────────────────────

export const payrollApi = {
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
};
