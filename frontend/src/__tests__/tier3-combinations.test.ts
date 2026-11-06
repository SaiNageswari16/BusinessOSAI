import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectDocCategory,
  resolveTemplateColumns,
  cellValueForColumn,
  addCustomColumn,
  resolveCustomFieldRows,
  docTitleFor,
  resolveInvoiceTexts,
} from "@/lib/invoice-template-config";
import {
  safeSetItem,
  safeGetItem,
  sanitizeForStorage,
} from "@/lib/safe-storage";
import {
  setActiveDocTemplateId,
  getActiveDocTemplateId,
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  isInvoiceCategoryUnlinked,
  setInvoiceCategoryLinked,
} from "@/lib/receipt-template-store";
import {
  setupBrowserEnvironment,
  teardownBrowserEnvironment,
  MockLocalStorage,
  SAMPLE_INTRASTATE_INVOICE,
  SAMPLE_INTERSTATE_INVOICE,
  SAMPLE_QUOTATION,
  SAMPLE_CHALLAN,
  SAMPLE_PROFORMA,
} from "./test-helpers";

describe("Tier 3: Cross-Feature Combinations", () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    setupBrowserEnvironment(mockStorage);
  });

  afterEach(() => {
    teardownBrowserEnvironment();
  });

  it("3.1 Document Type Switching × Party Layouts: no layout or party bleeding between doc types", () => {
    const tid = "tenant_multi";

    // Setup:
    // Tax Invoice uses Layout 1 (Side-by-side) with template tpl-tax-inv
    // Quotation uses Layout 2 (3-Box Split) with template tpl-quote
    // Challan uses Layout 3 (Stacked) with template tpl-challan
    setActiveInvoicePrintTemplateForCategory("tpl-tax-inv", "invoice", tid);
    setActiveInvoicePrintTemplateForCategory("tpl-quote", "quotation", tid);
    setActiveInvoicePrintTemplateForCategory("tpl-challan", "challan", tid);

    // Verify independent resolution
    expect(getActiveInvoicePrintTemplateForCategory("invoice", tid)).toBe("tpl-tax-inv");
    expect(getActiveInvoicePrintTemplateForCategory("quotation", tid)).toBe("tpl-quote");
    expect(getActiveInvoicePrintTemplateForCategory("challan", tid)).toBe("tpl-challan");

    // Switching preview context from Tax Invoice to Quotation
    const texts = resolveInvoiceTexts(null);
    expect(docTitleFor(SAMPLE_INTRASTATE_INVOICE, texts)).toBe("TAX INVOICE");
    expect(docTitleFor(SAMPLE_QUOTATION, texts)).toBe("TAX QUOTATION / ESTIMATE");
    expect(docTitleFor(SAMPLE_CHALLAN, texts)).toBe("DELIVERY CHALLAN");
  });

  it("3.2 Document Type Switching × Dynamic Table Columns: Challan hides rates/taxes while Tax Invoice shows full GST", () => {
    // Delivery Challan column config: hides price, rate, tax, amount
    const challanFieldToggles = {
      showItemIndex: true,
      showHSN: true,
      showBatchNumber: true,
      showExpMfgDates: true,
      showSecondaryUnit: true,
      showItemQty: true,
      showGstRateCol: false,
      showItemRate: false,
      showDiscountCol: false,
      showItemAmount: false,
    };
    const challanCols = resolveTemplateColumns(null, undefined, challanFieldToggles);
    const challanKeys = challanCols.map((c) => c.fieldKey);
    expect(challanKeys).toContain("sno");
    expect(challanKeys).toContain("description");
    expect(challanKeys).toContain("quantity");
    expect(challanKeys).toContain("batch");
    expect(challanKeys).not.toContain("tax_rate");
    expect(challanKeys).not.toContain("unit_price");
    expect(challanKeys).not.toContain("total_amount");

    // Tax Invoice column config: includes all GST columns
    const taxInvoiceFieldToggles = {
      showItemIndex: true,
      showHSN: true,
      showBatchNumber: true,
      showExpMfgDates: true,
      showSecondaryUnit: true,
      showItemQty: true,
      showGstRateCol: true,
      showItemRate: true,
      showDiscountCol: true,
      showItemAmount: true,
    };
    const invoiceCols = resolveTemplateColumns(null, undefined, taxInvoiceFieldToggles);
    const invoiceKeys = invoiceCols.map((c) => c.fieldKey);
    expect(invoiceKeys).toContain("tax_rate");
    expect(invoiceKeys).toContain("unit_price");
    expect(invoiceKeys).toContain("total_amount");
  });

  it("3.3 Party Layouts × Dynamic Table Columns × Custom Fields: compound configuration", () => {
    // A complex template combining party custom fields and custom item columns
    const compoundTemplate = {
      id: "tpl-compound-pharma",
      customFields: [
        { id: "cf_dl", label: "Drug Lic 20B/21B", value: "DL-AP-10293", enabled: true },
        { id: "cf_salesman", label: "Sales Executive", value: "Vijay Kumar", enabled: true },
      ],
      columns: [
        { id: "c_sno", fieldKey: "sno", headerTitle: "S.No", widthPercent: 5, align: "center" as const, enabled: true },
        { id: "c_desc", fieldKey: "description", headerTitle: "Medicine Name & Form", widthPercent: 35, align: "left" as const, enabled: true },
        { id: "c_batch", fieldKey: "batch", headerTitle: "Batch", widthPercent: 12, align: "left" as const, enabled: true },
        { id: "c_exp", fieldKey: "expiry_date", headerTitle: "Exp Date", widthPercent: 12, align: "center" as const, enabled: true },
        { id: "c_mrp", fieldKey: "mrp", headerTitle: "MRP", widthPercent: 10, align: "right" as const, enabled: true },
        { id: "c_qty", fieldKey: "quantity", headerTitle: "Billed Qty", widthPercent: 8, align: "center" as const, enabled: true },
        { id: "c_free", fieldKey: "free_qty", headerTitle: "Free", widthPercent: 6, align: "center" as const, enabled: true },
        { id: "c_amt", fieldKey: "total_amount", headerTitle: "Net Amount", widthPercent: 12, align: "right" as const, enabled: true },
      ],
    };

    const resolvedCols = resolveTemplateColumns(compoundTemplate);
    expect(resolvedCols.length).toBe(8);
    expect(resolvedCols.map((c) => c.fieldKey)).toEqual([
      "sno",
      "description",
      "batch",
      "expiry_date",
      "mrp",
      "quantity",
      "free_qty",
      "total_amount",
    ]);

    const metaRows = resolveCustomFieldRows(compoundTemplate, SAMPLE_INTRASTATE_INVOICE);
    expect(metaRows).toContainEqual({ label: "Drug Lic 20B/21B", value: "DL-AP-10293" });
    expect(metaRows).toContainEqual({ label: "Sales Executive", value: "Vijay Kumar" });
  });

  it("3.4 Safe Storage Quota × Multi-Category Templates × Image Data: saves without quota failure", () => {
    const tid = "tenant_heavy";
    const smallLogo = "data:image/png;base64," + "B".repeat(2000); // 2KB valid logo
    const hugeLogo = "data:image/png;base64," + "C".repeat(280000); // ~210KB oversized logo (>250k)

    const templatesToSave = [
      { id: "tpl-1", name: "Tax Invoice Template", logoUrl: smallLogo, updatedAt: "2026-11-05T10:00:00Z" },
      { id: "tpl-2", name: "Quotation Template", logoUrl: hugeLogo, updatedAt: "2026-11-05T11:00:00Z" },
    ];

    // Sanitize before storage prevents storing the oversized image (>250k chars)
    const sanitized = sanitizeForStorage(templatesToSave);
    expect(sanitized[0].logoUrl).toBe(smallLogo);
    expect(sanitized[1].logoUrl).toBe("");

    const success = safeSetItem(`bos_templates_${tid}`, JSON.stringify(sanitized));
    expect(success).toBe(true);

    const retrieved = JSON.parse(mockStorage.getItem(`bos_templates_${tid}`)!);
    expect(retrieved[0].logoUrl).toBe(smallLogo);
    expect(retrieved[1].logoUrl).toBe("");
  });

  it("3.5 Multi-Tenant & Multi-Company Isolation: zero cross-tenant contamination", () => {
    const tenant1 = "org_retail_hyd";
    const tenant2 = "org_pharma_vizag";
    const companyA = "cmp_retail_main";
    const companyB = "cmp_retail_branch";

    // Tenant 1 sets distinct templates for company A and company B
    setActiveInvoicePrintTemplateForCategory("tpl-retail-a", "invoice", tenant1, companyA);
    setActiveInvoicePrintTemplateForCategory("tpl-retail-b", "invoice", tenant1, companyB);

    // Tenant 2 sets template for its own workspace
    setActiveInvoicePrintTemplateForCategory("tpl-pharma-vzg", "invoice", tenant2);

    expect(getActiveInvoicePrintTemplateForCategory("invoice", tenant1, companyA)).toBe("tpl-retail-a");
    expect(getActiveInvoicePrintTemplateForCategory("invoice", tenant1, companyB)).toBe("tpl-retail-b");
    expect(getActiveInvoicePrintTemplateForCategory("invoice", tenant2)).toBe("tpl-pharma-vzg");
  });

  it("3.6 Unlinked Category Override: unlinked category retains dedicated template when master changes", () => {
    const tid = "tenant_unlink_test";

    // 1. Initially master invoice template is tpl-master-v1
    setActiveInvoicePrintTemplateForCategory("tpl-master-v1", "invoice", tid);

    // 2. Proforma is explicitly unlinked and assigned tpl-proforma-custom
    setInvoiceCategoryLinked("proforma", false, "tpl-proforma-custom", tid);
    expect(isInvoiceCategoryUnlinked("proforma", tid)).toBe(true);
    setActiveInvoicePrintTemplateForCategory("tpl-proforma-custom", "proforma", tid);

    expect(getActiveInvoicePrintTemplateForCategory("proforma", tid)).toBe("tpl-proforma-custom");

    // 3. Update master invoice template to tpl-master-v2
    setActiveInvoicePrintTemplateForCategory("tpl-master-v2", "invoice", tid);

    // Master is updated
    expect(getActiveInvoicePrintTemplateForCategory("invoice", tid)).toBe("tpl-master-v2");
    // Unlinked Proforma retains its independent template!
    expect(getActiveInvoicePrintTemplateForCategory("proforma", tid)).toBe("tpl-proforma-custom");
  });

  it("3.7 Document Category Detection with reference fields: invoice referencing challan number is still a Tax Invoice", () => {
    // An invoice that merely REFERENCES a delivery challan number (e.g. challan_number: "DC-0045")
    // must NOT be misclassified as a delivery challan document.
    const taxInvoiceWithChallanRef = {
      invoice_number: "INV/2026/889",
      invoice_type: "TAX_INVOICE",
      challan_number: "DC-0045",
      items: [{ item_name: "Tractor Spares", unit_price: 1500 }],
    };
    expect(detectDocCategory(taxInvoiceWithChallanRef)).toBe("invoice");

    // A real delivery challan document
    const actualChallan = {
      invoice_number: "DC-0045",
      doc_type: "DELIVERY_CHALLAN",
      items: [{ item_name: "Tractor Spares", unit_price: 0 }],
    };
    expect(detectDocCategory(actualChallan)).toBe("challan");
  });

  it("3.8 Dynamic Column Reordering + Custom Header Renames persists across document templates", () => {
    const quoteTemplate = {
      id: "tpl-quote-custom-cols",
      name: "Custom Quotation",
      columns: [
        { id: "c_sno", fieldKey: "sno", headerTitle: "Sl.", widthPercent: 5, align: "center" as const, enabled: true },
        { id: "c_desc", fieldKey: "description", headerTitle: "Proposed Equipment", widthPercent: 55, align: "left" as const, enabled: true },
        { id: "c_qty", fieldKey: "quantity", headerTitle: "Estimated Qty", widthPercent: 15, align: "center" as const, enabled: true },
        { id: "c_rate", fieldKey: "unit_price", headerTitle: "Estimated Rate", widthPercent: 25, align: "right" as const, enabled: true },
      ],
    };

    const quoteCols = resolveTemplateColumns(quoteTemplate);
    expect(quoteCols.map((c) => c.headerTitle)).toEqual([
      "Sl.",
      "Proposed Equipment",
      "Estimated Qty",
      "Estimated Rate",
    ]);

    const item = { product_name: "Solar Inverter 5kVA", quantity: 2, unit_price: 45000 };
    expect(cellValueForColumn(quoteCols[1], item).text).toBe("Solar Inverter 5kVA");
    expect(cellValueForColumn(quoteCols[2], item).text).toBe("2");
    expect(cellValueForColumn(quoteCols[3], item).text).toBe("45,000.00");
  });
});
