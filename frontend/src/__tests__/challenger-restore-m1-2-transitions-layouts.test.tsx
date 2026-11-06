import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import fs from "fs";
import path from "path";

// ── Storage Mock for Empirical Challenger Environment ──
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

const tenantId = "tenant_challenger_m1_2";
vi.mock("@/contexts/tenant-context", () => ({
  useTenant: () => ({
    tenant: {
      id: "tenant_challenger_m1_2",
      name: "Empirical Enterprise Lab",
      address: "100 Innovation Park, Whitefield, Bengaluru",
      phone: "+91 80 4455 6677",
      gst_number: "29AABCU9603R1ZM",
      raw: {
        logo_url: "/lab-logo.png",
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
  companiesApi: { list: vi.fn().mockResolvedValue({ items: [] }), get: vi.fn().mockResolvedValue(null) },
  invoicesApi: {
    getActivePrintTemplate: vi.fn().mockResolvedValue({}),
    setActivePrintTemplate: vi.fn().mockResolvedValue({ success: true }),
    sendInvoiceToWhatsApp: vi.fn().mockResolvedValue({ success: true }),
    sendInvoiceEmail: vi.fn().mockResolvedValue({ success: true }),
  },
  printTemplatesApi: {
    getTemplates: vi.fn().mockResolvedValue({ templates: [] }),
    setActiveTemplate: vi.fn().mockResolvedValue({ success: true }),
    saveTemplate: vi.fn().mockResolvedValue({ success: true }),
    deleteTemplate: vi.fn().mockResolvedValue({ success: true }),
  },
  inventoryApi: {
    listProducts: vi.fn().mockResolvedValue({ items: [] }),
  },
  bankApi: {
    listBankAccounts: vi.fn().mockResolvedValue({
      items: [
        {
          id: "bank_lab_1",
          bank_name: "State Bank of India",
          account_number: "123456789012",
          ifsc_code: "SBIN0001234",
          branch: "Whitefield Bengaluru",
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
    getNextNumber: vi.fn().mockResolvedValue({ next: "INV-2026-9001" }),
  },
  resolveImageUrl: vi.fn((url) => url || "/lab-logo.png"),
}));

vi.mock("@/lib/print-helper", () => ({
  triggerThermalPrint: vi.fn(),
}));

import { PrintTemplates } from "../components/inventory/PrintTemplates";
import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";
import {
  PARTY_LAYOUT_OPTIONS,
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  resolveInvoiceTexts,
  type PartyLayoutType,
} from "../lib/invoice-template-config";
import { safeSetItem, safeGetItem } from "../lib/safe-storage";

describe("Empirical Challenger M1-2: Format Transitions, 3 Party Layouts & Stress Resilience", () => {
  beforeEach(() => {
    storage.clear();
    listeners.clear();
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Document Type Transitions & Sidebar Format Switching
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 1: Document Type Transitions & Sidebar Navigation", () => {
    it("1.1 Synchronously maps all commercial document formats to correct slot titles and labels", () => {
      const texts = resolveInvoiceTexts({});
      const testCases = [
        { invoice: { invoice_type: "TAX_INVOICE", invoice_number: "INV-001" }, expectedTitle: "TAX INVOICE" },
        { invoice: { doc_type: "challan", invoice_number: "DC-001" }, expectedTitle: "DELIVERY CHALLAN" },
        { invoice: { invoice_type: "QUOTATION", quote_number: "QT-001" }, expectedTitle: "TAX QUOTATION / ESTIMATE" },
        { invoice: { invoice_type: "PROFORMA", invoice_number: "PI-001" }, expectedTitle: "PROFORMA INVOICE" },
      ];

      for (const tc of testCases) {
        const title = docTitleFor(tc.invoice, texts);
        expect(title).toBe(tc.expectedTitle);

        const noLabel = docNoLabelFor(tc.invoice, texts);
        expect(typeof noLabel).toBe("string");
        expect(noLabel.length).toBeGreaterThan(0);
      }
    });

    it("1.2 Renders classic workspace with document type buttons for invoice, challan, quotation, proforma", () => {
      const html = renderToString(<PrintTemplates />);

      // Sidebar Document Type buttons in Column 1
      expect(html).toContain("Invoices");
      expect(html).toContain("Delivery Challan");
      expect(html).toContain("Quotation");
      expect(html).toContain("Proforma Invoice");
      expect(html).toContain("Thermal Receipt");
      expect(html).toContain("Barcode Label");
    });

    it("1.3 Renders POS thermal receipt customizer options when in thermal mode", () => {
      // Seed storage with thermal template as active
      const thermalTpl = {
        id: "tpl-thermal-80mm-std",
        name: "Standard 80mm POS Receipt",
        category: "thermal",
        docType: "thermal",
        paperSize: "80mm",
        thermalContrast: "ultra-dark",
        isDefault: true,
      };
      safeSetItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify({ thermal: thermalTpl.id }));
      safeSetItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify([thermalTpl]));

      const html = renderToString(<PrintTemplates />);
      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(1000);
      expect(html).toContain("Thermal");
    });

    it("1.4 Renders Barcode & Price Tag Studio when in barcode mode", () => {
      const barcodeTpl = {
        id: "tpl-barcode-50x25",
        name: "50x25mm Price Tag",
        category: "barcodes",
        docType: "barcode",
        barcodeSymbology: "Code-128",
        labelLayout: "1up",
        isDefault: true,
      };
      safeSetItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify({ barcode: barcodeTpl.id }));
      safeSetItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify([barcodeTpl]));

      const html = renderToString(<PrintTemplates />);
      expect(html).toBeDefined();
      expect(html).toContain("Barcode");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 2: 3 Party Layouts Selection, Wireframes & Mutation
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 2: 3 Party Layouts Selection & Mutation", () => {
    it("2.1 Defines exactly 3 party layouts with expected metadata and wireframe specs", () => {
      expect(PARTY_LAYOUT_OPTIONS).toHaveLength(3);

      const [l1, l2, l3] = PARTY_LAYOUT_OPTIONS;
      expect(l1.id).toBe("layout_1");
      expect(l1.title).toBe("Side-by-Side");
      expect(l1.badge).toBe("Recommended");

      expect(l2.id).toBe("layout_2");
      expect(l2.title).toBe("3-Box Header Split");

      expect(l3.id).toBe("layout_3");
      expect(l3.title).toBe("Stacked / Full Width");
    });

    it("2.2 Renders wireframe elements for Layout 1, Layout 2, and Layout 3 in Design tab", () => {
      const html = renderToString(<PrintTemplates />);

      // Wireframe 1: Side-by-Side
      expect(html).toContain("Bill To");
      expect(html).toContain("Ship To");

      // Wireframe 2: 3-Box Split
      expect(html).toContain("Seller");
      expect(html).toContain("Meta");
      expect(html).toContain("Party");

      // Wireframe 3: Stacked
      expect(html).toContain("Bill To (Full Width)");
      expect(html).toContain("Ship To (Full Width)");
    });

    it("2.3 Verifies GstTallyTemplate applies distinct class hierarchies for Layout 1, 2, and 3", () => {
      const mockInv: any = {
        invoice_number: "INV-2026-CHALLENGE",
        invoice_date: "2026-11-06",
        customerName: "Global Trade Corporation",
        customerBillingAddress: "Suite 501, Outer Ring Road, Bengaluru",
        customerShippingAddress: "Warehouse 3, Peenya Industrial Area",
        customerGST: "29AAACG1234D1Z8",
        customerPan: "AAACG1234D",
        items: [
          {
            product_name: "Heavy Duty Industrial Drill Press",
            quantity: 2,
            unit_price: 35000,
            tax_rate: 18,
            subtotal: 70000,
            hsn_code: "8459",
            mrp: 42000,
          },
        ],
        taxable_value: 70000,
        cgst_amount: 6300,
        sgst_amount: 6300,
        tax_amount: 12600,
        grand_total: 82600,
      };

      const htmlL1 = renderToString(
        <GstTallyTemplate invoice={mockInv} partyLayout="layout_1" dynamicStoreName="Lab Store" />
      );
      const htmlL2 = renderToString(
        <GstTallyTemplate invoice={mockInv} partyLayout="layout_2" dynamicStoreName="Lab Store" />
      );
      const htmlL3 = renderToString(
        <GstTallyTemplate invoice={mockInv} partyLayout="layout_3" dynamicStoreName="Lab Store" />
      );

      // Verify that all 3 render cleanly and include customer and item details
      expect(htmlL1).toContain("Global Trade Corporation");
      expect(htmlL2).toContain("Global Trade Corporation");
      expect(htmlL3).toContain("Global Trade Corporation");
      expect(htmlL1).toContain("Heavy Duty Industrial Drill Press");

      // Layout 2 includes 3-box split columns (col-span-4)
      expect(htmlL2).toContain("col-span-4");

      // Verify layout structures differ
      expect(htmlL1).not.toBe(htmlL2);
      expect(htmlL2).not.toBe(htmlL3);
      expect(htmlL1).not.toBe(htmlL3);
    });

    it("2.4 Simulates partyLayout mutation and verifies safeSetItem persistence", () => {
      // Create a base template and test persisting partyLayout mutation
      const baseTpl = {
        id: "tpl-test-custom-invoice",
        name: "Custom Enterprise Invoice",
        category: "invoices",
        docType: "invoice",
        partyLayout: "layout_1" as PartyLayoutType,
        party: { layout: "layout_1" as PartyLayoutType },
      };

      // Mutate to layout_2
      const updatedTpl2 = {
        ...baseTpl,
        partyLayout: "layout_2" as PartyLayoutType,
        party: { ...baseTpl.party, layout: "layout_2" as PartyLayoutType },
      };

      safeSetItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify([updatedTpl2]));
      const retrieved2 = JSON.parse(safeGetItem(`businessos_print_templates_v1_${tenantId}`)!);
      expect(retrieved2[0].partyLayout).toBe("layout_2");
      expect(retrieved2[0].party.layout).toBe("layout_2");

      // Mutate to layout_3
      const updatedTpl3 = {
        ...baseTpl,
        partyLayout: "layout_3" as PartyLayoutType,
        party: { ...baseTpl.party, layout: "layout_3" as PartyLayoutType },
      };

      safeSetItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify([updatedTpl3]));
      const retrieved3 = JSON.parse(safeGetItem(`businessos_print_templates_v1_${tenantId}`)!);
      expect(retrieved3[0].partyLayout).toBe("layout_3");
      expect(retrieved3[0].party.layout).toBe("layout_3");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Edge Cases, Rapid Switching & Zero-Crash Resilience
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 3: Edge Cases, Missing Fallbacks & Zero Crash Guarantees", () => {
    it("3.1 Handles empty templates array in storage without crashing", () => {
      safeSetItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify([]));
      expect(() => renderToString(<PrintTemplates />)).not.toThrow();
    });

    it("3.2 Handles malformed/corrupted JSON string in storage without crashing", () => {
      storage.set(`businessos_print_templates_v1_${tenantId}`, "{{{{corrupt_json_bad_payload$$$");
      expect(() => renderToString(<PrintTemplates />)).not.toThrow();
    });

    it("3.3 Handles non-existent template ID in userActiveDefaults with graceful fallback", () => {
      safeSetItem(
        `user_active_print_templates_v1_${tenantId}`,
        JSON.stringify({
          invoice: "non_existent_deleted_id_9999",
          thermal: "bogus_receipt_id_8888",
          barcode: "missing_label_id_7777",
        })
      );
      expect(() => renderToString(<PrintTemplates />)).not.toThrow();
      const html = renderToString(<PrintTemplates />);
      expect(html).toContain("Print &amp; Document Templates");
    });

    it("3.4 Handles rapid multi-format simulated cycles without throwing", () => {
      const texts = resolveInvoiceTexts({});
      const invoices = [
        { invoice_type: "TAX_INVOICE", invoice_number: "INV-001" },
        { doc_type: "challan", invoice_number: "DC-001" },
        { invoice_type: "QUOTATION", quote_number: "QT-001" },
        { invoice_type: "PROFORMA", invoice_number: "PI-001" },
        { invoice_type: "ESTIMATE", invoice_number: "EST-001" },
      ];

      for (let cycle = 0; cycle < 10; cycle++) {
        for (const inv of invoices) {
          expect(() => {
            docTitleFor(inv, texts);
            docNoLabelFor(inv, texts);
          }).not.toThrow();
        }
      }
    });

    it("3.5 Handles template with undefined party, undefined fields, and empty items safely", () => {
      const sparseInvoice: any = {
        invoice_number: "INV-SPARSE-001",
        invoice_date: "2026-11-06",
        items: [],
      };

      for (const layout of ["layout_1", "layout_2", "layout_3", undefined, "invalid_layout" as any]) {
        expect(() => {
          renderToString(
            <GstTallyTemplate
              invoice={sparseInvoice}
              partyLayout={layout}
              dynamicStoreName={undefined}
              dynamicLogoUrl={undefined}
            />
          );
        }).not.toThrow();
      }
    });

    it("3.6 Validates that PrintTemplates source code preserves handleSelectSidebarDocType and 3 party layout cards", () => {
      const filePath = path.resolve(__dirname, "../components/inventory/PrintTemplates.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify handleSelectSidebarDocType is defined and wired
      expect(content).toContain("handleSelectSidebarDocType = (docType: DocumentType)");
      expect(content).toContain("onClick={() => handleSelectSidebarDocType(doc.type)}");

      // Verify 3 party layout selector is implemented with wireframes
      expect(content).toContain("PARTY_LAYOUT_OPTIONS.map");
      expect(content).toContain("partyLayout: layout.id");
      expect(content).toContain("Party Details Layout");
      expect(content).toContain("layout.id === \"layout_1\"");
      expect(content).toContain("layout.id === \"layout_2\"");
      expect(content).toContain("layout.id === \"layout_3\"");

      // Verify GstTallyTemplate is fed partyLayout
      expect(content).toContain("partyLayout={(template as any)?.party?.layout || (template as any)?.partyLayout || \"layout_1\"}");
    });
  });
});
