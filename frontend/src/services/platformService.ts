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
  active_modules: string[];
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
  subject: string;
  module: string;
  resource: string;
  operation: string;
  effect: "allow" | "deny";
  params?: Record<string, unknown>;
  condition?: Record<string, unknown>;
  priority: number;
  created_at: string;
}

export const platformService = {
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
    subject: string;
    module: string;
    resource: string;
    operation: string;
    effect: "allow" | "deny";
    priority?: number;
    condition?: Record<string, unknown>;
  }): Promise<AccessPolicyItem> {
    return apiClient.post<AccessPolicyItem>("/api/v1/platform/policies", data, { isPlatform: true });
  },
};
