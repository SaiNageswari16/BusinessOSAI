import { inr, orderTotal } from "@/lib/calc";
import type { Customer, Kot, Order, OrderType } from "@/lib/types";

export type DisplayKitchenStatus = "New" | "Preparing" | "Ready" | "Served";
export type DisplayOrderStatus = "Ongoing" | "Served" | "Completed" | "On Delivery" | "Cancelled";

export function deriveKitchenStatus(order: Order, kots: Kot[]): DisplayKitchenStatus {
  if (order.status === "completed") return "Ready";
  if (order.status === "served") return "Ready";
  if (order.status === "ready") return "Ready";

  const orderKots = kots.filter((k) => k.orderId === order.id);
  if (orderKots.length === 0) {
    return order.status === "in-kitchen" ? "Preparing" : "New";
  }
  if (orderKots.every((k) => k.status === "served")) return "Served";
  if (orderKots.every((k) => k.status === "ready" || k.status === "served")) return "Ready";
  if (orderKots.some((k) => k.status === "preparing" || k.status === "accepted"))
    return "Preparing";
  return "New";
}

export function deriveDisplayOrderStatus(order: Order): DisplayOrderStatus {
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "completed") return "Completed";
  if (order.type === "delivery" && (order.status === "in-kitchen" || order.status === "ready")) {
    return "On Delivery";
  }
  if (order.status === "served" || order.status === "ready") return "Served";
  return "Ongoing";
}

export interface OrdersKpiSummary {
  total: number;
  dineIn: number;
  dineInPct: number;
  takeaway: number;
  takeawayPct: number;
  delivery: number;
  deliveryPct: number;
  pending: number;
  pendingPct: number;
  completed: number;
  completedPct: number;
  cancelled: number;
  cancelledPct: number;
}

export function computeOrdersKpiSummary(orders: Order[]): OrdersKpiSummary {
  const total = orders.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const dineIn = orders.filter((o) => o.type === "dine-in").length;
  const takeaway = orders.filter((o) => o.type === "takeaway").length;
  const delivery = orders.filter((o) => o.type === "delivery").length;

  const completed = orders.filter((o) => o.status === "completed").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const pending = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length;

  return {
    total,
    dineIn,
    dineInPct: pct(dineIn),
    takeaway,
    takeawayPct: pct(takeaway),
    delivery,
    deliveryPct: pct(delivery),
    pending,
    pendingPct: pct(pending),
    completed,
    completedPct: pct(completed),
    cancelled,
    cancelledPct: pct(cancelled),
  };
}

export function formatOrderTime(ts: number): string {
  try {
    return new Date(ts)
      .toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toUpperCase();
  } catch {
    return "12:45 PM";
  }
}

export function formatOrderDateTime(ts: number): string {
  try {
    const d = new Date(ts);
    const datePart = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return `${datePart}, ${formatOrderTime(ts)}`;
  } catch {
    return "17 Aug 2025, 12:45 PM";
  }
}

export function formatOrderTypeLabel(type: OrderType): string {
  switch (type) {
    case "dine-in":
      return "Dine In";
    case "takeaway":
      return "Takeaway";
    case "delivery":
      return "Delivery";
  }
}

const AVATAR_TONES = [
  "bg-[#DBEAFE] text-[#1D4ED8]",
  "bg-[#E2E8F0] text-[#334155]",
  "bg-[#CFFAFE] text-[#0E7490]",
  "bg-[#E0E7FF] text-[#4338CA]",
  "bg-[#EDE9FE] text-[#6D28D9]",
  "bg-[#FFE4E6] text-[#BE123C]",
  "bg-[#FEF3C7] text-[#B45309]",
];

export function getCustomerInitials(name?: string): string {
  if (!name || name.toLowerCase() === "walk-in") return "W";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "G").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

export function getAvatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length] ?? AVATAR_TONES[0]!;
}

export function exportOrdersToCsv(orders: Order[], customers: Customer[], gstPct: number): string {
  const custById = new Map(customers.map((c) => [c.id, c]));
  const header = [
    "Order ID",
    "Time",
    "Order Type",
    "Table",
    "Customer",
    "Items Count",
    "Payment Status",
    "Order Status",
    "Total Amount (INR)",
  ];
  const rows = orders.map((o) => {
    const cust = o.customerId ? (custById.get(o.customerId)?.name ?? "Walk-in") : "Walk-in";
    const itemCount = o.lines.reduce((s, l) => s + l.qty, 0);
    const total = orderTotal(o, gstPct);
    return [
      `#${o.id}`,
      `"${formatOrderDateTime(o.createdAt)}"`,
      formatOrderTypeLabel(o.type),
      o.tableId ?? "-",
      `"${cust}"`,
      String(itemCount),
      o.payment === "paid" ? "Paid" : o.payment === "refunded" ? "Refunded" : "Pending",
      deriveDisplayOrderStatus(o),
      `"${inr(total)}"`,
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}
