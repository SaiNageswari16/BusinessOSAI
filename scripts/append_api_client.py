"""Append new API client code to api-client.ts"""
import os

ADDITIONS = """
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
"""

target = os.path.join("frontend", "src", "lib", "api-client.ts")
with open(target, "a", encoding="utf-8") as f:
    f.write(ADDITIONS)
print(f"Appended to {target}")
