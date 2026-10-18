import type { OrderLine } from "./types";

export interface BillOptions {
  taxRate: number; // e.g. 0.05 GST
  serviceCharge: number; // applied to dine-in only
  discountPct: number; // 0-100
  dineIn: boolean;
}

export function computeBill(lines: Pick<OrderLine, "qty" | "unitPrice">[], o: BillOptions) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const discount = Math.round((subtotal * Math.min(Math.max(o.discountPct, 0), 100)) / 100);
  const taxable = subtotal - discount;
  const service = o.dineIn ? Math.round(taxable * o.serviceCharge) : 0;
  const tax = Math.round(taxable * o.taxRate);
  const total = taxable + service + tax;
  return { subtotal, discount, service, tax, total };
}

export const orderTotal = (lines: Pick<OrderLine, "qty" | "unitPrice">[]) =>
  lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
