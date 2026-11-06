import { describe, it, expect, beforeEach } from "vitest";

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

import {
  INVOICE_DOC_CATEGORIES,
  type InvoiceDocCategory,
} from "../lib/invoice-template-config";

import {
  getInvoiceCategoryActiveKey,
  getInvoiceCategoryLinkKey,
  setActiveDocTemplateId,
  getActiveDocTemplateId,
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
  isInvoiceCategoryUnlinked,
  setInvoiceCategoryLinked,
  setInvoiceCategoryUnlinked,
  getActiveInvoicePrintTemplateForDocCategory,
  setActiveInvoicePrintTemplate,
  getActiveInvoicePrintTemplate,
  setActiveBillingGst,
  ACTIVE_DOC_TEMPLATE_KEYS,
} from "../lib/receipt-template-store";

describe("Empirical Challenge M1-2: Document Category Independence & Template Slot Isolation", () => {
  const tid = "tenant_test_challenger";
  const cid = "company_main";

  beforeEach(() => {
    storage.clear();
    listeners.clear();
  });

  describe("1. Document Category Independence & Non-Clobbering Verification", () => {
    it("1.1 Default state: uncustomized categories link and fallback to master Tax Invoice", () => {
      // Set master tax invoice
      setActiveInvoicePrintTemplateForCategory("tpl-master-tally", "invoice", tid, cid);
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-master-tally");

      // Verify that unconfigured proforma, quotation, challan fallback to master
      for (const cat of ["proforma", "quotation", "challan"] as InvoiceDocCategory[]) {
        expect(getActiveInvoicePrintTemplateForCategory(cat, tid, cid)).toBe("tpl-master-tally");
        expect(isInvoiceCategoryUnlinked(cat, tid, cid)).toBe(false);
      }
    });

    it("1.2 Assigning proforma/quotation/challan persists to dedicated slots and does NOT alter bos_active_invoice_template_id", () => {
      // 1. Establish master Tax Invoice
      setActiveInvoicePrintTemplateForCategory("tpl-master-tally", "invoice", tid, cid);
      const masterInvoiceKeyTid = `bos_active_invoice_template_id_${tid}`;
      const masterInvoiceKeyCid = `bos_active_invoice_template_id_${tid}_${cid}`;

      expect(storage.get(masterInvoiceKeyTid)).toBe("tpl-master-tally");
      expect(storage.get(masterInvoiceKeyCid)).toBe("tpl-master-tally");

      // 2. Customize Proforma
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-blue", "proforma", tid, cid);
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-proforma-blue");
      expect(isInvoiceCategoryUnlinked("proforma", tid, cid)).toBe(true);

      // Verify master invoice slots are completely untouched
      expect(storage.get(masterInvoiceKeyTid)).toBe("tpl-master-tally");
      expect(storage.get(masterInvoiceKeyCid)).toBe("tpl-master-tally");
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-master-tally");

      // 3. Customize Quotation
      setActiveInvoicePrintTemplateForCategory("tpl-quote-modern", "quotation", tid, cid);
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-quote-modern");
      expect(isInvoiceCategoryUnlinked("quotation", tid, cid)).toBe(true);

      // Verify master invoice slots still untouched
      expect(storage.get(masterInvoiceKeyTid)).toBe("tpl-master-tally");
      expect(storage.get(masterInvoiceKeyCid)).toBe("tpl-master-tally");
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-master-tally");

      // 4. Customize Delivery Challan
      setActiveInvoicePrintTemplateForCategory("tpl-challan-standard", "challan", tid, cid);
      expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("tpl-challan-standard");
      expect(isInvoiceCategoryUnlinked("challan", tid, cid)).toBe(true);

      // Verify master invoice slots still untouched
      expect(storage.get(masterInvoiceKeyTid)).toBe("tpl-master-tally");
      expect(storage.get(masterInvoiceKeyCid)).toBe("tpl-master-tally");
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-master-tally");
    });

    it("1.3 Changing master Tax Invoice does NOT clobber customized proforma, quotation, or challan", () => {
      // 1. Setup initial state
      setActiveInvoicePrintTemplateForCategory("tpl-master-v1", "invoice", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-v1", "proforma", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-quote-v1", "quotation", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-challan-v1", "challan", tid, cid);

      // 2. Change master invoice template via setActiveInvoicePrintTemplateForCategory
      setActiveInvoicePrintTemplateForCategory("tpl-master-v2", "invoice", tid, cid);

      // Master must be updated
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-master-v2");

      // Proforma, quotation, and challan must maintain their customized templates
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-proforma-v1");
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-quote-v1");
      expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("tpl-challan-v1");

      // 3. Change master invoice template via legacy setActiveInvoicePrintTemplate
      setActiveInvoicePrintTemplate("tpl-master-v3", tid, cid);

      // Master must be updated
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tid, cid)).toBe("tpl-master-v3");

      // Dedicated category templates must still NOT be overwritten
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-proforma-v1");
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tid, cid)).toBe("tpl-quote-v1");
      expect(getActiveInvoicePrintTemplateForCategory("challan", tid, cid)).toBe("tpl-challan-v1");
    });

    it("1.4 Re-linking behavior: re-linking allows category to dynamically track updated master", () => {
      setActiveInvoicePrintTemplateForCategory("tpl-master-v1", "invoice", tid, cid);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-custom", "proforma", tid, cid);
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-proforma-custom");

      // Re-link proforma
      setInvoiceCategoryLinked("proforma", true, undefined, tid, cid);
      expect(isInvoiceCategoryUnlinked("proforma", tid, cid)).toBe(false);
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-master-v1");

      // Updating master should now reflect in re-linked proforma
      setActiveInvoicePrintTemplateForCategory("tpl-master-v2", "invoice", tid, cid);
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tid, cid)).toBe("tpl-master-v2");
    });
  });

  describe("2. Company-Scoped Isolation Across Multiple Companies within the Same Tenant", () => {
    const tenant = "tenant_multicompany_corp";
    const companyA = "company_alpha";
    const companyB = "company_beta";
    const companyC = "company_gamma";

    it("2.1 Independent per-company template configuration across multiple companies", () => {
      // Configure Company Alpha
      setActiveInvoicePrintTemplateForCategory("tpl-inv-alpha", "invoice", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-alpha", "proforma", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-quote-alpha", "quotation", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-challan-alpha", "challan", tenant, companyA);

      // Configure Company Beta with completely different templates
      setActiveInvoicePrintTemplateForCategory("tpl-inv-beta", "invoice", tenant, companyB);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-beta", "proforma", tenant, companyB);
      setActiveInvoicePrintTemplateForCategory("tpl-quote-beta", "quotation", tenant, companyB);
      setActiveInvoicePrintTemplateForCategory("tpl-challan-beta", "challan", tenant, companyB);

      // Verify Alpha has its templates
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tenant, companyA)).toBe("tpl-inv-alpha");
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tenant, companyA)).toBe("tpl-proforma-alpha");
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tenant, companyA)).toBe("tpl-quote-alpha");
      expect(getActiveInvoicePrintTemplateForCategory("challan", tenant, companyA)).toBe("tpl-challan-alpha");

      // Verify Beta has its templates
      expect(getActiveInvoicePrintTemplateForCategory("invoice", tenant, companyB)).toBe("tpl-inv-beta");
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tenant, companyB)).toBe("tpl-proforma-beta");
      expect(getActiveInvoicePrintTemplateForCategory("quotation", tenant, companyB)).toBe("tpl-quote-beta");
      expect(getActiveInvoicePrintTemplateForCategory("challan", tenant, companyB)).toBe("tpl-challan-beta");
    });

    it("2.2 Updating Company Alpha does not alter Company Beta", () => {
      // Setup both
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-alpha", "proforma", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-beta", "proforma", tenant, companyB);

      // Update Alpha
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-alpha-v2", "proforma", tenant, companyA);

      expect(getActiveInvoicePrintTemplateForCategory("proforma", tenant, companyA)).toBe("tpl-proforma-alpha-v2");
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tenant, companyB)).toBe("tpl-proforma-beta");
    });

    it("2.3 Stress Test: Company B without custom proforma must fall back to Company B's master invoice, NOT Company A's proforma", () => {
      // Company Alpha and Beta have different master invoices
      setActiveInvoicePrintTemplateForCategory("tpl-inv-alpha", "invoice", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-inv-beta", "invoice", tenant, companyB);

      // Company Alpha customizes proforma
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-alpha", "proforma", tenant, companyA);

      // Inspect storage keys directly to document root cause
      const tenantWideKey = `bos_active_proforma_template_id_${tenant}`;
      const tenantWideLinkKey = getInvoiceCategoryLinkKey(tenant, null, "proforma");
      const companyALinkKey = getInvoiceCategoryLinkKey(tenant, companyA, "proforma");
      const companyBLinkKey = getInvoiceCategoryLinkKey(tenant, companyB, "proforma");

      // DOCUMENTATION OF EMPIRICAL OBSERVATION:
      // When companyA set its proforma, receipt-template-store wrote to the tenant-wide key WITHOUT companyId:
      const tenantWideKeyVal = storage.get(tenantWideKey);
      const tenantWideLinkVal = storage.get(tenantWideLinkKey);
      const companyALinkVal = storage.get(companyALinkKey);
      const companyBLinkVal = storage.get(companyBLinkKey);

      // Company Beta has NOT customized proforma!
      // Company Beta's proforma MUST fall back to Company Beta's master invoice ("tpl-inv-beta")
      // It must NOT receive Company Alpha's proforma ("tpl-proforma-alpha")!
      const betaProforma = getActiveInvoicePrintTemplateForCategory("proforma", tenant, companyB);
      const betaIsUnlinked = isInvoiceCategoryUnlinked("proforma", tenant, companyB);

      // Multi-company isolation verification:
      // Company Alpha must NOT pollute tenant-wide keys or unlink the tenant
      expect(tenantWideKeyVal).toBeUndefined();
      expect(tenantWideLinkVal).toBeUndefined();
      expect(betaIsUnlinked).toBe(false);

      // Beta's proforma must fall back to Beta's own master invoice
      expect(betaProforma).toBe("tpl-inv-beta");
    });

    it("2.3b Cross-Company Leakage for Quotation and Delivery Challan", () => {
      // Master invoices
      setActiveInvoicePrintTemplateForCategory("tpl-inv-alpha", "invoice", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-inv-beta", "invoice", tenant, companyB);

      // Alpha customizes quotation and challan
      setActiveInvoicePrintTemplateForCategory("tpl-quote-alpha", "quotation", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-challan-alpha", "challan", tenant, companyA);

      // Beta has not customized quotation or challan
      const betaQuote = getActiveInvoicePrintTemplateForCategory("quotation", tenant, companyB);
      const betaChallan = getActiveInvoicePrintTemplateForCategory("challan", tenant, companyB);

      // Beta must fall back to its own master invoice, NOT Alpha's quotation or challan
      expect(betaQuote).toBe("tpl-inv-beta");
      expect(betaChallan).toBe("tpl-inv-beta");
    });

    it("2.4 Stress Test: Re-linking in Company Alpha must NOT reset Company Beta's custom proforma", () => {
      // Both companies have custom proforma
      setActiveInvoicePrintTemplateForCategory("tpl-inv-alpha", "invoice", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-inv-beta", "invoice", tenant, companyB);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-alpha", "proforma", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("tpl-proforma-beta", "proforma", tenant, companyB);

      // Alpha re-links proforma
      setInvoiceCategoryLinked("proforma", true, undefined, tenant, companyA);

      // Alpha should now follow its master
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tenant, companyA)).toBe("tpl-inv-alpha");

      // Beta MUST still retain its independent custom proforma
      expect(getActiveInvoicePrintTemplateForCategory("proforma", tenant, companyB)).toBe("tpl-proforma-beta");
      expect(isInvoiceCategoryUnlinked("proforma", tenant, companyB)).toBe(true);
    });

    it("2.5 Document Category Object Resolver: getActiveInvoicePrintTemplateForDocCategory merges company-scoped GST", () => {
      // Set distinct company data for Company A and Company B using company-scoped keys
      storage.set(
        `bos_active_billing_gst_details_${tenant}_${companyA}`,
        JSON.stringify({ gstin: "37AAAAA1111A1Z1", trade_name: "Alpha Logistics Pvt Ltd", address: "Alpha Port, Vizag" })
      );
      storage.set(
        `bos_active_billing_gst_details_${tenant}_${companyB}`,
        JSON.stringify({ gstin: "36BBBBB2222B1Z2", trade_name: "Beta Traders LLP", address: "Beta Hub, Hyderabad" })
      );

      setActiveInvoicePrintTemplateForCategory("gst_tally", "challan", tenant, companyA);
      setActiveInvoicePrintTemplateForCategory("gst_tally", "challan", tenant, companyB);

      const tplAlpha = getActiveInvoicePrintTemplateForDocCategory("challan", tenant, companyA);
      const tplBeta = getActiveInvoicePrintTemplateForDocCategory("challan", tenant, companyB);

      expect(tplAlpha.gstin).toBe("37AAAAA1111A1Z1");
      expect(tplAlpha.storeName).toBe("Alpha Logistics Pvt Ltd");

      expect(tplBeta.gstin).toBe("36BBBBB2222B1Z2");
      expect(tplBeta.storeName).toBe("Beta Traders LLP");
    });
  });
});
