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
};
