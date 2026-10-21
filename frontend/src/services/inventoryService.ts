/**
 * Inventory Service Client (Native Fetch).
 *
 * Microservice: inventory (:8106) via API Gateway (:8000)
 * Mount: /api/v1/inventory
 *
 * Provides complete support for:
 * - Enterprise Global Master Inventory (Central Hub)
 * - Module Sub-Inventories (Restaurant Kitchen Store, Bar Store, etc.)
 * - Internal Stock Transfers / Replenishment
 * - Real-time Stock Movement Ledgers & Par Monitoring
 */

import { apiClient } from "../lib/api-client";

export interface StorageLocation {
  id: string;
  outlet_id: string;
  name: string;
  location_type: string;
  module: string;
  is_central: boolean;
  parent_location_id?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ModuleStockBreakdown {
  location_id: string;
  location_name: string;
  module: string;
  location_type: string;
  is_central: boolean;
  qty_on_hand: number;
  qty_available: number;
}

export interface GlobalItemRollup {
  id: string;
  outlet_id?: string | null;
  name: string;
  code: string;
  sku?: string | null;
  item_type: string;
  standard_cost: number;
  reorder_level: number;
  is_active: boolean;
  total_global_on_hand: number;
  total_global_available: number;
  central_warehouse_on_hand: number;
  module_stocks: ModuleStockBreakdown[];
  stock_status: "OK" | "Low" | "Critical";
}

export interface GlobalInventoryOverview {
  total_items: number;
  total_value: number;
  central_warehouse_value: number;
  module_values: Record<string, number>;
  low_stock_count: number;
  critical_stock_count: number;
  items: GlobalItemRollup[];
}

export interface StockTransferPayload {
  outlet_id: string;
  inventory_item_id: string;
  source_location_id: string;
  destination_location_id: string;
  qty: number;
  notes?: string;
}

export interface StockTransferResult {
  item_id: string;
  item_name: string;
  source_location_id: string;
  source_location_name: string;
  destination_location_id: string;
  destination_location_name: string;
  qty: number;
  source_movement_id: string;
  destination_movement_id: string;
  transferred_at: string;
}

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  outlet_id: string;
  location_id?: string | null;
  movement_type:
    | "purchase"
    | "consumption"
    | "wastage"
    | "transfer_in"
    | "transfer_out"
    | "adjustment"
    | "opening";
  qty: number;
  unit_cost: number;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface CreateItemPayload {
  name: string;
  code: string;
  sku?: string;
  description?: string;
  item_type?: "ingredient" | "semi_finished" | "packaging" | "finished";
  standard_cost?: number;
  reorder_level?: number;
  reorder_qty?: number;
  allow_negative_stock?: boolean;
  outlet_id?: string;
}

export interface StockConsumptionPayload {
  outlet_id: string;
  inventory_item_id: string;
  location_id?: string;
  module?: string;
  qty: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
}

export const inventoryService = {
  /**
   * Get enterprise multi-tier global overview (Central + Module breakdown)
   */
  async getGlobalRollup(outletId?: string): Promise<GlobalInventoryOverview> {
    return apiClient.get<GlobalInventoryOverview>("/api/v1/inventory/global-rollup", {
      params: outletId ? { outlet_id: outletId } : undefined,
    });
  },

  /**
   * Get all storage locations (optionally filtered by module e.g. "restaurant", "central", "bar")
   */
  async getLocations(params?: { outlet_id?: string; module?: string }): Promise<StorageLocation[]> {
    return apiClient.get<StorageLocation[]>("/api/v1/inventory/locations", {
      params,
    });
  },

  /**
   * Ensure default Central Warehouse and Restaurant/Bar store locations exist
   */
  async bootstrapLocations(outletId: string): Promise<StorageLocation[]> {
    return apiClient.post<StorageLocation[]>("/api/v1/inventory/locations/bootstrap", null, {
      params: { outlet_id: outletId },
    });
  },

  /**
   * Transfer stock between Central Warehouse and a Module Sub-Inventory
   */
  async transferStock(payload: StockTransferPayload): Promise<StockTransferResult> {
    return apiClient.post<StockTransferResult>("/api/v1/inventory/transfers", payload);
  },

  /**
   * Consume stock directly from a module sub-inventory (e.g., Restaurant Kitchen)
   */
  async consumeStock(payload: StockConsumptionPayload): Promise<StockMovement> {
    return apiClient.post<StockMovement>("/api/v1/inventory/consume", payload);
  },

  /**
   * Fetch items with per-location stock
   */
  async getItems(outletId?: string): Promise<any[]> {
    return apiClient.get<any[]>("/api/v1/inventory/items", {
      params: outletId ? { outlet_id: outletId } : undefined,
    });
  },

  /**
   * Create master inventory item
   */
  async createItem(payload: CreateItemPayload): Promise<any> {
    return apiClient.post<any>("/api/v1/inventory/items", payload);
  },

  /**
   * Set opening stock on an item at a specific location
   */
  async setOpeningStock(
    itemId: string,
    outletId: string,
    payload: { qty: number; unit_cost?: number; location_id?: string }
  ): Promise<StockMovement> {
    return apiClient.post<StockMovement>(
      `/api/v1/inventory/items/${itemId}/opening-stock`,
      payload,
      { params: { outlet_id: outletId } }
    );
  },

  /**
   * Adjust stock count for an item
   */
  async adjustStock(payload: {
    item_id: string;
    outlet_id?: string;
    counted_qty?: number;
    qty_counted?: number;
    qty_delta?: number;
    location_id?: string;
    reason?: string;
  }): Promise<any> {
    return apiClient.post<any>("/api/v1/inventory/adjustments", payload);
  },

  /**
   * Log shrinkage / wastage
   */
  async recordWastage(
    itemId: string,
    outletId: string,
    payload: { qty: number; reason?: string; notes?: string }
  ): Promise<any> {
    return apiClient.post<any>(`/api/v1/inventory/items/${itemId}/wastage`, payload, {
      params: { outlet_id: outletId },
    });
  },

  /**
   * Get append-only stock movement audit ledger
   */
  async getMovements(params?: {
    item_id?: string;
    movement_type?: string;
    limit?: number;
  }): Promise<StockMovement[]> {
    return apiClient.get<StockMovement[]>("/api/v1/inventory/movements", {
      params,
    });
  },
};
