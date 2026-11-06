import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

// Polyfill minimal browser environment for React SSR tests
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
import { resolveTemplateColumns } from "../lib/invoice-template-config";

const sampleInvoice: any = {
  id: "inv-emp-01",
  invoice_number: "INV-CHALLENGE-2026",
  invoice_date: "2026-11-05",
  created_at: "2026-11-05T12:00:00Z",
  customerName: "Apollo Hospitals Enterprise",
  customerBillingAddress: "Plot 21, Road No 2, Banjara Hills, Hyderabad 500034",
  customerShippingAddress: "",
  customerPhone: "040-23607777",
  customerEmail: "purchase@apollohospitals.com",
  customerGST: "36AAACA1234E1Z7",
  customerPan: "AAACA1234E",
  customerDlNumber: "DL-TS-HYD-998877",
  contactPerson: "Dr. Sangita Reddy",
  place_of_supply: "36-Telangana",
  grand_total: 25400,
  taxable_value: 21525.42,
  cgst_amount: 1937.29,
  sgst_amount: 1937.29,
  amount_received: 20000,
  balance_due: 5400,
  party_previous_balance: 15000,
  party_current_balance: 20400,
  items: [
    {
      product_name: "Diagnostic Reagent Kit A",
      quantity: 10,
      unit_price: 1500,
      tax_rate: 18,
      subtotal: 15000,
      hsn_code: "3822",
      mrp: 1800,
      uom: "KIT",
    },
    {
      product_name: "Sterile Surgical Gloves 7.5",
      quantity: 20,
      unit_price: 326.27,
      tax_rate: 18,
      subtotal: 6525.42,
      hsn_code: "4015",
      mrp: 400,
      uom: "PAIR",
    },
  ],
};

describe("Adversarial Challenge: Party Layout 1 (Side-by-Side)", () => {
  beforeEach(() => {
    storage.clear();
    listeners.clear();
  });

  it("renders Bill To and Ship To in equal 6-column side-by-side split", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_1"
      />
    );

    // Verify grid side-by-side classes
    expect(html).toContain("col-span-6 border-r-2");
    expect(html).toContain("col-span-6");
    expect(html).toContain("Apollo Hospitals Enterprise");
    expect(html).toContain("Same as Billing Address");
  });

  it("renders distinct shipping address when explicitly provided", () => {
    const invoiceWithDiffShipping = {
      ...sampleInvoice,
      customerShippingAddress: "Apollo Central Pharmacy Store, Secunderabad 500003",
    };
    const html = renderToString(
      <GstTallyTemplate
        invoice={invoiceWithDiffShipping}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_1"
      />
    );

    expect(html).toContain("Apollo Central Pharmacy Store, Secunderabad 500003");
    expect(html).not.toContain("Same as Billing Address");
  });

  it("handles shipping address matching billing address identically", () => {
    const invoiceWithIdenticalShipping = {
      ...sampleInvoice,
      customerShippingAddress: sampleInvoice.customerBillingAddress,
    };
    const html = renderToString(
      <GstTallyTemplate
        invoice={invoiceWithIdenticalShipping}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_1"
      />
    );

    expect(html).toContain("Same as Billing Address");
  });

  it("expands Bill To to full col-span-12 when showShipTo is false", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_1"
        f={{ showShipTo: false }}
      />
    );

    expect(html).toContain("col-span-12");
    expect(html).not.toContain("Shipped To :");
    expect(html).not.toContain("Same as Billing Address");
  });

  it("expands Ship To to full col-span-12 when showBillTo is false", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_1"
        f={{ showBillTo: false }}
      />
    );

    expect(html).toContain("col-span-12");
    expect(html).not.toContain("Bill To / Customer");
    expect(html).toContain("Ship To / Destination");
    expect(html).toContain("Same as Billing Address");
  });
});

describe("Adversarial Challenge: Party Layout 2 (3-Box Split)", () => {
  it("renders 3-box split: Seller (left), Invoice Meta (center), Customer (right)", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_2"
      />
    );

    // In layout 2, the top header has col-span-4 for seller, col-span-4 for meta, col-span-4 for customer
    expect(html).toContain("Biotech Diagnostics");
    expect(html).toContain("INV-CHALLENGE-2026");
    expect(html).toContain("Apollo Hospitals Enterprise");
    expect(html).toContain("Party GSTIN");
    expect(html).toContain("36AAACA1234E1Z7");

    // Must NOT render separate Layout 1 or Layout 3 rows below
    expect(html).not.toContain("Default Delivery");
  });

  it("gracefully falls back when customer box is toggled off", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_2"
        f={{ showBillTo: false, showShipTo: false }}
      />
    );

    // Top header should expand seller & meta to col-span-6 each without 3rd empty box
    expect(html).toContain("col-span-6");
    expect(html).not.toContain("Apollo Hospitals Enterprise");
  });
});

describe("Adversarial Challenge: Party Layout 3 (Stacked)", () => {
  it("renders Bill To on top and Ship To stacked directly beneath", () => {
    const invoiceWithDiffShipping = {
      ...sampleInvoice,
      customerShippingAddress: "Warehouse 10, Logistics Hub, Shamshabad",
    };
    const html = renderToString(
      <GstTallyTemplate
        invoice={invoiceWithDiffShipping}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_3"
        texts={{ partyTitle: "Billed To", shipToTitle: "Shipped To" } as any}
      />
    );

    const billToIndex = html.indexOf("Billed To");
    const shipToIndex = html.indexOf("Shipped To");

    expect(billToIndex).toBeGreaterThan(-1);
    expect(shipToIndex).toBeGreaterThan(-1);
    // Bill To must appear before Ship To in DOM (stacked)
    expect(billToIndex).toBeLessThan(shipToIndex);
    expect(html).toContain("Apollo Hospitals Enterprise");
    expect(html).toContain("Warehouse 10, Logistics Hub, Shamshabad");
  });
});

describe("Adversarial Challenge: Granular Party Toggles", () => {
  it("omits toggled-off fields cleanly without DOM corruption", () => {
    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        partyLayout="layout_1"
        f={{
          showPartyPhone: false,
          showCustomerEmail: false,
          showPartyGstin: false,
          showPartyPan: false,
          showPartyBalance: false,
          showContactPerson: false,
        }}
      />
    );

    // Toggled-off values should not exist
    expect(html).not.toContain("040-23607777");
    expect(html).not.toContain("purchase@apollohospitals.com");
    expect(html).not.toContain("36AAACA1234E1Z7");
    expect(html).not.toContain("AAACA1234E");
    expect(html).not.toContain("Prev Bal:");
    expect(html).not.toContain("Curr Bal:");
    expect(html).not.toContain("Attn: Dr. Sangita Reddy");

    // But customer name and address remain intact
    expect(html).toContain("Apollo Hospitals Enterprise");
    expect(html).toContain("Plot 21, Road No 2, Banjara Hills");
  });
});

describe("Adversarial Challenge: Dynamic Table Columns & Styling", () => {
  it("applies custom headers, width percentage, alignment, and preserves staticValue", () => {
    const customCols = [
      { id: "col_sno", fieldKey: "sno", headerTitle: "Sl#", widthPercent: 8, align: "center", enabled: true },
      { id: "col_desc", fieldKey: "description", headerTitle: "Diagnostic Item", widthPercent: 42, align: "left", enabled: true },
      { id: "col_batch", fieldKey: "batch", headerTitle: "Lot / Batch", widthPercent: 15, align: "center", enabled: true },
      { id: "col_loc", fieldKey: "storage_bin", headerTitle: "Bin Location", widthPercent: 15, align: "center", enabled: true, isCustom: true, staticValue: "Zone-B Cold Chain" },
      { id: "col_amt", fieldKey: "total_amount", headerTitle: "Net Value", widthPercent: 20, align: "right", enabled: true },
    ];

    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        columns={customCols}
      />
    );

    // Verify custom header names
    expect(html).toContain("Sl#");
    expect(html).toContain("Diagnostic Item");
    expect(html).toContain("Lot / Batch");
    expect(html).toContain("Bin Location");
    expect(html).toContain("Net Value");

    // Verify staticValue preservation
    expect(html).toContain("Zone-B Cold Chain");

    // Verify width styles
    expect(html).toContain("width:42%");
    expect(html).toContain("width:8%");
    expect(html).toContain("width:20%");

    // Verify alignment classes
    expect(html).toContain("text-center");
    expect(html).toContain("text-left");
    expect(html).toContain("text-right");
  });

  it("applies zebra striping, custom header background and text colors", () => {
    const templateWithStyling = {
      itemTable: {
        styling: {
          showZebraStripes: true,
          showVerticalBorders: true,
          headerBgColor: "#1e3a8a",
          headerTextColor: "#ffffff",
        },
      },
    };

    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        template={templateWithStyling}
      />
    );

    expect(html).toContain("background-color:#1e3a8a");
    expect(html).toContain("color:#ffffff");
    expect(html).toContain("bg-gray-50/70"); // Zebra striping class on odd item
  });
});

describe("Adversarial Challenge: Live UPI QR Code Generation & Suppression", () => {
  it("generates valid SVG data URI when UPI ID is configured", () => {
    const templateWithQr = {
      miscellaneous: {
        paymentQr: {
          enabled: true,
          upiId: "biotech@icici",
          payeeName: "Biotech Diagnostics Private Ltd",
        },
      },
    };

    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        template={templateWithQr}
      />
    );

    expect(html).toContain("biotech@icici");
    expect(html).toContain("data:image/svg+xml");
    expect(html).toContain("Scan with GPay, PhonePe, Paytm, BHIM");
  });

  it("suppresses UPI QR code when f.showQR is false", () => {
    const templateWithQr = {
      miscellaneous: {
        paymentQr: {
          enabled: true,
          upiId: "biotech@icici",
          payeeName: "Biotech Diagnostics Private Ltd",
        },
      },
    };

    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        template={templateWithQr}
        f={{ showQR: false }}
      />
    );

    expect(html).not.toContain("biotech@icici");
    expect(html).not.toContain("data:image/svg+xml;utf8,<svg");
  });

  it("suppresses UPI QR code when paymentQr.enabled is false in template", () => {
    const templateWithDisabledQr = {
      miscellaneous: {
        paymentQr: {
          enabled: false,
          upiId: "biotech@icici",
          payeeName: "Biotech Diagnostics Private Ltd",
        },
      },
    };

    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        template={templateWithDisabledQr}
      />
    );

    expect(html).not.toContain("biotech@icici");
  });

  it("suppresses UPI QR code when upiId is empty string or whitespace", () => {
    const templateWithBlankUpi = {
      miscellaneous: {
        paymentQr: {
          enabled: true,
          upiId: "   ",
          payeeName: "Biotech Diagnostics Private Ltd",
        },
      },
    };

    const html = renderToString(
      <GstTallyTemplate
        invoice={sampleInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        template={templateWithBlankUpi}
      />
    );

    expect(html).not.toContain("Scan with GPay");
  });

  it("renders 'PAID IN FULL' badge when invoice balance is 0", () => {
    const paidInvoice = {
      ...sampleInvoice,
      amount_received: sampleInvoice.grand_total,
      balance_due: 0,
    };

    const templateWithQr = {
      miscellaneous: {
        paymentQr: {
          enabled: true,
          upiId: "biotech@icici",
          payeeName: "Biotech Diagnostics Private Ltd",
        },
      },
    };

    const html = renderToString(
      <GstTallyTemplate
        invoice={paidInvoice}
        dynamicStoreName="Biotech Diagnostics"
        dynamicLogoUrl=""
        dynamicAddress="Bio Valley, Hyderabad"
        dynamicPhone="040-55551234"
        sellerGstin="36AABCB0000A1Z5"
        currency={{ symbol: "₹", code: "INR" }}
        template={templateWithQr}
      />
    );

    expect(html).toContain("PAID IN FULL");
  });
});
