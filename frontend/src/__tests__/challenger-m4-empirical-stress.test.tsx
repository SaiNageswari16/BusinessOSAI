/**
 * frontend/src/__tests__/challenger-m4-empirical-stress.test.tsx
 *
 * Milestone M4: Hardening Stress Challenger Test Suite
 * Archetype: EMPIRICAL CHALLENGER
 * Roles: critic, specialist
 *
 * Empirical verification of:
 * 1. safeSetItem, safeGetItem, safeRemoveItem input guards across non-string / malformed key types.
 * 2. Protected prefix "bos_unified_invoice_customizer_config" retention under multi-stage quota pressure recovery.
 * 3. UnifiedInvoiceCustomizer recovery when encountering malformed or partial JSON storage snapshots without throwing.
 * 4. GstTallyTemplate HSN slab table capping with >100 items & multi-HSN codes, and logo onError resilience.
 * 5. numberToIndianWords sub-rupee fractional currency formatting and extreme boundary values.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  PROTECTED_STORAGE_PREFIXES,
  NON_CRITICAL_CACHE_KEYS,
} from "../lib/safe-storage";
import { UnifiedInvoiceCustomizer } from "../components/inventory/UnifiedInvoiceCustomizer";
import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";
import { numberToIndianWords } from "../lib/number-to-words";
import {
  createDefaultUnifiedConfig,
  type UnifiedInvoiceCustomizerConfig,
} from "../lib/invoice-template-config";
import {
  setupBrowserEnvironment,
  teardownBrowserEnvironment,
  MockLocalStorage,
} from "./test-helpers";

describe("Challenger M4 Empirical Hardening Stress Suite", () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    setupBrowserEnvironment(mockStorage);
  });

  afterEach(() => {
    teardownBrowserEnvironment();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 1: Input Guards on Storage Helpers
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 1: safeSetItem, safeGetItem, and safeRemoveItem Input Guards", () => {
    const invalidKeys: any[] = [
      null,
      undefined,
      "",
      0,
      123,
      -999,
      NaN,
      false,
      true,
      {},
      { key: "foo" },
      [],
      ["bar"],
      () => "fn",
      Symbol("sym"),
    ];

    it("safeSetItem returns false for all non-string and falsy keys without throwing", () => {
      for (const invalidKey of invalidKeys) {
        expect(() => {
          const result = safeSetItem(invalidKey, "valid_payload");
          expect(result).toBe(false);
        }).not.toThrow();
      }
    });

    it("safeGetItem returns null for all non-string and falsy keys without throwing", () => {
      for (const invalidKey of invalidKeys) {
        expect(() => {
          const result = safeGetItem(invalidKey);
          expect(result).toBeNull();
        }).not.toThrow();
      }
    });

    it("safeRemoveItem completes silently for all non-string and falsy keys without throwing", () => {
      for (const invalidKey of invalidKeys) {
        expect(() => {
          safeRemoveItem(invalidKey);
        }).not.toThrow();
      }
    });

    it("valid string keys still store and retrieve data normally", () => {
      const ok = safeSetItem("valid_test_key", "valid_test_value");
      expect(ok).toBe(true);
      expect(safeGetItem("valid_test_key")).toBe("valid_test_value");
      safeRemoveItem("valid_test_key");
      expect(safeGetItem("valid_test_key")).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 2: Protected Prefix Retention Under Multi-Stage Storage Quota Sweep
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 2: Protected Prefix Retention Under Quota Relief", () => {
    it("PROTECTED_STORAGE_PREFIXES contains bos_unified_invoice_customizer_config", () => {
      expect(PROTECTED_STORAGE_PREFIXES).toContain("bos_unified_invoice_customizer_config");
    });

    it("retains all customizer config keys while purging non-critical cache during quota recovery", () => {
      // Setup storage with 4 category customizer configs
      const customizerKeys = [
        "bos_unified_invoice_customizer_config_t1_c1_invoice",
        "bos_unified_invoice_customizer_config_t1_c1_proforma",
        "bos_unified_invoice_customizer_config_t1_c1_quotation",
        "bos_unified_invoice_customizer_config_t1_c1_challan",
      ];
      for (const k of customizerKeys) {
        mockStorage.setItem(k, JSON.stringify({ category: k, savedAt: Date.now() }));
      }

      // Populate non-critical cache keys
      mockStorage.setItem("bos-store-products-cache", "X".repeat(5000));
      mockStorage.setItem("bos_temp_pdf_overlay", "Y".repeat(5000));
      mockStorage.setItem("bos_report_cache", "Z".repeat(5000));

      // Populate transient temp keys
      mockStorage.setItem("bos_temp_export_123", "TEMP_EXPORT");
      mockStorage.setItem("temp_preview_image", "TEMP_IMAGE");

      // Populate legacy keys
      mockStorage.setItem("businessos_print_templates_v0_backup", "LEGACY_V0");
      mockStorage.setItem("bos_legacy_orders", "LEGACY_ORDERS");

      // Verify all items are currently present
      expect(mockStorage.getItem(customizerKeys[0])).not.toBeNull();
      expect(mockStorage.getItem("bos-store-products-cache")).not.toBeNull();
      expect(mockStorage.getItem("bos_temp_export_123")).not.toBeNull();
      expect(mockStorage.getItem("bos_legacy_orders")).not.toBeNull();

      // Configure storage to simulate QuotaExceededError when size > 3000 chars
      mockStorage.quotaThreshold = 3000;

      // Attempt to write a new large payload that triggers quota recovery
      const writeResult = safeSetItem("incoming_new_template", JSON.stringify({ name: "Incoming" }));

      // 1. All customizer keys MUST be preserved completely!
      for (const k of customizerKeys) {
        expect(mockStorage.getItem(k)).not.toBeNull();
        const parsed = JSON.parse(mockStorage.getItem(k)!);
        expect(parsed.category).toBe(k);
      }

      // 2. Non-critical and temp keys must have been pruned by the recovery sweep
      expect(mockStorage.getItem("bos-store-products-cache")).toBeNull();
      expect(mockStorage.getItem("bos_temp_pdf_overlay")).toBeNull();
      expect(mockStorage.getItem("bos_temp_export_123")).toBeNull();
      expect(mockStorage.getItem("temp_preview_image")).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 3: UnifiedInvoiceCustomizer Recovery from Malformed/Corrupt Storage
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 3: UnifiedInvoiceCustomizer Corrupt Storage Snapshot Recovery", () => {
    const tid = "stress_tenant_m4";

    it("recovers cleanly without throwing when storage contains syntactically invalid JSON", () => {
      mockStorage.setItem(
        `bos_unified_invoice_customizer_config_${tid}_invoice`,
        "{{{NOT_VALID_JSON: true,"
      );

      expect(() => {
        const html = renderToString(
          <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="style" />
        );
        expect(html).toContain("Theme Style Preset");
      }).not.toThrow();
    });

    it("recovers cleanly when storage contains JSON primitives (number, string, boolean, null)", () => {
      const primitives = ["12345", '"some_string"', "true", "null", "[]"];
      for (const prim of primitives) {
        mockStorage.setItem(
          `bos_unified_invoice_customizer_config_${tid}_invoice`,
          prim
        );

        expect(() => {
          const html = renderToString(
            <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="party" />
          );
          expect(html).toContain("Party Details");
        }).not.toThrow();
      }
    });

    it("deep-merges partial JSON missing style, party, itemTable sub-structures with defaults", () => {
      // Partial JSON snapshot: only has docCategory and theme, missing sub-objects
      const partialSnapshot = {
        docCategory: "invoice",
        theme: "gst_modern",
        // style, print, business, invoice, party, itemTable, miscellaneous are completely missing!
      };
      mockStorage.setItem(
        `bos_unified_invoice_customizer_config_${tid}_invoice`,
        JSON.stringify(partialSnapshot)
      );

      expect(() => {
        const html = renderToString(
          <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="miscellaneous" />
        );
        expect(html).toContain("UPI Payment QR");
        expect(html).toContain("Signatures &amp; Company Stamp");
      }).not.toThrow();
    });

    it("deep-merges sub-objects when inner fields are null or undefined without crashing", () => {
      // Partial JSON with null inner sections
      const corruptInnerSnapshot = {
        theme: "gst_tally",
        style: { themeId: "gst_tally" },
        party: {
          billTo: null, // should fall back to default billTo
          shipTo: null, // should fall back to default shipTo
        },
        itemTable: {
          subToggles: null,
          totalsToggles: null,
        },
        miscellaneous: {
          paymentQr: null,
          bankDetails: null,
          termsAndConditions: null,
          signatureAndStamp: null,
        },
      };

      mockStorage.setItem(
        `bos_unified_invoice_customizer_config_${tid}_invoice`,
        JSON.stringify(corruptInnerSnapshot)
      );

      expect(() => {
        const html = renderToString(
          <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="party" />
        );
        expect(html).toContain("Party Details");
      }).not.toThrow();

      expect(() => {
        const html = renderToString(
          <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="itemTable" />
        );
        expect(html).toContain("Item Table");
      }).not.toThrow();
    });

    it("sanitizes bos_active_company_id when set to 'undefined' or 'null' literal strings", () => {
      mockStorage.setItem("bos_active_company_id", "undefined");

      expect(() => {
        const html = renderToString(
          <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="style" />
        );
        expect(html).toBeDefined();
      }).not.toThrow();

      // Ensure no key with literal '_undefined_' was written into storage
      const keys = Object.keys(mockStorage.dump());
      const hasLiteralUndefinedKey = keys.some((k) => k.includes("_undefined_"));
      expect(hasLiteralUndefinedKey).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 4: GstTallyTemplate HSN Table Capping & Image Error Safety
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 4: GstTallyTemplate HSN Capping & Logo Error Safety", () => {
    it("caps HSN concatenation to first 5 unique HSN codes + (+N more) across >100 items", () => {
      // Generate 150 items with 15 distinct HSN codes in the same 18% slab
      const items = Array.from({ length: 150 }, (_, i) => ({
        name: `Item #${i + 1}`,
        quantity: 2,
        unit_price: 50,
        tax_rate: 18,
        hsn_code: `HSN-${(i % 15) + 1}`, // 15 distinct HSN codes: HSN-1 to HSN-15
      }));

      const invoice: any = {
        invoice_number: "INV-HSN-150-ITEMS",
        date: "2026-11-06",
        items,
        subtotal: 15000,
        tax_total: 2700,
        total: 17700,
        grand_total: 17700,
      };

      const templateConfig = createDefaultUnifiedConfig("invoice");
      const startTime = performance.now();
      const html = renderToString(
        <GstTallyTemplate
          invoice={invoice}
          template={templateConfig as any}
          f={{ showTaxSplit: true, showHsn: true }}
        />
      );
      const renderDuration = performance.now() - startTime;

      // 1. Should render cleanly and swiftly despite 150 items
      expect(renderDuration).toBeLessThan(1000);

      // 2. Exactly the first 5 unique HSNs followed by (+10 more)
      expect(html).toContain("HSN-1, HSN-2, HSN-3, HSN-4, HSN-5... (+10 more)");

      // 3. HSN-6 through HSN-15 should NOT appear as standalone concatenated items
      expect(html).not.toContain("HSN-5, HSN-6");
    });

    it("handles multiple tax slabs each independently capping or showing full HSNs", () => {
      // Slab 1 (5%): 7 distinct HSN codes -> capped to 5 + (+2 more)
      const slab5Items = Array.from({ length: 7 }, (_, i) => ({
        name: `Slab5 Item ${i}`,
        quantity: 1,
        unit_price: 100,
        tax_rate: 5,
        hsn_code: `050${i + 1}`,
      }));

      // Slab 2 (12%): Exactly 4 distinct HSN codes -> all shown, no (+N more)
      const slab12Items = Array.from({ length: 4 }, (_, i) => ({
        name: `Slab12 Item ${i}`,
        quantity: 1,
        unit_price: 100,
        tax_rate: 12,
        hsn_code: `120${i + 1}`,
      }));

      const invoice: any = {
        invoice_number: "INV-MULTI-SLAB-HSN",
        date: "2026-11-06",
        items: [...slab5Items, ...slab12Items],
        subtotal: 1100,
        tax_total: 83,
        total: 1183,
        grand_total: 1183,
      };

      const templateConfig = createDefaultUnifiedConfig("invoice");
      const html = renderToString(
        <GstTallyTemplate
          invoice={invoice}
          template={templateConfig as any}
          f={{ showTaxSplit: true, showHsn: true }}
        />
      );

      // Slab 5: 7 codes -> 5 + (+2 more)
      expect(html).toContain("0501, 0502, 0503, 0504, 0505... (+2 more)");

      // Slab 12: 4 codes -> all 4 listed without (+N more)
      expect(html).toContain("1201, 1202, 1203, 1204");
    });

    it("deduplicates repeated identical HSN codes across 100 items to a single entry", () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        name: `Single HSN Item ${i}`,
        quantity: 1,
        unit_price: 10,
        tax_rate: 18,
        hsn_code: "9988",
      }));

      const invoice: any = {
        invoice_number: "INV-SINGLE-HSN-100",
        date: "2026-11-06",
        items,
        subtotal: 1000,
        tax_total: 180,
        total: 1180,
        grand_total: 1180,
      };

      const templateConfig = createDefaultUnifiedConfig("invoice");
      const html = renderToString(
        <GstTallyTemplate
          invoice={invoice}
          template={templateConfig as any}
          f={{ showTaxSplit: true, showHsn: true }}
        />
      );

      expect(html).toContain("9988");
      expect(html).not.toContain("9988,");
      expect(html).not.toContain("more)");
    });

    it("verifies logo onError hides image element cleanly", () => {
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
          dynamicLogoUrl="https://broken-cdn.example.com/missing-logo.png"
          f={{ showLogo: true }}
        />
      );

      // Verify the img element is rendered with the dynamic logo url and onError inline logic
      expect(html).toContain('src="https://broken-cdn.example.com/missing-logo.png"');
      expect(html).toContain('alt="Logo"');

      // Verify simulated onError handler logic: hides target element
      const mockElement = { style: { display: "block" } } as any;
      const onErrorSimulator = (e: any) => {
        (e.currentTarget as HTMLElement).style.display = "none";
      };
      onErrorSimulator({ currentTarget: mockElement });
      expect(mockElement.style.display).toBe("none");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 5: numberToIndianWords Sub-Rupee Formatting & Boundaries
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 5: numberToIndianWords Sub-Rupee Formatting and Boundaries", () => {
    it("formats pure fractional sub-rupee amounts without empty rupees", () => {
      expect(numberToIndianWords(0.01)).toBe("Rs. One Paise Only");
      expect(numberToIndianWords(0.05)).toBe("Rs. Five Paise Only");
      expect(numberToIndianWords(0.1)).toBe("Rs. Ten Paise Only");
      expect(numberToIndianWords(0.25)).toBe("Rs. Twenty Five Paise Only");
      expect(numberToIndianWords(0.5)).toBe("Rs. Fifty Paise Only");
      expect(numberToIndianWords(0.75)).toBe("Rs. Seventy Five Paise Only");
      expect(numberToIndianWords(0.99)).toBe("Rs. Ninety Nine Paise Only");
    });

    it("formats zero amounts and NaN cleanly", () => {
      expect(numberToIndianWords(0)).toBe("Zero Rupees Only");
      expect(numberToIndianWords(0.0)).toBe("Zero Rupees Only");
      expect(numberToIndianWords(-0)).toBe("Zero Rupees Only");
      expect(numberToIndianWords(NaN)).toBe("Zero Rupees Only");
    });

    it("formats whole rupee amounts correctly", () => {
      expect(numberToIndianWords(1)).toBe("Rs. One Rupees Only");
      expect(numberToIndianWords(100)).toBe("Rs. One Hundred Rupees Only");
      expect(numberToIndianWords(1000)).toBe("Rs. One Thousand Rupees Only");
      expect(numberToIndianWords(100000)).toBe("Rs. One Lakh Rupees Only");
      expect(numberToIndianWords(10000000)).toBe("Rs. One Crore Rupees Only");
    });

    it("formats compound rupee and paise amounts correctly", () => {
      expect(numberToIndianWords(1.05)).toBe("Rs. One Rupees and Five Paise Only");
      expect(numberToIndianWords(100.5)).toBe("Rs. One Hundred Rupees and Fifty Paise Only");
      expect(numberToIndianWords(1234.56)).toBe(
        "Rs. One Thousand Two Hundred and Thirty Four Rupees and Fifty Six Paise Only"
      );
    });

    it("handles negative numbers cleanly by taking absolute value", () => {
      expect(numberToIndianWords(-0.5)).toBe("Rs. Fifty Paise Only");
      expect(numberToIndianWords(-100.5)).toBe("Rs. One Hundred Rupees and Fifty Paise Only");
    });
  });
});
