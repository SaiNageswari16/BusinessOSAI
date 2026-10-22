import type { OrderLine, Order, Kot, DiningTable } from "./types";

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const lineTotal = (l: OrderLine) =>
  (l.price + l.addons.reduce((s, a) => s + a.price, 0)) * l.qty;

export function validDiscount(pct: number, max: number) {
  return Number.isFinite(pct) && pct >= 0 && pct <= max;
}

export function totals(lines: OrderLine[], discountPct: number, gstPct: number) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const discount = Math.round(((subtotal * discountPct) / 100) * 100) / 100;
  const taxable = subtotal - discount;
  const gst = Math.round(taxable * gstPct) / 100;
  return { subtotal, discount, taxable, gst, total: Math.round(taxable + gst) };
}

export const orderTotal = (o: Order, gstPct: number) =>
  totals(o.lines, o.discountPct, gstPct).total;

export function clampQty(q: number) {
  if (!Number.isFinite(q)) return 1;
  return Math.max(1, Math.min(99, Math.floor(q)));
}

export function minutesSince(ts?: number, now = Date.now()) {
  if (!ts) return 0;
  return Math.max(0, Math.floor((now - ts) / 60000));
}

export function deriveOrderStatusFromKots(kots: Kot[]): "in-kitchen" | "ready" | null {
  if (!kots.length) return null;
  return kots.every((k) => k.status === "ready" || k.status === "served") ? "ready" : "in-kitchen";
}

export function tableCounts(tables: DiningTable[]) {
  const c = { available: 0, occupied: 0, reserved: 0, billing: 0, cleaning: 0 };
  tables.forEach((t) => c[t.status]++);
  return c;
}
