/**
 * test-helpers.ts
 * Shared test utilities, mock browser environment, and authentic Indian GST mock datasets.
 */

export interface MockStorageOptions {
  quotaThreshold?: number; // bytes or char count after which setItem throws QuotaExceededError
  alwaysThrowQuota?: boolean;
}

export class MockLocalStorage {
  private store: Map<string, string> = new Map();
  public quotaThreshold?: number;
  public alwaysThrowQuota: boolean = false;

  constructor(options?: MockStorageOptions) {
    if (options?.quotaThreshold) this.quotaThreshold = options.quotaThreshold;
    if (options?.alwaysThrowQuota) this.alwaysThrowQuota = options.alwaysThrowQuota;
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.alwaysThrowQuota) {
      const err = new Error("QuotaExceededError: The quota has been exceeded.");
      err.name = "QuotaExceededError";
      (err as any).code = 22;
      throw err;
    }
    if (this.quotaThreshold !== undefined) {
      const currentSize = Array.from(this.store.values()).reduce((sum, v) => sum + v.length, 0);
      if (currentSize + value.length > this.quotaThreshold) {
        const err = new Error("QuotaExceededError: DOM Exception 22");
        err.name = "QuotaExceededError";
        (err as any).code = 22;
        throw err;
      }
    }
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  dump(): Record<string, string> {
    return Object.fromEntries(this.store.entries());
  }
}

/**
 * Setup a clean browser mock environment in global scope for storage & event tests.
 */
export function setupBrowserEnvironment(mockStorage?: MockLocalStorage) {
  const storage = mockStorage || new MockLocalStorage();
  const eventListeners = new Map<string, Function[]>();

  const mockWindow: any = {
    localStorage: storage,
    dispatchEvent: (event: any) => {
      const listeners = eventListeners.get(event.type) || [];
      listeners.forEach((fn) => fn(event));
      return true;
    },
    addEventListener: (type: string, listener: Function) => {
      if (!eventListeners.has(type)) eventListeners.set(type, []);
      eventListeners.get(type)!.push(listener);
    },
    removeEventListener: (type: string, listener: Function) => {
      const list = eventListeners.get(type) || [];
      eventListeners.set(
        type,
        list.filter((l) => l !== listener)
      );
    },
    location: {
      search: "",
      pathname: "/",
      href: "http://localhost:8080/",
    },
  };

  (globalThis as any).window = mockWindow;
  (globalThis as any).localStorage = storage;

  if (typeof (globalThis as any).CustomEvent === "undefined") {
    (globalThis as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params?: { detail?: any }) {
        this.type = type;
        this.detail = params?.detail;
      }
    };
  }

  if (typeof (globalThis as any).Event === "undefined") {
    (globalThis as any).Event = class Event {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    };
  }

  return { mockWindow, storage };
}

/**
 * Cleanup browser mocks from global scope.
 */
export function teardownBrowserEnvironment() {
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
}

/**
 * Authentic Indian GST Sample Datasets for Testing
 */
export const SAMPLE_INTRASTATE_INVOICE = {
  id: "inv-2026-001",
  invoice_number: "INV/2026/001",
  invoice_type: "TAX_INVOICE",
  invoice_date: "2026-11-05",
  due_date: "2026-11-20",
  customerName: "Sri Lakshmi Enterprises",
  customerCompany: "Sri Lakshmi Enterprises Private Limited",
  customerBillingAddress: "Shop 12, Main Road, Arundelpet, Guntur, Andhra Pradesh, 522002",
  customerShippingAddress: "Godown 4, Auto Nagar, Guntur, Andhra Pradesh, 522001",
  customerGST: "37AAACS1234F1Z5",
  customerPan: "AAACS1234F",
  customerPhone: "+91 98480 12345",
  place_of_supply: "37 - Andhra Pradesh",
  sellerGstin: "37AACFI1208A1ZU",
  sellerStateCode: "37",
  items: [
    {
      sno: 1,
      item_name: "Basmati Rice Royal Premium",
      description: "1kg sealed pack · Aged 2 Years",
      hsn_code: "10063020",
      batch_no: "BAT-BR-882",
      expiry_date: "2027-10-31",
      uom: "BAG",
      quantity: 50,
      unit_price: 120,
      discount: 100,
      tax_rate: 5,
      taxable_amount: 5900,
      cgst_amount: 147.5,
      sgst_amount: 147.5,
      igst_amount: 0,
      total_amount: 6195,
    },
    {
      sno: 2,
      item_name: "Organic Mustard Oil",
      description: "Cold pressed 1 Litre bottle",
      hsn_code: "15149100",
      batch_no: "BAT-MO-104",
      expiry_date: "2027-05-15",
      uom: "BOT",
      quantity: 20,
      unit_price: 180,
      discount: 0,
      tax_rate: 5,
      taxable_amount: 3600,
      cgst_amount: 90,
      sgst_amount: 90,
      igst_amount: 0,
      total_amount: 3780,
    },
  ],
  subtotal: 9500,
  taxable_value: 9500,
  discount_amount: 100,
  tax_amount: 475,
  cgst_amount: 237.5,
  sgst_amount: 237.5,
  igst_amount: 0,
  round_off: 0.0,
  grand_total: 9975,
  amount_received: 9975,
  balance_due: 0,
  bank_name: "State Bank of India",
  account_number: "30291823901",
  ifsc_code: "SBIN0001234",
  branch: "Kothapet Guntur",
  upi_id: "ismartbazaar@sbi",
  terms_conditions: "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged after due date.",
};

export const SAMPLE_INTERSTATE_INVOICE = {
  id: "inv-2026-002",
  invoice_number: "INV/2026/002",
  invoice_type: "TAX_INVOICE",
  invoice_date: "2026-11-05",
  due_date: "2026-11-15",
  customerName: "Hyderabad Tech Solutions Ltd",
  customerCompany: "Hyderabad Tech Solutions Ltd",
  customerBillingAddress: "Plot 88, Hitec City, Madhapur, Hyderabad, Telangana, 500081",
  customerGST: "36AAACH9876K1Z9",
  customerPan: "AAACH9876K",
  customerPhone: "+91 99887 76655",
  place_of_supply: "36 - Telangana",
  sellerGstin: "37AACFI1208A1ZU",
  sellerStateCode: "37",
  po_number: "PO-HYD-9912",
  po_date: "2026-11-02",
  eway_bill_number: "241098234190",
  eway_bill_date: "2026-11-05",
  vehicle_number: "AP 07 TJ 5521",
  transporter_name: "Navata Road Transport",
  items: [
    {
      sno: 1,
      item_name: "Industrial IoT Gateway Router",
      hsn_code: "85176290",
      quantity: 5,
      unit_price: 15000,
      tax_rate: 18,
      taxable_amount: 75000,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 13500,
      total_amount: 88500,
    },
  ],
  taxable_value: 75000,
  cgst_amount: 0,
  sgst_amount: 0,
  igst_amount: 13500,
  grand_total: 88500,
  amount_received: 50000,
  balance_due: 38500,
};

export const SAMPLE_QUOTATION = {
  id: "qt-2026-0091",
  quote_number: "QT/2026/0091",
  invoice_type: "QUOTATION",
  invoice_date: "2026-11-05",
  customerName: "Ramesh Sharma",
  customerBillingAddress: "Flat 402, Green Meadows, Vijayawada, Andhra Pradesh",
  customerPhone: "+91 94401 23456",
  items: [
    {
      sno: 1,
      item_name: "Custom Modular Kitchen Fitting",
      quantity: 1,
      unit_price: 125000,
      discount: 5000,
      tax_rate: 18,
      total_amount: 141600,
    },
  ],
  grand_total: 141600,
  terms_conditions: "Quotation valid for 15 days from date of issue.",
};

export const SAMPLE_CHALLAN = {
  id: "dc-2026-0045",
  invoice_number: "DC/2026/0045",
  doc_type: "DELIVERY_CHALLAN",
  header_title: "DELIVERY CHALLAN",
  invoice_date: "2026-11-05",
  customerName: "Sri Sai Fabrication Works",
  customerBillingAddress: "Plot 19, Industrial Estate, Tenali, Andhra Pradesh",
  vehicle_number: "AP 07 XY 1234",
  driver_name: "K. Venkatesh",
  driver_phone: "+91 97000 11223",
  items: [
    {
      sno: 1,
      item_name: "Mild Steel Structural Angle 50x50x5mm",
      hsn_code: "72162100",
      batch_no: "STEEL-ROLL-45",
      quantity: 1200,
      uom: "KG",
      unit_price: 0, // Challan for job work / transport without commercial sale
      tax_rate: 0,
      total_amount: 0,
    },
  ],
  grand_total: 0,
  delivery_note: "Goods dispatched for Job Work under Rule 55 of CGST Rules.",
};

export const SAMPLE_PROFORMA = {
  id: "pi-2026-0033",
  invoice_number: "PI/2026/0033",
  invoice_type: "PROFORMA",
  invoice_date: "2026-11-05",
  customerName: "Overseas Exporters Inc.",
  customerBillingAddress: "Suite 300, Trade Tower, Mumbai, Maharashtra",
  customerGST: "27AABCO1234K1Z2",
  items: [
    {
      sno: 1,
      item_name: "Export Quality Spices Assortment",
      hsn_code: "09109929",
      quantity: 200,
      unit_price: 850,
      tax_rate: 5,
      total_amount: 178500,
    },
  ],
  grand_total: 178500,
};
