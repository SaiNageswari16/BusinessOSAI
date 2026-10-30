/**
 * Production Service Client (Native Fetch).
 *
 * Microservice: production via API Gateway (:8000)
 * Mount: /api/v1/production
 *
 * Routes: /processes, /runs, /plans, /runs/{id}/raise-po, /runs/import-excel
 */

import { apiClient } from "../lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProductionLine {
  id?: string;
  raw_item_id?: string | null;
  raw_item_name?: string | null;
  qty: number;
  uom?: string | null;
  loss_pct?: number | null;
}

export interface ProductionProcess {
  id: string;
  outlet_id?: string | null;
  name: string;
  output_item?: string | null;
  output_item_name?: string | null;
  output_qty: number;
  output_uom?: string | null;
  is_active: boolean;
  created_at: string;
  lines: ProductionLine[];
}

export type RunStatus = "planned" | "started" | "completed" | "cancelled";
export type RunSource = "manual" | "excel" | "plan";

export interface ProductionRun {
  id: string;
  outlet_id?: string | null;
  process_id: string;
  status: RunStatus | string;
  planned_qty: number;
  output_qty_actual?: number | null;
  source: RunSource | string;
  notes?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface ProductionPlanLine {
  id: string;
  outlet_id?: string | null;
  process_id: string;
  target_date: string;
  planned_qty: number;
  status: string;
}

export interface ExcelImportRow {
  process_name: string;
  planned_qty: number;
  target_date?: string | null;
}

export interface ExcelImportResult {
  created: number;
  matched: number;
  skipped: string[];
  plan_line_ids: string[];
}

// ── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateProcessPayload {
  name: string;
  outlet_id?: string | null;
  output_item?: string | null;
  output_item_name?: string | null;
  output_qty?: number;
  output_uom?: string | null;
  is_active?: boolean;
  lines: {
    raw_item_id?: string | null;
    raw_item_name?: string | null;
    qty: number;
    uom?: string | null;
    loss_pct?: number | null;
  }[];
}

export type UpdateProcessPayload = Partial<CreateProcessPayload>;

export interface StartRunPayload {
  process_id: string;
  outlet_id?: string | null;
  planned_qty?: number;
  source?: RunSource | string;
  notes?: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const productionService = {
  // Process masters
  async getProcesses(outletId?: string): Promise<ProductionProcess[]> {
    return apiClient.get<ProductionProcess[]>("/api/v1/production/processes", {
      params: { outlet_id: outletId },
    });
  },

  async createProcess(data: CreateProcessPayload): Promise<ProductionProcess> {
    return apiClient.post<ProductionProcess>("/api/v1/production/processes", data);
  },

  async updateProcess(
    processId: string,
    data: UpdateProcessPayload
  ): Promise<ProductionProcess> {
    return apiClient.patch<ProductionProcess>(
      `/api/v1/production/processes/${processId}`,
      data
    );
  },

  async deleteProcess(processId: string): Promise<void> {
    await apiClient.delete(`/api/v1/production/processes/${processId}`);
  },

  // Runs
  async getRuns(params: {
    outletId?: string;
    statusFilter?: string;
  } = {}): Promise<ProductionRun[]> {
    return apiClient.get<ProductionRun[]>("/api/v1/production/runs", {
      params: {
        outlet_id: params.outletId,
        status_filter: params.statusFilter,
      },
    });
  },

  /** Start a run: PLANNED -> STARTED, or a fresh manual start. */
  async startRun(data: StartRunPayload): Promise<ProductionRun> {
    return apiClient.post<ProductionRun>("/api/v1/production/runs", data);
  },

  async completeRun(
    runId: string,
    data: { output_qty_actual: number; notes?: string | null }
  ): Promise<ProductionRun> {
    return apiClient.post<ProductionRun>(
      `/api/v1/production/runs/${runId}/complete`,
      data
    );
  },

  async cancelRun(runId: string): Promise<ProductionRun> {
    return apiClient.post<ProductionRun>(
      `/api/v1/production/runs/${runId}/cancel`,
      {}
    );
  },

  /** Create a direct PO against a run's raw-material lines. */
  async raisePo(runId: string): Promise<Record<string, unknown>> {
    return apiClient.post<Record<string, unknown>>(
      `/api/v1/production/runs/${runId}/raise-po`,
      {}
    );
  },

  // Plans
  async getPlans(params: {
    outletId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}): Promise<ProductionPlanLine[]> {
    return apiClient.get<ProductionPlanLine[]>("/api/v1/production/plans", {
      params: {
        outlet_id: params.outletId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        limit: params.limit,
      },
    });
  },

  /** Bulk plan creation from demand hints or spreadsheet rows. */
  async createPlans(lines: {
    process_id: string;
    outlet_id?: string | null;
    target_date: string;
    planned_qty: number;
  }[]): Promise<ProductionPlanLine[]> {
    return apiClient.post<ProductionPlanLine[]>("/api/v1/production/plans", {
      lines,
    });
  },

  /**
   * Excel/CSV import stand-in: post spreadsheet rows as plan lines.
   * Each row names a process + planned quantity (+ optional target date);
   * unmatched process names are skipped and reported.
   */
  async importExcel(data: {
    rows: ExcelImportRow[];
    outlet_id?: string | null;
  }): Promise<ExcelImportResult> {
    return apiClient.post<ExcelImportResult>(
      "/api/v1/production/runs/import-excel",
      data
    );
  },
};
