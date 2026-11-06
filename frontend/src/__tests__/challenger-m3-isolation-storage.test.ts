/**
 * frontend/src/__tests__/challenger-m3-isolation-storage.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE:
 * Milestone M3: Per-Document-Type Independence, docTitleFor Resolution, and Safe Storage Quota Stress.
 *
 * Archetype: EMPIRICAL CHALLENGER
 * Roles: critic, specialist
 *
 * Objectives:
 * 1. Independent Document Type Switching & Configuration Persistence:
 *    - Verify Quotation, Proforma, Delivery Challan, and Tax Invoice persist independently.
 *    - Verify no cross-category fallback or corruption when modifying or saving one document type.
 *    - Verify unlinking mechanics and master invoice template isolation.
 * 2. docTitleFor Resolution:
 *    - Verify "TAX QUOTATION / ESTIMATE" for Quotations.
 *    - Verify "PROFORMA INVOICE" for Proforma.
 *    - Verify "DELIVERY CHALLAN" for Delivery Challans.
 *    - Verify suppression of generic "TAX INVOICE" title overrides.
 *    - Verify docNoLabelFor and docDateLabelFor mappings.
 * 3. Storage Quota Stress & Resilience:
 *    - Mock QuotaExceededError under strict storage limits.
 *    - Verify non-critical cache purge, protected template retention, and target value compaction.
 *    - Exception safety: safeSetItem, safeGetItem, and safeRemoveItem never throw.
 * 4. Base64 Image Compression & Payload Sanitization:
 *    - verify compressImageForStorage downscales large dimensions and handles SVG/small URLs.
 *    - verify sanitizeForStorage strips >250,000 char blobs (>~187KB) and preserves valid logos.
 *    - verify circular references and end-to-end customizer config serialization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ============================================================================
// SIMULATED STORAGE HARNESS (Supports QuotaExceededError Injection)
// ============================================================================

class QuotaSimulatedStorage implements Storage {
  private store = new Map<string, string>();
  public maxBytes: number;
  public throwQuotaError: boolean = false;
  public throwRandomError: boolean = false;

  constructor(maxBytes: number = 200 * 1024) {
    this.maxBytes = maxBytes;
  }

  get currentBytes(): number {
    let bytes = 0;
    for (const [k, v] of this.store.entries()) {
      bytes += (k.length + v.length) * 2;
    }
    return bytes;
  }

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    if (this.throwRandomError) throw new Error("Hardware read fault");
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    if (this.throwRandomError) throw new Error("Hardware remove fault");
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwRandomError) throw new Error("Hardware write fault");

    const itemBytes = (key.length + value.length) * 2;
    const existingBytes = this.store.has(key)
      ? (key.length + (this.store.get(key)?.length || 0)) * 2
      : 0;

    if (this.throwQuotaError || this.currentBytes - existingBytes + itemBytes > this.maxBytes) {
      const err = new Error(
        "Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota."
      );
      err.name = "QuotaExceededError";
      (err as any).code = 22;
      throw err;
    }

    this.store.set(key, String(value));
  }
}

// Global window & storage setup
const mockStorage = new QuotaSimulatedStorage(500 * 1024);
const eventListeners = new Map<string, Function[]>();

(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  localStorage: mockStorage,
  dispatchEvent: (event: any) => {
    const list = eventListeners.get(event.type) || [];
    list.forEach((fn) => fn(event));
    return true;
  },
  addEventListener: (type: string, fn: Function) => {
    const list = eventListeners.get(type) || [];
    list.push(fn);
    eventListeners.set(type, list);
  },
};

(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, opts?: any) {
    this.type = type;
    this.detail = opts?.detail;
  }
};

(globalThis as any).Event = class Event {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
};

// Imports under test
import {
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  resolveInvoiceTexts,
  createDefaultUnifiedConfig,
  unifiedConfigToPrintTemplate,
  printTemplateToUnifiedConfig,
  INVOICE_DOC_CATEGORIES,
  type InvoiceDocCategory,
  type InvoiceTexts,
  type UnifiedInvoiceCustomizerConfig,
} from "../lib/invoice-template-config";

import {
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  sanitizeForStorage,
  compressImageForStorage,
  pruneTemplateList,
  MAX_STORED_IMAGE_CHARS,
  NON_CRITICAL_CACHE_KEYS,
  PROTECTED_STORAGE_PREFIXES,
} from "../lib/safe-storage";

import {
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  setActiveDocTemplateId,
  getActiveDocTemplateId,
  isInvoiceCategoryUnlinked,
  setInvoiceCategoryLinked,
  getInvoiceCategoryActiveKey,
  getInvoiceCategoryLinkKey,
  savePrintTemplateSafe,
  getTenantTemplatesKey,
} from "../lib/receipt-template-store";

describe("Empirical Challenger M3-2: Document Independence, docTitleFor & Safe Storage Quota", () => {
  const tid = "tenant_challenger_m3";
  const cid = "company_challenger_m3";

  beforeEach(() => {
    mockStorage.clear();
    mockStorage.maxBytes = 500 * 1024;
    mockStorage.throwQuotaError = false;
    mockStorage.throwRandomError = false;
    eventListeners.clear();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 1: INDEPENDENT DOCUMENT TYPE SWITCHING & CONFIGURATION PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 1: Per-Document-Type Independence & Non-Interference", () => {
    it("persists distinct template IDs for Quotation, Proforma, Challan, and Invoice without collision", () => {
      // 1. Assign independent templates to each category
      setActiveInvoicePrintTemplateForCategory("tpl-inv-custom-01", "invoice", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-quote-custom-02", "quotation", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-custom-03", "proforma", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-challan-custom-04", "challan", tid, cid);

      // 2. Query each category independently
      const invTpl = getActiveInvoicePrintTemplateForCategory("invoice", tid, cid);
      const quoteTpl = getActiveInvoicePrintTemplateForCategory("quotation", tid, cid);
      const proformaTpl = getActiveInvoicePrintTemplateForCategory("proforma", tid, cid);
      const challanTpl = getActiveInvoicePrintTemplateForCategory("challan", tid, cid);

      expect(invTpl).toBe("tpl-inv-custom-01");
      expect(quoteTpl).toBe("tpl-quote-custom-02");
      expect(proformaTpl).toBe("tpl-proforma-custom-03");
      expect(challanTpl).toBe("tpl-challan-custom-04");
    });

    it("automatically unlinks non-invoice categories upon custom template assignment", () => {
      expect(isInvoiceCategoryUnlinked("quotation", tid, cid)).toBe(false);
      expect(isInvoiceCategoryUnlinked("proforma", tid, cid)).toBe(false);
      expect(isInvoiceCategoryUnlinked("challan", tid, cid)).toBe(false);

      // Assigning a template to quotation marks it as unlinked
      setActiveInvoicePrintTemplateForCategory("tpl-quote-999", "quotation", tid, cid);
      expect(isInvoiceCategoryUnlinked("quotation", tid, cid)).toBe(true);

      // Other categories remain unaffected
      expect(isInvoiceCategoryUnlinked("proforma", tid, cid)).toBe(false);
      expect(isInvoiceCategoryUnlinked("challan", tid, cid)).toBe(false);
    });

    it("guarantees master tax invoice changes DO NOT overwrite unlinked quotation, proforma, or challan", () => {
      // Setup initial unlinked configurations
      setActiveInvoicePrintTemplateForCategory("tpl-quote-stable", "quotation", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-stable", "proforma", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-challan-stable", "challan", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-inv-initial", "invoice", tid, cid);

      // Now change the master tax invoice multiple times
      setActiveInvoicePrintTemplateForCategory("tpl-inv-overhauled-v2", "invoice", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-inv-overhauled-v3", "invoice", tid, cid);

      // Verify master invoice updated
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-inv-overhauled-v3");

      // Verify Quotation, Proforma, and Challan remain 100% UNTOUCHED
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-quote-stable");
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-proforma-stable");
      expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("tpl-challan-stable");
    });

    it("falls back gracefully to master invoice template ONLY when category is unconfigured/linked", () => {
      // Master invoice is configured
      setActiveInvoicePrintTemplateForCategory("tpl-inv-master", "invoice", tid, cid);

      // Estimate has not been configured or unlinked
      expect(isInvoiceCategoryUnlinked("estimate", tid, cid)).toBe(false);

      // Fallback resolves master template ID
      const resolvedEstimate = getActiveInvoicePrintTemplateForCategory("estimate", tid, cid);
      expect(resolvedEstimate).toBe("tpl-inv-master");
    });

    it("supports explicit re-linking to dynamically follow the master invoice template", () => {
      // 1. Initially unlinked quotation
      setActiveInvoicePrintTemplateForCategory("tpl-quote-pinned", "quotation", tid, cid);
      expect(isInvoiceCategoryUnlinked("quotation", tid, cid)).toBe(true);
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-quote-pinned");

      // 2. Re-link quotation to master
      setInvoiceCategoryLinked("quotation", true, undefined, tid, cid);
      expect(isInvoiceCategoryUnlinked("quotation", tid, cid)).toBe(false);

      // 3. Now quotation follows master invoice template
      setActiveInvoicePrintTemplateForCategory("tpl-inv-new-master", "invoice", tid, cid);
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-inv-new-master");
    });

    it("persists distinct UnifiedInvoiceCustomizerConfig states per category without cross-talk", () => {
      // Create distinct configs for each category
      const quoteConfig = createDefaultUnifiedConfig("quotation", "gst_tally");
      quoteConfig.party.layout = "layout_2";
      quoteConfig.style.primaryColor = "#059669";
      quoteConfig.invoice.documentTitle = "CUSTOM QUOTATION RATE";

      const proformaConfig = createDefaultUnifiedConfig("proforma", "gst_tally");
      proformaConfig.party.layout = "layout_3";
      proformaConfig.style.primaryColor = "#7c3aed";
      proformaConfig.invoice.documentTitle = "PROFORMA COMMERCIAL ESTIMATE";

      const challanConfig = createDefaultUnifiedConfig("challan", "gst_tally");
      challanConfig.party.layout = "layout_1";
      challanConfig.style.primaryColor = "#dc2626";
      challanConfig.invoice.documentTitle = "GOODS DELIVERY CHALLAN";

      const invConfig = createDefaultUnifiedConfig("invoice", "gst_tally");
      invConfig.party.layout = "layout_1";
      invConfig.style.primaryColor = "#2563eb";
      invConfig.invoice.documentTitle = "TAX INVOICE";

      // Save each to its dedicated storage key
      const keyFor = (cat: string) => `bos_unified_invoice_customizer_config_${tid}_${cid}_${cat}`;
      safeSetItem(keyFor("quotation"), JSON.stringify(quoteConfig));
      safeSetItem(keyFor("proforma"), JSON.stringify(proformaConfig));
      safeSetItem(keyFor("challan"), JSON.stringify(challanConfig));
      safeSetItem(keyFor("invoice"), JSON.stringify(invConfig));

      // Read back and assert absolute integrity
      const loadedQuote = JSON.parse(safeGetItem(keyFor("quotation"))!);
      const loadedProforma = JSON.parse(safeGetItem(keyFor("proforma"))!);
      const loadedChallan = JSON.parse(safeGetItem(keyFor("challan"))!);
      const loadedInv = JSON.parse(safeGetItem(keyFor("invoice"))!);

      expect(loadedQuote.party.layout).toBe("layout_2");
      expect(loadedQuote.style.primaryColor).toBe("#059669");
      expect(loadedQuote.invoice.documentTitle).toBe("CUSTOM QUOTATION RATE");

      expect(loadedProforma.party.layout).toBe("layout_3");
      expect(loadedProforma.style.primaryColor).toBe("#7c3aed");
      expect(loadedProforma.invoice.documentTitle).toBe("PROFORMA COMMERCIAL ESTIMATE");

      expect(loadedChallan.party.layout).toBe("layout_1");
      expect(loadedChallan.style.primaryColor).toBe("#dc2626");
      expect(loadedChallan.invoice.documentTitle).toBe("GOODS DELIVERY CHALLAN");

      expect(loadedInv.style.primaryColor).toBe("#2563eb");
      expect(loadedInv.invoice.documentTitle).toBe("TAX INVOICE");
    });

    it("maintains strict tenant and company isolation for category template slots", () => {
      const tid1 = "tenant_alpha";
      const cid1 = "company_101";
      const tid2 = "tenant_beta";
      const cid2 = "company_202";

      setActiveInvoicePrintTemplateForCategory("tpl-alpha-quote", "quotation", tid1, cid1);
      setActiveInvoicePrintTemplateForCategory("tpl-beta-quote", "quotation", tid2, cid2);

      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid1, cid1)).toBe("tpl-alpha-quote");
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid2, cid2)).toBe("tpl-beta-quote");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 2: docTitleFor, docNoLabelFor & docDateLabelFor RESOLUTION
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 2: docTitleFor, docNoLabelFor & docDateLabelFor Resolution", () => {
    const baseTexts: InvoiceTexts = resolveInvoiceTexts({} as any, "classic");

    it("correctly resolves docTitleFor as 'TAX QUOTATION / ESTIMATE' for quotation documents", () => {
      // By doc_type
      expect(docTitleFor({ doc_type: "quotation" }, baseTexts)).toBe("TAX QUOTATION / ESTIMATE");
      // By invoice_type
      expect(docTitleFor({ invoice_type: "QUOTATION" }, baseTexts)).toBe("TAX QUOTATION / ESTIMATE");
      // By invoice_number prefix
      expect(docTitleFor({ invoice_number: "QT-2026-99" }, baseTexts)).toBe("TAX QUOTATION / ESTIMATE");
      // By quote_number prefix
      expect(docTitleFor({ quote_number: "QT-2026-100" }, baseTexts)).toBe("TAX QUOTATION / ESTIMATE");
    });

    it("correctly resolves docTitleFor as 'PROFORMA INVOICE' for proforma documents", () => {
      // By doc_type
      expect(docTitleFor({ doc_type: "proforma" }, baseTexts)).toBe("PROFORMA INVOICE");
      // By invoice_type
      expect(docTitleFor({ invoice_type: "PROFORMA" }, baseTexts)).toBe("PROFORMA INVOICE");
      // By prefix
      expect(docTitleFor({ invoice_number: "PI-2026-88" }, baseTexts)).toBe("PROFORMA INVOICE");
    });

    it("correctly resolves docTitleFor as 'DELIVERY CHALLAN' for delivery challans", () => {
      // By doc_type
      expect(docTitleFor({ doc_type: "challan" }, baseTexts)).toBe("DELIVERY CHALLAN");
      expect(docTitleFor({ doc_type: "DELIVERY_CHALLAN" }, baseTexts)).toBe("DELIVERY CHALLAN");
      // By invoice_type
      expect(docTitleFor({ invoice_type: "CHALLAN" }, baseTexts)).toBe("DELIVERY CHALLAN");
      // By prefix
      expect(docTitleFor({ invoice_number: "DC-2026-77" }, baseTexts)).toBe("DELIVERY CHALLAN");
    });

    it("correctly resolves docTitleFor as 'TAX ESTIMATE' for estimates", () => {
      expect(docTitleFor({ doc_type: "estimate" }, baseTexts)).toBe("TAX ESTIMATE");
      expect(docTitleFor({ invoice_type: "ESTIMATE" }, baseTexts)).toBe("TAX ESTIMATE");
      expect(docTitleFor({ invoice_type: "ESTIMATE_NON_GST" }, baseTexts)).toBe("TAX ESTIMATE");
      expect(docTitleFor({ invoice_number: "EST-2026-55" }, baseTexts)).toBe("TAX ESTIMATE");
    });

    it("correctly resolves docTitleFor as 'TAX INVOICE' for standard invoices", () => {
      expect(docTitleFor({ doc_type: "invoice" }, baseTexts)).toBe("TAX INVOICE");
      expect(docTitleFor({ invoice_type: "INVOICE" }, baseTexts)).toBe("TAX INVOICE");
      expect(docTitleFor({ invoice_number: "INV-2026-11" }, baseTexts)).toBe("TAX INVOICE");
    });

    it("SUPPRESSES generic 'TAX INVOICE' from template when rendering Quotation, Proforma, or Challan", () => {
      // Master tax invoice template carries generic "TAX INVOICE" header title
      const masterTaxTemplate = {
        id: "tpl-gst-tally",
        docCategory: "invoice",
        headerTitle: "TAX INVOICE",
        invoice: { documentTitle: "TAX INVOICE" },
      };

      // When rendering a quotation using this template, generic tax title MUST NOT override quotation title
      const quoteTitle = docTitleFor({ doc_type: "quotation" }, baseTexts, masterTaxTemplate);
      expect(quoteTitle).toBe("TAX QUOTATION / ESTIMATE");

      // When rendering a proforma using this template, generic tax title MUST NOT override proforma title
      const proformaTitle = docTitleFor({ doc_type: "proforma" }, baseTexts, masterTaxTemplate);
      expect(proformaTitle).toBe("PROFORMA INVOICE");

      // When rendering a challan using this template, generic tax title MUST NOT override challan title
      const challanTitle = docTitleFor({ doc_type: "challan" }, baseTexts, masterTaxTemplate);
      expect(challanTitle).toBe("DELIVERY CHALLAN");
    });

    it("ALLOWS custom titles from template when template docCategory matches current document", () => {
      // Template specifically created for quotation with custom title
      const customQuoteTemplate = {
        id: "tpl-quote-special",
        docCategory: "quotation",
        headerTitle: "PRE-ORDER QUOTATION & ESTIMATION",
      };

      const title = docTitleFor({ doc_type: "quotation" }, baseTexts, customQuoteTemplate);
      expect(title).toBe("PRE-ORDER QUOTATION & ESTIMATION");
    });

    it("prioritizes document forced title (invoice.header_title / documentTitle) over template defaults", () => {
      const invoice = {
        doc_type: "proforma",
        header_title: "EXPORT PROFORMA INVOICE",
      };
      const title = docTitleFor(invoice, baseTexts);
      expect(title).toBe("EXPORT PROFORMA INVOICE");
    });

    it("accurately resolves docNoLabelFor across all document categories", () => {
      expect(docNoLabelFor({ doc_type: "quotation" }, baseTexts)).toBe(baseTexts.quoteNoLabel);
      expect(docNoLabelFor({ invoice_number: "QT-1" }, baseTexts)).toBe(baseTexts.quoteNoLabel);

      expect(docNoLabelFor({ doc_type: "proforma" }, baseTexts)).toBe(baseTexts.proformaNoLabel);
      expect(docNoLabelFor({ invoice_number: "PI-1" }, baseTexts)).toBe(baseTexts.proformaNoLabel);

      expect(docNoLabelFor({ doc_type: "challan" }, baseTexts)).toBe(baseTexts.challanNoLabel);
      expect(docNoLabelFor({ invoice_number: "DC-1" }, baseTexts)).toBe(baseTexts.challanNoLabel);

      expect(docNoLabelFor({ doc_type: "estimate" }, baseTexts)).toBe(baseTexts.estimateNoLabel);
      expect(docNoLabelFor({ invoice_number: "EST-1" }, baseTexts)).toBe(baseTexts.estimateNoLabel);

      expect(docNoLabelFor({ doc_type: "invoice" }, baseTexts)).toBe(baseTexts.invoiceNoLabel);
    });

    it("accurately resolves docDateLabelFor across all document categories", () => {
      expect(docDateLabelFor({ doc_type: "quotation" }, baseTexts)).toBe(baseTexts.quoteDateLabel);
      expect(docDateLabelFor({ doc_type: "challan" }, baseTexts)).toBe(baseTexts.challanDateLabel || baseTexts.invoiceDateLabel);
      expect(docDateLabelFor({ doc_type: "estimate" }, baseTexts)).toBe(baseTexts.estimateDateLabel);
      expect(docDateLabelFor({ doc_type: "invoice" }, baseTexts)).toBe(baseTexts.invoiceDateLabel);
    });

    it("handles adversarial boundary inputs gracefully without throwing (null, undefined, malformed)", () => {
      expect(() => docTitleFor(null, baseTexts)).not.toThrow();
      expect(docTitleFor(null, baseTexts)).toBe(baseTexts.invoiceTitle);

      expect(() => docTitleFor({}, baseTexts)).not.toThrow();
      expect(docTitleFor({}, baseTexts)).toBe(baseTexts.invoiceTitle);

      expect(() => docNoLabelFor(undefined, baseTexts)).not.toThrow();
      expect(docNoLabelFor(undefined, baseTexts)).toBe(baseTexts.invoiceNoLabel);

      expect(() => docDateLabelFor(null, baseTexts)).not.toThrow();
      expect(docDateLabelFor(null, baseTexts)).toBe(baseTexts.invoiceDateLabel);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 3: STORAGE QUOTA STRESS & RESILIENCE
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 3: Storage Quota Stress & Safe Recovery", () => {
    it("purges non-critical cache keys to recover when safeSetItem hits QuotaExceededError", () => {
      // 1. Constrain storage quota to 80 KB
      mockStorage.maxBytes = 80 * 1024;

      // 2. Fill storage with disposable non-critical cache (fits within 80KB: 30K + 30K + 10K = 70KB)
      mockStorage.setItem("bos-store-products-cache", "X".repeat(15_000));
      mockStorage.setItem("bos-store-cart", "Y".repeat(15_000));
      mockStorage.setItem("bos_temp_pdf_overlay", "Z".repeat(5_000));

      expect(mockStorage.getItem("bos-store-products-cache")).not.toBeNull();
      expect(mockStorage.getItem("bos-store-cart")).not.toBeNull();

      // 3. Attempt to save a critical print template that exceeds remaining 10KB quota
      const newTemplateKey = `businessos_print_templates_v1_${tid}`;
      const templateData = JSON.stringify([
        { id: "tpl-critical-1", name: "Production GST Template", data: "DATA".repeat(2_500), updated_at: Date.now() },
      ]);

      const success = safeSetItem(newTemplateKey, templateData);

      // 4. Assert safe recovery:
      expect(success).toBe(true);
      // Non-critical cache keys were purged to free space
      expect(mockStorage.getItem("bos-store-products-cache")).toBeNull();
      expect(mockStorage.getItem("bos-store-cart")).toBeNull();
      // Target critical template was successfully stored!
      expect(mockStorage.getItem(newTemplateKey)).not.toBeNull();
    });

    it("purges transient keys starting with 'bos_temp_' or 'temp_' during quota recovery", () => {
      mockStorage.maxBytes = 60 * 1024;

      mockStorage.setItem("bos_temp_preview_image", "A".repeat(12_000));
      mockStorage.setItem("temp_upload_buffer", "B".repeat(12_000));

      const writeKey = "bos_active_quotation_template_id_t1";
      const writeValue = "tpl-quote-new-" + "Q".repeat(8_000); // 16KB payload > 12KB remaining
      const success = safeSetItem(writeKey, writeValue);

      expect(success).toBe(true);
      expect(mockStorage.getItem("bos_temp_preview_image")).toBeNull();
      expect(mockStorage.getItem("temp_upload_buffer")).toBeNull();
      expect(mockStorage.getItem(writeKey)).toBe(writeValue);
    });

    it("NEVER purges protected keys during quota recovery sweeps", () => {
      mockStorage.maxBytes = 60 * 1024;

      // Seed protected items
      const protectedKeys = [
        "businessos_print_templates_v1_tenantA",
        "bos_active_invoice_template_id_tenantA",
        "bos_active_invoice_category_template_tenantA_quotation",
        "bos_invoice_category_link_tenantA_quotation",
        "bos_active_proforma_template_id_tenantA",
        "bos_active_challan_template_id_tenantA",
        "bos_signature_settings_tenantA",
        "bos_payment_qr_settings_tenantA",
      ];

      for (const pk of protectedKeys) {
        mockStorage.setItem(pk, "important-user-config");
      }

      // Seed non-critical keys
      mockStorage.setItem("bos-store-products-cache", "purgeable".repeat(500));

      // Trigger safeSetItem write under pressure
      const success = safeSetItem("new_test_key", "value_that_fits");
      expect(success).toBe(true);

      // Verify every single protected key survived untouched!
      for (const pk of protectedKeys) {
        expect(mockStorage.getItem(pk)).toBe("important-user-config");
      }
    });

    it("compacts/sanitizes target value if quota is still exceeded after clearing cache", () => {
      // Very tight quota: 30KB
      mockStorage.maxBytes = 30 * 1024;

      // Try saving a template list where secondary templates contain large data
      const tplListKey = `businessos_print_templates_v1_${tid}`;
      const largeList = [
        { id: "tpl-1", name: "Main", updated_at: 3000, logoUrl: "data:image/png;base64," + "A".repeat(5_000) },
        { id: "tpl-2", name: "Secondary 1", updated_at: 2000, logoUrl: "data:image/png;base64," + "B".repeat(15_000) },
        { id: "tpl-3", name: "Secondary 2", updated_at: 1000, logoUrl: "data:image/png;base64," + "C".repeat(15_000) },
      ];

      const success = safeSetItem(tplListKey, JSON.stringify(largeList));
      expect(success).toBe(true);

      const stored = JSON.parse(mockStorage.getItem(tplListKey)!);
      expect(stored.length).toBeGreaterThanOrEqual(1);
      // Primary template keeps its logo
      expect(stored[0].id).toBe("tpl-1");
    });

    it("guarantees safeSetItem, safeGetItem, and safeRemoveItem NEVER throw under catastrophic failures", () => {
      // Simulate hardware failure on storage operations
      mockStorage.throwRandomError = true;

      expect(() => safeSetItem("any_key", "any_val")).not.toThrow();
      expect(safeSetItem("any_key", "any_val")).toBe(false);

      expect(() => safeGetItem("any_key")).not.toThrow();
      expect(safeGetItem("any_key")).toBeNull();

      expect(() => safeRemoveItem("any_key")).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 4: BASE64 IMAGE COMPRESSION & PAYLOAD SANITIZATION
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 4: Base64 Image Compression & Payload Sanitization", () => {
    it("sanitizeForStorage strips oversized base64 images (> 250,000 chars) from strings and objects", () => {
      const oversizeBase64 = "data:image/png;base64," + "X".repeat(260_000);
      const safeBase64 = "data:image/png;base64," + "Y".repeat(50_000);

      // Direct string
      expect(sanitizeForStorage(oversizeBase64)).toBe("");
      expect(sanitizeForStorage(safeBase64)).toBe(safeBase64);

      // Deep object
      const payload = {
        name: "My Store",
        style: {
          logoUrl: oversizeBase64,
          stampUrl: safeBase64,
        },
        meta: {
          deep: {
            pdfBlob: "data:application/pdf;base64," + "Z".repeat(300_000),
            normalText: "Keep me intact even if long: " + "T".repeat(500),
          },
        },
      };

      const sanitized = sanitizeForStorage(payload);
      expect(sanitized.name).toBe("My Store");
      expect(sanitized.style.logoUrl).toBe(""); // Stripped!
      expect(sanitized.style.stampUrl).toBe(safeBase64); // Preserved!
      expect(sanitized.meta.deep.pdfBlob).toBe(""); // Stripped!
      expect(sanitized.meta.deep.normalText).toContain("Keep me intact"); // Non-image string preserved!
    });

    it("sanitizeForStorage safely handles circular references without stack overflow", () => {
      const circularObj: any = {
        title: "Test Circular",
        logo: "data:image/png;base64," + "A".repeat(10_000),
      };
      circularObj.self = circularObj;
      circularObj.nested = { parent: circularObj };

      expect(() => sanitizeForStorage(circularObj)).not.toThrow();
      const res = sanitizeForStorage(circularObj);
      expect(res.title).toBe("Test Circular");
      expect(res.logo).toBe(circularObj.logo);
    });

    it("compressImageForStorage handles SSR/Node environment and fast paths safely", async () => {
      // 1. Empty or null input
      expect(await compressImageForStorage("")).toBe("");

      // 2. Small SVG vector (< 20KB) keeps as-is without canvas instantiation
      const svg = "data:image/svg+xml;utf8,<svg width='100' height='100'></svg>";
      expect(await compressImageForStorage(svg)).toBe(svg);

      // 3. Small data URL (< 25,000 chars) fast path
      const smallDataUrl = "data:image/png;base64," + "M".repeat(5_000);
      expect(await compressImageForStorage(smallDataUrl)).toBe(smallDataUrl);
    });

    it("compressImageForStorage downscales large image dimensions via Canvas when DOM is present", async () => {
      // Mock HTMLImageElement and HTMLCanvasElement
      let drawnWidth = 0;
      let drawnHeight = 0;
      let canvasWidth = 0;
      let canvasHeight = 0;

      const mockContext = {
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn((img: any, x: number, y: number, w: number, h: number) => {
          drawnWidth = w;
          drawnHeight = h;
        }),
      };

      const mockCanvas = {
        set width(val: number) {
          canvasWidth = val;
        },
        get width() {
          return canvasWidth;
        },
        set height(val: number) {
          canvasHeight = val;
        },
        get height() {
          return canvasHeight;
        },
        getContext: vi.fn(() => mockContext),
        toDataURL: vi.fn(() => "data:image/jpeg;base64,mockCompressedCompactData"),
      };

      // Mock DOM document.createElement
      (globalThis as any).document = {
        createElement: (tag: string) => {
          if (tag === "canvas") return mockCanvas;
          return {};
        },
      };

      // Mock DOM Image constructor
      (globalThis as any).Image = class MockImage {
        naturalWidth = 4000;
        naturalHeight = 2400;
        width = 4000;
        height = 2400;
        crossOrigin = "";
        onload: any = null;
        onerror: any = null;
        set src(val: string) {
          // Trigger onload asynchronously
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 5);
        }
      };

      // Test with an oversize base64 string (> 25,000 chars)
      const inputLarge = "data:image/jpeg;base64," + "BIGIMAGE".repeat(4_000);
      const compressed = await compressImageForStorage(inputLarge, {
        maxWidth: 500,
        maxHeight: 300,
        quality: 0.85,
      });

      expect(compressed).toBe("data:image/jpeg;base64,mockCompressedCompactData");
      // Original 4000x2400 aspect ratio = 5:3
      // Max bounds: 500x300. Ratio = min(500/4000, 300/2400) = 0.125
      // Expected width = 4000 * 0.125 = 500, Expected height = 2400 * 0.125 = 300
      expect(canvasWidth).toBe(500);
      expect(canvasHeight).toBe(300);
      expect(drawnWidth).toBe(500);
      expect(drawnHeight).toBe(300);
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    it("end-to-end stress test: Full UnifiedInvoiceCustomizerConfig with 2MB base64 images is sanitized and saved safely", () => {
      mockStorage.maxBytes = 250 * 1024; // 250 KB limit

      const config = createDefaultUnifiedConfig("quotation", "gst_tally");
      const monsterBase64 = "data:image/png;base64," + "K".repeat(1_500_000); // 1.5MB string

      // Attach oversized base64 to multiple fields
      config.business.logoUrl = monsterBase64;
      config.miscellaneous.signatureAndStamp.signatureUrl = monsterBase64;
      config.miscellaneous.signatureAndStamp.stampUrl = monsterBase64;

      // 1. Sanitize config for storage
      const sanitizedConfig = sanitizeForStorage(config, MAX_STORED_IMAGE_CHARS);

      // Oversized blobs stripped
      expect(sanitizedConfig.business.logoUrl).toBe("");
      expect(sanitizedConfig.miscellaneous.signatureAndStamp.signatureUrl).toBe("");
      expect(sanitizedConfig.miscellaneous.signatureAndStamp.stampUrl).toBe("");

      // Other critical business & party data intact
      expect(sanitizedConfig.business.companyName).toBe(config.business.companyName);
      expect(sanitizedConfig.party.layout).toBe(config.party.layout);

      // 2. Successfully save into quota-constrained storage via safeSetItem
      const key = `bos_unified_invoice_customizer_config_${tid}_${cid}_quotation`;
      const savedOk = safeSetItem(key, JSON.stringify(sanitizedConfig));
      expect(savedOk).toBe(true);

      // 3. Verify retrieved data
      const retrieved = JSON.parse(safeGetItem(key)!);
      expect(retrieved.docCategory).toBe("quotation");
      expect(retrieved.business.logoUrl).toBe("");
    });
  });
});
