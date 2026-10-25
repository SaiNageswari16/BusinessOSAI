/**
 * Platform Super Admin Service Client (Native Fetch).
 *
 * Microservice: platform (:8113) via API Gateway (:8000)
 * Mount: /api/v1/platform
 * Uses `isPlatform: true` to inject `platform_token` from isolated auth realm.
 */

import { apiClient } from "../lib/api-client";
import { setPlatformToken, clearPlatformToken, getPlatformToken } from "../lib/auth-tokens";

export interface PlatformAdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface PlatformLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  admin: PlatformAdminUser;
}

export interface ServiceHealthStatus {
  service: string;
  port: number;
  status: "up" | "down" | "starting" | string;
  latency_ms: number | null;
  database: string;
  error?: string | null;
}

export interface FleetHealthReport {
  overall_status: "ok" | "degraded" | "down";
  services_up: number;
  services_total: number;
  services: ServiceHealthStatus[];
  checked_at: string;
}

export interface TenantSummary {
  tenant_id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  contact_email?: string;
  contact_phone?: string;
  active_modules: string[];
  module_versions?: Record<string, string>;
  created_at: string;
}

export interface TenantRosterItem {
  id: string | null;
  name: string;
  slug: string;
  status: string;
  plan: string;
  created_at: string;
  active_modules: string[];
  module_versions?: Record<string, string>;
  is_managed: boolean;
}

export interface AuditEntry {
  id: string;
  admin_id: string | null;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditList {
  items: AuditEntry[];
  total: number;
  has_more: boolean;
}

export interface PlatformAdminRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface TenantOnboardPayload {
  name: string;
  slug: string;
  vertical: string;
  enabled_modules: string[];
  plan: string;
  contact_email: string;
  contact_phone?: string;
  initial_branch_name: string;
  initial_branch_code: string;
  owner_name: string;
  owner_email: string;
  owner_password: string;
  initial_settings?: Record<string, unknown>;
}

export interface TenantOnboardResult {
  tenant_id: string;
  organization_id: string;
  outlet_id: string;
  slug: string;
  name: string;
  vertical: string;
  active_modules: string[];
  owner_email: string;
  created_at: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  category: string;
  description: string;
  icon?: string;
  required_capabilities: string[];
  permissions: string[];
  navigation: { key: string; label: string; to: string; icon: string }[];
  settings_schema?: Record<string, unknown>;
  is_system: boolean;
  is_active: boolean;
  /** Whether the API gateway enforces this module's per-tenant state. */
  gated: boolean;
}

export interface TenantModuleState {
  id: string;
  tenant_id: string;
  plugin_id: string;
  state: "active" | "suspended" | "archived";
  activated_version: string;
  schema_version: string;
  config: Record<string, unknown>;
  activated_at?: string;
  suspended_at?: string;
  archived_at?: string;
}

export interface PermissionCatalogueItem {
  code: string;
  module: string;
  name: string;
  description?: string;
  tier: number;
  is_system: boolean;
}

export interface AccessPolicyItem {
  id: string;
  tenant_id?: string | null;
  subject: Record<string, unknown> | string;
  module: string;
  resource: string;
  operation: string;
  effect: "allow" | "deny" | "mask" | "limit";
  params?: Record<string, unknown>;
  condition?: Record<string, unknown>;
  priority: number;
  created_at: string;
}

export const platformService = {
  // ── Tenants (full auth-service roster, not just platform-managed rows) ──
  async listAllTenants(params: {
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: TenantRosterItem[]; total: number }> {
    const cleanParams: Record<string, string | number | boolean | undefined> = {};
    if (params.search) cleanParams["search"] = params.search;
    if (params.limit !== undefined) cleanParams["limit"] = params.limit;
    if (params.offset !== undefined) cleanParams["offset"] = params.offset;
    return apiClient.get<{ items: TenantRosterItem[]; total: number }>(
      "/api/v1/platform/tenants/all",
      { params: cleanParams, isPlatform: true }
    );
  },

  // Auth
  async login(email: string, password: string): Promise<PlatformLoginResponse> {
    const res = await apiClient.post<PlatformLoginResponse>(
      "/api/v1/platform/auth/login",
      { email, password },
      { skipAuth: true, isPlatform: true }
    );
    if (res?.access_token) {
      setPlatformToken(res.access_token);
    }
    return res;
  },

  logout(): void {
    clearPlatformToken();
  },

  isAuthenticated(): boolean {
    return !!getPlatformToken();
  },

  async getMe(): Promise<PlatformAdminUser> {
    return apiClient.get<PlatformAdminUser>("/api/v1/platform/auth/me", { isPlatform: true });
  },

  // Fleet Health
  async getFleetHealth(): Promise<FleetHealthReport> {
    return apiClient.get<FleetHealthReport>("/api/v1/platform/fleet/health", { isPlatform: true });
  },

  // Tenants
  async getTenants(): Promise<TenantSummary[]> {
    return apiClient.get<TenantSummary[]>("/api/v1/platform/tenants", { isPlatform: true });
  },

  async onboardTenant(payload: TenantOnboardPayload): Promise<TenantOnboardResult> {
    return apiClient.post<TenantOnboardResult>("/api/v1/platform/tenants/onboard", payload, { isPlatform: true });
  },

  async getTenantModules(tenantId: string): Promise<TenantModuleState[]> {
    return apiClient.get<TenantModuleState[]>(`/api/v1/platform/tenants/${tenantId}/modules`, { isPlatform: true });
  },

  async activateTenantModule(tenantId: string, pluginId: string, config: Record<string, unknown> = {}): Promise<TenantModuleState> {
    return apiClient.post<TenantModuleState>(
      `/api/v1/platform/tenants/${tenantId}/modules/${pluginId}/activate`,
      { config },
      { isPlatform: true }
    );
  },

  async suspendTenantModule(tenantId: string, pluginId: string): Promise<TenantModuleState> {
    return apiClient.post<TenantModuleState>(
      `/api/v1/platform/tenants/${tenantId}/modules/${pluginId}/suspend`,
      {},
      { isPlatform: true }
    );
  },

  async archiveTenantModule(tenantId: string, pluginId: string): Promise<TenantModuleState> {
    return apiClient.post<TenantModuleState>(
      `/api/v1/platform/tenants/${tenantId}/modules/${pluginId}/archive`,
      {},
      { isPlatform: true }
    );
  },

  // Marketplace & Plugins
  async getPlugins(): Promise<PluginManifest[]> {
    return apiClient.get<PluginManifest[]>("/api/v1/platform/plugins", { isPlatform: true });
  },

  async togglePluginKillSwitch(pluginId: string, isActive: boolean): Promise<PluginManifest> {
    return apiClient.post<PluginManifest>(
      `/api/v1/platform/plugins/${pluginId}/toggle-kill-switch?is_active=${isActive}`,
      {},
      { isPlatform: true }
    );
  },

  // Permissions & Catalog
  async getPermissions(module?: string): Promise<PermissionCatalogueItem[]> {
    return apiClient.get<PermissionCatalogueItem[]>("/api/v1/platform/permissions", {
      params: { module },
      isPlatform: true,
    });
  },

  async createPermission(data: {
    code: string;
    module: string;
    name: string;
    description?: string;
    tier: number;
  }): Promise<PermissionCatalogueItem> {
    return apiClient.post<PermissionCatalogueItem>("/api/v1/platform/permissions", data, { isPlatform: true });
  },

  // Policies (ABAC)
  async getPolicies(tenantId?: string): Promise<AccessPolicyItem[]> {
    return apiClient.get<AccessPolicyItem[]>("/api/v1/platform/policies", {
      params: { tenant_id: tenantId },
      isPlatform: true,
    });
  },

  async createPolicy(data: {
    tenant_id?: string;
    subject: Record<string, unknown>;
    module: string;
    resource: string;
    operation: string;
    effect: "allow" | "deny" | "mask" | "limit";
    priority?: number;
    condition?: Record<string, unknown>;
    params?: Record<string, unknown>;
  }): Promise<AccessPolicyItem> {
    return apiClient.post<AccessPolicyItem>("/api/v1/platform/policies", data, { isPlatform: true });
  },

  async deletePolicy(policyId: string): Promise<void> {
    await apiClient.delete(`/api/v1/platform/policies/${policyId}`, { isPlatform: true });
  },

  // Audit Trail
  async getAudit(params?: {
    limit?: number;
    offset?: number;
    action?: string;
    admin_email?: string;
    target_type?: string;
  }): Promise<AuditList> {
    const cleanParams: Record<string, string | number | boolean | undefined> = {};
    if (params?.limit !== undefined) cleanParams["limit"] = params.limit;
    if (params?.offset !== undefined) cleanParams["offset"] = params.offset;
    if (params?.action) cleanParams["action"] = params.action;
    if (params?.admin_email) cleanParams["admin_email"] = params.admin_email;
    if (params?.target_type) cleanParams["target_type"] = params.target_type;
    return apiClient.get<AuditList>("/api/v1/platform/audit", {
      params: cleanParams,
      isPlatform: true,
    });
  },

  // Admin Users
  async getAdmins(): Promise<{ items: PlatformAdminRecord[]; total: number }> {
    return apiClient.get<{ items: PlatformAdminRecord[]; total: number }>(
      "/api/v1/platform/admins",
      { isPlatform: true }
    );
  },

  async createAdmin(data: {
    email: string;
    password: string;
    full_name: string;
    role: string;
  }): Promise<PlatformAdminRecord> {
    return apiClient.post<PlatformAdminRecord>(
      "/api/v1/platform/admins",
      data,
      { isPlatform: true }
    );
  },

  async updateAdmin(
    adminId: string,
    data: { is_active?: boolean; full_name?: string; role?: string }
  ): Promise<PlatformAdminRecord> {
    return apiClient.patch<PlatformAdminRecord>(
      `/api/v1/platform/admins/${adminId}`,
      data,
      { isPlatform: true }
    );
  },
};
