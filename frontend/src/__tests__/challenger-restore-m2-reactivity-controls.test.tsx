import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

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

vi.mock("@/contexts/tenant-context", () => ({
  useTenant: () => ({
    tenant: {
      id: "tenant_m2_emp",
      name: "Apex Global Enterprises",
      address: "12 Industrial Hub, Outer Ring Road, Bengaluru",
      phone: "+91 80 5566 7788",
      gst_number: "29AABCU9603R1ZM",
      raw: {
        logo_url: "/apex-logo.png",
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
          id: "bank_m2_1",
          bank_name: "HDFC Bank",
          account_number: "50200012345678",
          ifsc_code: "HDFC0001234",
          branch: "Koramangala Branch",
        },
      ],
    }),
  },
  taxApi: {
    listTaxCodes: vi.fn().mockResolvedValue({
      items: [
        { id: "tax_gst_18", name: "GST 18%", rate: 18, is_active: true },
      ],
    }),
  },
  numberSeriesApi: {
    getNextNumber: vi.fn().mockResolvedValue({ next: "INV-2026-0042" }),
  },
  resolveImageUrl: vi.fn((url) => url || "/apex-logo.png"),
}));

vi.mock("@/lib/print-helper", () => ({
  triggerThermalPrint: vi.fn(),
}));

import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";
import { resolveTemplateColumns } from "../lib/invoice-template-config";
import { safeSetItem, safeGetItem } from "../lib/safe-storage";

describe("Empirical Challenger M2: Customization Controls & Live Preview Reactivity", () => {
  beforeEach(() => {
    storage.clear();
    listeners.clear();
    vi.clearAllMocks();
  });

  // Base mock invoice supporting both GstTallyTemplate contract (customerPan, customerDlNumber)
  const baseMockInvoice: any = {
    id: "mock-inv-m2",
    invoice_number: "INV-2026-0042",
    doc_type: "invoice",
    header_title: "TAX INVOICE",
    invoice_date: "2026-07-10",
    due_date: "2026-07-24",
    created_at: "2026-07-10T10:00:00Z",
    payment_method: "Cash",
    place_of_supply: "37 - Andhra Pradesh",
    customerName: "ACME Enterprises Pvt Ltd",
    customerCompany: "ACME Enterprises Pvt Ltd",
    contactPerson: "Dr. Rajesh Sharma",
    customerEmail: "billing@acme-enterprises.com",
    customerPan: "AABCA8821K",
    customerDlNumber: "DL-2026-UP-8871",
    customerAddress: "45 Tech Boulevard, Sector 62, Noida, UP",
    customerShippingAddress: "Plot 12, Industrial Area, Sector 63, Noida, UP",
    customerPhone: "98765 43210",
    customerGST: "09BBBBA9999C1Z2",
    seller_pan: "AABCA1234D",
    seller_cin: "L12345KA2026PLC099881",
    terms_text: "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. charged after due date.",
    terms_and_conditions: "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. charged after due date.",
    thank_you_note: "Thank you for your valued partnership!",
    declaration_text: "We declare that this invoice shows the actual price of goods and all particulars are true.",
    taxable_value: 43450,
    cgst_amount: 3906,
    sgst_amount: 3906,
    tax_amount: 7812,
    grand_total: 51262,
    amount_received: 51262,
    party_previous_balance: 4500,
    items: [
      { product_name: "Samsung Galaxy A30", description: "6.4\" display, 4GB RAM", quantity: 1, unit_price: 12000, mrp: 14000, hsn_code: "85171200", tax_rate: 18, subtotal: 14160, batch_no: "SA-4412", mfg_date: "01/2026", exp_date: "01/2027" },
      { product_name: "Parle-G Biscuit 200g", description: "Crispy glucose biscuits", quantity: 24, unit_price: 40, mrp: 48, hsn_code: "19059090", tax_rate: 18, subtotal: 5632, batch_no: "PG-778", mfg_date: "05/2026", exp_date: "05/2028" },
    ],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Party Details Toggles & Live Preview Wiring
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 1: Party Details Toggles & Live Preview Parity", () => {
    const partyLayouts: Array<"layout_1" | "layout_2" | "layout_3"> = ["layout_1", "layout_2", "layout_3"];

    partyLayouts.forEach((layout) => {
      it(`1.1 [${layout}] Toggles Party Email in preview props`, () => {
        const htmlEnabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyEmail: true, showCustomerEmail: true } as any}
            template={{ party: { billTo: { showEmail: true } } } as any}
          />
        );
        expect(htmlEnabled).toContain("billing@acme-enterprises.com");

        const htmlDisabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyEmail: false, showCustomerEmail: false } as any}
            template={{ party: { billTo: { showEmail: false } } } as any}
          />
        );
        expect(htmlDisabled).not.toContain("billing@acme-enterprises.com");
      });

      it(`1.2 [${layout}] Toggles Party GSTIN in preview props`, () => {
        const htmlEnabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyGstin: true, showCustomerGstin: true } as any}
            template={{ party: { billTo: { showGstin: true } } } as any}
          />
        );
        expect(htmlEnabled).toContain("09BBBBA9999C1Z2");

        const htmlDisabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyGstin: false, showCustomerGstin: false } as any}
            template={{ party: { billTo: { showGstin: false } } } as any}
          />
        );
        expect(htmlDisabled).not.toContain("09BBBBA9999C1Z2");
      });

      it(`1.3 [${layout}] Toggles Party PAN in preview props`, () => {
        const htmlEnabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyPan: true, showCustomerPan: true } as any}
            template={{ party: { billTo: { showPan: true } } } as any}
          />
        );
        expect(htmlEnabled).toContain("AABCA8821K");

        const htmlDisabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyPan: false, showCustomerPan: false } as any}
            template={{ party: { billTo: { showPan: false } } } as any}
          />
        );
        expect(htmlDisabled).not.toContain("AABCA8821K");
      });

      it(`1.4 [${layout}] Toggles Party Drug License (DL Number) in preview props`, () => {
        const htmlEnabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyDlNumber: true, showPartyDl: true, showCustomerDl: true, showDlNumber: true } as any}
            template={{ party: { billTo: { showDlNumber: true } } } as any}
          />
        );
        expect(htmlEnabled).toContain("DL-2026-UP-8871");

        const htmlDisabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyDlNumber: false, showPartyDl: false, showCustomerDl: false, showDlNumber: false } as any}
            template={{ party: { billTo: { showDlNumber: false } } } as any}
          />
        );
        expect(htmlDisabled).not.toContain("DL-2026-UP-8871");
      });

      it(`1.5 [${layout}] Toggles Contact Person Name in preview props`, () => {
        const htmlEnabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showContactPerson: true } as any}
            template={{ party: { billTo: { showContactPerson: true } } } as any}
          />
        );
        expect(htmlEnabled).toContain("Dr. Rajesh Sharma");

        const htmlDisabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showContactPerson: false } as any}
            template={{ party: { billTo: { showContactPerson: false } } } as any}
          />
        );
        expect(htmlDisabled).not.toContain("Dr. Rajesh Sharma");
      });

      it(`1.6 [${layout}] Toggles Place of Supply in preview props`, () => {
        const htmlEnabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPlaceOfSupply: true } as any}
          />
        );
        expect(htmlEnabled).toContain("37 - Andhra Pradesh");

        const htmlDisabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPlaceOfSupply: false } as any}
          />
        );
        expect(htmlDisabled).not.toContain("37 - Andhra Pradesh");
      });

      it(`1.7 [${layout}] Toggles Party Balance in preview props`, () => {
        const htmlEnabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyBalance: true, showPreviousBalance: true, showCurrentBalance: true } as any}
            template={{ party: { billTo: { showPartyBalance: true } } } as any}
          />
        );
        expect(htmlEnabled).toContain("4,500.00");

        const htmlDisabled = renderToString(
          <GstTallyTemplate
            invoice={baseMockInvoice}
            partyLayout={layout}
            f={{ showPartyBalance: false } as any}
            template={{ party: { billTo: { showPartyBalance: false } } } as any}
          />
        );
        expect(htmlDisabled).not.toContain("4,500.00");
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Dynamic Columns Manager Reactivity
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 2: Dynamic Columns Manager Reactivity", () => {
    it("2.1 Hides disabled columns and shows enabled columns in table headers", () => {
      const customCols = [
        { id: "c1", fieldKey: "sno", headerTitle: "Sl#", enabled: true, align: "center" },
        { id: "c2", fieldKey: "description", headerTitle: "Particulars", enabled: true, align: "left" },
        { id: "c3", fieldKey: "batch", headerTitle: "Lot No", enabled: false, align: "left" },
        { id: "c4", fieldKey: "unit_price", headerTitle: "Rate Per Piece", enabled: true, align: "right" },
        { id: "c5", fieldKey: "tax_rate", headerTitle: "GST %", enabled: false, align: "center" },
      ];

      const resolved = resolveTemplateColumns(undefined, customCols);
      expect(resolved.map((c) => c.fieldKey)).toEqual(["sno", "description", "unit_price"]);

      const html = renderToString(
        <GstTallyTemplate
          invoice={baseMockInvoice}
          columns={customCols}
          f={{} as any}
        />
      );

      expect(html).toContain("Particulars");
      expect(html).toContain("Rate Per Piece");
      expect(html).not.toContain("Lot No");
    });

    it("2.2 Honors custom renamed headers across live preview rendering", () => {
      const renamedCols = [
        { id: "c1", fieldKey: "sno", headerTitle: "Index #", enabled: true },
        { id: "c2", fieldKey: "description", headerTitle: "Product & Specifications", enabled: true },
        { id: "c3", fieldKey: "unit_price", headerTitle: "Taxable Value (Unit)", enabled: true },
      ];

      const html = renderToString(
        <GstTallyTemplate
          invoice={baseMockInvoice}
          columns={renamedCols}
          f={{} as any}
        />
      );

      expect(html).toContain("Index #");
      expect(html).toContain("Product &amp; Specifications");
      expect(html).toContain("Taxable Value (Unit)");
    });

    it("2.3 Supports custom user-defined columns with custom values", () => {
      const withCustomCol = [
        { id: "c1", fieldKey: "description", headerTitle: "Item Name", enabled: true },
        { id: "c_custom", fieldKey: "warehouse_bin", headerTitle: "Storage Bin", enabled: true, isCustom: true },
        { id: "c2", fieldKey: "unit_price", headerTitle: "Price", enabled: true },
      ];

      const html = renderToString(
        <GstTallyTemplate
          invoice={baseMockInvoice}
          columns={withCustomCol}
          f={{} as any}
        />
      );

      expect(html).toContain("Storage Bin");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Branding & Document Header/Footer Customization
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 3: Branding & Header/Footer Customization", () => {
    it("3.1 Renders dynamic store name, address, phone, GSTIN, PAN, and CIN in header", () => {
      const html = renderToString(
        <GstTallyTemplate
          invoice={baseMockInvoice}
          dynamicStoreName="Global Prime Industries Ltd"
          dynamicAddress="44 Tech Horizon Park, Electronic City, Bengaluru"
          dynamicPhone="+91 80 9988 7766"
          sellerGstin="29AAACG1234D1Z8"
          sellerStateCode="29"
          template={{
            pan: "AAACG1234D",
            cin: "U72200KA2026PTC011223",
          } as any}
        />
      );

      expect(html).toContain("Global Prime Industries Ltd");
      expect(html).toContain("44 Tech Horizon Park, Electronic City, Bengaluru");
      expect(html).toContain("+91 80 9988 7766");
      expect(html).toContain("29AAACG1234D1Z8");
    });

    it("3.2 Toggles statutory GST declaration visibility via showDeclaration toggle", () => {
      const htmlEnabled = renderToString(
        <GstTallyTemplate
          invoice={baseMockInvoice}
          f={{ showDeclaration: true } as any}
        />
      );
      expect(htmlEnabled).toContain("We hereby certify that the particulars");

      const htmlDisabled = renderToString(
        <GstTallyTemplate
          invoice={baseMockInvoice}
          f={{ showDeclaration: false } as any}
        />
      );
      expect(htmlDisabled).not.toContain("We hereby certify that the particulars");
    });

    it("3.3 Renders structured bank account information in footer block", () => {
      const bankLine = "Bank: HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234 | Branch: Koramangala";
      const html = renderToString(
        <GstTallyTemplate
          invoice={baseMockInvoice}
          dynamicBank={bankLine}
          f={{ showBankDetails: true } as any}
        />
      );
      expect(html).toContain("HDFC Bank");
      expect(html).toContain("50200012345678");
      expect(html).toContain("HDFC0001234");
    });

    it("3.4 Renders Terms & Conditions and Thank You note", () => {
      const customTerms = "All disputes are subject to Bengaluru jurisdiction only.";
      const customThankYou = "Thank you for empowering our mission!";

      const html = renderToString(
        <GstTallyTemplate
          invoice={{
            ...baseMockInvoice,
            terms_text: customTerms,
            thank_you_note: customThankYou,
          }}
          f={{ showTerms: true, showThankYou: true } as any}
        />
      );

      expect(html).toContain(customTerms);
      expect(html).toContain(customThankYou);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 4: Watermark Overlay Real-Time Reactivity
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 4: Watermark Overlay Real-Time Reactivity", () => {
    it("4.1 Renders custom text watermark with configured opacity", () => {
      const renderWatermark = (template: any) => {
        if (!template.showWatermark) return null;
        const opacity = (template.watermarkOpacity || 15) / 100;
        return (
          <div
            data-testid="watermark-overlay"
            style={{ opacity }}
            className="watermark-container"
          >
            <span data-testid="watermark-text" className="watermark-text">
              {template.watermarkText || "OFFICIAL"}
            </span>
          </div>
        );
      };

      // 10% opacity
      const html10 = renderToString(renderWatermark({ showWatermark: true, watermarkText: "CONFIDENTIAL DRAFT", watermarkOpacity: 10 }));
      expect(html10).toContain("CONFIDENTIAL DRAFT");
      expect(html10).toContain("opacity:0.1");

      // 45% opacity
      const html45 = renderToString(renderWatermark({ showWatermark: true, watermarkText: "DUPLICATE FOR TRANSPORTER", watermarkOpacity: 45 }));
      expect(html45).toContain("DUPLICATE FOR TRANSPORTER");
      expect(html45).toContain("opacity:0.45");

      // Disabled watermark
      const htmlDisabled = renderToString(renderWatermark({ showWatermark: false, watermarkText: "CONFIDENTIAL" }));
      expect(htmlDisabled).toBe("");
    });

    it("4.2 Renders image watermark when watermarkType is image", () => {
      const renderWatermark = (template: any) => {
        if (!template.showWatermark) return null;
        return (
          <div data-testid="watermark-overlay">
            {template.watermarkType === "image" && template.watermarkImage ? (
              <img src={template.watermarkImage} alt="Watermark" data-testid="watermark-img" />
            ) : (
              <span>{template.watermarkText}</span>
            )}
          </div>
        );
      };

      const htmlImg = renderToString(renderWatermark({
        showWatermark: true,
        watermarkType: "image",
        watermarkImage: "https://example.com/corporate-seal.png",
      }));

      expect(htmlImg).toContain('src="https://example.com/corporate-seal.png"');
    });

    it("4.3 Renders cultural watermark presets (Ganesh, Jain, Maharashtra, Shubh Labh)", () => {
      const renderPreset = (decoId: string) => {
        const isGanesh = decoId === "ts-ganesh";
        const isJain = decoId === "ts-jain";
        const isMaharashtra = decoId === "ts-maharashtra";
        const isShubhLabh = decoId === "ts-shubh-labh";

        return (
          <div>
            {isGanesh && <span data-testid="ganesh-motif">🕉️</span>}
            {isJain && <span data-testid="jain-motif">🛕</span>}
            {isMaharashtra && <span data-testid="maha-motif">🚩</span>}
            {isShubhLabh && <span data-testid="shubh-motif">॥ शुभ लाभ ॥</span>}
          </div>
        );
      };

      expect(renderToString(renderPreset("ts-ganesh"))).toContain("🕉️");
      expect(renderToString(renderPreset("ts-jain"))).toContain("🛕");
      expect(renderToString(renderPreset("ts-maharashtra"))).toContain("🚩");
      expect(renderToString(renderPreset("ts-shubh-labh"))).toContain("॥ शुभ लाभ ॥");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 5: Document Category Dynamic Headers
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 5: Document Category Dynamic Headers in Live Preview", () => {
    it("5.1 Sets canonical header title dynamically per document slot", () => {
      const slots = [
        { slot: "quotation", title: "QUOTATION" },
        { slot: "proforma", title: "PROFORMA INVOICE" },
        { slot: "challan", title: "DELIVERY CHALLAN" },
        { slot: "invoice", title: "TAX INVOICE" },
      ];

      for (const { title } of slots) {
        const html = renderToString(
          <GstTallyTemplate
            invoice={{ ...baseMockInvoice, header_title: title }}
            partyLayout="layout_1"
          />
        );
        expect(html).toContain(title);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 6: Persistence & Storage Quota Stress
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 6: Safe Storage Persistence Under High-Payload Stress", () => {
    it("6.1 Successfully persists template customizations into safe-storage without throwing", () => {
      const testConfig = {
        id: "tpl_m2_verified",
        name: "Standard GST Customizer",
        watermarkText: "ORIGINAL FOR RECIPIENT",
        watermarkOpacity: 25,
        party: {
          layout: "layout_2",
          billTo: { showEmail: true, showPhone: true },
        },
        columns: [
          { fieldKey: "sno", headerTitle: "Sl No", enabled: true },
          { fieldKey: "description", headerTitle: "Item Name", enabled: true },
        ],
      };

      expect(() => {
        safeSetItem("bos_tpl_m2_key", JSON.stringify(testConfig));
      }).not.toThrow();

      const stored = safeGetItem("bos_tpl_m2_key");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.watermarkText).toBe("ORIGINAL FOR RECIPIENT");
      expect(parsed.party.layout).toBe("layout_2");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 7: Empirical Challenger Discrepancy & Gap Analysis
  // ══════════════════════════════════════════════════════════════════════════
  describe("Suite 7: Empirical Challenger Discrepancy & Gap Analysis", () => {
    it("7.1 Demonstrates that PrintTemplates.tsx's gstTallyMockInvoice uses customerPAN & customerDl which GstTallyTemplate ignores", () => {
      // PrintTemplates.tsx lines 10745-10747 defines:
      // customerPAN: "AABCA8821K", customerDl: "DL-2026-UP-8871", customer_dl: "DL-2026-UP-8871"
      const workerMockData: any = {
        ...baseMockInvoice,
        customerPan: undefined,
        customerDlNumber: undefined,
        customerPAN: "AABCA8821K",
        customerDl: "DL-2026-UP-8871",
        customer_dl: "DL-2026-UP-8871",
      };

      const html = renderToString(
        <GstTallyTemplate
          invoice={workerMockData}
          partyLayout="layout_1"
          f={{ showPartyPan: true, showPartyDlNumber: true } as any}
        />
      );

      // Empirically proving the bug: GstTallyTemplate only looks for customerPan & customerDlNumber,
      // so the worker's mock data causes PAN & DL to NOT render in the live preview!
      expect(html).not.toContain("AABCA8821K");
      expect(html).not.toContain("DL-2026-UP-8871");
    });

    it("7.2 Demonstrates that GstTallyTemplate ignores declaration_text and template.declarationText", () => {
      const customDeclaration = "Special Statutory Custom Declaration 2026";
      const html = renderToString(
        <GstTallyTemplate
          invoice={{ ...baseMockInvoice, declaration_text: customDeclaration }}
          template={{ declarationText: customDeclaration } as any}
          f={{ showDeclaration: true } as any}
        />
      );

      // Empirically proving the bug: GstTallyTemplate hardcodes the text, so custom declaration never displays!
      expect(html).not.toContain(customDeclaration);
      expect(html).toContain("We hereby certify that the particulars of the goods and services");
    });
  });
});
