/**
 * Secure token & session storage for RestaurantOS / BusinessOS.
 * SSR-safe: guarantees no window/localStorage evaluation crashes during Nitro/TanStack Start SSR.
 */

const ACCESS_TOKEN_KEY = "businessos_access_token";
const REFRESH_TOKEN_KEY = "businessos_refresh_token";
const TENANT_KEY = "businessos_active_tenant";
const OUTLET_KEY = "businessos_active_outlet";
const USER_KEY = "businessos_user_profile";
const PLATFORM_TOKEN_KEY = "businessos_platform_token";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function getActiveTenant(): string | null {
  if (!isBrowser()) return "e9fb216b-6289-43ca-900c-c09eada9840f";
  return localStorage.getItem(TENANT_KEY) || "e9fb216b-6289-43ca-900c-c09eada9840f";
}

export function setActiveTenant(tenantId: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(TENANT_KEY, tenantId);
}

export function getActiveOutlet(): string | null {
  if (!isBrowser()) return "11111111-2222-3333-4444-555555555555";
  return localStorage.getItem(OUTLET_KEY) || "11111111-2222-3333-4444-555555555555";
}

export function setActiveOutlet(outletId: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(OUTLET_KEY, outletId);
}

export function getUserProfile<T>(): T | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setUserProfile(profile: unknown): void {
  if (!isBrowser()) return;
  localStorage.setItem(USER_KEY, JSON.stringify(profile));
}

// ─── Platform Super Admin Tokens ─────────────────────────────────────────────

export function getPlatformToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setPlatformToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(PLATFORM_TOKEN_KEY, token);
}

export function clearPlatformToken(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(PLATFORM_TOKEN_KEY);
}

export function clearAuth(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(OUTLET_KEY);
  localStorage.removeItem(USER_KEY);
}
