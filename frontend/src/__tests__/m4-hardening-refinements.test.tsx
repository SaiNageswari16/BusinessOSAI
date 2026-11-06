import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  PROTECTED_STORAGE_PREFIXES,
} from "@/lib/safe-storage";
import { numberToIndianWords } from "@/lib/number-to-words";
import { GstTallyTemplate } from "@/components/pos/invoice-templates/GstTallyTemplate";
import { createDefaultUnifiedConfig } from "@/lib/invoice-template-config";
import {
  setupBrowserEnvironment,
  teardownBrowserEnvironment,
  MockLocalStorage,
} from "./test-helpers";

describe("Milestone M4 Hardening Refinements Suite", () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    setupBrowserEnvironment(mockStorage);
  });

  afterEach(() => {
    teardownBrowserEnvironment();
  });

  describe("1. SafeStorage Input Guards and Protected Prefixes", () => {
    it("safeSetItem handles null, undefined, empty, and non-string keys without throwing", () => {
      expect(safeSetItem(null as any, "val")).toBe(false);
      expect(safeSetItem(undefined as any, "val")).toBe(false);
      expect(safeSetItem("" as any, "val")).toBe(false);
      expect(safeSetItem(123 as any, "val")).toBe(false);
      expect(safeSetItem({} as any, "val")).toBe(false);
    });

    it("safeGetItem handles null, undefined, empty, and non-string keys cleanly", () => {
      expect(safeGetItem(null as any)).toBeNull();
      expect(safeGetItem(undefined as any)).toBeNull();
      expect(safeGetItem("" as any)).toBeNull();
      expect(safeGetItem(123 as any)).toBeNull();
    });

    it("safeRemoveItem handles null, undefined, empty, and non-string keys without throwing", () => {
      expect(() => safeRemoveItem(null as any)).not.toThrow();
      expect(() => safeRemoveItem(undefined as any)).not.toThrow();
      expect(() => safeRemoveItem("" as any)).not.toThrow();
    });

    it("PROTECTED_STORAGE_PREFIXES includes bos_unified_invoice_customizer_config", () => {
      expect(PROTECTED_STORAGE_PREFIXES).toContain("bos_unified_invoice_customizer_config");
    });
  });

  describe("2. numberToIndianWords Decimal-Only Cases", () => {
    it("formats sub-rupee fractional amounts as Rs. X Paise Only without empty rupees", () => {
      expect(numberToIndianWords(0.5)).toBe("Rs. Fifty Paise Only");
      expect(numberToIndianWords(0.75)).toBe("Rs. Seventy Five Paise Only");
      expect(numberToIndianWords(0.05)).toBe("Rs. Five Paise Only");
    });

    it("formats zero as Zero Rupees Only", () => {
      expect(numberToIndianWords(0)).toBe("Zero Rupees Only");
    });

    it("formats standard amounts with rupees and paise correctly", () => {
      expect(numberToIndianWords(100.5)).toBe("Rs. One Hundred Rupees and Fifty Paise Only");
      expect(numberToIndianWords(50)).toBe("Rs. Fifty Rupees Only");
    });
  });

  describe("3. GstTallyTemplate HSN Slab Capping & Logo Error Safety", () => {
    it("caps HSN concatenation in tax slab table to 5 items plus (+N more)", () => {
      // Create invoice with 8 items having distinct HSN codes in same 18% slab
      const items = [
        { name: "Item 1", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "1001" },
        { name: "Item 2", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "1002" },
        { name: "Item 3", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "1003" },
        { name: "Item 4", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "1004" },
        { name: "Item 5", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "1005" },
        { name: "Item 6", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "1006" },
        { name: "Item 7", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "1007" },
        { name: "Item 8", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "1008" },
      ];

      const invoice: any = {
        invoice_number: "INV-HSN-TEST",
        date: "2026-11-06",
        items,
        subtotal: 800,
        tax_total: 144,
        total: 944,
        grand_total: 944,
      };

      const templateConfig = createDefaultUnifiedConfig("invoice");
      const html = renderToString(
        <GstTallyTemplate
          invoice={invoice}
          template={templateConfig as any}
          f={{ showTaxSplit: true, showHsn: true }}
        />
      );

      // Verify capped HSN string exists in rendered output
      expect(html).toContain("1001, 1002, 1003, 1004, 1005... (+3 more)");
    });

    it("renders all HSNs directly when count is <= 5 without (+N more)", () => {
      const items = [
        { name: "Item 1", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "2001" },
        { name: "Item 2", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "2002" },
        { name: "Item 3", quantity: 1, unit_price: 100, tax_rate: 18, hsn_code: "2003" },
      ];

      const invoice: any = {
        invoice_number: "INV-HSN-3",
        date: "2026-11-06",
        items,
        subtotal: 300,
        tax_total: 54,
        total: 354,
        grand_total: 354,
      };

      const templateConfig = createDefaultUnifiedConfig("invoice");
      const html = renderToString(
        <GstTallyTemplate
          invoice={invoice}
          template={templateConfig as any}
          f={{ showTaxSplit: true, showHsn: true }}
        />
      );

      expect(html).toContain("2001, 2002, 2003");
      expect(html).not.toContain("more)");
    });

    it("renders logo img tag with dynamic logo and styling", () => {
      const invoice: any = {
        invoice_number: "INV-LOGO-TEST",
        date: "2026-11-06",
        items: [{ name: "Item", quantity: 1, unit_price: 100, tax_rate: 0 }],
        subtotal: 100,
        total: 100,
        grand_total: 100,
      };

      const templateConfig = createDefaultUnifiedConfig("invoice");
      const html = renderToString(
        <GstTallyTemplate
          invoice={invoice}
          template={templateConfig as any}
          dynamicLogoUrl="https://test.example.com/logo.png"
          f={{ showLogo: true }}
        />
      );

      expect(html).toContain('src="https://test.example.com/logo.png"');
      expect(html).toContain('alt="Logo"');
    });
  });
});
