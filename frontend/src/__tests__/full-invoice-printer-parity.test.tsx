import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import fs from "fs";
import path from "path";

// Mock local storage and browser events
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

// Mock React contexts used by FullInvoicePrinter
vi.mock("@/contexts/i18n-context", () => ({
  useI18n: () => ({ t: (k: string, fb: string) => fb || k }),
}));
vi.mock("@/hooks/use-currency", () => ({
  useCurrency: () => ({ currency: { symbol: "₹", code: "INR" } }),
}));
vi.mock("@/contexts/tenant-context", () => ({
  useTenant: () => ({ tenant: { id: "test_tenant", name: "Test Corp" } }),
}));

// Mock APIs to avoid network requests
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

import { FullInvoicePrinter, type FullInvoiceData } from "../components/pos/FullInvoicePrinter";
import {
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  setActiveInvoicePrintTemplate,
} from "../lib/receipt-template-store";

describe("Adversarial Print Parity & Category Isolation in FullInvoicePrinter", () => {
  const tid = "test_tenant";
  const cid = "test_company";

  const baseDeliveryChallan: FullInvoiceData = {
    id: "dc-001",
    doc_type: "delivery_challan",
    invoice_number: "DC-2026-001",
    invoice_date: "2026-11-05",
    customerName: "Omega Logistics Hub",
    customerBillingAddress: "Gate 4, Industrial Zone, Hyderabad",
    customerShippingAddress: "Site Warehouse 2, Outer Ring Road",
    customerPhone: "9876543210",
    customerGST: "36AABCO1234F1Z9",
    grand_total: 45000,
    items: [
      {
        product_name: "Industrial Ball Bearings 6204",
        quantity: 100,
        unit_price: 450,
        tax_rate: 18,
        subtotal: 45000,
      },
    ],
  };

  const baseQuotation: FullInvoiceData = {
    id: "qt-001",
    doc_type: "quotation",
    quote_number: "QT-2026-888",
    invoice_number: "QT-2026-888",
    invoice_date: "2026-11-05",
    customerName: "Alpha Consulting",
    customerBillingAddress: "Tower B, Hi-Tech City, Hyderabad",
    customerPhone: "9123456780",
    grand_total: 12000,
    items: [
      {
        product_name: "Enterprise Architecture Consultation",
        quantity: 1,
        unit_price: 12000,
        tax_rate: 18,
        subtotal: 12000,
      },
    ],
  };

  beforeEach(() => {
    storage.clear();
    listeners.clear();
    storageMock.setItem("bos_active_company_id", cid);
  });

  describe("1. Document Category Isolation in FullInvoicePrinter", () => {
    it("1.1 Delivery Challan stays isolated to configured template and does not revert to Tax Invoice template", () => {
      // Configure Tax Invoice to FMCG distributor
      setActiveInvoicePrintTemplate("tpl-inv-fmcg-distributor", tid);

      // Configure Delivery Challan specifically to GST Tally
      setActiveInvoicePrintTemplateForCategory("tpl-inv-gst-tally", "challan", tid, cid);

      expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("tpl-inv-gst-tally");

      // Render FullInvoicePrinter with Delivery Challan
      const html = renderToString(
        <FullInvoicePrinter
          isOpen={true}
          onClose={() => {}}
          invoice={baseDeliveryChallan}
        />
      );

      // Verify Delivery Challan renders GstTallyTemplate (myBillBook style)
      // and NOT FmcgDistributorTemplate (which was set for Tax Invoice)
      expect(html).toContain("DC-2026-001");
      expect(html).toContain("Challan No");
      expect(html).toContain("Omega Logistics Hub");
      expect(html).toContain("Industrial Ball Bearings 6204");

      // Verify the active template dropdown selected option is tpl-inv-gst-tally
      expect(html).toContain('value="tpl-inv-gst-tally" selected');

      // FMCG Distributor specific elements must NOT be present in printable area
      expect(html).not.toContain("FOOD & FMCG WHOLESALE INVOICE");
      expect(html).not.toContain("fmcg-distributor-template");
    });

    it("1.2 Quotation stays isolated to Marg Pharma and does not follow master Tax Invoice updates", () => {
      // 1. Configure Quotation to Marg Pharma
      setActiveInvoicePrintTemplateForCategory("tpl-inv-marg-pharma", "quotation", tid, cid);

      // 2. Update master Tax Invoice to GST Tally
      setActiveInvoicePrintTemplate("tpl-inv-gst-tally", tid);

      // 3. Render Quotation
      const html = renderToString(
        <FullInvoicePrinter
          isOpen={true}
          onClose={() => {}}
          invoice={baseQuotation}
        />
      );

      // Quotation should render with Quotation doc title and Marg pharma theme attributes
      expect(html).toContain("QT-2026-888");
      expect(html).toContain("Alpha Consulting");

      // Verify category slot is preserved
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-inv-marg-pharma");
    });
  });

  describe("2. Full Prop Forwarding to GstTallyTemplate", () => {
    const gstTallyInvoice: FullInvoiceData = {
      ...baseDeliveryChallan,
      template_id: "tpl-inv-gst-tally",
      print_template_id: "tpl-inv-gst-tally",
    };

    it("2.1 forwards partyLayout (layout_1, layout_2, layout_3) correctly", () => {
      // Layout 1: Side by side Bill To / Customer and Ship To / Destination
      const htmlL1 = renderToString(
        <FullInvoicePrinter
          isOpen={true}
          onClose={() => {}}
          invoice={gstTallyInvoice}
          customTemplate={{
            id: "tpl-inv-gst-tally",
            themeName: "gst_tally",
            partyLayout: "layout_1",
          }}
        />
      );
      expect(htmlL1).toContain("Bill To / Customer");
      expect(htmlL1).toContain("Ship To / Destination");
      expect(htmlL1).toContain("Gate 4, Industrial Zone, Hyderabad");
      expect(htmlL1).toContain("Site Warehouse 2, Outer Ring Road");

      // Layout 2: 3-Box Split Top Header
      const htmlL2 = renderToString(
        <FullInvoicePrinter
          isOpen={true}
          onClose={() => {}}
          invoice={gstTallyInvoice}
          customTemplate={{
            id: "tpl-inv-gst-tally",
            themeName: "gst_tally",
            partyLayout: "layout_2",
          }}
        />
      );
      // In Layout 2, document title box is centered between seller and party
      expect(htmlL2).toContain("Omega Logistics Hub");
      expect(htmlL2).toContain("DC-2026-001");

      // Layout 3: Stacked Bill To on top, Ship To beneath
      const htmlL3 = renderToString(
        <FullInvoicePrinter
          isOpen={true}
          onClose={() => {}}
          invoice={gstTallyInvoice}
          customTemplate={{
            id: "tpl-inv-gst-tally",
            themeName: "gst_tally",
            partyLayout: "layout_3",
          }}
        />
      );
      expect(htmlL3).toContain("Bill To / Customer");
      expect(htmlL3).toContain("Ship To / Destination");
    });

    it("2.2 forwards custom dynamic columns to GstTallyTemplate", () => {
      const customCols = [
        { id: "col_sno", headerTitle: "Sl No", width: "5%", visible: true, enabled: true },
        { id: "col_item", headerTitle: "Custom Item Name", width: "40%", visible: true, enabled: true },
        { id: "col_custom_batch", headerTitle: "Batch / Lot No", width: "20%", visible: true, enabled: true, isCustom: true, staticValue: "LOT-999-X" },
        { id: "col_qty", headerTitle: "Units", width: "15%", visible: true, enabled: true },
        { id: "col_amount", headerTitle: "Line Total", width: "20%", visible: true, enabled: true },
      ];

      const html = renderToString(
        <FullInvoicePrinter
          isOpen={true}
          onClose={() => {}}
          invoice={gstTallyInvoice}
          customTemplate={{
            id: "tpl-inv-gst-tally",
            themeName: "gst_tally",
            columns: customCols,
          }}
        />
      );

      expect(html).toContain("Custom Item Name");
      expect(html).toContain("Batch / Lot No");
      expect(html).toContain("LOT-999-X");
      expect(html).toContain("Units");
    });

    it("2.3 forwards custom business fields to GstTallyTemplate", () => {
      const customFields = [
        { id: "cf_warranty", label: "Warranty Period", value: "3 Years Comprehensive", enabled: true },
        { id: "cf_delivery_terms", label: "Dispatch Mode", value: "Air Cargo Express", enabled: true },
      ];

      const html = renderToString(
        <FullInvoicePrinter
          isOpen={true}
          onClose={() => {}}
          invoice={gstTallyInvoice}
          customTemplate={{
            id: "tpl-inv-gst-tally",
            themeName: "gst_tally",
            customFields,
          }}
        />
      );

      expect(html).toContain("Warranty Period");
      expect(html).toContain("3 Years Comprehensive");
      expect(html).toContain("Dispatch Mode");
      expect(html).toContain("Air Cargo Express");
    });

    it("2.4 forwards full template style attributes (colors, borders, titles)", () => {
      const html = renderToString(
        <FullInvoicePrinter
          isOpen={true}
          onClose={() => {}}
          invoice={gstTallyInvoice}
          customTemplate={{
            id: "tpl-inv-gst-tally",
            themeName: "gst_tally",
            primaryColor: "#059669",
            itemTable: {
              styling: {
                headerBgColor: "#d1fae5",
                headerTextColor: "#065f46",
              },
            },
          }}
        />
      );

      // Verify table styles reflect forwarded attributes
      expect(html).toContain("background-color:#d1fae5");
      expect(html).toContain("color:#065f46");
    });
  });

  describe("3. Print iframe CSS Validity (Zero Invalid '//' Comments)", () => {
    it("3.1 FullInvoicePrinter source code contains ZERO invalid '//' comments inside print iframe <style>", () => {
      const printerPath = path.resolve(__dirname, "../components/pos/FullInvoicePrinter.tsx");
      const fileContent = fs.readFileSync(printerPath, "utf-8");

      // Extract the iframe <style> block from handlePrint
      const match = fileContent.match(/<style>([\s\S]*?)<\/style>/);
      expect(match).not.toBeNull();
      const styleBlock = match![1];

      // Check for any single-line comments // that would break CSS parsers
      const lines = styleBlock.split("\n");
      const invalidCommentLines = lines.filter((line) => {
        const trimmed = line.trim();
        return trimmed.startsWith("//");
      });

      expect(invalidCommentLines).toHaveLength(0);

      // Ensure valid CSS comment blocks exist
      expect(styleBlock).toContain("/*");
      expect(styleBlock).toContain("*/");

      // Ensure @page rule is present and syntax-clean
      expect(styleBlock).toContain("@page");
      expect(styleBlock).toContain("size:");
      expect(styleBlock).toContain("margin:");
    });
  });

  describe("4. Dynamic @page Margins Resolution", () => {
    it("4.1 A4 Margins resolve correctly for compact, normal, and spacious", () => {
      const resolveMargin = (margins?: string, size: "A4" | "A5" = "A4") => {
        const m = margins;
        if (size === "A5") {
          if (m === "compact") return "1.5mm 2.5mm";
          if (m === "spacious") return "4mm 5mm";
          return "2.5mm 3.5mm";
        }
        if (m === "compact") return "2mm 4mm";
        if (m === "spacious") return "8mm 10mm";
        return "4mm 6mm";
      };

      // A4 resolutions
      expect(resolveMargin("compact", "A4")).toBe("2mm 4mm");
      expect(resolveMargin("spacious", "A4")).toBe("8mm 10mm");
      expect(resolveMargin("normal", "A4")).toBe("4mm 6mm");
      expect(resolveMargin(undefined, "A4")).toBe("4mm 6mm");

      // A5 resolutions
      expect(resolveMargin("compact", "A5")).toBe("1.5mm 2.5mm");
      expect(resolveMargin("spacious", "A5")).toBe("4mm 5mm");
      expect(resolveMargin("normal", "A5")).toBe("2.5mm 3.5mm");
      expect(resolveMargin(undefined, "A5")).toBe("2.5mm 3.5mm");
    });
  });
});
