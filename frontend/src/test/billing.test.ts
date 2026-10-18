import { describe, expect, it } from "vitest";
import { computeBill } from "@/lib/billing";

const lines = [
  { qty: 2, unitPrice: 280 },
  { qty: 4, unitPrice: 60 },
]; // 800

describe("computeBill", () => {
  it("applies 5% GST and 5% service charge for dine-in", () => {
    const b = computeBill(lines, {
      taxRate: 0.05,
      serviceCharge: 0.05,
      discountPct: 0,
      dineIn: true,
    });
    expect(b).toEqual({ subtotal: 800, discount: 0, service: 40, tax: 40, total: 880 });
  });
  it("skips service charge for takeaway", () => {
    const b = computeBill(lines, {
      taxRate: 0.05,
      serviceCharge: 0.05,
      discountPct: 0,
      dineIn: false,
    });
    expect(b.total).toBe(840);
  });
  it("taxes the discounted amount", () => {
    const b = computeBill(lines, {
      taxRate: 0.05,
      serviceCharge: 0,
      discountPct: 10,
      dineIn: false,
    });
    expect(b.discount).toBe(80);
    expect(b.tax).toBe(36);
    expect(b.total).toBe(756);
  });
});
