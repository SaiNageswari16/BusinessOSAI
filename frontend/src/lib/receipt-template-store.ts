import { printTemplatesApi, invoicesApi } from "./api-client";
import { safeSetItem, safeRemoveItem, pruneTemplateList } from "./safe-storage";

export interface ReceiptTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  themeName?: 'compact' | 'advanced' | 'simple' | 'classic';
  paperSize: '80mm' | '58mm';
  fontDensity: 'normal' | 'compact' | 'large';
  printClarity?: 'ultra_dark' | 'crisp_mono' | 'compact' | 'standard';
  fontFamily?: 'monospace' | 'sans-serif' | 'clean';
  dividerStyle?: 'dashed' | 'solid' | 'dotted' | 'double';
  
  storeName: string;
  branchName: string;
  headerTagline: string;
  invoiceTitle: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  cin: string;
  pan?: string;
  logoUrl?: string;
  
  // Theme Settings
  showPartyBalance?: boolean;
  partyBalance?: number;
  showItemDescription?: boolean;
  showTime?: boolean;

  // Header Section Toggles
  showLogo: boolean;
  showStoreName?: boolean;
  showBranchName?: boolean;
  showStoreAddress: boolean;
  showStoreContact?: boolean;
  showTaxId: boolean;
  showCin?: boolean;
  showInvoiceTitle?: boolean;
  showTagline?: boolean;
  showCashier?: boolean;

  // Invoice Details
  showInvoiceNumber?: boolean;
  showInvoiceDate?: boolean;
  showPoNumber?: boolean;
  showVehicleNumber?: boolean;
  showEwayBill?: boolean;
  showChallanNumber?: boolean;
  showDueDate?: boolean;
  showPaymentMethod?: boolean;

  // Party Details
  showCustomerDetails: boolean;
  showCustomerAddress?: boolean;
  showCustomerPhone?: boolean;
  showCustomerGstin?: boolean;
  showCustomerPan?: boolean;
  showPlaceOfSupply?: boolean;
  placeOfSupply?: string;
  showShippingAddress?: boolean;
  shippingAddress?: string;

  // Item Table Column Toggles
  showItemIndex?: boolean;
  showItemName?: boolean;
  showItemHSN: boolean;
  showItemSKU?: boolean;
  showItemQty?: boolean;
  showItemUom?: boolean;
  showItemRate?: boolean;
  showItemMrp?: boolean;
  showItemBatch?: boolean;
  showItemExpiry?: boolean;
  showItemMfg?: boolean;
  showItemDiscount: boolean;
  showItemTax?: boolean;
  showItemTotal?: boolean;

  // Miscellaneous Details Toggles
  showSubtotal?: boolean;
  showOverallQty?: boolean;
  showTotalDiscount?: boolean;
  showYouSaved?: boolean;
  showSavingsBanner?: boolean;
  showTaxBreakdown: boolean;
  showRoundOff?: boolean;
  showGrandTotal?: boolean;
  showReceivedAndBalance?: boolean;
  showAmountInWords?: boolean;
  showLoyaltyPoints: boolean;
  showPaymentMode: boolean;
  showPaidInFullStamp?: boolean;
  showQrCode: boolean;
  showGoogleReviewQR?: boolean;
  googleReviewUrl?: string;

  // Terms, Declaration & Footer Toggles
  showTermsAndConditions?: boolean;
  termsAndConditionsText?: string;
  showDeclaration: boolean;
  declarationText: string;
  showFooterNote: boolean;
  footerNote: string;
  showSignature?: boolean;
  showStamp?: boolean;

  qrType: 'upi' | 'einvoice' | 'url';
  upiId?: string;

  // Custom Fields & Columns
  customFields?: Array<{ id: string; name: string; value?: string; enabled: boolean }>;
  customItemColumns?: Array<{ id: string; name: string; enabled: boolean }>;
  [key: string]: any;
}

export const RECEIPT_THEME_PRESETS: Record<'compact' | 'advanced' | 'simple' | 'classic', Partial<ReceiptTemplate>> = {
  compact: {
    name: 'Compact Theme (myBillBook Standard)',
    themeName: 'compact',
    fontDensity: 'compact',
    printClarity: 'ultra_dark',
    fontFamily: 'sans-serif',
    dividerStyle: 'solid',
    showItemDescription: true,
    showItemHSN: true,
    showItemMrp: true,
    showItemBatch: true,
    showItemExpiry: true,
    showItemMfg: true,
    showItemDiscount: true,
    showItemTax: true,
    showSubtotal: true,
    showOverallQty: true,
    showTaxBreakdown: true,
    showYouSaved: true,
    showReceivedAndBalance: true,
    showPartyBalance: true,
    showShippingAddress: true,
    showPlaceOfSupply: true,
  },
  advanced: {
    name: 'Advanced Theme (Boxed Grid & Heavy Contrast)',
    themeName: 'advanced',
    fontDensity: 'normal',
    printClarity: 'ultra_dark',
    fontFamily: 'sans-serif',
    dividerStyle: 'double',
    showItemDescription: true,
    showItemHSN: true,
    showItemSKU: true,
    showItemMrp: true,
    showItemBatch: true,
    showItemExpiry: true,
    showItemMfg: true,
    showItemDiscount: true,
    showItemTax: true,
    showSubtotal: true,
    showOverallQty: true,
    showTaxBreakdown: true,
    showYouSaved: true,
    showReceivedAndBalance: true,
    showPartyBalance: true,
    showShippingAddress: true,
    showPlaceOfSupply: true,
    showPaidInFullStamp: true,
    showQrCode: true,
    showSignature: true,
    showStamp: true,
  },
  simple: {
    name: 'Simple Theme (Minimal Clean)',
    themeName: 'simple',
    fontDensity: 'normal',
    printClarity: 'crisp_mono',
    fontFamily: 'clean',
    dividerStyle: 'dotted',
    showItemDescription: true,
    showItemHSN: false,
    showItemMrp: false,
    showItemBatch: false,
    showItemExpiry: false,
    showItemMfg: false,
    showItemDiscount: true,
    showItemTax: false,
    showSubtotal: true,
    showOverallQty: true,
    showTaxBreakdown: true,
    showYouSaved: true,
    showReceivedAndBalance: true,
    showPartyBalance: false,
    showShippingAddress: false,
    showPlaceOfSupply: false,
  },
  classic: {
    name: 'Classic Theme (POS Dot Matrix)',
    themeName: 'classic',
    fontDensity: 'normal',
    printClarity: 'ultra_dark',
    fontFamily: 'monospace',
    dividerStyle: 'dashed',
    showItemDescription: true,
    showItemHSN: true,
    showItemMrp: true,
    showItemBatch: true,
    showItemExpiry: true,
    showItemMfg: true,
    showItemDiscount: true,
    showItemTax: true,
    showSubtotal: true,
    showOverallQty: true,
    showTaxBreakdown: true,
    showYouSaved: true,
    showReceivedAndBalance: true,
    showPartyBalance: true,
    showShippingAddress: true,
    showPlaceOfSupply: true,
  },
};

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplate = {
  id: 'template-compact-mybillbook',
  name: 'Compact (myBillBook Standard)',
  isDefault: true,
  themeName: 'compact',
  paperSize: '80mm',
  fontDensity: 'compact',
  printClarity: 'ultra_dark',
  fontFamily: 'sans-serif',
  dividerStyle: 'solid',
  storeName: '',
  branchName: '',
  headerTagline: '',
  invoiceTitle: 'TAX INVOICE',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  cin: '',
  pan: '',
  
  // Theme Settings
  showPartyBalance: true,
  partyBalance: 0,
  showItemDescription: true,
  showTime: true,

  // Header Section
  showLogo: true,
  showStoreName: true,
  showBranchName: false,
  showStoreAddress: true,
  showStoreContact: true,
  showTaxId: true,
  showCin: false,
  showInvoiceTitle: true,
  showTagline: false,
  showCashier: true,

  // Invoice Details
  showInvoiceNumber: true,
  showInvoiceDate: true,
  showPoNumber: false,
  showVehicleNumber: false,
  showEwayBill: false,
  showChallanNumber: false,
  showDueDate: false,
  showPaymentMethod: true,

  // Party Details
  showCustomerDetails: true,
  showCustomerAddress: true,
  showCustomerPhone: true,
  showCustomerGstin: true,
  showCustomerPan: false,
  showPlaceOfSupply: true,
  placeOfSupply: 'Karnataka',
  showShippingAddress: true,
  shippingAddress: 'Sample Shipping Company\nPlot No. 123, Industrial Area, Andheri East, Mumbai, MAHARASHTRA, 400001',

  // Item Table Columns
  showItemIndex: true,
  showItemName: true,
  showItemHSN: true,
  showItemSKU: false,
  showItemQty: true,
  showItemUom: true,
  showItemRate: true,
  showItemMrp: true,
  showItemBatch: true,
  showItemExpiry: true,
  showItemMfg: true,
  showItemDiscount: true,
  showItemTax: true,
  showItemTotal: true,

  // Totals & Summary
  showSubtotal: true,
  showOverallQty: true,
  showTotalDiscount: true,
  showYouSaved: true,
  showSavingsBanner: true,
  showTaxBreakdown: true,
  showRoundOff: true,
  showGrandTotal: true,
  showReceivedAndBalance: true,
  showAmountInWords: false,
  showLoyaltyPoints: false,
  showPaymentMode: true,
  showPaidInFullStamp: false,
  showQrCode: false,
  showGoogleReviewQR: false,
  googleReviewUrl: '',

  // Terms, Declaration & Footer
  showTermsAndConditions: true,
  termsAndConditionsText: '1. Goods once sold will not be taken back without original bill.\n2. Exchange valid within 7 days in original condition.',
  showDeclaration: true,
  declarationText: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
  showFooterNote: true,
  footerNote: 'Thank You For Shopping With Us!\nVisit Again • Have A Great Day',
  showSignature: false,
  showStamp: false,

  qrType: 'einvoice',
  upiId: '',
};

const STORAGE_KEY = 'bos_pos_active_receipt_templates_v1';

export interface ActiveGstDetails {
  company_id?: string;
  gstin: string;
  trade_name: string;
  legal_name: string;
  state_code: string;
  state_name: string;
  address: string;
  phone?: string;
  email?: string;
  cin?: string;
  pan?: string;
  logo_url?: string;
  google_review_url?: string | null;
  google_place_id?: string | null;
  google_review_enabled?: boolean;
  terms_and_conditions?: string | null;

  // Organization-level Document Numbering Prefixes
  invoice_prefix?: string | null;
  quotation_prefix?: string | null;
  estimate_prefix?: string | null;
  credit_note_prefix?: string | null;
  debit_note_prefix?: string | null;
  purchase_invoice_prefix?: string | null;
  purchase_order_prefix?: string | null;
  proforma_prefix?: string | null;
  challan_prefix?: string | null;
  receipt_prefix?: string | null;
  receipt_sequence?: number | null;
  receipt_padding?: number | null;

  // Organization-level Payment QR & Bank Details
  payment_qr_enabled?: boolean;
  payment_qr_type?: "dynamic_upi" | "razorpay" | "custom_image";
  payment_qr_custom_image_url?: string | null;
  upi_vpa?: string | null;
  upi_payee_name?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;

  // Organization-level Signature & Stamp
  signature_url?: string | null;
  stamp_url?: string | null;
  signature_title?: string | null;
  signature_company_name?: string | null;
  show_digital_signature?: boolean;
  show_digital_stamp?: boolean;
  signature_alignment?: "left" | "center" | "right";
}

export function getOrgSignatureSettings(tenantId?: string) {
  const active = getActiveBillingGst(tenantId);
  let storedSig: any = null;
  if (typeof window !== 'undefined') {
    const tid = tenantId || getTenantIdFromStorage();
    const raw = localStorage.getItem(`bos_signature_settings_${tid}`) || localStorage.getItem('bos_signature_settings');
    if (raw) {
      try { storedSig = JSON.parse(raw); } catch {}
    }
  }

  const companyName = active?.trade_name || active?.legal_name || 'Organization';

  return {
    signatureUrl: storedSig?.signatureUrl !== undefined ? storedSig.signatureUrl : (active?.signature_url || null),
    stampUrl: storedSig?.stampUrl !== undefined ? storedSig.stampUrl : (active?.stamp_url || null),
    signatureTitle: storedSig?.signatureTitle || active?.signature_title || "Authorized Signatory",
    signatureCompanyName: storedSig?.signatureCompanyName || active?.signature_company_name || `For ${companyName}`,
    showDigitalSignature: storedSig?.showDigitalSignature !== undefined ? storedSig.showDigitalSignature : (active?.show_digital_signature !== false),
    showDigitalStamp: storedSig?.showDigitalStamp !== undefined ? storedSig.showDigitalStamp : (active?.show_digital_stamp !== false),
    signatureAlignment: (storedSig?.signatureAlignment || active?.signature_alignment || "right") as "left" | "center" | "right",
  };
}

export function setOrgSignatureSettings(
  settings: {
    signature_url?: string | null;
    stamp_url?: string | null;
    signature_title?: string | null;
    signature_company_name?: string | null;
    show_digital_signature?: boolean;
    show_digital_stamp?: boolean;
    signature_alignment?: "left" | "center" | "right";
  },
  tenantId?: string
): void {
  if (typeof window === 'undefined') return;
  const tid = tenantId || getTenantIdFromStorage();
  const current = getActiveBillingGst(tid) || {
    gstin: '', trade_name: 'Organization', legal_name: 'Organization',
    state_code: '29', state_name: 'State', address: ''
  };
  const updated: ActiveGstDetails = {
    ...current,
    ...settings,
  };
  setActiveBillingGst(updated, tid);

  try {
    const sigPayload = {
      signatureUrl: settings.signature_url !== undefined ? settings.signature_url : current.signature_url,
      stampUrl: settings.stamp_url !== undefined ? settings.stamp_url : current.stamp_url,
      signatureTitle: settings.signature_title || current.signature_title || "Authorized Signatory",
      signatureCompanyName: settings.signature_company_name || current.signature_company_name || `For ${current.trade_name || 'Organization'}`,
      showDigitalSignature: settings.show_digital_signature !== false,
      showDigitalStamp: settings.show_digital_stamp !== false,
      signatureAlignment: settings.signature_alignment || current.signature_alignment || "right",
    };
    safeSetItem(`bos_signature_settings_${tid}`, JSON.stringify(sigPayload));
    safeSetItem('bos_signature_settings', JSON.stringify(sigPayload));
    window.dispatchEvent(new CustomEvent("bos-signature-settings-changed", { detail: sigPayload }));
  } catch {}
}

export function getOrgPaymentQrSettings(tenantId?: string) {
  const active = getActiveBillingGst(tenantId);
  let storedQr: any = null;
  if (typeof window !== 'undefined') {
    const tid = tenantId || getTenantIdFromStorage();
    const raw = localStorage.getItem(`bos_payment_qr_settings_${tid}`) || localStorage.getItem('bos_payment_qr_settings');
    if (raw) {
      try { storedQr = JSON.parse(raw); } catch {}
    }
  }

  return {
    enabled: storedQr?.enabled !== undefined ? storedQr.enabled : (active?.payment_qr_enabled !== false),
    type: (storedQr?.type || active?.payment_qr_type || "dynamic_upi") as "dynamic_upi" | "razorpay" | "custom_image",
    customImageUrl: storedQr?.customImageUrl || active?.payment_qr_custom_image_url || null,
    vpa: storedQr?.vpa || active?.upi_vpa || "",
    payeeName: storedQr?.payeeName || active?.upi_payee_name || active?.trade_name || active?.legal_name || "Merchant",
    bankName: active?.bank_name || "",
    accountNumber: active?.bank_account_number || "",
    ifsc: active?.bank_ifsc || "",
  };
}

export function setOrgPaymentQrSettings(
  settings: {
    payment_qr_enabled?: boolean;
    payment_qr_type?: "dynamic_upi" | "razorpay" | "custom_image";
    payment_qr_custom_image_url?: string | null;
    upi_vpa?: string | null;
    upi_payee_name?: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_ifsc?: string | null;
  },
  tenantId?: string
): void {
  if (typeof window === 'undefined') return;
  const tid = tenantId || getTenantIdFromStorage();
  const current = getActiveBillingGst(tid) || {
    gstin: '', trade_name: 'Organization', legal_name: 'Organization',
    state_code: '29', state_name: 'State', address: ''
  };
  const updated: ActiveGstDetails = {
    ...current,
    ...settings,
  };
  setActiveBillingGst(updated, tid);

  try {
    const qrPayload = {
      enabled: settings.payment_qr_enabled !== false,
      type: settings.payment_qr_type || "dynamic_upi",
      customImageUrl: settings.payment_qr_custom_image_url || null,
      vpa: settings.upi_vpa || "",
      payeeName: settings.upi_payee_name || current.trade_name || "Merchant",
    };
    safeSetItem(`bos_payment_qr_settings_${tid}`, JSON.stringify(qrPayload));
    safeSetItem('bos_payment_qr_settings', JSON.stringify(qrPayload));
  } catch {}
}

export function getOrgDocumentPrefix(
  docType: "TAX_INVOICE" | "QUOTATION" | "ESTIMATE_NON_GST" | "PROFORMA" | "CREDIT_NOTE" | "DEBIT_NOTE" | string,
  tenantId?: string
): string {
  const active = getActiveBillingGst(tenantId);
  const typeUpper = String(docType || "TAX_INVOICE").toUpperCase();

  if (typeUpper === "TAX_INVOICE" || typeUpper === "INVOICE" || typeUpper === "INVOICES") {
    return active?.invoice_prefix?.trim() || "INV";
  }
  if (typeUpper === "QUOTATION" || typeUpper === "QUOTE" || typeUpper === "QT") {
    return active?.quotation_prefix?.trim() || "QT";
  }
  if (typeUpper === "ESTIMATE_NON_GST" || typeUpper === "ESTIMATE" || typeUpper === "EST") {
    return active?.estimate_prefix?.trim() || "EST";
  }
  if (typeUpper === "PROFORMA" || typeUpper === "PROFORMA_INVOICE" || typeUpper === "PI") {
    return active?.proforma_prefix?.trim() || "PI";
  }
  if (typeUpper === "CHALLAN" || typeUpper === "DELIVERY_CHALLAN" || typeUpper === "DC" || typeUpper === "DELIVERY_NOTE") {
    return active?.challan_prefix?.trim() || "DC";
  }
  if (typeUpper === "CREDIT_NOTE" || typeUpper === "CN") {
    return active?.credit_note_prefix?.trim() || "CN";
  }
  if (typeUpper === "DEBIT_NOTE" || typeUpper === "DN") {
    return active?.debit_note_prefix?.trim() || "DN";
  }
  if (typeUpper === "PURCHASE_INVOICE" || typeUpper === "PINV" || typeUpper === "PO_INVOICE" || typeUpper === "VENDOR_BILL") {
    return active?.purchase_invoice_prefix?.trim() || "PINV";
  }
  if (typeUpper === "PURCHASE_ORDER" || typeUpper === "PO") {
    return active?.purchase_order_prefix?.trim() || "PO";
  }
  if (typeUpper === "RECEIPT" || typeUpper === "RECEIPTS" || typeUpper === "POS_RECEIPT" || typeUpper === "REC") {
    return active?.receipt_prefix?.trim() || "REC-";
  }

  return active?.invoice_prefix?.trim() || "INV";
}

export function setOrgDocumentPrefixes(
  prefixes: {
    invoice_prefix?: string;
    quotation_prefix?: string;
    estimate_prefix?: string;
    credit_note_prefix?: string;
    debit_note_prefix?: string;
    purchase_invoice_prefix?: string;
    purchase_order_prefix?: string;
    proforma_prefix?: string;
    challan_prefix?: string;
    receipt_prefix?: string;
    receipt_sequence?: number;
    receipt_padding?: number;
  },
  tenantId?: string
): void {
  if (typeof window === 'undefined') return;
  const tid = tenantId || getTenantIdFromStorage();
  const current = getActiveBillingGst(tid) || {
    gstin: '', trade_name: 'Organization', legal_name: 'Organization',
    state_code: '29', state_name: 'State', address: ''
  };
  const updated: ActiveGstDetails = {
    ...current,
    ...prefixes,
  };
  setActiveBillingGst(updated, tid);
}

export function getTenantIdFromStorage(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw = localStorage.getItem('bos-tenant');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.raw?.tenant_id || parsed?.tenant_id) return parsed.raw?.tenant_id || parsed.tenant_id;
      if (parsed?.id) return parsed.id;
    }
  } catch {}
  return 'default';
}

export function getCompanyIdFromStorage(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw = localStorage.getItem('bos-tenant');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id || parsed?.company_id || parsed?.raw?.id) {
        return parsed.id || parsed.company_id || parsed.raw?.id;
      }
    }
    const actComp = localStorage.getItem('bos_active_company');
    if (actComp) {
      try {
        const parsedComp = JSON.parse(actComp);
        return parsedComp.id || parsedComp;
      } catch {
        return actComp;
      }
    }
  } catch {}
  return 'default';
}

const INVALID_COMPANY_NAMES = new Set([
  'individual / proprietorship',
  'proprietorship',
  'partnership',
  'private limited company',
  'public limited company',
  'limited liability partnership',
  'society/ club/ trust/ aop',
  'government department',
  'public sector undertaking',
  'unlimited company',
  'organization',
  'company',
  'default company',
  'head office',
  'venatic',
  'businessos store',
  'store',
]);

export function isGenericBusinessTerm(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim().toLowerCase();
  return INVALID_COMPANY_NAMES.has(clean) || clean.startsWith('individual /') || clean === 'organization' || clean === 'company' || clean === 'default company' || clean === 'head office' || clean === 'venatic';
}

export function getActiveBillingGst(tenantId?: string, companyId?: string): ActiveGstDetails | null {
  if (typeof window === 'undefined') return null;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const activeCid = companyId || (typeof window !== 'undefined' ? localStorage.getItem('bos_active_company_id') : null);

    // 0. Authenticated session tenant from bos-tenant
    let sessionTenant: any = null;
    const tenantRaw = localStorage.getItem('bos-tenant');
    if (tenantRaw) {
      try { sessionTenant = JSON.parse(tenantRaw); } catch {}
    }

    const raw = sessionTenant?.raw || {};
    const settings = raw.settings || sessionTenant?.settings || {};

    const tenantAddress = (
      sessionTenant?.address ||
      raw.address ||
      settings.address ||
      [raw.city || settings.city || sessionTenant?.city, raw.state || settings.state || sessionTenant?.state, raw.country || settings.country || sessionTenant?.country, raw.pincode || raw.postal_code || settings.pincode || sessionTenant?.pincode].filter(Boolean).join(', ')
    ).trim();

    const isDummyAddress = (addr?: string | null): boolean => {
      if (!addr || !addr.trim()) return true;
      const lower = addr.toLowerCase().trim();
      if (
        lower.includes('kk street') ||
        lower.includes('123 commercial hub') ||
        lower.includes('mandi road, proddatur') ||
        lower.includes('apmc yard') ||
        lower.includes('main market, proddatur') ||
        lower.includes('hospital road, proddatur') ||
        lower.includes('cauvery block') ||
        lower.includes('national games village')
      ) {
        return true;
      }
      if (lower.includes('proddatur') && !tenantAddress.toLowerCase().includes('proddatur')) {
        return true;
      }
      return false;
    };

    const fallbackName = (!isGenericBusinessTerm(sessionTenant?.name) ? sessionTenant?.name : '') || 
                         (!isGenericBusinessTerm(sessionTenant?.raw?.name) ? sessionTenant?.raw?.name : '') || 
                         'Workspace';

    // Scoped Active Company in localStorage for this specific tenant & company
    let activeComp: any = null;
    const activeCompanyRaw =
      (tid && activeCid ? localStorage.getItem(`bos_active_company_${tid}_${activeCid}`) : null) ||
      (tid ? localStorage.getItem(`bos_active_company_${tid}`) : null) ||
      localStorage.getItem('bos_active_company');
    if (activeCompanyRaw) {
      try { activeComp = JSON.parse(activeCompanyRaw); } catch {}
    }

    const compAddress = (activeComp?.address || [activeComp?.city, activeComp?.state, activeComp?.country, activeComp?.pincode].filter(Boolean).join(', ') || '').trim();

    // 1. Prioritize active company so company switch is instantaneous with zero stale snapshot bleed
    if (activeComp && !isGenericBusinessTerm(activeComp.name)) {
      const activeReg = activeComp.gst_registrations?.find((r: any) => r.is_primary) || activeComp.gst_registrations?.[0];
      const gstin = activeReg?.gstin || activeComp.gst_number || activeComp.gstin || '';
      const stateCode = activeReg?.state_code || (gstin ? gstin.slice(0, 2) : '29');
      const compTrade = !isGenericBusinessTerm(activeReg?.trade_name) ? activeReg?.trade_name : (!isGenericBusinessTerm(activeComp.name) ? activeComp.name : fallbackName);
      const compLegal = !isGenericBusinessTerm(activeComp.legal_name) ? activeComp.legal_name : compTrade;
      const regAddress = activeReg?.address || compAddress || tenantAddress || '';

      return {
        gstin,
        trade_name: compTrade,
        legal_name: compLegal,
        state_code: stateCode,
        state_name: activeReg?.state_name || activeComp.state || 'State',
        address: !isDummyAddress(regAddress) ? regAddress : (tenantAddress || ''),
        phone: activeComp.phone || sessionTenant?.phone || '',
        email: activeComp.email || sessionTenant?.email || '',
        cin: activeComp.registration_number || '',
        pan: activeComp.pan_number || '',
        logo_url: activeComp.logo_url || null,
        google_review_url: activeComp.google_review_url || null,
        google_place_id: activeComp.google_place_id || null,
        google_review_enabled: activeComp.google_review_enabled !== false,
        terms_and_conditions: activeComp.terms_and_conditions || null,
      };
    }

    // 2. Scoped Active Billing GST details snapshot fallback
    const storedGstRaw =
      (tid && activeCid ? localStorage.getItem(`bos_active_billing_gst_details_${tid}_${activeCid}`) : null) ||
      (tid ? localStorage.getItem(`bos_active_billing_gst_details_${tid}`) : null);
    if (storedGstRaw) {
      const parsed = JSON.parse(storedGstRaw);
      if (parsed && (parsed.trade_name || parsed.gstin || parsed.logo_url || parsed.google_review_url || parsed.terms_and_conditions || parsed.address)) {
        const resolvedTradeName = !isGenericBusinessTerm(parsed.trade_name) ? parsed.trade_name : (!isGenericBusinessTerm(activeComp?.name) ? activeComp.name : fallbackName);
        const resolvedLegalName = !isGenericBusinessTerm(parsed.legal_name) ? parsed.legal_name : (!isGenericBusinessTerm(activeComp?.legal_name) ? activeComp.legal_name : resolvedTradeName);
        
        const rawAddr = parsed.address;
        const resolvedAddress = (!isDummyAddress(rawAddr) ? rawAddr : '') || (!isDummyAddress(compAddress) ? compAddress : '') || (!isDummyAddress(tenantAddress) ? tenantAddress : '') || (rawAddr || compAddress || tenantAddress || '');

        return {
          ...parsed,
          trade_name: resolvedTradeName,
          legal_name: resolvedLegalName,
          address: resolvedAddress,
          phone: parsed.phone || activeComp?.phone || raw.phone || settings.phone || sessionTenant?.phone || '',
          email: parsed.email || activeComp?.email || raw.email || settings.email || sessionTenant?.email || '',
          terms_and_conditions: parsed.terms_and_conditions || activeComp?.terms_and_conditions || null,
        };
      }
    }

    // 3. Fallback: Authenticated session tenant from bos-tenant
    if (sessionTenant && (sessionTenant.name || sessionTenant.id)) {
      const gstin = raw.gstin || raw.gst_number || settings.gstin || settings.gst_number || '';
      const stateCode = gstin ? gstin.slice(0, 2) : (settings.state_code || raw.state_code || '29');
      const tTrade = !isGenericBusinessTerm(sessionTenant.name) ? sessionTenant.name : (!isGenericBusinessTerm(raw.trade_name) ? raw.trade_name : (!isGenericBusinessTerm(raw.name) ? raw.name : 'Workspace'));
      const tLegal = !isGenericBusinessTerm(raw.legal_name) ? raw.legal_name : tTrade;

      return {
        gstin,
        trade_name: tTrade,
        legal_name: tLegal,
        state_code: stateCode,
        state_name: settings.state || raw.state || 'State',
        address: !isDummyAddress(tenantAddress) ? tenantAddress : '',
        phone: raw.phone || settings.phone || sessionTenant.phone || '',
        email: raw.email || settings.email || sessionTenant.email || '',
        cin: raw.cin || raw.registration_number || settings.cin || '',
        pan: raw.pan || raw.pan_number || settings.pan || '',
        logo_url: sessionTenant.logo_url || raw.logo_url || null,
        google_review_url: raw.google_review_url || settings.google_review_url || null,
        google_place_id: raw.google_place_id || settings.google_place_id || null,
        google_review_enabled: raw.google_review_enabled !== false && settings.google_review_enabled !== false,
        terms_and_conditions: settings.terms_and_conditions || raw.terms_and_conditions || null,
      };
    }
  } catch (err) {
    console.error('Error resolving active billing GST:', err);
  }
  return null;
}

export function clearActiveBillingGst(tenantId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    if (tid) {
      localStorage.removeItem(`bos_active_billing_gst_details_${tid}`);
      localStorage.removeItem(`bos_active_billing_gstin_${tid}`);
      localStorage.removeItem(`bos_active_billing_gst_${tid}`);
    }
    localStorage.removeItem('bos_active_billing_gst_details');
    localStorage.removeItem('bos_active_billing_gstin');
    localStorage.removeItem('bos_active_billing_gst');
    window.dispatchEvent(new CustomEvent('bos-active-gst-changed', { detail: null }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error clearing active billing GST:', err);
  }
}

export function setActiveBillingGst(details: Partial<ActiveGstDetails>, tenantId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    let existing: any = {};
    try {
      const raw = localStorage.getItem(`bos_active_billing_gst_details_${tid}`);
      if (raw) existing = JSON.parse(raw);
    } catch {}

    // If switching to a different company, don't inherit old company's address, GSTIN, etc.
    const isDifferentCompany = Boolean(
      (details.company_id && existing.company_id && details.company_id !== existing.company_id) ||
      (details.trade_name && existing.trade_name && details.trade_name.toLowerCase().trim() !== existing.trade_name.toLowerCase().trim())
    );

    const base = isDifferentCompany ? {} : existing;
    const merged = { ...base, ...details };
    merged.gstin = details.gstin !== undefined ? (details.gstin || '') : (isDifferentCompany ? '' : (existing.gstin || ''));
    merged.address = details.address !== undefined ? (details.address || '') : (isDifferentCompany ? '' : (existing.address || ''));
    merged.phone = details.phone !== undefined ? (details.phone || '') : (isDifferentCompany ? '' : (existing.phone || ''));
    merged.email = details.email !== undefined ? (details.email || '') : (isDifferentCompany ? '' : (existing.email || ''));

    safeSetItem(`bos_active_billing_gst_details_${tid}`, JSON.stringify(merged));
    safeSetItem(`bos_active_billing_gstin_${tid}`, merged.gstin);
    window.dispatchEvent(new CustomEvent('bos-active-gst-changed', { detail: merged }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error saving active billing GST:', err);
  }
}

// ── Bulletproof template storage helpers ─────────────────────────────────
// The print-template store (businessos_print_templates_v1*) is the one
// localStorage surface that historically crashed the app on save via
// QuotaExceededError and silently lost every user customization. These helpers
// guarantee that a save NEVER throws:
//   - prunedTemplatesFromRaw(): every template-list read is deduped, sorted by
//     `updated_at` desc, capped at 15 entries, and base64-sanitized.
//   - purgeStalePrintTemplates(): one-time sweep of legacy / bloat keys.
//   - savePrintTemplateSafe(): upsert a single template into the stored list.
//   - ACTIVE_DOC_TEMPLATE_KEYS + get/setActiveDocTemplateId: per-document-category
//     active-template key mapping (tenant-suffixed variants included).

let hasPurgedStalePrintTemplates = false;

/**
 * Read a stored print-template list and normalize it through
 * `pruneTemplateList` (dedupe by id → name, sort by `updated_at` desc, cap at
 * 15, strip oversized base64). Corrupt / missing / non-array storage yields
 * an empty list instead of a throw.
 */
function prunedTemplatesFromRaw(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? pruneTemplateList(parsed) : [];
  } catch {
    return [];
  }
}

/** Read the per-tenant active-template id map (user_active_print_templates_v1*). */
function readActiveDefaults(key?: string | null): Record<string, any> {
  if (!key || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Run the stale-key sweep at most once per session (lazy, silent). */
function ensurePurgeStalePrintTemplates(): void {
  if (!hasPurgedStalePrintTemplates) {
    hasPurgedStalePrintTemplates = true;
    purgeStalePrintTemplates();
  }
}

/**
 * Purge stale / bloated print-template localStorage keys:
 *   - `businessos_print_templates` (legacy v0 list),
 *   - `bos_temp_pdf_overlay` (one-shot PDF-overlay bloat cache),
 *   - any other key matching /print_templates/i that is NOT a current
 *     `businessos_print_templates_v1*` or `user_active_print_templates_v1*` key.
 * Idempotent, silent, and safe on the server (SSR).
 */
export function purgeStalePrintTemplates(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  hasPurgedStalePrintTemplates = true;
  try {
    safeRemoveItem("businessos_print_templates");
    safeRemoveItem("bos_temp_pdf_overlay");

    const currentPrefixes = [
      "businessos_print_templates_v1",
      "user_active_print_templates_v1",
    ];
    const staleKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/print_templates/i.test(k)) continue;
      if (currentPrefixes.some((p) => k.startsWith(p))) continue;
      staleKeys.push(k);
    }
    for (const k of staleKeys) safeRemoveItem(k);
  } catch {
    // Silent — a storage sweep must never break a render.
  }
}

/**
 * Upsert a single print template into the active tenant's stored template list
 * (replace on same `id`, otherwise push), then prune, sanitize, and write via
 * `safeSetItem` so a QuotaExceededError can never crash the app.
 * Returns `true` only when the write actually landed in localStorage.
 */
export function savePrintTemplateSafe(tpl: any, tenantId?: string): boolean {
  if (typeof window === "undefined" || !tpl || typeof tpl !== "object" || !tpl.id) return false;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const key = getTenantTemplatesKey(tid);
    const list = prunedTemplatesFromRaw(localStorage.getItem(key));

    const entry = { ...tpl, updatedAt: new Date().toISOString() };
    const idx = list.findIndex((t: any) => t && t.id === entry.id);
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);

    const ok = safeSetItem(key, JSON.stringify(pruneTemplateList(list)));
    if (ok) {
      window.dispatchEvent(new Event("print_templates_updated"));
      window.dispatchEvent(new Event("storage"));
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * Per-document-category ACTIVE template key mapping. Every category key has a
 * tenant-suffixed variant (`<key>_<tid>`) and, when a company is active, a
 * company-suffixed variant (`<key>_<tid>_<cid>`) — the same pattern the
 * invoice key already uses in get/setActiveInvoicePrintTemplate.
 */
export const ACTIVE_DOC_TEMPLATE_KEYS: Record<string, string> = {
  invoice: "bos_active_invoice_template_id",
  quotation: "bos_active_quotation_template_id",
  proforma: "bos_active_proforma_template_id",
  estimate: "bos_active_estimate_template_id",
  challan: "bos_active_challan_template_id",
  credit_note: "bos_active_credit_note_template_id",
  debit_note: "bos_active_debit_note_template_id",
  purchase_invoice: "bos_active_purchase_invoice_template_id",
  purchase_order: "bos_active_purchase_order_template_id",
  // "Custom Document" slot on the Print & Document Templates strip — device-local,
  // lives in the SAME key family so it can never diverge from the others.
  custom: "bos_active_custom_doc_template_id",
};

/** Set the active template id for a document category (tenant + company suffixed). */
export function setActiveDocTemplateId(
  category: string,
  templateId: string,
  tenantId?: string,
  companyId?: string,
): void {
  if (typeof window === "undefined" || !category || !templateId) return;
  const base = ACTIVE_DOC_TEMPLATE_KEYS[category];
  if (!base) return;
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || localStorage.getItem("bos_active_company_id");
  if (cid) {
    safeSetItem(`${base}_${tid}_${cid}`, templateId);
  } else {
    safeSetItem(`${base}_${tid}`, templateId);
  }
  // Keep the strip's category-slot key in lockstep so the two key families
  // (ACTIVE_DOC_TEMPLATE_KEYS and bos_active_invoice_category_template_*) can
  // never diverge — resolution reads both.
  try {
    ensurePurgeStalePrintTemplates();
    safeSetItem(getInvoiceCategoryActiveKey(tid, cid, category), templateId);
    // When a specific category template is assigned, automatically mark it unlinked from master
    if (category !== "invoice") {
      if (cid) {
        safeSetItem(getInvoiceCategoryLinkKey(tid, cid, category), "unlinked");
      } else {
        safeSetItem(getInvoiceCategoryLinkKey(tid, null, category), "unlinked");
      }
    }
  } catch {}
}

/** Clear the active template id for a document category (tenant + company variants). */
export function safeRemoveTenantDocTemplateId(
  category: string,
  tenantId?: string,
  companyId?: string,
): void {
  if (typeof window === "undefined" || !category) return;
  const base = ACTIVE_DOC_TEMPLATE_KEYS[category];
  if (!base) return;
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || localStorage.getItem("bos_active_company_id");
  if (cid) {
    safeRemoveItem(`${base}_${tid}_${cid}`);
    safeRemoveItem(getInvoiceCategoryActiveKey(tid, cid, category));
  } else {
    safeRemoveItem(`${base}_${tid}`);
    safeRemoveItem(getInvoiceCategoryActiveKey(tid, null, category));
  }
}

/** Read the active template id for a document category (company variant first, then tenant variant). */
export function getActiveDocTemplateId(
  category: string,
  tenantId?: string,
  companyId?: string,
): string | null {
  if (typeof window === "undefined" || !category) return null;
  const base = ACTIVE_DOC_TEMPLATE_KEYS[category];
  if (!base) return null;
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || localStorage.getItem("bos_active_company_id");
  try {
    if (cid) {
      return (
        localStorage.getItem(`${base}_${tid}_${cid}`) ||
        localStorage.getItem(getInvoiceCategoryActiveKey(tid, cid, category)) ||
        null
      );
    }
    return (
      localStorage.getItem(`${base}_${tid}`) ||
      localStorage.getItem(getInvoiceCategoryActiveKey(tid, null, category)) ||
      null
    );
  } catch {
    return null;
  }
}

export function getActiveReceiptTemplate(tenantId?: string): ReceiptTemplate {
  const tid = tenantId || getTenantIdFromStorage();
  const activeGst = getActiveBillingGst(tid);

  if (typeof window !== 'undefined') {
    try {
      const tplKey = getTenantTemplatesKey(tid);
      const defKey = getTenantDefaultsKey(tid);
      // Strictly workspace-scoped template storage — never fall back to the
      // unsuffixed global keys, which hold templates from other tenants.
      ensurePurgeStalePrintTemplates();
      const invTemplatesRaw = tid ? localStorage.getItem(tplKey) : null;

      if (invTemplatesRaw) {
        const invTemplates = pruneTemplateList(JSON.parse(invTemplatesRaw));
        const activeDefaults = readActiveDefaults(tid ? defKey : null);

        const activeThermalId =
          (tid ? localStorage.getItem(`bos_active_receipt_template_id_${tid}`) : null) ||
          (tid ? localStorage.getItem(`bos_active_thermal_template_id_${tid}`) : null) ||
          activeDefaults.thermal ||
          activeDefaults.receipt;
        let matched = activeThermalId ? invTemplates.find((t: any) => t.id === activeThermalId) : null;

        if (!matched) {
          matched = invTemplates.find((t: any) => (t.category === 'thermal' || t.docType === 'thermal') && t.isDefault) ||
                    invTemplates.find((t: any) => t.category === 'thermal' || t.docType === 'thermal');
        }

        if (matched) {
          const fields = matched.fields || {};
          const isDummyAddress = (addr?: string | null): boolean => {
            if (!addr || !addr.trim()) return true;
            const lower = addr.toLowerCase().trim();
            return lower.includes('kk street') || lower.includes('123 commercial hub') || lower.includes('mandi road, proddatur') || lower.includes('apmc yard') || lower.includes('main market, proddatur') || lower.includes('hospital road, proddatur') || (lower.includes('proddatur') && !activeGst?.address?.toLowerCase().includes('proddatur'));
          };
          const isDummyPhone = (ph?: string | null): boolean => {
            if (!ph || !ph.trim()) return true;
            return ph.includes('9849344919') && !activeGst?.phone?.includes('9849344919');
          };
          const isDummyGstin = (gst?: string | null): boolean => {
            if (!gst || !gst.trim()) return true;
            return (gst.includes('37AABCCH694G1Z4') || gst.includes('37AAFCOE694G1Z4') || gst.includes('37AAFC16694B1Z4')) && !activeGst?.gstin?.includes(gst);
          };

          const resolvedAddress = activeGst?.address || (!isDummyAddress(matched.storeAddress) ? matched.storeAddress : '');
          const resolvedPhone = activeGst?.phone || (!isDummyPhone(matched.storePhone) ? matched.storePhone : '');
          const resolvedGstin = activeGst?.gstin || (!isDummyGstin(matched.gstin) ? matched.gstin : '');
          const resolvedBranch = (matched.branchName && !matched.branchName.toUpperCase().includes('PRODDATUR')) ? matched.branchName : '';

          // Live master-link: while the receipt is linked, the master invoice
          // template's mappable settings (words, signature/stamp, UPI/payee,
          // custom fields & columns, terms/footer, bank) flow through here.
          // The receipt's own layout, toggles & paper size are unchanged.
          const linked = getLinkedMaster(matched, tid);

          return {
            ...matched,
            ...linked,
            id: matched.id,
            name: matched.name || 'Organization Active Print Template',
            isDefault: true,
            paperSize: matched.paperSize === '58mm' ? '58mm' : '80mm',
            fontDensity: matched.fontDensity || 'normal',
            printClarity: matched.printClarity || matched.thermalContrast || 'ultra_dark',
            dividerStyle: matched.dividerStyle || 'dashed',
            fontFamily: matched.thermalFontFamily || matched.fontFamily || 'monospace',
            storeName: activeGst?.trade_name || activeGst?.legal_name || (!isGenericBusinessTerm(linked.storeName) && !linked.storeName?.includes('Smart Bazaar') ? linked.storeName : '') || 'Store',
            branchName: resolvedBranch,
            headerTagline: linked.customTaglineText || linked.headerTagline || '',
            invoiceTitle: matched.headerTitle || 'TAX INVOICE',
            address: resolvedAddress,
            phone: resolvedPhone,
            email: activeGst?.email || linked.storeEmail || '',
            gstin: resolvedGstin,
            cin: activeGst?.cin || linked.cin || '',
            logoUrl: activeGst?.logo_url || linked.logoUrl || '',

            // Merged editable label words (master < local) — drives the receipt
            // renderer's label resolver and the receipt Texts & Labels editor.
            texts: linked.texts || matched.texts || {},
            customTexts: linked.customTexts || matched.customTexts || {},

            customFields: linked.customFields || [],
            customItemColumns: linked.customItemColumns || [],
            showPaidInFullStamp: matched.showPaidInFullStamp !== false,
            showGoogleReviewQR: matched.showGoogleReviewQR !== false,
            googleReviewUrl: linked.googleReviewUrl || activeGst?.google_review_url || '',
            upiId: linked.upiId || activeGst?.upi_vpa || '',
            payeeName: linked.payeeName || '',
            customQrUrl: linked.customQrUrl || '',
            showSignature: matched.showSignature !== false,
            showStamp: matched.showStamp !== false,
            signatureUrl: linked.signatureUrl || activeGst?.signature_url || '',
            stampUrl: linked.stampUrl || activeGst?.stamp_url || '',
            signatoryLabel: linked.signatoryLabel || matched.signatoryLabel || '',
            bankDetails: linked.bankDetails || matched.bankDetails || '',

            fields: {
              ...(matched.fields || {}),
              showLogo: fields.showLogo !== false,
              showStoreAddress: fields.showStoreAddress !== false,
              showStoreContact: fields.showStoreContact !== false,
              showTaxId: fields.showTaxSplit !== false || fields.showTaxId !== false,
              showCustomerDetails: fields.showCustomerDetails !== false,
              showItemHSN: fields.showHSN !== false,
              showItemDiscount: fields.showDiscountBadge !== false,
              showTaxBreakdown: fields.showTaxSplit !== false,
              showLoyaltyPoints: true,
              showPaymentMode: fields.showPaymentDetails !== false,
              showQR: fields.showQR !== false,
              showQrCode: fields.showQR !== false,
              showGoogleReviewQR: matched.showGoogleReviewQR !== false,
              showPaidInFullStamp: matched.showPaidInFullStamp !== false,
              showDeclaration: matched.showDeclaration !== false,
            },

            showLogo: fields.showLogo !== false,
            showStoreAddress: fields.showStoreAddress !== false,
            showTaxId: fields.showTaxSplit !== false || fields.showTaxId !== false,
            showCustomerDetails: fields.showCustomerDetails !== false,
            showItemHSN: fields.showHSN !== false,
            showItemDiscount: fields.showDiscountBadge !== false,
            showTaxBreakdown: fields.showTaxSplit !== false,
            showLoyaltyPoints: true,
            showPaymentMode: fields.showPaymentDetails !== false,
            showQR: fields.showQR !== false,
            showQrCode: fields.showQR !== false,
            showDeclaration: matched.showDeclaration !== false,
            showFooterNote: Boolean(matched.footerText),

            declarationText: matched.declarationText || matched.termsText || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
            footerNote: matched.footerText || matched.thankYouNote || 'THANK YOU FOR SHOPPING WITH US!\nVISIT AGAIN',
            qrType: matched.qrType || 'upi',
          };
        }
      }
    } catch (e) {
      console.error('Error loading inventory active print template:', e);
    }
  }

  const templates = getStoredReceiptTemplates(tid);
  const active = templates.find((t) => t.isDefault) || templates[0] || DEFAULT_RECEIPT_TEMPLATE;

  if (activeGst) {
    return {
      ...active,
      storeName: activeGst.trade_name || activeGst.legal_name || active.storeName,
      address: activeGst.address || active.address,
      phone: activeGst.phone || active.phone,
      email: activeGst.email || active.email,
      gstin: activeGst.gstin || active.gstin,
      cin: activeGst.cin || active.cin,
      logoUrl: activeGst.logo_url || active.logoUrl || '',
      googleReviewUrl: activeGst.google_review_url || active.googleReviewUrl || '',
      showGoogleReviewQR: activeGst.google_review_enabled === true,
    };
  }

  return active;
}

export function getResolvedActiveThermalTemplate(tenantId?: string): any {
  const tid = tenantId || getTenantIdFromStorage();
  const activeGst = getActiveBillingGst(tid);

  if (typeof window !== 'undefined') {
    try {
      const tplKey = getTenantTemplatesKey(tid);
      const defKey = getTenantDefaultsKey(tid);
      // Strictly workspace-scoped template storage — no unsuffixed global fallbacks
      ensurePurgeStalePrintTemplates();
      const rawTemplates = tid ? (localStorage.getItem(tplKey) || localStorage.getItem(`businessos_print_templates_v1_${tid}`)) : null;
      const rawDefaults = tid ? (localStorage.getItem(defKey) || localStorage.getItem(`user_active_print_templates_v1_${tid}`) || localStorage.getItem(`businessos_active_template_ids_${tid}`)) : null;

      if (rawTemplates) {
        const templates = pruneTemplateList(JSON.parse(rawTemplates));
        const defaults = rawDefaults ? JSON.parse(rawDefaults) : {};
        const activeThermalId =
          (tid ? localStorage.getItem(`bos_active_receipt_template_id_${tid}`) : null) ||
          (tid ? localStorage.getItem(`bos_active_thermal_template_id_${tid}`) : null) ||
          defaults.thermal ||
          defaults.receipt ||
          defaults.invoices;

        let matched = templates.find((t: any) => t.id === activeThermalId);
        if (!matched) {
          matched =
            templates.find((t: any) => (t.category === 'thermal' || t.docType === 'thermal') && t.isDefault) ||
            templates.find((t: any) => t.category === 'thermal' || t.docType === 'thermal') ||
            templates[0];
        }
        if (matched) {
          const isDummyAddress = (addr?: string | null): boolean => {
            if (!addr || !addr.trim()) return true;
            const lower = addr.toLowerCase().trim();
            return lower.includes('kk street') || lower.includes('123 commercial hub') || lower.includes('mandi road, proddatur') || lower.includes('apmc yard') || lower.includes('main market, proddatur') || lower.includes('hospital road, proddatur') || (lower.includes('proddatur') && !activeGst?.address?.toLowerCase().includes('proddatur'));
          };
          const isDummyPhone = (ph?: string | null): boolean => {
            if (!ph || !ph.trim()) return true;
            return ph.includes('9849344919') && !activeGst?.phone?.includes('9849344919');
          };
          const isDummyGstin = (gst?: string | null): boolean => {
            if (!gst || !gst.trim()) return true;
            return (gst.includes('37AABCCH694G1Z4') || gst.includes('37AAFCOE694G1Z4') || gst.includes('37AAFC16694B1Z4')) && !activeGst?.gstin?.includes(gst);
          };

          const cleanAddress = isDummyAddress(matched.storeAddress) ? '' : (matched.storeAddress || '');
          const cleanPhone = isDummyPhone(matched.storePhone) ? '' : (matched.storePhone || '');
          const cleanGstin = isDummyGstin(matched.gstin) ? '' : (matched.gstin || '');
          const cleanBranch = (matched.branchName && !matched.branchName.toUpperCase().includes('PRODDATUR')) ? matched.branchName : '';

          // Live master-link: while linked, mappable settings follow the master
          // invoice template; unlinked templates keep only their own values.
          const linked = getLinkedMaster(matched, tid);
          if (activeGst) {
            return {
              ...linked,
              storeName: activeGst.trade_name || activeGst.legal_name || (!isGenericBusinessTerm(linked.storeName) && !linked.storeName?.includes('Smart Bazaar') ? linked.storeName : '') || 'Store',
              branchName: cleanBranch,
              storeAddress: activeGst.address || cleanAddress,
              storePhone: activeGst.phone || cleanPhone,
              storeEmail: activeGst.email || linked.storeEmail || '',
              gstin: activeGst.gstin || cleanGstin,
              cin: activeGst.cin || linked.cin || '',
              logoUrl: activeGst.logo_url || (activeGst.trade_name ? '' : linked.logoUrl) || '',
            };
          }

          return {
            ...linked,
            branchName: cleanBranch,
            storeAddress: cleanAddress,
            storePhone: cleanPhone,
            gstin: cleanGstin,
          };
        }
      }
    } catch (e) {
      console.error('Error loading resolved active thermal template:', e);
    }
  }

  return null;
}


export function getTenantTemplatesKey(tenantId?: string): string {
  if (typeof window === 'undefined') return 'businessos_print_templates_v1';
  // Canonical suffix source: always agree with getTenantIdFromStorage() (the
  // suffix used by every active-template key), otherwise an active template
  // id can't be resolved against the tenant's template list and printers
  // silently fall back to the Word stub.
  let tid = tenantId || getTenantIdFromStorage();
  if (tid === 'default') {
    try {
      const activeComp = localStorage.getItem('bos_active_company') || localStorage.getItem('bos-active-company');
      if (activeComp) tid = activeComp;
      if (!tid || tid === 'default') {
        const authRaw = localStorage.getItem('bos-auth');
        if (authRaw) {
          const authParsed = JSON.parse(authRaw);
          tid = authParsed?.user?.tenantId || authParsed?.user?.tenant_id || authParsed?.user?.tenantSlug;
        }
      }
      if (!tid || tid === 'default') {
        const raw = localStorage.getItem('bos-tenant');
        if (raw) {
          const parsed = JSON.parse(raw);
          tid = parsed?.id || parsed?.slug;
        }
      }
    } catch {}
  }
  return `businessos_print_templates_v1_${tid || 'default'}`;
}

export function getTenantDefaultsKey(tenantId?: string): string {
  if (typeof window === 'undefined') return 'user_active_print_templates_v1';
  // Same canonical suffix source as getTenantTemplatesKey / getTenantIdFromStorage.
  let tid = tenantId || getTenantIdFromStorage();
  if (tid === 'default') {
    try {
      const activeComp = localStorage.getItem('bos_active_company') || localStorage.getItem('bos-active-company');
      if (activeComp) tid = activeComp;
      if (!tid || tid === 'default') {
        const authRaw = localStorage.getItem('bos-auth');
        if (authRaw) {
          const authParsed = JSON.parse(authRaw);
          tid = authParsed?.user?.tenantId || authParsed?.user?.tenant_id || authParsed?.user?.tenantSlug;
        }
      }
      if (!tid || tid === 'default') {
        const raw = localStorage.getItem('bos-tenant');
        if (raw) {
          const parsed = JSON.parse(raw);
          tid = parsed?.id || parsed?.slug;
        }
      }
    } catch {}
  }
  return `user_active_print_templates_v1_${tid || 'default'}`;
}

export const DEFAULT_BARCODE_TEMPLATES = [
  {
    id: "tpl-bar-mybillbook",
    name: "myBillBook Clean Barcode (50x25mm Dual)",
    category: "barcodes",
    description: "Exact myBillBook standard 50x25mm / 2-up thermal roll barcode tag with centered Business Name, Item Code, Item Name, and SP/MRP pricing.",
    isDefault: true,
    paperSize: "50x25mm",
    layout: "1up",
    barcodeFormat: "Code-128",
    primaryColor: "#000000",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "mybillbook_clean",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
    elementSettings: {
      header: { fontSize: 11, fontWeight: "700", textAlign: "center" },
      sku: { fontSize: 9, fontWeight: "700", textAlign: "center" },
      productName: { fontSize: 9.5, fontWeight: "700", textAlign: "center" },
      priceSp: { fontSize: 9.5, fontWeight: "700", textAlign: "center" },
      priceMrp: { fontSize: 9, fontWeight: "600", textAlign: "center" },
    },
    elements: [
      {
        id: "el_company",
        type: "companyName",
        label: "Store / Business Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10.5,
        fontWeight: "700",
        textAlign: "center",
        color: "#000000",
        marginBottom: 1,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Barcode Graphic",
        visible: true,
        height: 22,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Item Code / SKU",
        visible: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 8.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        prefix: "",
        marginBottom: 1,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Item Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Selling Price",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        prefix: "SP: ",
        badgeStyle: "none",
        marginBottom: 0,
      },
    ],
  },
  {
    id: "tpl-bar-mybillbook-dual",
    name: "myBillBook 2-Up Dual Roll (100x25mm)",
    category: "barcodes",
    description: "Exact myBillBook standard 2-across dual thermal roll (100x25mm) with Store Name, Barcode Graphic, Item Code, Product Name, and SP Pricing.",
    isDefault: false,
    paperSize: "100x25mm",
    layout: "2up",
    barcodeFormat: "Code-128",
    primaryColor: "#000000",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "mybillbook_clean",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: false,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: false,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
    elements: [
      {
        id: "el_company",
        type: "companyName",
        label: "Store / Business Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: "700",
        textAlign: "center",
        color: "#000000",
        marginBottom: 1,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Barcode Graphic",
        visible: true,
        height: 20,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Item Code / SKU",
        visible: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 8.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        prefix: "",
        marginBottom: 1,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Item Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Selling Price",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        prefix: "SP: ",
        badgeStyle: "none",
        marginBottom: 0,
      },
    ],
  },
  {
    id: "tpl-bar-trendy-offer",
    name: "Trendy Retail Tag (Centered SP & MRP)",
    category: "barcodes",
    description: "Apparel & retail dual/single tag with centered Store Name, Product Name, and inline OFFER & M.R.P. pricing.",
    isDefault: false,
    paperSize: "50x25mm",
    layout: "1up",
    barcodeFormat: "Code-128",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "OFFER: ",
    mrpPrefix: "M.R.P. ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "trendy_offer",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
    elements: [
      {
        id: "el_company",
        type: "companyName",
        label: "Store Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10.5,
        fontWeight: "900",
        textAlign: "center",
        color: "#0f172a",
        textTransform: "uppercase",
        marginBottom: 1,
      },
      {
        id: "el_divider",
        type: "divider",
        label: "Divider Line",
        visible: true,
        height: 1,
        color: "#cbd5e1",
        marginBottom: 2,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Product Title",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        fontWeight: "900",
        textAlign: "center",
        color: "#020617",
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Selling Price (SP)",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: "900",
        textAlign: "center",
        color: "#020617",
        prefix: "OFFER: ",
        badgeStyle: "none",
        marginBottom: 1,
      },
      {
        id: "el_mrp",
        type: "mrp",
        label: "MRP",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9.5,
        fontWeight: "900",
        textAlign: "center",
        color: "#020617",
        prefix: "M.R.P. ",
        showStrike: false,
        marginBottom: 1,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Barcode Graphic",
        visible: true,
        height: 25,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Barcode Code",
        visible: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 8.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        prefix: "",
        marginBottom: 0,
      },
    ],
  },
  {
    id: "tpl-bar-dual-trendy",
    name: "Trendy Dual-Roll Tag (100x25mm / 2-Up)",
    category: "barcodes",
    description: "Standard 2-across dual thermal roll for TSC, TVS, Xprinter, and Zebra with centered OFFER & M.R.P. layout.",
    isDefault: false,
    paperSize: "100x25mm",
    layout: "2up",
    barcodeFormat: "Code-128",
    primaryColor: "#0f172a",
    fontFamily: "Inter, sans-serif",
    textAlign: "center",
    spPrefix: "OFFER: ",
    mrpPrefix: "M.R.P. ",
    spBadgeStyle: "none",
    showMrpStrike: false,
    priceLayout: "center_offer",
    themeName: "trendy_offer",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
    elements: [
      {
        id: "el_company",
        type: "companyName",
        label: "Store Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10.5,
        fontWeight: "900",
        textAlign: "center",
        color: "#0f172a",
        textTransform: "uppercase",
        marginBottom: 1,
      },
      {
        id: "el_divider",
        type: "divider",
        label: "Divider Line",
        visible: true,
        height: 1,
        color: "#cbd5e1",
        marginBottom: 2,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Product Title",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        fontWeight: "900",
        textAlign: "center",
        color: "#020617",
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Selling Price (SP)",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: "900",
        textAlign: "center",
        color: "#020617",
        prefix: "OFFER: ",
        badgeStyle: "none",
        marginBottom: 1,
      },
      {
        id: "el_mrp",
        type: "mrp",
        label: "MRP",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9.5,
        fontWeight: "900",
        textAlign: "center",
        color: "#020617",
        prefix: "M.R.P. ",
        showStrike: false,
        marginBottom: 1,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Barcode Graphic",
        visible: true,
        height: 25,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Barcode Code",
        visible: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 8.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        prefix: "",
        marginBottom: 0,
      },
    ],
  },
  {
    id: "tpl-bar-retail-50x25",
    name: "Standard 2x1 Inch Tag (50x25mm / 2\" x 1\")",
    category: "barcodes",
    description: "Compact 2-inch single label roll with Emerald Green SP badge and strikethrough MRP.",
    isDefault: false,
    paperSize: "50x25mm",
    layout: "1up",
    barcodeFormat: "Code-128",
    primaryColor: "#0f172a",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    spBadgeStyle: "pill",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showBarcodeText: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
    elements: [
      {
        id: "el_company",
        type: "companyName",
        label: "Store Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        marginBottom: 1,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Product Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: "bold",
        textAlign: "center",
        color: "#020617",
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Selling Price (SP)",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: "900",
        textAlign: "center",
        color: "#ffffff",
        prefix: "SP: ",
        badgeStyle: "pill",
        marginBottom: 1,
      },
      {
        id: "el_mrp",
        type: "mrp",
        label: "MRP",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9,
        fontWeight: "600",
        textAlign: "center",
        color: "#64748b",
        prefix: "MRP: ",
        showStrike: true,
        marginBottom: 1,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Barcode Graphic",
        visible: true,
        height: 22,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Barcode Code",
        visible: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 8.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        prefix: "",
        marginBottom: 0,
      },
    ],
  },
  {
    id: "tpl-bar-dual-100x25",
    name: "Supermarket Dual-Column Tag (100x25mm / 2-Up)",
    category: "barcodes",
    description: "Standard 2-across thermal roll for Xprinter XP-TT426B, TVS, TSC, and Zebra barcode printers.",
    isDefault: false,
    paperSize: "100x25mm",
    layout: "2up",
    barcodeFormat: "Code-128",
    primaryColor: "#1e293b",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: false,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
    elements: [
      {
        id: "el_company",
        type: "companyName",
        label: "Supermarket Header",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9.5,
        fontWeight: "900",
        textAlign: "center",
        color: "#1e293b",
        textTransform: "uppercase",
        borderBottom: true,
        marginBottom: 1,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Item Description",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Selling Price",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9.5,
        fontWeight: "900",
        textAlign: "center",
        color: "#ffffff",
        prefix: "SP: ",
        badgeStyle: "dark",
        marginBottom: 1,
      },
      {
        id: "el_mrp",
        type: "mrp",
        label: "MRP",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 8.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        prefix: "MRP: ",
        showStrike: true,
        marginBottom: 1,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Barcode Graphic",
        visible: true,
        height: 20,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Barcode Code",
        visible: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 8,
        fontWeight: "bold",
        textAlign: "center",
        color: "#1e293b",
        prefix: "",
        marginBottom: 0,
      },
    ],
  },
  {
    id: "tpl-bar-shipping-75x50",
    name: "Standard Shipping & Carton Tag (75x50mm / 3\" x 2\")",
    category: "barcodes",
    description: "High-visibility 3-inch label for outer cartons, dispatch, and parcel tracking.",
    isDefault: false,
    paperSize: "75x50mm",
    layout: "1up",
    barcodeFormat: "Code-128",
    primaryColor: "#0f172a",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: true,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
    elements: [
      {
        id: "el_company",
        type: "companyName",
        label: "Sender / Store Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 12,
        fontWeight: "900",
        textAlign: "center",
        color: "#0f172a",
        marginBottom: 2,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Package Contents",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        marginBottom: 2,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Tracking Barcode",
        visible: true,
        height: 42,
        marginBottom: 2,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Tracking / SKU",
        visible: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 10,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        prefix: "TRACK: ",
        marginBottom: 2,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "Declared Value",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
        fontWeight: "bold",
        textAlign: "center",
        color: "#020617",
        prefix: "VAL: ",
        badgeStyle: "none",
        marginBottom: 0,
      },
    ],
  },
  {
    id: "tpl-bar-pharma-38x25",
    name: "Compact Pharmacy & Cosmetic Tag (38x25mm / 1.5\" x 1\")",
    category: "barcodes",
    description: "High-density micro label for small pharmacy strips, bottles, cosmetics, and hardware.",
    isDefault: false,
    paperSize: "38x25mm",
    layout: "1up",
    barcodeFormat: "Code-128",
    primaryColor: "#0f172a",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: false,
      showMfgExpDate: true,
      showCustomTagline: false,
    },
    elements: [
      {
        id: "el_company",
        type: "companyName",
        label: "Pharmacy Name",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 8.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        marginBottom: 1,
      },
      {
        id: "el_product_name",
        type: "productName",
        label: "Medicine / Item",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 9,
        fontWeight: "900",
        textAlign: "center",
        color: "#000000",
        marginBottom: 1,
      },
      {
        id: "el_batch",
        type: "batchMfgExp",
        label: "Mfg & Exp Date",
        visible: true,
        fontSize: 7.5,
        marginBottom: 1,
      },
      {
        id: "el_sp",
        type: "sellingPrice",
        label: "MRP / Price",
        visible: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 8.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#000000",
        prefix: "MRP: ",
        badgeStyle: "none",
        marginBottom: 1,
      },
      {
        id: "el_barcode",
        type: "barcodeGraphic",
        label: "Micro Barcode",
        visible: true,
        height: 18,
        marginBottom: 1,
      },
      {
        id: "el_sku",
        type: "sku",
        label: "Code",
        visible: true,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 7.5,
        fontWeight: "bold",
        textAlign: "center",
        color: "#0f172a",
        prefix: "",
        marginBottom: 0,
      },
    ],
  },
  {
    id: "tpl-bar-cargo-100x75",
    name: "Warehouse Cargo & Pallet Tag (100x75mm / 4\" x 3\")",
    category: "barcodes",
    description: "Large 4-inch industrial label for pallet racks, bins, and cargo tracking.",
    isDefault: false,
    paperSize: "100x75mm",
    layout: "1up",
    barcodeFormat: "Code-128",
    primaryColor: "#000000",
    textAlign: "center",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: true,
      showMfgExpDate: false,
      showCustomTagline: false,
    },
  },
  {
    id: "tpl-bar-a4-24",
    name: "A4 Sticker Sheet (24-Up / 3x8 Grid)",
    category: "barcodes",
    description: "24 self-adhesive sticker labels per A4 sheet (70mm x 35mm each). Ideal for regular office inkjet/laser printers.",
    isDefault: false,
    paperSize: "A4",
    layout: "a4_24",
    barcodeFormat: "Code-128",
    primaryColor: "#0f172a",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: true,
      showBarcodeGraphic: true,
      showHSN: true,
      showMfgExpDate: true,
    },
  },
  {
    id: "tpl-bar-a4-40",
    name: "A4 Sticker Sheet (40-Up / 4x10 Grid)",
    category: "barcodes",
    description: "40 sticker labels per A4 sheet (48.5mm x 25.4mm each).",
    isDefault: false,
    paperSize: "A4",
    layout: "a4_40",
    barcodeFormat: "Code-128",
    primaryColor: "#0f172a",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: true,
    priceLayout: "inline",
    fields: {
      showCompanyName: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showCategoryBrand: true,
      showBarcodeGraphic: true,
      showHSN: false,
      showMfgExpDate: true,
    },
  },
  {
    id: "tpl-bar-a4-65",
    name: "A4 Sticker Sheet (65-Up / 5x13 Grid)",
    category: "barcodes",
    description: "65 compact barcode sticker labels per A4 sheet (38mm x 21.2mm each).",
    isDefault: false,
    paperSize: "A4",
    layout: "a4_65",
    barcodeFormat: "Code-128",
    primaryColor: "#0f172a",
    spPrefix: "SP: ",
    mrpPrefix: "MRP: ",
    showMrpStrike: false,
    priceLayout: "inline",
    fields: {
      showCompanyName: false,
      showProductName: true,
      showPrice: true,
      showMRP: false,
      showSKU: true,
      showCategoryBrand: false,
      showBarcodeGraphic: true,
      showHSN: false,
      showMfgExpDate: false,
    },
  },
];

let isSyncingBackendTemplates = false;
let lastSyncTimestamp = 0;

export async function syncPrintTemplatesFromBackend(force: boolean = false): Promise<any[]> {
  if (typeof window === "undefined") return [];
  const now = Date.now();
  if (!force && isSyncingBackendTemplates) return [];
  if (!force && now - lastSyncTimestamp < 15000) return []; // debounce 15s

  isSyncingBackendTemplates = true;
  lastSyncTimestamp = now;

  try {
    const res = await printTemplatesApi.getTemplates();
    if (res && Array.isArray(res.templates) && res.templates.length > 0) {
      const storageKey = getTenantTemplatesKey();
      const existingRaw = localStorage.getItem(storageKey);
      let existing: any[] = [];
      if (existingRaw) {
        try { existing = JSON.parse(existingRaw) || []; } catch {}
      }

      // Merge backend templates with local cache (backend is source of truth for custom templates)
      const templateMap = new Map<string, any>();
      const sanitizeTpl = (t: any) => {
        if (!t || !t.id) return null;
        const copy = { ...t };
        const tname = String(copy.name || "");
        if (copy.id === "tpl-bar-trendy-offer" || tname.includes("Centered Offer") || tname.includes("Offer & MRP")) {
          copy.name = "Trendy Retail Tag (Centered SP & MRP)";
          copy.spPrefix = "SP: ";
          copy.mrpPrefix = "MRP: ";
          copy.priceLayout = "center_offer";
          copy.themeName = "trendy_offer";
        }
        return copy;
      };

      existing.forEach((t) => { 
        const st = sanitizeTpl(t);
        if (st && st.id) templateMap.set(st.id, st); 
      });
      res.templates.forEach((t) => { 
        const st = sanitizeTpl(t);
        if (st && st.id) templateMap.set(st.id, st); 
      });

      const merged = Array.from(templateMap.values());
      // Write only to the workspace-scoped key — never to the unsuffixed global
      // keys, which would leak this workspace's templates into other tenants.
      // Prune (dedupe / cap at 15 / sanitize) so a bloated backend sync can
      // never exhaust the browser quota on write.
      safeSetItem(storageKey, JSON.stringify(pruneTemplateList(merged)));

      // Also sync active map if present (workspace-scoped keys only)
      if (res.active_map) {
        const defaultsKey = getTenantDefaultsKey();
        const curDef = readActiveDefaults(defaultsKey);
        const updatedDef = { ...curDef, ...res.active_map };
        if (res.active_map.barcodes) {
          updatedDef.barcode = res.active_map.barcodes;
        }
        if (res.active_map.invoices) {
          updatedDef.invoice = res.active_map.invoices;
        }
        safeSetItem(defaultsKey, JSON.stringify(updatedDef));
      }

      window.dispatchEvent(new Event("print_templates_updated"));
      window.dispatchEvent(new Event("bos_barcode_template_changed"));
      return merged;
    }
  } catch (err) {
    // If offline or not authenticated yet, ignore gracefully
  } finally {
    isSyncingBackendTemplates = false;
  }
  return [];
}

// Auto-sync once on startup in browser
if (typeof window !== "undefined") {
  setTimeout(() => {
    syncPrintTemplatesFromBackend().catch(() => {});
  }, 1000);
}

export function getAllBarcodeTemplates(tenantId?: string): any[] {
  const tid = tenantId || getTenantIdFromStorage();
  const activeGst = getActiveBillingGst(tid);
  const tenantOrgName = activeGst?.trade_name || activeGst?.legal_name || undefined;

  // Trigger background sync from backend database
  if (typeof window !== "undefined") {
    syncPrintTemplatesFromBackend().catch(() => {});
  }

  const storedMap = new Map<string, any>();

  if (typeof window !== "undefined") {
    try {
      const storageKey = getTenantTemplatesKey(tid);
      // Strictly workspace-scoped keys — no unsuffixed global fallbacks
      const keysToCheck = tid ? [storageKey, `businessos_print_templates_v1_${tid}`] : [];

      for (const k of keysToCheck) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((t: any) => {
                if (t && t.id && (t.category === "barcodes" || t.docType === "barcode" || String(t.id).startsWith("tpl-bar"))) {
                  // Migrate legacy priceGroup elements to separate el_mrp and el_sp
                  if (t.elements && Array.isArray(t.elements) && t.elements.some((el: any) => el.type === "priceGroup" || el.id === "el_price_group")) {
                    const migrated: any[] = [];
                    t.elements.forEach((el: any) => {
                      if (el.type === "priceGroup" || el.id === "el_price_group") {
                        migrated.push({
                          id: "el_mrp",
                          type: "mrp",
                          label: "MRP",
                          visible: el.visible !== false,
                          fontFamily: el.fontFamily || t.fontFamily || "Inter, sans-serif",
                          fontSize: el.fontSize || 9.5,
                          fontWeight: el.fontWeight || "900",
                          textAlign: el.textAlign || "center",
                          color: el.color || "#020617",
                          prefix: t.mrpPrefix || "MRP: ",
                          showStrike: el.showStrike ?? false,
                          marginBottom: 1,
                        });
                        migrated.push({
                          id: "el_sp",
                          type: "sellingPrice",
                          label: "Selling Price (SP)",
                          visible: el.visible !== false,
                          fontFamily: el.fontFamily || t.fontFamily || "Inter, sans-serif",
                          fontSize: el.fontSize || 10,
                          fontWeight: el.fontWeight || "900",
                          textAlign: el.textAlign || "center",
                          color: el.color || "#020617",
                          prefix: t.spPrefix || "SP: ",
                          badgeStyle: el.badgeStyle || t.spBadgeStyle || "none",
                          marginBottom: 2,
                        });
                      } else {
                        migrated.push(el);
                      }
                    });
                    t.elements = migrated;
                  }

                  if (!storedMap.has(t.id) || t.updatedAt || t.elements) {
                    storedMap.set(t.id, t);
                  }
                }
              });
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Combine custom saved templates with default presets
  const combined: any[] = Array.from(storedMap.values());
  DEFAULT_BARCODE_TEMPLATES.forEach((def) => {
    if (!combined.some((t) => t.id === def.id)) {
      combined.push(def);
    }
  });

  return combined.map((t) => ({
    ...t,
    storeName: tenantOrgName || (t.storeName && !t.storeName.toUpperCase().includes("LAZYMONKEY") ? t.storeName : undefined),
  }));
}

export function getActiveBarcodeTemplate(tenantId?: string): any {
  const tid = tenantId || getTenantIdFromStorage();
  const activeGst = getActiveBillingGst(tid);
  const tenantOrgName = activeGst?.trade_name || activeGst?.legal_name || undefined;

  const allTemplates = getAllBarcodeTemplates(tid);

  if (typeof window !== 'undefined') {
    try {
      const defaultsKey = getTenantDefaultsKey(tid);
      const userActiveDefaultsRaw = tid ? localStorage.getItem(defaultsKey) : null;
      const activeDefaults = userActiveDefaultsRaw ? JSON.parse(userActiveDefaultsRaw) : {};

      const activeBarcodeId =
        activeDefaults.barcodes ||
        activeDefaults.barcode ||
        (tid ? localStorage.getItem(`bos_active_barcode_template_id_${tid}`) : null);

      if (activeBarcodeId) {
        const found = allTemplates.find((t) => t.id === activeBarcodeId);
        if (found) {
          const linked = getLinkedMaster(found, tid);
          return {
            ...linked,
            storeName: tenantOrgName || (linked.storeName && !linked.storeName.toUpperCase().includes('LAZYMONKEY') ? linked.storeName : undefined)
          };
        }
      }

      const defaultTemplate = allTemplates.find((t) => t.isDefault) || allTemplates[0];
      if (defaultTemplate) {
        const linked = getLinkedMaster(defaultTemplate, tid);
        return {
          ...linked,
          storeName: tenantOrgName || (linked.storeName && !linked.storeName.toUpperCase().includes('LAZYMONKEY') ? linked.storeName : undefined)
        };
      }
    } catch (e) {
      console.error('Error loading active barcode template:', e);
    }
  }

  const baseLinked = getLinkedMaster(allTemplates[0] || DEFAULT_BARCODE_TEMPLATES[0], tid);
  return {
    ...baseLinked,
    storeName: tenantOrgName || (baseLinked.storeName && !String(baseLinked.storeName).toUpperCase().includes('LAZYMONKEY') ? baseLinked.storeName : undefined),
  };
}

export function setActiveBarcodeTemplate(id: string, tenantId?: string): void {
  if (typeof window === "undefined") return;
  const tid = tenantId || getTenantIdFromStorage();
  try {
    const defaultsKey = getTenantDefaultsKey(tid);
    const defaults = readActiveDefaults(defaultsKey);
    defaults.barcodes = id;
    defaults.barcode = id;
    if (tid) safeSetItem(defaultsKey, JSON.stringify(defaults));
    if (tid) safeSetItem(`bos_active_barcode_template_id_${tid}`, id);

    // Also update isDefault in stored templates (workspace-scoped keys only)
    const storageKey = getTenantTemplatesKey(tid);
    const keysToUpdate = tid ? [storageKey, `businessos_print_templates_v1_${tid}`] : [];

    keysToUpdate.forEach((k) => {
      try {
        const rawTpls = localStorage.getItem(k);
        if (rawTpls) {
          const parsed = JSON.parse(rawTpls);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((t: any) => {
              if (t.category === "barcodes" || t.docType === "barcode" || String(t.id).startsWith("tpl-bar")) {
                return { ...t, isDefault: t.id === id };
              }
              return t;
            });
            safeSetItem(k, JSON.stringify(updated));
          }
        }
      } catch {}
    });

    // Save active preference to backend database for all users in the organization
    printTemplatesApi.setActiveTemplate(id, "barcodes").catch(() => {});

    window.dispatchEvent(new Event("print_templates_updated"));
    window.dispatchEvent(new Event("bos_barcode_template_changed"));
  } catch (e) {
    console.error("Error setting active barcode template:", e);
  }
}

export function saveBarcodeTemplate(updated: any, setAsDefault: boolean = false): void {
  if (typeof window === "undefined") return;
  try {
    const tid = getTenantIdFromStorage();
    const storageKey = getTenantTemplatesKey(tid);
    const barcodeTemplate = {
      ...updated,
      category: "barcodes",
      docType: "barcode",
      updatedAt: new Date().toISOString(),
      isDefault: setAsDefault ? true : Boolean(updated.isDefault),
    };

    // Workspace-scoped keys only — no unsuffixed global writes
    const keysToSync = tid ? [storageKey, `businessos_print_templates_v1_${tid}`] : [];

    keysToSync.forEach((k) => {
      try {
        let allTemplates: any[] = prunedTemplatesFromRaw(localStorage.getItem(k));

        const existingIdx = allTemplates.findIndex((t: any) => t.id === updated.id);
        if (existingIdx >= 0) {
          allTemplates[existingIdx] = barcodeTemplate;
        } else {
          allTemplates.push(barcodeTemplate);
        }

        if (setAsDefault) {
          allTemplates = allTemplates.map((t: any) => {
            if (t.category === "barcodes" || t.docType === "barcode" || String(t.id).startsWith("tpl-bar")) {
              return { ...t, isDefault: t.id === updated.id };
            }
            return t;
          });
        }

        safeSetItem(k, JSON.stringify(allTemplates));
      } catch {}
    });

    if (setAsDefault) {
      const tid = getTenantIdFromStorage();
      const defaultsKey = getTenantDefaultsKey(tid);
      const defaults = readActiveDefaults(defaultsKey);
      defaults.barcodes = updated.id;
      defaults.barcode = updated.id;
      if (tid) safeSetItem(defaultsKey, JSON.stringify(defaults));
      if (tid) safeSetItem(`bos_active_barcode_template_id_${tid}`, updated.id);
    }

    // Persist directly to backend PostgreSQL database for the whole organization
    printTemplatesApi.saveTemplate(barcodeTemplate, setAsDefault).catch((err) => {
      console.warn("Backend template save sync deferred/offline:", err);
    });

    window.dispatchEvent(new Event("print_templates_updated"));
    window.dispatchEvent(new Event("bos_barcode_template_changed"));
  } catch (e) {
    console.error("Error saving barcode template:", e);
  }
}

export function deleteBarcodeTemplate(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const tid = getTenantIdFromStorage();
    const storageKey = getTenantTemplatesKey(tid);
    const keysToClean = tid ? [storageKey, `businessos_print_templates_v1_${tid}`] : [];

    keysToClean.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((t: any) => t.id !== id);
            safeSetItem(k, JSON.stringify(filtered));
          }
        }
      } catch {}
    });

    // Delete from backend PostgreSQL database for the organization
    printTemplatesApi.deleteTemplate(id, "barcodes").catch(() => {});

    window.dispatchEvent(new Event("print_templates_updated"));
    window.dispatchEvent(new Event("bos_barcode_template_changed"));
  } catch (e) {
    console.error("Error deleting barcode template:", e);
  }
}

/**
 * Master-template → receiver sync.
 *
 * The "master" is the active A4 invoice template (category 'invoices'). When the
 * user designs/saves it, this copies the organization-level, non-layout content
 * down to the thermal receipt (80mm/58mm) and barcode-label templates so the
 * whole template family stays consistent:
 *   - `texts` / `customTexts`  → editable label words
 *   - signature / stamp urls + title
 *   - custom fields + custom item columns
 *   - payment-QR / Google-review / UPI settings
 *   - brand primary color + tagline
 * Layout, column order, element positions and per-receipt paper size are left
 * untouched (a receipt can't render a full A4 page). Returns the count of
 * receiver templates updated so the UI can report it.
 */
export function syncMasterInvoiceToReceivers(master: any, tenantId?: string): number {
  if (typeof window === "undefined" || !master) return 0;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const storageKey = getTenantTemplatesKey(tid);
    const all = tid ? prunedTemplatesFromRaw(localStorage.getItem(storageKey)) : [];

    const receiver = (t: any) =>
      t &&
      (t.category === "thermal" ||
        t.docType === "thermal" ||
        t.category === "barcodes" ||
        t.docType === "barcode" ||
        String(t.id || "").startsWith("tpl-bar"));

    const isMaster = (t: any) =>
      t && (t.category === "invoices" || t.docType === "invoice" || t.themeName === "word_studio") && !receiver(t);

    // Only sync when the passed master really IS an invoice template, so a
    // thermal/barcode save never clobbers the invoice designer.
    const masterIsInvoice = isMaster(master);

    const pick = (t: any, key: string) => (t?.[key] && t[key].length ? t[key] : null);

    let updatedCount = 0;
    let nextAll = all.map((t) => {
      if (!receiver(t) || t.id === master?.id) return t;
      if (masterIsInvoice) {
        const synced: any = { ...t, updatedAt: new Date().toISOString() };
        // Editable label words (master `texts` → receiver `texts` + `customTexts`)
        if (master.texts || master.customTexts) {
          const mergedTexts = { ...(master.customTexts || {}), ...(master.texts || {}) };
          synced.texts = mergedTexts;
          synced.customTexts = mergedTexts;
        }
        // Signature / stamp / signatory
        if (master.signatureUrl) synced.signatureUrl = master.signatureUrl;
        if (master.stampUrl) synced.stampUrl = master.stampUrl;
        if (master.signatureTitle) synced.signatoryLabel = master.signatureTitle;
        // Custom fields + custom item columns
        const cf = pick(master, "customFields");
        if (cf) synced.customFields = cf;
        const cic = pick(master, "customItemColumns");
        if (cic) synced.customItemColumns = cic;
        // Payment-QR / Google-review / UPI
        if (master.upiId) synced.upiId = master.upiId;
        if (master.payeeName) synced.payeeName = master.payeeName;
        if (master.customQrUrl) synced.customQrUrl = master.customQrUrl;
        if (master.googleReviewUrl) synced.googleReviewUrl = master.googleReviewUrl;
        // Brand
        if (master.primaryColor) synced.primaryColor = master.primaryColor;
        if (master.customTaglineText || master.headerTagline) {
          synced.customTaglineText = master.customTaglineText || master.headerTagline;
          synced.headerTagline = master.customTaglineText || master.headerTagline;
        }
        updatedCount++;
        return synced;
      }
      return t;
    });

    if (nextAll.length) safeSetItem(storageKey, JSON.stringify(nextAll));
    window.dispatchEvent(new Event("print_templates_updated"));
    window.dispatchEvent(new Event("bos_receipt_template_changed"));
    window.dispatchEvent(new Event("bos_barcode_template_changed"));
    return updatedCount;
  } catch (err) {
    console.error("Error syncing master template to receivers:", err);
    return 0;
  }
}

// ── LIVE MASTER LINK (receipt / barcode → invoice master) ────────────────
// A receipt or barcode template is LINKED to the master A4 invoice template
// by default. While linked, any mappable setting that the receiver has NOT
// explicitly set follows the master at render time — no one-off copy step.
// Per-word labels keep the receiver's own edited words (local wins per key).
// Unlinking makes the receiver fully independent (its last values are kept).
export function getMasterInvoiceTemplate(tenantId?: string): any {
  if (typeof window === "undefined") return null;
  try {
    const master = getActiveInvoicePrintTemplate(tenantId);
    if (!master) return null;
    const id = String(master.id || "");
    const isInvoice =
      master.category === "invoices" ||
      master.docType === "invoice" ||
      master.themeName === "word_studio" ||
      id.startsWith("tpl-word") ||
      id.startsWith("tpl-inv") ||
      id.startsWith("tpl-thm");
    // Never link a thermal receipt to itself as the "master".
    if (master.category === "thermal" || master.docType === "thermal") return null;
    return isInvoice ? master : null;
  } catch {
    return null;
  }
}

export function isReceiverLinkedToMaster(receiver: any): boolean {
  // Default: linked. Only an explicit `linkedToMaster === false` detaches.
  return receiver?.linkedToMaster !== false;
}

/**
 * Merge the master invoice template's mappable settings into a receiver
 * (receipt or barcode) template. Local receiver values win when they are set;
 * anything unset follows the master. Words are merged per-key (local word
 * beats master word). Used only while the receiver is linked.
 */
export function linkMasterToReceiver(receiver: any, master: any): any {
  if (!receiver || !master || receiver.id === master.id) return receiver;
  const out: any = { ...receiver };

  // Editable label words — receiver local words win per-key, then master.
  const masterTexts: any = { ...(master.customTexts || {}), ...(master.texts || {}) };
  const localTexts: any = { ...(receiver.customTexts || {}), ...(receiver.texts || {}) };
  const mergedTexts = { ...masterTexts, ...localTexts };
  if (Object.keys(mergedTexts).length) {
    out.texts = mergedTexts;
    out.customTexts = mergedTexts;
  }

  // Signature / stamp (receiver override wins when present, else master).
  out.signatureUrl = receiver.signatureUrl || master.signatureUrl || "";
  out.stampUrl = receiver.stampUrl || master.stampUrl || "";
  out.signatoryLabel = receiver.signatoryLabel || master.signatureTitle || "";

  // Payment-QR / Google-review / UPI.
  out.upiId = receiver.upiId || master.upiId || "";
  out.payeeName = receiver.payeeName || master.payeeName || "";
  out.customQrUrl = receiver.customQrUrl || master.customQrUrl || "";
  out.googleReviewUrl = receiver.googleReviewUrl || master.googleReviewUrl || "";

  // Brand.
  out.primaryColor = receiver.primaryColor || master.primaryColor || "";
  const tagline = receiver.customTaglineText || master.customTaglineText || master.headerTagline || "";
  out.customTaglineText = tagline;
  out.headerTagline = tagline;

  // Bank details (receipt/bank block).
  out.bankDetails = receiver.bankDetails || master.bankDetails || "";

  // Custom fields & columns — receiver wins wholesale when it has any, else master.
  if (Array.isArray(receiver.customFields) && receiver.customFields.length) out.customFields = receiver.customFields;
  else if (Array.isArray(master.customFields) && master.customFields.length) out.customFields = master.customFields;
  if (Array.isArray(receiver.customItemColumns) && receiver.customItemColumns.length) out.customItemColumns = receiver.customItemColumns;
  else if (Array.isArray(master.customItemColumns) && master.customItemColumns.length) out.customItemColumns = master.customItemColumns;

  // Terms / declaration / footer — receiver override wins when present.
  out.termsText = receiver.termsText || master.termsText || out.termsText || "";
  out.termsAndConditionsText = receiver.termsAndConditionsText || master.termsAndConditionsText || out.termsAndConditionsText || "";
  out.declarationText = receiver.declarationText || master.declarationText || out.declarationText || "";
  out.footerText = receiver.footerText || master.footerText || out.footerText || "";
  out.thankYouNote = receiver.thankYouNote || master.thankYouNote || out.thankYouNote || "";

  // Mark as linked so the UI can show the state.
  out.linkedToMaster = true;
  out.linkedToMasterId = master.id;
  return out;
}

/**
 * Live-linked receipt: the stored receiver merged with its master when it is
 * still linked. Falls back to the plain receiver when unlinked or no master.
 */
export function getLinkedMaster(receiver: any, tenantId?: string): any {
  if (!receiver) return receiver;
  if (!isReceiverLinkedToMaster(receiver)) return receiver;
  const master = getMasterInvoiceTemplate(tenantId);
  return master ? linkMasterToReceiver(receiver, master) : receiver;
}

/**
 * Persist a receiver template's link state (`linkedToMaster`) across all the
 * storage keys a receipt/barcode template lives in, plus the backend, so the
 * whole organization agrees. `linked=false` fully detaches the template so it
 * can be customized independently; `linked=true` re-attaches it to the master.
 */
export function setReceiverLinkedToMaster(receiverId: string, linked: boolean, tenantId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const write = (k: string) => {
      try {
        const list = pruneTemplateList(prunedTemplatesFromRaw(localStorage.getItem(k)));
        if (!Array.isArray(list)) return;
        list.forEach((t: any) => {
          if (t && t.id === receiverId) {
            t.linkedToMaster = linked;
            if (!linked) {
              // Detach: stop following the master; keep the last live values.
              t.linkedToMasterId = null;
            } else if (getMasterInvoiceTemplate(tid)) {
              t.linkedToMasterId = getMasterInvoiceTemplate(tid)?.id;
            }
          }
        });
        safeSetItem(k, JSON.stringify(list));
      } catch {}
    };
    write(getTenantTemplatesKey(tid));
    write(`businessos_print_templates_v1_${tid}`);
    write(getTenantReceiptTemplatesKey(tid));

    printTemplatesApi.setActiveTemplate(receiverId, "thermal").catch(() => {});
    window.dispatchEvent(new CustomEvent("bos_receipt_template_changed", { detail: { id: receiverId, linked } }));
    window.dispatchEvent(new CustomEvent("bos_barcode_template_changed", { detail: { id: receiverId, linked } }));
    window.dispatchEvent(new Event("print_templates_updated"));
  } catch (err) {
    console.error("Error updating receiver link state:", err);
  }
}

export const GLOBAL_INVOICE_TEMPLATES = [
  {
    id: "tpl-word-default",
    name: "Custom Word-Designed Invoice",
    category: "invoices",
    docType: "invoice",
    description: "Standard executive split invoice layout matching global commercial best practice with full designer freedom.",
    isDefault: true,
    paperSize: "A4",
    orientation: "portrait",
    margins: "normal",
    primaryColor: "#0f172a",
    paperBgColor: "#ffffff",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    themeName: "word_studio",
    isWordTemplate: true,
    wordConfig: {
      headerStyle: "classic_split",
      tableBorderStyle: "subtle",
      primaryColor: "#0f172a",
      customFields: [
        { id: "cf_po", label: "PO Reference", value: "PO-2026-9921", enabled: true, section: "meta" },
        { id: "cf_veh", label: "Vehicle No", value: "TS 09 EA 4412", enabled: true, section: "meta" },
        { id: "cf_eway", label: "E-Way Bill No", value: "2410098234390", enabled: true, section: "meta" },
        { id: "cf_challan", label: "Challan No", value: "DC-0045", enabled: true, section: "meta" },
      ],
    },
    fields: {
      showHeader: true,
      showLogo: true,
      showCompanyDetails: true,
      showInvoiceDetails: true,
      showItemTable: true,
      showTaxSplit: true,
      showTotals: true,
      showTerms: true,
      showFooter: true,
      showBarcode: true,
      showQR: true,
      showProductImage: false,
      showCustomerDetails: true,
      showPaymentDetails: true,
      showSignature: true,
      showThankYou: true,
      showProductName: true,
      showPrice: true,
      showMRP: true,
      showSKU: true,
      showBarcodeGraphic: true,
      showMfgExpDate: true,
      showCategoryBrand: true,
      showCompanyName: true,
      showCustomTagline: true,
      showHSN: true,
      showBankDetails: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTime: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "tpl-inv-gst-tally",
    name: "GST Tally (myBillBook Style)",
    category: "invoices",
    docType: "invoice",
    description: "Advanced GST / Tally A4 format matching myBillBook: party bill-to/ship-to, HSN + GST slab summary, amount-in-words, and previous/current party balance.",
    isDefault: false,
    paperSize: "A4",
    orientation: "portrait",
    margins: "narrow",
    primaryColor: "#0f172a",
    paperBgColor: "#ffffff",
    fontFamily: "Inter, sans-serif",
    headerTitle: "TAX INVOICE",
    themeName: "gst_tally",
    fields: {
      showHeader: true,
      showLogo: true,
      showCompanyDetails: true,
      showInvoiceDetails: true,
      showItemTable: true,
      showHSN: true,
      showTaxSplit: true,
      showBankDetails: true,
      showSignature: true,
      showCustomerDetails: true,
      showTotals: true,
      showProductName: true,
      showMRP: true,
      showSKU: true,
      showPartyBalance: true,
      showItemDescription: true,
      showTerms: true,
      showFooter: true,
      showThankYou: true,
      showBillTo: true,
      showShipTo: true,
      showPlaceOfSupply: true,
      showPartyPhone: true,
      showPartyGstin: true,
      showItemIndex: true,
      showItemQty: true,
      showItemRate: true,
      showItemAmount: true,
      showGstRateCol: true,
      showSubtotal: true,
      showTaxableAmount: true,
      showTaxBreakup: true,
      showTotalAmount: true,
      showAmountInWords: true,
      showReceivedAmount: true,
      showBalanceAmount: true,
    },
    createdAt: new Date().toISOString(),
  },
];

/**
 * Curated set of built-in templates the template designer ships with.
 * Any saved template whose id is NOT in this list (and is not a user-created
 * Word / PDF-overlay design) is pruned on load so orgs stop seeing the
 * many near-duplicate legacy templates. User-created designs (ids carrying a
 * wordConfig / pdfBackgroundDataUrl / isPdfStationeryOverlay, or org template
 * ids the backend returned that are not built-in `tpl-` ids) are always kept.
 */
/**
 * Hard blocklist of deprecated built-in template ids. Even if an org's
 * database still has a stored copy of one of these (some carry wordConfig,
 * which would normally exempt it from pruning), it is dropped so the picker
 * shows only the curated set. User-created designs keep distinct ids
 * (`tpl-word-blank-<ts>`, `tpl-word-<ts>`, backend UUIDs) and are NOT
 * affected by this list.
 */
export const DEPRECATED_BUILTIN_TEMPLATE_IDS: string[] = [
  // Legacy generic invoice themes
  "tpl-inv-stylish",
  "tpl-inv-luxury",
  "tpl-inv-adv-tally",
  "tpl-inv-adv-gst",
  "tpl-inv-billbook",
  "tpl-inv-modern",
  "tpl-inv-simple",
  "tpl-inv-compact",
  "tpl-inv-minimal",
  "tpl-inv-elegant",
  "tpl-inv-clean-slate",
  "tpl-inv-emerald-corp",
  "tpl-inv-culture-up",
  "tpl-inv-culture-god",
  // Legacy "Global" Word Studio clones
  "tpl-inv-global-stripe",
  "tpl-inv-global-zurich",
  "tpl-inv-global-nordic",
  "tpl-inv-global-tokyo",
  "tpl-inv-global-singapore",
  // Trimmed thermal / barcode / qr variants
  "tpl-thm-80-grocery",
  "tpl-thm-80-pharma",
  "tpl-thm-80-kot",
  "tpl-bar-trendy-offer",
  "tpl-bar-std",
  "tpl-bar-apparel",
  "tpl-bar-cargo",
  "tpl-qr-bin",
];

export const CURATED_BUILTIN_TEMPLATE_IDS: string[] = [
  // Invoices — new GST Tally, individually-crafted sector templates
  // (Pharma / FMCG / Supermarket / Agri) and the Word / PDF builders.
  // Legacy repeats (stylish, luxury, adv-tally, adv-gst, billbook, modern,
  // simple, compact, minimal, elegant, clean-slate, emerald-corp,
  // culture-up, culture-god, global-*) are pruned.
  "tpl-inv-gst-tally",
  "tpl-word-default",
  "tpl-inv-marg",
  "tpl-inv-fmcg",
  "tpl-inv-parle",
  "tpl-inv-agri",
  "tpl-inv-pdf-overlay",
  // Thermal
  "tpl-thm-mybillbook",
  "tpl-thm-80-std",
  "tpl-thm-80-tax",
  "tpl-thm-58-compact",
  // Barcodes (1-up default, 2-up roll, FMCG box label — no same-theme repeats)
  "tpl-bar-mybillbook",
  "tpl-bar-dual-trendy",
  "tpl-bar-fmcg",
  // QR (product/payment tag + large signage)
  "tpl-qr-smart",
  "tpl-qr-poster",
  // Price tags
  "tpl-price-shelf",
  "tpl-price-promo",
  // Challan
  "tpl-challan-std",
  "tpl-challan-transfer",
  // Custom
  "tpl-custom-doc",
];

export function setActiveInvoicePrintTemplate(templateId: string, tenantId?: string, companyId?: string): void {
  if (typeof window === 'undefined') return;
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || localStorage.getItem('bos_active_company_id');
  try {
    ensurePurgeStalePrintTemplates();
    if (tid) {
      safeSetItem(`bos_active_invoice_template_id_${tid}`, templateId);
      if (cid) {
        safeSetItem(`bos_active_invoice_template_id_${tid}_${cid}`, templateId);
      }
    }

    if (!templateId || templateId === 'thermal' || templateId === 'pos' || String(templateId).startsWith('tpl-thm-') || String(templateId).includes('receipt')) {
      return;
    }
    const defaultsKey = getTenantDefaultsKey(tid);
    const parsedDefaults = readActiveDefaults(defaultsKey);
    parsedDefaults.invoices = templateId;
    parsedDefaults.invoice = templateId;
    safeSetItem(defaultsKey, JSON.stringify(parsedDefaults));

    const tplKey = getTenantTemplatesKey(tid);
    const rawTpls = localStorage.getItem(tplKey);
    if (rawTpls) {
      try {
        const tpls = pruneTemplateList(JSON.parse(rawTpls));
        if (Array.isArray(tpls)) {
          const updated = tpls.map((t: any) => {
            if (t.category === 'invoices' || t.docType === 'invoice') {
              return { ...t, isDefault: t.id === templateId };
            }
            return t;
          });
          safeSetItem(tplKey, JSON.stringify(updated));
        }
      } catch {}
    }

    invoicesApi.setActivePrintTemplate(templateId).catch(() => {});
    window.dispatchEvent(new CustomEvent('bos_invoice_template_changed', { detail: { templateId } }));
    window.dispatchEvent(new Event('print_templates_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error setting active invoice template:', err);
  }
}

export function getActiveInvoicePrintTemplate(tenantId?: string, companyId?: string): any {
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || (typeof window !== 'undefined' ? localStorage.getItem('bos_active_company_id') : undefined);
  const activeGst = getActiveBillingGst(tid, cid || undefined);

  if (typeof window !== 'undefined') {
    try {
      ensurePurgeStalePrintTemplates();
      const storageKey = getTenantTemplatesKey(tid);
      const defaultsKey = getTenantDefaultsKey(tid);
      const invTemplatesRaw = localStorage.getItem(storageKey);
      const userActiveDefaultsRaw = localStorage.getItem(defaultsKey);

      const isThermal = (id: any) => {
        if (!id) return false;
        const s = String(id).toLowerCase().trim();
        return s === 'thermal' || s === 'pos' || s.startsWith('tpl-thm-') || s.includes('receipt') || s.includes('thermal');
      };

      const activeDefaults = userActiveDefaultsRaw ? JSON.parse(userActiveDefaultsRaw) : {};
      const rawActiveInvoiceId =
        (tid && cid ? localStorage.getItem(`bos_active_invoice_template_id_${tid}_${cid}`) : null) ||
        (tid ? localStorage.getItem(`bos_active_invoice_template_id_${tid}`) : null) ||
        activeDefaults.invoices ||
        activeDefaults.invoice;

      const activeInvoiceId = isThermal(rawActiveInvoiceId) ? undefined : rawActiveInvoiceId;

      let matched: any = null;

      if (invTemplatesRaw) {
        const invTemplates = pruneTemplateList(JSON.parse(invTemplatesRaw));
        if (activeInvoiceId) {
          // Use only the template explicitly selected for this workspace — no fallback to
          // built-in/global templates (which may carry baked-in company data from other tenants)
          matched = invTemplates.find((t: any) => t.id === activeInvoiceId || t.themeName === activeInvoiceId);
        }
      }

      // No saved/selected template for this workspace → defaultWord path with blank store fields

        if (matched) {
          const isProddatur = matched.storeAddress && (matched.storeAddress.includes('KK Street, Proddatur') || matched.storeAddress.includes('Proddatur, YSR Cuddapah'));
          const isDummyGst = matched.gstin && matched.gstin.includes('37AABCCH694G1Z4');
          const isDummyPhone = matched.storePhone && matched.storePhone.includes('+91 9849344919');

          const cleanAddress = isProddatur ? '' : (matched.storeAddress || '');
          const cleanGstin = isDummyGst ? '' : (matched.gstin || '');
          const cleanPhone = isDummyPhone ? '' : (matched.storePhone || '');

          if (activeGst) {
            const res = {
              ...matched,
              gstin: activeGst.gstin || cleanGstin,
              storeName: activeGst.trade_name || activeGst.legal_name || '',
              storeAddress: activeGst.address || cleanAddress,
              storePhone: activeGst.phone || cleanPhone,
              storeEmail: activeGst.email || matched.storeEmail,
              cin: activeGst.cin || matched.cin,
              logoUrl: activeGst.logo_url || '',
              signatureUrl: activeGst.signature_url || matched.signatureUrl || matched.signature_url || null,
              stampUrl: activeGst.stamp_url || matched.stampUrl || matched.stamp_url || null,
              signatureTitle: activeGst.signature_title || matched.signatureTitle || matched.signature_title || 'Authorized Signatory',
              signatureCompanyName: activeGst.signature_company_name || `For ${activeGst.trade_name || activeGst.legal_name || 'Organization'}`,
            };
            if (res.wordConfig && typeof res.wordConfig === 'object') {
              res.wordConfig = {
                ...res.wordConfig,
                companyName: activeGst.trade_name || activeGst.legal_name || res.storeName,
                companyAddress: activeGst.address || res.storeAddress,
                companyGstin: activeGst.gstin || res.gstin,
                companyPhone: activeGst.phone || res.storePhone,
                companyEmail: activeGst.email || res.storeEmail,
              };
            }
            return res;
          }
          return {
            ...matched,
            storeName: '',
            storeAddress: cleanAddress,
            gstin: cleanGstin,
            storePhone: cleanPhone,
            storeEmail: '',
            cin: '',
            logoUrl: matched.logoUrl || matched.customLogoUrl || '',
            signatureUrl: matched.signatureUrl || matched.signature_url || null,
            stampUrl: matched.stampUrl || matched.stamp_url || null,
          };
        }
    } catch (e) {
      console.error('Error loading active invoice template:', e);
    }
  }

  const defaultWord = GLOBAL_INVOICE_TEMPLATES[0] || {
    id: 'tpl-word-default',
    name: 'Custom Word-Designed Invoice',
    category: 'invoices',
    isDefault: true,
    paperSize: 'A4',
    primaryColor: '#0f172a',
    fontFamily: 'Inter, sans-serif',
    headerTitle: 'TAX INVOICE',
    themeName: 'word_studio',
    isWordTemplate: true,
  };

  // No fallback to GLOBAL_INVOICE_TEMPLATES[0] baked-in store details —
  // when activeGst is null (no billing data for this workspace), the fields stay blank.
  // Spread defaultWord last for structural fields only; company-specific fields are
  // explicitly set from activeGst (or blank) so no cross-tenant data survives.
  const base = {
    ...defaultWord,
    storeName: activeGst?.trade_name || activeGst?.legal_name || '',
    storeAddress: activeGst?.address || '',
    storePhone: activeGst?.phone || '',
    storeEmail: activeGst?.email || '',
    gstin: activeGst?.gstin || '',
    cin: activeGst?.cin || '',
    pan: activeGst?.pan || '',
    logoUrl: activeGst?.logo_url || '',
    footerText: (defaultWord as any).footerText || 'Thank you for your business!',
    termsText: activeGst?.terms_and_conditions || '',
    bankDetails: activeGst?.bank_name ? `Bank: ${activeGst.bank_name} | A/C: ${activeGst.bank_account_number || ''} | IFSC: ${activeGst.bank_ifsc || ''}` : '',
    // Strip any baked-in wordConfig company data from the global template
    wordConfig: defaultWord.wordConfig
      ? {
          ...defaultWord.wordConfig,
          companyName: activeGst?.trade_name || activeGst?.legal_name || '',
          companyAddress: activeGst?.address || '',
          companyGstin: activeGst?.gstin || '',
          companyPhone: activeGst?.phone || '',
          companyEmail: activeGst?.email || '',
        }
      : undefined,
  };

  return base;
}

// ── Per-document-category invoice template slots ─────────────────────────
// The user can assign a specific template to each document category (quotation,
// proforma, estimate, credit note, debit note). Each is persisted to localStorage
// (this device) AND the backend (/invoices/print-template/active with a category
// param), so the same chosen template is used for that category across every
// mode — direct save, print, PDF, email, WhatsApp. If a category has no template
// set, the caller falls back to the invoice slot.
import { INVOICE_DOC_CATEGORIES } from './invoice-template-config';
import type { InvoiceDocCategory } from './invoice-template-config';

// Re-exported so consumers of the receipt-template-store can pull the document
// category list + type from this module alongside the per-category APIs.
export { INVOICE_DOC_CATEGORIES };
export type { InvoiceDocCategory };

export function getInvoiceCategoryActiveKey(tid: string, cid?: string | null, category?: string): string {
  const base = `bos_active_invoice_category_template_${tid}`;
  const catSuffix = category && category !== 'invoice' ? `_${category}` : '';
  return cid ? `${base}${catSuffix}_${cid}` : `${base}${catSuffix}`;
}

export function setActiveInvoicePrintTemplateForCategory(
  templateId: string,
  category: InvoiceDocCategory,
  tenantId?: string,
  companyId?: string,
): void {
  if (typeof window === 'undefined') return;
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || localStorage.getItem('bos_active_company_id');
  try {
    ensurePurgeStalePrintTemplates();
    safeSetItem(getInvoiceCategoryActiveKey(tid, cid, category), templateId);
    // Mirror into the dedicated per-category key family (ACTIVE_DOC_TEMPLATE_KEYS)
    // so every resolver that reads it sees the same choice as the strip.
    setActiveDocTemplateId(category, templateId, tid, cid || undefined);

    // Non-invoice categories are automatically unlinked so they persist independently
    // without clobbering or following master tax invoice.
    if (category !== 'invoice') {
      if (cid) {
        safeSetItem(getInvoiceCategoryLinkKey(tid, cid, category), 'unlinked');
      } else {
        safeSetItem(getInvoiceCategoryLinkKey(tid, null, category), 'unlinked');
      }
      invoicesApi.setActivePrintTemplate(templateId, category).catch(() => {});
    } else {
      // The "invoice" category is the master slot — keep the standard keys in sync.
      setActiveInvoicePrintTemplate(templateId, tid, cid || undefined);
    }
    window.dispatchEvent(new CustomEvent('bos_invoice_category_template_changed', { detail: { category, templateId } }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error setting active invoice template for category:', err);
  }
}

/**
 * Resolve the active template ID for a document category. Falls back to the
 * invoice category when the specific category has no saved template, so a
 * category always has a usable design.
 */
export function getActiveInvoicePrintTemplateForCategory(
  category: InvoiceDocCategory,
  tenantId?: string,
  companyId?: string,
): string | null {
  if (typeof window === 'undefined') return null;
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || localStorage.getItem('bos_active_company_id');
  try {
    // 1. Per-category active-template id (dedicated keys from ACTIVE_DOC_TEMPLATE_KEYS or category key).
    const direct = getActiveDocTemplateId(category, tid, cid || undefined);
    if (direct) return direct;

    // 2. Category slot written by setActiveInvoicePrintTemplateForCategory.
    const slot = cid
      ? localStorage.getItem(getInvoiceCategoryActiveKey(tid, cid, category))
      : localStorage.getItem(getInvoiceCategoryActiveKey(tid, null, category));
    if (slot) return slot;

    // 3. Fall back to the master invoice slot only when category has no custom selection.
    if (category !== 'invoice') {
      const inv =
        (cid ? localStorage.getItem(`bos_active_invoice_template_id_${tid}_${cid}`) : null) ||
        localStorage.getItem(`bos_active_invoice_template_id_${tid}`);
      if (inv) return inv;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Invoice category link to master ───────────────────────────────────────
// Every non-master invoice category (quotation, proforma, estimate, credit /
// debit note) LINKS to the master "invoice" category by default: it follows
// whatever template is active for invoices, so the whole invoice family stays
// consistent across save / print / PDF / email / WhatsApp with zero extra
// setup. A category can be explicitly "unlinked" to pin its own template
// (then it stops following the master). This mirrors the receipt/barcode
// live-link, but operates at the invoice document-category level.
export function getInvoiceCategoryLinkKey(tid: string, cid?: string | null, category?: string): string {
  const base = `bos_invoice_category_link_${tid}`;
  const catSuffix = category && category !== 'invoice' ? `_${category}` : '';
  return cid ? `${base}${catSuffix}_${cid}` : `${base}${catSuffix}`;
}

/** True when the category explicitly pins its own template (unlinked). */
export function isInvoiceCategoryUnlinked(category: InvoiceDocCategory, tenantId?: string, companyId?: string): boolean {
  if (category === 'invoice') return false;
  if (typeof window === 'undefined') return false;
  try {
    const tid = tenantId || getTenantIdFromStorage();
    const cid = companyId || localStorage.getItem('bos_active_company_id');
    if (cid) {
      return localStorage.getItem(getInvoiceCategoryLinkKey(tid, cid, category)) === 'unlinked';
    }
    return localStorage.getItem(getInvoiceCategoryLinkKey(tid, null, category)) === 'unlinked';
  } catch {
    return false;
  }
}

/**
 * Set the link state of an invoice category to the master.
 *  - linked  (true):  clear the pin so the category follows the master invoice
 *                    template automatically.
 *  - unlinked (false): pin the category to `templateId` (or the currently
 *                    resolved one) so it stops following the master.
 */
export function setInvoiceCategoryLinked(
  category: InvoiceDocCategory,
  linked: boolean,
  pinTemplateId?: string,
  tenantId?: string,
  companyId?: string,
): void {
  if (typeof window === 'undefined' || category === 'invoice') return;
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || localStorage.getItem('bos_active_company_id') || undefined;
  try {
    const key = getInvoiceCategoryLinkKey(tid, cid, category);
    const baseKey = ACTIVE_DOC_TEMPLATE_KEYS[category] || '';
    if (linked) {
      // Re-link: drop the unlinked pin AND clear this category's own active
      // key so the resolver dynamically follows the CURRENT master invoice
      // template (a frozen master ID would stop tracking later master changes).
      if (cid) {
        safeRemoveItem(key);
        safeRemoveItem(getInvoiceCategoryActiveKey(tid, cid, category));
        if (baseKey) safeRemoveItem(`${baseKey}_${tid}_${cid}`);
      } else {
        safeRemoveItem(getInvoiceCategoryLinkKey(tid, null, category));
        safeRemoveItem(getInvoiceCategoryActiveKey(tid, null, category));
        if (baseKey) safeRemoveItem(`${baseKey}_${tid}`);
      }
      const masterId = getActiveInvoicePrintTemplateForCategory('invoice', tid, cid);
      if (masterId) {
        // Keep the shared backend in step with the master's current pick.
        invoicesApi.setActivePrintTemplate(masterId, category).catch(() => {});
      }
    } else {
      // Unlink: pin this category to its own template so it stops following.
      if (cid) {
        safeSetItem(key, 'unlinked');
      } else {
        safeSetItem(getInvoiceCategoryLinkKey(tid, null, category), 'unlinked');
      }
      const pin = pinTemplateId || getActiveInvoicePrintTemplateForCategory(category, tid, cid);
      if (pin) {
        safeSetItem(getInvoiceCategoryActiveKey(tid, cid, category), pin);
        // Pin the dedicated per-category key family in lockstep.
        setActiveDocTemplateId(category, pin, tid, cid);
        invoicesApi.setActivePrintTemplate(pin, category).catch(() => {});
      }
    }
    window.dispatchEvent(new CustomEvent('bos_invoice_category_link_changed', { detail: { category, linked } }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error setting invoice category link state:', err);
  }
}

/** Convenience helper to explicitly unlink a category from master */
export function setInvoiceCategoryUnlinked(
  category: InvoiceDocCategory,
  pinTemplateId?: string,
  tenantId?: string,
  companyId?: string,
): void {
  setInvoiceCategoryLinked(category, false, pinTemplateId, tenantId, companyId);
}

/**
 * Helper to get the fully resolved active template object (with store & billing details merged)
 * for a specific document category (e.g. proforma, quotation, challan).
 */
export function getActiveInvoicePrintTemplateForDocCategory(
  category: InvoiceDocCategory,
  tenantId?: string,
  companyId?: string,
): any {
  const tid = tenantId || getTenantIdFromStorage();
  const cid = companyId || (typeof window !== 'undefined' ? localStorage.getItem('bos_active_company_id') : undefined);
  const activeGst = getActiveBillingGst(tid, cid || undefined);
  const categoryActiveId = getActiveInvoicePrintTemplateForCategory(category, tid, cid || undefined);

  if (typeof window !== 'undefined' && categoryActiveId) {
    try {
      const storageKey = getTenantTemplatesKey(tid);
      const invTemplatesRaw = localStorage.getItem(storageKey);
      if (invTemplatesRaw) {
        const invTemplates = pruneTemplateList(JSON.parse(invTemplatesRaw));
        const matched = invTemplates.find((t: any) => t.id === categoryActiveId || t.themeName === categoryActiveId);
        if (matched) {
          const isProddatur = matched.storeAddress && (matched.storeAddress.includes('KK Street, Proddatur') || matched.storeAddress.includes('Proddatur, YSR Cuddapah'));
          const isDummyGst = matched.gstin && matched.gstin.includes('37AABCCH694G1Z4');
          const isDummyPhone = matched.storePhone && matched.storePhone.includes('+91 9849344919');

          const cleanAddress = isProddatur ? '' : (matched.storeAddress || '');
          const cleanGstin = isDummyGst ? '' : (matched.gstin || '');
          const cleanPhone = isDummyPhone ? '' : (matched.storePhone || '');

          if (activeGst) {
            const res = {
              ...matched,
              gstin: activeGst.gstin || cleanGstin,
              storeName: activeGst.trade_name || activeGst.legal_name || '',
              storeAddress: activeGst.address || cleanAddress,
              storePhone: activeGst.phone || cleanPhone,
              storeEmail: activeGst.email || matched.storeEmail,
              cin: activeGst.cin || matched.cin,
              logoUrl: activeGst.logo_url || '',
              signatureUrl: activeGst.signature_url || matched.signatureUrl || matched.signature_url || null,
              stampUrl: activeGst.stamp_url || matched.stampUrl || matched.stamp_url || null,
              signatureTitle: activeGst.signature_title || matched.signatureTitle || matched.signature_title || 'Authorized Signatory',
              signatureCompanyName: activeGst.signature_company_name || `For ${activeGst.trade_name || activeGst.legal_name || 'Organization'}`,
            };
            if (res.wordConfig && typeof res.wordConfig === 'object') {
              res.wordConfig = {
                ...res.wordConfig,
                companyName: activeGst.trade_name || activeGst.legal_name || res.storeName,
                companyAddress: activeGst.address || res.storeAddress,
                companyGstin: activeGst.gstin || res.gstin,
                companyPhone: activeGst.phone || res.storePhone,
                companyEmail: activeGst.email || res.storeEmail,
              };
            }
            return res;
          }
        }
      }
    } catch (e) {
      console.error('Error loading active template for category:', category, e);
    }
  }

  return getActiveInvoicePrintTemplate(tid, cid || undefined);
}

export function getTenantReceiptTemplatesKey(tenantId?: string): string {
  if (typeof window === 'undefined') return 'bos_pos_active_receipt_templates_v1';
  let tid = tenantId;
  if (!tid) {
    try {
      const activeComp = localStorage.getItem('bos_active_company') || localStorage.getItem('bos-active-company');
      if (activeComp) tid = activeComp;
      if (!tid) {
        const authRaw = localStorage.getItem('bos-auth');
        if (authRaw) {
          const authParsed = JSON.parse(authRaw);
          tid = authParsed?.user?.tenantId || authParsed?.user?.tenant_id || authParsed?.user?.tenantSlug;
        }
      }
      if (!tid) {
        const raw = localStorage.getItem('bos-tenant');
        if (raw) {
          const parsed = JSON.parse(raw);
          tid = parsed?.id || parsed?.slug;
        }
      }
    } catch {}
  }
  return `bos_pos_active_receipt_templates_v1_${tid || 'default'}`;
}

export function getStoredReceiptTemplates(tenantId?: string): ReceiptTemplate[] {
  if (typeof window === 'undefined') return [DEFAULT_RECEIPT_TEMPLATE];
  try {
    const key = getTenantReceiptTemplatesKey(tenantId);
    const raw = localStorage.getItem(key);
    if (!raw) return [DEFAULT_RECEIPT_TEMPLATE];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_RECEIPT_TEMPLATE];
  } catch (err) {
    console.error('Failed to load receipt templates from storage:', err);
    return [DEFAULT_RECEIPT_TEMPLATE];
  }
}

export function saveReceiptTemplates(templates: ReceiptTemplate[], tenantId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getTenantReceiptTemplatesKey(tenantId);
    safeSetItem(key, JSON.stringify(pruneTemplateList(templates as any[])));
  } catch (err) {
    console.error('Failed to save receipt templates:', err);
  }
}

export function saveActiveReceiptTemplate(updated: ReceiptTemplate, tenantId?: string): void {
  const templates = getStoredReceiptTemplates(tenantId);
  const index = templates.findIndex((t) => t.id === updated.id);
  
  let newTemplates: ReceiptTemplate[];
  if (index >= 0) {
    newTemplates = templates.map((t) => (t.id === updated.id ? { ...updated, isDefault: true } : { ...t, isDefault: false }));
  } else {
    newTemplates = [
      ...templates.map((t) => ({ ...t, isDefault: false })),
      { ...updated, isDefault: true },
    ];
  }
  saveReceiptTemplates(newTemplates, tenantId);

  // Synchronize workspace-scoped keys only — never write the unsuffixed global
  // keys, which would leak this workspace's template into other tenants.
  if (typeof window !== 'undefined') {
    try {
      const defKey = getTenantDefaultsKey(tenantId);
      const activeMap = readActiveDefaults(defKey);
      activeMap.thermal = updated.id;
      activeMap.receipt = updated.id;
      if (tenantId) {
        safeSetItem(defKey, JSON.stringify(activeMap));
        safeSetItem(`bos_active_receipt_template_id_${tenantId}`, updated.id);
        safeSetItem(`bos_active_thermal_template_id_${tenantId}`, updated.id);
      }

      const tplKey = getTenantTemplatesKey(tenantId);
      const rawInv = tenantId ? localStorage.getItem(tplKey) : null;
      let invList = prunedTemplatesFromRaw(rawInv);
      if (!Array.isArray(invList)) invList = [];

      const mappedInvTemplate = {
        id: updated.id,
        name: updated.name,
        category: 'thermal',
        isDefault: true,
        paperSize: updated.paperSize,
        fontDensity: updated.fontDensity,
        printClarity: updated.printClarity || 'ultra_dark',
        thermalFontFamily: updated.fontFamily || 'monospace',
        dividerStyle: updated.dividerStyle || 'dashed',
        storeName: updated.storeName,
        storeAddress: updated.address,
        storePhone: updated.phone,
        storeEmail: updated.email,
        gstin: updated.gstin,
        cin: updated.cin,
        headerTitle: updated.invoiceTitle,
        footerText: updated.footerNote,
        termsText: updated.termsAndConditionsText || updated.declarationText || updated.termsText,
        termsAndConditionsText: updated.termsAndConditionsText || updated.termsText,
        showDeclaration: updated.showDeclaration !== false,
        declarationText: updated.declarationText || "We declare that this invoice shows the actual price of the goods described.",
        thankYouNote: updated.footerNote,
        upiId: updated.upiId,
        payeeName: updated.payeeName,
        customQrUrl: updated.customQrUrl,
        showGoogleReviewQR: updated.showGoogleReviewQR !== false,
        googleReviewUrl: updated.googleReviewUrl,
        showSignature: updated.showSignature !== false,
        showStamp: updated.showStamp !== false,
        signatureUrl: updated.signatureUrl,
        stampUrl: updated.stampUrl,
        signatoryLabel: updated.signatoryLabel,
        customFields: updated.customFields || [],
        customItemColumns: updated.customItemColumns || [],
        // Editable label words (receipt Texts & Labels editor) + master-link state.
        texts: updated.texts || {},
        customTexts: updated.customTexts || updated.texts || {},
        linkedToMaster: updated.linkedToMaster !== false,
        bankDetails: updated.bankDetails || '',
        fields: {
          showLogo: updated.showLogo,
          showStoreName: updated.showStoreName !== false,
          showBranchName: updated.showBranchName,
          showStoreAddress: updated.showStoreAddress,
          showStoreContact: updated.showStoreContact !== false,
          showTaxId: updated.showTaxId !== false,
          showCin: updated.showCin,
          showInvoiceTitle: updated.showInvoiceTitle !== false,
          showTagline: updated.showTagline,
          showCashier: updated.showCashier !== false,
          showInvoiceNumber: updated.showInvoiceNumber !== false,
          showInvoiceDate: updated.showInvoiceDate !== false,
          showPoNumber: updated.showPoNumber,
          showVehicleNumber: updated.showVehicleNumber,
          showEwayBill: updated.showEwayBill,
          showChallanNumber: updated.showChallanNumber,
          showDueDate: updated.showDueDate,
          showCustomerDetails: updated.showCustomerDetails,
          showCustomerAddress: updated.showCustomerAddress !== false,
          showCustomerPhone: updated.showCustomerPhone !== false,
          showCustomerGstin: updated.showCustomerGstin !== false,
          showPlaceOfSupply: updated.showPlaceOfSupply !== false,
          showShippingAddress: updated.showShippingAddress,
          showItemIndex: updated.showItemIndex !== false,
          showProductName: true,
          showPrice: true,
          showItemRate: updated.showItemRate !== false,
          showItemQty: updated.showItemQty !== false,
          showItemUom: updated.showItemUom !== false,
          showMRP: updated.showItemMrp !== false,
          showItemMrp: updated.showItemMrp !== false,
          showSKU: updated.showItemSKU || false,
          showHSN: updated.showItemHSN,
          showItemHSN: updated.showItemHSN,
          showPartyBalance: updated.showPartyBalance !== false,
          showItemDescription: updated.showItemDescription !== false,
          showTime: updated.showTime !== false,
          showQR: updated.showQrCode !== false,
          showPaymentQR: updated.showQrCode !== false,
          showGoogleReviewQR: updated.showGoogleReviewQR !== false,
          showBankDetails: updated.showPaymentMode !== false,
          showBarcode: true,
          showTotals: updated.showGrandTotal !== false,
          showDiscountBadge: updated.showTotalDiscount !== false,
          showItemDiscount: updated.showItemDiscount !== false,
          showTaxSplit: updated.showTaxBreakdown,
          showTaxBreakdown: updated.showTaxBreakdown,
          showRoundOff: updated.showRoundOff !== false,
          showTotalSavings: updated.showTotalSavings !== false,
          showSavingsBanner: updated.showSavingsBanner !== false,
          showPaidInFullStamp: updated.showPaidInFullStamp,
          showLoyaltyPoints: updated.showLoyaltyPoints,
          showTerms: updated.showTermsAndConditions !== false,
          showTermsAndConditions: updated.showTermsAndConditions !== false,
          showDeclaration: updated.showDeclaration !== false,
          showFooter: updated.showFooterNote !== false,
          showFooterNote: updated.showFooterNote !== false,
          showSignature: updated.showSignature !== false,
          showStamp: updated.showStamp !== false,
        }
      };

      const existingInvIdx = invList.findIndex((t: any) => t.id === updated.id);
      if (existingInvIdx >= 0) {
        invList[existingInvIdx] = mappedInvTemplate;
      } else {
        invList.push(mappedInvTemplate);
      }
      // Write only to the workspace-scoped key — never to the unsuffixed global key
      safeSetItem(tplKey, JSON.stringify(invList));

      // Persist to backend
      printTemplatesApi.saveTemplate(mappedInvTemplate, true).catch(() => {});
      printTemplatesApi.setActiveTemplate(updated.id, "thermal").catch(() => {});

      window.dispatchEvent(new CustomEvent('bos_receipt_template_changed', { detail: { template: updated } }));
      window.dispatchEvent(new CustomEvent('print_templates_updated', { detail: { template: mappedInvTemplate } }));
    } catch (e) {
      console.error('Failed to sync active template with inventory store:', e);
    }
  }
}

/**
 * Wipe ALL device-local print-template state for a tenant: the template lists,
 * the active-template id map, every per-document-category active key (invoice /
 * quotation / proforma / estimate / challan / credit note / debit note / purchase
 * invoice / purchase order / receipt / thermal / barcode / custom), the
 * category-slot + link-pin key families, and the legacy unsuffixed global keys.
 * Use this to "start from scratch" so the UI reloads a clean slate (the backend
 * copy is cleared separately via reset_print_templates.py).
 */
export function resetAllPrintTemplatesForTenant(tenantId?: string): string[] {
  if (typeof window === "undefined") return [];
  const tid = tenantId || getTenantIdFromStorage();
  const cid = localStorage.getItem("bos_active_company_id");
  const removed: string[] = [];
  const matchPrefixes = [
    "businessos_print_templates_v1",
    "user_active_print_templates_v1",
    "businessos_active_template_ids",
    "bos_active_invoice_template_id",
    "bos_active_quotation_template_id",
    "bos_active_proforma_template_id",
    "bos_active_estimate_template_id",
    "bos_active_challan_template_id",
    "bos_active_credit_note_template_id",
    "bos_active_debit_note_template_id",
    "bos_active_purchase_invoice_template_id",
    "bos_active_purchase_order_template_id",
    "bos_active_purchase_template_id",
    "bos_active_receipt_template_id",
    "bos_active_thermal_template_id",
    "bos_active_barcode_template_id",
    "bos_active_custom_doc_template_id",
    "bos_active_invoice_category_template",
    "bos_invoice_category_link",
    "bos_active_custom_doc_template_id",
  ];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;
    const scoped =
      key === "businessos_print_templates_v1" ||
      key === "user_active_print_templates_v1" ||
      matchPrefixes.some((p) => key.startsWith(p));
    if (!scoped) continue;
    // For tenant-scoped families, only delete this tenant's (or the global /
    // company-scoped variant of it) keys; never another tenant's data.
    const isGlobalOrThisTenant =
      key === "businessos_print_templates_v1" ||
      key === "user_active_print_templates_v1" ||
      key.includes(`_${tid}`) ||
      key.includes(`${tid}_${cid}`) ||
      key.endsWith(tid) ||
      !key.includes("_");
    if (!isGlobalOrThisTenant) continue;
    try {
      localStorage.removeItem(key);
      removed.push(key);
    } catch { /* ignore individual failures */ }
  }
  // Also clear ACTIVE_DOC_TEMPLATE_KEYS dedicated families explicitly.
  for (const base of Object.values(ACTIVE_DOC_TEMPLATE_KEYS)) {
    try {
      localStorage.removeItem(`${base}_${tid}`);
      if (cid) localStorage.removeItem(`${base}_${tid}_${cid}`);
      localStorage.removeItem(`${base}`);
    } catch { /* ignore */ }
  }
  // Clear the canonical template-list + active-default keys exactly as the
  // loader writes them (these can be company-scoped when the tenant resolves
  // to "default"), so stale lists cannot merge back in on the next load.
  try {
    localStorage.removeItem(getTenantTemplatesKey());
    localStorage.removeItem(getTenantDefaultsKey());
    localStorage.removeItem(`businessos_print_templates_v1_${tid}`);
    localStorage.removeItem(`user_active_print_templates_v1_${tid}`);
    localStorage.removeItem("businessos_print_templates_v1");
    localStorage.removeItem("user_active_print_templates_v1");
  } catch { /* ignore */ }
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new Event("print_templates_updated"));
  return removed;
}
