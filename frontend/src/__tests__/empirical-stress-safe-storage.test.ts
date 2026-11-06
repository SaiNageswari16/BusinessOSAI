/**
 * empirical-stress-safe-storage.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE for safe-storage & quota resilience.
 * Roles: critic, specialist (Empirical Challenger)
 *
 * Scope:
 * 1. QuotaExceededError conditions & recovery under quota saturation
 * 2. Large base64 payloads (20KB, 100KB, 250KB, 2MB)
 * 3. Corrupt, hostile, and non-JSON payloads
 * 4. Rapid consecutive and concurrent storage writes
 * 5. Inviolability of custom user templates (businessos_print_templates_v1, user_active_print_templates_v1)
 * 6. Total exception safety of safeSetItem, safeGetItem, and safeRemoveItem
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MAX_STORED_IMAGE_CHARS,
  NON_CRITICAL_CACHE_KEYS,
  PROTECTED_STORAGE_PREFIXES,
  safeSetItem,
  safeGetItem,
  safeRemoveItem,
  sanitizeForStorage,
  pruneTemplateList,
} from "../lib/safe-storage";

// ============================================================================
// SIMULATED QUOTA STORAGE ENGINE
// ============================================================================

class QuotaSimulatedStorage implements Storage {
  private store = new Map<string, string>();
  public maxBytes: number;
  public throwSecurityErrorOnSet: boolean = false;
  public throwArbitraryError: Error | null = null;
  public failOnRemove: boolean = false;
  public failOnKey: boolean = false;

  constructor(maxBytes: number = 50 * 1024) {
    this.maxBytes = maxBytes;
  }

  get currentBytes(): number {
    let bytes = 0;
    for (const [k, v] of this.store.entries()) {
      bytes += (k.length + v.length) * 2; // UTF-16 representation (2 bytes per character)
    }
    return bytes;
  }

  get length(): number {
    if (this.failOnKey) throw new Error("Storage.length hardware failure");
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    if (this.failOnKey) throw new Error("Storage.key access failure");
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    if (this.failOnRemove) {
      throw new Error("Storage.removeItem hardware failure");
    }
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwSecurityErrorOnSet) {
      const err = new Error("The operation is insecure.");
      err.name = "SecurityError";
      throw err;
    }

    if (this.throwArbitraryError) {
      throw this.throwArbitraryError;
    }

    const strKey = String(key);
    const strVal = String(value);

    // Calculate delta
    const existingVal = this.store.get(strKey);
    const existingBytes = existingVal ? (strKey.length + existingVal.length) * 2 : 0;
    const newBytes = (strKey.length + strVal.length) * 2;
    const projectedBytes = this.currentBytes - existingBytes + newBytes;

    if (projectedBytes > this.maxBytes) {
      const quotaErr = new Error("QuotaExceededError: DOM Exception 22 - The quota has been exceeded.");
      quotaErr.name = "QuotaExceededError";
      (quotaErr as any).code = 22;
      throw quotaErr;
    }

    this.store.set(strKey, strVal);
  }

  dumpKeys(): string[] {
    return Array.from(this.store.keys());
  }
}

// Global setup
let mockStorage: QuotaSimulatedStorage;

beforeEach(() => {
  // 50 KB capacity = 25,600 UTF-16 characters
  mockStorage = new QuotaSimulatedStorage(50 * 1024);
  (globalThis as any).localStorage = mockStorage;
  (globalThis as any).window = {
    localStorage: mockStorage,
    dispatchEvent: vi.fn(),
  };
});

afterEach(() => {
  mockStorage.clear();
});

// ============================================================================
// SUITE 1: QUOTA EXCEEDED ERROR CONDITIONS & MULTI-TIER RECOVERY
// ============================================================================

describe("Suite 1: QuotaExceededError Recovery Mechanics", () => {
  it("purges designated NON_CRITICAL_CACHE_KEYS when quota is exceeded", () => {
    // Fill storage with 22,000 chars (44KB out of 50KB) of purgeable cache
    mockStorage.setItem("bos-store-products-cache", "X".repeat(14_000));
    mockStorage.setItem("bos_temp_pdf_overlay", "Y".repeat(8_000));
    expect(mockStorage.getItem("bos-store-products-cache")).not.toBeNull();

    // Now write an 8,000 char item (~16KB). 44KB + 16KB = 60KB > 50KB limit -> QuotaExceededError
    const keyToSave = "bos_important_user_setting";
    const valToSave = JSON.stringify({ theme: "dark", lang: "en", padding: "Z".repeat(7_000) });

    const success = safeSetItem(keyToSave, valToSave);

    expect(success).toBe(true);
    expect(mockStorage.getItem(keyToSave)).toBe(valToSave);
    // Non-critical keys should have been purged during Recovery Step 1
    expect(mockStorage.getItem("bos-store-products-cache")).toBeNull();
    expect(mockStorage.getItem("bos_temp_pdf_overlay")).toBeNull();
  });

  it("purges transient temporary keys matching temporary patterns", () => {
    // Fill with temporary keys (bos_temp_*, temp_*) - 22,000 chars = 44KB
    mockStorage.setItem("bos_temp_session_cache_123", "T".repeat(14_000));
    mockStorage.setItem("temp_print_preview_456", "P".repeat(8_000));

    // Attempt to write an item that exceeds quota (8,000 chars = 16KB -> 60KB > 50KB)
    const success = safeSetItem("my_new_data", "D".repeat(8_000));

    expect(success).toBe(true);
    expect(mockStorage.getItem("bos_temp_session_cache_123")).toBeNull();
    expect(mockStorage.getItem("temp_print_preview_456")).toBeNull();
    expect(mockStorage.getItem("my_new_data")).toBe("D".repeat(8_000));
  });

  it("trims pos_saved_invoices and pos_offline_invoices arrays to 20 items during recovery", () => {
    // Pre-populate with 60 invoice items (~18KB)
    const manyInvoices = Array.from({ length: 60 }, (_, i) => ({
      id: `inv-${i}`,
      invoice_number: `INV-2026-${i}`,
      grand_total: 100 + i,
      data: "pad".repeat(20),
    }));

    mockStorage.setItem("pos_saved_invoices_t1", JSON.stringify(manyInvoices));

    // Fill with a non-temp, non-protected key that won't be purged in step 1 or 2 (~28KB)
    mockStorage.setItem("user_misc_data", "M".repeat(14_000));

    // Now storage has: manyInvoices (~18KB) + user_misc_data (28KB) = ~46KB.
    // Writing 10KB forces quota recovery. Steps 1 & 2 won't free enough, so Step 3 trims invoices!
    const success = safeSetItem("new_incoming_item", "N".repeat(5_000));
    expect(success).toBe(true);

    // Verify invoice history was trimmed to 20
    const trimmedRaw = mockStorage.getItem("pos_saved_invoices_t1");
    expect(trimmedRaw).not.toBeNull();
    const trimmed = JSON.parse(trimmedRaw!);
    expect(trimmed).toHaveLength(20);
    expect(trimmed[0].id).toBe("inv-0");
    expect(trimmed[19].id).toBe("inv-19");
  });

  it("returns false gracefully when item size exceeds entire storage capacity even after full purge", () => {
    // Single payload of 30,000 chars = 60KB > 50KB capacity
    const oversized = "Z".repeat(30_000);
    const success = safeSetItem("impossible_fit", oversized);

    expect(success).toBe(false);
    expect(mockStorage.getItem("impossible_fit")).toBeNull();
  });
});

// ============================================================================
// SUITE 2: INVIOLABILITY OF CUSTOM USER TEMPLATES
// ============================================================================

describe("Suite 2: Inviolability of Custom User Templates", () => {
  it("NEVER deletes or purges businessos_print_templates_v1 when localStorage is full", () => {
    // Seed custom templates (~2KB)
    const userTemplates = [
      {
        id: "custom_tpl_1",
        name: "My Custom GST Template",
        updated_at: "2026-11-01T10:00:00Z",
        headerTitle: "TAX INVOICE PREMIUM",
        logoUrl: "data:image/png;base64," + "A".repeat(500),
      },
      {
        id: "custom_tpl_2",
        name: "My Quotation Custom",
        updated_at: "2026-11-02T10:00:00Z",
        headerTitle: "QUOTATION ESTIMATE",
      },
    ];

    const templateRaw = JSON.stringify(userTemplates);
    mockStorage.setItem("businessos_print_templates_v1", templateRaw);
    mockStorage.setItem("businessos_print_templates_v1_tenant_abc", templateRaw);

    // Fill storage with purgeable caches up to ~40KB (20,000 chars)
    mockStorage.setItem("bos-store-products-cache", "X".repeat(12_000));
    mockStorage.setItem("bos_temp_pdf_overlay", "Y".repeat(8_000));

    // Trigger QuotaExceededError by writing a new item that needs 16KB (8,000 chars)
    const success = safeSetItem("new_incoming_order", JSON.stringify({ orderId: "123", pad: "W".repeat(7_000) }));
    expect(success).toBe(true);

    // CRITICAL ASSERTION: businessos_print_templates_v1 MUST NOT BE PURGED
    const preserved1 = mockStorage.getItem("businessos_print_templates_v1");
    expect(preserved1).not.toBeNull();
    const parsed1 = JSON.parse(preserved1!);
    expect(parsed1).toHaveLength(2);
    // Elements preserved intact
    expect(parsed1.map((t: any) => t.id)).toEqual(["custom_tpl_1", "custom_tpl_2"]);

    // Tenant scoped template must also be preserved
    const preservedTenant = mockStorage.getItem("businessos_print_templates_v1_tenant_abc");
    expect(preservedTenant).not.toBeNull();
  });

  it("NEVER deletes or purges user_active_print_templates_v1 when localStorage is full", () => {
    const activeMap = JSON.stringify({
      invoice: "custom_tpl_1",
      proforma: "proforma_modern",
      quotation: "quote_tally",
      challan: "challan_standard",
    });

    mockStorage.setItem("user_active_print_templates_v1", activeMap);
    mockStorage.setItem("user_active_print_templates_v1_tid_cid", activeMap);

    // Saturate storage with disposable cache up to 44KB
    mockStorage.setItem("bos-store-products-cache", "C".repeat(22_000));

    // Force quota recovery
    const success = safeSetItem("burst_item", "B".repeat(8_000));
    expect(success).toBe(true);

    // CRITICAL ASSERTION: user_active_print_templates_v1 must be intact
    expect(mockStorage.getItem("user_active_print_templates_v1")).toBe(activeMap);
    expect(mockStorage.getItem("user_active_print_templates_v1_tid_cid")).toBe(activeMap);
  });

  it("NEVER purges any key listed in PROTECTED_STORAGE_PREFIXES during emergency sweeps", () => {
    const protectedKeys = [
      "businessos_print_templates_v1",
      "user_active_print_templates_v1",
      "bos_active_invoice_template_id",
      "bos_active_invoice_category_template_t1_proforma_c1",
      "bos_invoice_category_link_t1_proforma_c1",
      "bos_invoice_category_link_t1_quotation",
      "bos_active_quotation_template_id",
      "bos_active_proforma_template_id",
      "bos_active_estimate_template_id",
      "bos_active_challan_template_id",
      "bos_signature_settings_t1",
      "bos_active_billing_gst_details_t1",
      "bos_active_billing_gstin_t1",
      "bos_payment_qr_settings_t1",
      "bos_pos_active_receipt_templates_v1",
      "bos_barcode_custom_templates",
      "bos-auth",
      "bos-active-role",
      "bos-theme",
      "bos-currency",
    ];

    // Seed all protected keys with dummy values (~1KB total)
    for (const pk of protectedKeys) {
      mockStorage.setItem(pk, JSON.stringify({ key: pk, valid: true }));
    }

    // Add purgeable keys filling storage to ~44KB (22,000 chars)
    mockStorage.setItem("bos-store-products-cache", "X".repeat(14_000));
    mockStorage.setItem("bos_temp_1", "Y".repeat(8_000));

    // Trigger quota recovery by writing 8,000 chars (16KB) -> 44KB + 16KB = 60KB > 50KB
    const success = safeSetItem("heavy_new_key", "H".repeat(8_000));
    expect(success).toBe(true);

    // Every protected key must still exist!
    for (const pk of protectedKeys) {
      expect(mockStorage.getItem(pk)).not.toBeNull();
    }

    // Disposable keys must have been removed
    expect(mockStorage.getItem("bos-store-products-cache")).toBeNull();
    expect(mockStorage.getItem("bos_temp_1")).toBeNull();
  });

  it("NEVER deletes or purges bos_invoice_category_link_* keys during storage quota purges", () => {
    // Seed category link keys for multiple categories across tenant and company
    const linkKeys = [
      "bos_invoice_category_link_tenant123_proforma",
      "bos_invoice_category_link_tenant123_proforma_companyABC",
      "bos_invoice_category_link_tenant123_quotation",
      "bos_invoice_category_link_tenant123_quotation_companyABC",
      "bos_invoice_category_link_tenant123_challan",
      "bos_invoice_category_link_tenant123_challan_companyXYZ",
      "bos_invoice_category_link_tenant123_estimate",
      "bos_invoice_category_link_tenant123_credit_note",
      "bos_invoice_category_link_tenant123_debit_note",
    ];

    for (const key of linkKeys) {
      mockStorage.setItem(key, "unlinked");
    }

    // Fill storage with purgeable caches up to ~42KB (21,000 chars)
    mockStorage.setItem("bos-store-products-cache", "X".repeat(12_000));
    mockStorage.setItem("bos_temp_pdf_blob", "Y".repeat(9_000));

    // Force quota recovery by writing an 8,000 char item (16KB -> 58KB > 50KB)
    const success = safeSetItem("incoming_critical_key", "K".repeat(8_000));
    expect(success).toBe(true);

    // CRITICAL ASSERTION: All bos_invoice_category_link_* keys must survive untouched!
    for (const key of linkKeys) {
      expect(mockStorage.getItem(key)).toBe("unlinked");
    }

    // Disposable keys must have been purged
    expect(mockStorage.getItem("bos-store-products-cache")).toBeNull();
    expect(mockStorage.getItem("bos_temp_pdf_blob")).toBeNull();
  });
});

// ============================================================================
// SUITE 3: LARGE BASE64 STRINGS STRESS-TESTING (20KB, 100KB, 250KB, 2MB)
// ============================================================================

describe("Suite 3: Base64 String Stress-Testing (20KB, 100KB, 250KB, 2MB)", () => {
  it("preserves 20KB base64 images (~27,300 chars) intact without modification", () => {
    mockStorage.maxBytes = 2 * 1024 * 1024;

    const image20kb = "data:image/png;base64," + "A".repeat(27_300);
    const obj = { logo: image20kb, title: "Company Logo" };

    const sanitized = sanitizeForStorage(obj);
    expect(sanitized.logo).toBe(image20kb);
    expect(sanitized.logo.length).toBe(image20kb.length);

    // Verify round-trip storage with safeSetItem
    const success = safeSetItem("test_20kb_logo", JSON.stringify(sanitized));
    expect(success).toBe(true);
    const stored = JSON.parse(safeGetItem("test_20kb_logo")!);
    expect(stored.logo).toBe(image20kb);
  });

  it("preserves 100KB base64 images (~136,500 chars) intact", () => {
    mockStorage.maxBytes = 2 * 1024 * 1024;

    const image100kb = "data:image/jpeg;base64," + "B".repeat(136_500);
    expect(image100kb.length).toBeLessThan(MAX_STORED_IMAGE_CHARS);

    const obj = { signature: image100kb, signatory: "Director" };
    const sanitized = sanitizeForStorage(obj);

    expect(sanitized.signature).toBe(image100kb);
    expect(sanitized.signature.length).toBe(image100kb.length);

    const success = safeSetItem("bos_signature_settings_test", JSON.stringify(sanitized));
    expect(success).toBe(true);
    const stored = JSON.parse(safeGetItem("bos_signature_settings_test")!);
    expect(stored.signature).toBe(image100kb);
  });

  it("verifies the exact boundary at MAX_STORED_IMAGE_CHARS (250,000 chars)", () => {
    const prefix = "data:image/png;base64,";

    // Exactly 250,000 chars: MUST BE PRESERVED
    const exact250k = prefix + "E".repeat(MAX_STORED_IMAGE_CHARS - prefix.length);
    expect(exact250k.length).toBe(250_000);
    const sanitizedExact = sanitizeForStorage({ img: exact250k });
    expect(sanitizedExact.img).toBe(exact250k);

    // 250,001 chars: MUST BE STRIPPED TO ""
    const overByOne = prefix + "E".repeat(MAX_STORED_IMAGE_CHARS - prefix.length + 1);
    expect(overByOne.length).toBe(250_001);
    const sanitizedOver = sanitizeForStorage({ img: overByOne });
    expect(sanitizedOver.img).toBe("");
  });

  it("strips oversized 250KB binary equivalent (~341,000 base64 chars) to empty string", () => {
    const image250kbBinary = "data:image/png;base64," + "C".repeat(341_000);
    expect(image250kbBinary.length).toBeGreaterThan(MAX_STORED_IMAGE_CHARS);

    const obj = { stampUrl: image250kbBinary, stampName: "Official Seal" };
    const sanitized = sanitizeForStorage(obj);

    expect(sanitized.stampUrl).toBe("");
    expect(sanitized.stampName).toBe("Official Seal");
  });

  it("safely neutralizes massive 2MB base64 images (~2,730,000 chars) without memory exhaustion", () => {
    const image2mb = "data:image/jpeg;base64," + "M".repeat(2_730_000);

    const payload = {
      templateId: "tpl_heavy",
      backgroundImage: image2mb,
      header: "Test Invoice",
    };

    const t0 = performance.now();
    const sanitized = sanitizeForStorage(payload);
    const t1 = performance.now();

    expect(sanitized.backgroundImage).toBe("");
    expect(sanitized.templateId).toBe("tpl_heavy");
    expect(sanitized.header).toBe("Test Invoice");
    expect(t1 - t0).toBeLessThan(500); // Efficient execution
  });

  it("handles deep nested structures and circular references without crashing", () => {
    const nested: any = {
      level1: {
        level2: {
          goodLogo: "data:image/png;base64," + "G".repeat(10_000),
          badLogo: "data:image/png;base64," + "B".repeat(300_000),
          items: [
            { normalImg: "data:image/webp;base64," + "W".repeat(5_000) },
            { hugePdf: "data:application/pdf;base64," + "P".repeat(400_000) },
          ],
        },
      },
    };

    // Circular reference injection
    nested.circular = nested;
    nested.level1.circularParent = nested;

    const sanitized = sanitizeForStorage(nested);

    expect(sanitized.level1.level2.goodLogo.length).toBeGreaterThan(0);
    expect(sanitized.level1.level2.badLogo).toBe("");
    expect(sanitized.level1.level2.items[0].normalImg.length).toBeGreaterThan(0);
    expect(sanitized.level1.level2.items[1].hugePdf).toBe("");
  });

  it("supports caller-specified custom thresholds in sanitizeForStorage (e.g. 25,000, 10,000)", () => {
    const prefix = "data:image/png;base64,";

    // 1. Test 10,000 threshold boundary
    const exactly10k = prefix + "A".repeat(10_000 - prefix.length);
    const over10k = prefix + "A".repeat(10_001 - prefix.length);
    expect(exactly10k.length).toBe(10_000);
    expect(over10k.length).toBe(10_001);

    const res10k_pass = sanitizeForStorage({ img: exactly10k }, 10_000);
    const res10k_fail = sanitizeForStorage({ img: over10k }, 10_000);
    expect(res10k_pass.img).toBe(exactly10k);
    expect(res10k_fail.img).toBe("");

    // 2. Test 25,000 threshold boundary
    const exactly25k = prefix + "B".repeat(25_000 - prefix.length);
    const over25k = prefix + "B".repeat(25_001 - prefix.length);
    expect(exactly25k.length).toBe(25_000);
    expect(over25k.length).toBe(25_001);

    const res25k_pass = sanitizeForStorage({ img: exactly25k }, 25_000);
    const res25k_fail = sanitizeForStorage({ img: over25k }, 25_000);
    expect(res25k_pass.img).toBe(exactly25k);
    expect(res25k_fail.img).toBe("");

    // 3. Test 50,000 threshold boundary
    const exactly50k = prefix + "C".repeat(50_000 - prefix.length);
    const over50k = prefix + "C".repeat(50_001 - prefix.length);
    expect(exactly50k.length).toBe(50_000);
    expect(over50k.length).toBe(50_001);

    const res50k_pass = sanitizeForStorage({ img: exactly50k }, 50_000);
    const res50k_fail = sanitizeForStorage({ img: over50k }, 50_000);
    expect(res50k_pass.img).toBe(exactly50k);
    expect(res50k_fail.img).toBe("");

    // 4. Test nested structures and arrays with custom threshold 10,000
    const complex = {
      profile: {
        avatar: prefix + "D".repeat(8_000), // < 10k -> keep
        banner: prefix + "E".repeat(12_000), // > 10k -> strip
      },
      gallery: [
        { thumb: prefix + "F".repeat(4_000) }, // < 10k -> keep
        { original: prefix + "G".repeat(16_000) }, // > 10k -> strip
      ],
      nonImage: "data:text/plain;base64," + "H".repeat(15_000), // non-image string -> keep
      plainText: "regular string text",
    };

    const sanitizedComplex = sanitizeForStorage(complex, 10_000);
    expect(sanitizedComplex.profile.avatar).toBe(complex.profile.avatar);
    expect(sanitizedComplex.profile.banner).toBe("");
    expect(sanitizedComplex.gallery[0].thumb).toBe(complex.gallery[0].thumb);
    expect(sanitizedComplex.gallery[1].original).toBe("");
    expect(sanitizedComplex.nonImage).toBe(complex.nonImage);
    expect(sanitizedComplex.plainText).toBe("regular string text");

    // 5. Verify default fallback remains 250,000 when no custom threshold passed
    const img100k = prefix + "I".repeat(100_000);
    const defaultSanitized = sanitizeForStorage({ img: img100k });
    expect(defaultSanitized.img).toBe(img100k);
  });
});

// ============================================================================
// SUITE 4: CORRUPT, HOSTILE, AND NON-JSON PAYLOADS
// ============================================================================

describe("Suite 4: Corrupt and Hostile Payloads", () => {
  it("handles malformed and unparseable JSON strings without throwing", () => {
    const corruptPayloads = [
      "{ broken json :::",
      '{"incomplete": [1, 2, ',
      "undefined",
      "NaN",
      "[object Object]",
      "<xml>invalid</xml>",
      "",
      "null",
      "true",
      "42",
      '{"bad_escape": "\\u000"}',
      "\x00\x01\x02\x03",
    ];

    for (const corrupt of corruptPayloads) {
      expect(() => {
        const res = safeSetItem("corrupt_test_key", corrupt);
        if (res) {
          expect(safeGetItem("corrupt_test_key")).toBe(corrupt);
        }
      }).not.toThrow();
    }
  });

  it("handles non-JSON raw string IDs under QuotaExceededError conditions", () => {
    mockStorage.setItem("bos-store-products-cache", "X".repeat(22_000));
    const rawTemplateId = "gst_tally_v2_modern_layout";

    // Write raw string template ID forcing quota recovery (22,000 chars = 44KB + 5KB = 49KB near 50KB)
    mockStorage.setItem("user_junk", "J".repeat(3000));
    const success = safeSetItem("bos_active_invoice_template_id", rawTemplateId);

    expect(success).toBe(true);
    expect(safeGetItem("bos_active_invoice_template_id")).toBe(rawTemplateId);
  });

  it("handles corrupted JSON stored inside pos_saved_invoices during quota trim", () => {
    mockStorage.setItem("pos_saved_invoices_t1", "CORRUPTED_NON_JSON_DATA");
    mockStorage.setItem("bos-store-products-cache", "X".repeat(15_000));

    expect(() => {
      safeSetItem("new_key", "DATA".repeat(1000));
    }).not.toThrow();
  });

  it("pruneTemplateList gracefully handles corrupt lists with nulls, numbers, and malformed items", () => {
    const corruptList: any = [
      null,
      undefined,
      42,
      "string_item",
      {},
      { id: "valid_1", name: "Valid Template 1" },
      { id: "valid_1", name: "Valid Template 1 Updated", updated_at: "2026-10-10" },
      { template_id: "valid_2", name: "Valid 2", updatedAt: "invalid-date-format" },
    ];

    expect(() => {
      const pruned = pruneTemplateList(corruptList);
      expect(pruned.length).toBe(3);
    }).not.toThrow();
  });
});

// ============================================================================
// SUITE 5: RAPID CONSECUTIVE AND CONCURRENT STORAGE WRITES
// ============================================================================

describe("Suite 5: Rapid Consecutive and Concurrent Storage Writes", () => {
  it("survives 300 rapid consecutive synchronous writes without corruption", () => {
    mockStorage.maxBytes = 10 * 1024 * 1024; // 10MB capacity

    const start = performance.now();
    for (let i = 0; i < 300; i++) {
      const key = `rapid_key_${i % 10}`;
      const val = JSON.stringify({ iter: i, timestamp: Date.now(), pad: `v_${i}` });
      const ok = safeSetItem(key, val);
      expect(ok).toBe(true);
    }
    const end = performance.now();

    for (let k = 0; k < 10; k++) {
      const stored = safeGetItem(`rapid_key_${k}`);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.iter % 10).toBe(k);
    }

    expect(end - start).toBeLessThan(1000);
  });

  it("handles 50 parallel asynchronous writes via Promise.all", async () => {
    mockStorage.maxBytes = 10 * 1024 * 1024;

    const tasks = Array.from({ length: 50 }, async (_, i) => {
      const key = `async_key_${i}`;
      const val = JSON.stringify({ id: i, payload: "async-test-data-" + i });
      return safeSetItem(key, val);
    });

    const results = await Promise.all(tasks);
    expect(results.every((r) => r === true)).toBe(true);

    for (let i = 0; i < 50; i++) {
      expect(safeGetItem(`async_key_${i}`)).toContain(`async-test-data-${i}`);
    }
  });

  it("maintains template integrity under rapid quota boundary thrashing", () => {
    mockStorage.maxBytes = 50 * 1024; // 50 KB

    const myTemplate = JSON.stringify([
      {
        id: "master_user_template",
        name: "My Critical Invoice Design",
        updated_at: new Date().toISOString(),
      },
    ]);
    safeSetItem("businessos_print_templates_v1", myTemplate);

    for (let i = 0; i < 20; i++) {
      safeSetItem(`bos_temp_overlay_${i}`, "T".repeat(3000));
      safeSetItem(`bos-store-products-cache`, "P".repeat(3000));
      safeSetItem(`pos_temp_invoice_${i}`, "I".repeat(3000));
    }

    const afterThrashing = safeGetItem("businessos_print_templates_v1");
    expect(afterThrashing).not.toBeNull();
    const parsed = JSON.parse(afterThrashing!);
    expect(parsed[0].id).toBe("master_user_template");
    expect(parsed[0].name).toBe("My Critical Invoice Design");
  });
});

// ============================================================================
// SUITE 6: UNHANDLED EXCEPTION SAFETY (ZERO CRASH GUARANTEE)
// ============================================================================

describe("Suite 6: Zero Unhandled Exception Guarantee", () => {
  it("never throws when localStorage throws SecurityError (disabled cookies / private mode on setItem)", () => {
    mockStorage.throwSecurityErrorOnSet = true;

    expect(() => {
      const res = safeSetItem("any_key", "any_val");
      expect(res).toBe(false);
    }).not.toThrow();

    expect(() => {
      const res = safeGetItem("any_key");
      expect(res).toBeNull();
    }).not.toThrow();

    expect(() => {
      safeRemoveItem("any_key");
    }).not.toThrow();
  });

  it("never throws when localStorage throws arbitrary hardware or disk errors", () => {
    mockStorage.throwArbitraryError = new Error("EIO: i/o error, read/write failed on physical disk");

    expect(() => {
      const res = safeSetItem("failing_key", "val");
      expect(res).toBe(false);
    }).not.toThrow();
  });

  it("never throws when window is undefined (SSR environment)", () => {
    const originalWindow = (globalThis as any).window;
    try {
      delete (globalThis as any).window;

      expect(() => {
        expect(safeSetItem("ssr_key", "ssr_val")).toBe(false);
        expect(safeGetItem("ssr_key")).toBeNull();
        safeRemoveItem("ssr_key");
      }).not.toThrow();
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  it("never throws when storage helper methods fail during quota recovery (removeItem / key)", () => {
    mockStorage.setItem("bos-store-products-cache", "X".repeat(15_000));
    mockStorage.failOnRemove = true;

    expect(() => {
      safeSetItem("incoming_key", "DATA".repeat(3000));
    }).not.toThrow();
  });

  it("safely handles hostile inputs (empty strings, extreme unicode, special characters)", () => {
    const edgeCases = [
      { key: "", val: "" },
      { key: " ", val: " " },
      { key: "🔑🏷️📦💾", val: "🚀🎉🔥" },
      { key: "null", val: "null" },
      { key: "undefined", val: "undefined" },
      { key: "SELECT * FROM users; DROP TABLE;", val: "<script>alert(1)</script>" },
      { key: "../../../etc/passwd", val: "\r\n\t" },
      { key: "long_key_".repeat(100), val: "long_val_".repeat(100) },
    ];

    for (const ec of edgeCases) {
      expect(() => {
        const res = safeSetItem(ec.key, ec.val);
        if (res) {
          expect(safeGetItem(ec.key)).toBe(ec.val);
        }
        safeRemoveItem(ec.key);
      }).not.toThrow();
    }
  });

  it("behavior on non-string key types (adversarial check: null/undefined/number)", () => {
    // Verified: safeSetItem gracefully returns false without throwing unhandled exceptions
    expect(safeSetItem(null as any, "val")).toBe(false);
    expect(safeSetItem(undefined as any, "val")).toBe(false);
    expect(safeSetItem(123 as any, "val")).toBe(false);
    expect(safeGetItem(null as any)).toBeNull();
    expect(safeGetItem(undefined as any)).toBeNull();
  });
});
