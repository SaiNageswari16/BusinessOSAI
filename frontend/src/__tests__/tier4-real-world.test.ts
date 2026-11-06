import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectDocCategory,
  resolveTemplateColumns,
  cellValueForColumn,
  resolveCustomFieldRows,
  docTitleFor,
  docNoLabelFor,
  resolveInvoiceTexts,
} from "@/lib/invoice-template-config";
import {
  safeSetItem,
  safeGetItem,
  sanitizeForStorage,
} from "@/lib/safe-storage";
import {
  setActiveInvoicePrintTemplateForCategory,
  getActiveInvoicePrintTemplateForCategory,
} from "@/lib/receipt-template-store";
import { formatPartyAddress } from "@/lib/utils";
import { numberToIndianWords } from "@/lib/number-to-words";
import {
  setupBrowserEnvironment,
  teardownBrowserEnvironment,
  MockLocalStorage,
  SAMPLE_INTRASTATE_INVOICE,
  SAMPLE_INTERSTATE_INVOICE,
  SAMPLE_QUOTATION,
  SAMPLE_CHALLAN,
  SAMPLE_PROFORMA,
} from "./test-helpers";

describe("Tier 4: Real-World Application Scenarios", () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    setupBrowserEnvironment(mockStorage);
  });

  afterEach(() => {
    teardownBrowserEnvironment();
  });

  it("4.1 Scenario 1: Standard B2B Intra-State Tax Invoice (AP to AP with CGST/SGST, UPI QR & Layout 1)", () => {
    const invoice = SAMPLE_INTRASTATE_INVOICE;
    const texts = resolveInvoiceTexts(null, "gst_tally");

    // 1. Verify Document Category and Header Title
    expect(detectDocCategory(invoice)).toBe("invoice");
    expect(docTitleFor(invoice, texts)).toBe("TAX INVOICE");
    expect(docNoLabelFor(invoice, texts)).toBe("Invoice No");

    // 2. Intra-state GST verification: Seller state "37", Buyer GSTIN starts with "37"
    const sellerState = invoice.sellerStateCode;
    const buyerState = invoice.customerGST.slice(0, 2);
    expect(sellerState).toBe("37");
    expect(buyerState).toBe("37");
    expect(sellerState).toBe(buyerState); // Intra-state!

    // CGST and SGST must be equal, IGST must be 0
    expect(invoice.cgst_amount).toBe(invoice.sgst_amount);
    expect(invoice.cgst_amount).toBe(237.5);
    expect(invoice.igst_amount).toBe(0);

    // 3. Line Items and Dynamic Columns
    const cols = resolveTemplateColumns(null);
    expect(invoice.items.length).toBe(2);

    const firstItem = invoice.items[0];
    const descCol = cols.find((c) => c.fieldKey === "description")!;
    const hsnCol = cols.find((c) => c.fieldKey === "hsn")!;
    const rateCol = cols.find((c) => c.fieldKey === "unit_price")!;
    const totalCol = cols.find((c) => c.fieldKey === "total_amount")!;

    expect(cellValueForColumn(descCol, firstItem).text).toContain("Basmati Rice Royal Premium");
    expect(cellValueForColumn(hsnCol, firstItem).text).toBe("10063020");
    expect(cellValueForColumn(rateCol, firstItem).text).toBe("120.00");
    expect(cellValueForColumn(totalCol, firstItem).text).toBe("6,195.00");

    // 4. Layout 1: Bill To & Ship To distinct addresses
    expect(invoice.customerBillingAddress).toContain("Arundelpet");
    expect(invoice.customerShippingAddress).toContain("Auto Nagar");
    expect(invoice.customerBillingAddress).not.toBe(invoice.customerShippingAddress);

    // 5. Payment details and Indian Words
    expect(invoice.upi_id).toBe("ismartbazaar@sbi");
    expect(invoice.bank_name).toBe("State Bank of India");
    expect(numberToIndianWords(invoice.grand_total)).toBe("Rs. Nine Thousand Nine Hundred and Seventy Five Rupees Only");
  });

  it("4.2 Scenario 2: Interstate B2B Tax Invoice (AP to Telangana with IGST, e-Way Bill & Layout 2)", () => {
    const invoice = SAMPLE_INTERSTATE_INVOICE;
    const texts = resolveInvoiceTexts(null, "gst_tally");

    // 1. Category and Classification
    expect(detectDocCategory(invoice)).toBe("invoice");
    expect(docTitleFor(invoice, texts)).toBe("TAX INVOICE");

    // 2. Interstate GST verification: Seller "37" (AP), Buyer "36" (Telangana)
    const sellerState = invoice.sellerStateCode;
    const buyerState = invoice.customerGST.slice(0, 2);
    expect(sellerState).toBe("37");
    expect(buyerState).toBe("36");
    expect(sellerState).not.toBe(buyerState); // Interstate!

    // In Interstate transaction, CGST & SGST are 0, IGST applies
    expect(invoice.cgst_amount).toBe(0);
    expect(invoice.sgst_amount).toBe(0);
    expect(invoice.igst_amount).toBe(13500);
    expect(invoice.place_of_supply).toBe("36 - Telangana");

    // 3. Logistics & Statutory Meta (Layout 2 partitioned header)
    expect(invoice.eway_bill_number).toBe("241098234190");
    expect(invoice.vehicle_number).toBe("AP 07 TJ 5521");
    expect(invoice.po_number).toBe("PO-HYD-9912");
    expect(invoice.transporter_name).toBe("Navata Road Transport");

    // 4. Partial Payment Balance Due
    expect(invoice.grand_total).toBe(88500);
    expect(invoice.amount_received).toBe(50000);
    expect(invoice.balance_due).toBe(38500);
    expect(numberToIndianWords(invoice.grand_total)).toBe("Rs. Eighty Eight Thousand Five Hundred Rupees Only");
  });

  it("4.3 Scenario 3: B2C Retail Quotation / Estimate (Unregistered Buyer, Discount & Layout 3)", () => {
    const quote = SAMPLE_QUOTATION;
    const texts = resolveInvoiceTexts(null, "gst_tally");

    // 1. Classification
    expect(detectDocCategory(quote)).toBe("quotation");
    expect(docTitleFor(quote, texts)).toBe("TAX QUOTATION / ESTIMATE");
    expect(docNoLabelFor(quote, texts)).toBe("Quote No");

    // 2. Unregistered B2C Buyer
    expect(quote.customerName).toBe("Ramesh Sharma");
    expect(quote.customerBillingAddress).toContain("Vijayawada");
    expect((quote as any).customerGST).toBeUndefined(); // No GSTIN for consumer

    // 3. Discount & Commercial Values
    const item = quote.items[0];
    expect(item.discount).toBe(5000);
    expect(quote.grand_total).toBe(141600);
    expect(quote.terms_conditions).toContain("Quotation valid for 15 days");
    expect(numberToIndianWords(quote.grand_total)).toBe("Rs. One Lakh Forty One Thousand Six Hundred Rupees Only");
  });

  it("4.4 Scenario 4: Export / SEZ Proforma Invoice (LUT under GST, International Shipping Terms)", () => {
    const proforma = SAMPLE_PROFORMA;
    const texts = resolveInvoiceTexts(null, "gst_tally");

    // 1. Classification
    expect(detectDocCategory(proforma)).toBe("proforma");
    expect(docTitleFor(proforma, texts)).toBe("PROFORMA INVOICE");
    expect(docNoLabelFor(proforma, texts)).toBe("Proforma No");

    // 2. Commercials & Template persistence
    const tid = "tenant_export_house";
    setActiveInvoicePrintTemplateForCategory("tpl-proforma-blue", "proforma", tid);
    expect(getActiveInvoicePrintTemplateForCategory("proforma", tid)).toBe("tpl-proforma-blue");

    // 3. Items and Currency Words
    expect(proforma.items.length).toBe(1);
    expect(proforma.items[0].hsn_code).toBe("09109929");
    expect(proforma.grand_total).toBe(178500);
    expect(numberToIndianWords(proforma.grand_total)).toBe("Rs. One Lakh Seventy Eight Thousand Five Hundred Rupees Only");
  });

  it("4.5 Scenario 5: Multi-Item Delivery Challan for Non-Commercial Movement of Goods", () => {
    const challan = SAMPLE_CHALLAN;
    const texts = resolveInvoiceTexts(null, "gst_tally");

    // 1. Classification
    expect(detectDocCategory(challan)).toBe("challan");
    expect(docTitleFor(challan, texts)).toBe("DELIVERY CHALLAN");

    // 2. Non-commercial movement: zero grand total, rule 55 note
    expect(challan.grand_total).toBe(0);
    expect(challan.delivery_note).toContain("Job Work under Rule 55");

    // 3. Physical tracking: Driver, Vehicle, Batch, UOM
    expect(challan.vehicle_number).toBe("AP 07 XY 1234");
    expect(challan.driver_name).toBe("K. Venkatesh");
    expect(challan.driver_phone).toBe("+91 97000 11223");

    const item = challan.items[0];
    expect(item.quantity).toBe(1200);
    expect(item.uom).toBe("KG");
    expect(item.batch_no).toBe("STEEL-ROLL-45");
    expect(item.unit_price).toBe(0);
  });
});
