/**
 * BusinessOS AI â€” Central API Client
 * All backend API calls go through this module.
 * Auth token is injected from localStorage (set by AuthProvider).
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://127.0.0.1:8000/api/v1";

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/images/")) {
    const backendBase = API_BASE_URL.replace("/api/v1", "");
    return `${backendBase}${url}`;
  }
  return url;
}

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

export interface InventoryUOM {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  warehouse_type: string;
  capacity: string | null;
  manager_name: string | null;
  employees: number;
  temperature_control: string | null;
  status: string;
  created_at: string;
  address?: string | null;
}

export interface StorageLocation {
  id: string;
  warehouse_id: string;
  zone: string | null;
  aisle: string | null;
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  barcode: string;
  status: string;
  created_at: string;
}

// â”€â”€â”€ CRM Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Audit Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ HRMS Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ HTTP Core â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const error: any = new Error(msg);
    error.status = res.status;
    throw error;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// â”€â”€â”€ ERP â€” Companies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ ERP â€” Branches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ ERP â€” Departments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ ERP â€” Designations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ ERP â€” Regions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ ERP â€” Zones â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ ERP â€” Teams â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ ERP â€” Business Units â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Financial â€” Fiscal Years â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Financial â€” Currencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Financial â€” Tax Configurations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Financial â€” Payment Terms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Financial â€” Cost Centers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Financial â€” Number Series â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Audit Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ HRMS â€” Employees â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ HRMS â€” Attendance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ HRMS â€” Leaves â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ HRMS â€” Payroll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Workflow Engine Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  provider?: string;
  provider_job_id?: string;
  sync_status?: string;
  last_synced?: string;
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

// ─── Master Data Types ───────────────────────────────────────────────────────

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

// â”€â”€â”€ System Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Workflow Engine API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Master Data API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  create: (data: Record<string, unknown>) => request<WorkCalendar>("POST", "/erp/work-calendars", data),
  update: (id: string, data: Record<string, unknown>) => request<WorkCalendar>("PATCH", `/erp/work-calendars/${id}`, data),
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

// ─── CRM & Sales — Customers and Leads ──────────────────────────────────────

export interface CrmCustomer {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  customer_type: string;
  status: string;
  address: string | null;
  gst_number: string | null;
  owner_user_id: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmLead {
  id: string;
  tenant_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";
  source: string | null;
  owner_user_id: string | null;
  estimated_value: number;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  lost_reason: string | null;
  ai_score: number | null;
  ai_sentiment: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmLeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  summary: string;
  occurred_at: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export const crmCustomersApi = {
  list: (page = 1, pageSize = 20, search?: string, customerType?: string) =>
    request<PaginatedResponse<CrmCustomer>>("GET", "/crm/customers", undefined, { page, page_size: pageSize, search, customer_type: customerType }),
  create: (data: Record<string, unknown>) => request<CrmCustomer>("POST", "/crm/customers", data),
  update: (id: string, data: Record<string, unknown>) => request<CrmCustomer>("PATCH", `/crm/customers/${id}`, data),
};

export const crmLeadsApi = {
  list: (page = 1, pageSize = 100, search?: string, status?: string) =>
    request<PaginatedResponse<CrmLead>>("GET", "/crm/leads", undefined, { page, page_size: pageSize, search, status }),
  create: (data: Record<string, unknown>) => request<CrmLead>("POST", "/crm/leads", data),
  update: (id: string, data: Record<string, unknown>) => request<CrmLead>("PATCH", `/crm/leads/${id}`, data),
  listActivities: (id: string) => request<CrmLeadActivity[]>("GET", `/crm/leads/${id}/activities`),
  addActivity: (id: string, data: Record<string, unknown>) => request<CrmLeadActivity>("POST", `/crm/leads/${id}/activities`, data),
  convert: (id: string) => request<CrmCustomer>("POST", `/crm/leads/${id}/convert`),
  
  // ── Facebook OAuth page connection (proper flow) ─────────────────────────────
  /** Get this tenant's Meta App configuration status */
  getFbAppConfig: () =>
    request<{ configured: boolean; app_id?: string; redirect_uri?: string }>("GET", "/crm/facebook/app-config"),
  /** Save this tenant's Meta App credentials */
  saveFbAppConfig: (data: { app_id: string; app_secret: string; redirect_uri?: string }) =>
    request<{ success: boolean; message: string }>("POST", "/crm/facebook/app-config", data),
  /** Delete this tenant's Meta App credentials */
  deleteFbAppConfig: () =>
    request<{ success: boolean }>("DELETE", "/crm/facebook/app-config"),
  /** Connect a Page or Lead Form directly by pasting both Page ID and Access Token */
  connectFbDirect: (data: { page_id?: string; access_token: string }) =>
    request<{ success: boolean; page_name: string; page_id: string; message: string }>("POST", "/crm/facebook/connect-direct", data),
  /** Returns whether the Meta App is configured and which page (if any) is connected. */
  getFbStatus: () =>
    request<{ app_configured: boolean; page_connected: boolean; page_name?: string; page_id?: string }>("GET", "/crm/facebook/status"),
  /**
   * Verify a pasted User Token or Page Token from the Meta Graph API Explorer.
   * No OAuth login required — token is introspected against /me/accounts and
   * the discovered pages are returned for the user to pick one.
   */
  verifyFbToken: (access_token: string) =>
    request<{ pages: { id: string; name: string; category: string }[]; count: number }>("POST", "/crm/facebook/verify-token", { access_token }),
  /** Returns the Meta OAuth URL to open in a popup (optional if user prefers OAuth login). */
  getFbAuthUrl: () =>
    request<{ auth_url: string }>("GET", "/crm/facebook/auth-url"),
  /** Returns pages retrieved during OAuth or verify-token flow. */
  getFbAvailablePages: () =>
    request<{ pages: { id: string; name: string; category: string }[] }>("GET", "/crm/facebook/available-pages"),
  /** Saves the selected page permanently (page token stored server-side). */
  selectFbPage: (data: { page_id: string; page_name: string; page_access_token: string }) =>
    request<{ success: boolean; page_name: string; page_id: string; message: string }>("POST", "/crm/facebook/select-page", data),
  /** Disconnects the connected FB page. */
  disconnectFbPage: () =>
    request<{ success: boolean }>("DELETE", "/crm/facebook/disconnect"),

  // ── Legacy credential endpoints (for lead import form backward-compat) ───────
  saveFacebookCredentials: (data: { fb_access_token: string; fb_page_or_form_id?: string; fb_api_version?: string }) =>
    request<any>("POST", "/crm/facebook/credentials", data),
  deleteFacebookCredentials: () =>
    request<any>("DELETE", "/crm/facebook/credentials"),
  getFacebookCredentials: () =>
    request<{ configured: boolean; fb_page_or_form_id?: string; fb_api_version?: string; has_token?: boolean }>("GET", "/crm/facebook/credentials"),
  importFacebookLeads: () =>
    request<{ imported: number; skipped: number; total: number; message: string }>("POST", "/crm/facebook/import"),
    
  // AI scoring
  analyzeLeadAi: (id: string) =>
    request<{ id: string; ai_score: number; ai_sentiment: string }>("POST", `/crm/leads/${id}/analyze-ai`),

  // AI outbound call via LiveKit
  initiateCall: (id: string, data: { sip_number: string; custom_prompt?: string }) =>
    request<{ status: string; room_name?: string; participant_id?: string; sip_call_id?: string; message: string }>("POST", `/crm/leads/${id}/initiate-call`, data),

  // ── Facebook Token Health & Ad History ───────────────────────────────────────
  /** Check health/expiry of the stored Facebook access token for this org. */
  getFbTokenInfo: () =>
    request<{
      connected: boolean;
      is_valid: boolean;
      page_id?: string;
      page_name?: string;
      token_type?: string;
      expires_at?: number | null;
      scopes?: string[];
      error?: string | null;
    }>("GET", "/crm/campaigns/fb-token-info"),

  /** Fetch paginated list of all Facebook ads published by this org. */
  getAdHistory: (page = 1, pageSize = 20) =>
    request<{
      total: number;
      page: number;
      page_size: number;
      items: Array<{
        id: string;
        post_id?: string;
        page_id?: string;
        page_name?: string;
        caption?: string;
        image_url?: string;
        fb_post_url?: string;
        published_at?: string;
        published_by_user_id?: string;
      }>;
    }>("GET", `/crm/campaigns/ad-history?page=${page}&page_size=${pageSize}`),

  /** Publish a generated ad poster to the connected Facebook Page. */
  publishToFacebook: (data: { image_url: string; caption: string; aspect_ratio?: string }) =>
    request<{ status: string; post_id?: string; page_id?: string; fb_post_url?: string; message: string }>("POST", "/crm/campaigns/publish-facebook", data),

  /** Fetch all Facebook ad accounts. */
  getFbAdAccounts: () =>
    request<Array<{ account_id: string; name: string; account_status: number }>>("GET", "/crm/facebook/ad-accounts"),

  /** Select active Facebook Ad Account. */
  selectFbAdAccount: (ad_account_id: string) =>
    request<{ success: boolean; message: string }>("POST", "/crm/facebook/select-ad-account", { ad_account_id }),

  /** Fetch active campaigns and their metrics. */
  getFbCampaigns: () =>
    request<Array<{
      id: string;
      name: string;
      status: string;
      objective: string;
      start_time?: string;
      stop_time?: string;
      spend?: string;
      impressions?: string;
      clicks?: string;
    }>>("GET", "/crm/facebook/campaigns"),

  /** Fetch active ads. */
  getFbAds: () =>
    request<Array<{
      id: string;
      name: string;
      status: string;
      campaign_id: string;
      adset_id: string;
    }>>("GET", "/crm/facebook/ads"),

  /** Sync lead gen forms submissions. */
  syncFbLeads: () =>
    request<{ success: boolean; synced_count: number; message: string }>("POST", "/crm/facebook/sync-leads"),

  // ── Master Catalog & AI RAG Search ─────────────────────────────────────────
  getSearchSuggestions: (query: string) =>
    request<string[]>("GET", `/inventory/master-catalog/suggestions?query=${encodeURIComponent(query)}`),

  searchMasterCatalog: (query: string, searchWeb = false, provider?: string) =>
    request<Array<{
      id?: string;
      name: string;
      barcode?: string;
      brand_name?: string;
      category_name?: string;
      sub_category_name?: string;
      model_number?: string;
      hsn_code?: string;
      mrp?: number;
      selling_price?: number;
      purchase_price?: number;
      image_url?: string;
      short_description?: string;
      specifications?: string;
      source?: "MASTER_DB" | "AI_WEB_SEARCH" | "EXCEL_IMPORT";
    }>>("GET", `/inventory/master-catalog/search?query=${encodeURIComponent(query)}&search_web=${searchWeb}${provider && provider !== "auto" ? `&provider=${encodeURIComponent(provider)}` : ""}`),

  saveToMasterCatalog: (item: any) =>
    request<any>("POST", "/inventory/master-catalog/save", item),

  importExcelMasterCatalog: (items: any[]) =>
    request<{ message: string; count: number }>("POST", "/inventory/master-catalog/import-excel", { items }),

  importToLocalInventory: (data: {
    name: string;
    sku?: string;
    barcode?: string;
    brand_name?: string;
    category_name?: string;
    sub_category_name?: string;
    short_description?: string;
    image_url?: string;
    purchase_price?: number;
    mrp?: number;
    selling_price?: number;
    tax_percent?: number;
    initial_stock?: number;
    supplier?: string;
    warehouse?: string;
  }) =>
    request<any>("POST", "/inventory/master-catalog/import-to-local-inventory", data),
};

export interface CrmOpportunity {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  lead_id: string | null;
  name: string;
  stage: string;
  amount: number;
  probability: number;
  expected_close_date: string | null;
  owner_user_id: string | null;
  next_step: string | null;
  next_step_at: string | null;
  forecast_category: string;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const crmOpportunitiesApi = {
  list: async () => {
    const res = await request<any>("GET", "/crm/opportunities");
    return Array.isArray(res) ? res : res?.items ?? [];
  },
  create: (data: Record<string, unknown>) => request<CrmOpportunity>("POST", "/crm/opportunities", data),
  update: (id: string, data: Record<string, unknown>) => request<CrmOpportunity>("PATCH", `/crm/opportunities/${id}`, data),
};

export interface EmailCampaign {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  body_html: string;
  target_category: string;
  status: string;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  tenant_id: string;
  name: string;
  subject: string | null;
  body_html: string;
  created_at: string;
  updated_at: string;
}

export interface LiveNotification {
  id: string;
  tenant_id: string;
  title: string;
  body: string;
  category: string;
  unread: boolean;
  created_at: string;
}

export const crmCampaignsApi = {
  generateCopy: (data: { prompt: string; channel: string; provider?: string; reference_image?: string }) =>
    request<{ copy: string }>("POST", "/crm/campaigns/generate-copy", data),
  generatePoster: (data: { prompt: string; style?: string; aspect_ratio?: string; provider?: string }) =>
    request<{ image_url: string; enhanced_prompt: string; aspect_ratio: string }>("POST", "/crm/campaigns/generate-poster", data),
  publishFacebook: (data: { image_url: string; caption: string }) =>
    request<{ status: string; post_id?: string; message: string }>("POST", "/crm/campaigns/publish-facebook", data),
  
  // Email Campaign methods
  listEmailCampaigns: () => request<EmailCampaign[]>("GET", "/crm/email-campaigns"),
  createEmailCampaign: (data: { name: string; subject: string; body_html: string; target_category: string }) =>
    request<EmailCampaign>("POST", "/crm/email-campaigns", data),
  sendEmailCampaign: (campaignId: string) =>
    request<EmailCampaign>("POST", `/crm/email-campaigns/${campaignId}/send`),
  listEmailTemplates: () => request<EmailTemplate[]>("GET", "/crm/email-templates"),
  createEmailTemplate: (data: { name: string; subject?: string; body_html: string }) =>
    request<EmailTemplate>("POST", "/crm/email-templates", data),
};

export const liveNotificationsApi = {
  list: () => request<LiveNotification[]>("GET", "/system/notifications/live"),
  readAll: () => request<{ message: string }>("POST", "/system/notifications/read-all"),
};

export interface CrmTicket {
  id: string;
  customer_id: string | null;
  subject: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  ai_summary: string | null;
  created_at: string;
}

export const crmTicketsApi = {
  list: (category?: string, status?: string) => request<CrmTicket[]>("GET", "/crm/tickets", undefined, { category, status }),
  create: (data: Record<string, unknown>) => request<CrmTicket>("POST", "/crm/tickets", data),
  summarize: (id: string) => request<{ id: string; ai_summary: string }>("POST", `/crm/tickets/${id}/summarize-ai`),
};

export interface CrmQuotation {
  id: string;
  customer_id: string;
  quote_number: string;
  items: Record<string, any>;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  created_at: string;
}

export const crmQuotationsApi = {
  list: () => request<CrmQuotation[]>("GET", "/crm/quotations"),
  create: (data: Record<string, unknown>) => request<CrmQuotation>("POST", "/crm/quotations", data),
};

export interface CrmSalesOrder {
  id: string;
  customer_id: string;
  order_number: string;
  items: Record<string, any>;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
}

export const crmSalesOrdersApi = {
  list: () => request<CrmSalesOrder[]>("GET", "/crm/sales-orders"),
  create: (data: Record<string, unknown>) => request<CrmSalesOrder>("POST", "/crm/sales-orders", data),
};

// ─── Customer Intelligence API ────────────────────────────────────────────────

export interface IntelAnalytics {
  total_customers: number;
  active_customers: number;
  new_customers_this_month: number;
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  repeat_rate: number;
  monthly_data: { month: string; revenue: number; orders: number; new_customers: number }[];
  segments: { name: string; count: number }[];
}

export interface IntelChurnCustomer {
  customer_id: string;
  customer: string;
  company: string | null;
  risk: number;
  tier: string;
  last_purchase: string;
  order_count: number;
  open_tickets: number;
  reason: string;
}

export interface IntelChurn {
  summary: { high_risk: number; at_risk: number; watch: number; total: number };
  customers: IntelChurnCustomer[];
}

export interface IntelLtvCustomer {
  customer_id: string;
  customer: string;
  company: string | null;
  ltv: number;
  revenue: number;
  profit: number;
  orders: number;
  years: number;
}

export interface IntelLtv {
  summary: { avg_ltv: number; total_customer_value: number; avg_orders_per_customer: number; total_customers: number };
  customers: IntelLtvCustomer[];
}

export interface IntelPurchaseBehaviour {
  summary: { avg_frequency: number; avg_order_value: number; peak_hour: string; top_category: string };
  categories: { name: string; pct: number; revenue: number; orders: number }[];
  top_buyers: { name: string; score: number }[];
  purchase_times: { hour: string; orders: number }[];
}

export interface IntelRfmSegment {
  label: string;
  count: number;
  revenue: number;
  r: number;
  f: number;
  description: string;
  color: string;
}

export interface IntelRfm {
  segments: IntelRfmSegment[];
  total_customers_analysed: number;
}

export interface IntelRecommendation {
  id: string;
  type: string;
  customer: string;
  customer_seg: string;
  title: string;
  description: string;
  confidence: number;
  action: string;
  priority: string;
  icon_type: string;
}

export interface IntelRecommendations {
  summary: { total_recommendations: number; avg_confidence: number; customers_analysed: number; transactions_analysed: number; support_interactions: number };
  recommendations: IntelRecommendation[];
}

export const crmIntelligenceApi = {
  getAnalytics: () => request<IntelAnalytics>("GET", "/crm/intelligence/analytics"),
  getChurn: () => request<IntelChurn>("GET", "/crm/intelligence/churn"),
  getLifetimeValue: () => request<IntelLtv>("GET", "/crm/intelligence/lifetime-value"),
  getPurchaseBehaviour: () => request<IntelPurchaseBehaviour>("GET", "/crm/intelligence/purchase-behaviour"),
  getRfm: () => request<IntelRfm>("GET", "/crm/intelligence/rfm"),
  getRecommendations: () => request<IntelRecommendations>("GET", "/crm/intelligence/recommendations"),
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



// --- POS Types & API ------------------------------------------------

export interface POSCategory {
  id: string; name: string; description: string | null;
  color: string | null; icon: string | null; is_active: boolean;
  created_at: string; updated_at: string;
}

export interface POSProduct {
  id: string; name: string; brand: string | null; sku: string | null;
  barcode: string | null; description: string | null; image_url: string | null;
  category_id: string | null; category_name: string | null;
  purchase_price: number; mrp: number; selling_price: number;
  tax_percent: number; discount: number; stock: number;
  reorder_level: number; is_active: boolean;
  created_at: string; updated_at: string;
}

export interface POSTransactionHistory {
  id: string; session_id: string; cashier_id: string; customer_id: string | null;
  receipt_number: string; status: string;
  parent_transaction_id: string | null;
  delivery_status: string | null;
  delivery_address: string | null;
  driver_name: string | null;
  subtotal: number; tax_amount: number; discount_amount: number; total_amount: number;
  created_at: string; updated_at: string;
  items: { id: string; product_id: string; quantity: number; unit_price: number; discount: number; subtotal: number }[];
  payments: { id: string; payment_method: string; amount: number; reference_number: string | null }[];
}

export const posApi = {
  // Sessions
  openSession: (data: Record<string, unknown>) => request<any>("POST", "/pos/sessions/open", data),
  closeSession: (sessionId: string, data: Record<string, unknown>) => request<any>("POST", `/pos/sessions/${sessionId}/close`, data),
  getCurrentSession: () => request<any>("GET", "/pos/sessions/current"),
  // Transactions
  checkout: (data: Record<string, unknown>) => request<any>("POST", "/pos/transactions/checkout", data),
  getHistory: (params?: { limit?: number; status_filter?: string; search?: string }) => 
    request<POSTransactionHistory[]>("GET", "/pos/transactions/history", undefined, params as Record<string, string | number | boolean | null | undefined>),
  getDailySummary: (params?: { session_id?: string }) => 
    request<any>("GET", "/pos/transactions/reports/daily-summary", undefined, params as Record<string, string | number | boolean | null | undefined>),
  deleteTransaction: (id: string) => request<void>("DELETE", `/pos/transactions/${id}`),
  // Products & Categories
  getCategories: () => request<POSCategory[]>("GET", "/pos/categories"),
  getProducts: (params?: { category_id?: string; search?: string }) =>
    request<POSProduct[]>("GET", "/pos/products", undefined, params as Record<string, string | number | boolean | null | undefined>),
  createProduct: (data: Record<string, unknown>) => request<POSProduct>("POST", "/pos/products", data),
  bulkCreateProducts: (products: Record<string, unknown>[]) => 
    request<{ created_count: number; skipped_count: number; errors: string[] }>("POST", "/pos/products/bulk", { products }),
  updateProduct: (id: string, data: Record<string, unknown>) => request<POSProduct>("PATCH", `/pos/products/${id}`, data),
  deleteProduct: (id: string) => request<void>("DELETE", `/pos/products/${id}`),
  createCategory: (data: Record<string, unknown>) => request<POSCategory>("POST", "/pos/categories", data),
};

// --- Inventory (ERP Product Master) ------------------------------------------------

export interface InventoryCategory {
  id: string; name: string; category_code: string | null; description: string | null;
  parent_id: string | null; status: string;
  created_at: string; updated_at: string;
}

export interface InventoryBrand {
  id: string; name: string; description: string | null;
  manufacturer: string | null; status: string;
  created_at: string; updated_at: string;
}

export interface InventoryUOM {
  id: string;
  name: string;
  abbreviation: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProductAttribute {
  id: string;
  name: string;
  module: string;
  options: string[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  sku: string;
  barcode?: string;
  attributes: Record<string, string>;
  additional_price: number;
  stock_override?: number;
}

export interface ProductBundle {
  id: string;
  name: string;
  sku: string;
  description?: string;
  price: number;
  items: { id: string; product_id: string; quantity: number }[];
}

export interface ProductKit {
  id: string;
  name: string;
  sku: string;
  kit_type: string;
  description?: string;
  items: { id: string; component_name: string; quantity: number }[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

export interface InventoryProduct {
  id: string; name: string; sku: string; barcode: string | null;
  category_id: string | null; brand_id: string | null; uom_id: string | null;
  category_name: string | null; brand_name: string | null; uom_name: string | null;
  short_description: string | null; long_description: string | null;
  image_url: string | null;
  purchase_price: number; mrp: number; selling_price: number;
  tax_percent: number; discount_limit: number;
  initial_stock: number; stock?: number; reorder_level: number; safety_stock: number;
  supplier: string | null; warehouse: string | null;
  status: string; created_at: string; updated_at: string;
}

// --- Inventory Operations ---
export interface GoodsReceipt {
  id: string;
  receipt_number: string;
  supplier: string | null;
  reference_number: string | null;
  notes: string | null;
  status: string;
  items: any[];
}

export interface GoodsIssue {
  id: string;
  issue_number: string;
  recipient: string | null;
  reference_number: string | null;
  notes: string | null;
  status: string;
  items: any[];
}

export interface StockMovement {
  id: string;
  movement_number: string;
  product_id: string;
  source_location: string;
  destination_location: string;
  quantity: number;
  notes: string | null;
  status: string;
}

export interface StockAdjustment {
  id: string;
  adjustment_number: string;
  product_id: string;
  adjustment_type: string;
  quantity_changed: number;
  reason: string | null;
  status: string;
}

export interface CycleCount {
  id: string;
  count_number: string;
  location: string | null;
  auditor: string | null;
  status: string;
  notes: string | null;
  items: any[];
}

export const inventoryApi = {
  // Products
  getProducts: (params?: { category_id?: string; brand_id?: string; search?: string; page?: number; page_size?: number }) =>
    request<PaginatedResponse<InventoryProduct>>("GET", "/inventory/products", undefined, params as Record<string, any>),
  createProduct: (data: Record<string, unknown>) => request<InventoryProduct>("POST", "/inventory/products", data),
  masterImportProducts: (items: Record<string, unknown>[]) => 
    request<{ products_created: number; brands_created: number; categories_created: number; uoms_created: number; skipped_count: number; errors: string[] }>("POST", "/inventory/products/master-import", { items }),
  updateProduct: (id: string, data: Record<string, unknown>) => request<InventoryProduct>("PATCH", `/inventory/products/${id}`, data),
  deleteProduct: (id: string) => request<void>("DELETE", `/inventory/products/${id}`),

  // Master Catalog & AI Search
  getSearchSuggestions: (query: string) =>
    request<string[]>("GET", `/inventory/master-catalog/suggestions?query=${encodeURIComponent(query)}`),

  searchMasterCatalog: (query: string, searchWeb = false, provider?: string) =>
    request<Array<{
      id?: string;
      name: string;
      barcode?: string;
      brand_name?: string;
      category_name?: string;
      sub_category_name?: string;
      model_number?: string;
      hsn_code?: string;
      mrp?: number;
      selling_price?: number;
      purchase_price?: number;
      image_url?: string;
      short_description?: string;
      specifications?: string;
      source?: "MASTER_DB" | "AI_WEB_SEARCH" | "EXCEL_IMPORT";
    }>>("GET", `/inventory/master-catalog/search?query=${encodeURIComponent(query)}&search_web=${searchWeb}${provider && provider !== "auto" ? `&provider=${encodeURIComponent(provider)}` : ""}`),

  saveToMasterCatalog: (item: any) =>
    request<any>("POST", "/inventory/master-catalog/save", item),

  importExcelMasterCatalog: (items: any[]) =>
    request<{ message: string; count: number }>("POST", "/inventory/master-catalog/import-excel", { items }),

  importToLocalInventory: (data: Record<string, unknown>) =>
    request<any>("POST", "/inventory/master-catalog/import-to-local-inventory", data),

  triggerRAGEnrichment: (productIds?: string[], enrichAll = false) =>
    request<{ message: string }>("POST", "/inventory/master-catalog/enrich/trigger", { product_ids: productIds, enrich_all: enrichAll }),

  getRAGEnrichmentStatus: () =>
    request<{ total: number; pending: number; processing: number; completed: number; failed: number; paused?: boolean }>("GET", "/inventory/master-catalog/enrich/status"),

  pauseRAGEnrichment: () =>
    request<{ message: string }>("POST", "/inventory/master-catalog/enrich/pause"),

  resumeRAGEnrichment: () =>
    request<{ message: string }>("POST", "/inventory/master-catalog/enrich/resume"),

  adminGetMasterCatalogList: (params?: { page?: number; page_size?: number; search?: string; rag_status?: string }) =>
    request<{ items: any[]; total: number; page: number; page_size: number }>("GET", "/inventory/master-catalog/admin/list", undefined, params as Record<string, any>),
  
  // Categories
  getCategories: (params?: { search?: string; page?: number; page_size?: number }) =>
    request<PaginatedResponse<InventoryCategory>>("GET", "/inventory/categories", undefined, params as Record<string, any>),
  createCategory: (data: Record<string, unknown>) => request<InventoryCategory>("POST", "/inventory/categories", data),
  bulkCreateCategories: (categories: Record<string, unknown>[]) => 
    request<{ created_count: number; skipped_count: number; errors: string[] }>("POST", "/inventory/categories/bulk", { categories }),
  updateCategory: (id: string, data: Record<string, unknown>) => request<InventoryCategory>("PATCH", `/inventory/categories/${id}`, data),
  deleteCategory: (id: string) => request<void>("DELETE", `/inventory/categories/${id}`),
  
  // Brands
  getBrands: (params?: { search?: string; page?: number; page_size?: number }) =>
    request<PaginatedResponse<InventoryBrand>>("GET", "/inventory/brands", undefined, params as Record<string, any>),
  createBrand: (data: Record<string, unknown>) => request<InventoryBrand>("POST", "/inventory/brands", data),
  updateBrand: (id: string, data: Record<string, unknown>) => request<InventoryBrand>("PATCH", `/inventory/brands/${id}`, data),
  deleteBrand: (id: string) => request<void>("DELETE", `/inventory/brands/${id}`),
  
  // UOMs
  getUOMs: (params?: { search?: string; page?: number; page_size?: number }) =>
    request<PaginatedResponse<InventoryUOM>>("GET", "/inventory/uoms", undefined, params as Record<string, any>),
  createUOM: (data: Record<string, unknown>) => request<InventoryUOM>("POST", "/inventory/uoms", data),
  deleteUOM: (id: string) => request<void>("DELETE", `/inventory/uoms/${id}`),

  // Attributes
  getProductAttributes: () => request<ProductAttribute[]>("GET", "/inventory/product-attributes"),
  createProductAttribute: (data: Record<string, unknown>) => request<ProductAttribute>("POST", "/inventory/product-attributes", data),
  deleteProductAttribute: (id: string) => request<void>("DELETE", `/inventory/product-attributes/${id}`),

  // Variants
  getProductVariants: () => request<ProductVariant[]>("GET", "/inventory/product-variants"),
  createProductVariant: (data: Record<string, unknown>) => request<ProductVariant>("POST", "/inventory/product-variants", data),
  deleteProductVariant: (id: string) => request<void>("DELETE", `/inventory/product-variants/${id}`),

  // Bundles
  getProductBundles: () => request<ProductBundle[]>("GET", "/inventory/product-bundles"),
  createProductBundle: (data: Record<string, unknown>) => request<ProductBundle>("POST", "/inventory/product-bundles", data),
  deleteProductBundle: (id: string) => request<void>("DELETE", `/inventory/product-bundles/${id}`),

  // Kits
  getProductKits: () => request<ProductKit[]>("GET", "/inventory/product-kits"),
  createProductKit: (data: Record<string, unknown>) => request<ProductKit>("POST", "/inventory/product-kits", data),
  deleteProductKit: (id: string) => request<void>("DELETE", `/inventory/product-kits/${id}`),

  // Images
  getProductImages: () => request<ProductImage[]>("GET", "/inventory/product-images"),
  createProductImage: (data: Record<string, unknown>) => request<ProductImage>("POST", "/inventory/product-images", data),
  deleteProductImage: (id: string) => request<void>("DELETE", `/inventory/product-images/${id}`),

  // Operations - Overview
  getOperationsOverview: () => request<any>("GET", "/inventory/operations/overview"),

  // Operations - GRN
  getGoodsReceipts: () => request<GoodsReceipt[]>("GET", "/inventory/grn"),
  createGoodsReceipt: (data: Record<string, unknown>) => request<GoodsReceipt>("POST", "/inventory/grn", data),
  deleteGoodsReceipt: (id: string) => request<void>("DELETE", `/inventory/grn/${id}`),

  // Operations - Goods Issue
  getGoodsIssues: () => request<GoodsIssue[]>("GET", "/inventory/goods-issue"),
  createGoodsIssue: (data: Record<string, unknown>) => request<GoodsIssue>("POST", "/inventory/goods-issue", data),
  deleteGoodsIssue: (id: string) => request<void>("DELETE", `/inventory/goods-issue/${id}`),

  // Operations - Stock Movement
  getStockMovements: () => request<StockMovement[]>("GET", "/inventory/movements"),
  createStockMovement: (data: Record<string, unknown>) => request<StockMovement>("POST", "/inventory/movements", data),
  deleteStockMovement: (id: string) => request<void>("DELETE", `/inventory/movements/${id}`),

  // Operations - Stock Adjustment
  getStockAdjustments: () => request<StockAdjustment[]>("GET", "/inventory/adjustments"),
  createStockAdjustment: (data: Record<string, unknown>) => request<StockAdjustment>("POST", "/inventory/adjustments", data),
  deleteStockAdjustment: (id: string) => request<void>("DELETE", `/inventory/adjustments/${id}`),

  // Operations - Cycle Counting
  getCycleCounts: () => request<CycleCount[]>("GET", "/inventory/cycle-counts"),
  createCycleCount: (data: Record<string, unknown>) => request<CycleCount>("POST", "/inventory/cycle-counts", data),
  deleteCycleCount: (id: string) => request<void>("DELETE", `/inventory/cycle-counts/${id}`),

  // Warehouse Management
  getWarehouses: () => request<Warehouse[]>("GET", "/inventory/warehouses"),
  createWarehouse: (data: Record<string, unknown>) => request<Warehouse>("POST", "/inventory/warehouses", data),
  deleteWarehouse: (id: string) => request<void>("DELETE", `/inventory/warehouses/${id}`),
  
  getStorageLocations: () => request<StorageLocation[]>("GET", "/inventory/locations"),
  createStorageLocation: (warehouseId: string, data: Record<string, unknown>) => request<StorageLocation>("POST", `/inventory/warehouses/${warehouseId}/locations`, data),
  deleteStorageLocation: (id: string) => request<void>("DELETE", `/inventory/locations/${id}`),

  // --- Procurement & Supplier Management ---
  getSuppliers: (params?: { search?: string; status?: string }) => request<any[]>("GET", "/inventory/procurement/suppliers", undefined, params),
  createSupplier: (data: any) => request<any>("POST", "/inventory/procurement/suppliers", data),
  updateSupplier: (id: string, data: any) => request<any>("PATCH", `/inventory/procurement/suppliers/${id}`, data),
  deleteSupplier: (id: string) => request<any>("DELETE", `/inventory/procurement/suppliers/${id}`),

  getSupplierCategories: () => request<any[]>("GET", "/inventory/procurement/supplier-categories"),
  createSupplierCategory: (data: any) => request<any>("POST", "/inventory/procurement/supplier-categories", data),

  getSupplierContacts: (params?: { supplier_id?: string }) => request<any[]>("GET", "/inventory/procurement/supplier-contacts", undefined, params),
  createSupplierContact: (data: any) => request<any>("POST", "/inventory/procurement/supplier-contacts", data),

  getSupplierContracts: (params?: { supplier_id?: string }) => request<any[]>("GET", "/inventory/procurement/supplier-contracts", undefined, params),
  createSupplierContract: (data: any) => request<any>("POST", "/inventory/procurement/supplier-contracts", data),

  getSupplierPerformance: (params?: { supplier_id?: string }) => request<any[]>("GET", "/inventory/procurement/supplier-performance", undefined, params),
  createSupplierPerformance: (data: any) => request<any>("POST", "/inventory/procurement/supplier-performance", data),

  getBlacklistedSuppliers: () => request<any[]>("GET", "/inventory/procurement/blacklisted-suppliers"),
  blacklistSupplier: (data: any) => request<any>("POST", "/inventory/procurement/blacklisted-suppliers", data),

  getPurchaseRequests: () => request<any[]>("GET", "/inventory/procurement/purchase-requests"),
  createPurchaseRequest: (data: any) => request<any>("POST", "/inventory/procurement/purchase-requests", data),

  getPurchaseQuotations: () => request<any[]>("GET", "/inventory/procurement/purchase-quotations"),
  createPurchaseQuotation: (data: any) => request<any>("POST", "/inventory/procurement/purchase-quotations", data),

  getPurchaseOrders: () => request<any[]>("GET", "/inventory/procurement/purchase-orders"),
  createPurchaseOrder: (data: any) => request<any>("POST", "/inventory/procurement/purchase-orders", data),

  getGoodsReceivedNotes: () => request<any[]>("GET", "/inventory/procurement/goods-received-notes"),
  createGoodsReceivedNote: (data: any) => request<any>("POST", "/inventory/procurement/goods-received-notes", data),

  getPurchaseReturns: () => request<any[]>("GET", "/inventory/procurement/purchase-returns"),
  createPurchaseReturn: (data: any) => request<any>("POST", "/inventory/procurement/purchase-returns", data),

  getVendorBills: () => request<any[]>("GET", "/inventory/procurement/vendor-bills"),
  createVendorBill: (data: any) => request<any>("POST", "/inventory/procurement/vendor-bills", data),

  getVendorPayments: () => request<any[]>("GET", "/inventory/procurement/vendor-payments"),
  createVendorPayment: (data: any) => request<any>("POST", "/inventory/procurement/vendor-payments", data),

  getVendorCreditNotes: () => request<any[]>("GET", "/inventory/procurement/credit-notes"),
  createVendorCreditNote: (data: any) => request<any>("POST", "/inventory/procurement/credit-notes", data),
  getVendorDebitNotes: () => request<any[]>("GET", "/inventory/procurement/debit-notes"),
  createVendorDebitNote: (data: any) => request<any>("POST", "/inventory/procurement/debit-notes", data),

  getSpendAnalysis: () => request<any>("GET", "/inventory/procurement/analytics/spend-analysis"),
  getLeadTimeAnalysis: () => request<any[]>("GET", "/inventory/procurement/analytics/lead-time"),
  getAISuggestions: (refresh = false) => request<any[]>("GET", `/inventory/procurement/analytics/ai-suggestions?refresh=${refresh}`),
  executeAISuggestion: (id: string) => request<{ message: string; purchase_request_id?: string }>("POST", `/inventory/procurement/analytics/ai-suggestions/${id}/execute`),
  getCostAnalysis: () => request<any>("GET", "/inventory/procurement/analytics/cost-analysis"),
  getProcurementForecast: () => request<any>("GET", "/inventory/procurement/analytics/procurement-forecast"),
  getPendingApprovals: () => request<any[]>("GET", "/inventory/procurement/analytics/approvals"),
  submitApprovalAction: (id: string, raw_type: string, action: string) => request<any>("POST", `/inventory/procurement/analytics/approvals/${id}/action`, { raw_type, action }),

  // --- Real-time Analytics & Intelligence ---
  getReportData: (tab: string) => request<any>("GET", `/analytics/reports/${tab}`),
  consultAIReport: (tab: string, query: string, contextData: any) => request<{ answer: string }>("POST", `/analytics/reports/${tab}/ai-consult`, { query, contextData }),

  // --- Zoho Recruit Integration ---
  getZohoStatus: () => request<any>("GET", "/integrations/zoho/status"),
  connectZoho: () => request<{ url: string }>("GET", "/integrations/zoho/connect"),
  disconnectZoho: () => request<any>("DELETE", "/integrations/zoho/disconnect"),
  testZohoConnection: () => request<any>("POST", "/integrations/zoho/test"),
  publishJobToZoho: (jobId: string) => request<any>("POST", "/integrations/zoho/jobs/publish", { job_id: jobId }),
  syncJobsFromZoho: () => request<{ success: boolean; message: string; created: number; updated: number; total_from_zoho: number }>("POST", "/integrations/zoho/sync-from-zoho"),
};