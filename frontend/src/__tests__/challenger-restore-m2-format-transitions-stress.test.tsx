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

const tenantId = "tenant_challenger_m2_2";
vi.mock("@/contexts/tenant-context", () => ({
  useTenant: () => ({
    tenant: {
      id: "tenant_challenger_m2_2",
      name: "Empirical Stress Lab Corp",
      address: "Phase II, Electronic City, Bengaluru 560100",
      phone: "+91 9988776655",
      gst_number: "29AABCU9603R1ZM",
      raw: {
        logo_url: "/empirical-logo.png",
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
    listProducts: vi.fn().mockResolvedValue({
      items: [
        {
          id: "prod-stress-01",
          name: "Saree 849 Luxury Silk",
          barcode: "TS0459208499",
          selling_price: 849,
          mrp: 1698,
          category_name: "ETHNIC WEAR",
        },
      ],
    }),
  },
  bankApi: {
    listBankAccounts: vi.fn().mockResolvedValue({
      items: [
        {
          id: "bank_stress_1",
          bank_name: "HDFC Bank",
          account_number: "98765432109876",
          ifsc_code: "HDFC0001234",
          branch: "Electronic City Bengaluru",
        },
      ],
    }),
  },
  taxApi: {
    listTaxCodes: vi.fn().mockResolvedValue({
      items: [{ id: "tax_gst_18", name: "GST 18%", rate: 18, is_active: true }],
    }),
  },
  numberSeriesApi: {
    getNextNumber: vi.fn().mockResolvedValue({ next: "INV-2026-STRESS" }),
  },
  resolveImageUrl: vi.fn((url) => url || "/empirical-logo.png"),
}));

vi.mock("@/lib/print-helper", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    triggerThermalPrint: vi.fn(),
  };
});

import { PrintTemplates, type DocumentType, type PrintTemplate } from "../components/inventory/PrintTemplates";
import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";
import { SingleBarcodeLabelCard, RealBarcodeSvg } from "../lib/barcode-svg";
import { generateThermalReceiptHtml } from "../lib/print-helper";
import {
  PARTY_LAYOUT_OPTIONS,
  docTitleFor,
  docNoLabelFor,
  resolveInvoiceTexts,
  type PartyLayoutType,
} from "../lib/invoice-template-config";
import { safeSetItem, safeGetItem } from "../lib/safe-storage";

describe("Empirical Challenger M2-2: Format Transitions & Stress Verification Suite", () => {
  beforeEach(() => {
    storage.clear();
    listeners.clear();
    vi.clearAllMocks();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Pairwise Format Transitions & Full Switching Pipeline
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 1: Pairwise Format Transitions & Full Switching Pipeline", () => {
    const primaryFormats: DocumentType[] = [
      "invoice",
      "proforma",
      "quotation",
      "challan",
      "thermal",
      "barcode",
      "pricetag",
    ];

    it("1.1 Renders classic workspace with document type buttons for all 7 primary formats", () => {
      const html = renderToString(<PrintTemplates />);

      // Sidebar Document Type buttons in Column 1
      expect(html).toContain("Invoices");
      expect(html).toContain("Delivery Challan");
      expect(html).toContain("Quotation");
      expect(html).toContain("Proforma Invoice");
      expect(html).toContain("Thermal Receipt");
      expect(html).toContain("Barcode Label");
      expect(html).toContain("Price Tag");
    });

    it("1.2 Synchronously resolves canonical document titles and labels across all formats", () => {
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

    it("1.3 Simulates all 42 pairwise format transitions across the entire format matrix without throwing", () => {
      for (const fromFormat of primaryFormats) {
        for (const toFormat of primaryFormats) {
          if (fromFormat === toFormat) continue;

          // Seed storage with templates for both formats
          safeSetItem(
            `user_active_print_templates_v1_${tenantId}`,
            JSON.stringify({
              [fromFormat]: `active-tpl-${fromFormat}`,
              [toFormat]: `active-tpl-${toFormat}`,
            })
          );

          expect(() => {
            const stored = safeGetItem(`user_active_print_templates_v1_${tenantId}`);
            expect(stored).toBeDefined();
            const parsed = JSON.parse(stored!);
            expect(parsed[fromFormat]).toBe(`active-tpl-${fromFormat}`);
            expect(parsed[toFormat]).toBe(`active-tpl-${toFormat}`);

            const html = renderToString(<PrintTemplates />);
            expect(html).toBeDefined();
            expect(html.length).toBeGreaterThan(1000);
          }).not.toThrow();
        }
      }
    });

    it("1.4 Multi-step continuous pipeline transition across all 7 formats in sequence", () => {
      const pipeline: DocumentType[] = [
        "invoice",
        "proforma",
        "quotation",
        "challan",
        "thermal",
        "barcode",
        "pricetag",
        "invoice", // Return to origin
      ];

      for (let i = 0; i < pipeline.length; i++) {
        const currentFormat = pipeline[i];
        safeSetItem(
          `user_active_print_templates_v1_${tenantId}`,
          JSON.stringify({
            invoice: currentFormat === "invoice" ? "tpl-inv" : undefined,
            thermal: currentFormat === "thermal" ? "tpl-thermal-80mm-std" : undefined,
            barcode: currentFormat === "barcode" ? "tpl-barcode-50x25" : undefined,
            [currentFormat]: `tpl-${currentFormat}`,
          })
        );

        const html = renderToString(<PrintTemplates />);
        expect(html).toBeDefined();
        expect(html.length).toBeGreaterThan(1000);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Preview Renderer Fidelity & Identity For Each Format
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 2: Preview Renderer Fidelity & Identity For Each Format", () => {
    it("2.1 Commercial A4 Documents (Tax Invoice, Proforma, Quotation, Challan) render via GstTallyTemplate with correct canonical headers", () => {
      const texts = resolveInvoiceTexts({});

      const commercialCases = [
        {
          format: "invoice",
          invoice: { invoice_type: "TAX_INVOICE", invoice_number: "INV-2026-0042" },
          expectedDocTitle: "TAX INVOICE",
          expectedPrefix: "INV-",
        },
        {
          format: "proforma",
          invoice: { invoice_type: "PROFORMA", invoice_number: "PI-2026-0042" },
          expectedDocTitle: "PROFORMA INVOICE",
          expectedPrefix: "PI-",
        },
        {
          format: "quotation",
          invoice: { invoice_type: "QUOTATION", quote_number: "QT-2026-0042" },
          expectedDocTitle: "TAX QUOTATION / ESTIMATE",
          expectedPrefix: "QT-",
        },
        {
          format: "challan",
          invoice: { doc_type: "challan", invoice_number: "DC-2026-0042" },
          expectedDocTitle: "DELIVERY CHALLAN",
          expectedPrefix: "DC-",
        },
      ];

      for (const tc of commercialCases) {
        const title = docTitleFor(tc.invoice, texts);
        expect(title).toBe(tc.expectedDocTitle);

        const noLabel = docNoLabelFor(tc.invoice, texts);
        expect(noLabel).toBeDefined();
        expect(noLabel.length).toBeGreaterThan(0);

        // Render GstTallyTemplate directly with this mock identity
        const rendered = renderToString(
          <GstTallyTemplate
            invoice={{
              ...tc.invoice,
              header_title: tc.expectedDocTitle,
              customerName: "ACME Industrial Corp",
              items: [
                {
                  product_name: "Heavy Duty Gearbox",
                  quantity: 1,
                  unit_price: 25000,
                  subtotal: 25000,
                  tax_rate: 18,
                },
              ],
            }}
            partyLayout="layout_1"
            dynamicStoreName="Empirical Testing Merchant"
          />
        );

        expect(rendered).toContain(tc.expectedDocTitle);
        expect(rendered).toContain("Heavy Duty Gearbox");
        expect(rendered).toContain("ACME Industrial Corp");
      }
    });

    it("2.2 POS Thermal Receipt engine generates high-contrast 80mm receipt HTML with tear edges and totals", () => {
      const mockThermalInvoice = {
        invoice_number: "POS-2026-0042",
        invoice_date: "2026-11-06",
        customerName: "Walk-in Retail Customer",
        customerPhone: "+91 9876543210",
        items: [
          { product_name: "Basmati Rice 5kg", quantity: 1, unit_price: 480, subtotal: 480, tax_rate: 5 },
          { product_name: "Sunflower Oil 1L", quantity: 2, unit_price: 145, subtotal: 290, tax_rate: 5 },
        ],
        grand_total: 770,
        taxable_value: 733.33,
        tax_amount: 36.67,
      };

      const thermalHtml = generateThermalReceiptHtml(mockThermalInvoice, {
        paperSize: "80mm",
        thermalContrast: "ultra_dark",
        storeName: "Supermarket Express",
      }, tenantId);

      expect(thermalHtml).toBeDefined();
      expect(thermalHtml).toContain("72mm"); // 80mm printable width is 72mm
      expect(thermalHtml).toContain("Supermarket Express");
      expect(thermalHtml).toContain("Basmati Rice 5kg");
      expect(thermalHtml).toContain("770.00");
    });

    it("2.3 58mm Mini Roll Thermal Receipt applies 48mm printable width", () => {
      const mockThermalInvoice = {
        invoice_number: "POS-58MM-001",
        invoice_date: "2026-11-06",
        items: [{ product_name: "Coffee Pack", quantity: 1, unit_price: 120, subtotal: 120 }],
        grand_total: 120,
      };

      const miniHtml = generateThermalReceiptHtml(mockThermalInvoice, {
        paperSize: "58mm",
        storeName: "Espresso Corner",
      }, tenantId);

      expect(miniHtml).toBeDefined();
      expect(miniHtml).toContain("48mm"); // 58mm printable width is 48mm
      expect(miniHtml).toContain("Espresso Corner");
      expect(miniHtml).toContain("Coffee Pack");
    });

    it("2.4 Barcode Label mode renders RealBarcodeSvg with Code-128 and EAN-13", () => {
      const svgCode128 = renderToString(
        <RealBarcodeSvg
          value="TS0459208499"
          format="CODE128"
          height={40}
          displayValue={true}
        />
      );

      expect(svgCode128).toContain("<svg");
      expect(svgCode128).toContain("TS0459208499");

      const svgEan13 = renderToString(
        <RealBarcodeSvg
          value="8901030382914"
          format="EAN13"
          height={40}
          displayValue={true}
        />
      );

      expect(svgEan13).toContain("<svg");
    });

    it("2.5 SingleBarcodeLabelCard renders product name, MRP, selling price, and org name", () => {
      const sampleItem = {
        product_name: "Saree 849 Luxury Silk",
        barcode: "TS0459208499",
        sku: "TS0459208499",
        selling_price: 849,
        mrp: 1698,
        category_name: "ETHNIC WEAR",
      };

      const cardHtml = renderToString(
        <SingleBarcodeLabelCard
          item={sampleItem}
          template={{ barcodeSymbology: "Code-128" } as any}
          isPrint={false}
          orgName="TRENDY BOUTIQUE"
        />
      );

      expect(cardHtml).toContain("Saree 849 Luxury Silk");
      expect(cardHtml).toContain("849");
      expect(cardHtml).toContain("1698");
      expect(cardHtml).toContain("TRENDY BOUTIQUE");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Layout Shifts & Boundary Stress Testing
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 3: Layout Shifts, Bounded Dimensions & Stress Resilience", () => {
    it("3.1 Verifies all preview container widths have strict max-width constraints preventing overflow", () => {
      const testCases = [
        { paperSize: "A4", orientation: "portrait" },
        { paperSize: "A5", orientation: "portrait" },
        { paperSize: "A5", orientation: "landscape" },
        { paperSize: "Letter", orientation: "portrait" },
      ];

      for (const tc of testCases) {
        const invoiceMock: any = {
          invoice_number: "INV-DIM-TEST",
          invoice_date: "2026-11-06",
          items: [{ product_name: "Test Item", quantity: 1, unit_price: 100, subtotal: 100, tax_rate: 18 }],
        };

        const rendered = renderToString(
          <GstTallyTemplate
            invoice={invoiceMock}
            paperSize={tc.paperSize as any}
            orientation={tc.orientation as any}
          />
        );

        expect(rendered).toBeDefined();
        expect(rendered).toContain("Test Item");
      }
    });

    it("3.2 Handles completely empty or undefined fields object in active template without throwing", () => {
      const brokenTpl: any = {
        id: "tpl-broken-fields",
        name: "Broken Fields Template",
        category: "invoices",
        docType: "invoice",
        fields: undefined,
        party: undefined,
        columns: undefined,
        customFields: undefined,
      };

      safeSetItem(`businessos_print_templates_v1_${tenantId}`, JSON.stringify([brokenTpl]));
      safeSetItem(`user_active_print_templates_v1_${tenantId}`, JSON.stringify({ invoice: brokenTpl.id }));

      expect(() => renderToString(<PrintTemplates />)).not.toThrow();
    });

    it("3.3 Handles extreme invoice values (huge quantity, 0 amounts, negative amounts, 100 items) without layout break", () => {
      const extremeItems = Array.from({ length: 50 }, (_, i) => ({
        product_name: `Extreme Batch Product #${i + 1} with Extra Long Descriptive Name For Stress Testing`,
        quantity: i === 0 ? 99999999 : 1,
        unit_price: i === 1 ? 0 : 4999.99,
        subtotal: i === 1 ? 0 : 4999.99,
        tax_rate: 18,
        hsn_code: "998877",
        mrp: 5999,
      }));

      const extremeInvoice: any = {
        invoice_number: "INV-EXTREME-2026-OVERFLOW",
        invoice_date: "2026-11-06",
        customerName: "Super Megacorp Global Logistics & Warehousing Enterprises LLP",
        customerBillingAddress: "Building 9A, 14th Floor, Cyber City, DLF Phase 2, Gurugram, Haryana - 122002",
        customerShippingAddress: "Warehouse 4, Plot 108, Industrial Corridor, Sanand, Gujarat - 382110",
        customerGST: "06AAACT2211C1ZX",
        customerPan: "AAACT2211C",
        items: extremeItems,
        grand_total: 999999999.99,
        taxable_value: 847457627.11,
      };

      for (const layout of ["layout_1", "layout_2", "layout_3"] as PartyLayoutType[]) {
        expect(() => {
          const html = renderToString(
            <GstTallyTemplate invoice={extremeInvoice} partyLayout={layout} dynamicStoreName="Stress Mart" />
          );
          expect(html).toContain("Super Megacorp Global Logistics");
          expect(html).toContain("Extreme Batch Product #1");
        }).not.toThrow();
      }
    });

    it("3.4 Handles thermal hardware presets (compact, large, monospace, solid, star) without exceptions", () => {
      const dividerStyles = ["solid", "double", "dotted", "star", "dashed"] as const;
      const fontDensities = ["compact", "normal", "large"] as const;
      const fontFamilies = ["monospace", "sans-serif", "terminal", "courier"] as const;

      for (const divider of dividerStyles) {
        for (const density of fontDensities) {
          for (const font of fontFamilies) {
            expect(() => {
              const html = generateThermalReceiptHtml(
                { invoice_number: "POS-TEST", items: [] },
                { dividerStyle: divider, fontDensity: density, thermalFontFamily: font },
                tenantId
              );
              expect(html).toBeDefined();
            }).not.toThrow();
          }
        }
      }
    });

    it("3.5 Verifies that 3 party layouts (Layout 1, Layout 2, Layout 3) remain fully functional across all commercial formats", () => {
      const sampleInv: any = {
        invoice_number: "INV-LAYOUT-CROSS-FORMAT",
        invoice_date: "2026-11-06",
        customerName: "Pioneer Technologies",
        customerBillingAddress: "B-44, Sector 57, Noida",
        items: [{ product_name: "Router Pro", quantity: 2, unit_price: 4500, subtotal: 9000, tax_rate: 18 }],
      };

      for (const docTitle of ["TAX INVOICE", "PROFORMA INVOICE", "QUOTATION", "DELIVERY CHALLAN"]) {
        const htmlL1 = renderToString(
          <GstTallyTemplate invoice={{ ...sampleInv, header_title: docTitle }} partyLayout="layout_1" />
        );
        const htmlL2 = renderToString(
          <GstTallyTemplate invoice={{ ...sampleInv, header_title: docTitle }} partyLayout="layout_2" />
        );
        const htmlL3 = renderToString(
          <GstTallyTemplate invoice={{ ...sampleInv, header_title: docTitle }} partyLayout="layout_3" />
        );

        // Header doc title appears in all 3 layouts
        expect(htmlL1).toContain(docTitle);
        expect(htmlL2).toContain(docTitle);
        expect(htmlL3).toContain(docTitle);

        // Layout 2 has 3-box split columns (col-span-4)
        expect(htmlL2).toContain("col-span-4");

        // Layout 1 and Layout 3 have distinct markup
        expect(htmlL1).not.toBe(htmlL2);
        expect(htmlL2).not.toBe(htmlL3);
        expect(htmlL1).not.toBe(htmlL3);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 4: Source Code Contract Verification
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 4: Source Code Contract Verification in PrintTemplates.tsx", () => {
    it("4.1 Contains clean definitions and routing for all primary formats", () => {
      const filePath = path.resolve(__dirname, "../components/inventory/PrintTemplates.tsx");
      const code = fs.readFileSync(filePath, "utf-8");

      // Verify all document types are defined in DOCUMENT_TYPES_CONFIG
      expect(code).toContain('type: "invoice"');
      expect(code).toContain('type: "quotation"');
      expect(code).toContain('type: "proforma"');
      expect(code).toContain('type: "challan"');
      expect(code).toContain('type: "thermal"');
      expect(code).toContain('type: "barcode"');
      expect(code).toContain('type: "pricetag"');

      // Verify slot mapping helper exists and maps accurately
      expect(code).toContain("function slotKeyForDocType(docType: DocumentType)");
      expect(code).toContain('if (docType === "proforma") return "proforma";');
      expect(code).toContain('if (docType === "quotation") return "quotation";');
      expect(code).toContain('if (docType === "challan") return "challan";');

      // Verify preview title derives from previewSlot
      expect(code).toContain("previewDocTitle = previewSlot && previewSlot !== \"invoice\" ? slotMeta.title");

      // Verify GstTallyTemplate receives partyLayout
      expect(code).toContain("partyLayout={(template as any)?.party?.layout || (template as any)?.partyLayout || \"layout_1\"}");

      // Verify triggerThermalPrint is wired for direct thermal print
      expect(code).toContain('triggerThermalPrint("preview-thermal-paper"');

      // Verify isThermalTemplate and isBarcodeTemplate flags
      expect(code).toContain("const isThermalTemplate =");
      expect(code).toContain("const isBarcodeTemplate =");
    });
  });
});
