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
  const amount = val ?? 0;
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    maximumFractionDigits: 2
  }).format(amount);
}
