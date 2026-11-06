/**
 * safe-storage.ts
 * Safe localStorage wrapper that handles browser QuotaExceededError gracefully,
 * preserves valid user templates, strips oversized base64 payloads,
 * downscales uploaded images via Canvas, and cleans up non-critical cache when quota is exceeded.
 */

/**
 * Maximum character length allowed for an inline base64 image data URL in localStorage (~187.5 KB).
 * Normal web logos, stamps, and signatures are typically 20KB-120KB (~27,000 to ~160,000 chars).
 * Payloads exceeding this threshold (e.g. uncompressed raw camera photos > 2MB)
 * are sanitized to prevent 5MB browser quota exhaustion.
 */
export const MAX_STORED_IMAGE_CHARS = 250_000;

/**
 * Disposable transient cache keys safe to purge during QuotaExceededError recovery.
 * CRITICAL: User print templates, active document template mappings, and custom
 * configurations must NEVER be placed in this list!
 */
export const NON_CRITICAL_CACHE_KEYS = [
  "bos-store-products-cache",
  "bos-offline-products-cache",
  "bos-store-cart",
  "bos_temp_pdf_overlay",
  "store-cart",
  "store-wishlist",
  "bos_temp_print_preview",
  "bos_temp_pdf_blob",
  "bos_report_cache",
  "bos_analytics_cache",
];

/**
 * Storage key prefixes that are strictly protected and MUST NEVER be purged
 * during quota recovery sweeps.
 */
export const PROTECTED_STORAGE_PREFIXES = [
  "businessos_print_templates_v1",
  "user_active_print_templates_v1",
  "bos_active_invoice_template_id",
  "bos_active_invoice_category_template",
  "bos_invoice_category_link",
  "bos_unified_invoice_customizer_config",
  "bos_active_quotation_template_id",
  "bos_active_proforma_template_id",
  "bos_active_estimate_template_id",
  "bos_active_challan_template_id",
  "bos_signature_settings",
  "bos_active_billing_gst_details",
  "bos_active_billing_gstin",
  "bos_payment_qr_settings",
  "bos_pos_active_receipt_templates_v1",
  "bos_barcode_custom_templates",
  "bos-auth",
  "bos-active-role",
  "bos-theme",
  "bos-currency",
];

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  preserveAlpha?: boolean;
}

/**
 * Client-side canvas image downscaling and compression helper.
 * Takes a File, Blob, or base64 data URL and produces a compact base64 data URL
 * safely under 150KB (< 200,000 chars) while preserving high visual fidelity for A4 prints.
 */
export async function compressImageForStorage(
  input: File | Blob | string,
  options: CompressImageOptions = {}
): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return typeof input === "string" ? input : "";
  }
  if (!input) return "";

  const {
    maxWidth = 500,
    maxHeight = 300,
    quality = 0.85,
    preserveAlpha,
  } = options;

  let objectUrl: string | null = null;
  let srcUrl = "";

  if (typeof input === "string") {
    // If it's already a very small string (< 20KB) or an SVG vector, keep as-is
    if (input.startsWith("data:image/svg+xml") || (input.startsWith("data:image/") && input.length < 25_000)) {
      return input;
    }
    srcUrl = input;
  } else {
    try {
      objectUrl = URL.createObjectURL(input);
      srcUrl = objectUrl;
    } catch {
      return "";
    }
  }

  // Determine target MIME type and alpha preservation
  let isPng = false;
  if (typeof input === "string") {
    isPng = input.startsWith("data:image/png");
  } else if ("type" in input) {
    isPng = input.type === "image/png";
  }
  const shouldPreserveAlpha = preserveAlpha ?? isPng;
  const targetMime = options.mimeType || (shouldPreserveAlpha ? "image/png" : "image/jpeg");

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      }
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width || 300;
        let height = img.naturalHeight || img.height || 150;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          cleanup();
          resolve(typeof input === "string" ? input : "");
          return;
        }

        // If target is JPEG, fill white background to avoid black background on transparent PNGs
        if (targetMime === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL(targetMime, quality);

        // If PNG is still too large (> 250,000 chars), fall back to WebP or JPEG
        if (dataUrl.length > MAX_STORED_IMAGE_CHARS && targetMime === "image/png") {
          try {
            const webpUrl = canvas.toDataURL("image/webp", quality);
            if (webpUrl.startsWith("data:image/webp") && webpUrl.length < dataUrl.length) {
              dataUrl = webpUrl;
            }
          } catch {}
        }

        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(typeof input === "string" ? input : "");
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(typeof input === "string" ? input : "");
    };

    img.src = srcUrl;
  });
}

/**
 * Strips huge base64 data strings (e.g. uncompressed 2MB+ camera uploads)
 * before storing them in localStorage to prevent 5MB browser quota exhaustion.
 * Preserves normal crisp logos, stamps, and signatures under `maxImageLength` (default 250,000 chars / ~187 KB).
 */
export function sanitizeForStorage(
  obj: any,
  maxImageLength: number = MAX_STORED_IMAGE_CHARS,
  seen: WeakSet<object> = new WeakSet<object>()
): any {
  if (!obj) return obj;
  if (typeof obj === "string") {
    if (
      (obj.startsWith("data:image/") || obj.startsWith("data:application/pdf")) &&
      obj.length > maxImageLength
    ) {
      return "";
    }
    return obj;
  }
  if (typeof obj !== "object") return obj;

  if (seen.has(obj)) return obj;
  seen.add(obj);

  try {
    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeForStorage(item, maxImageLength, seen));
    }

    const copy: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (
        typeof val === "string" &&
        (val.startsWith("data:image/") || val.startsWith("data:application/pdf")) &&
        val.length > maxImageLength
      ) {
        copy[key] = "";
      } else if (val && typeof val === "object") {
        copy[key] = sanitizeForStorage(val, maxImageLength, seen);
      } else {
        copy[key] = val;
      }
    }
    return copy;
  } catch {
    return obj;
  }
}

/**
 * Dedupe + cap a stored print-template list so a QuotaExceededError can never
 * blow up a save:
 *   - keeps the most recent entry when duplicates share an `id` (falls back to
 *     `template_id` or `name` when the entry has no `id`),
 *   - sorts by `updated_at` descending when timestamps are present,
 *   - caps the list at 15 entries,
 *   - strips oversized base64 payloads (> 250,000 chars) via `sanitizeForStorage`.
 */
export function pruneTemplateList(list: any[]): any[] {
  if (!Array.isArray(list) || list.length === 0) return [];

  const timeOf = (t: any): number => {
    const v = t?.updated_at ?? t?.updatedAt ?? 0;
    const ts = Date.parse(typeof v === "number" ? new Date(v).toISOString() : String(v));
    return Number.isNaN(ts) ? 0 : ts;
  };

  const seen = new Map<string, any>();
  for (let idx = 0; idx < list.length; idx++) {
    const item = list[idx];
    if (!item || typeof item !== "object") continue;
    const key = String(item.id || item.template_id || item.name || `tpl_${idx}`);
    const existing = seen.get(key);
    // Keep the newer duplicate; prefer the entry that carries a timestamp.
    if (existing) {
      const sameTime = timeOf(existing) === timeOf(item);
      if (timeOf(item) > timeOf(existing) || (sameTime && !existing.updated_at && item.updated_at)) {
        seen.set(key, item);
      }
    } else {
      seen.set(key, item);
    }
  }

  let result = Array.from(seen.values());
  result.sort((a, b) => timeOf(b) - timeOf(a));
  result = result.slice(0, 15);
  return sanitizeForStorage(result, MAX_STORED_IMAGE_CHARS);
}

/**
 * Safely sets an item in localStorage.
 * If quota is exceeded:
 *   1. Purges non-critical caches (product caches, cart, pdf overlays)
 *   2. Trims offline invoice history
 *   3. Retries original write
 *   4. If still exceeding, compacts/sanitizes target payload
 *   5. Never throws unhandled QuotaExceededError; returns boolean status.
 */
export function safeSetItem(key: string, value: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (typeof window === "undefined" || !window.localStorage) return false;

  // Auto-prune huge arrays upfront to avoid 5MB quota exhaustion
  if (key.startsWith("pos_saved_invoices") || key.startsWith("pos_offline_invoices")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.length > 50) {
        value = JSON.stringify(sanitizeForStorage(parsed.slice(0, 50), MAX_STORED_IMAGE_CHARS));
      }
    } catch {}
  } else if (key.startsWith("businessos_print_templates_v1")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        value = JSON.stringify(pruneTemplateList(parsed));
      } else {
        value = JSON.stringify(sanitizeForStorage(parsed, MAX_STORED_IMAGE_CHARS));
      }
    } catch {}
  } else if (
    key.startsWith("bos_signature_settings") ||
    key.startsWith("bos_active_billing_gst_details") ||
    key.startsWith("bos_payment_qr_settings")
  ) {
    try {
      const parsed = JSON.parse(value);
      value = JSON.stringify(sanitizeForStorage(parsed, MAX_STORED_IMAGE_CHARS));
    } catch {}
  }

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

    if (!isQuota) {
      console.warn(`[SafeStorage] Error setting "${key}":`, err);
      return false;
    }

    console.warn(`[SafeStorage] LocalStorage quota exceeded writing "${key}". Initiating safe recovery...`);

    // Recovery Step 1: Purge designated non-critical cache keys
    for (const cacheKey of NON_CRITICAL_CACHE_KEYS) {
      try {
        if (cacheKey !== key) {
          localStorage.removeItem(cacheKey);
        }
      } catch {}
    }

    // Recovery Step 2: Purge transient temporary keys matching temporary patterns
    try {
      const keysToPurge: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k === key) continue;
        const isProtected = PROTECTED_STORAGE_PREFIXES.some((p) => k.startsWith(p));
        if (isProtected) continue;

        if (
          k.startsWith("bos_temp_") ||
          k.startsWith("bos_cache_") ||
          k.includes("products-cache") ||
          k.includes("offline-products") ||
          k.startsWith("temp_")
        ) {
          keysToPurge.push(k);
        }
      }
      for (const k of keysToPurge) {
        localStorage.removeItem(k);
      }
    } catch {}

    // Recovery Step 3: Trim large invoice history arrays to 20 items
    try {
      const invoiceKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k !== key && (k.startsWith("pos_saved_invoices") || k.startsWith("pos_offline_invoices"))) {
          invoiceKeys.push(k);
        }
      }
      for (const k of invoiceKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 20) {
              localStorage.setItem(k, JSON.stringify(parsed.slice(0, 20)));
            }
          } catch {}
        }
      }
    } catch {}

    // Recovery Step 4: Retry writing original value now that space was freed!
    try {
      localStorage.setItem(key, value);
      console.info(`[SafeStorage] Successfully stored "${key}" after clearing non-critical cache.`);
      return true;
    } catch {}

    // Recovery Step 5: Quota still exceeded — compact/sanitize target value
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        if (key.startsWith("businessos_print_templates_v1")) {
          // Keep top 6 templates; strip images from background templates (idx > 0)
          const trimmed = pruneTemplateList(parsed).slice(0, 6);
          const degraded = trimmed.map((t, idx) => {
            if (idx === 0) return sanitizeForStorage(t, MAX_STORED_IMAGE_CHARS);
            return sanitizeForStorage(t, 5000);
          });
          const compactVal = JSON.stringify(degraded);
          localStorage.setItem(key, compactVal);
          return true;
        } else {
          // General array: slice to 10 items and sanitize
          const compactVal = JSON.stringify(sanitizeForStorage(parsed.slice(0, 10), 50_000));
          localStorage.setItem(key, compactVal);
          return true;
        }
      } else if (parsed && typeof parsed === "object") {
        // Single object: sanitize with tighter threshold (50KB)
        const compactVal = JSON.stringify(sanitizeForStorage(parsed, 50_000));
        localStorage.setItem(key, compactVal);
        return true;
      }
    } catch {
      // value is a non-JSON string
    }

    // Recovery Step 6: Emergency sweep of legacy v0 templates and stale report favorites
    try {
      const legacyKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k === key) continue;
        const isProtected = PROTECTED_STORAGE_PREFIXES.some((p) => k.startsWith(p));
        if (isProtected) continue;
        if (
          k.startsWith("businessos_print_templates_v0") ||
          k.startsWith("bos_legacy_") ||
          k.startsWith("report_fav_") ||
          k.startsWith("bos_log_")
        ) {
          legacyKeys.push(k);
        }
      }
      for (const k of legacyKeys) {
        localStorage.removeItem(k);
      }
      localStorage.setItem(key, value);
      return true;
    } catch {}

    // Recovery Step 7: Final fallback
    console.warn(`[SafeStorage] Skipped writing "${key}" (${value.length} bytes) to avoid breaking React lifecycle.`);
    return false;
  }
}

/**
 * Safely gets an item from localStorage without throwing.
 */
export function safeGetItem(key: string): string | null {
  if (!key || typeof key !== "string") return null;
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
  if (!key || typeof key !== "string") return;
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
