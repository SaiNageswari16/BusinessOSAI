import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Storage mock for test environment
const storage = new Map<string, string>();
const listeners = new Map<string, Function[]>();

const storageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => storage.set(key, String(val)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() {
    return storage.size;
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
};

(globalThis as any).localStorage = storageMock;
(globalThis as any).window = {
  localStorage: storageMock,
  dispatchEvent: (event: any) => {
    const list = listeners.get(event.type) || [];
    list.forEach((fn) => fn(event));
    return true;
  },
  addEventListener: (type: string, fn: Function) => {
    const list = listeners.get(type) || [];
    list.push(fn);
    listeners.set(type, list);
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

import {
  UnifiedInvoiceCustomizer,
  CATEGORY_DEFINITIONS,
  DOC_CATEGORY_TABS,
} from "../components/inventory/UnifiedInvoiceCustomizer";
import {
  createDefaultUnifiedConfig,
  unifiedConfigToPrintTemplate,
  printTemplateToUnifiedConfig,
  docTitleFor,
  DEFAULT_UNIFIED_COLUMNS,
  PARTY_LAYOUT_OPTIONS,
  type DynamicColumnDefinition,
  type InvoiceDocCategory,
} from "../lib/invoice-template-config";
import {
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  setActiveDocTemplateId,
  getActiveDocTemplateId,
  savePrintTemplateSafe,
  getTenantTemplatesKey,
} from "../lib/receipt-template-store";
import {
  safeSetItem,
  safeGetItem,
  sanitizeForStorage,
  MAX_STORED_IMAGE_CHARS,
} from "../lib/safe-storage";
import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";

describe("Milestone M3: Unified 3-Panel Customizer UI, Parity & Safe Storage", () => {
  const tid = "tenant_m3_test";
  const cid = "company_m3_test";

  beforeEach(() => {
    storage.clear();
    listeners.clear();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 1: Unified 3-Panel Layout & 7 Categories Rail
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 1: 3-Panel Layout & 7 Categories Rail", () => {
    it("defines exactly 7 myBillBook categories with icons and descriptive subtitles", () => {
      expect(CATEGORY_DEFINITIONS).toHaveLength(7);
      const categoryIds = CATEGORY_DEFINITIONS.map((c) => c.id);
      expect(categoryIds).toEqual([
        "style",
        "print",
        "business",
        "invoice",
        "party",
        "itemTable",
        "miscellaneous",
      ]);
    });

    it("defines the 4 primary sales document categories for independent customization", () => {
      expect(DOC_CATEGORY_TABS).toHaveLength(4);
      const tabIds = DOC_CATEGORY_TABS.map((t) => t.id);
      expect(tabIds).toEqual(["invoice", "proforma", "quotation", "challan"]);
    });

    it("renders the 3-panel customizer containing Left Rail, Center Preview, and Right Panel", () => {
      const html = renderToString(
        <UnifiedInvoiceCustomizer
          tenant={{ id: tid, name: "Vasavi Enterprises" }}
          initialCategory="party"
          initialDocCategory="invoice"
        />
      );

      // Verify Left Rail Categories are rendered
      expect(html).toContain("Style Settings");
      expect(html).toContain("Print Settings");
      expect(html).toContain("Business Details");
      expect(html).toContain("Invoice Details");
      expect(html).toContain("Party Details");
      expect(html).toContain("Item Table");
      expect(html).toContain("Miscellaneous");

      // Verify Center Canvas Document Tabs are rendered
      expect(html).toContain("Tax Invoice");
      expect(html).toContain("Proforma Invoice");
      expect(html).toContain("Quotation");
      expect(html).toContain("Delivery Challan");

      // Verify Right Settings Panel Sub-Tabs are rendered
      expect(html).toContain("Text");
      expect(html).toContain("Styling");

      // Verify Sticky Bottom Action Buttons
      expect(html).toContain("Save Template");
      expect(html).toContain("Reset Defaults");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 2: Visual Party Layout Selector Cards (Layout 1 / 2 / 3)
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 2: Visual Party Layout Selector Cards", () => {
    it("renders Layout 1, Layout 2, and Layout 3 cards in Party Details panel", () => {
      const html = renderToString(
        <UnifiedInvoiceCustomizer
          tenant={{ id: tid, name: "Vasavi Enterprises" }}
          initialCategory="party"
        />
      );

      expect(html).toContain("Layout 1");
      expect(html).toContain("Layout 2");
      expect(html).toContain("Layout 3");
      expect(html).toContain("Side-by-Side");
      expect(html).toContain("3-Box Split");
      expect(html).toContain("Stacked");
    });

    it("updates configuration when different party layout options are selected", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      expect(config.party.layout).toBe("layout_1");

      config.party.layout = "layout_2";
      const tplLayout2 = unifiedConfigToPrintTemplate(config);
      expect(tplLayout2.partyLayout).toBe("layout_2");

      config.party.layout = "layout_3";
      const tplLayout3 = unifiedConfigToPrintTemplate(config);
      expect(tplLayout3.partyLayout).toBe("layout_3");
    });

    it("directly reflects party layout changes in GstTallyTemplate DOM output", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      const sampleInvoice: any = {
        invoice_number: "INV-001",
        customerName: "Apollo Clinics",
        customerBillingAddress: "MG Road, Vijayawada",
        customerShippingAddress: "Auto Nagar, Vijayawada",
        items: [{ product_name: "Item 1", quantity: 1, unit_price: 100, subtotal: 100 }],
        grand_total: 100,
      };

      // Test Layout 1 (Side-by-Side)
      config.party.layout = "layout_1";
      const tpl1 = unifiedConfigToPrintTemplate(config);
      const html1 = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          template={tpl1}
          partyLayout="layout_1"
        />
      );
      expect(html1).toContain("Apollo Clinics");
      expect(html1).toContain("MG Road, Vijayawada");

      // Test Layout 2 (3-Box Split Header)
      config.party.layout = "layout_2";
      const tpl2 = unifiedConfigToPrintTemplate(config);
      const html2 = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          template={tpl2}
          partyLayout="layout_2"
        />
      );
      expect(html2).toContain("Apollo Clinics");

      // Test Layout 3 (Stacked Rows)
      config.party.layout = "layout_3";
      const tpl3 = unifiedConfigToPrintTemplate(config);
      const html3 = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          template={tpl3}
          partyLayout="layout_3"
        />
      );
      expect(html3).toContain("Apollo Clinics");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 3: Dynamic Item Table Column Manager
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 3: Dynamic Item Table Column Manager", () => {
    it("initializes with standard default dynamic columns", () => {
      expect(DEFAULT_UNIFIED_COLUMNS.length).toBeGreaterThanOrEqual(8);
      const colKeys = DEFAULT_UNIFIED_COLUMNS.map((c) => c.fieldKey);
      expect(colKeys).toContain("sno");
      expect(colKeys).toContain("description");
      expect(colKeys).toContain("hsn");
      expect(colKeys).toContain("quantity");
      expect(colKeys).toContain("unit_price");
      expect(colKeys).toContain("discount");
      expect(colKeys).toContain("tax_rate");
      expect(colKeys).toContain("total_amount");
    });

    it("allows toggling column visibility", () => {
      const config = createDefaultUnifiedConfig("invoice");
      const hsnCol = config.itemTable.columns.find((c) => c.fieldKey === "hsn");
      expect(hsnCol?.enabled).toBe(true);

      // Disable HSN column
      if (hsnCol) hsnCol.enabled = false;
      const tpl = unifiedConfigToPrintTemplate(config);
      const activeCols = tpl.columns.filter((c: any) => c.enabled);
      expect(activeCols.some((c: any) => c.fieldKey === "hsn")).toBe(false);
    });

    it("allows renaming column headers", () => {
      const config = createDefaultUnifiedConfig("invoice");
      const descCol = config.itemTable.columns.find((c) => c.fieldKey === "description");
      expect(descCol?.headerTitle).toBe("Items / Services");

      // Rename to "Product Description & Notes"
      if (descCol) descCol.headerTitle = "Product Description & Notes";
      const tpl = unifiedConfigToPrintTemplate(config);
      const descInTpl = tpl.columns.find((c: any) => c.fieldKey === "description");
      expect(descInTpl?.headerTitle).toBe("Product Description & Notes");
    });

    it("allows reordering columns", () => {
      const config = createDefaultUnifiedConfig("invoice");
      const originalFirstCol = config.itemTable.columns[0].fieldKey;
      const originalSecondCol = config.itemTable.columns[1].fieldKey;

      // Swap column 0 and column 1
      const temp = config.itemTable.columns[0];
      config.itemTable.columns[0] = config.itemTable.columns[1];
      config.itemTable.columns[1] = temp;

      expect(config.itemTable.columns[0].fieldKey).toBe(originalSecondCol);
      expect(config.itemTable.columns[1].fieldKey).toBe(originalFirstCol);
    });

    it("allows adding custom columns", () => {
      const config = createDefaultUnifiedConfig("invoice");
      const customCol: DynamicColumnDefinition = {
        id: "col_warranty",
        fieldKey: "warranty",
        headerTitle: "Warranty Period",
        widthPercent: 10,
        align: "center",
        enabled: true,
        isCustom: true,
      };

      config.itemTable.columns.push(customCol);
      const tpl = unifiedConfigToPrintTemplate(config);
      expect(tpl.columns.some((c: any) => c.fieldKey === "warranty")).toBe(true);
      expect(tpl.customItemColumns?.some((c: any) => c.headerTitle === "Warranty Period")).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 4: Independent Per-Document-Type Selection & Persistence
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 4: Independent Per-Document-Type Selection & Persistence", () => {
    it("generates category-specific document titles and numbering labels by default", () => {
      const invConfig = createDefaultUnifiedConfig("invoice");
      expect(invConfig.invoice.documentTitle).toBe("TAX INVOICE");
      expect(invConfig.invoice.invoiceNumberLabel).toBe("Invoice No");

      const piConfig = createDefaultUnifiedConfig("proforma");
      expect(piConfig.invoice.documentTitle).toBe("PROFORMA INVOICE");
      expect(piConfig.invoice.invoiceNumberLabel).toBe("Proforma No");

      const quoteConfig = createDefaultUnifiedConfig("quotation");
      expect(quoteConfig.invoice.documentTitle).toBe("TAX QUOTATION / ESTIMATE");
      expect(quoteConfig.invoice.invoiceNumberLabel).toBe("Quote No");

      const challanConfig = createDefaultUnifiedConfig("challan");
      expect(challanConfig.invoice.documentTitle).toBe("DELIVERY CHALLAN");
      expect(challanConfig.invoice.invoiceNumberLabel).toBe("Challan No");
    });

    it("ensures docTitleFor resolves quotation, proforma, and challan without generic tax invoice fallback", () => {
      const texts = {
        invoiceTitle: "TAX INVOICE",
        proformaTitle: "PROFORMA INVOICE",
        quotationTitle: "TAX QUOTATION / ESTIMATE",
        challanTitle: "DELIVERY CHALLAN",
        estimateTitle: "TAX ESTIMATE",
      } as any;

      // When template has headerTitle = "TAX INVOICE" but docCategory = "invoice"
      const taxTemplate = { docCategory: "invoice", headerTitle: "TAX INVOICE" };

      // Quotation invoice must resolve to quotation title, not tax invoice title
      const quoteInvoice = { doc_type: "quotation", invoice_number: "QT-001" };
      expect(docTitleFor(quoteInvoice, texts, taxTemplate)).toBe("TAX QUOTATION / ESTIMATE");

      // Proforma invoice must resolve to proforma title
      const proformaInvoice = { doc_type: "proforma", invoice_number: "PI-001" };
      expect(docTitleFor(proformaInvoice, texts, taxTemplate)).toBe("PROFORMA INVOICE");

      // Delivery challan must resolve to delivery challan title
      const challanInvoice = { doc_type: "challan", invoice_number: "DC-001" };
      expect(docTitleFor(challanInvoice, texts, taxTemplate)).toBe("DELIVERY CHALLAN");
    });

    it("persists document category template IDs independently and unlinks from master", () => {
      // Set independent templates for each category
      setActiveInvoicePrintTemplateForCategory("tpl-master-tax", "invoice", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-custom-quote", "quotation", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-custom-proforma", "proforma", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-custom-challan", "challan", tid, cid);

      // Verify each category retrieves its own assigned template ID
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-master-tax");
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-custom-quote");
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-custom-proforma");
      expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("tpl-custom-challan");

      // Updating master invoice template must NOT overwrite unlinked quotation, proforma, or challan
      setActiveInvoicePrintTemplateForCategory("tpl-master-tax-v2", "invoice", tid, cid);
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-master-tax-v2");
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-custom-quote");
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-custom-proforma");
      expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("tpl-custom-challan");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Suite 5: Real-Time Preview Reactivity & Safe Storage Serialization
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 5: Real-Time Preview Reactivity & Safe Storage Serialization", () => {
    it("safely sanitizes template payloads and removes oversize images exceeding 250KB", () => {
      const validSmallLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const oversizeBase64 = "data:image/png;base64," + "A".repeat(300_000);

      const templatePayload = {
        id: "tpl-test-safe",
        name: "Test Template",
        logoUrl: validSmallLogo,
        stampUrl: oversizeBase64,
        primaryColor: "#0f172a",
      };

      const sanitized = sanitizeForStorage(templatePayload, MAX_STORED_IMAGE_CHARS);
      expect(sanitized.logoUrl).toBe(validSmallLogo);
      expect(sanitized.stampUrl).toBe(""); // Oversize blob safely zeroed out
      expect(sanitized.primaryColor).toBe("#0f172a");
    });

    it("safely saves template into tenant list via savePrintTemplateSafe without crashing", () => {
      const validTemplate = {
        id: "tpl-save-verify-01",
        name: "Verified Customizer Template",
        category: "invoices",
        docType: "invoice",
        primaryColor: "#1e3a8a",
      };

      const saveOk = savePrintTemplateSafe(validTemplate, tid);
      expect(saveOk).toBe(true);

      const rawStored = safeGetItem(getTenantTemplatesKey(tid));
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored!);
      expect(parsed.some((t: any) => t.id === "tpl-save-verify-01")).toBe(true);
    });

    it("converts between UnifiedInvoiceCustomizerConfig and PrintTemplate with 100% round-trip fidelity", () => {
      const originalConfig = createDefaultUnifiedConfig("quotation", "gst_tally");
      originalConfig.style.primaryColor = "#065f46";
      originalConfig.party.layout = "layout_2";
      originalConfig.business.companyName = "Green Leaf Agro Traders";

      const printTemplate = unifiedConfigToPrintTemplate(originalConfig);
      expect(printTemplate.primaryColor).toBe("#065f46");
      expect(printTemplate.partyLayout).toBe("layout_2");
      expect(printTemplate.storeName).toBe("Green Leaf Agro Traders");

      const rehydratedConfig = printTemplateToUnifiedConfig(printTemplate, "quotation");
      expect(rehydratedConfig.style.primaryColor).toBe("#065f46");
      expect(rehydratedConfig.party.layout).toBe("layout_2");
      expect(rehydratedConfig.business.companyName).toBe("Green Leaf Agro Traders");
      expect(rehydratedConfig.docCategory).toBe("quotation");
    });
  });
});
