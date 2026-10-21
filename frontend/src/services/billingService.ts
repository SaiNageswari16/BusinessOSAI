/**
 * Billing & Invoicing Microservice Client (Native Fetch).
 *
 * Microservice: billing (:8105) via API Gateway (:8000)
 * Mount: /api/v1/billing
 */

import { apiClient } from "../lib/api-client";

export interface BillItemPayload {
  menu_item_id: string;
  name: string;
  qty: number;
  unit_price: number;
  tax_code_id?: string;
  hsn_code?: string;
  discount_amount?: number;
  notes?: string;
}

export interface CreateBillPayload {
  outlet_id: string;
  order_id?: string;
  order_number?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_gstin?: string;
  covers?: number;
  items: BillItemPayload[];
  service_charge_pct?: number;
  packaging_charge?: number;
  tip?: number;
}

export interface SettleBillPayload {
  payments: {
    method: "cash" | "card" | "upi" | "wallet" | "credit";
    amount: number;
    reference?: string;
  }[];
}

export interface BillResponse {
  id: string;
  bill_number: string;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  cgst_total: number;
  sgst_total: number;
  service_charge: number;
  grand_total: number;
  paid_amount: number;
  status: "draft" | "settled" | "void" | "refunded";
  settled_at?: string;
  created_at: string;
}

export const billingService = {
  async getBills(outletId?: string, limit = 50): Promise<BillResponse[]> {
    return apiClient.get<BillResponse[]>("/api/v1/billing/bills", {
      params: { outlet_id: outletId, limit },
    });
  },

  async getBill(billId: string): Promise<BillResponse> {
    return apiClient.get<BillResponse>(`/api/v1/billing/bills/${billId}`);
  },

  async createBill(data: CreateBillPayload): Promise<BillResponse> {
    return apiClient.post<BillResponse>("/api/v1/billing/bills", data);
  },

  async settleBill(billId: string, data: SettleBillPayload): Promise<BillResponse> {
    return apiClient.post<BillResponse>(`/api/v1/billing/bills/${billId}/settle`, data);
  },
};
