/**
 * safe-storage.ts
 * Safe localStorage wrapper that handles browser QuotaExceededError gracefully,
 * strips oversized base64 payloads, and cleans up non-critical cache when quota is exceeded.
 */

const NON_CRITICAL_CACHE_KEYS = [
  "businessos_print_templates_v1",
  "bos_pos_active_receipt_templates_v1",
  "bos_barcode_custom_templates",
  "user_active_print_templates_v1",
  "bos-store-products-cache",
  "bos-offline-products-cache",
  "bos-store-cart",
  "bos_temp_pdf_overlay",
];

/**
 * Strips huge base64 data strings (e.g. 2MB+ logo uploads) from company snapshots
 * before storing them in localStorage to prevent 5MB browser quota exhaustion.
 */
export function sanitizeForStorage(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  try {
    const copy = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key of Object.keys(copy)) {
      const val = copy[key];
      if (typeof val === "string" && val.startsWith("data:image/") && val.length > 50000) {
        // Base64 image is too large for 5MB localStorage; strip it from the cached copy
        copy[key] = "";
      } else if (val && typeof val === "object" && !Array.isArray(val)) {
        copy[key] = sanitizeForStorage(val);
      }
    }
    return copy;
  } catch {
    return obj;
  }
}

/**
 * Safely sets an item in localStorage.
 * If quota is exceeded, purges non-critical caches and retries.
 * If it still fails, catches gracefully so the page never crashes with an unhandled exception.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuota =
      err?.name === "QuotaExceededError" ||
      err?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err?.code === 22 ||
      err?.code === 1014 ||
      (typeof err?.message === "string" && err.message.toLowerCase().includes("quota"));

    if (isQuota) {
      console.warn(`[SafeStorage] LocalStorage quota exceeded writing "${key}". Purging non-critical cache...`);

      // 1. Purge non-critical keys
      for (const cacheKey of NON_CRITICAL_CACHE_KEYS) {
        try {
          if (cacheKey !== key) {
            localStorage.removeItem(cacheKey);
          }
        } catch {}
      }

      // 2. If value is JSON, sanitize large base64 fields and retry
      try {
        const parsed = JSON.parse(value);
        const sanitized = sanitizeForStorage(parsed);
        const compactVal = JSON.stringify(sanitized);
        localStorage.setItem(key, compactVal);
        return true;
      } catch {
        // Retry standard set after purge
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryErr) {
          console.error(`[SafeStorage] Could not write "${key}" even after cache purge:`, retryErr);
          return false;
        }
      }
    }

    console.warn(`[SafeStorage] Error setting "${key}":`, err);
    return false;
  }
}

/**
 * Safely gets an item from localStorage without throwing.
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely removes an item from localStorage without throwing.
 */
export function safeRemoveItem(key: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {}
}
