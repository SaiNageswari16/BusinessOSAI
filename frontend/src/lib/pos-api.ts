import { useCurrency } from "@/hooks/use-currency";

export interface ApiError {
  status: number;
  detail: string;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let token = null;
  try {
    const authItem = localStorage.getItem("bos-auth");
    if (authItem) {
      token = JSON.parse(authItem).accessToken;
    }
  } catch (e) {
    console.warn("Failed to parse bos-auth from localStorage");
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw { status: response.status, detail: errorData.detail } as ApiError;
  }
  
  return response.json();
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export interface POSDailySummary {
  transactions_count: number;
  total_revenue: number;
  total_returns: number;
  breakdown: {
    cash: number;
    card: number;
    upi: number;
  };
  split_count: number;
  hourly_sales?: {
    hour: string;
    revenue: number;
    orders: number;
  }[];
}

export interface POSTransaction {
  id: string;
  receipt_number: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  payments?: {
    payment_method: string;
    amount: number;
  }[];
  customer?: {
    id: string;
    name: string;
    phone?: string;
  };
}

export const posApi = {
  getDailySummary: async (): Promise<POSDailySummary> => {
    return fetchWithAuth(`${API_BASE_URL}/pos/transactions/reports/daily-summary`);
  },
  
  getTransactionHistory: async (limit: number = 50): Promise<POSTransaction[]> => {
    return fetchWithAuth(`${API_BASE_URL}/pos/transactions/history?limit=${limit}`);
  }
};
