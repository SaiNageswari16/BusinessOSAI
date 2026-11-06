import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Polyfill minimal browser environment for SSR & customizer tests
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
  type CustomizerCategory,
} from "../components/inventory/UnifiedInvoiceCustomizer";
import {
  createDefaultUnifiedConfig,
  unifiedConfigToPrintTemplate,
  DEFAULT_UNIFIED_COLUMNS,
  type DynamicColumnDefinition,
  type InvoiceDocCategory,
} from "../lib/invoice-template-config";
import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";
import { safeSetItem } from "../lib/safe-storage";

describe("Challenger M3: Layout & Live Preview Reactivity Empirical Matrix", () => {
  const tid = "tenant_challenger_m3";
  const cid = "company_challenger_m3";

  beforeEach(() => {
    storage.clear();
    listeners.clear();
    localStorage.setItem("bos_active_company_id", cid);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test Suite 1: Left Rail Category Toggling & Right Panel Form Controls
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 1: Left Rail Category Toggling & Right Panel Form Controls", () => {
    const testCases: {
      category: CustomizerCategory;
      expectedTitle: string;
      expectedControls: string[];
      prohibitedControls: string[];
    }[] = [
      {
        category: "style",
        expectedTitle: "Style Settings",
        expectedControls: [
          "Theme Style Preset",
          "Theme Colors",
          "Primary Color",
          "Secondary / Accent Color",
          "Typography",
          "Font Family",
          "Scale / Density",
        ],
        prohibitedControls: [
          "Select Party Layout",
          "Paper Geometry",
          "Company Legal Name",
          "Document Header Title",
          "Table Columns",
          "UPI Payment QR",
        ],
      },
      {
        category: "print",
        expectedTitle: "Print Settings",
        expectedControls: [
          "Paper Geometry",
          "Orientation",
          "Multi-Page &amp; Options",
          "Repeat Header on Multi-Page",
          "Print Page Numbers",
          "Print Background Graphics",
        ],
        prohibitedControls: [
          "Theme Style Preset",
          "Select Party Layout",
          "Company Legal Name",
          "Table Columns",
          "UPI Payment QR",
        ],
      },
      {
        category: "business",
        expectedTitle: "Business Details",
        expectedControls: [
          "Company Logo",
          "Upload Business Logo",
          "Show Logo",
          "Logo Height",
        ],
        prohibitedControls: [
          "Theme Style Preset",
          "Paper Geometry",
          "Select Party Layout",
          "Table Columns",
          "UPI Payment QR",
        ],
      },
      {
        category: "invoice",
        expectedTitle: "Invoice Details",
        expectedControls: [
          "Metadata Visibility Switches",
          "Invoice Number",
          "Invoice Date",
          "Due Date",
          "PO Reference",
          "e-Way Bill",
          "Vehicle Number",
        ],
        prohibitedControls: [
          "Theme Style Preset",
          "Paper Geometry",
          "Select Party Layout",
          "Table Columns",
          "UPI Payment QR",
        ],
      },
      {
        category: "party",
        expectedTitle: "Party Details",
        expectedControls: [
          "Select Party Layout",
          "Layout 1",
          "Layout 2",
          "Layout 3",
          "Side-by-Side",
          "3-Box Split",
          "Stacked",
          "Box Border Styling",
        ],
        prohibitedControls: [
          "Theme Style Preset",
          "Paper Geometry",
          "Company Logo",
          "Table Columns",
          "UPI Payment QR",
        ],
      },
      {
        category: "itemTable",
        expectedTitle: "Item Table",
        expectedControls: [
          "Table Columns",
          "Add Column",
          "Table Visual Appearance",
          "Zebra Striping",
          "Vertical Borders",
          "Header Background Color",
          "Totals &amp; Summary Calculations",
        ],
        prohibitedControls: [
          "Theme Style Preset",
          "Paper Geometry",
          "Select Party Layout",
          "Company Logo",
          "UPI Payment QR",
        ],
      },
      {
        category: "miscellaneous",
        expectedTitle: "Miscellaneous",
        expectedControls: [
          "UPI Payment QR",
          "Signatures &amp; Company Stamp",
          "Signature",
          "Stamp Seal",
        ],
        prohibitedControls: [
          "Theme Style Preset",
          "Paper Geometry",
          "Select Party Layout",
          "Company Logo",
          "Table Columns",
        ],
      },
    ];

    testCases.forEach(({ category, expectedTitle, expectedControls, prohibitedControls }) => {
      it(`toggling to category "${category}" displays active controls for "${expectedTitle}" and excludes other categories`, () => {
        const html = renderToString(
          <UnifiedInvoiceCustomizer
            tenant={{ id: tid, name: "Empirical Enterprise" }}
            initialCategory={category}
            initialDocCategory="invoice"
          />
        );

        // Header Title in Right Panel
        expect(html).toContain(expectedTitle);

        // Positive assertions: Controls for this category MUST exist
        expectedControls.forEach((controlText) => {
          expect(html).toContain(controlText);
        });

        // Negative assertions: Controls from other categories MUST NOT appear in this panel
        prohibitedControls.forEach((prohibitedText) => {
          expect(html).not.toContain(prohibitedText);
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test Suite 2: Switching Party Layout Alters Rendered DOM & Container Classes
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 2: Party Layout Switching & GstTallyTemplate DOM Parity", () => {
    const mockInvoice: any = {
      id: "inv-party-test",
      invoice_number: "INV-2026-CHALLENGE",
      invoice_date: "2026-11-06",
      customerName: "Apollo MedPlus Wholesale",
      customerBillingAddress: "Plot 42, Arundelpet, Guntur, AP - 522002",
      customerShippingAddress: "Warehouse 7, Auto Nagar, Vijayawada, AP - 520007",
      customerGST: "37AAAAA0000A1Z5",
      customerPhone: "+91 94401 23456",
      items: [{ product_name: "Paracetamol 650mg", quantity: 100, unit_price: 30, subtotal: 3000 }],
      grand_total: 3000,
      subtotal: 3000,
    };

    it("Party Layout 1 (Side-by-Side): renders 2-box partitioned party grid with col-span-6 and no 3rd header box", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.party.layout = "layout_1";
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={mockInvoice}
          template={tpl}
          partyLayout="layout_1"
          columns={config.itemTable.columns}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName="Test Seller Store"
          sellerGstin="37TESTSELLER1Z0"
          dynamicAddress="Main Bazaar, Guntur"
          dynamicPhone="+91 98765 00000"
        />
      );

      // Verify Side-by-Side structure
      expect(html).toContain("col-span-6 border-r-2");
      expect(html).toContain("Apollo MedPlus Wholesale");
      expect(html).toContain("Plot 42, Arundelpet, Guntur");
      expect(html).toContain("Warehouse 7, Auto Nagar, Vijayawada");
      expect(html).toContain("bg-slate-50/40"); // Ship to background tint in Layout 1

      // Verify Header row does NOT contain the 3-box party split
      // In Layout 1, Seller is col-span-6 and Meta is col-span-6
      expect(html).toContain("col-span-6 border-r-2");
      expect(html).not.toContain("col-span-4 border-r-2");
    });

    it("Party Layout 2 (3-Box Split): renders Seller, Meta, and Party as 3 equal col-span-4 columns in the header", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.party.layout = "layout_2";
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={mockInvoice}
          template={tpl}
          partyLayout="layout_2"
          columns={config.itemTable.columns}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName="Test Seller Store"
          sellerGstin="37TESTSELLER1Z0"
          dynamicAddress="Main Bazaar, Guntur"
          dynamicPhone="+91 98765 00000"
        />
      );

      // Verify 3-box split columns in header
      expect(html).toContain("col-span-4 border-r-2");
      expect(html).toContain("Apollo MedPlus Wholesale");

      // Verify that the separate Layout 1 side-by-side party container is NOT rendered
      expect(html).not.toContain("bg-slate-50/40");
    });

    it("Party Layout 3 (Stacked): renders Bill To and Ship To in full-width stacked rows", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.party.layout = "layout_3";
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={mockInvoice}
          template={tpl}
          partyLayout="layout_3"
          columns={config.itemTable.columns}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName="Test Seller Store"
          sellerGstin="37TESTSELLER1Z0"
          dynamicAddress="Main Bazaar, Guntur"
          dynamicPhone="+91 98765 00000"
        />
      );

      // Verify stacked rows
      expect(html).toContain("Apollo MedPlus Wholesale");
      expect(html).toContain("Plot 42, Arundelpet, Guntur");
      expect(html).toContain("Warehouse 7, Auto Nagar, Vijayawada");
      // Layout 3 does not partition party into col-span-6 boxes
      expect(html).not.toContain("col-span-4 border-r-2");
    });

    it("live customizer integration: modifying stored party layout immediately updates preview canvas DOM", () => {
      const configKey = `bos_unified_invoice_customizer_config_${tid}_${cid}_invoice`;

      // 1. Set Layout 2 in storage
      const customConfig = createDefaultUnifiedConfig("invoice");
      customConfig.party.layout = "layout_2";
      safeSetItem(configKey, JSON.stringify(customConfig));

      const htmlLayout2 = renderToString(
        <UnifiedInvoiceCustomizer
          tenant={{ id: tid, name: "Empirical Enterprise" }}
          initialCategory="party"
          initialDocCategory="invoice"
        />
      );

      // Center preview canvas GstTallyTemplate must render with 3-box split (col-span-4)
      expect(htmlLayout2).toContain("col-span-4 border-r-2");
      expect(htmlLayout2).toContain("Layout 2: 3-Box Header Split");

      // 2. Switch to Layout 1 in storage
      customConfig.party.layout = "layout_1";
      safeSetItem(configKey, JSON.stringify(customConfig));

      const htmlLayout1 = renderToString(
        <UnifiedInvoiceCustomizer
          tenant={{ id: tid, name: "Empirical Enterprise" }}
          initialCategory="party"
          initialDocCategory="invoice"
        />
      );

      // Center preview canvas GstTallyTemplate must render with side-by-side (bg-slate-50/40)
      expect(htmlLayout1).toContain("bg-slate-50/40");
      expect(htmlLayout1).toContain("Layout 1: Side-by-Side");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test Suite 3: Dynamic Table Columns (Hide, Rename, Custom, Reorder)
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 3: Dynamic Table Columns Reactivity", () => {
    const mockInvoice: any = {
      id: "inv-cols-test",
      invoice_number: "INV-COLS-001",
      customerName: "Sri Rama Trading Co",
      items: [
        {
          product_name: "Tata Tea Gold 500g",
          quantity: 20,
          unit_price: 250,
          discount_value: 50,
          tax_rate: 5,
          subtotal: 4950,
          hsn_code: "0902",
          batch_no: "BATCH-TG-88",
          warranty: "24 Months Manufacturer",
        },
      ],
      grand_total: 4950,
    };

    it("hiding columns (HSN & Discount) immediately removes their <th> from GstTallyTemplate", () => {
      const config = createDefaultUnifiedConfig("invoice");
      // Disable HSN and Discount
      config.itemTable.columns = config.itemTable.columns.map((c) =>
        c.fieldKey === "hsn" || c.fieldKey === "discount" ? { ...c, enabled: false } : c
      );
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={mockInvoice}
          template={tpl}
          columns={config.itemTable.columns}
          f={tpl.fields}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName="Test Store"
          sellerGstin="37TEST0001"
          dynamicAddress="Guntur"
          dynamicPhone="9876543210"
        />
      );

      // Active column <th> elements must exist
      expect(html).toMatch(/<th[^>]*>Items \/ Services<\/th>/);
      expect(html).toMatch(/<th[^>]*>Qty<\/th>/);
      expect(html).toMatch(/<th[^>]*>Rate<\/th>/);
      expect(html).toMatch(/<th[^>]*>Amount<\/th>/);

      // Disabled column <th> elements must NOT exist in the table header
      expect(html).not.toMatch(/<th[^>]*>HSN\/SAC<\/th>/);
      expect(html).not.toMatch(/<th[^>]*>Disc<\/th>/);
    });

    it("renaming column headers immediately alters <th> text output", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.itemTable.columns = config.itemTable.columns.map((c) => {
        if (c.fieldKey === "description") return { ...c, headerTitle: "Product Catalog Description" };
        if (c.fieldKey === "unit_price") return { ...c, headerTitle: "Dealer Price Ex-Tax (₹)" };
        return c;
      });
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={mockInvoice}
          template={tpl}
          columns={config.itemTable.columns}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName="Test Store"
          sellerGstin="37TEST0001"
          dynamicAddress="Guntur"
          dynamicPhone="9876543210"
        />
      );

      expect(html).toContain("Product Catalog Description");
      expect(html).toContain("Dealer Price Ex-Tax (₹)");
    });

    it("adding custom columns renders the new column header and binds item data", () => {
      const config = createDefaultUnifiedConfig("invoice");
      const customCol1: DynamicColumnDefinition = {
        id: "col_custom_batch",
        fieldKey: "batch_no",
        headerTitle: "Mfg Batch Code",
        widthPercent: 12,
        align: "center",
        enabled: true,
        isCustom: true,
      };
      const customCol2: DynamicColumnDefinition = {
        id: "col_custom_warranty",
        fieldKey: "warranty",
        headerTitle: "Warranty Period",
        widthPercent: 15,
        align: "center",
        enabled: true,
        isCustom: true,
      };
      config.itemTable.columns.push(customCol1, customCol2);
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={mockInvoice}
          template={tpl}
          columns={config.itemTable.columns}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName="Test Store"
          sellerGstin="37TEST0001"
          dynamicAddress="Guntur"
          dynamicPhone="9876543210"
        />
      );

      // Headers rendered
      expect(html).toContain("Mfg Batch Code");
      expect(html).toContain("Warranty Period");

      // Cell data bound from mockInvoice item
      expect(html).toContain("BATCH-TG-88");
      expect(html).toContain("24 Months Manufacturer");
    });

    it("reordering columns alters the relative sequence of <th> elements in the DOM", () => {
      const config = createDefaultUnifiedConfig("invoice");
      // Put Qty first, Amount second, Description third
      const qtyCol = config.itemTable.columns.find((c) => c.fieldKey === "quantity")!;
      const amtCol = config.itemTable.columns.find((c) => c.fieldKey === "total_amount")!;
      const descCol = config.itemTable.columns.find((c) => c.fieldKey === "description")!;
      config.itemTable.columns = [qtyCol, amtCol, descCol];
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={mockInvoice}
          template={tpl}
          columns={config.itemTable.columns}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName="Test Store"
          sellerGstin="37TEST0001"
          dynamicAddress="Guntur"
          dynamicPhone="9876543210"
        />
      );

      const qtyPos = html.indexOf(">Qty<");
      const amtPos = html.indexOf(">Amount<");
      const descPos = html.indexOf(">Items / Services<");

      expect(qtyPos).toBeGreaterThan(-1);
      expect(amtPos).toBeGreaterThan(-1);
      expect(descPos).toBeGreaterThan(-1);

      // Verify sequence: Qty < Amount < Description
      expect(qtyPos).toBeLessThan(amtPos);
      expect(amtPos).toBeLessThan(descPos);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test Suite 4: Real-Time Preview Updating (Theme, Business, Bank, UPI QR)
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 4: Real-Time Preview Props Reactivity", () => {
    const configKey = `bos_unified_invoice_customizer_config_${tid}_${cid}_invoice`;

    it("updating primary theme colors immediately reflects in GstTallyTemplate inline styling", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.style.primaryColor = "#e11d48"; // Rose-600
      safeSetItem(configKey, JSON.stringify(config));

      const html = renderToString(
        <UnifiedInvoiceCustomizer
          tenant={{ id: tid, name: "Empirical Enterprise" }}
          initialCategory="style"
          initialDocCategory="invoice"
        />
      );

      // Check primary color tint in GstTallyTemplate rendered markup
      expect(html).toContain("#e11d48");
      expect(html).toContain("#e11d4860"); // border tint
      expect(html).toContain("#e11d4810"); // background tint
    });

    it("updating business details immediately updates the rendered preview seller header", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.business.companyName = "Apex Global Infotech Ltd";
      config.business.address = "77 Tech Boulevard, Cyber City, Hyderabad, TG";
      config.business.phone = "+91 99887 66554";
      config.business.gstin = "36ABCDE9999F1Z2";
      safeSetItem(configKey, JSON.stringify(config));

      const html = renderToString(
        <UnifiedInvoiceCustomizer
          tenant={{ id: tid, name: "Empirical Enterprise" }}
          initialCategory="business"
          initialDocCategory="invoice"
        />
      );

      expect(html).toContain("Apex Global Infotech Ltd");
      expect(html).toContain("77 Tech Boulevard, Cyber City");
      expect(html).toContain("+91 99887 66554");
      expect(html).toContain("36ABCDE9999F1Z2");
    });

    it("updating bank account details immediately reflects in GstTallyTemplate bank section", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.miscellaneous.bankDetails.enabled = true;
      config.miscellaneous.bankDetails.bankName = "Kotak Mahindra Bank";
      config.miscellaneous.bankDetails.accountNumber = "998877665544";
      config.miscellaneous.bankDetails.ifscCode = "KKBK0000123";
      config.miscellaneous.bankDetails.branch = "Banjara Hills Branch";
      safeSetItem(configKey, JSON.stringify(config));

      const html = renderToString(
        <UnifiedInvoiceCustomizer
          tenant={{ id: tid, name: "Empirical Enterprise" }}
          initialCategory="miscellaneous"
          initialDocCategory="invoice"
        />
      );

      expect(html).toContain("Kotak Mahindra Bank");
      expect(html).toContain("998877665544");
      expect(html).toContain("KKBK0000123");
      expect(html).toContain("Banjara Hills Branch");
    });

    it("updating UPI Payment QR immediately generates and renders live QR in preview", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.miscellaneous.paymentQr.enabled = true;
      config.miscellaneous.paymentQr.upiId = "empiricalpay@icici";
      config.miscellaneous.paymentQr.payeeName = "Empirical Merchant";
      safeSetItem(configKey, JSON.stringify(config));

      const tpl = unifiedConfigToPrintTemplate(config);
      const html = renderToString(
        <UnifiedInvoiceCustomizer
          tenant={{ id: tid, name: "Empirical Enterprise" }}
          initialCategory="miscellaneous"
          initialDocCategory="invoice"
        />
      );

      // Verify customizer right panel and live center canvas preview both render UPI ID
      const upiMatches = html.match(/empiricalpay@icici/g) || [];
      expect(upiMatches.length).toBeGreaterThanOrEqual(2); // once in right input, once in center preview
      expect(html).toContain('alt="Payment QR"');

      // Also render GstTallyTemplate directly with resolvedPaymentQr and tpl
      const directHtml = renderToString(
        <GstTallyTemplate
          invoice={{
            invoice_number: "INV-001",
            grand_total: 1000,
            amount_received: 0,
            balance_due: 1000,
            items: [{ product_name: "Item", quantity: 1, unit_price: 1000, subtotal: 1000 }],
          }}
          template={tpl}
          f={tpl.fields}
          texts={tpl.texts}
          paymentQr={{
            enabled: true,
            upiId: "empiricalpay@icici",
            payeeName: "Empirical Merchant",
            customImageUrl: null,
            qrType: "dynamic_upi",
            caption: "Scan & Pay with UPI",
            size: "medium",
          } as any}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName="Empirical Enterprise"
          sellerGstin="37TEST0001"
          dynamicAddress="Guntur"
          dynamicPhone="9876543210"
        />
      );

      // Direct rendering must show the QR
      expect(directHtml).toContain("empiricalpay@icici");
      expect(directHtml).toContain('alt="Payment QR"');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test Suite 5: Adversarial Edge Cases & Fault Tolerance
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 5: Adversarial Edge Cases & Fault Tolerance", () => {
    it("survives corrupted / malformed localStorage customizer config gracefully without crash", () => {
      const configKey = `bos_unified_invoice_customizer_config_${tid}_${cid}_invoice`;
      // Set corrupt string
      safeSetItem(configKey, "INVALID_JSON_CORRUPTED{{{&&&");

      expect(() => {
        const html = renderToString(
          <UnifiedInvoiceCustomizer
            tenant={{ id: tid, name: "Empirical Enterprise" }}
            initialCategory="party"
            initialDocCategory="invoice"
          />
        );
        // Falls back safely to default config
        expect(html).toContain("Invoice Template Customizer");
        expect(html).toContain("Layout 1");
      }).not.toThrow();
    });

    it("handles currency formatted as string, object, or undefined without runtime exception", () => {
      const config = createDefaultUnifiedConfig("invoice");
      const tpl = unifiedConfigToPrintTemplate(config);
      const invoice: any = {
        invoice_number: "INV-CURR-01",
        customerName: "Anonymous",
        items: [{ product_name: "Item", quantity: 1, unit_price: 100, subtotal: 100 }],
        grand_total: 100,
      };

      // 1. Currency as string "₹"
      expect(() => {
        renderToString(
          <GstTallyTemplate
            invoice={invoice}
            template={tpl}
            currency={"₹" as any}
            dynamicStoreName="Test"
            sellerGstin="37TEST"
            dynamicAddress="Address"
            dynamicPhone="Phone"
          />
        );
      }).not.toThrow();

      // 2. Currency as object { symbol: "$", code: "USD" }
      expect(() => {
        renderToString(
          <GstTallyTemplate
            invoice={invoice}
            template={tpl}
            currency={{ symbol: "$", code: "USD" }}
            dynamicStoreName="Test"
            sellerGstin="37TEST"
            dynamicAddress="Address"
            dynamicPhone="Phone"
          />
        );
      }).not.toThrow();

      // 3. Currency as undefined
      expect(() => {
        renderToString(
          <GstTallyTemplate
            invoice={invoice}
            template={tpl}
            currency={undefined as any}
            dynamicStoreName="Test"
            sellerGstin="37TEST"
            dynamicAddress="Address"
            dynamicPhone="Phone"
          />
        );
      }).not.toThrow();
    });

    it("escapes potentially malicious XSS payloads in custom column headers and business details", () => {
      const config = createDefaultUnifiedConfig("invoice");
      config.business.companyName = '<script>alert("xss")</script><b>Bold Store</b>';
      config.itemTable.columns.push({
        id: "col_xss",
        fieldKey: "xss",
        headerTitle: '<img src=x onerror=alert(1)>Malicious Header',
        enabled: true,
        isCustom: true,
      });
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={{
            invoice_number: "INV-XSS",
            customerName: "Test Party",
            items: [{ product_name: "Safe Item", quantity: 1, unit_price: 10 }],
            grand_total: 10,
          }}
          template={tpl}
          columns={config.itemTable.columns}
          currency={{ symbol: "₹", code: "INR" }}
          dynamicStoreName={config.business.companyName}
          sellerGstin="37XSS0001"
          dynamicAddress="Street"
          dynamicPhone="000"
        />
      );

      // React must properly encode HTML entities, preventing raw script/img execution
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });
  });
});
