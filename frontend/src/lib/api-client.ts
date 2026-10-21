/**
 * Native Fetch HTTP Client for API Gateway (:8000).
 * Implemented using pure fetch (NO AXIOS).
 *
 * Automatically injects:
 *   - Bearer <access_token>
 *   - X-Tenant-ID
 *   - X-Outlet-ID
 * Handles 401 refresh token rotations transparently.
 */

import {
  getAccessToken,
  getActiveOutlet,
  getActiveTenant,
  getPlatformToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAuth,
} from "./auth-tokens";

export const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.VITE_API_GATEWAY_URL) ||
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_GATEWAY_URL) ||
  "http://localhost:8000";

export interface ApiError {
  status: number;
  code: string;
  message: string;
  field?: string;
  requestId?: string;
}

export class ApiException extends Error {
  status: number;
  code: string;
  field?: string;
  requestId?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiException";
    this.status = error.status;
    this.code = error.code;
    this.field = error.field;
    this.requestId = error.requestId;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  isPlatform?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  let url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        searchParams.append(k, String(v));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Token Injection
  if (!options.skipAuth) {
    if (options.isPlatform || endpoint.includes("/api/v1/platform")) {
      const platformToken = getPlatformToken();
      if (platformToken) {
        headers.set("Authorization", `Bearer ${platformToken}`);
      }
    } else {
      const token = getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const tenant = getActiveTenant();
      if (tenant) {
        headers.set("X-Tenant-ID", tenant);
      }
      const outlet = getActiveOutlet();
      if (outlet) {
        headers.set("X-Outlet-ID", outlet);
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw new ApiException({
      status: 0,
      code: "NETWORK_ERROR",
      message: (networkError as Error).message || "Failed to connect to API Gateway (:8000)",
    });
  }

  // 401 Automatic Token Refresh
  if (
    response.status === 401 &&
    !options.skipAuth &&
    !options.isPlatform &&
    !endpoint.includes("/api/v1/auth/login") &&
    !endpoint.includes("/api/v1/auth/refresh")
  ) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            const newAccess = data.access_token;
            const newRefresh = data.refresh_token;
            setAccessToken(newAccess);
            if (newRefresh) setRefreshToken(newRefresh);
            isRefreshing = false;
            onRefreshed(newAccess);
          } else {
            isRefreshing = false;
            clearAuth();
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
          }
        } catch {
          isRefreshing = false;
          clearAuth();
        }
      }

      // Re-queue this request
      return new Promise<T>((resolve, reject) => {
        refreshSubscribers.push(async (newToken: string) => {
          headers.set("Authorization", `Bearer ${newToken}`);
          try {
            const retryRes = await fetch(url, { ...options, headers });
            resolve((await parseResponse(retryRes)) as T);
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  }

  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    let errorCode = "HTTP_ERROR";
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    let errorField: string | undefined;

    if (isJson) {
      try {
        const body = await response.json();
        // Support standard ErrorEnvelope { error: { code, message, field } }
        if (body.error) {
          errorCode = body.error.code || errorCode;
          errorMessage = body.error.message || errorMessage;
          errorField = body.error.field;
        } else if (body.detail) {
          errorMessage = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
        }
      } catch {
        // Fallback to text
      }
    }

    throw new ApiException({
      status: response.status,
      code: errorCode,
      message: errorMessage,
      field: errorField,
      requestId: response.headers.get("X-Request-ID") || undefined,
    });
  }

  if (response.status === 204) {
    return null as T;
  }

  if (isJson) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

export const apiClient = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "GET" }),

  post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: "DELETE" }),
};
