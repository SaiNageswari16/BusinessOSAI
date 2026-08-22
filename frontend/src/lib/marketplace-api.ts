/**
 * LazyMonkeyAI — Centralized Marketplace API Client
 * Dynamically connects frontend Marketplace components to FastAPI backend endpoints (/api/v1/marketplace).
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://127.0.0.1:8000/api/v1";

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || `HTTP Error ${response.status}`);
  }

  return response.json();
}

export const marketplaceApi = {
  // --- VENDORS ---
  getVendorStats: () => fetchApi<any>("/marketplace/vendors/stats"),
  getVendors: (params?: { search?: string; status?: string; category?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<any>(`/marketplace/vendors${query ? `?${query}` : ""}`);
  },
  createVendor: (payload: any) => fetchApi<any>("/marketplace/vendors", { method: "POST", body: JSON.stringify(payload) }),
  updateVendorStatus: (vendorId: string, status: string) => fetchApi<any>(`/marketplace/vendors/${vendorId}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  getVendorCategories: () => fetchApi<any>("/marketplace/vendors/categories"),
  createVendorCategory: (payload: { name: string; code: string; description?: string }) => fetchApi<any>("/marketplace/vendors/categories", { method: "POST", body: JSON.stringify(payload) }),
  getVendorContracts: () => fetchApi<any>("/marketplace/vendors/contracts"),
  createVendorContract: (payload: any) => fetchApi<any>("/marketplace/vendors/contracts", { method: "POST", body: JSON.stringify(payload) }),
  getVendorPayouts: () => fetchApi<any>("/marketplace/vendors/payouts"),
  requestVendorPayout: (payload: any) => fetchApi<any>("/marketplace/vendors/payouts", { method: "POST", body: JSON.stringify(payload) }),
  getVendorRatings: () => fetchApi<any>("/marketplace/vendors/ratings"),
  getVendorPerformance: () => fetchApi<any>("/marketplace/vendors/performance"),
  getVendorKyc: () => fetchApi<any>("/marketplace/vendors/kyc"),
  updateVendorKycStatus: (vendorId: string, kycStatus: string) => fetchApi<any>(`/marketplace/vendors/kyc/${vendorId}`, { method: "PUT", body: JSON.stringify({ kyc_status: kycStatus }) }),
  verifyTaxId: (taxId: string) => fetchApi<any>("/marketplace/vendors/verify-tax", { method: "POST", body: JSON.stringify({ tax_id: taxId }) }),

  // --- PRODUCTS ---
  getProducts: (params?: { search?: string; status?: string; category?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<any>(`/marketplace/products${query ? `?${query}` : ""}`);
  },
  createProduct: (payload: any) => fetchApi<any>("/marketplace/products", { method: "POST", body: JSON.stringify(payload) }),
  getProductCategories: () => fetchApi<any>("/marketplace/products/categories"),
  getServices: () => fetchApi<any>("/marketplace/products/services"),
  getProductApprovals: () => fetchApi<any>("/marketplace/products/approvals"),
  approveRejectProduct: (productId: string, action: "approve" | "reject") => fetchApi<any>(`/marketplace/products/approvals/${productId}?action=${action}`, { method: "PUT" }),
  getPricingRules: () => fetchApi<any>("/marketplace/products/pricing-rules"),
  getBundles: () => fetchApi<any>("/marketplace/products/bundles"),
  getFeaturedProducts: () => fetchApi<any>("/marketplace/products/featured"),

  // --- ORDERS ---
  getOrders: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<any>(`/marketplace/orders${query ? `?${query}` : ""}`);
  },
  updateOrderStatus: (orderId: string, status: string) => fetchApi<any>(`/marketplace/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  getReturns: () => fetchApi<any>("/marketplace/orders/returns"),
  createReturn: (payload: any) => fetchApi<any>("/marketplace/orders/returns", { method: "POST", body: JSON.stringify(payload) }),
  getRefunds: () => fetchApi<any>("/marketplace/orders/refunds"),
  processRefund: (payload: any) => fetchApi<any>("/marketplace/orders/refunds", { method: "POST", body: JSON.stringify(payload) }),
  getCancellations: () => fetchApi<any>("/marketplace/orders/cancellations"),
  getOrderTimeline: (orderId: string) => fetchApi<any>(`/marketplace/orders/timeline/${orderId}`),
  getOrderInvoice: (orderId: string) => fetchApi<any>(`/marketplace/orders/invoices/${orderId}`),
  getOrderTracking: (orderId: string) => fetchApi<any>(`/marketplace/orders/tracking/${orderId}`),

  // --- DELIVERY ---
  getDeliveryPartners: () => fetchApi<any>("/marketplace/delivery/partners"),
  getDeliveryDrivers: () => fetchApi<any>("/marketplace/delivery/drivers"),
  getDispatchQueue: () => fetchApi<any>("/marketplace/delivery/assignment"),
  assignDriver: (payload: { dispatchId: string; driverName: string }) => fetchApi<any>("/marketplace/delivery/assignment", { method: "POST", body: JSON.stringify(payload) }),
  getLiveTracking: () => fetchApi<any>("/marketplace/delivery/tracking"),
  getHyperlocalZones: () => fetchApi<any>("/marketplace/delivery/hyperlocal"),
  getShippingRules: () => fetchApi<any>("/marketplace/delivery/shipping-rules"),
  getRoutePlanning: () => fetchApi<any>("/marketplace/delivery/route-planning"),

  // --- PROMOTIONS ---
  getCoupons: () => fetchApi<any>("/marketplace/promotions/coupons"),
  createCoupon: (payload: any) => fetchApi<any>("/marketplace/promotions/coupons", { method: "POST", body: JSON.stringify(payload) }),
  getOffers: () => fetchApi<any>("/marketplace/promotions/offers"),
  getCampaigns: () => fetchApi<any>("/marketplace/promotions/campaigns"),
  getFlashSales: () => fetchApi<any>("/marketplace/promotions/flash-sales"),
  getWalletRules: () => fetchApi<any>("/marketplace/promotions/wallet"),
  getLoyaltyTiers: () => fetchApi<any>("/marketplace/promotions/loyalty"),
  getGiftCardBatches: () => fetchApi<any>("/marketplace/promotions/gift-cards"),

  // --- INTELLIGENCE ---
  getDemandForecast: () => fetchApi<any>("/marketplace/intelligence/demand-forecast"),
  getDynamicPricing: () => fetchApi<any>("/marketplace/intelligence/dynamic-pricing"),
  getVendorAnalytics: () => fetchApi<any>("/marketplace/intelligence/vendor-analytics"),
  getProductAnalytics: () => fetchApi<any>("/marketplace/intelligence/product-analytics"),
  getFraudAlerts: () => fetchApi<any>("/marketplace/intelligence/fraud-detection"),
  getAiRecommendations: () => fetchApi<any>("/marketplace/intelligence/ai-recommendations"),
};
