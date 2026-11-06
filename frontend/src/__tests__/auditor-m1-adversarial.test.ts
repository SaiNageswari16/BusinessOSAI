import { describe, it, expect, beforeEach } from "vitest";

const storage = new Map<string, string>();
const listeners = new Map<string, Function[]>();
let throwQuotaErrorCount = 0;

const storageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => {
    if (throwQuotaErrorCount > 0) {
      throwQuotaErrorCount--;
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      (err as any).code = 22;
      throw err;
    }
    storage.set(key, String(val));
  },
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
  safeSetItem,
  sanitizeForStorage,
  compressImageForStorage,
  NON_CRITICAL_CACHE_KEYS,
  PROTECTED_STORAGE_PREFIXES,
} from "../lib/safe-storage";

import {
  docTitleFor,
  docNoLabelFor,
  docDateLabelFor,
  detectDocCategory,
  printTemplateToUnifiedConfig,
  unifiedConfigToPrintTemplate,
} from "../lib/invoice-template-config";

describe("Auditor Adversarial Stress Test: QuotaExceeded Recovery", () => {
  beforeEach(() => {
    storage.clear();
    throwQuotaErrorCount = 0;
  });

  it("purges non-critical cache on QuotaExceededError and preserves protected keys", () => {
    // Setup initial storage state
    storage.set("bos-store-products-cache", "disposable product cache");
    storage.set("bos_temp_pdf_overlay", "disposable pdf data");
    storage.set("businessos_print_templates_v1_tenant1", "CRITICAL_USER_TEMPLATE");
    storage.set("bos_active_invoice_template_id_tenant1", "tpl-active-master");

    // Configure storage to throw QuotaExceededError ONCE, then succeed on retry
    throwQuotaErrorCount = 1;

    const success = safeSetItem("bos_signature_settings_tenant1", JSON.stringify({ signature_title: "Manager" }));

    expect(success).toBe(true);
    // Non-critical cache keys MUST have been purged
    expect(storage.get("bos-store-products-cache")).toBeUndefined();
    expect(storage.get("bos_temp_pdf_overlay")).toBeUndefined();
    // Protected keys MUST NOT have been purged
    expect(storage.get("businessos_print_templates_v1_tenant1")).toBe("CRITICAL_USER_TEMPLATE");
    expect(storage.get("bos_active_invoice_template_id_tenant1")).toBe("tpl-active-master");
    // Newly written key MUST be present
    expect(storage.get("bos_signature_settings_tenant1")).toContain("Manager");
  });

  it("handles permanent QuotaExceeded gracefully without throwing unhandled exceptions", () => {
    // Configure storage to continuously throw QuotaExceeded
    throwQuotaErrorCount = 999;

    expect(() => {
      const result = safeSetItem("some_key", JSON.stringify({ data: "payload" }));
      expect(result).toBe(false);
    }).not.toThrow();
  });
});

describe("Auditor Adversarial Stress Test: Data Sanitization & Resilience", () => {
  it("handles circular reference in sanitizeForStorage without infinite recursion", () => {
    const circularObj: any = { name: "test" };
    circularObj.self = circularObj;

    expect(() => {
      const sanitized = sanitizeForStorage(circularObj);
      expect(sanitized).toBeDefined();
      expect(sanitized.name).toBe("test");
    }).not.toThrow();
  });

  it("sanitizes nested arrays and deeply nested objects", () => {
    const complex = {
      nested: {
        images: [
          "data:image/png;base64," + "X".repeat(300_000), // oversized
          "data:image/png;base64," + "Y".repeat(50_000),  // valid
        ],
      },
    };

    const sanitized = sanitizeForStorage(complex);
    expect(sanitized.nested.images[0]).toBe("");
    expect(sanitized.nested.images[1].length).toBe(50_022);
  });

  it("compressImageForStorage handles SSR/Node gracefully", async () => {
    const result = await compressImageForStorage("data:image/svg+xml;utf8,<svg></svg>");
    expect(result).toBe("data:image/svg+xml;utf8,<svg></svg>");
  });
});

describe("Auditor Adversarial Stress Test: Document Classification & Title Fallbacks", () => {
  const dummyTexts: any = {
    invoiceTitle: "TAX INVOICE",
    quotationTitle: "QUOTATION",
    estimateTitle: "ESTIMATE",
    proformaTitle: "PROFORMA",
    challanTitle: "DELIVERY CHALLAN",
    invoiceNoLabel: "Invoice No",
    quoteNoLabel: "Quote No",
    estimateNoLabel: "Estimate No",
    proformaNoLabel: "Proforma No",
    challanNoLabel: "Challan No",
    invoiceDateLabel: "Date",
    quoteDateLabel: "Quote Date",
    estimateDateLabel: "Estimate Date",
    challanDateLabel: "Challan Date",
  };

  it("prioritizes forced titles over document type defaults", () => {
    const inv = { invoice_type: "CHALLAN", header_title: "CUSTOM DELIVERY DOCKET" };
    expect(docTitleFor(inv, dummyTexts)).toBe("CUSTOM DELIVERY DOCKET");
  });

  it("detects case variations and doc_type field correctly", () => {
    expect(detectDocCategory({ doc_type: "challan" })).toBe("challan");
    expect(detectDocCategory({ invoice_number: "dc-1002" })).toBe("challan");
    expect(detectDocCategory({ doc_type: "proforma" })).toBe("proforma");
    expect(detectDocCategory({ invoice_number: "pi-001" })).toBe("proforma");
    expect(detectDocCategory({ quote_number: "qt-55" })).toBe("quotation");
    expect(detectDocCategory({ invoice_type: "estimate" })).toBe("estimate");
  });

  it("handles null / undefined / empty invoice objects without crashing", () => {
    expect(() => docTitleFor(null, dummyTexts)).not.toThrow();
    expect(() => docNoLabelFor(undefined, dummyTexts)).not.toThrow();
    expect(() => docDateLabelFor({}, dummyTexts)).not.toThrow();
    expect(docTitleFor(null, dummyTexts)).toBe("TAX INVOICE");
    expect(docNoLabelFor(undefined, dummyTexts)).toBe("Invoice No");
    expect(docDateLabelFor({}, dummyTexts)).toBe("Date");
  });

  it("handles empty / corrupt legacy template in printTemplateToUnifiedConfig", () => {
    expect(() => printTemplateToUnifiedConfig(null, "challan")).not.toThrow();
    const conf = printTemplateToUnifiedConfig({}, "challan");
    expect(conf.docCategory).toBe("challan");
    expect(conf.party.layout).toBe("layout_1");
  });
});
