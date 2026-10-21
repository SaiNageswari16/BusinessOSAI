/**
 * Kitchen Service Client (Native Fetch).
 *
 * Microservice: kitchen (:8104) via API Gateway (:8000)
 * Mount: /api/v1/kitchen
 */

import { apiClient } from "../lib/api-client";

export interface KitchenStation {
  id: string;
  outlet_id: string;
  name: string;
  station_type: string;
  is_active: boolean;
  capacity_concurrent: number;
  avg_prep_minutes?: number;
  open_ticket_count: number;
  created_at: string;
}

export interface KOTItem {
  id: string;
  name: string;
  variant_name?: string;
  qty: number;
  position: number;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  course_number?: number;
  notes?: string;
  modifiers: any[];
  prepared_at?: string;
}

export interface KOTTicket {
  id: string;
  outlet_id: string;
  order_id: string;
  order_number?: string;
  table_id?: string;
  table_name?: string;
  station_id: string;
  kot_number: string;
  status: "pending" | "acknowledged" | "preparing" | "ready" | "served" | "cancelled";
  priority: "normal" | "rush" | "vip";
  course_number?: number;
  covers: number;
  order_type?: string;
  fired_at?: string;
  acknowledged_at?: string;
  ready_at?: string;
  served_at?: string;
  printed_count: number;
  notes?: string;
  items: KOTItem[];
  item_count: number;
  created_at: string;
}

export interface KOTListResponse {
  tickets: {
    id: string;
    station_id: string;
    kot_number: string;
    order_number?: string;
    table_name?: string;
    covers: number;
    order_type?: string;
    status: string;
    priority: string;
    course_number?: number;
    fired_at?: string;
    acknowledged_at?: string;
    ready_at?: string;
  }[];
  total: number;
}

export interface CreateKOTPayload {
  outlet_id: string;
  order_id?: string;
  order_number?: string;
  table_id?: string;
  table_name?: string;
  station_id: string;
  course_number?: number;
  covers?: number;
  order_type?: string;
  priority?: "normal" | "rush" | "vip";
  notes?: string;
  items: {
    menu_item_id?: string;
    name: string;
    variant_name?: string;
    qty: number;
    notes?: string;
    course_number?: number;
  }[];
}

export const kitchenService = {
  // Stations
  async getStations(outletId?: string): Promise<KitchenStation[]> {
    return apiClient.get<KitchenStation[]>("/api/v1/kitchen/stations", {
      params: { outlet_id: outletId },
    });
  },

  async createStation(data: { outlet_id: string; name: string; station_type?: string }): Promise<KitchenStation> {
    return apiClient.post<KitchenStation>("/api/v1/kitchen/stations", data);
  },

  // KOT Tickets
  async getKOTs(options: {
    stationId?: string;
    outletId?: string;
    includeClosed?: boolean;
    limit?: number;
  } = {}): Promise<KOTListResponse> {
    return apiClient.get<KOTListResponse>("/api/v1/kitchen/kots", {
      params: {
        station_id: options.stationId,
        outlet_id: options.outletId,
        include_closed: options.includeClosed,
        limit: options.limit || 100,
      },
    });
  },

  async getKOT(kotId: string): Promise<KOTTicket> {
    return apiClient.get<KOTTicket>(`/api/v1/kitchen/kots/${kotId}`);
  },

  async createKOT(data: CreateKOTPayload): Promise<KOTTicket> {
    return apiClient.post<KOTTicket>("/api/v1/kitchen/kots", data);
  },

  async markAcknowledged(kotId: string): Promise<KOTTicket> {
    return apiClient.post<KOTTicket>(`/api/v1/kitchen/kots/${kotId}/acknowledged`);
  },

  async markReady(kotId: string): Promise<KOTTicket> {
    return apiClient.post<KOTTicket>(`/api/v1/kitchen/kots/${kotId}/ready`);
  },

  async markServed(kotId: string): Promise<KOTTicket> {
    return apiClient.post<KOTTicket>(`/api/v1/kitchen/kots/${kotId}/served`);
  },

  async cancelKOT(kotId: string, reason?: string): Promise<KOTTicket> {
    return apiClient.post<KOTTicket>(`/api/v1/kitchen/kots/${kotId}/cancel`, { reason });
  },

  async updateItemStatus(kotId: string, itemId: string, toStatus: string): Promise<KOTTicket> {
    return apiClient.patch<KOTTicket>(`/api/v1/kitchen/kots/${kotId}/items/${itemId}`, {
      to_status: toStatus,
    });
  },
};
