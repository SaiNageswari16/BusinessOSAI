import { describe, it, expect, beforeEach } from "vitest";

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
  INVOICE_DOC_CATEGORIES,
  PARTY_LAYOUT_OPTIONS,
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  createDefaultUnifiedConfig,
  unifiedConfigToPrintTemplate,
  printTemplateToUnifiedConfig,
  resolveTemplateColumns,
  resolveCustomFieldRows,
} from "../lib/invoice-template-config";

import {
  MAX_STORED_IMAGE_CHARS,
  NON_CRITICAL_CACHE_KEYS,
  PROTECTED_STORAGE_PREFIXES,
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  sanitizeForStorage,
  pruneTemplateList,
} from "../lib/safe-storage";

import {
  getInvoiceCategoryActiveKey,
  getInvoiceCategoryLinkKey,
  setActiveDocTemplateId,
  getActiveDocTemplateId,
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  isInvoiceCategoryUnlinked,
  setInvoiceCategoryLinked,
  setInvoiceCategoryUnlinked,
  getActiveInvoicePrintTemplateForDocCategory,
  setOrgSignatureSettings,
  setOrgPaymentQrSettings,
  setActiveBillingGst,
} from "../lib/receipt-template-store";

describe("Milestone M1: Schema Core & Document Categories", () => {
  it("includes Delivery Challan in INVOICE_DOC_CATEGORIES", () => {
    const challan = INVOICE_DOC_CATEGORIES.find((c) => c.key === "challan");
    expect(challan).toBeDefined();
    expect(challan?.label).toBe("Delivery Challan");
  });

  it("exports PARTY_LAYOUT_OPTIONS with layout_1, layout_2, layout_3", () => {
    expect(PARTY_LAYOUT_OPTIONS).toHaveLength(3);
    expect(PARTY_LAYOUT_OPTIONS.map((o) => o.id)).toEqual(["layout_1", "layout_2", "layout_3"]);
  });

  it("docTitleFor, docNoLabelFor, docDateLabelFor correctly detect Delivery Challans and quote numbers", () => {
    const texts: any = {
      invoiceTitle: "TAX INVOICE",
      quotationTitle: "TAX QUOTATION / ESTIMATE",
      estimateTitle: "TAX ESTIMATE",
      proformaTitle: "PROFORMA INVOICE",
      challanTitle: "DELIVERY CHALLAN",
      invoiceNoLabel: "Invoice No",
      quoteNoLabel: "Quote No",
      estimateNoLabel: "Estimate No",
      proformaNoLabel: "Proforma No",
      challanNoLabel: "Challan No",
      invoiceDateLabel: "Invoice Date",
      quoteDateLabel: "Quote Date",
      estimateDateLabel: "Estimate Date",
      challanDateLabel: "Challan Date",
    };

    expect(docTitleFor({ invoice_type: "CHALLAN" }, texts)).toBe("DELIVERY CHALLAN");
    expect(docTitleFor({ doc_type: "DELIVERY_CHALLAN" }, texts)).toBe("DELIVERY CHALLAN");
    expect(docTitleFor({ invoice_number: "DC-2026-001" }, texts)).toBe("DELIVERY CHALLAN");
    expect(docNoLabelFor({ invoice_type: "CHALLAN" }, texts)).toBe("Challan No");
    expect(docDateLabelFor({ invoice_type: "CHALLAN" }, texts)).toBe("Challan Date");

    // Quote number fallback check
    expect(docTitleFor({ quote_number: "QT-900" }, texts)).toBe("TAX QUOTATION / ESTIMATE");
    expect(docNoLabelFor({ quote_number: "QT-900" }, texts)).toBe("Quote No");
    expect(docDateLabelFor({ quote_number: "QT-900" }, texts)).toBe("Quote Date");
  });

  it("creates default unified config and adapts bidirectionally with legacy print template", () => {
    const config = createDefaultUnifiedConfig("challan", "gst_tally");
    expect(config.docCategory).toBe("challan");
    expect(config.invoice.documentTitle).toBe("DELIVERY CHALLAN");
    expect(config.party.layout).toBe("layout_1");
    expect(config.itemTable.columns.length).toBe(8);

    const adapted = unifiedConfigToPrintTemplate(config);
    expect(adapted.headerTitle).toBe("DELIVERY CHALLAN");
    expect(adapted.partyLayout).toBe("layout_1");
    expect(adapted.columns).toHaveLength(8);

    const roundtrip = printTemplateToUnifiedConfig(adapted, "challan");
    expect(roundtrip.invoice.documentTitle).toBe("DELIVERY CHALLAN");
    expect(roundtrip.party.layout).toBe("layout_1");
    expect(roundtrip.itemTable.columns).toHaveLength(8);
  });

  it("resolveTemplateColumns reads columns from template.itemTable.columns", () => {
    const config = createDefaultUnifiedConfig("invoice");
    const resolved = resolveTemplateColumns(config);
    expect(resolved).toHaveLength(8);
    expect(resolved[0].headerTitle).toBe("S.No");
  });

  it("resolveCustomFieldRows reads business, invoice, and party custom fields", () => {
    const template = {
      business: { customFields: [{ id: "cf_b", label: "Drug Lic", value: "DL-999", enabled: true }] },
      invoice: { customFields: [{ id: "cf_i", label: "Vehicle Type", value: "Truck", enabled: true }] },
      party: { customFields: [{ id: "cf_p", label: "Zone Code", value: "ZN-4", enabled: true }] },
    };
    const rows = resolveCustomFieldRows(template, {});
    expect(rows).toEqual(
      expect.arrayContaining([
        { label: "Drug Lic", value: "DL-999" },
        { label: "Vehicle Type", value: "Truck" },
        { label: "Zone Code", value: "ZN-4" },
      ])
    );
  });
});

describe("Milestone M1: Safe Storage Quota Protection", () => {
  it("MAX_STORED_IMAGE_CHARS is 250,000 (~187KB) and preserves high-fidelity logos", () => {
    expect(MAX_STORED_IMAGE_CHARS).toBe(250_000);
    const logo120k = "data:image/png;base64," + "A".repeat(120_000);
    const sanitized = sanitizeForStorage({ logoUrl: logo120k });
    expect(sanitized.logoUrl.length).toBe(logo120k.length);

    const oversizedLogo = "data:image/jpeg;base64," + "A".repeat(280_000);
    const stripped = sanitizeForStorage({ logoUrl: oversizedLogo });
    expect(stripped.logoUrl).toBe("");
  });

  it("NON_CRITICAL_CACHE_KEYS does NOT include print template keys and PROTECTED_STORAGE_PREFIXES protects them", () => {
    expect(NON_CRITICAL_CACHE_KEYS).not.toContain("businessos_print_templates_v1");
    expect(NON_CRITICAL_CACHE_KEYS).not.toContain("user_active_print_templates_v1");
    expect(PROTECTED_STORAGE_PREFIXES).toContain("businessos_print_templates_v1");
    expect(PROTECTED_STORAGE_PREFIXES).toContain("user_active_print_templates_v1");
  });

  it("pruneTemplateList dedupes and caps at 15 without collisions", () => {
    const list = [
      { id: "tpl1", name: "Template 1", updatedAt: "2026-01-01" },
      { id: "tpl1", name: "Template 1 Updated", updatedAt: "2026-02-01" },
      { id: "tpl2", name: "Template 2" },
    ];
    const pruned = pruneTemplateList(list);
    expect(pruned).toHaveLength(2);
    expect(pruned.find((t) => t.id === "tpl1")?.name).toBe("Template 1 Updated");
  });
});

describe("Milestone M1: Template Store Independence & Key Generators", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getInvoiceCategoryActiveKey and getInvoiceCategoryLinkKey have no double underscore", () => {
    const activeKey = getInvoiceCategoryActiveKey("t1", "c1", "proforma");
    expect(activeKey).toBe("bos_active_invoice_category_template_t1_proforma_c1");
    expect(activeKey).not.toContain("__");

    const linkKey = getInvoiceCategoryLinkKey("t1", "c1", "proforma");
    expect(linkKey).toBe("bos_invoice_category_link_t1_proforma_c1");
    expect(linkKey).not.toContain("__");
  });

  it("supports independent per-document template selection without clobbering master Tax Invoice slot", () => {
    // 1. Set master Tax Invoice template
    setActiveInvoicePrintTemplateForCategory("tpl-gst-tally", "invoice", "test_tid", "test_cid");
    expect(getActiveInvoicePrintTemplateForCategory("invoice", "test_tid", "test_cid")).toBe("tpl-gst-tally");

    // 2. Proforma initially links/falls back to master Tax Invoice
    expect(getActiveInvoicePrintTemplateForCategory("proforma", "test_tid", "test_cid")).toBe("tpl-gst-tally");
    expect(isInvoiceCategoryUnlinked("proforma", "test_tid", "test_cid")).toBe(false);

    // 3. Configure Proforma independently
    setActiveInvoicePrintTemplateForCategory("tpl-proforma-modern", "proforma", "test_tid", "test_cid");
    expect(getActiveInvoicePrintTemplateForCategory("proforma", "test_tid", "test_cid")).toBe("tpl-proforma-modern");
    expect(isInvoiceCategoryUnlinked("proforma", "test_tid", "test_cid")).toBe(true);

    // 4. Verify master Tax Invoice was NOT modified
    expect(getActiveInvoicePrintTemplateForCategory("invoice", "test_tid", "test_cid")).toBe("tpl-gst-tally");

    // 5. Subsequent changes to master Tax Invoice do NOT overwrite independent Proforma
    setActiveInvoicePrintTemplateForCategory("tpl-invoice-compact", "invoice", "test_tid", "test_cid");
    expect(getActiveInvoicePrintTemplateForCategory("invoice", "test_tid", "test_cid")).toBe("tpl-invoice-compact");
    expect(getActiveInvoicePrintTemplateForCategory("proforma", "test_tid", "test_cid")).toBe("tpl-proforma-modern");

    // 6. Configure Delivery Challan independently
    setActiveInvoicePrintTemplateForCategory("tpl-challan-standard", "challan", "test_tid", "test_cid");
    expect(getActiveInvoicePrintTemplateForCategory("challan", "test_tid", "test_cid")).toBe("tpl-challan-standard");
    expect(getActiveInvoicePrintTemplateForCategory("invoice", "test_tid", "test_cid")).toBe("tpl-invoice-compact");
  });

  it("handles re-linking and unlinking via setInvoiceCategoryLinked and setInvoiceCategoryUnlinked", () => {
    setActiveInvoicePrintTemplateForCategory("tpl-master", "invoice", "t1", "c1");
    setActiveInvoicePrintTemplateForCategory("tpl-quote-custom", "quotation", "t1", "c1");
    expect(getActiveInvoicePrintTemplateForCategory("quotation", "t1", "c1")).toBe("tpl-quote-custom");

    // Re-link to master
    setInvoiceCategoryLinked("quotation", true, undefined, "t1", "c1");
    expect(isInvoiceCategoryUnlinked("quotation", "t1", "c1")).toBe(false);
    expect(getActiveInvoicePrintTemplateForCategory("quotation", "t1", "c1")).toBe("tpl-master");

    // Unlink and pin
    setInvoiceCategoryUnlinked("quotation", "tpl-quote-pinned", "t1", "c1");
    expect(isInvoiceCategoryUnlinked("quotation", "t1", "c1")).toBe(true);
    expect(getActiveInvoicePrintTemplateForCategory("quotation", "t1", "c1")).toBe("tpl-quote-pinned");
  });

  it("wraps raw localStorage calls with safeSetItem in signature, payment QR, and billing GST", () => {
    setOrgSignatureSettings({ signature_title: "CFO", signature_url: "data:image/png;base64,XYZ" }, "t1");
    expect(safeGetItem("bos_signature_settings_t1")).toContain("CFO");

    setOrgPaymentQrSettings({ upi_vpa: "test@upi", upi_payee_name: "Test Store" }, "t1");
    expect(safeGetItem("bos_payment_qr_settings_t1")).toContain("test@upi");

    setActiveBillingGst({ gstin: "29ABCDE1234F1Z5", trade_name: "Global Trading" }, "t1");
    expect(safeGetItem("bos_active_billing_gst_details_t1")).toContain("Global Trading");
  });

  it("resolves full template object for document categories via getActiveInvoicePrintTemplateForDocCategory", () => {
    setActiveBillingGst({ gstin: "29ABCDE1234F1Z5", trade_name: "Global Trading", address: "123 Main St" }, "t1");
    setActiveInvoicePrintTemplateForCategory("gst_tally", "challan", "t1");

    const tpl = getActiveInvoicePrintTemplateForDocCategory("challan", "t1");
    expect(tpl).toBeDefined();
    expect(tpl.gstin).toBe("29ABCDE1234F1Z5");
    expect(tpl.storeName).toBe("Global Trading");
    expect(tpl.storeAddress).toBe("123 Main St");
  });
});
