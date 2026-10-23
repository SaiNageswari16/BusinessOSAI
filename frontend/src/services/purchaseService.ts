/**
 * AI Purchase / Recipe Service Client (Native Fetch).
 *
 * Microservice: menu (:8104) via API Gateway (:8000)
 * Mount: /api/v1/menu
 *
 * AI recipe flow (canonical — matches /api/v1/menu/ai/recipe-* endpoints):
 *  - aiRecipeSearch:    POST /api/v1/menu/ai/recipe-search    (global LLM + catalog + multimodal)
 *  - aiRecipeReconcile: POST /api/v1/menu/ai/recipe-reconcile (BOM vs live inventory)
 *  - aiRecipeReorder:   POST /api/v1/menu/ai/recipe-reorder   (draft PO for missing/low lines)
 *
 * These methods re-expose the same client methods as menuService (identical
 * http wrapper + type style) for consumers that prefer the "purchase"
 * naming. Use menuService if both are available in the same module scope.
 */

import { apiClient } from "../lib/api-client";

// ── Shared types (mirror of the /api/v1/menu/ai/* contract) ─────────────────

export type AiRecipeSource = "catalog" | "llm" | (string & {});

export interface AiRecipeIngredient {
  name: string;
  inventory_code: string | null;
  inventory_item_id: string | null;
  qty_per_portion: number;
  unit: string;
  wastage_pct: number;
}

export interface AiRecipeResult {
  recipe_id: string;
  name: string;
  description: string | null;
  item_type: string;
  base_price: number | null;
  yield_qty: number;
  confidence: number;
  source: AiRecipeSource;
  ingredients: AiRecipeIngredient[];
}

export interface AiRecipeSearchParams {
  query: string;
  image_b64: string | null;
  portions: number;
  limit: number;
  provider?: "auto";
}

export interface AiRecipeSearchResponse {
  results: AiRecipeResult[];
  provider_used: "gemini" | "claude" | "openai" | "none" | string | null;
  error: string | null;
}

export interface AiReconcileLine {
  name: string;
  inventory_item_id: string | null;
  required_for_n: number;
  available_stock: number;
  reorder_level: number;
  standard_cost: number | null;
  status: "in_stock" | "low" | "missing";
  shortfall: number;
}

export interface AiReconcileResult {
  name: string;
  portions: number;
  lines: AiReconcileLine[];
  total_cost: number | null;
}

export interface AiReorderLine {
  inventory_item_id: string;
  suggested_qty: number;
  name: string;
}

export interface AiReorderResponse {
  po_ids: string[];
  created: number;
  skipped: { inventory_item_id: string; reason: string }[];
  note: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

export const purchaseService = {
  /** Global AI recipe search — text and/or an image (base64) for multimodal
   *  "identify this dish". May return an `error` banner (e.g. no LLM key
   *  configured) alongside partial catalog results. */
  aiRecipeSearch(
    p: AiRecipeSearchParams,
  ): Promise<AiRecipeSearchResponse> {
    return apiClient.post<AiRecipeSearchResponse>(
      "/api/v1/menu/ai/recipe-search",
      p,
    );
  },

  /** Reconcile a recipe's ingredient BOM against CURRENT live inventory,
   *  scaled to `portions`. */
  aiRecipeReconcile(p: {
    recipe_id: string;
    portions: number;
  }): Promise<AiReconcileResult> {
    return apiClient.post<AiReconcileResult>(
      "/api/v1/menu/ai/recipe-reconcile",
      p,
    );
  },

  /** Create purchase orders for missing/low ingredient lines. */
  aiRecipeReorder(p: {
    lines: AiReorderLine[];
    outlet_id: string | null;
  }): Promise<AiReorderResponse> {
    return apiClient.post<AiReorderResponse>(
      "/api/v1/menu/ai/recipe-reorder",
      p,
    );
  },
};
