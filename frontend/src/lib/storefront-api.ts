import { useCurrency } from "@/hooks/use-currency";

/**
 * Storefront API — connects to the public inventory endpoints that expose
 * products from ALL tenants (Amazon-style marketplace).
 *
 * The base URL is read from VITE_API_BASE_URL (set in frontend/.env).
 * No auth token is needed — these are public endpoints.
 */
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api/v1'}/inventory/public`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StorefrontCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active: boolean;
}

export interface StorefrontProductImage {
  id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

export interface StorefrontProductVariant {
  id: string;
  variant_name: string;
  sku: string;
  additional_price: number;
  stock_override: number | null;
  attributes: Record<string, string>;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  sku: string;
  category_name?: string;
  brand?: string;
  short_description?: string;
  specifications?: any;
  image_url?: string;
  mrp: number;
  selling_price: number;
  stock: number;
  /** The business / tenant name that sells this product (shown as "Sold by: …") */
  seller_name?: string;
  tenant_id?: string;
  images?: StorefrontProductImage[];
  variants?: StorefrontProductVariant[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch all active product categories from the marketplace
 * (aggregated across ALL tenant inventories by default).
 */
export const fetchStorefrontCategories = async (): Promise<StorefrontCategory[]> => {
  const response = await fetch(`${API_BASE_URL}/categories`);
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }
  const data = await response.json();
  return data.items || [];
};

/**
 * Fetch products from the marketplace (all tenants by default).
 * Pass categoryId to filter by category, or search for a keyword.
 * Pass tenantId to restrict to a single seller / tenant.
 */
export const fetchStorefrontProducts = async (
  categoryId?: string,
  search?: string,
  tenantId?: string,
  page = 1,
  pageSize = 50,
): Promise<{ items: StorefrontProduct[]; total: number; page: number; page_size: number }> => {
  const url = new URL(`${API_BASE_URL}/products`);
  if (categoryId) url.searchParams.append('category_id', categoryId);
  if (search) url.searchParams.append('search', search);
  url.searchParams.append('page', String(page));
  url.searchParams.append('page_size', String(pageSize));

  const headers: HeadersInit = {};
  if (tenantId) headers['X-Tenant-Id'] = tenantId;

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }
  return response.json();
};

export const fetchStorefrontNotifications = async (): Promise<any[]> => {
  return [
    { id: 1, title: 'Welcome to LazyMonkeyAI', body: 'Explore our new smart features!', is_read: false, action_url: '/store' }
  ];
};

export const markStorefrontNotificationsRead = async (): Promise<{ success: boolean }> => {
  return { success: true };
};

export const fetchStorefrontUserContext = async (): Promise<any> => {
  const response = await fetch(`${API_BASE_URL.replace('/inventory', '/storefront')}/user-context`);
  if (!response.ok) throw new Error('Failed to fetch user context');
  return response.json();
};

export const fetchWalletTransactions = async (): Promise<any[]> => {
  const response = await fetch(`${API_BASE_URL.replace('/inventory', '/storefront')}/wallet/transactions`);
  if (!response.ok) throw new Error('Failed to fetch wallet transactions');
  return response.json();
};

export const topUpWallet = async (amount: number): Promise<any> => {
  const response = await fetch(`${API_BASE_URL.replace('/inventory', '/storefront')}/wallet/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  });
  if (!response.ok) throw new Error('Failed to top up wallet');
  return response.json();
};

export const fetchWishlist = async (): Promise<any[]> => {
  const response = await fetch(`${API_BASE_URL}/storefront/public/wishlist`);
  if (!response.ok) throw new Error('Failed to fetch wishlist');
  return response.json();
};

export const addToWishlist = async (productId: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/storefront/public/wishlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId })
  });
  if (!response.ok) throw new Error('Failed to add to wishlist');
  return response.json();
};

export const removeFromWishlist = async (productId: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/storefront/public/wishlist/${productId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to remove from wishlist');
  return response.json();
};
