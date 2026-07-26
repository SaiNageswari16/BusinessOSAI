// The base URL connects straight to the inventory public endpoints
const API_BASE_URL = 'http://localhost:8000/api/v1/inventory/public';

// Types corresponding to POSProductResponse and POSCategoryResponse from backend
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
  image_url?: string;
  mrp: number;
  selling_price: number;
  stock: number;
  images?: StorefrontProductImage[];
  variants?: StorefrontProductVariant[];
}

export const fetchStorefrontCategories = async (): Promise<StorefrontCategory[]> => {
  const response = await fetch(`${API_BASE_URL}/categories`);
  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }
  const data = await response.json();
  return data.items || [];
};

export const fetchStorefrontProducts = async (categoryId?: string, search?: string): Promise<StorefrontProduct[]> => {
  const url = new URL(`${API_BASE_URL}/products`);
  if (categoryId) url.searchParams.append("category_id", categoryId);
  if (search) url.searchParams.append("search", search);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }
  const data = await response.json();
  return data.items || [];
};
