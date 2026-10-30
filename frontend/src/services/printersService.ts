/**
 * Printers & Devices Service Client (Native Fetch).
 *
 * Microservice: printers via API Gateway (:8000)
 * Mount: /api/v1/printers
 *
 * Routes: /printers, /printers/{id}/test, /printers/{id}/heartbeat,
 *         /devices, /devices/{code}/bind, /devices/{code}/revoke,
 *         /devices/{code}/heartbeat, /print-jobs, /print-jobs/{id}/retry,
 *         /receipt-preview
 */

import { apiClient } from "../lib/api-client";

// ── Enums (mirrors of the backend string enums) ────────────────────────────

export type PrinterType = "THERMAL" | "LASER" | "NETWORK" | string;
export type PrinterDestination = "RECEIPT" | "KDS" | "CHEF" | "BAR" | string;
export type PrinterHealth = "HEALTHY" | "UNREACHABLE" | "UNKNOWN";
export type DeviceKind = "POS" | "KDS" | "TABLET" | string;
export type DeviceStatus = "PENDING" | "BOUND" | "REVOKED";
export type PrintJobSource = "KOT" | "BILL" | "ORDER" | "TEST" | string;
export type PrintJobStatus = "QUEUED" | "SENT" | "ACKED" | "FAILED" | "EXPIRED";

// ── Printers ─────────────────────────────────────────────────────────────────

export interface Printer {
  id: string;
  outlet_id?: string | null;
  name: string;
  printer_type: PrinterType;
  host: string;
  port: number;
  paper_width_mm?: number | null;
  model?: string | null;
  default_destination?: PrinterDestination | null;
  active: boolean;
  last_seen_at?: string | null;
  health: PrinterHealth | string;
  notes?: string | null;
  created_at: string;
}

export interface CreatePrinterPayload {
  name: string;
  outlet_id?: string | null;
  printer_type?: PrinterType;
  host?: string;
  port?: number;
  paper_width_mm?: number | null;
  model?: string | null;
  default_destination?: PrinterDestination | null;
  notes?: string | null;
}

export type UpdatePrinterPayload = Partial<CreatePrinterPayload> & {
  active?: boolean;
  health?: PrinterHealth;
};

// ── Devices ──────────────────────────────────────────────────────────────────

export interface PrinterDevice {
  id: string;
  outlet_id?: string | null;
  device_code: string;
  device_kind: DeviceKind;
  bound_printer_id?: string | null;
  status: DeviceStatus | string;
  registered_at: string;
  last_heartbeat_at?: string | null;
  created_at: string;
}

export interface RegisterDevicePayload {
  device_code: string;
  outlet_id?: string | null;
  device_kind?: DeviceKind;
}

// ── Print jobs ───────────────────────────────────────────────────────────────

export interface PrintJob {
  id: string;
  outlet_id?: string | null;
  printer_id?: string | null;
  source_type: PrintJobSource;
  source_ref: string;
  destination: PrinterDestination;
  status: PrintJobStatus | string;
  requested_at: string;
  sent_at?: string | null;
  acked_at?: string | null;
  retry: number;
  last_error?: string | null;
}

// ── Receipt preview (pure renderer contract) ────────────────────────────────

export interface ReceiptPreview {
  source_type: string;
  source_ref: string;
  destination?: string | null;
  order_number?: string | null;
  kot_number?: string | null;
  items: {
    name?: string;
    variant_name?: string;
    qty?: number;
    amount?: number | string | null;
    unit_price?: number | string | null;
    notes?: string;
    modifiers?: unknown[];
    [k: string]: unknown;
  }[];
  notes?: string | null;
  lines: { label?: string; value?: string | number; [k: string]: unknown }[];
  totals: {
    subtotal?: number | null;
    tax_total?: number | null;
    grand_total?: number | null;
    paid_amount?: number | null;
  };
  paper_width_mm: number;
  requested_at?: string | null;
  sent_at?: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const printersService = {
  // Printers
  async getPrinters(outletId?: string): Promise<Printer[]> {
    return apiClient.get<Printer[]>("/api/v1/printers/printers", {
      params: { outlet_id: outletId },
    });
  },

  async createPrinter(data: CreatePrinterPayload): Promise<Printer> {
    return apiClient.post<Printer>("/api/v1/printers/printers", data);
  },

  async updatePrinter(
    printerId: string,
    data: UpdatePrinterPayload
  ): Promise<Printer> {
    return apiClient.patch<Printer>(
      `/api/v1/printers/printers/${printerId}`,
      data
    );
  },

  async deletePrinter(printerId: string): Promise<void> {
    await apiClient.delete(`/api/v1/printers/printers/${printerId}`);
  },

  /** Fire a test job at the printer hardware. */
  async testPrint(printerId: string): Promise<PrintJob> {
    return apiClient.post<PrintJob>(
      `/api/v1/printers/printers/${printerId}/test`,
      {}
    );
  },

  /** Report the printer is reachable — refreshes last_seen / health. */
  async printerHeartbeat(printerId: string): Promise<Printer> {
    return apiClient.post<Printer>(
      `/api/v1/printers/printers/${printerId}/heartbeat`,
      {}
    );
  },

  // Devices
  async getDevices(outletId?: string): Promise<PrinterDevice[]> {
    return apiClient.get<PrinterDevice[]>("/api/v1/printers/devices", {
      params: { outlet_id: outletId },
    });
  },

  async registerDevice(data: RegisterDevicePayload): Promise<PrinterDevice> {
    return apiClient.post<PrinterDevice>("/api/v1/printers/devices", data);
  },

  /** Pair a device (by code) to a printer destination. */
  async bindDevice(
    code: string,
    data: { printer_id?: string | null }
  ): Promise<PrinterDevice> {
    return apiClient.post<PrinterDevice>(
      `/api/v1/printers/devices/${code}/bind`,
      data
    );
  },

  async revokeDevice(code: string): Promise<PrinterDevice> {
    return apiClient.post<PrinterDevice>(
      `/api/v1/printers/devices/${code}/revoke`,
      {}
    );
  },

  async deviceHeartbeat(code: string): Promise<PrinterDevice> {
    return apiClient.post<PrinterDevice>(
      `/api/v1/printers/devices/${code}/heartbeat`,
      {}
    );
  },

  // Print jobs
  async getJobs(params: {
    printerId?: string;
    status?: string;
    sourceType?: string;
    limit?: number;
  } = {}): Promise<PrintJob[]> {
    return apiClient.get<PrintJob[]>("/api/v1/printers/print-jobs", {
      params: {
        printer_id: params.printerId,
        status: params.status,
        source_type: params.sourceType,
        limit: params.limit || 100,
      },
    });
  },

  async getJob(jobId: string): Promise<PrintJob> {
    return apiClient.get<PrintJob>(`/api/v1/printers/print-jobs/${jobId}`);
  },

  /** Re-queue a failed job (bounded by the retry budget). */
  async retryJob(jobId: string): Promise<{ job_id: string; status: string; retry: number }> {
    return apiClient.post<{ job_id: string; status: string; retry: number }>(
      `/api/v1/printers/print-jobs/${jobId}/retry`,
      {}
    );
  },

  // Receipt preview
  async getReceiptPreview(
    sourceType: string,
    sourceRef: string
  ): Promise<ReceiptPreview> {
    return apiClient.get<ReceiptPreview>("/api/v1/printers/receipt-preview", {
      params: {
        source_type: sourceType,
        source_ref: sourceRef,
      },
    });
  },
};
