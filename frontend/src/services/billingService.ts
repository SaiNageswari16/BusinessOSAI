/**
 * Billing & Invoicing Microservice Client (Native Fetch).
 *
 * Microservice: billing (:8105) via API Gateway (:8000)
 * Mount: /api/v1/billing
 */

import { apiClient } from "../lib/api-client";
import { getAccessToken, getActiveOutlet, getActiveTenant } from "../lib/auth-tokens";

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

export interface PrintTemplateRecord {
  id: string;
  template_id?: string;
  tenant_id?: string;
  outlet_id?: string | null;
  category: string;
  name: string;
  paper_size?: string;
  paperSize?: string;
  active?: boolean;
  fields?: Record<string, any>;
  [key: string]: any;
}

const API_BASE_URL =
  ((import.meta as any).env?.["VITE_API_BASE_URL"] as string) ??
  "http://127.0.0.1:8000/api/v1";

function getGatewayOrigin(): string {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, "");
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

  // ── Per-Organization Thermal Receipt Print Templates ───────────────────────

  async listPrintTemplates(params?: {
    outlet_id?: string;
    category?: string;
  }): Promise<{ templates: PrintTemplateRecord[]; active_map: Record<string, string>; tenant_id: string }> {
    return apiClient.get<{ templates: PrintTemplateRecord[]; active_map: Record<string, string>; tenant_id: string }>(
      "/api/v1/billing/print-templates",
      { params }
    );
  },

  async savePrintTemplate(payload: {
    outlet_id?: string | null;
    category?: string;
    name: string;
    template: Record<string, any>;
    set_as_default?: boolean;
  }): Promise<{ success: boolean; template: PrintTemplateRecord; active?: string | null }> {
    return apiClient.post<{ success: boolean; template: PrintTemplateRecord; active?: string | null }>(
      "/api/v1/billing/print-templates",
      payload
    );
  },

  async deletePrintTemplate(templateId: string, category?: string): Promise<{ success: boolean; deleted: boolean }> {
    return apiClient.delete<{ success: boolean; deleted: boolean }>(
      `/api/v1/billing/print-templates/${templateId}`,
      { params: category ? { category } : undefined }
    );
  },

  async getActivePrintTemplate(params?: {
    category?: string;
    outlet_id?: string;
  }): Promise<PrintTemplateRecord> {
    return apiClient.get<PrintTemplateRecord>("/api/v1/billing/print-template/active", {
      params: { category: params?.category ?? "thermal", outlet_id: params?.outlet_id },
    });
  },

  async setActivePrintTemplate(payload: {
    template_id: string;
    category?: string;
  }): Promise<{ success: boolean; active: string }> {
    return apiClient.post<{ success: boolean; active: string }>(
      "/api/v1/billing/print-template/active",
      { template_id: payload.template_id, category: payload.category ?? "thermal" }
    );
  },

  async printThermalReceiptBlob(
    billId: string,
    options?: { escpos?: boolean; size?: "80mm" | "58mm"; template_id?: string }
  ): Promise<Blob> {
    const qs = new URLSearchParams();
    if (options?.escpos) qs.set("escpos", "true");
    if (options?.size) qs.set("size", options.size);
    if (options?.template_id) qs.set("template_id", options.template_id);
    const token = getAccessToken();
    const tenantId = getActiveTenant();
    const outletId = getActiveOutlet();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (tenantId) headers["X-Tenant-Id"] = tenantId;
    if (outletId) headers["X-Outlet-Id"] = outletId;

    const url = `${getGatewayOrigin()}/api/v1/billing/receipts/${encodeURIComponent(billId)}/print?${qs.toString()}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      throw new Error(`Receipt print failed with status ${res.status}`);
    }
    return res.blob();
  },
};
