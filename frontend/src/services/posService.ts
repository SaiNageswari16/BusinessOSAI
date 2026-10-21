/**
 * POS & Ordering Service Client (Native Fetch).
 *
 * Microservice: pos (:8103) via API Gateway (:8000)
 * Mount: /api/v1/pos
 */

import { apiClient } from "../lib/api-client";

export interface OrderLineItem {
  id?: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  tax_amount?: number;
  total_price: number;
  notes?: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  outlet_id: string;
  order_number: string;
  order_type: "dine_in" | "takeaway" | "delivery" | "qsr";
  status: "draft" | "placed" | "preparing" | "ready" | "served" | "settled" | "cancelled";
  table_id?: string;
  covers?: number;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  grand_total: number;
  paid_amount: number;
  lines: OrderLineItem[];
  created_at: string;
  updated_at?: string;
}

export interface CreateOrderPayload {
  outlet_id: string;
  order_type: Order["order_type"];
  table_id?: string;
  covers?: number;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  lines: {
    menu_item_id: string;
    quantity: number;
    notes?: string;
  }[];
}

export interface RecordPaymentPayload {
  payment_method: "cash" | "card" | "upi" | "online" | "wallet";
  amount: number;
  reference?: string;
}

export const posService = {
  // Orders
  async getOrders(options: {
    outletId?: string;
    statusFilter?: string;
    tableId?: string;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<Order[]> {
    return apiClient.get<Order[]>("/api/v1/pos/orders", {
      params: {
        outlet_id: options.outletId,
        status_filter: options.statusFilter,
        table_id: options.tableId,
        active_only: options.activeOnly,
        limit: options.limit || 100,
        offset: options.offset || 0,
      },
    });
  },

  async getOrder(orderId: string): Promise<Order> {
    return apiClient.get<Order>(`/api/v1/pos/orders/${orderId}`);
  },

  async createOrder(data: CreateOrderPayload): Promise<Order> {
    return apiClient.post<Order>("/api/v1/pos/orders", data);
  },

  async updateOrderStatus(orderId: string, status: Order["status"]): Promise<Order> {
    return apiClient.put<Order>(`/api/v1/pos/orders/${orderId}/status`, { status });
  },

  async addOrderLines(orderId: string, lines: { menu_item_id: string; quantity: number; notes?: string }[]): Promise<Order> {
    return apiClient.post<Order>(`/api/v1/pos/orders/${orderId}/lines`, { lines });
  },

  async recordPayment(orderId: string, payment: RecordPaymentPayload): Promise<Order> {
    return apiClient.post<Order>(`/api/v1/pos/orders/${orderId}/payments`, payment);
  },

  async settleOrder(orderId: string): Promise<Order> {
    return apiClient.patch<Order>(`/api/v1/pos/orders/${orderId}`, { status: "settled" });
  },

  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    return apiClient.post<Order>(`/api/v1/pos/orders/${orderId}/cancel`, { reason });
  },

  // Reservations
  async getReservations(outletId?: string): Promise<any[]> {
    return apiClient.get<any[]>("/api/v1/pos/reservations", {
      params: { outlet_id: outletId },
    });
  },

  async createReservation(data: {
    outlet_id: string;
    table_id?: string;
    customer_name: string;
    customer_phone?: string;
    party_size: number;
    reservation_time: string;
    notes?: string;
  }): Promise<any> {
    return apiClient.post<any>("/api/v1/pos/reservations", data);
  },

  async updateReservation(reservationId: string, data: any): Promise<any> {
    return apiClient.patch<any>(`/api/v1/pos/reservations/${reservationId}`, data);
  },
};
