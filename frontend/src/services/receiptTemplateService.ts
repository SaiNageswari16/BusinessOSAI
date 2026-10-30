/**
 * Enterprise Per-Organization Thermal Receipt Template Service.
 *
 * Implements Petpooja, MyBillBook & BusinessOSAI standard thermal ESC/POS & PDF receipts (80mm & 58mm).
 * Fully customizable per Organization (`tenant_id`) and Outlet (`outlet_id`), persisted in PostgreSQL
 * via `/api/v1/billing/print-templates` and `/api/v1/billing/print-template/active`, with instant
 * reactive `useSyncExternalStore` state and per-org localStorage cache.
 */

import { useSyncExternalStore } from "react";
import { billingService, type PrintTemplateRecord } from "./billingService";
import { getActiveOutlet, getActiveTenant } from "../lib/auth-tokens";

export interface ReceiptTemplate {
  // Optional persisted backend metadata
  id?: string;
  name?: string;
  templateName?: string;
  tenantId?: string;
  outletId?: string | null;
  storeName?: string;
  paperSize?: string;

  // Identity & Header (supports both Customizer & Dialog field names)
  orgName: string;
  brandName: string;
  tagline: string;
  subtitle: string;
  branchName: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  email: string;
  gstin: string;
  fssai: string;

  // Print Format & Hardware
  paperWidth: "80mm" | "58mm";
  fontSize: "compact" | "normal" | "large";
  fontScale: "sm" | "md" | "lg";
  printMode: "browser_html" | "backend_pdf" | "escpos_raw";
  autoPrintOnSettle: boolean;
  autoPrintKotOnFire: boolean;
  copiesCount: number;
  showLogo: boolean;
  showBrandLogo: boolean;
  logoUrl?: string;

  // Header & Info Toggles
  showAddress: boolean;
  showPhone: boolean;
  showGstin: boolean;
  showFssai: boolean;
  showHeaderGreeting: boolean;
  showTaxInvoiceHeading: boolean;
  headerGreetingText: string;
  showOrderMeta: boolean;
  showCustomerInfo: boolean;
  showCustomer: boolean;
  showCustomerGstin: boolean;
  showLoyaltyPoints: boolean;
  loyaltyEarnRatePct: number;

  // Service, Staff & Line Item Toggles
  showTable: boolean;
  showWaiter: boolean;
  showCashier: boolean;
  showTokenNo: boolean;
  showTokenBox: boolean;
  showItemCodes: boolean;
  showItemModifiers: boolean;
  showItemNotes: boolean;
  showItemTaxes: boolean;

  // Financial Breakdown Toggles
  showDiscountLine: boolean;
  showTaxableSubtotal: boolean;
  showTaxBreakup: boolean;
  showCgstSgstSplit: boolean;
  showServiceCharge: boolean;
  showPackaging: boolean;
  showRoundOff: boolean;
  showRounding: boolean;
  showSavingsBanner: boolean;
  showPaymentMode: boolean;
  showPaymentMethod: boolean;

  // QR Code & Footer
  showQrCode: boolean;
  qrType: "upi" | "feedback" | "none";
  upiId: string;
  qrUpiId: string;
  qrPayeeName: string;
  qrNote: string;
  footerMessage: string;
  footerNote: string;
  footerSubNote: string;
  feedbackUrl?: string;
  wifiDetails?: string;
  wifiNote: string;
  termsNotice?: string;
  termsLine: string;
}

export interface SavedOrgReceiptTemplate {
  id: string;
  name: string;
  paperSize: "80mm" | "58mm";
  active: boolean;
  outletId?: string | null;
  template: ReceiptTemplate;
}

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplate = {
  templateName: "Standard 80mm GST Thermal Slip",
  orgName: "Sunrise Restaurant & Bar",
  brandName: "Sunrise Restaurant & Bar",
  tagline: "Authentic Flavours & Modern Hospitality",
  subtitle: "Authentic Flavours & Modern Hospitality",
  branchName: "Hyderabad — Banjara Hills",
  address: "Road No. 12, Banjara Hills, Hyderabad, Telangana 500034",
  addressLine1: "Road No. 12, Banjara Hills",
  addressLine2: "Hyderabad, Telangana 500034",
  phone: "+91 40 2335 8899",
  email: "support@sunrise-restaurant.in",
  gstin: "36AABCS1429B1Z1",
  fssai: "13621014000452",

  paperWidth: "80mm",
  fontSize: "normal",
  fontScale: "md",
  printMode: "browser_html",
  autoPrintOnSettle: false,
  autoPrintKotOnFire: true,
  copiesCount: 1,
  showLogo: true,
  showBrandLogo: true,

  showAddress: true,
  showPhone: true,
  showGstin: true,
  showFssai: true,
  showHeaderGreeting: true,
  showTaxInvoiceHeading: true,
  headerGreetingText: "TAX INVOICE",
  showOrderMeta: true,
  showCustomerInfo: true,
  showCustomer: true,
  showCustomerGstin: true,
  showLoyaltyPoints: true,
  loyaltyEarnRatePct: 5,

  showTable: true,
  showWaiter: true,
  showCashier: true,
  showTokenNo: true,
  showTokenBox: true,
  showItemCodes: false,
  showItemModifiers: true,
  showItemNotes: true,
  showItemTaxes: false,

  showDiscountLine: true,
  showTaxableSubtotal: true,
  showTaxBreakup: true,
  showCgstSgstSplit: true,
  showServiceCharge: true,
  showPackaging: true,
  showRoundOff: true,
  showRounding: true,
  showSavingsBanner: true,
  showPaymentMode: true,
  showPaymentMethod: true,

  showQrCode: true,
  qrType: "upi",
  upiId: "sunrise@hdfcbank",
  qrUpiId: "sunrise@hdfcbank",
  qrPayeeName: "Sunrise Restaurant & Bar",
  qrNote: "Scan & Pay with any UPI App (GPay / PhonePe / Paytm)",
  footerMessage: "Thank you for dining with us! Visit again.",
  footerNote: "Thank you for dining with us! Visit again.",
  footerSubNote: "We hope you loved the food & hospitality.",
  feedbackUrl: "https://g.page/r/sunrise-restaurant/review",
  wifiDetails: "Guest WiFi: Sunrise_Guest | Pass: dinehappy",
  wifiNote: "Guest WiFi: Sunrise_Guest | Pass: dinehappy",
  termsNotice: "Prices are subject to applicable GST. Computer generated tax invoice.",
  termsLine: "Prices are subject to applicable GST. Computer generated tax invoice.",
};

const STORAGE_KEY_PREFIX = "ros_receipt_template_";

/**
 * Resolve current organization key (tenant UUID or slug) for strict per-org isolation.
 */
export function resolveActiveOrgKey(explicitOrgKey?: string): string {
  if (explicitOrgKey && explicitOrgKey.trim()) {
    return explicitOrgKey.trim().toLowerCase();
  }
  const activeTid = getActiveTenant();
  if (activeTid) return activeTid.toLowerCase();

  if (typeof localStorage !== "undefined") {
    try {
      const bosTenantRaw = localStorage.getItem("bos-tenant");
      if (bosTenantRaw) {
        const parsed = JSON.parse(bosTenantRaw);
        const tid = parsed?.raw?.tenant_id || parsed?.tenant_id || parsed?.id;
        if (tid) return String(tid).toLowerCase();
      }
      const companyId = localStorage.getItem("bos_active_company_id");
      if (companyId) return companyId.toLowerCase();
    } catch {
      // ignore
    }
  }
  return "default-org";
}

/**
 * Synchronize bi-directional aliases between ReceiptDialog, ReceiptCustomizerModal,
 * and Backend PrintTemplate fields so no field ever drifts out of sync.
 */
export function normalizeReceiptTemplate(
  raw?: Partial<ReceiptTemplate> & Record<string, any>,
  base: ReceiptTemplate = DEFAULT_RECEIPT_TEMPLATE
): ReceiptTemplate {
  const src = raw || {};
  const merged: ReceiptTemplate = {
    ...base,
    ...src,
  };

  // Name / Brand sync
  if (src.brandName !== undefined && src.orgName === undefined) merged.orgName = src.brandName;
  else if (src.orgName !== undefined && src.brandName === undefined) merged.brandName = src.orgName;
  else if ( src.storeName !== undefined && src.brandName === undefined && src.orgName === undefined) {
    merged.brandName = src.storeName;
    merged.orgName = src.storeName;
  }

  // Subtitle / Tagline sync
  if (src.subtitle !== undefined && src.tagline === undefined) merged.tagline = src.subtitle;
  else if (src.tagline !== undefined && src.subtitle === undefined) merged.subtitle = src.tagline;

  // Address sync
  if ((src.addressLine1 !== undefined || src.addressLine2 !== undefined) && src.address === undefined) {
    merged.address = [merged.addressLine1, merged.addressLine2].map((s) => (s || "").trim()).filter(Boolean).join(", ");
  } else if (src.address !== undefined && src.addressLine1 === undefined) {
    const parts = String(src.address).split(",");
    if (parts.length > 2) {
      merged.addressLine1 = parts.slice(0, 2).join(",").trim();
      merged.addressLine2 = parts.slice(2).join(",").trim();
    } else {
      merged.addressLine1 = String(src.address);
      merged.addressLine2 = "";
    }
  }

  // Paper size sync
  if (src.paperSize && !src.paperWidth) {
    merged.paperWidth = String(src.paperSize).includes("58") ? "58mm" : "80mm";
  }

  // Font scale <-> fontSize sync
  if (src.fontScale !== undefined && src.fontSize === undefined) {
    merged.fontSize = src.fontScale === "sm" ? "compact" : src.fontScale === "lg" ? "large" : "normal";
  } else if (src.fontSize !== undefined && src.fontScale === undefined) {
    merged.fontScale = src.fontSize === "compact" ? "sm" : src.fontSize === "large" ? "lg" : "md";
  }

  // Boolean toggles sync
  if (src.showBrandLogo !== undefined && src.showLogo === undefined) merged.showLogo = src.showBrandLogo;
  else if (src.showLogo !== undefined && src.showBrandLogo === undefined) merged.showBrandLogo = src.showLogo;

  if (src.showTaxInvoiceHeading !== undefined && src.showHeaderGreeting === undefined) {
    merged.showHeaderGreeting = src.showTaxInvoiceHeading;
  } else if (src.showHeaderGreeting !== undefined && src.showTaxInvoiceHeading === undefined) {
    merged.showTaxInvoiceHeading = src.showHeaderGreeting;
  }

  if (src.showCustomer !== undefined && src.showCustomerInfo === undefined) merged.showCustomerInfo = src.showCustomer;
  else if (src.showCustomerInfo !== undefined && src.showCustomer === undefined) merged.showCustomer = src.showCustomerInfo;

  if (src.showTokenBox !== undefined && src.showTokenNo === undefined) merged.showTokenNo = src.showTokenBox;
  else if (src.showTokenNo !== undefined && src.showTokenBox === undefined) merged.showTokenBox = src.showTokenNo;

  if (src.showCgstSgstSplit !== undefined && src.showTaxBreakup === undefined) merged.showTaxBreakup = src.showCgstSgstSplit;
  else if (src.showTaxBreakup !== undefined && src.showCgstSgstSplit === undefined) merged.showCgstSgstSplit = src.showTaxBreakup;

  if (src.showRounding !== undefined && src.showRoundOff === undefined) merged.showRoundOff = src.showRounding;
  else if (src.showRoundOff !== undefined && src.showRounding === undefined) merged.showRounding = src.showRoundOff;

  if (src.showPaymentMethod !== undefined && src.showPaymentMode === undefined) merged.showPaymentMode = src.showPaymentMethod;
  else if (src.showPaymentMode !== undefined && src.showPaymentMethod === undefined) merged.showPaymentMethod = src.showPaymentMode;

  // QR & Footer sync
  if (src.qrUpiId !== undefined && src.upiId === undefined) merged.upiId = src.qrUpiId;
  else if (src.upiId !== undefined && src.qrUpiId === undefined) merged.qrUpiId = src.upiId;

  if (src.footerNote !== undefined && src.footerMessage === undefined) merged.footerMessage = src.footerNote;
  else if (src.footerMessage !== undefined && src.footerNote === undefined) merged.footerNote = src.footerMessage;

  if (src.wifiNote !== undefined && src.wifiDetails === undefined) merged.wifiDetails = src.wifiNote;
  else if (src.wifiDetails !== undefined && src.wifiNote === undefined) merged.wifiNote = src.wifiDetails || "";

  if (src.termsLine !== undefined && src.termsNotice === undefined) merged.termsNotice = src.termsLine;
  else if (src.termsNotice !== undefined && src.termsLine === undefined) merged.termsLine = src.termsNotice || "";

  if (!merged.qrPayeeName) merged.qrPayeeName = merged.brandName || merged.orgName;

  return merged;
}

function readLocalTemplate(orgKey: string): ReceiptTemplate {
  if (typeof localStorage === "undefined") return DEFAULT_RECEIPT_TEMPLATE;
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${orgKey}`);
    if (stored) {
      return normalizeReceiptTemplate(JSON.parse(stored), DEFAULT_RECEIPT_TEMPLATE);
    }
    // Check if active company GST details exist for this org to seed brandName/GSTIN/Address
    const gstRaw =
      localStorage.getItem(`bos_active_billing_gst_details_${orgKey}`) ||
      localStorage.getItem("bos_active_billing_gst_details");
    if (gstRaw) {
      const gst = JSON.parse(gstRaw);
      if (gst?.trade_name || gst?.legal_name) {
        return normalizeReceiptTemplate({
          brandName: gst.trade_name || gst.legal_name,
          orgName: gst.trade_name || gst.legal_name,
          gstin: gst.gstin || DEFAULT_RECEIPT_TEMPLATE.gstin,
          phone: gst.phone || DEFAULT_RECEIPT_TEMPLATE.phone,
          email: gst.email || DEFAULT_RECEIPT_TEMPLATE.email,
          address: gst.address || DEFAULT_RECEIPT_TEMPLATE.address,
        });
      }
    }
  } catch (e) {
    console.warn("Failed to read receipt template from localStorage:", e);
  }
  return DEFAULT_RECEIPT_TEMPLATE;
}

function writeLocalTemplate(orgKey: string, template: ReceiptTemplate): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${orgKey}`, JSON.stringify(template));
  } catch (e) {
    console.warn("Failed to cache receipt template in localStorage:", e);
  }
}

// ── Reactive Store State ────────────────────────────────────────────────────

let currentOrgKey = resolveActiveOrgKey();
let activeTemplateState: ReceiptTemplate = readLocalTemplate(currentOrgKey);
let savedTemplatesState: SavedOrgReceiptTemplate[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let debounceSaveTimer: ReturnType<typeof setTimeout> | null = null;

function mapRecordToSavedTemplate(rec: PrintTemplateRecord): SavedOrgReceiptTemplate {
  const rawFields = (rec.fields && typeof rec.fields === "object" ? rec.fields : rec) as Partial<ReceiptTemplate>;
  const tpl = normalizeReceiptTemplate({
    ...rawFields,
    id: String(rec.id || rec.template_id || rawFields.id || ""),
    templateName: rec.name || rawFields.templateName || rawFields.name || "Thermal Receipt Template",
    paperWidth: String(rec.paper_size || rec.paperSize || rawFields.paperWidth || "80mm").includes("58")
      ? "58mm"
      : "80mm",
    outletId: rec.outlet_id ?? null,
  });
  return {
    id: String(rec.id || rec.template_id),
    name: rec.name || tpl.templateName || "Thermal Receipt Template",
    paperSize: tpl.paperWidth,
    active: Boolean(rec.active),
    outletId: rec.outlet_id ?? null,
    template: tpl,
  };
}

/**
 * Synchronize active template and saved template list from the PostgreSQL billing microservice
 * for the currently active Organization (`tenant_id`) and Outlet (`outlet_id`).
 */
export async function syncReceiptTemplatesFromBackend(): Promise<void> {
  currentOrgKey = resolveActiveOrgKey();
  const outletId = getActiveOutlet() || undefined;

  try {
    const [listRes, activeRes] = await Promise.allSettled([
      billingService.listPrintTemplates({ category: "thermal" }),
      billingService.getActivePrintTemplate({ category: "thermal", outlet_id: outletId }),
    ]);

    if (listRes.status === "fulfilled" && Array.isArray(listRes.value?.templates)) {
      savedTemplatesState = listRes.value.templates.map(mapRecordToSavedTemplate);
    }

    if (
      activeRes.status === "fulfilled" &&
      activeRes.value &&
      Object.keys(activeRes.value).length > 0 &&
      (activeRes.value.id || activeRes.value.fields)
    ) {
      const mapped = mapRecordToSavedTemplate(activeRes.value);
      activeTemplateState = mapped.template;
      writeLocalTemplate(currentOrgKey, activeTemplateState);
      emit();
      return;
    }

    // Fallback to local cache for this org if no active row in DB yet
    activeTemplateState = readLocalTemplate(currentOrgKey);
    emit();
  } catch {
    activeTemplateState = readLocalTemplate(currentOrgKey);
    emit();
  }
}

/**
 * Persist a template to the PostgreSQL `print_templates` table for the current organization.
 */
export async function saveReceiptTemplateToBackend(
  template: ReceiptTemplate = activeTemplateState,
  name?: string,
  setAsDefault = true,
  createNew = false
): Promise<SavedOrgReceiptTemplate | null> {
  currentOrgKey = resolveActiveOrgKey();
  const normalized = normalizeReceiptTemplate(template, activeTemplateState);
  const templateTitle = name || normalized.templateName || `${normalized.brandName} (${normalized.paperWidth})`;
  const payloadTemplate: Record<string, any> = {
    ...normalized,
    name: templateTitle,
    templateName: templateTitle,
    paperSize: normalized.paperWidth,
    storeName: normalized.brandName,
    branchName: normalized.subtitle || normalized.branchName,
    address: normalized.address,
    upiId: normalized.qrUpiId,
    footerText: normalized.footerNote,
    termsText: normalized.termsLine,
  };
  if (createNew) {
    delete payloadTemplate["id"];
  }

  writeLocalTemplate(currentOrgKey, normalized);
  activeTemplateState = normalized;
  emit();

  try {
    const res = await billingService.savePrintTemplate({
      outlet_id: getActiveOutlet() || null,
      category: "thermal",
      name: templateTitle,
      template: payloadTemplate,
      set_as_default: setAsDefault,
    });
    if (res?.template) {
      const saved = mapRecordToSavedTemplate(res.template);
      if (setAsDefault) {
        activeTemplateState = saved.template;
        writeLocalTemplate(currentOrgKey, activeTemplateState);
      }
      await syncReceiptTemplatesFromBackend();
      return saved;
    }
  } catch (err) {
    console.warn("Saved template to per-org local cache (backend sync deferred):", err);
  }
  return null;
}

/**
 * Update the active receipt template in memory + per-org localStorage,
 * and auto-save to PostgreSQL (debounced).
 */
export function updateReceiptTemplate(
  updates: Partial<ReceiptTemplate>,
  options: { persistBackend?: boolean } = { persistBackend: true }
): ReceiptTemplate {
  currentOrgKey = resolveActiveOrgKey();
  activeTemplateState = normalizeReceiptTemplate(updates, activeTemplateState);
  writeLocalTemplate(currentOrgKey, activeTemplateState);
  emit();

  if (options.persistBackend !== false) {
    if (debounceSaveTimer) clearTimeout(debounceSaveTimer);
    debounceSaveTimer = setTimeout(() => {
      void saveReceiptTemplateToBackend(activeTemplateState, activeTemplateState.templateName, true);
    }, 650);
  }

  return activeTemplateState;
}

/**
 * Reset active template to default for the current organization.
 */
export function resetReceiptTemplate(): ReceiptTemplate {
  currentOrgKey = resolveActiveOrgKey();
  activeTemplateState = normalizeReceiptTemplate(
    { id: activeTemplateState.id },
    DEFAULT_RECEIPT_TEMPLATE
  );
  writeLocalTemplate(currentOrgKey, activeTemplateState);
  emit();
  void saveReceiptTemplateToBackend(activeTemplateState, activeTemplateState.templateName, true);
  return activeTemplateState;
}

/**
 * Set a specific saved template as the organization's active default.
 */
export async function activateOrgReceiptTemplate(templateId: string): Promise<boolean> {
  const match = savedTemplatesState.find((t) => t.id === templateId);
  if (match) {
    activeTemplateState = match.template;
    writeLocalTemplate(resolveActiveOrgKey(), activeTemplateState);
    emit();
  }
  try {
    await billingService.setActivePrintTemplate({ template_id: templateId, category: "thermal" });
    await syncReceiptTemplatesFromBackend();
    return true;
  } catch (e) {
    console.warn("Could not activate template on backend:", e);
    return false;
  }
}

/**
 * Delete a saved template from the organization's template library.
 */
export async function deleteOrgReceiptTemplate(templateId: string): Promise<boolean> {
  savedTemplatesState = savedTemplatesState.filter((t) => t.id !== templateId);
  emit();
  try {
    const res = await billingService.deletePrintTemplate(templateId, "thermal");
    await syncReceiptTemplatesFromBackend();
    return Boolean(res?.deleted);
  } catch (e) {
    console.warn("Could not delete template on backend:", e);
    return false;
  }
}

/**
 * React hook returning the active organization's `ReceiptTemplate`.
 */
export function useReceiptTemplate(): ReceiptTemplate {
  return useSyncExternalStore(
    subscribe,
    () => activeTemplateState,
    () => DEFAULT_RECEIPT_TEMPLATE
  );
}

/**
 * React hook returning all saved `PrintTemplate` records for the active organization.
 */
export function useOrgReceiptTemplates(): SavedOrgReceiptTemplate[] {
  return useSyncExternalStore(
    subscribe,
    () => savedTemplatesState,
    () => []
  );
}

export const receiptTemplateService = {
  getActiveTemplate(orgSlug?: string): ReceiptTemplate {
    const key = resolveActiveOrgKey(orgSlug);
    if (key !== currentOrgKey) {
      currentOrgKey = key;
      activeTemplateState = readLocalTemplate(key);
    }
    return activeTemplateState;
  },

  saveActiveTemplate(template: ReceiptTemplate, orgSlug?: string): void {
    const key = resolveActiveOrgKey(orgSlug);
    currentOrgKey = key;
    activeTemplateState = normalizeReceiptTemplate(template, activeTemplateState);
    writeLocalTemplate(key, activeTemplateState);
    emit();
    void saveReceiptTemplateToBackend(activeTemplateState, activeTemplateState.templateName, true);
  },

  syncFromBackend: syncReceiptTemplatesFromBackend,
  saveToBackend: saveReceiptTemplateToBackend,
  activateTemplate: activateOrgReceiptTemplate,
  deleteTemplate: deleteOrgReceiptTemplate,

  async openBackendThermalPdf(billId: string, paperSize?: "80mm" | "58mm"): Promise<void> {
    const size = paperSize || activeTemplateState.paperWidth || "80mm";
    const blob = await billingService.printThermalReceiptBlob(billId, {
      escpos: false,
      size,
      template_id: activeTemplateState.id,
    });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  async downloadBackendEscPos(billId: string, billNumber?: string, paperSize?: "80mm" | "58mm"): Promise<void> {
    const size = paperSize || activeTemplateState.paperWidth || "80mm";
    const blob = await billingService.printThermalReceiptBlob(billId, {
      escpos: true,
      size,
      template_id: activeTemplateState.id,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${billNumber || billId}-${size}.escpos`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

// Automatically sync when browser loads or when tenant/organization changes
if (typeof window !== "undefined") {
  void syncReceiptTemplatesFromBackend();
  const handleOrgSwitch = () => {
    currentOrgKey = resolveActiveOrgKey();
    activeTemplateState = readLocalTemplate(currentOrgKey);
    emit();
    void syncReceiptTemplatesFromBackend();
  };
  window.addEventListener("bos-tenant-changed", handleOrgSwitch);
  window.addEventListener("bos-company-changed", handleOrgSwitch);
  window.addEventListener("bos-auth-changed", handleOrgSwitch);
  window.addEventListener("print_templates_updated", () => {
    void syncReceiptTemplatesFromBackend();
  });
}
