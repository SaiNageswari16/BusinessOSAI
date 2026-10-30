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
  /** Printers-service printer this station's KOTs route to (null = outlet default). */
  printer_id?: string | null;
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

export interface KOTPrintPreview {
  kot_id: string;
  kot_number: string;
  order_number?: string | null;
  order_type?: string | null;
  table_name?: string | null;
  station_id: string;
  station_name?: string | null;
  status: string;
  priority: string;
  item_count: number;
  course_number?: number | null;
  covers: number;
  notes?: string | null;
  fired_at?: string | null;
  ready_at?: string | null;
  served_at?: string | null;
  /** Each item: {name, variant_name, qty, notes, modifiers, course_number}. */
  items: {
    name?: string;
    variant_name?: string;
    qty?: number;
    notes?: string;
    modifiers?: unknown[];
    course_number?: number;
    [k: string]: unknown;
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

  /**
   * Kitchen-level printer setup: point a station's print destination at a
   * printers-service printer. `printer_id: null` clears the binding and
   * falls back to the outlet default.
   */
  async updateStationPrinter(
    stationId: string,
    data: { printer_id?: string | null; name?: string; station_type?: string }
  ): Promise<KitchenStation> {
    return apiClient.patch<KitchenStation>(
      `/api/v1/kitchen/stations/${stationId}`,
      data
    );
  },

  // KOT Tickets
  async getKOTs(options: {
    stationId?: string;
    outletId?: string;
    orderNumber?: string;
    includeClosed?: boolean;
    limit?: number;
  } = {}): Promise<KOTListResponse> {
    return apiClient.get<KOTListResponse>("/api/v1/kitchen/kots", {
      params: {
        station_id: options.stationId,
        outlet_id: options.outletId,
        order_number: options.orderNumber,
        include_closed: options.includeClosed,
        limit: options.limit || 100,
      },
    });
  },

  /**
   * KDS-by-number: every station's KOT for one order number (the cashier's
   * "which tickets does order #1234 have open" lookup). No station required.
   */
  async getKOTsByNumber(
    orderNumber: string,
    options: { outletId?: string; includeClosed?: boolean; limit?: number } = {}
  ): Promise<KOTListResponse> {
    return apiClient.get<KOTListResponse>("/api/v1/kitchen/kots/by-number", {
      params: {
        n: orderNumber,
        outlet_id: options.outletId,
        include_closed: options.includeClosed,
        limit: options.limit || 100,
      },
    });
  },

  /** Structured thermal render of one KOT — the single source of "what goes on the paper". */
  async getKOTPrintPreview(kotId: string): Promise<KOTPrintPreview> {
    return apiClient.get<KOTPrintPreview>(`/api/v1/kitchen/kots/${kotId}/print-preview`);
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
