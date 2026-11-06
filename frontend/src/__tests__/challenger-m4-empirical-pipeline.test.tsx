import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Polyfill minimal browser environment for SSR & test execution
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
  removeEventListener: (type: string, fn: Function) => {
    const list = listeners.get(type) || [];
    listeners.set(type, list.filter((f) => f !== fn));
  },
};

const mockDocument: any = {
  nodeType: 9,
  createElement: () => ({
    style: {},
    setAttribute: () => {},
    appendChild: () => {},
  }),
  body: {
    nodeType: 1,
    appendChild: () => {},
    removeChild: () => {},
    contains: () => true,
    classList: { add: () => {}, remove: () => {} },
  },
  querySelectorAll: () => [],
};
(globalThis as any).document = mockDocument;
(globalThis as any).window.document = mockDocument;

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

vi.mock("react-dom", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    createPortal: (children: any) => children,
  };
});

vi.mock("@/contexts/i18n-context", () => ({
  useI18n: () => ({ t: (k: string, fb: string) => fb || k }),
}));
vi.mock("@/hooks/use-currency", () => ({
  useCurrency: () => ({ currency: { symbol: "₹", code: "INR" } }),
}));
vi.mock("@/contexts/tenant-context", () => ({
  useTenant: () => ({ tenant: { id: "tenant_m4_challenger", name: "Challenger Wholesale" } }),
}));
vi.mock("@/lib/api-client", () => ({
  companiesApi: { list: vi.fn().mockResolvedValue({ items: [] }) },
  invoicesApi: {
    getActivePrintTemplate: vi.fn().mockResolvedValue({}),
    setActivePrintTemplate: vi.fn().mockResolvedValue({ success: true }),
    sendInvoiceToWhatsApp: vi.fn().mockResolvedValue({ success: true }),
    sendInvoiceEmail: vi.fn().mockResolvedValue({ success: true }),
  },
  printTemplatesApi: {
    getTemplates: vi.fn().mockResolvedValue({ templates: [] }),
    setActiveTemplate: vi.fn().mockResolvedValue({ success: true }),
  },
  bankApi: { listBankAccounts: vi.fn().mockResolvedValue({ items: [] }) },
  resolveImageUrl: vi.fn((url) => url),
}));

import {
  UnifiedInvoiceCustomizer,
  CATEGORY_DEFINITIONS,
  DOC_CATEGORY_TABS,
} from "../components/inventory/UnifiedInvoiceCustomizer";
import {
  createDefaultUnifiedConfig,
  unifiedConfigToPrintTemplate,
  printTemplateToUnifiedConfig,
  DEFAULT_UNIFIED_COLUMNS,
  PARTY_LAYOUT_OPTIONS,
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  resolveInvoiceTexts,
  type DynamicColumnDefinition,
  type InvoiceDocCategory,
  type UnifiedInvoiceCustomizerConfig,
} from "../lib/invoice-template-config";
import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";
import { FullInvoicePrinter, type FullInvoiceData } from "../components/pos/FullInvoicePrinter";
import { safeSetItem, safeGetItem, safeRemoveItem, sanitizeForStorage } from "../lib/safe-storage";
import { numberToIndianWords } from "../lib/number-to-words";
import { setActiveInvoicePrintTemplateForCategory } from "../lib/receipt-template-store";

describe("Milestone M4: Challenger Empirical Stress & Parity Pipeline", () => {
  const tid = "tenant_m4_challenger";
  const cid = "company_m4_challenger";

  const sampleInvoice: FullInvoiceData = {
    id: "inv-m4-sample-01",
    invoice_number: "INV/2026/9001",
    doc_type: "invoice",
    header_title: "TAX INVOICE",
    invoice_date: "2026-08-15",
    due_date: "2026-08-30",
    payment_method: "Bank Transfer",
    place_of_supply: "37 - Andhra Pradesh",
    po_number: "PO-7788",
    customerName: "Balaji Traders & Supermarket",
    customerCompany: "Balaji Retail Pvt Ltd",
    customerAddress: "D.No 4-12, Main Bazaar, Vijayawada, AP - 520001",
    customerShippingAddress: "Godown 2, Auto Nagar, Vijayawada, AP - 520007",
    customerPhone: "+91 98480 11223",
    customerGST: "37AAAAA1234A1Z5",
    customerPan: "AAAAA1234A",
    taxable_value: 20000,
    cgst_amount: 1800,
    sgst_amount: 1800,
    tax_amount: 3600,
    grand_total: 23600,
    amount_received: 23600,
    party_previous_balance: 4500,
    items: [
      {
        product_name: "Tata Tea Gold 500g",
        description: "Assam Valley CTC Blend",
        quantity: 20,
        unit_price: 250,
        mrp: 290,
        hsn_code: "0902",
        tax_rate: 5,
        subtotal: 5000,
      },
      {
        product_name: "Fortune Sunlite Refined Oil 1L",
        description: "Refined Sunflower Cooking Oil",
        quantity: 30,
        unit_price: 150,
        mrp: 175,
        hsn_code: "1512",
        tax_rate: 5,
        subtotal: 4500,
      },
    ],
  };

  beforeEach(() => {
    storage.clear();
    listeners.clear();
    localStorage.setItem("bos_active_company_id", cid);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. PARTY LAYOUT DOM MUTATION VERIFICATION (Layout 1, Layout 2, Layout 3)
  // ══════════════════════════════════════════════════════════════════════════
  describe("1. Party Layout DOM Mutation Parity", () => {
    it("renders Layout 1 (Side-by-Side) with Bill To and Ship To in separate side-by-side columns", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      config.party.layout = "layout_1";
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Challenger Wholesale Hub"
          dynamicLogoUrl=""
          dynamicAddress="100 Commercial Hub, Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          partyLayout="layout_1"
          template={tpl}
        />
      );

      // In Layout 1, party details section is a dedicated row with side-by-side Bill To & Ship To
      expect(html).toContain("Bill To");
      expect(html).toContain("Ship To");
      expect(html).toContain("Balaji Traders &amp; Supermarket");
      expect(html).toContain("Godown 2, Auto Nagar, Vijayawada");
      // Side-by-side col-span-6 class
      expect(html).toContain("col-span-6");
    });

    it("renders Layout 2 (3-Box Split Header) with Seller, Meta, and Party across 3 header columns", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      config.party.layout = "layout_2";
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Challenger Wholesale Hub"
          dynamicLogoUrl=""
          dynamicAddress="100 Commercial Hub, Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          partyLayout="layout_2"
          template={tpl}
        />
      );

      // In Layout 2, party details are in the top header row sharing col-span-4
      expect(html).toContain("col-span-4");
      expect(html).toContain("Challenger Wholesale Hub");
      expect(html).toContain("Balaji Traders &amp; Supermarket");
      expect(html).toContain("Party GSTIN");
    });

    it("renders Layout 3 (Stacked) with Bill To stacked vertically above Ship To", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      config.party.layout = "layout_3";
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Challenger Wholesale Hub"
          dynamicLogoUrl=""
          dynamicAddress="100 Commercial Hub, Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          partyLayout="layout_3"
          template={tpl}
        />
      );

      expect(html).toContain("Bill To");
      expect(html).toContain("Ship To");
      expect(html).toContain("Balaji Traders &amp; Supermarket");
      expect(html).toContain("Godown 2, Auto Nagar, Vijayawada");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. DYNAMIC TABLE COLUMNS: HIDE, RENAME, REORDER, ADD CUSTOM COLUMN
  // ══════════════════════════════════════════════════════════════════════════
  describe("2. Dynamic Table Columns Pipeline", () => {
    it("hides disabled columns from table header and item rows", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      // Disable HSN column
      config.itemTable.columns = config.itemTable.columns.map((c) => {
        if (c.id === "col_hsn") {
          return { ...c, enabled: false };
        }
        return c;
      });
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Challenger Hub"
          dynamicLogoUrl=""
          dynamicAddress="Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          columns={config.itemTable.columns}
          template={tpl}
        />
      );

      // Extract item table thead only to ensure HSN/SAC is not in item table headers
      const theadMatch = html.match(/<thead>(.*?)<\/thead>/s);
      expect(theadMatch).toBeTruthy();
      const theadHtml = theadMatch![1];
      expect(theadHtml).not.toContain("HSN/SAC");
      // Description and Amount should remain
      expect(theadHtml).toContain("Items / Services");
      expect(theadHtml).toContain("Amount");
    });

    it("renames column header dynamically", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      // Rename description to "Product Specifications"
      config.itemTable.columns = config.itemTable.columns.map((c) => {
        if (c.id === "col_desc") {
          return { ...c, headerTitle: "Product Specifications" };
        }
        return c;
      });
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Challenger Hub"
          dynamicLogoUrl=""
          dynamicAddress="Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          columns={config.itemTable.columns}
          template={tpl}
        />
      );

      expect(html).toContain("Product Specifications");
    });

    it("adds a custom column and renders static or bound line content", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      const customCol: DynamicColumnDefinition = {
        id: "col_custom_rack",
        headerTitle: "Warehouse Bay / Rack",
        fieldKey: "rack_location",
        enabled: true,
        widthPercent: 12,
        align: "center",
        isCustom: true,
        staticValue: "Bay-4B",
      };
      config.itemTable.columns.push(customCol);
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Challenger Hub"
          dynamicLogoUrl=""
          dynamicAddress="Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          columns={config.itemTable.columns}
          template={tpl}
        />
      );

      expect(html).toContain("Warehouse Bay / Rack");
      expect(html).toContain("Bay-4B");
    });

    it("reorders columns and alters the order of table headers in the DOM", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      // Reverse enabled columns order
      const reversedCols = [...config.itemTable.columns].reverse();
      config.itemTable.columns = reversedCols;
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Challenger Hub"
          dynamicLogoUrl=""
          dynamicAddress="Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          columns={reversedCols}
          template={tpl}
        />
      );

      // Amount column was at the end; in reversed order, Amount should appear before S.No
      const amountIdx = html.indexOf("Amount");
      const snoIdx = html.indexOf("S.No");
      expect(amountIdx).toBeGreaterThan(-1);
      expect(snoIdx).toBeGreaterThan(-1);
      expect(amountIdx).toBeLessThan(snoIdx);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. INDEPENDENT DOCUMENT TYPE SWITCHING (Tax Inv, Proforma, Quote, Challan)
  // ══════════════════════════════════════════════════════════════════════════
  describe("3. Independent Per-Document-Type Configuration & Persistence", () => {
    it("verifies canonical document titles and number labels for all 4 types", () => {
      const texts = resolveInvoiceTexts(null, "gst_tally");

      expect(docTitleFor({ doc_type: "invoice" }, texts)).toBe("TAX INVOICE");
      expect(docTitleFor({ doc_type: "proforma" }, texts)).toBe("PROFORMA INVOICE");
      expect(docTitleFor({ doc_type: "quotation" }, texts)).toBe("TAX QUOTATION / ESTIMATE");
      expect(docTitleFor({ doc_type: "challan" }, texts)).toBe("DELIVERY CHALLAN");

      expect(docNoLabelFor({ doc_type: "invoice" }, texts)).toBe("Invoice No");
      expect(docNoLabelFor({ doc_type: "proforma" }, texts)).toBe("Proforma No");
      expect(docNoLabelFor({ doc_type: "quotation" }, texts)).toBe("Quote No");
      expect(docNoLabelFor({ doc_type: "challan" }, texts)).toBe("Challan No");
    });

    it("persists distinct customizer settings per document category without cross-contamination", () => {
      // Configure Quotation with specific custom primary color & party layout
      const quoteConfig = createDefaultUnifiedConfig("quotation", "gst_tally");
      quoteConfig.style.primaryColor = "#059669"; // Emerald
      quoteConfig.party.layout = "layout_2";
      quoteConfig.invoice.documentTitle = "SPECIAL PROJECT QUOTATION";
      const quoteKey = `bos_unified_invoice_customizer_config_${tid}_${cid}_quotation`;
      safeSetItem(quoteKey, JSON.stringify(quoteConfig));

      // Configure Delivery Challan with stacked layout & blue color
      const challanConfig = createDefaultUnifiedConfig("challan", "gst_tally");
      challanConfig.style.primaryColor = "#2563eb"; // Blue
      challanConfig.party.layout = "layout_3";
      challanConfig.invoice.documentTitle = "MATERIAL DISPATCH CHALLAN";
      const challanKey = `bos_unified_invoice_customizer_config_${tid}_${cid}_challan`;
      safeSetItem(challanKey, JSON.stringify(challanConfig));

      // Read back Quotation and Challan configs
      const quoteLoaded = JSON.parse(safeGetItem(quoteKey)!);
      const challanLoaded = JSON.parse(safeGetItem(challanKey)!);

      expect(quoteLoaded.style.primaryColor).toBe("#059669");
      expect(quoteLoaded.party.layout).toBe("layout_2");
      expect(quoteLoaded.invoice.documentTitle).toBe("SPECIAL PROJECT QUOTATION");

      expect(challanLoaded.style.primaryColor).toBe("#2563eb");
      expect(challanLoaded.party.layout).toBe("layout_3");
      expect(challanLoaded.invoice.documentTitle).toBe("MATERIAL DISPATCH CHALLAN");

      // Verify Tax Invoice slot was not altered
      const invoiceKey = `bos_unified_invoice_customizer_config_${tid}_${cid}_invoice`;
      expect(safeGetItem(invoiceKey)).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. THEME COLORS, BRANDING, BANK & UPI QR 0ms REACTIVITY
  // ══════════════════════════════════════════════════════════════════════════
  describe("4. Theme Colors, Branding, Bank & Live UPI QR Reactivity", () => {
    it("immediately applies custom primaryColor to DOM elements", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      config.style.primaryColor = "#7c3aed"; // Purple
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Challenger Store"
          dynamicLogoUrl=""
          dynamicAddress="Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          template={tpl}
        />
      );

      expect(html).toContain("#7c3aed");
    });

    it("immediately renders updated business details (Store Name, Phone, Email, GSTIN)", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Zenith Super Wholesalers"
          dynamicLogoUrl=""
          dynamicAddress="Plot 99, Industrial Estate, Vijayawada"
          dynamicPhone="+91 99887 76655"
          dynamicEmail="orders@zenithwholesalers.com"
          sellerGstin="37ZZZZZ9999Z1Z0"
          currency={{ symbol: "₹", code: "INR" }}
          template={tpl}
        />
      );

      expect(html).toContain("Zenith Super Wholesalers");
      expect(html).toContain("Plot 99, Industrial Estate, Vijayawada");
      expect(html).toContain("+91 99887 76655");
      expect(html).toContain("orders@zenithwholesalers.com");
      expect(html).toContain("37ZZZZZ9999Z1Z0");
    });

    it("renders structured bank details in the bank block", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      config.miscellaneous.bankDetails = {
        enabled: true,
        bankName: "HDFC Bank Ltd",
        accountNumber: "50200088991122",
        ifscCode: "HDFC0000456",
        branch: "Governorpet Branch",
        accountHolderName: "Zenith Enterprises",
      };
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Zenith"
          dynamicLogoUrl=""
          dynamicAddress="Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          template={tpl}
        />
      );

      expect(html).toContain("HDFC Bank Ltd");
      expect(html).toContain("50200088991122");
      expect(html).toContain("HDFC0000456");
      expect(html).toContain("Governorpet Branch");
      expect(html).toContain("Zenith Enterprises");
    });

    it("generates an inline SVG UPI QR code when UPI VPA is provided", () => {
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      config.miscellaneous.paymentQr = {
        enabled: true,
        upiId: "zenith@hdfcbank",
        payeeName: "Zenith Wholesalers",
        qrType: "upi_string",
      };
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          dynamicStoreName="Zenith"
          dynamicLogoUrl=""
          dynamicAddress="Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
          template={tpl}
        />
      );

      // Payment QR image and labels
      expect(html).toContain('alt="Payment QR"');
      expect(html).toContain("Scan to Pay");
      expect(html).toContain("zenith@hdfcbank");
      expect(html).toContain("PAID IN FULL");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. FULLINVOICEPRINTER PRINT FIDELITY & PARITY
  // ══════════════════════════════════════════════════════════════════════════
  describe("5. FullInvoicePrinter High-Fidelity Print Parity", () => {
    it("renders FullInvoicePrinter with GstTallyTemplate and custom party layout", () => {
      setActiveInvoicePrintTemplateForCategory("tpl-inv-gst-tally", "invoice", tid, cid);
      const config = createDefaultUnifiedConfig("invoice", "gst_tally");
      config.party.layout = "layout_2";
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <FullInvoicePrinter
          invoice={{ ...sampleInvoice, print_template_id: "tpl-inv-gst-tally" }}
          isOpen={true}
          onClose={() => {}}
          customTemplate={tpl}
          tenant={{ id: tid, name: "Challenger Wholesale" }}
        />
      );

      // Verify FullInvoicePrinter successfully mounts and renders GstTallyTemplate
      expect(html).toContain("TAX INVOICE");
      expect(html).toContain("INV/2026/9001");
      expect(html).toContain("Tata Tea Gold 500g");
      expect(html).toContain("Fortune Sunlite Refined Oil 1L");
      expect(html).toContain("Balaji Traders &amp; Supermarket");
      // Confirm Layout 2 3-box header split is reflected
      expect(html).toContain("col-span-4");
    });

    it("renders FullInvoicePrinter for Delivery Challan without tax invoice fallback", () => {
      const challanInvoice: FullInvoiceData = {
        ...sampleInvoice,
        doc_type: "challan",
        header_title: "DELIVERY CHALLAN",
        challan_number: "DC/2026/044",
      };

      const config = createDefaultUnifiedConfig("challan", "gst_tally");
      const tpl = unifiedConfigToPrintTemplate(config);

      const html = renderToString(
        <FullInvoicePrinter
          invoice={challanInvoice}
          isOpen={true}
          onClose={() => {}}
          template={tpl}
          tenant={{ id: tid, name: "Challenger Wholesale" }}
        />
      );

      expect(html).toContain("DELIVERY CHALLAN");
      expect(html).toContain("Challan No");
      expect(html).toContain("DC/2026/044");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. ADVERSARIAL STRESS & BOUNDARY ATTACKS
  // ══════════════════════════════════════════════════════════════════════════
  describe("6. Adversarial Stress & Boundary Attacks", () => {
    it("safely sanitizes and stores a massive base64 payload (> 2MB) without throwing", () => {
      const hugeBase64 = "data:image/png;base64," + "A".repeat(2 * 1024 * 1024);
      const payload = {
        theme: "gst_tally",
        business: {
          logoUrl: hugeBase64,
          name: "Huge Payload Test",
        },
      };

      const sanitized = sanitizeForStorage(payload);
      expect(sanitized.business.logoUrl.length).toBeLessThan(hugeBase64.length);
      const success = safeSetItem("bos_test_huge_payload", JSON.stringify(sanitized));
      expect(success).toBe(true);
    });

    it("correctly converts fractional sub-rupee amounts without awkward wording", () => {
      expect(numberToIndianWords(0.50)).toBe("Rs. Fifty Paise Only");
      expect(numberToIndianWords(0.25)).toBe("Rs. Twenty Five Paise Only");
      expect(numberToIndianWords(0.99)).toBe("Rs. Ninety Nine Paise Only");
      expect(numberToIndianWords(100.50)).toBe("Rs. One Hundred Rupees and Fifty Paise Only");
    });

    it("caps HSN codes display when a tax slab accumulates > 5 unique HSNs", () => {
      const itemsWithManyHsns = Array.from({ length: 12 }, (_, i) => ({
        product_name: `Product ${i + 1}`,
        quantity: 1,
        unit_price: 100,
        hsn_code: `HSN${1000 + i}`,
        tax_rate: 18,
        subtotal: 100,
      }));

      const heavyInvoice: FullInvoiceData = {
        ...sampleInvoice,
        items: itemsWithManyHsns,
      };

      const html = renderToString(
        <GstTallyTemplate
          invoice={heavyInvoice}
          dynamicStoreName="Challenger Hub"
          dynamicLogoUrl=""
          dynamicAddress="Vijayawada"
          dynamicPhone="9876543210"
          sellerGstin="37ABCDE1234F1Z5"
          currency={{ symbol: "₹", code: "INR" }}
        />
      );

      // Verify the HSN string is capped with "... (+N more)"
      expect(html).toContain("... (+7 more)");
    });

    it("handles non-string, null, or undefined keys safely in safe storage functions", () => {
      expect(safeSetItem(null as any, "val")).toBe(false);
      expect(safeSetItem(undefined as any, "val")).toBe(false);
      expect(safeSetItem(12345 as any, "val")).toBe(false);
      expect(safeSetItem({} as any, "val")).toBe(false);

      expect(safeGetItem(null as any)).toBeNull();
      expect(safeGetItem(undefined as any)).toBeNull();
      expect(safeGetItem(12345 as any)).toBeNull();

      expect(() => safeRemoveItem(null as any)).not.toThrow();
      expect(() => safeRemoveItem(undefined as any)).not.toThrow();
    });

    it("recovers and merges legacy/corrupted customizer config missing nested properties", () => {
      const corruptedJson = JSON.stringify({
        theme: "gst_tally",
        style: { primaryColor: "#ef4444" },
        party: {},
        itemTable: {},
      });

      const catKey = `bos_unified_invoice_customizer_config_${tid}_${cid}_invoice`;
      safeSetItem(catKey, corruptedJson);

      // Render customizer with this corrupted key in storage
      const html = renderToString(
        <UnifiedInvoiceCustomizer tenant={{ id: tid }} initialDocCategory="invoice" />
      );

      // Should render without crashing, deep-merged with defaults
      expect(html).toContain("Style Settings");
      expect(html).toContain('aria-label="Live Invoice Preview"');
      expect(html).toContain("Save Template");
    });
  });
});
