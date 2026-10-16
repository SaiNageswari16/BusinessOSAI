import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Global Currency Settings & Formatters ─────────────────────────────
export interface CurrencyConfig {
  code: string;       // e.g. "USD", "INR", "EUR", "AED"
  locale: string;     // e.g. "en-US", "en-IN", "de-DE", "ar-AE"
  symbol: string;     // e.g. "$", "₹", "€", "د.إ"
}

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  INR: 83,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  SAR: 3.75,
  CAD: 1.36,
  AUD: 1.52
};

export const AVAILABLE_CURRENCIES: CurrencyConfig[] = [
  { code: "INR", locale: "en-IN", symbol: "₹" },
  { code: "USD", locale: "en-US", symbol: "$" },
  { code: "EUR", locale: "de-DE", symbol: "€" },
  { code: "GBP", locale: "en-GB", symbol: "£" },
  { code: "AED", locale: "ar-AE", symbol: "د.إ" },
  { code: "SAR", locale: "ar-SA", symbol: "ر.س" },
  { code: "CAD", locale: "en-CA", symbol: "C$" },
  { code: "AUD", locale: "en-AU", symbol: "A$" }
];

export function getActiveCurrency(): CurrencyConfig {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("bos-currency");
    if (stored) {
      const match = AVAILABLE_CURRENCIES.find(c => c.code === stored);
      if (match) return match;
    }
  }
  return AVAILABLE_CURRENCIES[0]; // Default to INR
}

export function setActiveCurrency(code: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("bos-currency", code);
    // Dispatch custom event to notify all components to re-render
    window.dispatchEvent(new Event("bos-currency-changed"));
  }
}

export function formatCurrency(val?: number | null): string {
  const currency = getActiveCurrency();
  const amount = Number(val ?? 0);
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    maximumFractionDigits: 2
  }).format(amount);
}

// ── Global Date & Time Utilities ──────────────────────────────────────
export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

export const BOS_TIMEZONE = getSystemTimezone();

export function getTodayDateString(timeZone = getSystemTimezone()): string {
  const d = new Date();
  // Format as YYYY-MM-DD in dynamically resolved system timezone
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function getCurrentTimeString(includeSeconds = true, timeZone = getSystemTimezone()): string {
  const d = new Date();
  return d.toLocaleTimeString(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false,
  });
}

export function addDaysToDateString(dateStr: string, days: number, timeZone = getSystemTimezone()): string {
  if (!dateStr) return getTodayDateString(timeZone);
  const parts = dateStr.split("-").map((p) => parseInt(p, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function parseSafeDateTimestamp(dateInput?: string | Date | number | null): number {
  if (!dateInput) return 0;
  if (typeof dateInput === "number") {
    if (isNaN(dateInput) || dateInput <= 0) return 0;
    return dateInput < 1e11 ? dateInput * 1000 : dateInput;
  }
  if (dateInput instanceof Date) {
    const t = dateInput.getTime();
    return isNaN(t) ? 0 : t;
  }
  if (typeof dateInput !== "string") return 0;

  const trimmed = dateInput.trim();
  if (!trimmed) return 0;

  // 1. Check ISO format e.g. "2026-09-23T08:52:00.123456" or "2026-09-23 08:52:00"
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(trimmed)) {
    const isoStr = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    const hasTz = isoStr.endsWith("Z") || /[+-]\d{2}(?::?\d{2})?$/.test(isoStr);
    const parsedIso = Date.parse(hasTz ? isoStr : `${isoStr}Z`);
    if (!isNaN(parsedIso) && parsedIso > 0) {
      return parsedIso;
    }
  }

  // 2. Check DD/MM/YYYY or DD-MM-YYYY with optional time e.g. "26/09/2026 11:41 PM" or "26/09/2026, 11:41:20 AM"
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM|am|pm))?)?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(dmyMatch[3], 10);
    let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const meridiem = dmyMatch[7]?.toUpperCase();

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    const d = new Date(year, month, day, hours, minutes, seconds);
    const t = d.getTime();
    if (!isNaN(t)) return t;
  }

  // 3. Check plain YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day, 0, 0, 0);
    const t = d.getTime();
    if (!isNaN(t)) return t;
  }

  // 4. Fallback standard parse
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return 0;
}

export function formatSafeTime(dateInput?: string | Date | number | null, timeZone = getSystemTimezone()): string {
  if (!dateInput) return "";
  const ts = parseSafeDateTimestamp(dateInput);
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDisplayDate(dateInput?: string | Date | number | null, timeZone = getSystemTimezone()): string {
  if (!dateInput) return "";
  try {
    if (typeof dateInput === "string") {
      const trimmed = dateInput.trim();
      // If plain date string like "2026-09-26" without time
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split("-");
        return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
        const [d, m, y] = trimmed.split("/");
        return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
      }
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
        const [d, m, y] = trimmed.split("-");
        return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
      }
    }
    const ts = parseSafeDateTimestamp(dateInput);
    if (!ts) return String(dateInput || "");
    const d = new Date(ts);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return String(dateInput || "");
  }
}

export const formatDate = formatDisplayDate;
export const formatDateDDMMYYYY = formatDisplayDate;

export function formatDisplayDateTime(dateInput?: string | Date | number | null, timeZone = getSystemTimezone()): string {
  if (!dateInput) return "";
  try {
    const ts = parseSafeDateTimestamp(dateInput);
    if (!ts) return String(dateInput || "");
    const d = new Date(ts);
    const datePart = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
    const timePart = d.toLocaleTimeString(undefined, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return String(dateInput || "");
  }
}

export function formatRegionUnlockTime(
  dateInput?: string | Date | number | null,
  timeZone = getSystemTimezone()
): string {
  if (!dateInput) return "";
  try {
    const ts = parseSafeDateTimestamp(dateInput);
    if (!ts) return String(dateInput || "");
    const d = new Date(ts);
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(d);
  } catch {
    return String(dateInput || "");
  }
}

export function getRegionTimezoneDisplay(timeZone = getSystemTimezone()): {
  timeZone: string;
  offset: string;
  shortName: string;
} {
  try {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(d);
    const shortName = parts.find((p) => p.type === "timeZoneName")?.value || timeZone;

    let offset = "";
    try {
      const offsetFormatter = new Intl.DateTimeFormat(undefined, {
        timeZone,
        timeZoneName: "longOffset",
      });
      const offsetParts = offsetFormatter.formatToParts(d);
      offset = offsetParts.find((p) => p.type === "timeZoneName")?.value || "";
    } catch {
      // Fallback
    }

    return { timeZone, offset, shortName };
  } catch {
    return { timeZone, offset: "", shortName: timeZone };
  }
}

export function isValidUUID(id: any): boolean {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Guest / walk-in parties cannot use ledger, wallet, or Pay Later — full spot payment only. */
export function isWalkInParty(source?: any): boolean {
  if (source == null || source === false) return true;
  if (typeof source === "string") {
    const raw = source.trim().toLowerCase();
    if (!raw) return true;
    return raw === "walk-in" || raw === "walkin" || raw === "walk-in customer" || raw === "walk-in guest"
      || raw.startsWith("walk-in") || raw.startsWith("walkin");
  }
  const id = String(source.id ?? source.customer_id ?? "").trim().toLowerCase();
  const type = String(source.customer_type ?? source.customerType ?? source.type ?? "").trim().toLowerCase();
  const name = String(source.name ?? source.customer_name ?? source.customerName ?? "").trim().toLowerCase();
  const phone = String(source.phone ?? source.customer_phone ?? source.customerPhone ?? "").replace(/\D/g, "");
  if (id === "walk-in" || id === "walkin" || id.startsWith("walk-in") || id.startsWith("walkin")) return true;
  if (type.includes("walk-in") || type.includes("walkin")) return true;
  if (name === "walk-in customer" || name === "walk-in guest" || name === "walk-in" || name === "walkin customer") return true;
  if (!id && !name && !phone) return true;
  return false;
}

/** Join street / city / state / pincode from a customer, address object, or invoice payload. */
export function formatPartyAddress(source?: any): string {
  if (!source) return "";
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed === "[object Object]") return "";
    return trimmed;
  }
  if (typeof source !== "object") return String(source);

  // If source has nested address object like source.billing_address or source.shipping_address or source.street is an object
  const nested = 
    (typeof source.street === "object" && source.street) ||
    (typeof source.billing_address === "object" && source.billing_address) ||
    (typeof source.shipping_address === "object" && source.shipping_address) ||
    (typeof source.customer_billing_address === "object" && source.customer_billing_address) ||
    (typeof source.customer_shipping_address === "object" && source.customer_shipping_address) ||
    (typeof source.address === "object" && source.address) ||
    null;

  const src = nested ? { ...nested, ...source, street: (typeof nested.street === "string" ? nested.street : (typeof source.street === "string" ? source.street : "")) } : source;

  const rawStreet = src.street ?? src.line1 ?? src.address_line1 ?? src.addressLine1 ?? (typeof src.address === "string" ? src.address : "");
  const street = (typeof rawStreet === "string" && rawStreet !== "[object Object]") ? rawStreet.trim() : "";
  const city = String(src.city || src.billing_city || src.shipping_city || "").trim();
  const state = String(src.state || src.customerState || src.billing_state || src.shipping_state || src.province || "").trim();
  const pin = String(src.pincode || src.postal_code || src.pin || src.zip_code || src.billing_pincode || src.shipping_pincode || "").trim();
  const country = String(src.country || "").trim();

  const parts = [
    street,
    city,
    state,
    pin ? (pin.toUpperCase().startsWith("PIN") ? pin : `PIN: ${pin}`) : "",
    country && country.toLowerCase() !== "india" ? country : ""
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(", ").replace(/,\s*,/g, ", ").trim();
  }

  // Check fallback string properties
  for (const key of ["billing_address", "shipping_address", "customerBillingAddress", "customerShippingAddress", "customerAddress", "customer_billing_address", "customer_shipping_address", "address"]) {
    const val = source[key];
    if (typeof val === "string" && val.trim() && val !== "[object Object]") {
      return val.trim();
    }
  }

  return "";
}

/** Detect promotional / ₹0 free lines on invoices and receipts. */
export function isInvoiceLineFree(item?: any): boolean {
  if (!item) return false;
  if (item.is_free === true || item.isFree === true || item.free === true || item.is_promotional === true || item.is_sample === true) return true;
  
  const note = `${item.custom_note || ""} ${item.description || ""} ${item.notes || ""} ${item.product_name || ""} ${item.name || ""}`.toUpperCase();
  if (note.includes("FREE ITEM") || note.includes("[FREE]") || /\bFREE\b/.test(note)) {
    return true;
  }
  
  const price = Number(item.unit_price ?? item.price ?? item.rate ?? 0);
  const total = Number(item.total_amount ?? item.subtotal ?? item.total ?? 0);
  const discType = String(item.discount_type || "").toLowerCase();
  const discVal = Number(item.discount_value ?? item.discount ?? 0);

  // 100% discount
  if (discType === "percent" && discVal >= 99.5) return true;
  if (Number(item.discount_percent || 0) >= 99.5) return true;

  // Zero-priced line item or zero total
  if (price <= 0.0001) {
    return true;
  }
  if (total <= 0.0001 && (item.total_amount !== undefined || item.subtotal !== undefined || item.line_total !== undefined || item.amount !== undefined || item.total !== undefined)) {
    return true;
  }

  return false;
}

