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

/**
 * Synchronizes customer balance adjustments across all localStorage POS invoice caches
 * so that settled/adjusted customer invoices are updated and ghost OPN- invoices are purged.
 */
export function syncLocalStorageCustomerInvoices(
  customerId?: string | null,
  customerName?: string | null,
  customerPhone?: string | null,
  newBalance: number = 0
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, "") : "";
    const cleanName = (customerName || "").trim().toLowerCase();
    const cId = customerId ? String(customerId).toLowerCase() : "";

    const keysToUpdate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("pos_saved_invoices") || k.startsWith("pos_offline_invoices"))) {
        keysToUpdate.push(k);
      }
    }

    for (const key of keysToUpdate) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) continue;

        let changed = false;
        const filteredList: any[] = [];

        for (const inv of list) {
          const invNum = String(inv.invoice_number || "").toUpperCase();
          const isOpn = invNum.startsWith("OPN-") || inv.is_opening_balance || inv.invoice_type === "opening_balance";

          // Match customer
          const invCustId = String(inv.customer_id || "").toLowerCase();
          const invCustName = String(inv.customer_name || inv.party_name || "").trim().toLowerCase();
          const invCustPhone = String(inv.customer_phone || inv.phone || "").replace(/\D/g, "");

          const isMatch =
            (cId && invCustId === cId) ||
            (cleanPhone && cleanPhone.length >= 10 && invCustPhone.endsWith(cleanPhone.slice(-10))) ||
            (cleanName && cleanName.length >= 2 && (invCustName === cleanName || invCustName.includes(cleanName)));

          if (isMatch && isOpn) {
            // Delete ghost OPN- invoice
            changed = true;
            continue;
          }

          if (isMatch) {
            if (newBalance <= 0.01) {
              const gTot = Number(inv.grand_total || inv.total_amount || 0);
              inv.amount_received = gTot;
              inv.amount_paid = gTot;
              inv.balance_due = 0;
              inv.balance = 0;
              inv.payment_status = "Paid";
              inv.status = "paid";
              changed = true;
            }
          }

          filteredList.push(inv);
        }

        if (changed) {
          safeSetItem(key, JSON.stringify(filteredList));
        }
      } catch (e) {
        // ignore parse error
      }
    }

    window.dispatchEvent(new Event("pos_invoices_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.warn("Could not sync customer invoices in storage:", err);
  }
}

