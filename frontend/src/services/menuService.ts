/**
 * Menu Service Client (Native Fetch).
 *
 * Microservice: menu (:8104) via API Gateway (:8000)
 * Mount: /api/v1/menu
 */

import { apiClient } from "../lib/api-client";

export interface MenuCategory {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  outlet_id?: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  outlet_id?: string;
  category_id?: string;
  name: string;
  code: string;
  description?: string;
  item_type: "dish" | "beverage" | "retail" | "service";
  base_price: number;
  tax_rate: number;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
  image_url?: string;
}

export interface MenuItemCreatePayload {
  name: string;
  code: string;
  base_price: number;
  tax_rate?: number;
  category_id?: string;
  outlet_id?: string;
  item_type?: MenuItem["item_type"];
  description?: string;
  is_available?: boolean;
}

export interface MenuItemUpdatePayload {
  name?: string;
  code?: string;
  base_price?: number;
  tax_rate?: number;
  category_id?: string;
  item_type?: MenuItem["item_type"];
  description?: string;
  is_available?: boolean;
  is_active?: boolean;
}

export interface RecipeLine {
  inventory_item_id: string;
  qty: number;
  uom_id?: string | null;
  wastage_pct: number;
  is_optional: boolean;
}

export interface Recipe {
  id: string;
  menu_item_id: string;
  variant_id: string | null;
  name: string;
  yield_qty: number;
  yield_uom_id: string | null;
  instructions?: string | null;
  is_active: boolean;
  lines: RecipeLine[];
}

export interface RecipeCreatePayload {
  name: string;
  variant_id?: string | null;
  yield_qty?: number;
  yield_uom_id?: string | null;
  instructions?: string | null;
  lines: Omit<RecipeLine, "id">[];
}

export interface RecipeCostLine {
  inventory_item_id: string;
  qty_per_portion: number;
  standard_cost: number | null;
  line_cost: number | null;
}

export interface RecipeCost {
  menu_item_id: string;
  name: string;
  selling_price: number;
  food_cost: number | null;
  margin: number | null;
  food_cost_pct: number | null;
  cost_known: boolean;
  lines: RecipeCostLine[];
}

// ── Recipe catalog (RAG-style search + scaled breakdown) ─────────────────────

export interface RecipeSearchResult {
  item_id: string;
  code: string;
  name: string;
  description: string | null;
  item_type: string;
  base_price: number;
  yield_qty: number;
  instructions: string | null;
  ingredient_count: number;
  score: number;
  match_reasons: string[];
}

export interface RecipeBreakdownLine {
  inventory_item_id: string;
  name: string;
  code: string;
  unit: string;
  qty_per_portion: number;
  wastage_pct: number;
  required_for_n: number;
  available_stock: number;
  is_sufficient: boolean;
  shortfall: number;
  standard_cost: number | null;
  line_cost: number | null;
}

export interface RecipeBreakdown {
  item_id: string;
  name: string;
  yield_qty: number;
  portions: number;
  total_cost: number | null;
  cost_known: boolean;
  lines: RecipeBreakdownLine[];
  shortage_lines: RecipeBreakdownLine[];
}

// ── AI recipe search (global + LLM + multimodal + reconcile + reorder) ─────

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
  /** "catalog" = pulled from the recipe catalog; "llm" = hallucinated global recipe. */
  source: "catalog" | "llm" | string;
  ingredients: AiRecipeIngredient[];
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

export const menuService = {
  // Categories
  async getCategories(outletId?: string): Promise<MenuCategory[]> {
    return apiClient.get<MenuCategory[]>("/api/v1/menu/categories", {
      params: { outlet_id: outletId },
    });
  },

  async createCategory(data: { name: string; slug: string; description?: string; outlet_id?: string }): Promise<MenuCategory> {
    return apiClient.post<MenuCategory>("/api/v1/menu/categories", data);
  },

  async deleteCategory(categoryId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/menu/categories/${categoryId}`);
  },

  // Items
  async getItems(options: {
    outletId?: string;
    categoryId?: string;
    availableOnly?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<MenuItem[]> {
    return apiClient.get<MenuItem[]>("/api/v1/menu/items", {
      params: {
        outlet_id: options.outletId,
        category_id: options.categoryId,
        available_only: options.availableOnly,
        search: options.search,
        limit: options.limit || 100,
        offset: options.offset || 0,
      },
    });
  },

  async getItem(itemId: string): Promise<MenuItem> {
    return apiClient.get<MenuItem>(`/api/v1/menu/items/${itemId}`);
  },

  async createItem(data: MenuItemCreatePayload): Promise<MenuItem> {
    return apiClient.post<MenuItem>("/api/v1/menu/items", data);
  },

  async updateItem(itemId: string, data: MenuItemUpdatePayload): Promise<MenuItem> {
    return apiClient.put<MenuItem>(`/api/v1/menu/items/${itemId}`, data);
  },

  async deleteItem(itemId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/menu/items/${itemId}`);
  },

  async toggleAvailability(itemId: string, isAvailable: boolean): Promise<MenuItem> {
    return apiClient.put<MenuItem>(`/api/v1/menu/items/${itemId}`, { is_available: isAvailable });
  },

  // ── Recipes / BOM ─────────────────────────────────────────────────────────

  async getActiveRecipe(itemId: string, variantId?: string): Promise<Recipe> {
    const qs = variantId ? `?variant_id=${variantId}` : "";
    return apiClient.get<Recipe>(`/api/v1/menu/items/${itemId}/recipe${qs}`);
  },

  async getRecipeLines(itemId: string): Promise<{
    menu_item_id: string;
    recipe_id?: string;
    yield_qty: number;
    lines: { inventory_item_id: string; qty_per_portion: number; wastage_pct: number }[];
  }> {
    return apiClient.get(`/api/v1/menu/items/${itemId}/recipe-lines`);
  },

  async getRecipeCost(itemId: string): Promise<RecipeCost> {
    return apiClient.get<RecipeCost>(`/api/v1/menu/items/${itemId}/cost`);
  },

  async listRecipes(itemId: string): Promise<Recipe[]> {
    return apiClient.get<Recipe[]>(`/api/v1/menu/items/${itemId}/recipes`);
  },

  async createRecipe(itemId: string, payload: RecipeCreatePayload): Promise<Recipe> {
    return apiClient.post<Recipe>(`/api/v1/menu/items/${itemId}/recipes`, payload);
  },

  async replaceRecipeLines(recipeId: string, lines: Omit<RecipeLine, "id">[]): Promise<Recipe> {
    return apiClient.put<Recipe>(`/api/v1/menu/recipes/${recipeId}/lines`, lines);
  },

  async deleteRecipe(recipeId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/menu/recipes/${recipeId}`);
  },

  // ── Recipe catalog (RAG retrieval + scaled breakdown) ─────────────────────
  //
  // searchRecipes is the retrieval step: given the chef's words it returns the
  // catalog recipes that best match, ranked. getRecipeBreakdown returns the
  // ingredient BOM scaled to N portions; the frontend joins it against
  // inventoryService.getItems() to fill in live stock, name and cost.

  async searchRecipes(q: string, limit = 20): Promise<RecipeSearchResult[]> {
    return apiClient.get<RecipeSearchResult[]>("/api/v1/menu/items/search", {
      params: { q, limit },
    });
  },

  async getRecipeBreakdown(itemId: string, portions = 1): Promise<RecipeBreakdown> {
    return apiClient.get<RecipeBreakdown>(
      `/api/v1/menu/items/${itemId}/recipe-breakdown`,
      { params: { portions } },
    );
  },

  // ── AI recipe search (global + LLM + reconcile + restock) ────────────────

  /** Global AI recipe search — text and/or an image (base64) for multimodal
   *  "identify this dish". May return an `error` banner (e.g. no LLM key
   *  configured) alongside partial catalog results. */
  async aiRecipeSearch(
    p: AiRecipeSearchParams,
  ): Promise<AiRecipeSearchResponse> {
    return apiClient.post<AiRecipeSearchResponse>(
      "/api/v1/menu/ai/recipe-search",
      p,
    );
  },

  /** Reconcile a recipe's ingredient BOM against CURRENT live inventory,
   *  scaled to `portions`. */
  async aiRecipeReconcile(p: {
    recipe_id: string;
    portions: number;
  }): Promise<AiReconcileResult> {
    return apiClient.post<AiReconcileResult>(
      "/api/v1/menu/ai/recipe-reconcile",
      p,
    );
  },

  /** Create purchase orders for missing/low ingredient lines. */
  async aiRecipeReorder(p: {
    lines: AiReorderLine[];
    outlet_id: string | null;
  }): Promise<AiReorderResponse> {
    return apiClient.post<AiReorderResponse>("/api/v1/menu/ai/recipe-reorder", p);
  },
};
