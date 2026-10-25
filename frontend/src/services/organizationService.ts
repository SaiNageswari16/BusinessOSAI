/**
 * Organization Service Client (Native Fetch).
 *
 * Microservice: organization (:8102) via API Gateway (:8000)
 * Mount: /api/v1/organization
 */

import { apiClient } from "../lib/api-client";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Outlet {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  is_active: boolean;
  phone?: string;
  address?: string;
  city?: string;
  currency?: string;
  timezone?: string;
  created_at: string;
}

export interface RestaurantTable {
  id: string;
  tenant_id: string;
  outlet_id: string;
  name: string;
  section_id?: string;
  capacity: number;
  status: "available" | "occupied" | "reserved" | "billed" | "dirty" | "out_of_service";
  is_active: boolean;
  created_at: string;
}

export interface CreateTablePayload {
  name: string;
  code?: string;
  capacity?: number;
  seats?: number;
  shape?: string;
  section_id?: string;
  outlet_id?: string;
  position_x?: number;
  position_y?: number;
}

export interface UpdateTablePayload {
  name?: string;
  capacity?: number;
  seats?: number;
  shape?: string;
  section_id?: string;
  status?: RestaurantTable["status"];
  is_active?: boolean;
  position_x?: number;
  position_y?: number;
}

export const organizationService = {
  // Tenants
  async getTenants(): Promise<Tenant[]> {
    return apiClient.get<Tenant[]>("/api/v1/organization/tenants");
  },

  async createTenant(data: { name: string; slug: string; contact_email?: string; contact_phone?: string }): Promise<Tenant> {
    return apiClient.post<Tenant>("/api/v1/organization/tenants", data);
  },

  // Outlets
  async getOutlets(includeInactive = false): Promise<Outlet[]> {
    return apiClient.get<Outlet[]>("/api/v1/organization/outlets", {
      params: { include_inactive: includeInactive },
    });
  },

  async getOutlet(outletId: string): Promise<Outlet> {
    return apiClient.get<Outlet>(`/api/v1/organization/outlets/${outletId}`);
  },

  async createOutlet(data: { name: string; code: string; phone?: string; address?: string; city?: string }): Promise<Outlet> {
    return apiClient.post<Outlet>("/api/v1/organization/outlets", data);
  },

  async updateOutlet(outletId: string, data: Partial<Outlet>): Promise<Outlet> {
    return apiClient.put<Outlet>(`/api/v1/organization/outlets/${outletId}`, data);
  },

  // Sections / Floors
  async getSections(): Promise<{ id: string; name: string; section_type: string; capacity: number; sort_order?: number }[]> {
    return apiClient.get<{ id: string; name: string; section_type: string; capacity: number; sort_order?: number }[]>("/api/v1/organization/sections");
  },

  async createSection(data: {
    name: string;
    section_type?: string;
    capacity?: number;
    outlet_id?: string;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<{ id: string; name: string; section_type: string; capacity: number }> {
    return apiClient.post<{ id: string; name: string; section_type: string; capacity: number }>("/api/v1/organization/sections", {
      outlet_id: data.outlet_id || "11111111-2222-3333-4444-555555555555",
      name: data.name,
      section_type: data.section_type || "ac_hall",
      capacity: data.capacity || 40,
      sort_order: data.sort_order || 0,
      is_active: data.is_active ?? true,
    });
  },

  async updateSection(
    sectionId: string,
    data: Partial<{ name: string; section_type: string; capacity: number; sort_order: number; is_active: boolean }>
  ): Promise<{ id: string; name: string; section_type: string; capacity: number }> {
    return apiClient.put<{ id: string; name: string; section_type: string; capacity: number }>(`/api/v1/organization/sections/${sectionId}`, data);
  },

  async deleteSection(sectionId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/organization/sections/${sectionId}`);
  },

  // Tables
  async getTables(outletId?: string): Promise<RestaurantTable[]> {
    return apiClient.get<RestaurantTable[]>("/api/v1/organization/tables", {
      params: { outlet_id: outletId },
    });
  },

  async createTable(data: CreateTablePayload): Promise<RestaurantTable> {
    return apiClient.post<RestaurantTable>("/api/v1/organization/tables", data);
  },

  async updateTable(tableId: string, data: UpdateTablePayload): Promise<RestaurantTable> {
    return apiClient.put<RestaurantTable>(`/api/v1/organization/tables/${tableId}`, data);
  },

  /**
   * Table status accepted by the organization service (loose by design —
   * the backend validates the actual enum and returns a 422 on a typo):
   * free | available | occupied | reserved | billing | billed | cleaning |
   * dirty | blocked | out_of_service.
   */
  async setTableStatus(
    tableId: string,
    status: string
  ): Promise<RestaurantTable> {
    return apiClient.put<RestaurantTable>(`/api/v1/organization/tables/${tableId}/status`, { status });
  },

  async deleteTable(tableId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/organization/tables/${tableId}`);
  },
};
