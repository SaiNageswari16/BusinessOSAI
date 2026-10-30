/**
 * Delivery Dispatch Service Client (Native Fetch).
 *
 * Microservice: delivery via API Gateway (:8000)
 * Mount: /api/v1/delivery
 *
 * Routes: /delivery-boys, /delivery-zones, /deliveries, /deliveries/live,
 *         /deliveries/{id}, /deliveries/{id}/logs, /deliveries/{id}/assign,
 *         /deliveries/{id}/status
 */

import { apiClient } from "../lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryBoy {
  id: string;
  tenant_id: string;
  outlet_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  area?: string | null;
  active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryZone {
  id: string;
  tenant_id: string;
  outlet_id: string;
  name: string;
  radius_km: number;
  pincode?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** Lifecycle: assigned -> delivering -> delivered; any open state -> cancelled. */
export type DeliveryStatus = "assigned" | "delivering" | "delivered" | "cancelled";

export interface Delivery {
  id: string;
  tenant_id: string;
  outlet_id?: string | null;
  order_id: string;
  boy_id?: string | null;
  zone_id?: string | null;
  status: DeliveryStatus | string;
  boy_name?: string | null;
  zone_name?: string | null;
  assigned_at?: string | null;
  delivered_at?: string | null;
  cancel_reason?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** One tile on the live dispatch board — a delivery joined to its boy. */
export interface DeliveryLiveItem {
  delivery: Delivery;
  boy?: DeliveryBoy | null;
}

export interface DeliveryLog {
  id: string;
  delivery_id: string;
  from_status?: string | null;
  to_status: string;
  changed_by?: string | null;
  note?: string | null;
  created_at: string;
}

// ── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateDeliveryBoyPayload {
  outlet_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  area?: string | null;
  active?: boolean;
  notes?: string | null;
}

export type UpdateDeliveryBoyPayload = Partial<CreateDeliveryBoyPayload>;

export interface CreateDeliveryZonePayload {
  outlet_id: string;
  name: string;
  radius_km?: number;
  pincode?: string | null;
  active?: boolean;
}

export type UpdateDeliveryZonePayload = Partial<CreateDeliveryZonePayload>;

export interface CreateDeliveryPayload {
  order_id: string;
  outlet_id?: string | null;
  zone_id?: string | null;
  boy_id?: string | null;
  notes?: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const deliveryService = {
  // Boys
  async getBoys(params: {
    outletId?: string;
    activeOnly?: boolean;
    q?: string;
  } = {}): Promise<DeliveryBoy[]> {
    return apiClient.get<DeliveryBoy[]>("/api/v1/delivery/delivery-boys", {
      params: {
        outlet_id: params.outletId,
        active: params.activeOnly,
        q: params.q,
      },
    });
  },

  async createBoy(data: CreateDeliveryBoyPayload): Promise<DeliveryBoy> {
    return apiClient.post<DeliveryBoy>("/api/v1/delivery/delivery-boys", data);
  },

  async updateBoy(boyId: string, data: UpdateDeliveryBoyPayload): Promise<DeliveryBoy> {
    return apiClient.patch<DeliveryBoy>(
      `/api/v1/delivery/delivery-boys/${boyId}`,
      data
    );
  },

  // Zones
  async getZones(params: { outletId?: string; activeOnly?: boolean } = {}): Promise<
    DeliveryZone[]
  > {
    return apiClient.get<DeliveryZone[]>("/api/v1/delivery/delivery-zones", {
      params: {
        outlet_id: params.outletId,
        active: params.activeOnly,
      },
    });
  },

  async createZone(data: CreateDeliveryZonePayload): Promise<DeliveryZone> {
    return apiClient.post<DeliveryZone>("/api/v1/delivery/delivery-zones", data);
  },

  async updateZone(zoneId: string, data: UpdateDeliveryZonePayload): Promise<DeliveryZone> {
    return apiClient.patch<DeliveryZone>(
      `/api/v1/delivery/delivery-zones/${zoneId}`,
      data
    );
  },

  // Deliveries
  async getLiveBoard(outletId?: string): Promise<DeliveryLiveItem[]> {
    return apiClient.get<DeliveryLiveItem[]>("/api/v1/delivery/deliveries/live", {
      params: { outlet_id: outletId },
    });
  },

  async getDeliveries(params: {
    outletId?: string;
    status?: string;
    orderId?: string;
    limit?: number;
  } = {}): Promise<Delivery[]> {
    return apiClient.get<Delivery[]>("/api/v1/delivery/deliveries", {
      params: {
        outlet_id: params.outletId,
        status: params.status,
        order_id: params.orderId,
        limit: params.limit,
      },
    });
  },

  async getDelivery(deliveryId: string): Promise<Delivery> {
    return apiClient.get<Delivery>(`/api/v1/delivery/deliveries/${deliveryId}`);
  },

  async getDeliveryLogs(deliveryId: string): Promise<DeliveryLog[]> {
    return apiClient.get<DeliveryLog[]>(
      `/api/v1/delivery/deliveries/${deliveryId}/logs`
    );
  },

  /** Open a dispatch for an order — assign a boy or leave it pending. */
  async createDelivery(data: CreateDeliveryPayload): Promise<Delivery> {
    return apiClient.post<Delivery>("/api/v1/delivery/deliveries", data);
  },

  /** Attach a boy to a pending delivery (boy_id is required). */
  async assignDelivery(deliveryId: string, data: CreateDeliveryPayload): Promise<Delivery> {
    return apiClient.post<Delivery>(
      `/api/v1/delivery/deliveries/${deliveryId}/assign`,
      data
    );
  },

  /** Advance the state machine: delivering / delivered / cancelled. */
  async updateStatus(
    deliveryId: string,
    toStatus: string,
    note?: string
  ): Promise<Delivery> {
    return apiClient.patch<Delivery>(
      `/api/v1/delivery/deliveries/${deliveryId}/status`,
      { to_status: toStatus, note: note || undefined }
    );
  },
};
