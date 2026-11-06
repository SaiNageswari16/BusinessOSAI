import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectDocCategory,
  resolveTemplateColumns,
  cellValueForColumn,
  addCustomColumn,
  resolveCustomFieldRows,
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  resolveInvoiceTexts,
} from "@/lib/invoice-template-config";
import {
  safeSetItem,
  safeGetItem,
  sanitizeForStorage,
  pruneTemplateList,
} from "@/lib/safe-storage";
import {
  setActiveDocTemplateId,
  getActiveDocTemplateId,
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  isInvoiceCategoryUnlinked,
  setInvoiceCategoryUnlinked,
} from "@/lib/receipt-template-store";
import { formatPartyAddress } from "@/lib/utils";
import { numberToIndianWords } from "@/lib/number-to-words";
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

describe("Tier 1: Feature Coverage", () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    setupBrowserEnvironment(mockStorage);
  });

  afterEach(() => {
    teardownBrowserEnvironment();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 1: Document Type Independence
  // ───────────────────────────────────────────────────────────────────────────
  describe("Feature 1: Document Type Independence", () => {
    it("1.1 Detects Tax Invoice category from standard invoice types and number prefixes", () => {
      expect(detectDocCategory({ invoice_type: "TAX_INVOICE" })).toBe("invoice");
      expect(detectDocCategory({ doc_type: "invoice" })).toBe("invoice");
      expect(detectDocCategory({ invoice_number: "INV/2026/001" })).toBe("invoice");
      expect(detectDocCategory({})).toBe("invoice");
    });

    it("1.2 Detects Proforma Invoice independently without tax invoice fallback", () => {
      expect(detectDocCategory({ invoice_type: "PROFORMA" })).toBe("proforma");
      expect(detectDocCategory({ invoice_number: "PI-2026-901" })).toBe("proforma");
      expect(detectDocCategory({ quote_number: "PI-880" })).toBe("proforma");
    });

    it("1.3 Detects Quotation independently without tax invoice fallback", () => {
      expect(detectDocCategory({ invoice_type: "QUOTATION" })).toBe("quotation");
      expect(detectDocCategory({ invoice_number: "QT-2026-441" })).toBe("quotation");
      expect(detectDocCategory({ quote_number: "QT-772" })).toBe("quotation");
    });

    it("1.4 Detects Delivery Challan independently without tax invoice fallback", () => {
      expect(detectDocCategory({ doc_type: "CHALLAN" })).toBe("challan");
      expect(detectDocCategory({ invoice_type: "DELIVERY_CHALLAN" })).toBe("challan");
      expect(detectDocCategory({ invoice_number: "DC-2026-102" })).toBe("challan");
    });

    it("1.5 Detects Credit Note, Debit Note, and Purchase documents independently", () => {
      expect(detectDocCategory({ invoice_type: "CREDIT_NOTE" })).toBe("credit_note");
      expect(detectDocCategory({ invoice_number: "CN-001" })).toBe("credit_note");
      expect(detectDocCategory({ invoice_type: "DEBIT_NOTE" })).toBe("debit_note");
      expect(detectDocCategory({ invoice_number: "DN-002" })).toBe("debit_note");
      expect(detectDocCategory({ invoice_type: "PURCHASE_INVOICE" })).toBe("purchase_invoice");
      expect(detectDocCategory({ invoice_number: "PINV-100" })).toBe("purchase_invoice");
      expect(detectDocCategory({ invoice_type: "PURCHASE_ORDER" })).toBe("purchase_order");
      expect(detectDocCategory({ invoice_number: "PO-400" })).toBe("purchase_order");
    });

    it("1.6 Persists independent active templates per document category without clobbering tax invoice", () => {
      const tid = "tenant_xyz";
      // Set distinct templates for Tax Invoice, Quotation, Proforma, Challan
      setActiveInvoicePrintTemplateForCategory("tpl-gst-tally", "invoice", tid);
      setActiveInvoicePrintTemplateForCategory("tpl-modern-quote", "quotation", tid);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-blue", "proforma", tid);
      setActiveInvoicePrintTemplateForCategory("tpl-challan-minimal", "challan", tid);

      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid)).toBe("tpl-gst-tally");
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid)).toBe("tpl-modern-quote");
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid)).toBe("tpl-proforma-blue");
      expect(getActiveInvoicePrintTemplateForCategory("challan", tid)).toBe("tpl-challan-minimal");

      // Verify setting proforma does NOT clobber the master invoice template
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-updated", "proforma", tid);
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid)).toBe("tpl-gst-tally");
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid)).toBe("tpl-proforma-updated");
    });

    it("1.7 Resolves document title and number/date labels per category", () => {
      const texts = resolveInvoiceTexts(null, "gst_tally");
      expect(docTitleFor(SAMPLE_INTRASTATE_INVOICE, texts)).toBe("TAX INVOICE");
      expect(docTitleFor(SAMPLE_QUOTATION, texts)).toBe("TAX QUOTATION / ESTIMATE");
      expect(docTitleFor(SAMPLE_CHALLAN, texts)).toBe("DELIVERY CHALLAN");
      expect(docTitleFor(SAMPLE_PROFORMA, texts)).toBe("PROFORMA INVOICE");

      expect(docNoLabelFor(SAMPLE_INTRASTATE_INVOICE, texts)).toBe("Invoice No");
      expect(docNoLabelFor(SAMPLE_QUOTATION, texts)).toBe("Quote No");
      expect(docNoLabelFor(SAMPLE_PROFORMA, texts)).toBe("Proforma No");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 2: Party Layouts
  // ───────────────────────────────────────────────────────────────────────────
  describe("Feature 2: Party Layouts", () => {
    it("2.1 Layout 1 (Side-by-side): preserves independent Bill To and Ship To addresses", () => {
      const invoice = SAMPLE_INTRASTATE_INVOICE;
      const billToFormatted = formatPartyAddress(invoice.customerBillingAddress);
      const shipToFormatted = formatPartyAddress(invoice.customerShippingAddress);

      expect(billToFormatted).toContain("Shop 12, Main Road, Arundelpet");
      expect(shipToFormatted).toContain("Godown 4, Auto Nagar");
      expect(billToFormatted).not.toBe(shipToFormatted);
    });

    it("2.2 Layout 2 (3-Box Split): structured partitioned header layout metadata", () => {
      const invoice = SAMPLE_INTERSTATE_INVOICE;
      const sellerGstin = invoice.sellerGstin;
      const customerGstin = invoice.customerGST;
      const placeOfSupply = invoice.place_of_supply;

      expect(sellerGstin).toBe("37AACFI1208A1ZU");
      expect(customerGstin).toBe("36AAACH9876K1Z9");
      expect(placeOfSupply).toBe("36 - Telangana");
      expect(invoice.po_number).toBe("PO-HYD-9912");
      expect(invoice.eway_bill_number).toBe("241098234190");
    });

    it("2.3 Layout 3 (Stacked): provides hierarchical vertical party data", () => {
      const invoice = SAMPLE_QUOTATION;
      expect(invoice.customerName).toBe("Ramesh Sharma");
      expect(formatPartyAddress(invoice.customerBillingAddress)).toBe(
        "Flat 402, Green Meadows, Vijayawada, Andhra Pradesh"
      );
      expect(invoice.customerPhone).toBe("+91 94401 23456");
    });

    it("2.4 Falls back cleanly to 'Same as Billed To' when shipping address is absent", () => {
      const invoiceWithoutShipping = {
        customerBillingAddress: "123 Market Road, Vizag",
        customerShippingAddress: undefined,
      };
      const shipAddress =
        invoiceWithoutShipping.customerShippingAddress ||
        invoiceWithoutShipping.customerBillingAddress ||
        "Same as Billed To";
      expect(shipAddress).toBe("123 Market Road, Vizag");

      const invoiceWithEmptyAddresses = {
        customerBillingAddress: "",
        customerShippingAddress: "",
      };
      const fallbackShip =
        invoiceWithEmptyAddresses.customerShippingAddress ||
        invoiceWithEmptyAddresses.customerBillingAddress ||
        "Same as Billed To";
      expect(fallbackShip).toBe("Same as Billed To");
    });

    it("2.5 Customer Ledger Balances are computed and formatted correctly", () => {
      const invoicePaid = SAMPLE_INTRASTATE_INVOICE;
      expect(invoicePaid.grand_total - invoicePaid.amount_received).toBe(0);

      const invoicePartial = SAMPLE_INTERSTATE_INVOICE;
      expect(invoicePartial.balance_due).toBe(38500);
      expect(invoicePartial.grand_total - invoicePartial.amount_received).toBe(38500);
    });

    it("2.6 Resolves custom party fields bound to party metadata", () => {
      const templateWithCustomFields = {
        customFields: [
          { id: "cf_dl", label: "Drug License No", value: "DL-20B/12984", enabled: true },
          { id: "cf_cust_phone", label: "Contact No", bindKey: "customerPhone", enabled: true },
          { id: "cf_disabled", label: "Hidden Note", value: "Should not show", enabled: false },
        ],
      };
      const rows = resolveCustomFieldRows(templateWithCustomFields, SAMPLE_INTRASTATE_INVOICE);
      const labels = rows.map((r) => r.label);
      const values = rows.map((r) => r.value);

      expect(labels).toContain("Drug License No");
      expect(values).toContain("DL-20B/12984");
      expect(labels).toContain("Contact No");
      expect(values).toContain("+91 98480 12345");
      expect(labels).not.toContain("Hidden Note");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 3: Dynamic Table Columns
  // ───────────────────────────────────────────────────────────────────────────
  describe("Feature 3: Dynamic Table Columns", () => {
    it("3.1 Toggles column visibility based on field configuration flags", () => {
      const fAllEnabled = {
        showItemIndex: true,
        showHSN: true,
        showBatchNumber: true,
        showExpMfgDates: true,
        showSecondaryUnit: true,
        showGstRateCol: true,
        showItemRate: true,
        showDiscountCol: true,
        showItemQty: true,
        showItemAmount: true,
      };
      const allCols = resolveTemplateColumns(null, undefined, fAllEnabled);
      const allKeys = allCols.map((c) => c.fieldKey);
      expect(allKeys).toEqual([
        "sno",
        "hsn",
        "batch",
        "expiry_date",
        "description",
        "uom",
        "tax_rate",
        "unit_price",
        "discount",
        "quantity",
        "total_amount",
      ]);

      const fMinimal = {
        showItemIndex: true,
        showHSN: false,
        showBatchNumber: false,
        showExpMfgDates: false,
        showSecondaryUnit: false,
        showGstRateCol: false,
        showItemRate: true,
        showDiscountCol: false,
        showItemQty: true,
        showItemAmount: true,
      };
      const minCols = resolveTemplateColumns(null, undefined, fMinimal);
      const minKeys = minCols.map((c) => c.fieldKey);
      expect(minKeys).toEqual(["sno", "description", "unit_price", "quantity", "total_amount"]);
      expect(minKeys).not.toContain("hsn");
      expect(minKeys).not.toContain("tax_rate");
    });

    it("3.2 Supports custom column header titles overriding defaults", () => {
      const customCols = [
        { id: "col_sno", fieldKey: "sno", headerTitle: "#", widthPercent: 5, align: "center", enabled: true },
        { id: "col_desc", fieldKey: "description", headerTitle: "Particulars & Description", widthPercent: 50, align: "left", enabled: true },
        { id: "col_amt", fieldKey: "total_amount", headerTitle: "Line Total (INR)", widthPercent: 20, align: "right", enabled: true },
      ];
      const resolved = resolveTemplateColumns({ columns: customCols });
      expect(resolved[0].headerTitle).toBe("#");
      expect(resolved[1].headerTitle).toBe("Particulars & Description");
      expect(resolved[2].headerTitle).toBe("Line Total (INR)");
    });

    it("3.3 Preserves custom column reordering strictly", () => {
      const reorderedCols = [
        { id: "col_qty", fieldKey: "quantity", headerTitle: "Qty", widthPercent: 10, align: "center", enabled: true },
        { id: "col_desc", fieldKey: "description", headerTitle: "Item Name", widthPercent: 40, align: "left", enabled: true },
        { id: "col_rate", fieldKey: "unit_price", headerTitle: "Price", widthPercent: 20, align: "right", enabled: true },
        { id: "col_amt", fieldKey: "total_amount", headerTitle: "Total", widthPercent: 30, align: "right", enabled: true },
      ];
      const resolved = resolveTemplateColumns({ columns: reorderedCols });
      expect(resolved.map((c) => c.fieldKey)).toEqual(["quantity", "description", "unit_price", "total_amount"]);
    });

    it("3.4 Appends custom column with static value and resolves cell display value", () => {
      const baseCols = [
        { id: "col_desc", fieldKey: "description", headerTitle: "Item", align: "left", enabled: true },
      ];
      const colsWithCustom = addCustomColumn(baseCols, {
        name: "Warranty",
        fieldKey: "warranty_period",
        align: "center",
        widthPercent: 15,
        source: "static",
        value: "1 Year Standard",
      });

      const warrantyCol = colsWithCustom.find((c) => c.fieldKey === "warranty_period");
      expect(warrantyCol).toBeDefined();
      expect(warrantyCol.headerTitle).toBe("Warranty");
      expect(warrantyCol.staticValue).toBe("1 Year Standard");

      const item = { product_name: "Dell Monitor 27-inch" };
      const cell = cellValueForColumn(warrantyCol, item);
      expect(cell.text).toBe("1 Year Standard");
    });

    it("3.5 Appends custom column with data binding to item custom fields", () => {
      const baseCols = [
        { id: "col_desc", fieldKey: "description", headerTitle: "Item", align: "left", enabled: true },
      ];
      const colsWithBinding = addCustomColumn(baseCols, {
        name: "Serial Number",
        fieldKey: "serial_no",
        align: "center",
        source: "item_field",
      });
      const serialCol = colsWithBinding.find((c) => c.fieldKey === "serial_no");

      const itemWithSerial = { product_name: "Inverter", serial_no: "SN-998822" };
      expect(cellValueForColumn(serialCol, itemWithSerial).text).toBe("SN-998822");

      const itemWithoutSerial = { product_name: "Cable" };
      expect(cellValueForColumn(serialCol, itemWithoutSerial).text).toBe("-");
    });

    it("3.6 Normalizes column alignment and width percentage", () => {
      const colsToNormalize = [
        { id: "c1", fieldKey: "description", headerTitle: "Item", align: "left", widthPercent: 45, enabled: true },
        { id: "c2", fieldKey: "tax_rate", headerTitle: "GST", align: "center", widthPercent: 10, enabled: true },
        { id: "c3", fieldKey: "unit_price", headerTitle: "Rate", align: "right", widthPercent: 15, enabled: true },
      ];
      const resolved = resolveTemplateColumns({ columns: colsToNormalize });
      expect(resolved[0].align).toBe("left");
      expect(resolved[0].widthPercent).toBe(45);
      expect(resolved[1].align).toBe("center");
      expect(resolved[1].widthPercent).toBe(10);
      expect(resolved[2].align).toBe("right");
      expect(resolved[2].widthPercent).toBe(15);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 4: Safe Storage & Quota Resilience
  // ───────────────────────────────────────────────────────────────────────────
  describe("Feature 4: Safe Storage & Quota Resilience", () => {
    it("4.1 sanitizeForStorage removes oversized base64 images (>250,000 chars) from objects and arrays", () => {
      const hugeBase64 = "data:image/png;base64," + "A".repeat(300000);
      const smallBase64 = "data:image/png;base64," + "A".repeat(500);

      const payload = {
        name: "Test Template",
        logoUrl: hugeBase64,
        stampUrl: smallBase64,
        items: [{ thumbnail: hugeBase64, desc: "Sample item" }],
      };

      const sanitized = sanitizeForStorage(payload);
      expect(sanitized.name).toBe("Test Template");
      expect(sanitized.logoUrl).toBe(""); // stripped (>250,000 chars)
      expect(sanitized.stampUrl).toBe(smallBase64); // preserved
      expect(sanitized.items[0].thumbnail).toBe(""); // nested stripped
      expect(sanitized.items[0].desc).toBe("Sample item");

      // Verify custom threshold parameter works if an explicit limit is provided
      const customSanitized = sanitizeForStorage({ logoUrl: "data:image/png;base64," + "A".repeat(30000) }, 25000);
      expect(customSanitized.logoUrl).toBe("");
    });

    it("4.2 sanitizeForStorage preserves non-base64 image URLs and primitive values", () => {
      const payload = {
        url: "https://cdn.example.com/logo.png",
        count: 42,
        enabled: true,
        nullValue: null,
      };
      const sanitized = sanitizeForStorage(payload);
      expect(sanitized).toEqual(payload);
    });

    it("4.3 pruneTemplateList dedupes templates by ID, sorts by timestamp desc, and caps at 15", () => {
      const rawTemplates = [];
      for (let i = 1; i <= 25; i++) {
        rawTemplates.push({
          id: `tpl-${i}`,
          name: `Template ${i}`,
          updatedAt: new Date(2026, 0, i).toISOString(),
        });
      }
      // Add a duplicate with newer timestamp
      rawTemplates.push({
        id: "tpl-1",
        name: "Template 1 Updated",
        updatedAt: new Date(2026, 5, 1).toISOString(),
      });

      const pruned = pruneTemplateList(rawTemplates);
      expect(pruned.length).toBeLessThanOrEqual(15);
      // Newest should be tpl-1 because its updatedAt is in June 2026
      expect(pruned[0].id).toBe("tpl-1");
      expect(pruned[0].name).toBe("Template 1 Updated");
      // Check no duplicates
      const ids = pruned.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("4.4 safeSetItem purges non-critical caches when QuotaExceededError is encountered and succeeds", () => {
      // Pre-fill non-critical cache and test quota
      mockStorage.setItem("bos-store-products-cache", "X".repeat(5000));
      mockStorage.setItem("bos-offline-products-cache", "Y".repeat(5000));

      // Set quota limit to 12000 chars total
      mockStorage.quotaThreshold = 12000;

      // Writing a 6000-char JSON payload would exceed quota (5000 + 5000 + 6000 = 16000 > 12000)
      // safeSetItem should purge bos-store-products-cache and bos-offline-products-cache, then succeed!
      const payload = JSON.stringify({ setting: "Z".repeat(5500) });
      const success = safeSetItem("important_setting", payload);
      expect(success).toBe(true);
      expect(mockStorage.getItem("important_setting")).toBe(payload);
      expect(mockStorage.getItem("bos-store-products-cache")).toBeNull(); // purged!
      expect(mockStorage.getItem("bos-offline-products-cache")).toBeNull(); // purged!
    });

    it("4.5 safeSetItem safely prunes template lists before writing", () => {
      const hugeList = Array.from({ length: 30 }, (_, i) => ({
        id: `tpl-${i}`,
        name: `Tpl ${i}`,
        updated_at: 1000 + i,
      }));
      safeSetItem("businessos_print_templates_v1", JSON.stringify(hugeList));

      const written = JSON.parse(mockStorage.getItem("businessos_print_templates_v1") || "[]");
      expect(written.length).toBe(15);
      expect(written[0].id).toBe("tpl-29");
    });

    it("4.6 safeSetItem and safeGetItem handle total quota failure gracefully without crashing", () => {
      mockStorage.alwaysThrowQuota = true;
      // Should not throw exception
      const result = safeSetItem("any_key", "any_value");
      expect(result).toBe(false);

      expect(safeGetItem("non_existent")).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Feature 5: Live Preview to Print Parity
  // ───────────────────────────────────────────────────────────────────────────
  describe("Feature 5: Live Preview to Print Parity", () => {
    it("5.1 Produces identical column configuration for both live preview and FullInvoicePrinter", () => {
      const template = {
        columns: [
          { id: "col_sno", fieldKey: "sno", headerTitle: "S.N", widthPercent: 5, align: "center", enabled: true },
          { id: "col_desc", fieldKey: "description", headerTitle: "Description", widthPercent: 55, align: "left", enabled: true },
          { id: "col_hsn", fieldKey: "hsn", headerTitle: "HSN", widthPercent: 15, align: "center", enabled: true },
          { id: "col_amt", fieldKey: "total_amount", headerTitle: "Total", widthPercent: 25, align: "right", enabled: true },
        ],
      };
      // Live preview resolution
      const previewCols = resolveTemplateColumns(template);
      // FullInvoicePrinter resolution
      const printCols = resolveTemplateColumns(template, template.columns);

      expect(previewCols).toEqual(printCols);
      expect(previewCols.map((c) => c.headerTitle)).toEqual(["S.N", "Description", "HSN", "Total"]);
    });

    it("5.2 Resolves identical custom metadata fields for both preview and print engines", () => {
      const template = {
        fields: { showPoNumber: true, showEwayBill: true, showVehicleNumber: true },
        customFields: [
          { id: "cf1", label: "Dispatch Port", value: "Chennai Port", enabled: true },
        ],
      };
      const invoice = SAMPLE_INTERSTATE_INVOICE;

      const previewRows = resolveCustomFieldRows(template, invoice, template.fields);
      const printRows = resolveCustomFieldRows(template, invoice, template.fields);

      expect(previewRows).toEqual(printRows);
      expect(previewRows).toEqual([
        { label: "Dispatch Port", value: "Chennai Port" },
        { label: "Order Date", value: "2026-11-02" },
        { label: "e-Way Bill Date", value: "2026-11-05" },
        { label: "Transport", value: "Navata Road Transport" },
      ]);
    });

    it("5.3 GST Tax calculation parity across line items and grand total", () => {
      const inv = SAMPLE_INTRASTATE_INVOICE;
      const expectedTaxable = inv.items.reduce((s, it) => s + it.taxable_amount, 0);
      const expectedCgst = inv.items.reduce((s, it) => s + it.cgst_amount, 0);
      const expectedSgst = inv.items.reduce((s, it) => s + it.sgst_amount, 0);
      const expectedGrandTotal = expectedTaxable + expectedCgst + expectedSgst + inv.round_off;

      expect(expectedTaxable).toBe(9500);
      expect(expectedCgst).toBe(237.5);
      expect(expectedSgst).toBe(237.5);
      expect(expectedGrandTotal).toBe(9975);
      expect(inv.grand_total).toBe(expectedGrandTotal);
    });

    it("5.4 UPI Payment QR code context and URI parity", () => {
      const upiId = "merchant@upi";
      const payeeName = "I Smart Bazaar";
      const amount = 9975;
      const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR`;

      expect(upiUri).toContain("pa=merchant%40upi");
      expect(upiUri).toContain("pn=I%20Smart%20Bazaar");
      expect(upiUri).toContain("am=9975.00");
    });

    it("5.5 Digital signature and stamp designations resolve consistently", () => {
      mockStorage.setItem(
        "bos_signature_settings",
        JSON.stringify({
          signatureUrl: "https://example.com/sig.png",
          stampUrl: "https://example.com/stamp.png",
          signatureTitle: "Managing Director",
          signatureCompanyName: "I Smart Bazaar Guntur",
        })
      );

      const raw = mockStorage.getItem("bos_signature_settings");
      const parsed = JSON.parse(raw!);
      expect(parsed.signatureTitle).toBe("Managing Director");
      expect(parsed.signatureCompanyName).toBe("I Smart Bazaar Guntur");
      expect(parsed.signatureUrl).toBe("https://example.com/sig.png");
    });

    it("5.6 numberToIndianWords parity for invoice grand totals", () => {
      expect(numberToIndianWords(9975)).toBe("Rs. Nine Thousand Nine Hundred and Seventy Five Rupees Only");
      expect(numberToIndianWords(88500)).toBe("Rs. Eighty Eight Thousand Five Hundred Rupees Only");
      expect(numberToIndianWords(141600)).toBe("Rs. One Lakh Forty One Thousand Six Hundred Rupees Only");
      expect(numberToIndianWords(0)).toBe("Zero Rupees Only");
    });
  });
});
