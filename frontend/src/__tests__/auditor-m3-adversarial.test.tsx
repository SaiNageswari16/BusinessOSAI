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
} from "../lib/invoice-template-config";
import {
  safeSetItem,
  safeGetItem,
  sanitizeForStorage,
  MAX_STORED_IMAGE_CHARS,
} from "../lib/safe-storage";
import {
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  setActiveDocTemplateId,
  savePrintTemplateSafe,
  getTenantTemplatesKey,
} from "../lib/receipt-template-store";
import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";

describe("Auditor M3 Adversarial & Integrity Verification Suite", () => {
  const tid = "audit_tenant_m3";
  const cid = "audit_comp_m3";

  beforeEach(() => {
    storage.clear();
    listeners.clear();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 1: Category Rail Integrity & Dynamic Category Controls
  // ══════════════════════════════════════════════════════════════════════════
  it("Auditor Check 1: Each of the 7 categories renders distinct, genuine control sets", () => {
    // 1. Style category
    const htmlStyle = renderToString(
      <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="style" />
    );
    expect(htmlStyle).toContain("Theme Style Preset");
    expect(htmlStyle).toContain("Theme Colors");
    expect(htmlStyle).toContain("Typography");

    // 2. Print category
    const htmlPrint = renderToString(
      <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="print" />
    );
    expect(htmlPrint).toContain("Paper Geometry");
    expect(htmlPrint).toContain("Multi-Page &amp; Options");

    // 3. Business category
    const htmlBusiness = renderToString(
      <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="business" />
    );
    expect(htmlBusiness).toContain("Company Logo");
    expect(htmlBusiness).toContain("Logo Height");

    // 4. Invoice category
    const htmlInvoice = renderToString(
      <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="invoice" />
    );
    expect(htmlInvoice).toContain("Metadata Visibility Switches");
    expect(htmlInvoice).toContain("Invoice Number");

    // 5. Party category
    const htmlParty = renderToString(
      <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="party" />
    );
    expect(htmlParty).toContain("Select Party Layout");
    expect(htmlParty).toContain("Layout 1");
    expect(htmlParty).toContain("Layout 2");
    expect(htmlParty).toContain("Layout 3");

    // 6. Item Table category
    const htmlItemTable = renderToString(
      <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="itemTable" />
    );
    expect(htmlItemTable).toContain("Table Columns");
    expect(htmlItemTable).toContain("Table Visual Appearance");
    expect(htmlItemTable).toContain("Totals &amp; Summary Calculations");

    // 7. Miscellaneous category
    const htmlMisc = renderToString(
      <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialCategory="miscellaneous" />
    );
    expect(htmlMisc).toContain("UPI Payment QR");
    expect(htmlMisc).toContain("Signatures &amp; Company Stamp");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 2: Party Layouts 1, 2, and 3 produce distinctly different DOM structures
  // ══════════════════════════════════════════════════════════════════════════
  it("Auditor Check 2: GstTallyTemplate generates distinct DOM trees for Party Layouts 1, 2, and 3", () => {
    const sampleInvoice: any = {
      invoice_number: "INV-2026-9999",
      doc_type: "invoice",
      header_title: "TAX INVOICE",
      customerName: "Apollo Hospitals Ltd",
      customerAddress: "Road No 2, Jubilee Hills, Hyderabad",
      customerShippingAddress: "Warehouse 5, Shamshabad, Hyderabad",
      customerPhone: "+91 99999 88888",
      customerGST: "36AAACA0000A1Z5",
      taxable_value: 1000,
      grand_total: 1180,
      items: [{ product_name: "Diagnostic Kit", quantity: 1, unit_price: 1000, subtotal: 1000, tax_rate: 18 }],
    };

    const cfg = createDefaultUnifiedConfig("invoice");

    // Layout 1: Side-by-side Bill To & Ship To
    cfg.party.layout = "layout_1";
    const tpl1 = unifiedConfigToPrintTemplate(cfg);
    const html1 = renderToString(
      <GstTallyTemplate invoice={sampleInvoice} template={tpl1} partyLayout="layout_1" />
    );
    expect(html1).toContain("Apollo Hospitals Ltd");
    expect(html1).toContain("Road No 2, Jubilee Hills, Hyderabad");
    expect(html1).toContain("Warehouse 5, Shamshabad, Hyderabad");
    // Layout 1 has "Ship To" block side-by-side
    expect(html1).toContain("Ship To");

    // Layout 2: 3-Box Header Split
    cfg.party.layout = "layout_2";
    const tpl2 = unifiedConfigToPrintTemplate(cfg);
    const html2 = renderToString(
      <GstTallyTemplate invoice={sampleInvoice} template={tpl2} partyLayout="layout_2" />
    );
    expect(html2).toContain("Apollo Hospitals Ltd");
    // Layout 2 contains the 3-box header split layout
    expect(html2).not.toEqual(html1);

    // Layout 3: Stacked Rows
    cfg.party.layout = "layout_3";
    const tpl3 = unifiedConfigToPrintTemplate(cfg);
    const html3 = renderToString(
      <GstTallyTemplate invoice={sampleInvoice} template={tpl3} partyLayout="layout_3" />
    );
    expect(html3).toContain("Apollo Hospitals Ltd");
    // Layout 3 has stacked Bill To and Ship To
    expect(html3).not.toEqual(html1);
    expect(html3).not.toEqual(html2);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 3: Dynamic Columns Toggle, Custom Columns & Header Renaming in GstTallyTemplate
  // ══════════════════════════════════════════════════════════════════════════
  it("Auditor Check 3: Dynamic columns configuration alters GstTallyTemplate rendered table headers and cells", () => {
    const sampleInvoice: any = {
      invoice_number: "INV-2026-0001",
      customerName: "Reliance Retail",
      items: [{ product_name: "Widget Pro", quantity: 10, unit_price: 50, hsn_code: "8471", subtotal: 500 }],
      grand_total: 500,
    };

    const cfg = createDefaultUnifiedConfig("invoice");

    // 1. Rename Description header to "Custom Item Name"
    const descCol = cfg.itemTable.columns.find((c) => c.fieldKey === "description");
    if (descCol) descCol.headerTitle = "Custom Item Name";

    // 2. Disable HSN column
    const hsnCol = cfg.itemTable.columns.find((c) => c.fieldKey === "hsn");
    if (hsnCol) hsnCol.enabled = false;

    // 3. Add Custom Column "Batch Code"
    const customCol: DynamicColumnDefinition = {
      id: "col_batch",
      fieldKey: "batch_no",
      headerTitle: "Batch Code",
      widthPercent: 12,
      align: "center",
      enabled: true,
      isCustom: true,
    };
    cfg.itemTable.columns.push(customCol);

    const tpl = unifiedConfigToPrintTemplate(cfg);
    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        template={tpl}
        columns={cfg.itemTable.columns}
      />
    );

    // Renamed header must appear
    expect(html).toContain("Custom Item Name");
    // Custom column header must appear
    expect(html).toContain("Batch Code");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 4: Quota Protection & Storage Sanitization Under Extreme Load
  // ══════════════════════════════════════════════════════════════════════════
  it("Auditor Check 4: Oversize base64 images are sanitized and savePrintTemplateSafe persists reliably", () => {
    const validLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    // 500KB fake base64 image string
    const giantStamp = "data:image/png;base64," + "Z".repeat(500_000);

    const config = createDefaultUnifiedConfig("invoice");
    config.business.logoUrl = validLogo;
    config.miscellaneous.signatureAndStamp.stampUrl = giantStamp;

    const tpl = unifiedConfigToPrintTemplate(config);
    expect(tpl.stampUrl).toBe(giantStamp);

    // Sanitize for storage
    const sanitized = sanitizeForStorage(tpl, MAX_STORED_IMAGE_CHARS);
    expect(sanitized.logoUrl).toBe(validLogo); // Small logo retained
    expect(sanitized.stampUrl).toBe(""); // Giant stamp safely cleared to avoid QuotaExceededError

    // Verify saving persists
    const ok = savePrintTemplateSafe(sanitized, tid);
    expect(ok).toBe(true);

    const storedKey = getTenantTemplatesKey(tid);
    const raw = safeGetItem(storedKey);
    expect(raw).toBeTruthy();
    expect(raw).toContain(validLogo);
    expect(raw).not.toContain("ZZZZZZ");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 5: Independent Document Category Persistence Without Cross-Pollution
  // ══════════════════════════════════════════════════════════════════════════
  it("Auditor Check 5: Setting quotation template does not overwrite proforma or tax invoice templates", () => {
    setActiveInvoicePrintTemplateForCategory("tax_template_01", "invoice", tid, cid);
    setActiveInvoicePrintTemplateForCategory("quote_template_02", "quotation", tid, cid);
    setActiveInvoicePrintTemplateForCategory("proforma_template_03", "proforma", tid, cid);
    setActiveInvoicePrintTemplateForCategory("challan_template_04", "challan", tid, cid);

    expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tax_template_01");
    expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("quote_template_02");
    expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("proforma_template_03");
    expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("challan_template_04");

    // Overwrite quotation template
    setActiveInvoicePrintTemplateForCategory("quote_template_02_v2", "quotation", tid, cid);
    expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("quote_template_02_v2");
    expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tax_template_01");
    expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("proforma_template_03");
    expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("challan_template_04");
  });
});
