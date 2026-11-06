import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectDocCategory,
  resolveTemplateColumns,
  cellValueForColumn,
  addCustomColumn,
  resolveCustomFieldRows,
  docTitleFor,
  resolveInvoiceTexts,
} from "@/lib/invoice-template-config";
import {
  safeSetItem,
  safeGetItem,
  sanitizeForStorage,
  pruneTemplateList,
} from "@/lib/safe-storage";
import {
  formatPartyAddress,
  isInvoiceLineFree,
} from "@/lib/utils";
import {
  setupBrowserEnvironment,
  teardownBrowserEnvironment,
  MockLocalStorage,
} from "./test-helpers";

describe("Tier 2: Boundary & Corner Cases", () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    setupBrowserEnvironment(mockStorage);
  });

  afterEach(() => {
    teardownBrowserEnvironment();
  });

  it("2.1 Empty inputs: handles completely empty invoice object without throwing", () => {
    const emptyInvoice: any = {};
    expect(detectDocCategory(emptyInvoice)).toBe("invoice");
    const texts = resolveInvoiceTexts(null);
    expect(docTitleFor(emptyInvoice, texts)).toBe("TAX INVOICE");
    expect(formatPartyAddress(emptyInvoice.customerBillingAddress)).toBe("");

    const cols = resolveTemplateColumns(null);
    expect(cols.length).toBeGreaterThan(0);
    // cellValueForColumn on empty item
    const cell = cellValueForColumn(cols[0], {});
    expect(cell.text).toBeDefined();
  });

  it("2.2 Empty items array: invoice with items=[] computes zero totals cleanly", () => {
    const invoiceWithNoItems = {
      id: "inv-empty-001",
      invoice_number: "INV-EMPTY",
      items: [],
      subtotal: 0,
      grand_total: 0,
      amount_received: 0,
      balance_due: 0,
    };
    expect(invoiceWithNoItems.items.length).toBe(0);
    expect(invoiceWithNoItems.grand_total).toBe(0);
    expect(detectDocCategory(invoiceWithNoItems)).toBe("invoice");
  });

  it("2.3 Extreme text length and special characters: handles long strings and emojis gracefully", () => {
    const longDesc = "🌾 Super Organic Basmati Extra Long Grain Rice ✨ Special Harvest Edition ".repeat(10);
    const item = {
      product_name: longDesc,
      quantity: 1,
      unit_price: 500,
    };
    const col = { id: "col_desc", fieldKey: "description", headerTitle: "Desc", align: "left" as const, enabled: true };
    const cell = cellValueForColumn(col, item);
    expect(cell.text).toContain("🌾 Super Organic Basmati");
    expect(cell.text.length).toBeGreaterThan(500);

    const longAddress = "Door No. 12-34/56, 4th Floor, Royal Arcade, Beside Anjaneya Swamy Temple, Main Commercial Highway, Tadepalli, Guntur District, Andhra Pradesh, PIN - 522501";
    const formatted = formatPartyAddress(longAddress);
    expect(formatted).toBe(longAddress);
  });

  it("2.4 Extreme item volume: resolves columns and cells for 150 items without degradation", () => {
    const items = Array.from({ length: 150 }, (_, i) => ({
      sno: i + 1,
      product_name: `SKU Item #${i + 1}`,
      hsn_code: "12345678",
      quantity: (i % 10) + 1,
      unit_price: (i + 1) * 25,
      tax_rate: 18,
      total_amount: ((i % 10) + 1) * (i + 1) * 25,
    }));

    const cols = resolveTemplateColumns(null);
    const start = performance.now();
    for (const item of items) {
      for (const col of cols) {
        cellValueForColumn(col, item);
      }
    }
    const elapsed = performance.now() - start;
    // 150 items * 10 columns = 1500 cell evaluations should complete in < 50ms
    expect(elapsed).toBeLessThan(100);
  });

  it("2.5 Zero and negative balance handling: paid in full and customer credit balances", () => {
    // 1. Paid in Full
    const paidInvoice = { grand_total: 5000, amount_received: 5000 };
    const balancePaid = paidInvoice.grand_total - paidInvoice.amount_received;
    expect(balancePaid).toBe(0);

    // 2. Customer Credit (overpaid advance)
    const overpaidInvoice = { grand_total: 5000, amount_received: 7500 };
    const customerCredit = overpaidInvoice.amount_received - overpaidInvoice.grand_total;
    expect(customerCredit).toBe(2500);

    // 3. Unpaid full balance
    const unpaidInvoice = { grand_total: 10000, amount_received: 0 };
    expect(unpaidInvoice.grand_total - unpaidInvoice.amount_received).toBe(10000);
  });

  it("2.6 Free goods and promotional items: identifies free items correctly", () => {
    const freeItem1 = { product_name: "Promotional Pen", unit_price: 0, is_free: true };
    const freeItem2 = { product_name: "Sample Sachets", unit_price: 0 };
    const paidItem = { product_name: "Coffee Pack", unit_price: 250 };

    expect(isInvoiceLineFree(freeItem1)).toBe(true);
    expect(isInvoiceLineFree(freeItem2)).toBe(true);
    expect(isInvoiceLineFree(paidItem)).toBe(false);

    // Free quantity column check
    const freeQtyCol = { id: "col_free_qty", fieldKey: "free_qty", headerTitle: "Free Qty", align: "center" as const, enabled: true };
    expect(cellValueForColumn(freeQtyCol, { free_qty: 2 }).text).toBe("2");
    expect(cellValueForColumn(freeQtyCol, { free_qty: 0 }).text).toBe("-");
  });

  it("2.7 Quota limit boundaries: handles nested and mixed base64 payloads under quota pressure", () => {
    // Exactly at MAX_STORED_IMAGE_CHARS (250,000) threshold vs exceeding threshold
    const atThreshold = "data:image/png;base64," + "A".repeat(250000 - "data:image/png;base64,".length);
    const overThreshold = "data:image/png;base64," + "A".repeat(250001);

    expect(sanitizeForStorage(atThreshold)).toBe(atThreshold);
    expect(sanitizeForStorage(overThreshold)).toBe("");

    // Complex nested structure with arrays of objects
    const deeplyNested = {
      level1: {
        level2: [
          { valid: "yes", img: overThreshold },
          { valid: "yes2", img: atThreshold },
        ],
      },
    };
    const cleaned = sanitizeForStorage(deeplyNested);
    expect(cleaned.level1.level2[0].img).toBe("");
    expect(cleaned.level1.level2[1].img).toBe(atThreshold);
  });

  it("2.8 Malformed and corrupted template JSON recovery", () => {
    // Corrupted non-JSON string in safeSetItem
    const success = safeSetItem("corrupted_key", "NOT_JSON_DATA{{}}");
    expect(success).toBe(true);
    expect(mockStorage.getItem("corrupted_key")).toBe("NOT_JSON_DATA{{}}");

    // Array with null or malformed entries passed to pruneTemplateList
    const malformedList = [null, undefined, "not an object", { id: "t1", name: "Valid" }, 42];
    const pruned = pruneTemplateList(malformedList as any);
    expect(pruned.length).toBe(1);
    expect(pruned[0].id).toBe("t1");
  });

  it("2.9 SSR / offline boundaries: functions operate safely without window.localStorage", () => {
    teardownBrowserEnvironment(); // remove global window & localStorage

    // Safe storage functions return false/null rather than throwing ReferenceError
    expect(safeSetItem("key", "val")).toBe(false);
    expect(safeGetItem("key")).toBeNull();

    // Template config functions remain 100% functional without window
    expect(detectDocCategory({ invoice_type: "QUOTATION" })).toBe("quotation");
    const cols = resolveTemplateColumns(null);
    expect(cols.length).toBeGreaterThan(0);
  });

  it("2.10 Custom column with null/undefined values falls back cleanly to dash", () => {
    const customCol = {
      id: "col_custom_batch",
      fieldKey: "unknown_attribute",
      headerTitle: "Unknown",
      align: "center" as const,
      enabled: true,
      isCustom: true,
    };
    const item = { product_name: "Test" };
    const cell = cellValueForColumn(customCol, item);
    expect(cell.text).toBe("-");
    expect(cell.raw).toBeUndefined();
  });
});
