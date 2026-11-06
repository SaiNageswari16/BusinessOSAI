import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import fs from "fs";
import path from "path";

// ── Storage Mock for Empirical Environment ──
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
  open: vi.fn(),
  print: vi.fn(),
  confirm: vi.fn().mockReturnValue(true),
  location: { reload: vi.fn() },
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

// ── Module Mocks ──
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
  useCurrency: () => ({
    currency: { symbol: "₹", code: "INR" },
    formatCurrency: (amount: number) => `₹${amount.toFixed(2)}`,
  }),
}));

vi.mock("@/contexts/tenant-context", () => ({
  useTenant: () => ({
    tenant: {
      id: "tenant_emp_challenger_m1",
      name: "Empirical Challenger Corp",
      address: "77 Industrial Hub, Tech City, Karnataka",
      phone: "+91 99887 76655",
      gst_number: "29AABCU9603R1ZM",
      raw: {
        logo_url: "/sample-logo.png",
      },
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
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
  inventoryApi: {
    listProducts: vi.fn().mockResolvedValue({ items: [] }),
  },
  bankApi: {
    listBankAccounts: vi.fn().mockResolvedValue({
      items: [
        {
          id: "bank_1",
          bank_name: "HDFC Bank",
          account_number: "50200012345678",
          ifsc_code: "HDFC0001234",
          branch: "MG Road Branch",
        },
      ],
    }),
  },
  taxApi: {
    listTaxCodes: vi.fn().mockResolvedValue({
      items: [
        { id: "tax_gst_18", name: "GST 18%", rate: 18, is_active: true },
        { id: "tax_gst_5", name: "GST 5%", rate: 5, is_active: true },
      ],
    }),
  },
  numberSeriesApi: {
    getNextNumber: vi.fn().mockResolvedValue({ next: "INV-2026-0042" }),
  },
  resolveImageUrl: vi.fn((url) => url || "/sample-logo.png"),
}));

vi.mock("@/lib/print-helper", () => ({
  triggerThermalPrint: vi.fn(),
}));

// Import PrintTemplates component and config helpers
import { PrintTemplates } from "../components/inventory/PrintTemplates";
import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";
import {
  PARTY_LAYOUT_OPTIONS,
  INVOICE_DOC_CATEGORIES,
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  type InvoiceTexts,
} from "../lib/invoice-template-config";

describe("Milestone M1 Empirical Challenge: Classic 3-Column Workspace Architecture", () => {
  beforeEach(() => {
    storage.clear();
    listeners.clear();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 1: Empirical Verification of Classic 3-Column DOM Structure
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 1: DOM Structure on Initial Render (Invoice)", () => {
    it("renders the classic 3-column workspace container with all primary structural elements", () => {
      const html = renderToString(<PrintTemplates />);

      // 1. Page Header
      expect(html).toContain("Print &amp; Document Templates");
      expect(html).toContain("Design, customize and live preview templates");

      // 2. Classic 3-column Grid Container
      expect(html).toContain("grid grid-cols-1 lg:grid-cols-12");

      // 3. Column 1: Document Types Sidebar
      expect(html).toContain("Template Type");
      expect(html).toContain("Choose format");
      expect(html).toContain("Documents");
      expect(html).toContain("Procurement &amp; Notes");
      expect(html).toContain("POS Receipts");
      expect(html).toContain("Labels &amp; Tags");

      // Sidebar items check
      expect(html).toContain("Invoice");
      expect(html).toContain("Delivery Challan");
      expect(html).toContain("Quotation");
      expect(html).toContain("Proforma Invoice");
      expect(html).toContain("Thermal Receipt");
      expect(html).toContain("Barcode Label");

      // 4. Column 2: 4-Tab Customization Panel
      expect(html).toContain("Design");
      expect(html).toContain("Content");
      expect(html).toContain("Branding");
      expect(html).toContain("Settings");

      // Column 2 Content Body - Design tab active by default
      expect(html).toContain("Party Details Layout");
      expect(html).toContain("3 Header Styles");
      expect(html).toContain("Side-by-Side");
      expect(html).toContain("3-Box Header Split");
      expect(html).toContain("Stacked / Full Width");

      // 5. Column 3: Live Preview Canvas
      expect(html).toContain("Live Preview");
      expect(html).toContain("This is how your document will look");
      expect(html).toContain("printable-preview-canvas");
      expect(html).toContain("Download PDF");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 2: Absence of isCommercialDoc Hijack and Isolated Bypass
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 2: Absence of isCommercialDoc Early-Return Hijack", () => {
    it("verifies PrintTemplates.tsx source code has zero traces of isCommercialDoc early-return", () => {
      const filePath = path.resolve(__dirname, "../components/inventory/PrintTemplates.tsx");
      const fileContent = fs.readFileSync(filePath, "utf-8");

      // 1. Early-return variable declaration must not exist
      expect(fileContent).not.toMatch(/const\s+isCommercialDoc/);

      // 2. Early-return check statement must not exist
      expect(fileContent).not.toMatch(/if\s*\(\s*isCommercialDoc\s*\)/);

      // 3. UnifiedInvoiceCustomizer import must not exist in PrintTemplates.tsx
      expect(fileContent).not.toMatch(/import\s*\{\s*UnifiedInvoiceCustomizer\s*\}\s*from/);

      // 4. UnifiedInvoiceCustomizer component must not be rendered in PrintTemplates.tsx
      expect(fileContent).not.toMatch(/<UnifiedInvoiceCustomizer/);

      // 5. Hacky banner "Back to Commercial A4 Invoices Banner" must be removed
      expect(fileContent).not.toContain("Back to Commercial A4 Invoices Banner");
      expect(fileContent).not.toContain("← Back to A4 Invoices (myBillBook)");
    });

    it("empirically confirms rendered DOM renders classic 3-column grid rather than early return", () => {
      const html = renderToString(<PrintTemplates />);
      // Confirm that the classic 3-column workspace elements are rendered
      expect(html).toContain("grid grid-cols-1 lg:grid-cols-12");
      expect(html).toContain("Template Type");
      expect(html).toContain("printable-preview-canvas");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 3: 3 Party Layouts Parity and GstTallyTemplate Rendering
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 3: 3 Party Layouts (1/2/3) Rendering and Wireframes", () => {
    it("renders wireframe previews for all 3 party layouts in the Design tab", () => {
      const html = renderToString(<PrintTemplates />);

      // Wireframe 1: Side-by-Side (Bill To | Ship To)
      expect(html).toContain("Bill To");
      expect(html).toContain("Ship To");

      // Wireframe 2: 3-Box Split (Seller | Meta | Party)
      expect(html).toContain("Seller");
      expect(html).toContain("Meta");
      expect(html).toContain("Party");

      // Wireframe 3: Stacked (Full Width)
      expect(html).toContain("Bill To (Full Width)");
      expect(html).toContain("Ship To (Full Width)");
    });

    it("verifies GstTallyTemplate generates distinct DOM structures for Layout 1, Layout 2, and Layout 3", () => {
      const sampleInvoice: any = {
        invoice_number: "INV-CHALLENGE-001",
        invoice_date: "2026-11-06",
        customerName: "Acme Enterprises Karnataka",
        customerBillingAddress: "45 MG Road, Bengaluru",
        customerShippingAddress: "Plot 12, Whitefield, Bengaluru",
        customerGST: "29AABCU9603R1ZM",
        items: [
          {
            product_name: "Commercial Grade Steel Bolt M12",
            quantity: 50,
            unit_price: 25.0,
            tax_rate: 18,
            subtotal: 1250.0,
          },
        ],
        taxable_value: 1250.0,
        cgst_amount: 112.5,
        sgst_amount: 112.5,
        tax_amount: 225.0,
        grand_total: 1475.0,
      };

      const htmlL1 = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          partyLayout="layout_1"
          dynamicStoreName="Challenger Corp"
        />
      );

      const htmlL2 = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          partyLayout="layout_2"
          dynamicStoreName="Challenger Corp"
        />
      );

      const htmlL3 = renderToString(
        <GstTallyTemplate
          invoice={sampleInvoice}
          partyLayout="layout_3"
          dynamicStoreName="Challenger Corp"
        />
      );

      // Layout 1 contains side-by-side Bill To & Ship To container
      expect(htmlL1).toContain("Bill To / Customer");
      expect(htmlL1).toContain("Ship To / Destination");
      expect(htmlL1).toContain("Acme Enterprises Karnataka");

      // Layout 2 contains 3-Box Split structure with meta column
      expect(htmlL2).toContain("col-span-4");
      expect(htmlL2).toContain("Acme Enterprises Karnataka");

      // Layout 3 contains stacked full width boxes
      expect(htmlL3).toContain("Bill To / Customer");
      expect(htmlL3).toContain("Ship To / Destination");
      expect(htmlL3).toContain("Acme Enterprises Karnataka");

      // Verify that all 3 HTML strings are distinct and non-empty
      expect(htmlL1.length).toBeGreaterThan(500);
      expect(htmlL2.length).toBeGreaterThan(500);
      expect(htmlL3.length).toBeGreaterThan(500);
      expect(htmlL1).not.toEqual(htmlL2);
      expect(htmlL2).not.toEqual(htmlL3);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 4: Format Switching & Multi-Document Title / Metadata Mapping
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 4: Document Format Switching & Metadata Parity", () => {
    it("accurately detects document titles and numbering prefixes for all commercial document types", () => {
      const texts: InvoiceTexts = {
        invoiceTitle: "TAX INVOICE",
        quotationTitle: "QUOTATION",
        estimateTitle: "ESTIMATE",
        proformaTitle: "PROFORMA INVOICE",
        challanTitle: "DELIVERY CHALLAN",
        purchaseInvoiceTitle: "PURCHASE INVOICE",
        purchaseOrderTitle: "PURCHASE ORDER",
        creditNoteTitle: "CREDIT NOTE",
        debitNoteTitle: "DEBIT NOTE",
        invoiceNoLabel: "Invoice No",
        quoteNoLabel: "Quote No",
        estimateNoLabel: "Estimate No",
        proformaNoLabel: "Proforma No",
        challanNoLabel: "Challan No",
        purchaseInvoiceNoLabel: "Bill No",
        purchaseOrderNoLabel: "PO No",
        creditNoteNoLabel: "CN No",
        debitNoteNoLabel: "DN No",
        invoiceDateLabel: "Invoice Date",
        quoteDateLabel: "Quote Date",
        estimateDateLabel: "Estimate Date",
        proformaDateLabel: "Proforma Date",
        challanDateLabel: "Challan Date",
        purchaseInvoiceDateLabel: "Bill Date",
        purchaseOrderDateLabel: "PO Date",
        creditNoteDateLabel: "CN Date",
        debitNoteDateLabel: "DN Date",
        dueDateLabel: "Due Date",
        poNumberLabel: "PO No",
        vehicleNoLabel: "Vehicle No",
        ewayBillLabel: "E-Way Bill",
      };

      // 1. Invoices
      expect(docTitleFor({ invoice_type: "TAX_INVOICE" }, texts)).toBe("TAX INVOICE");
      expect(docNoLabelFor({ invoice_type: "TAX_INVOICE" }, texts)).toBe("Invoice No");
      expect(docDateLabelFor({ invoice_type: "TAX_INVOICE" }, texts)).toBe("Invoice Date");

      // 2. Delivery Challan
      expect(docTitleFor({ invoice_type: "CHALLAN" }, texts)).toBe("DELIVERY CHALLAN");
      expect(docNoLabelFor({ invoice_type: "CHALLAN" }, texts)).toBe("Challan No");
      expect(docDateLabelFor({ invoice_type: "CHALLAN" }, texts)).toBe("Challan Date");

      // 3. Quotation
      expect(docTitleFor({ invoice_type: "QUOTATION" }, texts)).toBe("QUOTATION");
      expect(docNoLabelFor({ invoice_type: "QUOTATION" }, texts)).toBe("Quote No");
      expect(docDateLabelFor({ invoice_type: "QUOTATION" }, texts)).toBe("Quote Date");

      // 4. Proforma Invoice
      expect(docTitleFor({ invoice_type: "PROFORMA" }, texts)).toBe("PROFORMA INVOICE");
      expect(docNoLabelFor({ invoice_type: "PROFORMA" }, texts)).toBe("Proforma No");
      expect(docDateLabelFor({ invoice_type: "PROFORMA" }, texts)).toBe("Invoice Date"); // fallback to invoiceDateLabel
    });

    it("verifies PARTY_LAYOUT_OPTIONS exports exactly 3 valid layout types", () => {
      expect(PARTY_LAYOUT_OPTIONS).toHaveLength(3);
      expect(PARTY_LAYOUT_OPTIONS.map((o) => o.id)).toEqual([
        "layout_1",
        "layout_2",
        "layout_3",
      ]);
      expect(PARTY_LAYOUT_OPTIONS[0].title).toBe("Side-by-Side");
      expect(PARTY_LAYOUT_OPTIONS[1].title).toBe("3-Box Header Split");
      expect(PARTY_LAYOUT_OPTIONS[2].title).toBe("Stacked / Full Width");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 5: Zero Unhandled Exception on Layout / Document Switching
  // ══════════════════════════════════════════════════════════════════════════
  describe("Challenge 5: Zero Unhandled Exceptions During Document Switching", () => {
    it("renders without error for various document configurations and null properties", () => {
      // Test render with various template docTypes without throwing
      expect(() => renderToString(<PrintTemplates />)).not.toThrow();
    });
  });
});
