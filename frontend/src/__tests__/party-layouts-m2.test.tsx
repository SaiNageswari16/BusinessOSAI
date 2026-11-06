import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Storage mock for test environment
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

import { GstTallyTemplate } from "../components/pos/invoice-templates/GstTallyTemplate";
import {
  resolveTemplateColumns,
  createDefaultUnifiedConfig,
  unifiedConfigToPrintTemplate,
  printTemplateToUnifiedConfig,
  type PartyLayoutType,
} from "../lib/invoice-template-config";
import {
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  setActiveBillingGst,
  getActiveBillingGst,
} from "../lib/receipt-template-store";

const mockInvoice: any = {
  id: "inv-m2-test",
  invoice_number: "INV-2026-001",
  invoice_date: "2026-11-05",
  created_at: "2026-11-05T10:00:00Z",
  customerName: "Acme Pharmaceuticals Ltd",
  customerBillingAddress: "42 Healthcare Avenue, Cyber City",
  customerShippingAddress: "",
  customerPhone: "9876543210",
  customerEmail: "contact@acmepharm.in",
  customerGST: "36AABCA1234F1Z1",
  customerPan: "AABCA1234F",
  customerDlNumber: "DL-20B-12345",
  contactPerson: "Dr. Vikram Seth",
  place_of_supply: "36-Telangana",
  grand_total: 15000,
  taxable_value: 12711.86,
  cgst_amount: 1144.07,
  sgst_amount: 1144.07,
  amount_received: 10000,
  balance_due: 5000,
  party_previous_balance: 2500,
  party_current_balance: 7500,
  items: [
    {
      product_name: "Amoxicillin 500mg",
      quantity: 50,
      unit_price: 250,
      tax_rate: 18,
      subtotal: 12500,
      hsn_code: "3004",
      mrp: 300,
      uom: "BOX",
    },
  ],
};

describe("Milestone M2: GstTallyTemplate Party Layouts & Dynamic Parity", () => {
  beforeEach(() => {
    storage.clear();
    listeners.clear();
  });

  it("renders Party Layout 1 (Side-by-Side) with 'Same as Billing Address' fallback", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={mockInvoice}
        dynamicStoreName="MedPlus Warehouse"
        dynamicLogoUrl="/logo.png"
        dynamicAddress="Industrial Area, Hyderabad"
        dynamicPhone="040-1234567"
        sellerGstin="36AABCM9999Z1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_1"
      />
    );

    // Bill To assertions
    expect(html).toContain("Acme Pharmaceuticals Ltd");
    expect(html).toContain("42 Healthcare Avenue, Cyber City");
    expect(html).toContain("Attn: Dr. Vikram Seth");
    expect(html).toContain("9876543210");
    expect(html).toContain("contact@acmepharm.in");
    expect(html).toContain("36AABCA1234F1Z1");
    expect(html).toContain("AABCA1234F");
    expect(html).toContain("DL-20B-12345");

    // Ship To fallback assertion
    expect(html).toContain("Same as Billing Address");
  });

  it("renders Party Layout 2 (3-Box Split Header) with customer details in top header", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={mockInvoice}
        dynamicStoreName="MedPlus Warehouse"
        dynamicLogoUrl="/logo.png"
        dynamicAddress="Industrial Area, Hyderabad"
        dynamicPhone="040-1234567"
        sellerGstin="36AABCM9999Z1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_2"
      />
    );

    // Top Header Split contains seller, meta, and customer
    expect(html).toContain("MedPlus Warehouse");
    expect(html).toContain("INV-2026-001");
    expect(html).toContain("Acme Pharmaceuticals Ltd");
  });

  it("renders Party Layout 3 (Stacked / Full Width)", () => {
    const invoiceWithDiffShipping = {
      ...mockInvoice,
      customerShippingAddress: "Warehouse 4, Port Zone, Mumbai",
    };
    const html = renderToString(
      <GstTallyTemplate
        invoice={invoiceWithDiffShipping}
        dynamicStoreName="MedPlus Warehouse"
        dynamicLogoUrl="/logo.png"
        dynamicAddress="Industrial Area, Hyderabad"
        dynamicPhone="040-1234567"
        sellerGstin="36AABCM9999Z1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_3"
      />
    );

    expect(html).toContain("Acme Pharmaceuticals Ltd");
    expect(html).toContain("Warehouse 4, Port Zone, Mumbai");
  });

  it("respects granular party field toggles", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={mockInvoice}
        dynamicStoreName="MedPlus Warehouse"
        dynamicLogoUrl="/logo.png"
        dynamicAddress="Industrial Area, Hyderabad"
        dynamicPhone="040-1234567"
        sellerGstin="36AABCM9999Z1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_1"
        f={{
          showCustomerPhone: false,
          showCustomerGstin: false,
          showPartyPan: false,
          showDlNumber: false,
          showContactPerson: false,
          showCustomerEmail: false,
          showPartyBalance: false,
        }}
      />
    );

    expect(html).not.toContain("9876543210");
    expect(html).not.toContain("36AABCA1234F1Z1");
    expect(html).not.toContain("AABCA1234F");
    expect(html).not.toContain("DL-20B-12345");
    expect(html).not.toContain("Attn: Dr. Vikram Seth");
    expect(html).not.toContain("contact@acmepharm.in");
    expect(html).not.toContain("Prev Bal:");
  });

  it("renders structured bank details accurately", () => {
    const templateWithBank = {
      miscellaneous: {
        bankDetails: {
          enabled: true,
          bankName: "HDFC Bank",
          accountNumber: "50200012345678",
          ifscCode: "HDFC0001234",
          branchName: "Jubilee Hills",
          accountHolderName: "MedPlus Corp Ltd",
        },
      },
    };

    const html = renderToString(
      <GstTallyTemplate
        invoice={mockInvoice}
        dynamicStoreName="MedPlus Warehouse"
        dynamicLogoUrl="/logo.png"
        dynamicAddress="Industrial Area, Hyderabad"
        dynamicPhone="040-1234567"
        sellerGstin="36AABCM9999Z1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        template={templateWithBank}
      />
    );

    expect(html).toContain("HDFC Bank");
    expect(html).toContain("50200012345678");
    expect(html).toContain("HDFC0001234");
    expect(html).toContain("Jubilee Hills");
    expect(html).toContain("MedPlus Corp Ltd");
  });

  it("generates live UPI QR code dynamically when configured", () => {
    const templateWithQr = {
      miscellaneous: {
        paymentQr: {
          enabled: true,
          upiId: "medplus@hdfcbank",
          payeeName: "MedPlus Corp",
        },
      },
    };

    const html = renderToString(
      <GstTallyTemplate
        invoice={mockInvoice}
        dynamicStoreName="MedPlus Warehouse"
        dynamicLogoUrl="/logo.png"
        dynamicAddress="Industrial Area, Hyderabad"
        dynamicPhone="040-1234567"
        sellerGstin="36AABCM9999Z1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        template={templateWithQr}
      />
    );

    expect(html).toContain("medplus@hdfcbank");
    // Should render SVG QR image with data URL
    expect(html).toContain("data:image/svg+xml");
  });

  it("preserves staticValue in dynamic table columns", () => {
    const cols = [
      { fieldKey: "sno", headerTitle: "#", enabled: true },
      { fieldKey: "description", headerTitle: "Product", enabled: true },
      { fieldKey: "custom_shelf", headerTitle: "Shelf / Rack", enabled: true, isCustom: true, staticValue: "Bay 3B" },
    ];

    const normalized = resolveTemplateColumns(null, cols);
    expect(normalized.length).toBe(3);
    expect(normalized[2].staticValue).toBe("Bay 3B");

    const html = renderToString(
      <GstTallyTemplate
        invoice={mockInvoice}
        dynamicStoreName="MedPlus Warehouse"
        dynamicLogoUrl="/logo.png"
        dynamicAddress="Industrial Area, Hyderabad"
        dynamicPhone="040-1234567"
        sellerGstin="36AABCM9999Z1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        columns={cols}
      />
    );

    expect(html).toContain("Shelf / Rack");
    expect(html).toContain("Bay 3B");
  });
});

describe("Milestone M2: Typing & Category Storage Refinements", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("supports Partial<ActiveGstDetails> in setActiveBillingGst", () => {
    // Should accept partial fields without type or runtime errors
    setActiveBillingGst({ gstin: "36AABCA1234F1Z1" }, "tenant_m2");
    const active = getActiveBillingGst("tenant_m2");
    expect(active?.gstin).toBe("36AABCA1234F1Z1");

    // Partial update
    setActiveBillingGst({ trade_name: "MedPlus Central" }, "tenant_m2");
    const updated = getActiveBillingGst("tenant_m2");
    expect(updated?.gstin).toBe("36AABCA1234F1Z1");
    expect(updated?.trade_name).toBe("MedPlus Central");
  });

  it("supports challanDateLabel in UnifiedInvoiceCustomizerConfig", () => {
    const config = createDefaultUnifiedConfig("challan");
    expect(config.invoice.challanDateLabel).toBe("Challan Date");

    const tpl = unifiedConfigToPrintTemplate(config);
    expect(tpl.secondaryColor).toBe(config.style.secondaryColor);

    const convertedBack = printTemplateToUnifiedConfig(tpl, "challan");
    expect(convertedBack.invoice.challanDateLabel).toBe("Challan Date");
  });

  it("persists and isolates category templates in storage", () => {
    const tid = "tenant_m2_cat";
    setActiveInvoicePrintTemplateForCategory("tpl-gst-tally", "invoice", tid);
    setActiveInvoicePrintTemplateForCategory("tpl-inv-marg-pharma", "quotation", tid);
    setActiveInvoicePrintTemplateForCategory("tpl-inv-fmcg-distributor", "proforma", tid);
    setActiveInvoicePrintTemplateForCategory("tpl-inv-agri-seeds", "challan", tid);

    expect(getActiveInvoicePrintTemplateForCategory("invoice", tid)).toBe("tpl-gst-tally");
    expect(getActiveInvoicePrintTemplateForCategory("quotation", tid)).toBe("tpl-inv-marg-pharma");
    expect(getActiveInvoicePrintTemplateForCategory("proforma", tid)).toBe("tpl-inv-fmcg-distributor");
    expect(getActiveInvoicePrintTemplateForCategory("challan", tid)).toBe("tpl-inv-agri-seeds");
  });
});
